import {
  COLLECTION_WINDOW_MS,
  MAX_LATENCY_CORRECTION_MS,
  RTT_SAMPLES,
} from '../shared/constants.js';
import type { Buzz, BuzzGap, Player } from '../shared/types.js';

/**
 * Appends one RTT sample and keeps only the newest `RTT_SAMPLES`. Negative and non-finite
 * samples are dropped. Does not mutate `samples`.
 */
export function addRttSample(samples: readonly number[], rttMs: number): number[] {
  if (!Number.isFinite(rttMs) || rttMs < 0) return [...samples];
  return [...samples, rttMs].slice(-RTT_SAMPLES);
}

/** Median of the samples; the mean of the middle two for an even count. 0 with no samples (DECISIONS #16). */
export function medianRtt(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function oneWayMs(rttMs: number): number {
  return rttMs / 2;
}

/**
 * `receivedAt` is server monotonic ms. The correction is capped so faking a slow link gains
 * nothing. A negative or non-finite `rttMs` counts as 0, so it can never delay a buzz.
 */
export function makeBuzz(playerId: string, receivedAt: number, rttMs: number): Buzz {
  const oneWay = oneWayMs(Number.isFinite(rttMs) ? Math.max(0, rttMs) : 0);
  return {
    playerId,
    receivedAt,
    oneWayMs: oneWay,
    adjustedAt: receivedAt - Math.min(oneWay, MAX_LATENCY_CORRECTION_MS),
  };
}

/**
 * Winner first: lowest `adjustedAt`, then earliest `receivedAt`, then the player who joined
 * first. A buzz whose player has left sorts after the rest of its tie. Does not mutate `buzzes`.
 */
export function rankBuzzes(
  buzzes: readonly Buzz[],
  players: Readonly<Record<string, Player>>,
): Buzz[] {
  const joinedAt = (b: Buzz) => players[b.playerId]?.joinedAt ?? Number.POSITIVE_INFINITY;
  // Two departed players give Infinity − Infinity = NaN, which sort() treats as equal (stable).
  return [...buzzes].sort(
    (a, b) =>
      a.adjustedAt - b.adjustedAt || a.receivedAt - b.receivedAt || joinedAt(a) - joinedAt(b),
  );
}

/**
 * Whether `buzz` arrived inside the collection window that opened at `windowStartedAt` (monotonic
 * ms), inclusive. The cut uses the raw `receivedAt`, so latency correction cannot pull a late
 * arrival in. With no window start recorded, every buzz counts (DECISIONS F39).
 */
export function inWindow(buzz: Buzz, windowStartedAt: number | null): boolean {
  return windowStartedAt === null || buzz.receivedAt <= windowStartedAt + COLLECTION_WINDOW_MS;
}

/**
 * An opening's buzzes in rank order: those inside the window first, then the late ones. Only the
 * first can win, so a late buzz never outranks one that made the window (fairness rule 4).
 */
export function rankOpening(
  buzzes: readonly Buzz[],
  players: Readonly<Record<string, Player>>,
  windowStartedAt: number | null,
): Buzz[] {
  const late = (b: Buzz) => !inWindow(b, windowStartedAt);
  return [
    ...rankBuzzes(
      buzzes.filter((b) => !late(b)),
      players,
    ),
    ...rankBuzzes(buzzes.filter(late), players),
  ];
}

/** Each buzz after the winner, with its `adjustedAt` gap to the winner. Rank order (DECISIONS #13). */
export function buzzGaps(ranked: readonly Buzz[]): BuzzGap[] {
  const [winner, ...rest] = ranked;
  if (!winner) return [];
  return rest.map((b) => ({ playerId: b.playerId, gapMs: b.adjustedAt - winner.adjustedAt }));
}
