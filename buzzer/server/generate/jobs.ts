// Generation jobs (F110). A job writes one or more levels of a category through the generator and
// saves each finished level as an admin-only draft. Jobs and the day's count live in memory: a
// restart forgets them, and a level is saved only once it is finished, so nothing partial is kept.
// One job runs at a time, and at most `dailyLimit` levels start per UTC day (DECISIONS F110).

import { randomBytes } from 'node:crypto';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  GENERATE_COUNT_MAX,
  GENERATE_COUNT_MIN,
  GENERATE_POINTS,
} from '../../shared/constants.js';
import type {
  Difficulty,
  GenerateJob,
  GenerateLevelBody,
  GeneratedLevel,
  Question,
  QuestionSet,
} from '../../shared/types.js';
import type { BuiltInStore } from '../builtInStore.js';
import type { StreamingClient } from './anthropic.js';
import { createChecker, createWriter } from './anthropic.js';
import { categoryKey, categoryName, categoryQuestionTexts, uniqueTitle } from './categories.js';
import {
  type LevelRequest,
  type LevelResult,
  type LevelStage,
  GenerationError,
  generateLevel,
} from './generator.js';
import { addUsage, emptyUsage } from './pricing.js';

/** One level through the writer and checker, reporting its stage as it goes. */
export type GenerateLevelFn = (
  request: LevelRequest,
  onStage: (stage: LevelStage) => void,
) => Promise<LevelResult>;

/** The real generator: Sonnet writes, Haiku checks (F109). */
export function anthropicGenerator(client: StreamingClient): GenerateLevelFn {
  const writer = createWriter(client);
  const checker = createChecker(client);
  return (request, onStage) => generateLevel(request, { writer, checker, onStage });
}

export interface JobRunnerOptions {
  /** Null when the server has no `BUZZR_ANTHROPIC_API_KEY`: generation is off. */
  generate: GenerateLevelFn | null;
  store: BuiltInStore;
  clock: () => number;
  /** `GENERATE_DAILY_LIMIT`: levels that may start per UTC day. */
  dailyLimit: number;
  /** Ids for jobs, sets and questions. Tests pass a counter. */
  newId?: () => string;
}

/** What a route asks the runner to do. */
export type JobRequest =
  | { kind: 'generate'; category: string; guidance: string; levels: GenerateLevelBody[] }
  | { kind: 'regenerate'; setId: string };

export type StartResult =
  | { ok: true; job: GenerateJob }
  | { ok: false; status: 400 | 404 | 409 | 429 | 503; error: string };

export interface JobRunner {
  readonly enabled: boolean;
  readonly dailyLimit: number;
  /** Levels started today (UTC). */
  usedToday(): number;
  /** The job queued or running now, if any. */
  running(): GenerateJob | null;
  get(id: string): GenerateJob | undefined;
  /** The newest job for each category, by `categoryKey`. */
  latestByCategory(): Map<string, GenerateJob>;
  /** True while a job for this category is queued or running. */
  busyWith(key: string): boolean;
  /**
   * The count asked for of each set a kept job saved, the newest job winning (F111), so the list
   * can show "13 of 15" after the job is done. Forgotten on restart, like the jobs.
   */
  wantedBySet(): Map<string, number>;
  /** Forgets the category's latest job, so a deleted category leaves the list (F111). */
  forget(key: string): void;
  start(request: JobRequest): StartResult;
  /** Resolves once no job is running. For tests and shutdown. */
  idle(): Promise<void>;
}

export const GENERATION_OFF_ERROR =
  'Generation is not set up: the server has no BUZZR_ANTHROPIC_API_KEY.';
export const GENERATION_BUSY_ERROR = 'A generation is already running. Wait for it to finish.';
const NO_SET_ERROR = 'There is no built-in set with that id.';
const SAVE_FAILED_ERROR = 'Could not save the generated questions. Try again.';
/** Jobs kept for `GET /jobs/:id`; older ones are forgotten first. */
const JOBS_KEPT = 100;

/** A failure with a message fit for the admin. */
class JobFailure extends Error {}

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
    };

export function createJobRunner({
  generate,
  store,
  clock,
  dailyLimit,
  newId = randomId,
}: JobRunnerOptions): JobRunner {
  const jobs = new Map<string, GenerateJob>();
  const latest = new Map<string, string>();
  let current: GenerateJob | null = null;
  let currentRun: Promise<void> = Promise.resolve();
  let day = utcDay(clock());
  let used = 0;

  const usedToday = (): number => {
    const today = utcDay(clock());
    if (today !== day) {
      day = today;
      used = 0;
    }
    return used;
  };

  const snapshot = (job: GenerateJob): GenerateJob => structuredClone(job);

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
    const live = data.sets.find((s) => s.id === request.setId);
    const draft = Object.hasOwn(data.drafts, request.setId)
      ? data.drafts[request.setId]
      : undefined;
    const set = draft ?? live;
    if (!set) return { ok: false, status: 404, error: NO_SET_ERROR };
    if (set.category === undefined || set.category.trim() === '' || !set.difficulty) {
      return {
        ok: false,
        status: 400,
        error: 'Only a set with a category and a difficulty can be regenerated.',
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

  function questionsOf(result: LevelResult, difficulty: Difficulty): Question[] {
    return result.questions.map((q) => ({
      id: newId(),
      text: q.text,
      answer: q.answer,
      ...(q.hostNotes ? { hostNotes: q.hostNotes } : {}),
      points: GENERATE_POINTS[difficulty],
    }));
  }

  /** Saves a finished level as a new draft, or as the regenerated set's draft. */
  async function save(
    p: Plan,
    level: GenerateLevelBody,
    result: LevelResult,
  ): Promise<GeneratedLevel> {
    const now = clock();
    const questions = questionsOf(result, level.difficulty);
    let saved: QuestionSet | undefined;
    try {
      await store.update((data) => {
        if (p.kind === 'regenerate') {
          const live = data.sets.find((s) => s.id === p.setId);
          const draft = Object.hasOwn(data.drafts, p.setId) ? data.drafts[p.setId] : undefined;
          const base = draft ?? live;
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
        return { ...data, drafts: { ...data.drafts, [saved.id]: saved } };
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

  async function run(job: GenerateJob, p: Plan, guidance: string): Promise<void> {
    const key = categoryKey(p.category);
    const written: string[] = [];
    try {
      for (const level of p.levels) {
        job.currentLevel = level.difficulty;
        job.state = 'writing';
        usedToday();
        used++;
        const request: LevelRequest = {
          category: p.category,
          guidance,
          difficulty: level.difficulty,
          count: level.count,
          // The category as saved now, which holds this job's earlier levels too.
          avoid: [...new Set([...categoryQuestionTexts(store.read(), key), ...written])],
        };
        let result: LevelResult;
        try {
          result = await generate!(request, (stage) => {
            job.state = stage;
          });
        } catch (err) {
          if (err instanceof GenerationError) {
            job.usage = addUsage(job.usage, err.usage);
            throw new JobFailure(err.message);
          }
          throw new JobFailure('Question generation failed unexpectedly. Try again.');
        }
        job.usage = addUsage(job.usage, result.usage);
        if (result.questions.length === 0) {
          throw new JobFailure(
            `No ${DIFFICULTY_LABELS[level.difficulty]} question passed the fact check. Try again.`,
          );
        }
        const finished = await save(p, level, result);
        written.push(...result.questions.map((q) => q.text));
        job.finished.push(finished);
        if (finished.questions < finished.count) job.short.push(finished);
      }
      job.state = 'done';
    } catch (err) {
      job.state = 'failed';
      job.error =
        err instanceof JobFailure
          ? err.message
          : 'Question generation failed unexpectedly. Try again.';
    } finally {
      job.currentLevel = null;
      job.finishedAt = clock();
      current = null;
    }
  }

  return {
    get enabled() {
      return generate !== null;
    },
    dailyLimit,
    usedToday,
    running: () => (current ? snapshot(current) : null),
    get: (id) => {
      const job = jobs.get(id);
      return job ? snapshot(job) : undefined;
    },
    latestByCategory() {
      const out = new Map<string, GenerateJob>();
      for (const [key, id] of latest) {
        const job = jobs.get(id);
        if (job) out.set(key, snapshot(job));
      }
      return out;
    },
    busyWith: (key) => current !== null && categoryKey(current.category) === key,
    forget: (key) => {
      latest.delete(key);
    },
    wantedBySet() {
      const out = new Map<string, number>();
      // Jobs are kept oldest first, so a later job's count writes over an earlier one's.
      for (const job of jobs.values()) {
        for (const level of job.finished) out.set(level.setId, level.count);
      }
      return out;
    },
    start(request) {
      if (generate === null) return { ok: false, status: 503, error: GENERATION_OFF_ERROR };
      if (current !== null) return { ok: false, status: 409, error: GENERATION_BUSY_ERROR };
      const p = plan(request);
      if (!('kind' in p)) return p;
      const left = dailyLimit - usedToday();
      if (p.levels.length > left) {
        return {
          ok: false,
          status: 429,
          error:
            left === 0
              ? `Daily limit reached: ${dailyLimit} levels a day. Try again tomorrow (UTC).`
              : `Only ${left} more ${left === 1 ? 'level' : 'levels'} can be generated today (UTC).`,
        };
      }
      const job: GenerateJob = {
        id: newId(),
        kind: p.kind,
        setId: p.kind === 'regenerate' ? p.setId : null,
        category: p.category,
        levels: p.levels,
        state: 'queued',
        currentLevel: null,
        finished: [],
        short: [],
        usage: emptyUsage(),
        error: null,
        startedAt: clock(),
        finishedAt: null,
      };
      jobs.set(job.id, job);
      latest.set(categoryKey(p.category), job.id);
      while (jobs.size > JOBS_KEPT) jobs.delete(jobs.keys().next().value!);
      current = job;
      const guidance = request.kind === 'generate' ? request.guidance : '';
      // Started on the next tick, so the route answers with the job still queued.
      currentRun = Promise.resolve().then(() => run(job, p, guidance));
      return { ok: true, job: snapshot(job) };
    },
    idle: () => currentRun,
  };
}
