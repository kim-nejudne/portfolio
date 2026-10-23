// All is a copy of T, fixed before T distributes; never has no members and is no union. In the
// branch T is one member. If the whole of All fits in that one member, there was only one, and
// T is no union; the tuples keep that comparison from distributing over All.
export type IsUnion<T, All = T> = [T] extends [never]
  ? false
  : T extends unknown
    ? [All] extends [T]
      ? false
      : true
    : never;
