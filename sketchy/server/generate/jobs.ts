// Generation jobs and their drafts (F83; spec: Admin, Word generation). Ported and adapted from
// Buzzr (buzzer/server/generate/jobs.ts), much smaller: one job runs at a time, and a finished one
// holds its draft until the admin saves or discards it, or for 24 hours. Jobs live in memory only, so a restart
// forgets every draft, and nothing is saved until the admin reviews it. Drafts never reach rooms,
// sockets or logs: the log lines here carry counts and fixed messages, never a word or a title.

import { randomBytes } from 'node:crypto';
import {
  ADMIN_IMPORT_EMOJI,
  GENERATE_DRAFT_TTL_MS,
  GENERATE_DRAFTS_MAX,
} from '../../shared/constants.js';
import type {
  AdminGenerateMode,
  AdminGenerateStage,
  AdminGenerationJob,
} from '../../shared/types.js';
import type { StreamingClient } from './anthropic.js';
import { createChecker, createWriter } from './anthropic.js';
import {
  type GenerationResult,
  type RequestUsage,
  type WordRequest,
  GenerationError,
  generateWords,
  UNEXPECTED_ERROR,
} from './generator.js';

/** One generation through the writer and checker, reporting its stage as it goes. */
export type GenerateFn = (
  request: WordRequest,
  onStage: (stage: AdminGenerateStage) => void,
) => Promise<GenerationResult>;

/** The real generator: Sonnet writes, Haiku checks. */
export function anthropicGenerator(client: StreamingClient): GenerateFn {
  const writer = createWriter(client);
  const checker = createChecker(client);
  return (request, onStage) => generateWords(request, { writer, checker, onStage });
}

/** What a route asks for: a new category from a title, or more words for a category. */
export type JobRequest =
  | { kind: 'new'; title: string; count: number }
  | {
      kind: 'more';
      category: {
        id: string;
        title: string;
        emoji: string;
        words: readonly { word: string; alt: readonly string[] }[];
      };
      count: number;
    };

export type StartResult =
  { ok: true; job: AdminGenerationJob } | { ok: false; status: 409 | 503; error: string };

export type TakeResult =
  { ok: true; job: AdminGenerationJob } | { ok: false; status: 404 | 409; error: string };

export interface GenerationRunner {
  readonly mode: AdminGenerateMode;
  /** Every job held, newest first, as the admin sees them. */
  list(): AdminGenerationJob[];
  get(id: string): AdminGenerationJob | undefined;
  start(request: JobRequest): StartResult;
  /**
   * A ready draft, held for one save: a second save of the same draft is refused until `release`
   * (the save failed) or `finish` (it was saved, and the draft is gone).
   */
  take(id: string): TakeResult;
  release(id: string): void;
  finish(id: string): void;
  /** Drops a ready or failed job. A running one can't be stopped; it ends by itself. */
  discard(id: string): { ok: true } | { ok: false; status: 404 | 409; error: string };
  /** Resolves once no job is running. For tests. */
  idle(): Promise<void>;
}

export const GENERATION_BUSY = 'A generation is already running. Wait for it to finish.';
export const TOO_MANY_DRAFTS = `${GENERATE_DRAFTS_MAX} drafts are waiting. Save or discard one first.`;
export const NO_DRAFT =
  'There is no such draft. It was saved or discarded, or the server restarted.';
export const DRAFT_NOT_READY = 'That draft is not ready yet.';
export const DRAFT_SAVING = 'That draft is being saved.';
export const STILL_RUNNING = 'That generation is still running. Wait for it to finish.';
export const NOTHING_KEPT = 'No word survived the check. Try again, or try another title.';

interface HeldJob {
  view: AdminGenerationJob;
  /** Token counts, kept for the spend log (F84); never sent to the page. */
  usage: RequestUsage[];
  saving: boolean;
  /** When it ended (ready or failed), for the 24 h expiry; null while running. */
  endedAt: number | null;
}

export interface GenerationRunnerOptions {
  /** Null when generation is off. */
  generate: GenerateFn | null;
  mode: AdminGenerateMode;
  /** Why generation is off, shown on the admin page. */
  offMessage: string;
  clock: () => number;
  newId?: () => string;
  /** Told once of each job as it ends, with its usage (F84). A throw here is ignored. */
  onEnded?: (job: AdminGenerationJob, usage: readonly RequestUsage[]) => void;
  log?: (message: string) => void;
}

const copy = (job: AdminGenerationJob): AdminGenerationJob => structuredClone(job);

export function createGenerationRunner({
  generate,
  mode,
  offMessage,
  clock,
  newId = () => randomBytes(9).toString('base64url'),
  onEnded,
  log = (message) => console.log(message),
}: GenerationRunnerOptions): GenerationRunner {
  const jobs = new Map<string, HeldJob>();
  let running: Promise<void> | null = null;

  /** Forgets drafts and failed jobs that ended more than 24 hours ago (never one being saved). */
  function expire(): void {
    const now = clock();
    for (const [id, j] of jobs) {
      if (j.endedAt !== null && !j.saving && now - j.endedAt >= GENERATE_DRAFT_TTL_MS) {
        jobs.delete(id);
      }
    }
  }

  const held = (id: string) => {
    expire();
    return jobs.get(id);
  };

  function run(job: HeldJob, request: WordRequest, generateFn: GenerateFn): Promise<void> {
    const view = job.view;
    return generateFn(request, (stage) => {
      view.stage = stage;
    })
      .then((result) => {
        job.usage = result.usage;
        view.stage = null;
        if (result.words.length === 0) {
          view.status = 'failed';
          view.error = NOTHING_KEPT;
          log(`Word generation: no word kept of ${view.count}.`);
          return;
        }
        view.status = 'ready';
        view.draft = {
          emoji: result.emoji ?? (view.kind === 'new' ? ADMIN_IMPORT_EMOJI : ''),
          words: result.words,
        };
        log(`Word generation: kept ${result.words.length} of ${view.count} words.`);
      })
      .catch((err: unknown) => {
        view.stage = null;
        view.status = 'failed';
        // Only a GenerationError's own message: `cause` may hold the API's text.
        view.error = err instanceof GenerationError ? err.message : UNEXPECTED_ERROR;
        job.usage = err instanceof GenerationError ? err.usage : [];
        log(`Word generation failed: ${view.error}`);
      })
      .finally(() => {
        job.endedAt = clock();
        try {
          onEnded?.(copy(view), job.usage);
        } catch {
          // The history must never fail a job.
        }
      });
  }

  return {
    mode,

    list() {
      expire();
      return [...jobs.values()].map((j) => copy(j.view)).reverse();
    },

    get(id) {
      const job = held(id);
      return job && copy(job.view);
    },

    start(request) {
      if (generate === null) return { ok: false, status: 503, error: offMessage };
      if (running !== null) return { ok: false, status: 409, error: GENERATION_BUSY };
      expire();
      const ready = [...jobs.values()].filter((j) => j.view.status === 'ready').length;
      if (ready >= GENERATE_DRAFTS_MAX) return { ok: false, status: 409, error: TOO_MANY_DRAFTS };
      // A failed job is only there to say why; a new start replaces it.
      for (const [id, j] of jobs) if (j.view.status === 'failed') jobs.delete(id);

      const view: AdminGenerationJob = {
        id: newId(),
        kind: request.kind,
        title: request.kind === 'new' ? request.title : request.category.title,
        categoryId: request.kind === 'new' ? null : request.category.id,
        count: request.count,
        status: 'running',
        stage: null,
        error: null,
        startedAt: clock(),
        draft: null,
      };
      const job: HeldJob = { view, usage: [], saving: false, endedAt: null };
      jobs.set(view.id, job);
      const wordRequest: WordRequest =
        request.kind === 'new'
          ? { title: request.title, count: request.count, avoid: [], wantEmoji: true }
          : {
              title: request.category.title,
              count: request.count,
              // Its words and their alternates, so a draft never repeats either.
              avoid: request.category.words.flatMap((w) => [w.word, ...w.alt]),
              wantEmoji: false,
            };
      log(`Word generation: started (${request.count} words).`);
      running = run(job, wordRequest, generate).finally(() => {
        running = null;
      });
      return { ok: true, job: copy(view) };
    },

    take(id) {
      const job = held(id);
      if (!job) return { ok: false, status: 404, error: NO_DRAFT };
      if (job.view.status !== 'ready') return { ok: false, status: 409, error: DRAFT_NOT_READY };
      if (job.saving) return { ok: false, status: 409, error: DRAFT_SAVING };
      job.saving = true;
      return { ok: true, job: copy(job.view) };
    },

    release(id) {
      const job = held(id);
      if (job) job.saving = false;
    },

    finish(id) {
      jobs.delete(id);
    },

    discard(id) {
      const job = held(id);
      if (!job) return { ok: false, status: 404, error: NO_DRAFT };
      if (job.view.status === 'running') return { ok: false, status: 409, error: STILL_RUNNING };
      if (job.saving) return { ok: false, status: 409, error: DRAFT_SAVING };
      jobs.delete(id);
      return { ok: true };
    },

    async idle() {
      while (running !== null) await running;
    },
  };
}
