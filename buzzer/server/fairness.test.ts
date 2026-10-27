import { describe, expect, it } from 'vitest';
import { MAX_LATENCY_CORRECTION_MS, RTT_SAMPLES } from '../shared/constants.js';
import type { Buzz } from '../shared/types.js';
import { addRttSample, buzzGaps, makeBuzz, medianRtt, oneWayMs, rankBuzzes } from './fairness.js';
import { T0, makePlayer } from './test/rooms.js';

function samplesOf(values: number[]): number[] {
  return values.reduce<number[]>((samples, rtt) => addRttSample(samples, rtt), []);
}

describe('rolling median RTT', () => {
  it('is 0 before the first sample, so a new player gets no correction', () => {
    expect(medianRtt([])).toBe(0);
  });

  it('takes the middle sample of an odd count below the window', () => {
    expect(medianRtt(samplesOf([80, 20, 300]))).toBe(80);
  });

  it('averages the two middle samples of an even count', () => {
    expect(medianRtt(samplesOf([10, 40, 20, 30]))).toBe(25);
  });

  it(`keeps only the last ${RTT_SAMPLES} samples`, () => {
    // Ten slow samples, then ten fast ones: the slow ones must all have rolled out.
    const samples = samplesOf([...Array<number>(10).fill(500), ...Array<number>(10).fill(40)]);
    expect(samples).toHaveLength(RTT_SAMPLES);
    expect(medianRtt(samples)).toBe(40);
  });

  it('uses the newest samples once more than the window has arrived', () => {
    const samples = samplesOf([1000, 1000, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(samples).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(medianRtt(samples)).toBe(55);
  });

  it('ignores negative and non-finite samples', () => {
    const samples = samplesOf([50, -5, Number.NaN, Number.POSITIVE_INFINITY]);
    expect(samples).toEqual([50]);
  });

  it('does not mutate the samples it is given', () => {
    const samples = [10, 20];
    addRttSample(samples, 30);
    expect(samples).toEqual([10, 20]);
  });

  it('halves the RTT for the one-way latency', () => {
    expect(oneWayMs(90)).toBe(45);
  });
});

describe('makeBuzz', () => {
  it('subtracts the one-way latency from the receive time', () => {
    expect(makeBuzz('a', 1000, 100)).toEqual({
      playerId: 'a',
      receivedAt: 1000,
      oneWayMs: 50,
      adjustedAt: 950,
    });
  });

  it(`caps the correction at ${MAX_LATENCY_CORRECTION_MS} ms`, () => {
    const buzz = makeBuzz('a', 1000, 1000);
    expect(buzz.oneWayMs).toBe(500);
    expect(buzz.adjustedAt).toBe(1000 - MAX_LATENCY_CORRECTION_MS);
  });

  it('applies the full correction at exactly the cap and one millisecond under it', () => {
    expect(makeBuzz('a', 1000, MAX_LATENCY_CORRECTION_MS * 2).adjustedAt).toBe(850);
    expect(makeBuzz('a', 1000, MAX_LATENCY_CORRECTION_MS * 2 - 2).adjustedAt).toBe(851);
  });

  it('treats a negative or non-finite RTT as 0', () => {
    for (const rtt of [-40, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(makeBuzz('a', 1000, rtt)).toEqual({
        playerId: 'a',
        receivedAt: 1000,
        oneWayMs: 0,
        adjustedAt: 1000,
      });
    }
  });
});

describe('rankBuzzes', () => {
  const players = {
    first: makePlayer('first', { joinedAt: T0 + 1 }),
    second: makePlayer('second', { joinedAt: T0 + 2 }),
  };

  it('lets a slow player beat a fast one who arrived earlier, once corrected', () => {
    // Fast Wi-Fi: 20 ms RTT, arrives at 1000. Slow 4G: 200 ms RTT, arrives 60 ms later.
    // Corrected: fast 1000 − 10 = 990, slow 1060 − 100 = 960.
    const fast = makeBuzz('second', 1000, 20);
    const slow = makeBuzz('first', 1060, 200);
    expect(rankBuzzes([fast, slow], players).map((b) => b.playerId)).toEqual(['first', 'second']);
  });

  it('ranks the lowest adjustedAt first', () => {
    const buzzes: Buzz[] = [
      { playerId: 'first', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
      { playerId: 'second', receivedAt: 1100, oneWayMs: 150, adjustedAt: 950 },
    ];
    expect(rankBuzzes(buzzes, players).map((b) => b.playerId)).toEqual(['second', 'first']);
  });

  it('breaks an adjustedAt tie by the earliest receivedAt', () => {
    const buzzes: Buzz[] = [
      { playerId: 'first', receivedAt: 1040, oneWayMs: 40, adjustedAt: 1000 },
      { playerId: 'second', receivedAt: 1010, oneWayMs: 10, adjustedAt: 1000 },
    ];
    expect(rankBuzzes(buzzes, players).map((b) => b.playerId)).toEqual(['second', 'first']);
  });

  it('breaks a full tie by who joined first', () => {
    const buzzes: Buzz[] = [
      { playerId: 'second', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
      { playerId: 'first', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
    ];
    expect(rankBuzzes(buzzes, players).map((b) => b.playerId)).toEqual(['first', 'second']);
  });

  it('puts a buzz from a player no longer in the room after a full tie', () => {
    const buzzes: Buzz[] = [
      { playerId: 'gone', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
      { playerId: 'second', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
    ];
    expect(rankBuzzes(buzzes, players).map((b) => b.playerId)).toEqual(['second', 'gone']);
  });

  it('keeps two departed players in a full tie in arrival order, after everyone present', () => {
    const buzzes: Buzz[] = [
      { playerId: 'gone1', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
      { playerId: 'gone2', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
      { playerId: 'second', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
    ];
    expect(rankBuzzes(buzzes, players).map((b) => b.playerId)).toEqual([
      'second',
      'gone1',
      'gone2',
    ]);
  });

  it('does not reorder the input array', () => {
    const buzzes = [makeBuzz('second', 1000, 0), makeBuzz('first', 900, 0)];
    rankBuzzes(buzzes, players);
    expect(buzzes.map((b) => b.playerId)).toEqual(['second', 'first']);
  });
});

describe('buzzGaps', () => {
  it('lists every other buzz with its gap to the winner, in rank order', () => {
    const ranked: Buzz[] = [
      { playerId: 'w', receivedAt: 1000, oneWayMs: 50, adjustedAt: 950 },
      { playerId: 'b', receivedAt: 1000, oneWayMs: 0, adjustedAt: 1000 },
      { playerId: 'c', receivedAt: 1200, oneWayMs: 80, adjustedAt: 1120 },
    ];
    expect(buzzGaps(ranked)).toEqual([
      { playerId: 'b', gapMs: 50 },
      { playerId: 'c', gapMs: 170 },
    ]);
  });

  it('is empty with one buzz or none', () => {
    expect(buzzGaps([makeBuzz('w', 1000, 0)])).toEqual([]);
    expect(buzzGaps([])).toEqual([]);
  });
});
