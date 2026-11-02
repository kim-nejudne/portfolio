// What the admin pages read off a generation job (F111, F115): its stage in words, whether it has
// ended, its cost, why a new one cannot start, and the stepped progress of `/admin/generate`.

import { DIFFICULTY_LABELS } from '../../../shared/constants.js';
import type {
  AdminCategoriesResponse,
  Difficulty,
  GenerateJob,
  GenerateJobState,
  GenerateLevelBody,
} from '../../../shared/types.js';

export const GENERATION_OFF_TEXT = 'Generation is not set up';
export const DAILY_LIMIT_TEXT = 'Daily limit reached';

export const STAGE_TEXT: Record<GenerateJobState, string> = {
  queued: 'Waiting to start',
  writing: 'Writing the questions',
  checking: 'Checking the facts',
  'topping up': 'Replacing dropped questions',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** Done, failed or cancelled: the job will not change again. */
export const ended = (job: GenerateJob): boolean =>
  job.state === 'done' || job.state === 'failed' || job.state === 'cancelled';

/** "$0.02", or "under $0.01". */
export function cost(usd: number): string {
  return usd > 0 && usd < 0.01 ? 'under $0.01' : `$${usd.toFixed(2)}`;
}

/** Why generation cannot start now (no key, the day's cap), or null. */
export function blockedBy(generation: AdminCategoriesResponse['generation']): string | null {
  if (!generation.enabled) {
    return `${GENERATION_OFF_TEXT}: the server has no BUZZR_ANTHROPIC_API_KEY.`;
  }
  if (generation.usedToday >= generation.dailyLimit) {
    return `${DAILY_LIMIT_TEXT}: ${generation.dailyLimit} levels a day. Try again tomorrow (UTC).`;
  }
  return null;
}

/** "Medium, level 2 of 3", or "Medium" for a one-level job; null when no level is running. */
export function levelText(job: GenerateJob): string | null {
  if (!job.currentLevel) return null;
  const label = DIFFICULTY_LABELS[job.currentLevel];
  if (job.levels.length < 2) return label;
  const at = job.levels.findIndex((l) => l.difficulty === job.currentLevel) + 1;
  return `${label}, level ${at} of ${job.levels.length}`;
}

/** The levels the job has not saved, in order: all of them for one that never got going. */
export function unsavedLevels(job: GenerateJob): GenerateLevelBody[] {
  return job.levels.filter((l) => !job.finished.some((f) => f.difficulty === l.difficulty));
}

/**
 * The stepped bar: each level is a write step then a check step ("topping up" belongs to the
 * check, since it replaces what the check dropped). `done` steps are complete, and `running` is
 * the step under way, or null when queued or ended.
 */
export function jobSteps(job: GenerateJob): {
  total: number;
  done: number;
  running: number | null;
} {
  const total = job.levels.length * 2;
  if (job.state === 'done') return { total, done: total, running: null };
  const saved = job.finished.length * 2;
  if (ended(job) || job.state === 'queued' || job.currentLevel === null) {
    return { total, done: saved, running: null };
  }
  const done = saved + (job.state === 'writing' ? 0 : 1);
  return { total, done, running: done };
}

export type LevelProgress =
  | { difficulty: Difficulty; status: 'done'; questions: number; count: number }
  | { difficulty: Difficulty; status: 'running' | 'waiting' | 'failed' | 'cancelled' | 'skipped' };

/**
 * The checklist, one entry per level: saved (with its count), running, waiting, or, once the job
 * failed or was cancelled, the level it stopped on and the ones it never reached.
 */
export function levelProgress(job: GenerateJob): LevelProgress[] {
  let stopShown = false;
  return job.levels.map(({ difficulty }) => {
    const saved = job.finished.find((f) => f.difficulty === difficulty);
    if (saved) {
      return { difficulty, status: 'done', questions: saved.questions, count: saved.count };
    }
    if (job.state === 'failed' || job.state === 'cancelled') {
      if (stopShown) return { difficulty, status: 'skipped' };
      stopShown = true;
      return { difficulty, status: job.state };
    }
    return { difficulty, status: job.currentLevel === difficulty ? 'running' : 'waiting' };
  });
}
