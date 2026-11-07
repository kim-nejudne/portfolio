// The replacements and additions a level's review page follows (spec: Level review), ported from
// Buzzr's `levelJobs.ts`. The page follows a job from the moment it starts it, or sees it queued
// or running in a poll, until it ends. Only an end seen during this visit swaps a place in: jobs
// that ended before the page opened are already in the draft.

import type { GenerationJob, Place, PlaceKind } from '#shared/types.js';

export const isActive = (job: GenerationJob) => job.state === 'queued' || job.state === 'running';

export interface Followed {
  /** The place being replaced; null for an addition. */
  placeId: string | null;
  /** An addition's kind (its tab); a replacement's comes from its card. */
  placeKind: PlaceKind | null;
  /** null between the start's answer and the first poll that lists the job. */
  job: GenerationJob | null;
  /** A finished replacement put back with Undo. */
  undone: boolean;
}

/** By job id, in the order they were started or first seen. */
export type FollowedJobs = ReadonlyMap<string, Followed>;
export const NONE_FOLLOWED: FollowedJobs = new Map();

export const followedActive = (entry: Followed) => entry.job === null || isActive(entry.job);

/** A job the page has just started, before any poll lists it. */
export function started(
  followed: FollowedJobs,
  jobId: string,
  placeId: string | null,
  placeKind: PlaceKind | null = null,
): FollowedJobs {
  if (followed.has(jobId)) return followed;
  return new Map(followed).set(jobId, { placeId, placeKind, job: null, undone: false });
}

/**
 * The followed jobs after a poll (or a cancel's answer), and whether any ended with it. A job
 * already ended stays as it was, so a late answer can never bring it back. A job that ended
 * without the page ever seeing it is not followed.
 */
export function follow(
  followed: FollowedJobs,
  polled: readonly GenerationJob[],
): { followed: FollowedJobs; ended: GenerationJob[] } {
  const next = new Map(followed);
  const ended: GenerationJob[] = [];
  let changed = false;
  for (const job of polled) {
    if (job.kind !== 'replace' && job.kind !== 'add') continue;
    const entry = next.get(job.id);
    if (!entry) {
      if (!isActive(job)) continue;
      next.set(job.id, { placeId: job.placeId, placeKind: job.placeKind, job, undone: false });
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
  return { followed: changed ? next : followed, ended };
}

/** What a place's card shows of its latest replacement, if anything. */
export type CardJob =
  | { kind: 'queued'; jobId: string; position: number | null }
  | { kind: 'running'; jobId: string }
  | { kind: 'replaced'; jobId: string; old: Place }
  | { kind: 'failed'; jobId: string; error: string }
  | { kind: 'added' };

function shown(jobId: string, entry: Followed): CardJob | null {
  const { job } = entry;
  if (job === null) return { kind: 'queued', jobId, position: null };
  if (job.state === 'queued') return { kind: 'queued', jobId, position: job.queuePosition };
  if (job.state === 'running') return { kind: 'running', jobId };
  if (job.state === 'failed') return { kind: 'failed', jobId, error: job.error ?? 'It failed.' };
  if (job.state === 'done' && job.replaced?.old && !entry.undone) {
    return { kind: 'replaced', jobId, old: job.replaced.old };
  }
  return null;
}

/** The card's state: its latest replacement, or "added" for a place an addition brought. */
export function cardJob(followed: FollowedJobs, placeId: string): CardJob | null {
  let latest: CardJob | null = null;
  let found = false;
  for (const [jobId, entry] of followed) {
    if (entry.placeId === placeId) {
      latest = shown(jobId, entry);
      found = true;
    } else if (
      !found &&
      entry.placeId === null &&
      entry.job?.state === 'done' &&
      entry.job.replaced?.new.id === placeId
    ) {
      latest = { kind: 'added' };
    }
  }
  return latest;
}

/** The additions of one kind to show under its tab's list: queued, running or failed. */
export function addJobs(followed: FollowedJobs, kind: PlaceKind): CardJob[] {
  const out: CardJob[] = [];
  for (const [jobId, entry] of followed) {
    if (entry.placeId !== null || (entry.placeKind ?? entry.job?.placeKind) !== kind) continue;
    const card = shown(jobId, entry);
    if (card) out.push(card);
  }
  return out;
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** The footer's "2 replacing · 1 adding", each part only when not zero; "" when nothing is. */
export function progressLine(followed: FollowedJobs): string {
  let replacing = 0;
  let adding = 0;
  for (const entry of followed.values()) {
    if (!followedActive(entry)) continue;
    if (entry.placeId === null) adding++;
    else replacing++;
  }
  const parts: string[] = [];
  if (replacing > 0) parts.push(`${replacing} replacing`);
  if (adding > 0) parts.push(`${adding} adding`);
  return parts.join(' · ');
}
