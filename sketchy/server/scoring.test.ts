import { describe, expect, it } from 'vitest';
import { drawerPoints, guesserPoints } from './scoring.js';

const T = 60_000;

describe('guesserPoints', () => {
  it('gives 300 for a guess at the very start of the turn', () => {
    expect(guesserPoints(T, 0)).toBe(300);
  });

  it('gives 100 for a guess at the buzzer', () => {
    expect(guesserPoints(T, T)).toBe(100);
  });

  it('falls evenly between them, rounded to the nearest 5', () => {
    expect(guesserPoints(T, 30_000)).toBe(200); // 100 + 200 × 0.5
    expect(guesserPoints(T, 9_000)).toBe(270); // 100 + 200 × 0.85
    expect(guesserPoints(T, 1_000)).toBe(295); // 296.67 → 295
    expect(guesserPoints(45_000, 20_000)).toBe(210); // 211.11 → 210
  });

  it('stays within 100 to 300 for times outside the turn', () => {
    expect(guesserPoints(T, -500)).toBe(300);
    expect(guesserPoints(T, T + 250)).toBe(100);
  });
});

describe('drawerPoints', () => {
  it('is half the guessers’ total, rounded to the nearest 5', () => {
    expect(drawerPoints([270, 200])).toBe(235);
    expect(drawerPoints([295])).toBe(150); // 147.5 → 29.5 × 5 → Math.round(29.5) = 30
    expect(drawerPoints([210, 105])).toBe(160); // 157.5 → 31.5 → 32 × 5
  });

  it('is 0 when nobody guessed', () => {
    expect(drawerPoints([])).toBe(0);
  });
});
