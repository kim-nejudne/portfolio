// Ported from Buzzr (buzzer/server/fairness.test.ts): the RTT median tests as they are; the
// correction tests rewritten for `correctedAt` (Sketchy has no buzz ranking).
import { describe, expect, it } from 'vitest';
import { MAX_LATENCY_CORRECTION_MS, RTT_SAMPLES } from '../shared/constants.js';
import { addRttSample, correctedAt, medianRtt, oneWayMs } from './fairness.js';

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
    expect(oneWayMs(medianRtt(samplesOf([240, 200, 260])))).toBe(120);
  });
});

describe('correctedAt', () => {
  it('subtracts the one-way latency from the receive time', () => {
    expect(correctedAt(30_180, 120)).toBe(30_060);
    expect(correctedAt(30_100, 15)).toBe(30_085);
  });

  it(`caps the correction at ${MAX_LATENCY_CORRECTION_MS} ms`, () => {
    expect(correctedAt(10_000, 400)).toBe(10_000 - MAX_LATENCY_CORRECTION_MS);
    expect(correctedAt(10_000, 1e9)).toBe(10_000 - MAX_LATENCY_CORRECTION_MS);
  });

  it('applies the full correction at exactly the cap and one millisecond under it', () => {
    expect(correctedAt(10_000, MAX_LATENCY_CORRECTION_MS)).toBe(9_750);
    expect(correctedAt(10_000, MAX_LATENCY_CORRECTION_MS - 1)).toBe(9_751);
  });

  it('treats a negative or non-finite latency as 0, so it can never delay a guess', () => {
    for (const oneWay of [-40, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(correctedAt(10_000, oneWay)).toBe(10_000);
    }
  });
});
