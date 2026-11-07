// The enough-places rule (spec: Place selection), shared by the VIP's lobby (greyed options, the
// Start reason) and the server's Start and Rematch checks.
import { DIFFICULTIES, MIN_PLACES_TO_OFFER } from './constants.js';
import { levelPlan } from './scoring.js';
import type { CategorySummary, Difficulty, DifficultyChoice, Mode, RoundCount } from './types.js';

type Counted = Pick<CategorySummary, 'name' | 'counts'>;

const KIND = { name: 'city', picture: 'landmark' } as const;
const NOUN = { city: ['city', 'cities'], landmark: ['landmark', 'landmarks'] } as const;
const LEVEL_NAME: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** Live places of one level in the mode (a missing level has none). */
export function levelCount(c: Counted, mode: Mode, level: Difficulty): number {
  return c.counts[level]?.[KIND[mode]] ?? 0;
}

/**
 * Null when the game fits, else the refusal for the first short level:
 * "Japan · Hard has 8 landmarks; this game needs 10."
 */
export function placeShortfall(
  c: Counted,
  mode: Mode,
  difficulty: DifficultyChoice,
  rounds: RoundCount,
): string | null {
  const plan = levelPlan(difficulty, rounds);
  for (const level of DIFFICULTIES) {
    const needs = plan.filter((l) => l === level).length;
    const has = levelCount(c, mode, level);
    if (needs > 0 && has < needs) {
      const noun = NOUN[KIND[mode]][has === 1 ? 0 : 1];
      return `${c.name} · ${LEVEL_NAME[level]} has ${has} ${noun}; this game needs ${needs}.`;
    }
  }
  return null;
}

/** The lobby offers a category in a mode when some level has `MIN_PLACES_TO_OFFER` places. */
export function categoryOffered(c: Counted, mode: Mode): boolean {
  return DIFFICULTIES.some((level) => levelCount(c, mode, level) >= MIN_PLACES_TO_OFFER);
}
