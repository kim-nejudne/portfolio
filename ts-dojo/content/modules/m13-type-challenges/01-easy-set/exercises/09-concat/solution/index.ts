// Spreading works for readonly tuples too, and the result is a new, mutable tuple.
export type Concat<
  T extends readonly unknown[],
  U extends readonly unknown[],
> = [...T, ...U];
