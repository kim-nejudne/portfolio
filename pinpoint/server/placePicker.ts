// Place selection (spec: Place selection). Pure: randomness is the seeded `mulberry32` whose
// state the caller keeps in `room.rngState` and threads through.
import { planShortfall, placeShortfall } from '#shared/placeCheck.js';
import type {
  Category,
  CategoryLevelCounts,
  Difficulty,
  DifficultyChoice,
  Mode,
  Place,
  RoundCount,
} from '#shared/types.js';

const KIND = { name: 'city', picture: 'landmark' } as const;

/** One step of mulberry32: a value in [0, 1) and the next state. */
export function mulberry32(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/**
 * `game.pool` at New game: a deep copy of the category's live places of the mode's kind, for
 * every level the plan uses, so later admin edits never reach a running game.
 */
export function snapshotPool(
  category: Category,
  mode: Mode,
  plan: readonly Difficulty[],
): Partial<Record<Difficulty, Place[]>> {
  const pool: Partial<Record<Difficulty, Place[]>> = {};
  for (const level of new Set(plan)) {
    const live = category.live[level]?.places ?? [];
    pool[level] = structuredClone(live.filter((p) => p.kind === KIND[mode]));
  }
  return pool;
}

/**
 * The next place from one level's pool: never one in `usedPlaceIds`; places with no
 * `placeUsage` entry first, then the lowest game number; ties by the PRNG. Null when the level
 * is used up.
 */
export function pickPlace(
  pool: readonly Place[],
  usedPlaceIds: readonly string[],
  placeUsage: Readonly<Record<string, number>>,
  rngState: number,
): { place: Place; rngState: number } | null {
  const used = new Set(usedPlaceIds);
  const fresh = pool.filter((p) => !used.has(p.id));
  if (fresh.length === 0) return null;
  const age = (p: Place) => placeUsage[p.id] ?? -Infinity;
  const oldest = Math.min(...fresh.map(age));
  const ties = fresh.filter((p) => age(p) === oldest);
  const { value, state } = mulberry32(rngState);
  return { place: ties[Math.floor(value * ties.length)]!, rngState: state };
}

/**
 * Start and Rematch's enough-places check on the snapshot (after Picture mode's missing-photo
 * drop): null, or "Japan · Hard has 8 landmarks; this game needs 10." Earlier games' places
 * still count.
 */
export function poolShortfall(
  categoryName: string,
  pool: Partial<Record<Difficulty, Place[]>>,
  mode: Mode,
  difficulty: DifficultyChoice,
  rounds: RoundCount,
): string | null {
  return placeShortfall(
    { name: categoryName, counts: countsOf(pool, mode) },
    mode,
    difficulty,
    rounds,
  );
}

/**
 * Between-round settings' check: null, or the first level whose unused places can't fill the
 * unplayed rounds `rest` ("Japan · Medium has 3 cities left; the rest of the game needs 5.").
 */
export function restShortfall(
  categoryName: string,
  pool: Partial<Record<Difficulty, Place[]>>,
  usedPlaceIds: readonly string[],
  mode: Mode,
  rest: readonly Difficulty[],
): string | null {
  const unused = Object.fromEntries(
    Object.entries(pool).map(([level, places]) => [
      level,
      places.filter((p) => !usedPlaceIds.includes(p.id)),
    ]),
  );
  return planShortfall({ name: categoryName, counts: countsOf(unused, mode) }, mode, rest, true);
}

function countsOf(
  pool: Partial<Record<Difficulty, Place[]>>,
  mode: Mode,
): Partial<Record<Difficulty, CategoryLevelCounts>> {
  const counts: Partial<Record<Difficulty, CategoryLevelCounts>> = {};
  for (const [level, places] of Object.entries(pool) as [Difficulty, Place[]][]) {
    const n = places.length;
    counts[level] = {
      city: KIND[mode] === 'city' ? n : 0,
      landmark: KIND[mode] === 'landmark' ? n : 0,
    };
  }
  return counts;
}
