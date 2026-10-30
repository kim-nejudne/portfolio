// The room's seeded PRNG (mulberry32). The state is one 32-bit integer kept in `Room.rngState`, so
// the reducer draws randomness without `Math.random` and every reducer test is deterministic.
// No Node imports: the reducer imports this module. Seeds come from `room.ts`.

/** One mulberry32 step: a value in [0, 1) and the state to store for the next draw. Pure. */
export function nextRandom(state: number): [value: number, state: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export interface SeededRng {
  /** A value in [0, 1). */
  next(): number;
  /** An integer in 0..n-1. */
  int(n: number): number;
  /** A shuffled copy (Fisher–Yates); the input is left as it is. */
  shuffle<T>(items: readonly T[]): T[];
  /** The state after the draws so far. Store it back in `Room.rngState`. */
  readonly state: number;
}

/**
 * A local generator starting at `state`. It mutates only itself, so a reducer can draw several
 * values and then store `rng.state` in the new room.
 */
export function createRng(state: number): SeededRng {
  let current = state >>> 0;
  const next = () => {
    const [value, after] = nextRandom(current);
    current = after;
    return value;
  };
  const int = (n: number) => {
    if (!Number.isInteger(n) || n < 1)
      throw new RangeError(`rng.int needs a positive integer, got ${n}`);
    return Math.floor(next() * n);
  };
  return {
    next,
    int,
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    get state() {
      return current;
    },
  };
}
