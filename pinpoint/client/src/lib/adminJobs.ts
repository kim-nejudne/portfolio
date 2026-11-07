// Generation jobs in the admin (spec: Generate page `/admin/generate`, Jobs and limits): starting,
// following and cancelling them, and the pure rules the progress view, banner and badges read.

import { DEFAULT_LEVEL_COUNT, LEVEL_COUNT_MAX, LEVEL_COUNT_MIN } from '#shared/constants.js';
import type {
  AdminCategoryResponse,
  AdminJobResponse,
  AdminJobsResponse,
  Category,
  CategoryLevelCounts,
  Difficulty,
  GenerationJob,
  JobLevel,
  PlaceKind,
} from '#shared/types.js';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import {
  LEVEL_LABELS,
  categoriesChanged,
  isGeneration,
  jobEnded,
  runningGeneration,
} from './adminCategories.js';

export { jobEnded, runningGeneration };
import { UNREACHABLE, adminSessionEnded, adminWrite, errorFrom } from './adminSession.js';

/** The progress view asks every second (spec); the banner and list every 2 s while one runs. */
export const JOB_POLL_MS = 1000;
export const JOBS_POLL_MS = 2000;

export type LevelCounts = Partial<Record<Difficulty, { count: number }>>;

/** Thrown when the server no longer knows the job (a restart forgets jobs). */
export class JobGoneError extends Error {}

async function get<T>(path: string, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/admin${path}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (response.status === 401) adminSessionEnded();
  if (response.status === 404)
    throw new JobGoneError((await errorFrom(response, fallback)).message);
  if (!response.ok) throw await errorFrom(response, fallback);
  return (await response.json()) as T;
}

/** All jobs, or one category's (the level page's poll). */
export const loadJobs = (categoryId?: string) =>
  get<AdminJobsResponse>(
    categoryId === undefined ? '/jobs' : `/jobs?categoryId=${encodeURIComponent(categoryId)}`,
    'Could not load the jobs',
  );

export async function loadJob(id: string): Promise<GenerationJob> {
  const path = `/jobs/${encodeURIComponent(id)}`;
  return (await get<AdminJobResponse>(path, 'Could not load the generation')).job;
}

async function send<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const response = await adminWrite('POST', path, body);
  if (response.status === 401) adminSessionEnded();
  if (!response.ok) throw await errorFrom(response, fallback);
  return (await response.json()) as T;
}

const started = async (answer: Promise<{ jobId: string }>) => (await answer).jobId;
const at = (id: string) => `/categories/${encodeURIComponent(id)}`;

/** A new category: `POST /api/admin/categories/generate` → the job id. */
export const startGenerate = (body: { name: string; guidance: string; levels: LevelCounts }) =>
  started(send('/categories/generate', body, 'Could not start the generation'));

/** More levels for an existing category ("Try the rest again" after a level saved). */
export const startGenerateMore = (id: string, body: { guidance: string; levels: LevelCounts }) =>
  started(send(`${at(id)}/generate`, body, 'Could not start the generation'));

/** Regenerate (or Generate a missing) level; no guidance uses the category's newest. */
export const startRegenerate = (id: string, level: Difficulty, count: number, guidance = '') =>
  started(
    send(
      `${at(id)}/levels/${level}/regenerate`,
      { count, ...(guidance ? { guidance } : {}) },
      'Could not start the generation',
    ),
  );

/** **Replace** a place: a one-place job in the replacement queue → its id. */
export const startReplace = (id: string, level: Difficulty, placeId: string, note: string) =>
  started(
    send(
      `${at(id)}/levels/${level}/places/${encodeURIComponent(placeId)}/replace`,
      note.trim() ? { note: note.trim() } : {},
      'Could not start the replacement',
    ),
  );

/** **Add a place** of a kind to a level → the job id. */
export const startAdd = (id: string, level: Difficulty, kind: PlaceKind, note: string) =>
  started(
    send(
      `${at(id)}/levels/${level}/places/add`,
      { kind, ...(note.trim() ? { note: note.trim() } : {}) },
      'Could not start adding a place',
    ),
  );

/** "Replaced · Undo": the old place back under its id → the category. */
export async function undoReplace(jobId: string): Promise<Category> {
  const path = `/jobs/${encodeURIComponent(jobId)}/undo`;
  return (await send<AdminCategoryResponse>(path, {}, 'Could not undo')).category;
}

export async function cancelJob(id: string): Promise<GenerationJob> {
  const path = `/jobs/${encodeURIComponent(id)}/cancel`;
  return (await send<AdminJobResponse>(path, {}, 'Could not cancel')).job;
}

// ---- Pure rules ----

/** Why Generate or Regenerate cannot start now, or null. */
export function generationBlocked(data: AdminJobsResponse | null): string | null {
  if (data === null) return null;
  if (data.off) return data.off;
  if (runningGeneration(data.jobs)) return 'Another generation is running. Wait for it to end.';
  if (data.levelsLeft < 1) return 'Daily limit reached. Try again tomorrow (UTC).';
  return null;
}

/** The steps of a level; Replace only once drops are being replaced (spec: Generate page). */
export const STEPS = ['write', 'locate', 'check', 'photos', 'replace'] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABELS: Record<Step, string> = {
  write: 'Write',
  locate: 'Locate',
  check: 'Check',
  photos: 'Photos',
  replace: 'Replace',
};
export const STAGE_TEXT: Record<Step, string> = {
  write: 'Writing the places',
  locate: 'Finding them on Wikidata',
  check: 'Checking the facts',
  photos: 'Fetching photos',
  replace: 'Replacing dropped places',
};

export type StepState = 'done' | 'running' | 'waiting';

/** Each step of a level's bar with its state: a saved level is all done. */
export function levelSteps(level: JobLevel): { step: Step; state: StepState }[] {
  const stage: string | null = level.stage;
  const steps = STEPS.filter((s) => s !== 'replace' || stage === 'replace');
  const running = level.state === 'running' ? steps.findIndex((s) => s === stage) : -1;
  return steps.map((step, i) => ({
    step,
    state:
      level.state === 'saved' || (running >= 0 && i < running)
        ? 'done'
        : i === running
          ? 'running'
          : 'waiting',
  }));
}

/** "Cities 8/15 · Landmarks 10/15": places kept so far per mode. */
export const keptText = (kept: CategoryLevelCounts, count: number) =>
  `Cities ${kept.city}/${count} · Landmarks ${kept.landmark}/${count}`;

/** The running level's stage in words, with "Medium, level 2 of 3" for a job of several. */
export function stageText(job: GenerationJob): { stage: string; level: string } | null {
  const i = job.levels.findIndex((l) => l.state === 'running');
  const level = job.levels[i];
  if (!level) return null;
  const stage = (STEPS as readonly string[]).includes(level.stage ?? '')
    ? STAGE_TEXT[level.stage as Step]
    : STAGE_TEXT.write;
  const name = LEVEL_LABELS[level.level];
  return {
    stage,
    level: job.levels.length < 2 ? name : `${name}, level ${i + 1} of ${job.levels.length}`,
  };
}

/** Why a failed or cancelled job stopped, naming the level it stopped on. */
export function stopText(job: GenerationJob): string {
  const stopped = job.levels.find((l) => l.state === 'failed' || l.state === 'cancelled');
  const name = stopped ? LEVEL_LABELS[stopped.level] : null;
  if (job.state === 'cancelled') return name ? `Cancelled at ${name}.` : 'Cancelled.';
  const why = job.error ?? 'Something went wrong.';
  return name ? `${name} failed: ${why}` : `Failed: ${why}`;
}

/** The levels the job has not saved, with their counts: what "Try the rest again" asks for. */
export function unsavedLevels(job: GenerationJob): LevelCounts {
  return Object.fromEntries(
    job.levels.filter((l) => l.state !== 'saved').map((l) => [l.level, { count: l.count }]),
  );
}

/** Where a finished job leads: a regenerate to the level's review, a generate to the category. */
export function doneRoute(job: GenerationJob): string {
  const category = `/admin/categories/${encodeURIComponent(job.categoryId ?? '')}`;
  return job.kind === 'regenerate' && job.levels[0]
    ? `${category}/${job.levels[0].level}`
    : category;
}

/** "$0.12", or "under $0.01". */
export const cost = (usd: number) => (usd > 0 && usd < 0.01 ? 'under $0.01' : `$${usd.toFixed(2)}`);

/** Places per mode for Regenerate: the level's larger mode now, within 5–30; 15 for a new level. */
export function regenerateCount(counts: CategoryLevelCounts | null): number {
  if (!counts) return DEFAULT_LEVEL_COUNT;
  return Math.min(LEVEL_COUNT_MAX, Math.max(LEVEL_COUNT_MIN, counts.city, counts.landmark));
}

/**
 * `GET /api/admin/jobs` for the admin frame: read on every page move and every 2 s while a
 * generation runs. When a job saves a level or ends, the category list is told to read again.
 */
export function useAdminJobs(): AdminJobsResponse | null {
  const { pathname } = useLocation();
  const [data, setData] = useState<AdminJobsResponse | null>(null);
  const seen = useRef<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    loadJobs().then(
      (next) => {
        if (!live) return;
        setData(next);
        const sign = next.jobs
          .filter(isGeneration)
          .map((j) => `${j.id}:${j.state}:${j.levels.map((l) => l.state).join()}`)
          .join(';');
        if (seen.current !== null && seen.current !== sign) categoriesChanged();
        seen.current = sign;
        if (runningGeneration(next.jobs))
          timer = setTimeout(() => setTick((n) => n + 1), JOBS_POLL_MS);
      },
      // The banner and badges are extras: a missed read leaves the last answer up.
      () => {},
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [pathname, tick]);

  return data;
}
