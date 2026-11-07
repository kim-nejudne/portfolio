import { describe, expect, it } from 'vitest';
import { bullseyeRadius, regionScale } from '#shared/geo.js';
import {
  basePoints,
  closestIds,
  competitionRanks,
  escalation,
  levelPlan,
  ordinal,
  points,
  rankText,
  replan,
  revealStepMs,
} from '#shared/scoring.js';
import type { Box, RoundResult } from '#shared/types.js';

// The worked table's boxes (spec: Worked table).
const regions: { name: string; box: Box; s: number; b: number }[] = [
  { name: 'World', box: { south: -58, west: -180, north: 78, east: 180 }, s: 20000, b: 200 },
  { name: 'Europe', box: { south: 34, west: -25, north: 72, east: 45 }, s: 4449, b: 44.5 },
  { name: 'Japan', box: { south: 30, west: 129, north: 45.5, east: 146 }, s: 1605, b: 16.1 },
  { name: 'Tuscany', box: { south: 42.2, west: 9.7, north: 44.5, east: 12.4 }, s: 236, b: 2.4 },
];
const row: [fraction: number, expected: number][] = [
  [0.025, 886],
  [0.05, 726],
  [0.1, 486],
  [0.25, 146],
  [0.5, 19],
];

describe('basePoints', () => {
  for (const { name, box, s, b } of regions) {
    it(`scores every cell of the worked table's ${name} row`, () => {
      const S = regionScale(box);
      expect(Math.round(S)).toBe(s);
      expect(Math.round(bullseyeRadius(S) * 10) / 10).toBe(b);
      expect(row.map(([f]) => basePoints(f * S, S))).toEqual(row.map(([, p]) => p));
    });
  }

  it('scores the same 100 km miss 1000, 905, 658 and 36 across the four regions', () => {
    expect(regions.map(({ box }) => basePoints(100, regionScale(box)))).toEqual([
      1000, 905, 658, 36,
    ]);
  });

  it('gives 1000 at exactly the bullseye radius and at most 999 just outside it', () => {
    const S = 4449;
    const b = bullseyeRadius(S);
    expect(basePoints(0, S)).toBe(1000);
    expect(basePoints(b, S)).toBe(1000);
    expect(basePoints(b + 1e-9, S)).toBeLessThanOrEqual(999);
    expect(basePoints(b + 0.01, S)).toBe(999);
  });
});

describe('points', () => {
  it('rounds half up after the multiplier', () => {
    expect(points(999, 1.5)).toBe(1499);
    expect(points(1000, 2)).toBe(2000);
    expect(points(19, 1.5)).toBe(29);
    expect(points(486, 1)).toBe(486);
  });
});

describe('escalation', () => {
  it('boosts the last rounds for 5, 10 and 15 rounds', () => {
    expect(escalation(5)).toEqual([1, 1, 1, 1.5, 2]);
    expect(escalation(10)).toEqual([1, 1, 1, 1, 1, 1, 1, 1.5, 1.5, 2]);
    expect(escalation(15)).toEqual([...Array<number>(12).fill(1), 1.5, 1.5, 2]);
  });

  it('keeps round 4 at ×1.5 when a 5-round game is extended to 10 after it', () => {
    const plan = replan(escalation(5), 4, escalation(10));
    expect(plan).toEqual([1, 1, 1, 1.5, 1, 1, 1, 1.5, 1.5, 2]);
  });
});

describe('levelPlan', () => {
  const runs = (plan: string[]) =>
    plan.reduce<string[]>((acc, l) => {
      const last = acc.at(-1);
      if (last?.startsWith(l)) acc[acc.length - 1] = `${l}×${Number(last.split('×')[1]) + 1}`;
      else acc.push(`${l}×1`);
      return acc;
    }, []);

  it('plays Mixed as Easy, Medium, Hard thirds for 5, 10 and 15 rounds', () => {
    expect(runs(levelPlan('mixed', 5))).toEqual(['easy×2', 'medium×1', 'hard×2']);
    expect(runs(levelPlan('mixed', 10))).toEqual(['easy×3', 'medium×4', 'hard×3']);
    expect(runs(levelPlan('mixed', 15))).toEqual(['easy×5', 'medium×5', 'hard×5']);
  });

  it('plays one fixed level in every round', () => {
    expect(levelPlan('hard', 5)).toEqual(['hard', 'hard', 'hard', 'hard', 'hard']);
  });

  it('recomputes only unplayed rounds after a round-count change', () => {
    // 10 → 5 after 3 played: rounds 1–3 keep Easy; 4 and 5 take Hard from the 5-round plan.
    expect(replan(levelPlan('mixed', 10), 3, levelPlan('mixed', 5))).toEqual([
      'easy',
      'easy',
      'easy',
      'hard',
      'hard',
    ]);
    // 5 → 15 after 4 played: rounds 1–4 keep easy, easy, medium, hard.
    expect(runs(replan(levelPlan('mixed', 5), 4, levelPlan('mixed', 15)))).toEqual([
      'easy×2',
      'medium×1',
      'hard×1',
      'easy×1',
      'medium×5',
      'hard×5',
    ]);
  });
});

describe('ranking', () => {
  it('uses standard competition ranks', () => {
    expect(competitionRanks([900, 700, 700, 300])).toEqual([1, 2, 2, 4]);
    expect(competitionRanks([700, 900, 300, 700])).toEqual([2, 1, 4, 2]);
    expect(competitionRanks([0, 0, 0])).toEqual([1, 1, 1]);
    expect(competitionRanks([])).toEqual([]);
  });

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
    ]);
  });

  it('shows "3rd of 8" and "=2nd of 8" for a shared rank', () => {
    expect(rankText(3, 8, false)).toBe('3rd of 8');
    expect(rankText(2, 8, true)).toBe('=2nd of 8');
  });
});

describe('reveal', () => {
  it('STEP is clamp(round(7500 / n), 600, 1800): n = 1, 8, 12 and 0', () => {
    expect(revealStepMs(1)).toBe(1800);
    expect(revealStepMs(8)).toBe(938);
    expect(revealStepMs(12)).toBe(625);
    expect(revealStepMs(0)).toBe(1800);
  });

  it('tags every player tied at the smallest distance Closest, never a missed one', () => {
    const row = (playerId: string, distanceKm: number | null) => ({ playerId, distanceKm });
    const rows = [row('a', 50), row('b', 12), row('c', null), row('d', 12)] as RoundResult[];
    expect(closestIds(rows)).toEqual(['b', 'd']);
    expect(closestIds([row('c', null)] as RoundResult[])).toEqual([]);
    expect(closestIds([])).toEqual([]);
  });
});
