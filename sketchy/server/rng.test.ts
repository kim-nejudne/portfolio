import { describe, expect, it } from 'vitest';
import { createRng, nextRandom } from './rng.js';

function draws(seed: number, n: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
}

describe('nextRandom', () => {
  it('returns a value in [0, 1) and the next state, without touching anything else', () => {
    const [value, state] = nextRandom(42);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    expect(state).not.toBe(42);
    expect(nextRandom(42)).toEqual([value, state]);
  });

  it('keeps the state a 32-bit unsigned integer', () => {
    let state = 0xffff_ffff;
    for (let i = 0; i < 1000; i++) {
      [, state] = nextRandom(state);
      expect(Number.isInteger(state)).toBe(true);
      expect(state).toBeGreaterThanOrEqual(0);
      expect(state).toBeLessThan(2 ** 32);
    }
  });

  it('matches mulberry32 (pinned values, so a change to the generator is noticed)', () => {
    expect(draws(1, 3)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });
});

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(draws(123, 100)).toEqual(draws(123, 100));
  });

  it('gives a different sequence for a different seed', () => {
    expect(draws(123, 10)).not.toEqual(draws(124, 10));
  });

  it('follows nextRandom step by step and exposes the state to store back in the room', () => {
    const rng = createRng(7);
    const [first, afterFirst] = nextRandom(7);
    expect(rng.next()).toBe(first);
    expect(rng.state).toBe(afterFirst);

    // Resuming from a stored state continues the same sequence.
    const resumed = createRng(rng.state);
    expect(resumed.next()).toBe(rng.next());
  });

  it('int(n) stays in 0..n-1 and reaches every value', () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it('int rejects a non-positive or fractional bound', () => {
    const rng = createRng(1);
    expect(() => rng.int(0)).toThrow();
    expect(() => rng.int(2.5)).toThrow();
  });

  it('shuffle returns a new permutation, the same one for the same seed', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = createRng(5).shuffle(items);
    const b = createRng(5).shuffle(items);
    expect(a).toEqual(b);
    expect(a).not.toBe(items);
    expect(items).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(a).not.toEqual(items);
  });

  it('shuffle handles empty and single-item lists', () => {
    expect(createRng(1).shuffle([])).toEqual([]);
    expect(createRng(1).shuffle(['x'])).toEqual(['x']);
  });
});
