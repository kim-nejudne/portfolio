// SPEC-QUESTION: DECISIONS 50 (replace runner here, avoid lists, when limits count, statuses)
// Generation jobs (spec: Jobs and limits), ported from Buzzr's `jobs.ts`. A generate or regenerate
// runs levels through the pipeline and saves each finished level as an unreviewed draft; a replace
// or add writes one place and swaps it into (or appends it to) a level's draft. Jobs and the day's
// counts live in memory: a restart forgets them. One generation runs at a time, and only when no
// replacement is queued or running; replacements and additions wait in a FIFO queue, behind a
// running generation too. A queued job cancels at once; a running one stops before its next API
// call and saves nothing more. Levels and replacements count toward the UTC day's limits when they
// start, so a cancelled one still counts.

import { randomBytes } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DIFFICULTIES } from '#shared/constants.js';
import type {
  Category,
  Difficulty,
  GenerationHistoryEntry,
  GenerationJob,
  JobLevel,
  Place,
  PlaceKind,
} from '#shared/types.js';
import {
  CategoryStoreError,
  draftBoxAndStyle,
  slugify,
  wikidataIds,
  type CategoryStore,
} from '../categoryStore.js';
import { GenerationError, type Generator } from './generator.js';
import {
  generateLevel,
  saveLevel,
  type Drop,
  type LevelDeps,
  type LevelRequest,
  type LevelResult,
} from './pipeline.js';
import { WikimediaError, type WikimediaClient } from './wikimedia.js';

/** One level through the pipeline; tests pass a stub. */
export type LevelFn = (
  request: LevelRequest,
  hooks: Pick<LevelDeps, 'onStage' | 'onKept'>,
  signal: AbortSignal,
) => Promise<LevelResult>;

/** The pipeline on this generator, the shared Wikimedia client (made on first use) and photo folder. */
export function pipelineLevel(
  generator: Generator,
  wikimedia: () => WikimediaClient,
  photoDir: string,
): LevelFn {
  // async, so a Wikimedia client that cannot be made rejects like any other failure.
  return async (request, hooks, signal) =>
    generateLevel(request, { generator, wikimedia: wikimedia(), photoDir, ...hooks, signal });
}

// shortcut: one level deep, as photos are stored flat (`photos/*.webp`); recurse if M6 nests them.
/** Whether `DATA_DIR/photos` holds more than `maxMb` (spec: Jobs and limits, disk guard). */
export function photosOver(dir: string, maxMb: number): () => Promise<boolean> {
  return async () => {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return false; // no folder yet: nothing stored
    }
    let bytes = 0;
    for (const name of names)
      bytes += await stat(join(dir, name)).then(
        (s) => s.size,
        () => 0,
      );
    return bytes > maxMb * 1024 * 1024;
  };
}

export interface JobRunnerOptions {
  /** Null when generation is off; `off` says why. */
  level: LevelFn | null;
  off?: string;
  store: CategoryStore;
  clock: () => number;
  /** `GENERATE_DAILY_LIMIT`: levels that may start per UTC day. */
  dailyLimit: number;
  /** `GENERATE_REPLACE_DAILY_LIMIT`: replacements and additions that may start per UTC day. */
  replaceDailyLimit: number;
  /** The disk guard: true refuses every new job. */
  photosFull?: () => Promise<boolean>;
  /** Told once of each ended job (the history). A throw here is ignored. */
  onEnded?: (entry: GenerationHistoryEntry) => void;
  newId?: () => string;
}

export type JobRequest =
  | {
      kind: 'generate';
      name: string;
      /** More levels for an existing category ("Try the rest again"); `name` is then unused. */
      categoryId?: string;
      guidance: string;
      levels: Partial<Record<Difficulty, { count: number }>>;
    }
  | { kind: 'regenerate'; categoryId: string; level: Difficulty; count: number; guidance?: string }
  | { kind: 'replace'; categoryId: string; level: Difficulty; placeId: string; note?: string }
  | { kind: 'add'; categoryId: string; level: Difficulty; placeKind: PlaceKind; note?: string };

type Refusal = { ok: false; status: 404 | 409 | 429 | 503 | 507; error: string };
export type StartResult = { ok: true; job: GenerationJob } | Refusal;
export type CancelResult =
  { ok: true; job: GenerationJob } | { ok: false; status: 404 | 409; error: string };

export interface JobRunner {
  /** Why generation is off, or null. */
  readonly off: string | null;
  levelsLeft(): number;
  replacementsLeft(): number;
  get(id: string): GenerationJob | undefined;
  /** Running and queued jobs in order, then ended ones newest first; one category's when given. */
  list(categoryId?: string): GenerationJob[];
  start(request: JobRequest): Promise<StartResult>;
  cancel(id: string): CancelResult;
  /** Resolves once no job is queued or running. For tests and shutdown. */
  idle(): Promise<void>;
}

export const GENERATION_BUSY_ERROR = 'A generation is already running. Wait for it to finish.';
export const REPLACES_BUSY_ERROR =
  'Places are being replaced. Wait for them to finish, or cancel them.';
export const DISK_FULL_ERROR =
  'The photo folder is over PHOTOS_MAX_MB. Delete unused categories before generating more.';
export const NO_CATEGORY_ERROR = 'No such category';
export const NO_PLACE_ERROR = 'No such place';
export const NO_LEVEL_ERROR = 'That level has no places yet. Generate it first.';
export const NOTHING_KEPT_ERROR = 'No place passed the checks. Try again.';
const SAVE_FAILED_ERROR = 'Could not save the generated places. Try again.';
const FAILED_ERROR = 'Generation failed unexpectedly. Try again.';
const LEVEL_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
/** Jobs kept for `GET /jobs/:id`; the oldest ended ones are forgotten first. */
const JOBS_KEPT = 100;

class JobFailure extends Error {}
class JobCancelled extends Error {}

const ENDED: ReadonlySet<GenerationJob['state']> = new Set(['done', 'failed', 'cancelled']);

/** The guidance with a replacement's note after it, for the writer. */
export function withNote(guidance: string, note = ''): string {
  return [guidance.trim(), note.trim() ? `For this place: ${note.trim()}` : '']
    .filter(Boolean)
    .join('\n');
}

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Every place name in the category, live and draft, any level. */
function placeNames(c: Category): string[] {
  return [...Object.values(c.live), ...Object.values(c.draft)].flatMap((l) =>
    l.places.map((p) => p.name),
  );
}

/** The level a replacement or addition works on: its draft, else live. */
const levelPlaces = (c: Category, level: Difficulty) => (c.draft[level] ?? c.live[level])?.places;

interface Entry {
  job: GenerationJob;
  request: JobRequest;
  controller: AbortController;
  dropped: Drop[];
}

export function createJobRunner({
  level: runLevel,
  off = 'Generation is off.',
  store,
  clock,
  dailyLimit,
  replaceDailyLimit,
  photosFull = () => Promise.resolve(false),
  onEnded,
  newId = () => randomBytes(15).toString('base64url'),
}: JobRunnerOptions): JobRunner {
  const entries = new Map<string, Entry>();
  const queue: Entry[] = [];
  let current: Entry | null = null;
  let currentRun: Promise<void> = Promise.resolve();
  /** Each category's newest guidance, for its replacements and a regenerate without one. */
  const guidance = new Map<string, string>();
  let day = utcDay(clock());
  let levelsUsed = 0;
  let replacesUsed = 0;

  const rollDay = () => {
    const today = utcDay(clock());
    if (today !== day) {
      day = today;
      levelsUsed = 0;
      replacesUsed = 0;
    }
  };
  const levelsLeft = () => {
    rollDay();
    return Math.max(0, dailyLimit - levelsUsed);
  };
  // Queued ones are counted ahead, so the queue never holds more than the day allows.
  const replacementsLeft = () => {
    rollDay();
    return Math.max(0, replaceDailyLimit - replacesUsed - queue.length);
  };

  const isPlaceJob = (job: GenerationJob) => job.kind === 'replace' || job.kind === 'add';

  const snapshot = ({ job }: Entry): GenerationJob => {
    const at = queue.findIndex((e) => e.job.id === job.id);
    return { ...structuredClone(job), queuePosition: at === -1 ? null : at + 1 };
  };

  function historyEntry({ job, dropped }: Entry): GenerationHistoryEntry {
    const saved = { city: 0, landmark: 0 };
    for (const l of job.levels) {
      if (l.state !== 'saved') continue;
      saved.city += l.kept.city;
      saved.landmark += l.kept.landmark;
    }
    const byReason = new Map<string, number>();
    for (const { reason } of dropped) byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    return {
      startedAt: job.startedAt,
      endedAt: job.endedAt ?? clock(),
      kind: job.kind,
      // A new category whose first level never saved has no id: the one it would have had.
      categoryId: job.categoryId ?? slugify(job.category),
      category: job.category,
      levels: job.levels.map((l) => l.level),
      saved,
      dropped: [...byReason].map(([reason, count]) => ({ reason, count })),
      costUsd: job.costUsd,
      outcome: job.state as GenerationHistoryEntry['outcome'],
      ...(job.error === null ? {} : { error: job.error }),
    };
  }

  const ended = (entry: Entry): void => {
    try {
      onEnded?.(historyEntry(entry));
    } catch {
      // The history is best effort; the job has ended either way.
    }
  };

  /** One level through the pipeline, stopping on a cancel; spend and drops go on the job. */
  async function write(entry: Entry, lv: JobLevel, request: LevelRequest): Promise<LevelResult> {
    const { job, controller } = entry;
    let result: LevelResult;
    try {
      result = await runLevel!(
        request,
        {
          onStage: (stage) => void (lv.stage = stage),
          onKept: (kept) => void (lv.kept = kept),
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof GenerationError) job.costUsd += err.usage.costUsd;
      if (controller.signal.aborted) throw new JobCancelled();
      // Only the message: a GenerationError's `cause` may hold SDK text and place names.
      if (err instanceof GenerationError || err instanceof WikimediaError) {
        throw new JobFailure(err.message);
      }
      throw new JobFailure(FAILED_ERROR);
    }
    job.costUsd += result.usage.costUsd;
    entry.dropped.push(...result.dropped);
    // Cancelled during the last call: the admin asked for nothing more, so nothing is saved.
    if (controller.signal.aborted) throw new JobCancelled();
    return result;
  }

  async function saved<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (err) {
      throw new JobFailure(err instanceof CategoryStoreError ? err.message : SAVE_FAILED_ERROR);
    }
  }

  const existing = (id: string): Category => {
    const category = store.find(id);
    if (!category) throw new JobFailure('The category was deleted while it was generating.');
    return category;
  };

  async function runLevels(entry: Entry, text: string): Promise<void> {
    const { job, controller } = entry;
    for (const lv of job.levels) {
      if (controller.signal.aborted) throw new JobCancelled();
      const category = job.categoryId === null ? null : existing(job.categoryId);
      rollDay();
      levelsUsed++;
      lv.state = 'running';
      lv.stage = 'write';
      const result = await write(entry, lv, {
        category: job.category,
        guidance: text,
        level: lv.level,
        count: lv.count,
        meta: category && draftBoxAndStyle(category),
        // The category as saved now, which holds this job's earlier levels too.
        avoid: category ? placeNames(category) : [],
        existingIds: category ? wikidataIds(category) : new Set(),
      });
      if (result.places.length === 0) {
        throw new JobFailure(`No ${LEVEL_NAMES[lv.level]} place passed the checks. Try again.`);
      }
      const after = await saved(() =>
        saveLevel(store, category ? { id: category.id } : { name: job.category }, lv.level, result),
      );
      job.categoryId = after.id;
      if (text) guidance.set(after.id, text);
      lv.state = 'saved';
      lv.stage = null;
      lv.kept = {
        city: result.places.filter((p) => p.kind === 'city').length,
        landmark: result.places.filter((p) => p.kind === 'landmark').length,
      };
    }
  }

  async function runPlace(
    entry: Entry,
    request: Extract<JobRequest, { kind: 'replace' | 'add' }>,
  ): Promise<void> {
    const { job } = entry;
    const lv = job.levels[0]!;
    const kind = job.placeKind!;
    const category = existing(request.categoryId);
    const old =
      request.kind === 'replace'
        ? (levelPlaces(category, lv.level)?.find((p) => p.id === request.placeId) ?? null)
        : null;
    if (request.kind === 'replace' && !old) throw new JobFailure('The place was removed.');
    lv.state = 'running';
    lv.stage = 'write';
    const result = await write(entry, lv, {
      category: category.name,
      guidance: withNote(guidance.get(category.id) ?? '', request.note),
      level: lv.level,
      count: 1,
      only: kind,
      meta: draftBoxAndStyle(category),
      // The place being replaced too, so it never comes back.
      avoid: placeNames(category),
      existingIds: wikidataIds(category),
    });
    const written = result.places[0];
    if (!written) throw new JobFailure(NOTHING_KEPT_ERROR);
    // The store re-reads the level, so edits made meanwhile are kept, and sets the place's id.
    const after = await saved(() =>
      request.kind === 'replace'
        ? store.replacePlace(category.id, lv.level, request.placeId, written)
        : store.addPlace(category.id, lv.level, written),
    );
    const added = after.draft[lv.level]!.places.find((p) =>
      request.kind === 'replace' ? p.id === request.placeId : p.wikidataId === written.wikidataId,
    ) as Place;
    job.replaced = { old, new: added };
    lv.state = 'saved';
    lv.stage = null;
    lv.kept = { city: 0, landmark: 0, [kind]: 1 };
  }

  async function run(entry: Entry): Promise<void> {
    const { job, request } = entry;
    try {
      if (entry.controller.signal.aborted) throw new JobCancelled();
      job.state = 'running';
      if (request.kind === 'replace' || request.kind === 'add') await runPlace(entry, request);
      else if (request.kind === 'generate') await runLevels(entry, request.guidance);
      else {
        await runLevels(entry, request.guidance ?? guidance.get(request.categoryId) ?? '');
      }
      job.state = 'done';
    } catch (err) {
      if (err instanceof JobCancelled) job.state = 'cancelled';
      else {
        job.state = 'failed';
        job.error = err instanceof JobFailure ? err.message : FAILED_ERROR;
      }
      for (const lv of job.levels) {
        if (lv.state === 'running') lv.state = job.state === 'cancelled' ? 'cancelled' : 'failed';
      }
    } finally {
      for (const lv of job.levels) lv.stage = null;
      job.endedAt = clock();
      current = null;
      ended(entry);
      next();
    }
  }

  function begin(entry: Entry): void {
    current = entry;
    // Counted as it leaves the queue, so the cap holds and a cancel from now on still counts.
    if (isPlaceJob(entry.job)) {
      rollDay();
      replacesUsed++;
    }
    // On the next tick, so a route answers before the job's first step.
    currentRun = Promise.resolve().then(() => run(entry));
  }

  /** Starts the next queued replacement when nothing runs. */
  function next(): void {
    if (current !== null) return;
    const entry = queue.shift();
    if (entry) begin(entry);
  }

  function trim(): void {
    for (const [id, { job }] of entries) {
      if (entries.size <= JOBS_KEPT) return;
      if (ENDED.has(job.state)) entries.delete(id);
    }
  }

  /** The job for a request, or why it cannot start now. */
  function plan(request: JobRequest): GenerationJob | Refusal {
    const now = clock();
    const base = {
      id: newId(),
      kind: request.kind,
      guidance: ('guidance' in request && request.guidance) || '',
      state: 'queued' as const,
      placeKind: null,
      placeId: null,
      replaced: null,
      queuePosition: null,
      costUsd: 0,
      error: null,
      startedAt: now,
      endedAt: null,
    };
    const levelOf = (level: Difficulty, count: number): JobLevel => ({
      level,
      count,
      state: 'waiting',
      stage: null,
      kept: { city: 0, landmark: 0 },
    });

    if (request.kind === 'generate' || request.kind === 'regenerate') {
      if (current !== null && !isPlaceJob(current.job)) {
        return { ok: false, status: 409, error: GENERATION_BUSY_ERROR };
      }
      if (current !== null || queue.length > 0) {
        return { ok: false, status: 409, error: REPLACES_BUSY_ERROR };
      }
    }
    if (request.kind === 'generate') {
      const levels = DIFFICULTIES.filter((d) => request.levels[d]).map((d) =>
        levelOf(d, request.levels[d]!.count),
      );
      const left = levelsLeft();
      if (levels.length > left) return levelLimit(left);
      if (request.categoryId === undefined) {
        return { ...base, categoryId: null, category: request.name, levels };
      }
      const into = store.find(request.categoryId);
      if (!into) return { ok: false, status: 404, error: NO_CATEGORY_ERROR };
      return { ...base, categoryId: into.id, category: into.name, levels };
    }

    const category = store.find(request.categoryId);
    if (!category) return { ok: false, status: 404, error: NO_CATEGORY_ERROR };
    if (request.kind === 'regenerate') {
      const left = levelsLeft();
      if (left < 1) return levelLimit(left);
      return {
        ...base,
        categoryId: category.id,
        category: category.name,
        levels: [levelOf(request.level, request.count)],
      };
    }

    const places = levelPlaces(category, request.level);
    if (!places) return { ok: false, status: 404, error: NO_LEVEL_ERROR };
    const old = request.kind === 'replace' ? places.find((p) => p.id === request.placeId) : null;
    if (old === undefined) return { ok: false, status: 404, error: NO_PLACE_ERROR };
    if (replacementsLeft() < 1) {
      return {
        ok: false,
        status: 429,
        error: `Daily limit reached: ${replaceDailyLimit} replacements a day. Try again tomorrow (UTC).`,
      };
    }
    return {
      ...base,
      categoryId: category.id,
      category: category.name,
      levels: [levelOf(request.level, 1)],
      placeKind: old ? old.kind : (request as Extract<JobRequest, { kind: 'add' }>).placeKind,
      placeId: old ? old.id : null,
    };
  }

  function levelLimit(left: number): Refusal {
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
    get off() {
      return runLevel === null ? off : null;
    },
    levelsLeft,
    replacementsLeft,
    get: (id) => {
      const entry = entries.get(id);
      return entry ? snapshot(entry) : undefined;
    },
    list(categoryId) {
      const mine = (e: Entry | null): e is Entry =>
        e !== null && (categoryId === undefined || e.job.categoryId === categoryId);
      const waiting = [current, ...queue].filter(mine);
      const done = [...entries.values()].filter((e) => mine(e) && ENDED.has(e.job.state));
      return [...waiting, ...done.reverse()].map(snapshot);
    },
    async start(request) {
      if (runLevel === null) return { ok: false, status: 503, error: off };
      // Checked first: everything after is synchronous, so no other start slips in between.
      if (await photosFull()) return { ok: false, status: 507, error: DISK_FULL_ERROR };
      const job = plan(request);
      if ('ok' in job) return job;
      const entry: Entry = { job, request, controller: new AbortController(), dropped: [] };
      entries.set(job.id, entry);
      trim();
      if (isPlaceJob(job)) {
        queue.push(entry);
        next();
      } else {
        job.state = 'running';
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
        // Never started: it stops now, costs nothing and does not count.
        queue.splice(at, 1);
        job.state = 'cancelled';
        job.endedAt = clock();
        ended(entry);
      } else {
        entry.controller.abort();
      }
      return { ok: true, job: snapshot(entry) };
    },
    async idle() {
      while (current !== null || queue.length > 0) await currentRun;
    },
  };
}
