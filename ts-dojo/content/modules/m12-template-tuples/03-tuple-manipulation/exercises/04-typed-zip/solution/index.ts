// Zip<[1, 2], ['a', 'b']> is [[1, 'a'], [2, 'b']]; it stops at the shorter tuple.
export type Zip<
  A extends readonly unknown[],
  B extends readonly unknown[],
> = number extends A['length'] | B['length']
  ? [A[number], B[number]][] // an array on either side: the length isn't known
  : A extends readonly [infer HeadA, ...infer RestA]
    ? B extends readonly [infer HeadB, ...infer RestB]
      ? [[HeadA, HeadB], ...Zip<RestA, RestB>] // pair the heads, zip the rests
      : [] // B is used up
    : []; // A is used up

/** Pairs a and b by position, up to the length of the shorter one. */
export function zip<A extends unknown[], B extends unknown[]>(
  a: readonly [...A], // [...A] infers a tuple from a tuple argument
  b: readonly [...B],
): Zip<A, B> {
  const pairs: [unknown, unknown][] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    pairs.push([a[i], b[i]]);
  }
  // The compiler can't follow Zip through the loop; the tests check that the two agree.
  return pairs as Zip<A, B>;
}
