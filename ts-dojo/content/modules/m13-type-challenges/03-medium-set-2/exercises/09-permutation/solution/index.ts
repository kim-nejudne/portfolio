// All is a copy of the whole union, fixed before T distributes. No members left is the empty
// tuple, checked without distributing. Otherwise each member T goes first, followed by every
// permutation of the members that are left.
export type Permutation<T, All = T> = [T] extends [never]
  ? []
  : T extends unknown
    ? [T, ...Permutation<Exclude<All, T>>]
    : never;
