// Zip<[1, 2], ['a', 'b']> is [[1, 'a'], [2, 'b']]; it stops at the shorter tuple.
export type Zip<
  A extends readonly unknown[],
  B extends readonly unknown[],
> = unknown[][];

/** Pairs a and b by position, up to the length of the shorter one. */
export function zip(a: readonly unknown[], b: readonly unknown[]): unknown[][] {
  throw new Error(`not implemented: ${a.length} ${b.length}`);
}
