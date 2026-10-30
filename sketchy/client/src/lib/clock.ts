// The `?debug=1` ink delay overlay's arithmetic (spec "Test plan" → Ink delay measurement, F16).
// Every client estimates its clock offset to the server from `pong {t, serverNow}`, so the
// drawer's send time and the Screen's paint time can both be put in server time and subtracted.

import { RTT_SAMPLES } from '../../../shared/constants.js';
import type { InkBatch } from '../../../shared/types.js';

/** How many recent batches the Screen's p50 and p95 cover. */
export const INK_DELAY_WINDOW = 200;

/**
 * One offset sample, server time minus local time: `serverNow − (t + rtt/2)`, where `t` is the
 * local time the ping was sent and `receivedAt` the local time its pong came back. It assumes the
 * server stamped `serverNow` halfway through the round trip.
 */
export function offsetSample(t: number, serverNow: number, receivedAt: number): number {
  const rtt = receivedAt - t;
  return serverNow - (t + rtt / 2);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface ClockOffset {
  /** Adds the sample from one pong (all three in ms; `t` and `receivedAt` on the local clock). */
  add(t: number, serverNow: number, receivedAt: number): void;
  /** Server time minus local time: the median of the last RTT_SAMPLES samples. */
  offset(): number | undefined;
  /** A local time in server time, once there is an estimate. */
  toServer(local: number): number | undefined;
}

export function createClockOffset(): ClockOffset {
  let samples: number[] = [];
  const offset = () => (samples.length === 0 ? undefined : median(samples));
  return {
    add(t, serverNow, receivedAt) {
      const sample = offsetSample(t, serverNow, receivedAt);
      if (receivedAt < t || !Number.isFinite(sample)) return;
      samples = [...samples, sample].slice(-RTT_SAMPLES);
    },
    offset,
    toServer(local) {
      const o = offset();
      return o === undefined ? undefined : local + o;
    },
  };
}

/** The nearest-rank percentile `p` (0–100) of `values`, or undefined when there are none. */
export function percentile(values: readonly number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}

export interface DelayStats {
  count: number;
  p50: number | undefined;
  p95: number | undefined;
}

/** The last `size` "drawer send → Screen paint" delays, in ms. */
export interface DelayWindow {
  add(delayMs: number): void;
  stats(): DelayStats;
}

export function createDelayWindow(size = INK_DELAY_WINDOW): DelayWindow {
  let delays: number[] = [];
  return {
    add(delayMs) {
      if (Number.isFinite(delayMs)) delays = [...delays, delayMs].slice(-size);
    },
    stats: () => ({
      count: delays.length,
      p50: percentile(delays, 50),
      p95: percentile(delays, 95),
    }),
  };
}

/**
 * The drawer's batch as sent under `?debug=1`: a copy with `sentAt`, the local time `now` in
 * server time. Unchanged while there is no offset yet. Never changes the kept batch, so a resend
 * is stamped afresh.
 */
export function stampBatch(batch: InkBatch, clock: ClockOffset | null, now: number): InkBatch {
  const sentAt = clock?.toServer(now);
  if (sentAt === undefined || !(sentAt >= 0)) return batch;
  return [batch[0], batch[1], batch[2], Math.round(sentAt)];
}

/**
 * The Screen's half: called on the frame that painted a batch sent at `sentAt` (server time),
 * adds "drawer send → Screen paint" to `delays`. Nothing before this Screen has an offset.
 */
export function recordPaint(
  delays: DelayWindow,
  clock: ClockOffset,
  sentAt: number,
  paintedAtLocal: number,
): void {
  const paintedAt = clock.toServer(paintedAtLocal);
  if (paintedAt !== undefined) delays.add(paintedAt - sentAt);
}

/** True when the page's URL has `?debug=1`. */
export function isDebug(search: string = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}
