// The replacements and additions a level's review list follows (F118). The list follows a job from
// the moment it is started on the page, or seen queued or running in a poll, until it ends. Only an
// end seen during this visit swaps a question in; jobs that ended before the page opened are
// already in the draft.

import type { GenerateJob, GenerateJobState, Question } from '../../../shared/types.js';

const ACTIVE: ReadonlySet<GenerateJobState> = new Set([
  'queued',
  'writing',
  'checking',
  'topping up',
]);

export const isActive = (job: GenerateJob) => ACTIVE.has(job.state);

export interface Followed {
  /** The question being replaced; null for an addition. */
  questionId: string | null;
  /** null between the start's answer and the first poll that lists the job. */
  job: GenerateJob | null;
  /** A finished replacement put back with Undo. */
  undone: boolean;
}

/** By job id, in the order they were started or first seen. */
export type FollowedJobs = ReadonlyMap<string, Followed>;

export const followedActive = (entry: Followed) => entry.job === null || isActive(entry.job);

/** A job the page has just started, before any poll lists it. */
export function started(
  followed: FollowedJobs,
  jobId: string,
  questionId: string | null,
): FollowedJobs {
  if (followed.has(jobId)) return followed;
  return new Map(followed).set(jobId, { questionId, job: null, undone: false });
}

/**
 * The followed jobs after a poll (or a cancel's answer), and the jobs that ended with it. A job
 * already ended stays as it was, so a late answer can never bring it back or swap it in twice.
 * A job that ended without the page ever seeing it running is not followed.
 */
export function follow(
  followed: FollowedJobs,
  polled: readonly GenerateJob[],
): { followed: FollowedJobs; ended: GenerateJob[]; changed: boolean } {
  const next = new Map(followed);
  const ended: GenerateJob[] = [];
  let changed = false;
  for (const job of polled) {
    const entry = next.get(job.id);
    if (!entry) {
      if (!isActive(job)) continue;
      next.set(job.id, { questionId: job.questionId, job, undone: false });
      changed = true;
      continue;
    }
    if (!followedActive(entry)) continue;
    if (entry.job?.state !== job.state || entry.job.queuePosition !== job.queuePosition) {
      changed = true;
    }
    next.set(job.id, { ...entry, job });
    if (!isActive(job)) ended.push(job);
  }
  return { followed: changed ? next : followed, ended, changed };
}

/** The draft's questions with a finished job's question swapped in, or appended for an addition. */
export function withArrived(questions: readonly Question[], job: GenerateJob): Question[] {
  const arrived = job.replaced?.new;
  if (job.state !== 'done' || !arrived) return [...questions];
  if (job.questionId === null) {
    return questions.some((q) => q.id === arrived.id) ? [...questions] : [...questions, arrived];
  }
  return questions.map((q) => (q.id === job.questionId ? arrived : q));
}

/** What a question's card shows of its latest replacement, if anything. */
export type CardJob =
  | { kind: 'queued'; jobId: string; position: number | null }
  | { kind: 'running'; jobId: string }
  | { kind: 'replaced'; jobId: string; old: Question }
  | { kind: 'failed'; jobId: string; error: string }
  | { kind: 'added' };

function shown(jobId: string, entry: Followed): CardJob | null {
  const { job } = entry;
  if (job === null) return { kind: 'queued', jobId, position: null };
  if (job.state === 'queued') return { kind: 'queued', jobId, position: job.queuePosition };
  if (isActive(job)) return { kind: 'running', jobId };
  if (job.state === 'failed') return { kind: 'failed', jobId, error: job.error ?? 'It failed.' };
  if (job.state === 'done' && job.replaced?.old && !entry.undone) {
    return { kind: 'replaced', jobId, old: job.replaced.old };
  }
  return null;
}

/** The card's state: its latest replacement, or "added" for a question an addition brought. */
export function cardJob(followed: FollowedJobs, questionId: string): CardJob | null {
  let latest: CardJob | null = null;
  let found = false;
  for (const [jobId, entry] of followed) {
    if (entry.questionId === questionId) {
      latest = shown(jobId, entry);
      found = true;
    } else if (
      !found &&
      entry.questionId === null &&
      entry.job?.state === 'done' &&
      entry.job.replaced?.new.id === questionId
    ) {
      latest = { kind: 'added' };
    }
  }
  return latest;
}

/** The additions to show under the list: running, queued or failed. */
export function addJobs(followed: FollowedJobs): CardJob[] {
  const out: CardJob[] = [];
  for (const [jobId, entry] of followed) {
    if (entry.questionId !== null) continue;
    const card = shown(jobId, entry);
    if (card) out.push(card);
  }
  return out;
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** The followed jobs still waiting in the queue (or just started), which the day's cap counts. */
export function queuedCount(followed: FollowedJobs): number {
  let n = 0;
  for (const entry of followed.values()) {
    if (entry.job === null || entry.job.state === 'queued') n++;
  }
  return n;
}
