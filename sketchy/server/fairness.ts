// Latency correction (spec "Scoring and timing" → Latency correction). Ported from Buzzr
// (buzzer/server/fairness.ts): `addRttSample`, `medianRtt` and `oneWayMs` as they are; `makeBuzz`
// becomes `correctedAt`, and the buzz ranking and collection window stay behind. Pure: the
// gateway keeps each socket's samples, the reducer calls `correctedAt`.
import { MAX_LATENCY_CORRECTION_MS, RTT_SAMPLES } from '../shared/constants.js';

/**
 * Appends one RTT sample and keeps only the newest `RTT_SAMPLES`. Negative and non-finite
 * samples are dropped. Does not mutate `samples`.
 */
export function addRttSample(samples: readonly number[], rttMs: number): number[] {
  if (!Number.isFinite(rttMs) || rttMs < 0) return [...samples];
  return [...samples, rttMs].slice(-RTT_SAMPLES);
}

/** Median of the samples; the mean of the middle two for an even count. 0 with no samples. */
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
 * When the guess was sent, as best the server can tell: `receivedAt` (server monotonic ms) less
 * the player's one-way latency, capped at MAX_LATENCY_CORRECTION_MS so faking a slow link gains
 * nothing. A negative or non-finite latency counts as 0, so it can never delay a guess.
 */
export function correctedAt(receivedAt: number, oneWay: number): number {
  const latency = Number.isFinite(oneWay) ? Math.max(0, oneWay) : 0;
  return receivedAt - Math.min(latency, MAX_LATENCY_CORRECTION_MS);
}
