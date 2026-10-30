import { describe, expect, it } from 'vitest';
import { RTT_SAMPLES } from '../../../shared/constants.js';
import {
  createClockOffset,
  createDelayWindow,
  isDebug,
  offsetSample,
  percentile,
  recordPaint,
  stampBatch,
} from './clock.js';
import type { InkBatch } from '../../../shared/types.js';

describe('offsetSample', () => {
  it('is serverNow − (t + rtt/2), with rtt from the ping to the pong', () => {
    // Sent at local 1000, answered at local 1100 (rtt 100): the server stamped 5_000_050 halfway.
    expect(offsetSample(1000, 5_000_050, 1100)).toBe(5_000_050 - 1050);
  });

  it('gives the true offset whatever the RTT, when the trip is symmetric', () => {
    const trueOffset = 1_800_000_000_000 - 20_000;
    for (const rtt of [0, 40, 300]) {
      const t = 20_000;
      const serverNow = t + rtt / 2 + trueOffset;
      expect(offsetSample(t, serverNow, t + rtt)).toBe(trueOffset);
    }
  });
});

describe('createClockOffset', () => {
  it('has no estimate before the first pong', () => {
    expect(createClockOffset().offset()).toBeUndefined();
  });

  it('is the median of the samples, so one slow, lopsided trip does not move it', () => {
    const clock = createClockOffset();
    clock.add(0, 1_000, 100); // offset 950
    clock.add(0, 1_010, 100); // 960
    clock.add(0, 2_000, 100); // 1950: a pong held up on the way back
    expect(clock.offset()).toBe(960);
    clock.add(0, 1_020, 100); // 970: even count → mean of the middle two
    expect(clock.offset()).toBe(965);
  });

  it(`keeps only the last ${RTT_SAMPLES} samples`, () => {
    const clock = createClockOffset();
    for (let i = 0; i < RTT_SAMPLES; i++) clock.add(0, 10_000, 0);
    for (let i = 0; i < RTT_SAMPLES; i++) clock.add(0, 20_000, 0);
    expect(clock.offset()).toBe(20_000);
  });

  it('ignores a pong that arrives before its ping was sent or carries a bad time', () => {
    const clock = createClockOffset();
    clock.add(100, 5_000, 50);
    clock.add(0, Number.NaN, 10);
    expect(clock.offset()).toBeUndefined();
  });

  it('converts a local time to server time', () => {
    const clock = createClockOffset();
    expect(clock.toServer(500)).toBeUndefined();
    clock.add(0, 1_000, 0);
    expect(clock.toServer(500)).toBe(1_500);
  });
});

describe('percentile', () => {
  it('is the nearest-rank percentile, and undefined with no values', () => {
    const values = [50, 10, 40, 20, 30];
    expect(percentile(values, 50)).toBe(30);
    expect(percentile(values, 95)).toBe(50);
    expect(percentile(values, 0)).toBe(10);
    expect(percentile([], 50)).toBeUndefined();
  });

  it('p95 of 1…100 is 95', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 50)).toBe(50);
  });
});

describe('createDelayWindow', () => {
  it('reports p50 and p95 over the last 200 delays only', () => {
    const w = createDelayWindow();
    expect(w.stats()).toEqual({ count: 0, p50: undefined, p95: undefined });
    for (let i = 0; i < 50; i++) w.add(1_000);
    for (let i = 1; i <= 200; i++) w.add(i);
    expect(w.stats()).toEqual({ count: 200, p50: 100, p95: 190 });
  });

  it('drops non-finite delays', () => {
    const w = createDelayWindow(3);
    w.add(Number.NaN);
    w.add(Infinity);
    w.add(80);
    expect(w.stats()).toEqual({ count: 1, p50: 80, p95: 80 });
  });
});

describe('isDebug', () => {
  it('is on only for debug=1', () => {
    expect(isDebug('?debug=1')).toBe(true);
    expect(isDebug('?x=2&debug=1')).toBe(true);
    expect(isDebug('')).toBe(false);
    expect(isDebug('?debug=0')).toBe(false);
    expect(isDebug('?debug')).toBe(false);
  });
});

describe('stampBatch', () => {
  const batch: InkBatch = [3, 7, [['u']]];

  it('adds the send time in server time, as a copy that leaves the kept batch alone', () => {
    const clock = createClockOffset();
    clock.add(0, 1_800_000_000_000, 0);
    expect(stampBatch(batch, clock, 40.4)).toEqual([3, 7, [['u']], 1_800_000_000_040]);
    expect(batch).toEqual([3, 7, [['u']]]);
    // A resend later is stamped afresh.
    expect(stampBatch(batch, clock, 900)).toEqual([3, 7, [['u']], 1_800_000_000_900]);
  });

  it('sends the batch as it is without ?debug=1 or before the first pong', () => {
    expect(stampBatch(batch, null, 40)).toBe(batch);
    expect(stampBatch(batch, createClockOffset(), 40)).toBe(batch);
  });
});

describe('recordPaint', () => {
  it('adds paint time minus send time, both in server time', () => {
    const clock = createClockOffset();
    clock.add(0, 1_000_000, 0); // server = local + 1_000_000
    const delays = createDelayWindow();
    recordPaint(delays, clock, 1_000_500, 620); // painted at server 1_000_620
    expect(delays.stats()).toEqual({ count: 1, p50: 120, p95: 120 });
  });

  it('records nothing before this Screen has an offset', () => {
    const delays = createDelayWindow();
    recordPaint(delays, createClockOffset(), 1_000_500, 620);
    expect(delays.stats().count).toBe(0);
  });
});
