// Generation jobs (F110, F113). A generate or regenerate writes one or more levels of a category
// through the generator and saves each finished level as an admin-only draft. A replace writes one
// question and swaps it into a draft, or adds it. Jobs and the day's counts live in memory: a
// restart forgets them, and nothing is saved until it is finished, so nothing partial is kept.
// One job runs at a time. A generate or regenerate starts only when nothing else is queued or
// running; replaces wait their turn in a FIFO queue, behind a running generation too. At most
// `dailyLimit` levels and `replaceDailyLimit` replaces start per UTC day (DECISIONS F110, F113).

import { randomBytes } from 'node:crypto';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  GENERATE_COUNT_MAX,
  GENERATE_COUNT_MIN,
  GENERATE_POINTS,
  GENERATE_REPLACE_DAILY_LIMIT_DEFAULT,
  MAX_QUESTIONS_PER_SET,
} from '../../shared/constants.js';
import { emojiSchema } from '../../shared/schemas.js';
import type {
  GenerateJob,
  GenerateLevelBody,
  GeneratedLevel,
  Question,
  QuestionSet,
} from '../../shared/types.js';
import type { BuiltInStore } from '../builtInStore.js';
import type { StreamingClient } from './anthropic.js';
import { createChecker, createWriter } from './anthropic.js';
import {
  categoryEmojiOf,
  categoryKey,
  categoryName,
  categoryQuestionTexts,
  uniqueTitle,
} from './categories.js';
import {
  type GeneratedQuestion,
  type LevelRequest,
  type LevelResult,
  type LevelStage,
  GenerationCancelled,
  GenerationError,
  generateLevel,
} from './generator.js';
import { addUsage, emptyUsage } from './pricing.js';

/** One level through the writer and checker, reporting its stage as it goes. */
export type GenerateLevelFn = (
  request: LevelRequest,
  onStage: (stage: LevelStage) => void,
  /** Aborted by a cancel: stop before the next API call with a `GenerationCancelled` (F113). */
  signal?: AbortSignal,
) => Promise<LevelResult>;

/** The real generator: Sonnet writes, Haiku checks (F109). */
export function anthropicGenerator(client: StreamingClient): GenerateLevelFn {
  const writer = createWriter(client);
  const checker = createChecker(client);
  return (request, onStage, signal) =>
    generateLevel(request, { writer, checker, onStage, ...(signal ? { signal } : {}) });
}

export interface JobRunnerOptions {
  /** Null when the server has no `BUZZR_ANTHROPIC_API_KEY`: generation is off. */
  generate: GenerateLevelFn | null;
  store: BuiltInStore;
  clock: () => number;
  /** `GENERATE_DAILY_LIMIT`: levels that may start per UTC day. */
  dailyLimit: number;
  /** `GENERATE_REPLACE_DAILY_LIMIT`: replaces and additions that may start per UTC day (F113). */
  replaceDailyLimit?: number;
  /** Ids for jobs, sets and questions. Tests pass a counter. */
  newId?: () => string;
  /**
   * Told once of each job as it ends (done, failed or cancelled), a queued one cancelled at once
   * too: the generation history (F127). A throw here is ignored, so it never fails a job.
   */
  onEnded?: (job: GenerateJob) => void;
}

/** What a route asks the runner to do. */
export type JobRequest =
  | { kind: 'generate'; category: string; guidance: string; levels: GenerateLevelBody[] }
  | { kind: 'regenerate'; setId: string }
  /** One question of a draft written again, or (`questionId` null) one more added (F113). */
  | { kind: 'replace'; setId: string; questionId: string | null; note: string };

export type StartResult =
  | { ok: true; job: GenerateJob }
  | { ok: false; status: 400 | 404 | 409 | 429 | 503; error: string };

export type CancelResult =
  { ok: true; job: GenerateJob } | { ok: false; status: 404 | 409; error: string };

export interface JobRunner {
  readonly enabled: boolean;
  readonly dailyLimit: number;
  /** Levels started today (UTC). */
  usedToday(): number;
  readonly replaceDailyLimit: number;
  /** Replaces and additions started today (UTC). */
  replacesToday(): number;
  /** The generate or regenerate queued or running now, if any. Replaces are listed by set. */
  running(): GenerateJob | null;
  get(id: string): GenerateJob | undefined;
  /** The set's replace jobs: running, then queued in order, then the newest finished (F113). */
  replacesFor(setId: string): GenerateJob[];
  /** The newest job for each category, by `categoryKey`. */
  latestByCategory(): Map<string, GenerateJob>;
  /** True while a job for this category (a replace too) is queued or running. */
  busyWith(key: string): boolean;
  /**
   * The count asked for of each set a kept job saved, the newest job winning (F111), so the list
   * can show "13 of 15" after the job is done. Forgotten on restart, like the jobs.
   */
  wantedBySet(): Map<string, number>;
  /** Forgets the category's latest job, so a deleted category leaves the list (F111). */
  forget(key: string): void;
  start(request: JobRequest): StartResult;
  /** Stops a queued job at once, and a running one after its current API call (F113). */
  cancel(id: string): CancelResult;
  /** Resolves once no job is queued or running. For tests and shutdown. */
  idle(): Promise<void>;
}

export const GENERATION_OFF_ERROR =
  'Generation is not set up: the server has no BUZZR_ANTHROPIC_API_KEY.';
export const GENERATION_BUSY_ERROR = 'A generation is already running. Wait for it to finish.';
export const REPLACES_BUSY_ERROR =
  'Questions are being replaced. Wait for them to finish, or cancel them.';
const NO_SET_ERROR = 'There is no built-in set with that id.';
const NO_DRAFT_ERROR = 'There is no draft with that id.';
const NO_QUESTION_ERROR = 'The draft has no question with that id.';
const SAVE_FAILED_ERROR = 'Could not save the generated questions. Try again.';
export const QUESTION_REMOVED_ERROR = 'The question was removed';
const DRAFT_GONE_ERROR = 'The draft is gone: it was published, discarded or deleted.';
const DRAFT_FULL_ERROR = `The draft already has ${MAX_QUESTIONS_PER_SET} questions.`;
const FAILED_ERROR = 'Question generation failed unexpectedly. Try again.';
/** Jobs kept for `GET /jobs/:id`; the oldest finished ones are forgotten first. */
const JOBS_KEPT = 100;
/** Finished replaces listed per set by `GET /jobs?setId=`, newest first. */
const FINISHED_REPLACES_LISTED = 20;

/** A failure with a message fit for the admin. */
class JobFailure extends Error {}
/** The admin cancelled the job. */
class JobCancelled extends Error {}

const ENDED: ReadonlySet<GenerateJob['state']> = new Set(['done', 'failed', 'cancelled']);

/** The guidance with a replace's note after it, for the writer. */
export function withNote(guidance: string, note: string): string {
  return [guidance.trim(), note.trim() ? `For this question: ${note.trim()}` : '']
    .filter(Boolean)
    .join('\n');
}

function randomId(): string {
  return randomBytes(15).toString('base64url');
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** What a job will do, resolved against the store when it starts. */
type Plan =
  | {
      kind: 'generate';
      category: string;
      guidance: string;
      levels: GenerateLevelBody[];
    }
  | {
      kind: 'regenerate';
      setId: string;
      category: string;
      levels: [GenerateLevelBody];
    }
  | {
      kind: 'replace';
      setId: string;
      questionId: string | null;
      note: string;
      category: string;
      levels: [GenerateLevelBody];
    };

/** A job and what the runner needs to run or cancel it. */
interface Entry {
  job: GenerateJob;
  plan: Plan;
  controller: AbortController;
}

/** The set's own draft, if it has one. */
function draftOf(drafts: Record<string, QuestionSet>, id: string): QuestionSet | undefined {
  return Object.hasOwn(drafts, id) ? drafts[id] : undefined;
}

export function createJobRunner({
  generate,
  store,
  clock,
  dailyLimit,
  replaceDailyLimit = GENERATE_REPLACE_DAILY_LIMIT_DEFAULT,
  newId = randomId,
  onEnded,
}: JobRunnerOptions): JobRunner {
  const entries = new Map<string, Entry>();
  const latest = new Map<string, string>();
  /** Replaces waiting their turn, oldest first. */
  const queue: Entry[] = [];
  let current: Entry | null = null;
  let currentRun: Promise<void> = Promise.resolve();
  let day = utcDay(clock());
  let used = 0;
  let replaces = 0;

  const usedToday = (): number => {
    const today = utcDay(clock());
    if (today !== day) {
      day = today;
      used = 0;
      replaces = 0;
    }
    return used;
  };
  const replacesToday = (): number => {
    usedToday();
    return replaces;
  };

  const snapshot = ({ job }: Entry): GenerateJob => {
    const at = queue.findIndex((e) => e.job.id === job.id);
    return { ...structuredClone(job), queuePosition: at === -1 ? null : at + 1 };
  };

  const ended = (entry: Entry): void => {
    try {
      onEnded?.(snapshot(entry));
    } catch {
      // The history is best effort; the job has ended either way.
    }
  };

  const isGeneration = (e: Entry | null): e is Entry => e !== null && e.job.kind !== 'replace';

  /**
   * Each category's newest non-empty generate guidance, for its replaces (F113). Kept apart from
   * the jobs so trimming old jobs keeps it; a delete forgets it; a restart loses it.
   */
  const guidance = new Map<string, string>();

  /** The plan for a request, or why it cannot run. */
  function plan(request: JobRequest): Plan | Extract<StartResult, { ok: false }> {
    const data = store.read();
    if (request.kind === 'generate') {
      const levels = [...request.levels].sort(
        (a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty),
      );
      // More levels for an existing category keep its spelling.
      const category = categoryName(data, categoryKey(request.category)) ?? request.category.trim();
      return { kind: 'generate', category, guidance: request.guidance, levels };
    }
    const draft = draftOf(data.drafts, request.setId);
    if (request.kind === 'replace') {
      if (!draft) return { ok: false, status: 404, error: NO_DRAFT_ERROR };
      if (
        request.questionId !== null &&
        !draft.questions.some((q) => q.id === request.questionId)
      ) {
        return { ok: false, status: 404, error: NO_QUESTION_ERROR };
      }
    }
    const set = draft ?? data.sets.find((s) => s.id === request.setId);
    if (!set) return { ok: false, status: 404, error: NO_SET_ERROR };
    if (set.category === undefined || set.category.trim() === '' || !set.difficulty) {
      return {
        ok: false,
        status: 400,
        error:
          request.kind === 'replace'
            ? 'Only a set with a category and a difficulty can have questions written by Claude.'
            : 'Only a set with a category and a difficulty can be regenerated.',
      };
    }
    if (request.kind === 'replace') {
      const queuedAdds = queue.filter(
        (e) => e.job.setId === set.id && e.job.questionId === null,
      ).length;
      const runningAdd =
        current?.job.kind === 'replace' && current.job.setId === set.id && !current.job.questionId
          ? 1
          : 0;
      if (
        request.questionId === null &&
        set.questions.length + queuedAdds + runningAdd >= MAX_QUESTIONS_PER_SET
      ) {
        return { ok: false, status: 409, error: DRAFT_FULL_ERROR };
      }
      return {
        kind: 'replace',
        setId: set.id,
        questionId: request.questionId,
        note: request.note,
        category: set.category.trim(),
        levels: [{ difficulty: set.difficulty, count: 1 }],
      };
    }
    const count = Math.min(GENERATE_COUNT_MAX, Math.max(GENERATE_COUNT_MIN, set.questions.length));
    return {
      kind: 'regenerate',
      setId: set.id,
      category: set.category.trim(),
      levels: [{ difficulty: set.difficulty, count }],
    };
  }

  function questionOf(q: GeneratedQuestion, id: string, points: number): Question {
    return {
      id,
      text: q.text,
      answer: q.answer,
      ...(q.hostNotes ? { hostNotes: q.hostNotes } : {}),
      points,
    };
  }

  /** Saves a finished level as a new draft, or as the regenerated set's draft. */
  async function save(
    p: Exclude<Plan, { kind: 'replace' }>,
    level: GenerateLevelBody,
    result: LevelResult,
  ): Promise<GeneratedLevel> {
    const now = clock();
    const questions = result.questions.map((q) =>
      questionOf(q, newId(), GENERATE_POINTS[level.difficulty]),
    );
    let saved: QuestionSet | undefined;
    try {
      await store.update((data) => {
        if (p.kind === 'regenerate') {
          const live = data.sets.find((s) => s.id === p.setId);
          const base = draftOf(data.drafts, p.setId) ?? live;
          // Deleted while the level was written: nothing to save it over.
          if (!base) return data;
          const next: QuestionSet = { ...base, questions, updatedAt: now };
          // The old board names the old questions' ids, so it goes with them.
          delete next.board;
          saved = next;
        } else {
          saved = {
            id: newId(),
            title: uniqueTitle(data, `${p.category} – ${DIFFICULTY_LABELS[level.difficulty]}`),
            category: p.category,
            difficulty: level.difficulty,
            questions,
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
          };
        }
        // Written by Claude, so it waits for the admin's review, even a draft reviewed before (F114).
        return {
          ...data,
          drafts: { ...data.drafts, [saved.id]: saved },
          unreviewed: [...data.unreviewed.filter((id) => id !== saved!.id), saved.id],
        };
      });
    } catch {
      throw new JobFailure(SAVE_FAILED_ERROR);
    }
    if (!saved) throw new JobFailure('The set was deleted while its questions were written.');
    return {
      difficulty: level.difficulty,
      setId: saved.id,
      title: saved.title,
      questions: questions.length,
      count: level.count,
    };
  }

  /**
   * Stores the writer's emoji for a category that still has none (the admin may have picked one
   * meanwhile). Best effort: a failed write never fails the job (F129).
   */
  async function saveEmoji(key: string, raw: string): Promise<void> {
    const parsed = emojiSchema.safeParse(raw);
    if (!parsed.success) return;
    const emoji = parsed.data;
    try {
      await store.update((data) =>
        categoryEmojiOf(data, key) !== null
          ? data
          : { ...data, categoryEmoji: { ...data.categoryEmoji, [key]: emoji } },
      );
    } catch {
      // The category simply has no emoji yet; the next generate asks again.
    }
  }

  /** One level through the generator, stopping on a cancel; the usage goes on the job. */
  async function write(entry: Entry, request: LevelRequest): Promise<LevelResult> {
    const { job, controller } = entry;
    let result: LevelResult;
    try {
      result = await generate!(
        request,
        (stage) => {
          job.state = stage;
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof GenerationError) {
        job.usage = addUsage(job.usage, err.usage);
        if (err instanceof GenerationCancelled) throw new JobCancelled();
        throw new JobFailure(err.message);
      }
      throw new JobFailure(FAILED_ERROR);
    }
    job.usage = addUsage(job.usage, result.usage);
    // Cancelled during the last API call: the admin asked for nothing more, so nothing is saved.
    if (controller.signal.aborted) throw new JobCancelled();
    return result;
  }

  async function runLevels(entry: Entry, p: Exclude<Plan, { kind: 'replace' }>): Promise<void> {
    const { job, controller } = entry;
    const key = categoryKey(p.category);
    const written: string[] = [];
    for (const [index, level] of p.levels.entries()) {
      if (controller.signal.aborted) throw new JobCancelled();
      // A generate's first level also asks for the emoji of a category with none (F129).
      const wantEmoji =
        p.kind === 'generate' && index === 0 && categoryEmojiOf(store.read(), key) === null;
      job.currentLevel = level.difficulty;
      job.state = 'writing';
      usedToday();
      used++;
      const result = await write(entry, {
        category: p.category,
        guidance: job.guidance,
        difficulty: level.difficulty,
        count: level.count,
        // The category as saved now, which holds this job's earlier levels too.
        avoid: [...new Set([...categoryQuestionTexts(store.read(), key), ...written])],
        ...(wantEmoji ? { wantEmoji } : {}),
      });
      if (result.questions.length === 0) {
        throw new JobFailure(
          `No ${DIFFICULTY_LABELS[level.difficulty]} question passed the fact check. Try again.`,
        );
      }
      const finished = await save(p, level, result);
      if (result.emoji !== undefined) await saveEmoji(key, result.emoji);
      written.push(...result.questions.map((q) => q.text));
      job.finished.push(finished);
      if (finished.questions < finished.count) job.short.push(finished);
    }
  }

  /** The draft's question, or why the replace cannot go on. */
  function stillThere(p: Extract<Plan, { kind: 'replace' }>, data = store.read()): QuestionSet {
    const draft = draftOf(data.drafts, p.setId);
    if (!draft) throw new JobFailure(DRAFT_GONE_ERROR);
    if (p.questionId !== null && !draft.questions.some((q) => q.id === p.questionId)) {
      throw new JobFailure(QUESTION_REMOVED_ERROR);
    }
    return draft;
  }

  async function runReplace(entry: Entry, p: Extract<Plan, { kind: 'replace' }>): Promise<void> {
    const { job } = entry;
    const [level] = p.levels;
    const draft = stillThere(p);
    job.currentLevel = level.difficulty;
    job.state = 'writing';
    replacesToday();
    replaces++;
    const result = await write(entry, {
      category: p.category,
      guidance: withNote(job.guidance, p.note),
      difficulty: level.difficulty,
      count: 1,
      // The whole level, the question being replaced too, so it never comes back.
      avoid: [...new Set(draft.questions.map((q) => q.text.trim()).filter(Boolean))],
    });
    const written = result.questions[0];
    if (!written) throw new JobFailure('No question passed the fact check. Try again.');
    const now = clock();
    let replaced: GenerateJob['replaced'] = null;
    let refused: JobFailure | null = null;
    try {
      // Read fresh: the admin may have edited, removed or added questions meanwhile.
      await store.update((data) => {
        let fresh: QuestionSet;
        try {
          fresh = stillThere(p, data);
        } catch (err) {
          refused = err as JobFailure;
          return data;
        }
        let questions: Question[];
        if (p.questionId === null) {
          if (fresh.questions.length >= MAX_QUESTIONS_PER_SET) {
            refused = new JobFailure(DRAFT_FULL_ERROR);
            return data;
          }
          const added = questionOf(written, newId(), GENERATE_POINTS[level.difficulty]);
          replaced = { old: null, new: added };
          questions = [...fresh.questions, added];
        } else {
          const old = fresh.questions.find((q) => q.id === p.questionId)!;
          const swapped = questionOf(written, old.id, old.points);
          replaced = { old, new: swapped };
          questions = fresh.questions.map((q) => (q.id === old.id ? swapped : q));
        }
        const next: QuestionSet = { ...fresh, questions, updatedAt: now };
        return { ...data, drafts: { ...data.drafts, [next.id]: next } };
      });
    } catch {
      throw new JobFailure(SAVE_FAILED_ERROR);
    }
    if (refused) throw refused;
    job.replaced = replaced;
  }

  async function run(entry: Entry): Promise<void> {
    const { job, plan: p } = entry;
    try {
      if (entry.controller.signal.aborted) throw new JobCancelled();
      if (p.kind === 'replace') await runReplace(entry, p);
      else await runLevels(entry, p);
      job.state = 'done';
    } catch (err) {
      if (err instanceof JobCancelled) {
        job.state = 'cancelled';
      } else {
        job.state = 'failed';
        job.error = err instanceof JobFailure ? err.message : FAILED_ERROR;
      }
    } finally {
      job.currentLevel = null;
      job.finishedAt = clock();
      current = null;
      ended(entry);
      next();
    }
  }

  /** Starts the next queued replace when nothing runs. Started on the next tick. */
  function next(): void {
    if (current !== null) return;
    const entry = queue.shift();
    if (!entry) return;
    begin(entry);
  }

  function begin(entry: Entry): void {
    current = entry;
    // On the next tick, so a route answers with the job still queued.
    currentRun = Promise.resolve().then(() => run(entry));
  }

  /** Forgets the oldest finished jobs past JOBS_KEPT; queued and running ones are kept. */
  function trim(): void {
    for (const [id, { job }] of entries) {
      if (entries.size <= JOBS_KEPT) return;
      if (ENDED.has(job.state)) entries.delete(id);
    }
  }

  function limitError(p: Plan): Extract<StartResult, { ok: false }> | null {
    if (p.kind === 'replace') {
      // Queued replaces are counted ahead, so the queue never holds more than the day allows.
      const left = replaceDailyLimit - replacesToday() - queue.length;
      if (left > 0) return null;
      return {
        ok: false,
        status: 429,
        error: `Daily limit reached: ${replaceDailyLimit} replacements a day. Try again tomorrow (UTC).`,
      };
    }
    const left = dailyLimit - usedToday();
    if (p.levels.length <= left) return null;
    return {
      ok: false,
      status: 429,
      error:
        left === 0
          ? `Daily limit reached: ${dailyLimit} levels a day. Try again tomorrow (UTC).`
          : `Only ${left} more ${left === 1 ? 'level' : 'levels'} can be generated today (UTC).`,
    };
  }

  return {
    get enabled() {
      return generate !== null;
    },
    dailyLimit,
    replaceDailyLimit,
    usedToday,
    replacesToday,
    running: () => (isGeneration(current) ? snapshot(current) : null),
    get: (id) => {
      const entry = entries.get(id);
      return entry ? snapshot(entry) : undefined;
    },
    replacesFor(setId) {
      const mine = (e: Entry | null): e is Entry =>
        e !== null && e.job.kind === 'replace' && e.job.setId === setId;
      const waiting = [current, ...queue].filter(mine);
      const finished = [...entries.values()]
        .filter((e) => mine(e) && ENDED.has(e.job.state))
        .reverse()
        .slice(0, FINISHED_REPLACES_LISTED);
      return [...waiting, ...finished].map(snapshot);
    },
    latestByCategory() {
      const out = new Map<string, GenerateJob>();
      for (const [key, id] of latest) {
        const entry = entries.get(id);
        if (entry) out.set(key, snapshot(entry));
      }
      return out;
    },
    busyWith: (key) =>
      [current, ...queue].some((e) => e !== null && categoryKey(e.job.category) === key),
    forget: (key) => {
      latest.delete(key);
      guidance.delete(key);
    },
    wantedBySet() {
      const out = new Map<string, number>();
      // Jobs are kept oldest first, so a later job's count writes over an earlier one's.
      for (const { job } of entries.values()) {
        for (const level of job.finished) out.set(level.setId, level.count);
      }
      return out;
    },
    start(request) {
      if (generate === null) return { ok: false, status: 503, error: GENERATION_OFF_ERROR };
      if (request.kind !== 'replace') {
        if (isGeneration(current)) return { ok: false, status: 409, error: GENERATION_BUSY_ERROR };
        if (current !== null || queue.length > 0) {
          return { ok: false, status: 409, error: REPLACES_BUSY_ERROR };
        }
      }
      const p = plan(request);
      if (!('kind' in p)) return p;
      const refused = limitError(p);
      if (refused) return refused;
      const key = categoryKey(p.category);
      const job: GenerateJob = {
        id: newId(),
        kind: p.kind,
        setId: p.kind === 'generate' ? null : p.setId,
        category: p.category,
        guidance:
          request.kind === 'generate'
            ? request.guidance
            : request.kind === 'replace'
              ? (guidance.get(key) ?? '')
              : '',
        levels: p.levels,
        questionId: p.kind === 'replace' ? p.questionId : null,
        note: p.kind === 'replace' ? p.note : '',
        queuePosition: null,
        replaced: null,
        state: 'queued',
        currentLevel: null,
        finished: [],
        short: [],
        usage: emptyUsage(),
        error: null,
        startedAt: clock(),
        finishedAt: null,
      };
      const entry: Entry = { job, plan: p, controller: new AbortController() };
      entries.set(job.id, entry);
      if (p.kind !== 'replace') latest.set(key, job.id);
      if (p.kind === 'generate' && p.guidance) guidance.set(key, p.guidance);
      trim();
      if (p.kind === 'replace') {
        queue.push(entry);
        next();
      } else {
        begin(entry);
      }
      return { ok: true, job: snapshot(entry) };
    },
    cancel(id) {
      const entry = entries.get(id);
      if (!entry) return { ok: false, status: 404, error: 'There is no job with that id.' };
      const { job } = entry;
      if (ENDED.has(job.state)) {
        return { ok: false, status: 409, error: 'This job has already finished.' };
      }
      const at = queue.indexOf(entry);
      if (at !== -1) {
        // Never started: it stops now, and costs nothing.
        queue.splice(at, 1);
        job.state = 'cancelled';
        job.finishedAt = clock();
        ended(entry);
      } else {
        // Running (or about to): it stops before its next API call.
        entry.controller.abort();
      }
      return { ok: true, job: snapshot(entry) };
    },
    async idle() {
      while (current !== null || queue.length > 0) await currentRun;
    },
  };
}
