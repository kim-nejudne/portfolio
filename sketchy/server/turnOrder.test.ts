import { describe, expect, it } from 'vitest';
import { cycleOrder } from './turnOrder.js';

const players = [
  { pid: 'cy', joinedAt: 30 },
  { pid: 'ana', joinedAt: 10 },
  { pid: 'ben', joinedAt: 20 },
];

describe('cycleOrder', () => {
  it('is join order with no rotation', () => {
    expect(cycleOrder(players, null)).toEqual(['ana', 'ben', 'cy']);
  });

  it('begins after the given join time and wraps to the earliest joiner', () => {
    expect(cycleOrder(players, 10)).toEqual(['ben', 'cy', 'ana']);
    expect(cycleOrder(players, 20)).toEqual(['cy', 'ana', 'ben']);
    expect(cycleOrder(players, 30)).toEqual(['ana', 'ben', 'cy']);
  });

  it('works when the player who joined at that time has left', () => {
    expect(cycleOrder(players, 15)).toEqual(['ben', 'cy', 'ana']);
    expect(cycleOrder(players, 99)).toEqual(['ana', 'ben', 'cy']);
  });

  it('does not change its input', () => {
    const copy = structuredClone(players);
    cycleOrder(players, 10);
    expect(players).toEqual(copy);
  });

  it('is empty for no players', () => {
    expect(cycleOrder([], 5)).toEqual([]);
  });
});
