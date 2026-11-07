// Scoring, escalation, the Mixed level plan and ranks (spec: Points formula, Escalation,
// Mixed difficulty, Ranking and ties).
import { bullseyeRadius } from './geo.js';
import type { Difficulty, DifficultyChoice, Multiplier, RoundCount } from './types.js';

export const FALLOFF = 8;
export const MAX_BASE_POINTS = 1000;

/** `d` and `S` in km. 1000 only for a bullseye (`d ≤ b`); `floor` keeps every miss ≤ 999. */
export function basePoints(d: number, S: number): number {
  const b = bullseyeRadius(S);
  if (d <= b) return MAX_BASE_POINTS;
  return Math.floor(MAX_BASE_POINTS * Math.exp((-FALLOFF * (d - b)) / S));
}

/** `Math.round` after the multiplier: 999 × 1.5 → 1499. */
export function points(base: number, multiplier: Multiplier): number {
  return Math.round(base * multiplier);
}

/** Multipliers by round number − 1: the last round ×2, the one or two before it ×1.5. */
export function escalation(rounds: RoundCount): Multiplier[] {
  const boosted = rounds === 5 ? 1 : 2;
  return Array.from({ length: rounds }, (_, i) =>
    i === rounds - 1 ? 2 : i >= rounds - 1 - boosted ? 1.5 : 1,
  );
}

/** Levels by round number − 1. Mixed: `easy = hard = round(N / 3)`, medium the rest. */
export function levelPlan(choice: DifficultyChoice, rounds: RoundCount): Difficulty[] {
  if (choice !== 'mixed') return Array<Difficulty>(rounds).fill(choice);
  const third = Math.round(rounds / 3);
  return Array.from({ length: rounds }, (_, i) =>
    i < third ? 'easy' : i < rounds - third ? 'medium' : 'hard',
  );
}

/**
 * After a round-count change: the first `played` rounds keep their old entry, the rest come
 * from `fresh` (the plan for the new total). Works for levels and multipliers alike.
 */
export function replan<T>(old: readonly T[], played: number, fresh: readonly T[]): T[] {
  return [...old.slice(0, played), ...fresh.slice(played)];
}

/** Standard competition ranks, same order as `totals`: 900, 700, 700, 300 → 1, 2, 2, 4. */
export function competitionRanks(totals: readonly number[]): number[] {
  // shortcut: O(n²), fine for a room's player cap.
  return totals.map((t) => 1 + totals.filter((o) => o > t).length);
}

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** "3rd of 8", or "=2nd of 8" when the rank is shared. */
export function rankText(rank: number, of: number, shared: boolean): string {
  return `${shared ? '=' : ''}${ordinal(rank)} of ${of}`;
}
