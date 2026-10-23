/** Pairs up the items of two lists by index, up to the end of the shorter one. */
export function zip<A, B>(left: readonly A[], right: readonly B[]): [A, B][] {
  const length = Math.min(left.length, right.length);
  const pairs: [A, B][] = [];
  for (let i = 0; i < length; i++) {
    pairs.push([left[i], right[i]]);
  }
  return pairs;
}
