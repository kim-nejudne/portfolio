// Letter hints (spec: Scoring and timing, Timing and hints). Pure: the reducer passes the room's
// seeded RNG. Positions are NFC code-point indexes, the same ones `maskWord` blanks.

import { HINT_AT, HINT_MAX_FRACTION, HINT_MIN_LETTERS } from '../shared/constants.js';
import type { SeededRng } from './rng.js';

const LETTER = /[\p{L}\p{N}]/u;

/** Positions of the letters and digits in `word`: what the mask shows as `_`. */
export function letterIndexes(word: string): number[] {
  const indexes: number[] = [];
  [...word.normalize('NFC')].forEach((ch, i) => {
    if (LETTER.test(ch)) indexes.push(i);
  });
  return indexes;
}

/** The most letters hints may reveal: ⅓ of the letters, rounded down, and none under 4 letters. */
export function hintCap(word: string): number {
  const letters = letterIndexes(word).length;
  if (letters < HINT_MIN_LETTERS) return 0;
  return Math.floor(letters * HINT_MAX_FRACTION);
}

/** How many hint timers a turn gets: one per `HINT_AT` mark, but never more than the cap. */
export function hintCount(word: string): number {
  return Math.min(HINT_AT.length, hintCap(word));
}

/** One random letter not revealed yet, or null when the cap is reached or none is left. */
export function pickHint(word: string, revealed: readonly number[], rng: SeededRng): number | null {
  if (revealed.length >= hintCap(word)) return null;
  const hidden = letterIndexes(word).filter((i) => !revealed.includes(i));
  if (hidden.length === 0) return null;
  return hidden[rng.int(hidden.length)]!;
}
