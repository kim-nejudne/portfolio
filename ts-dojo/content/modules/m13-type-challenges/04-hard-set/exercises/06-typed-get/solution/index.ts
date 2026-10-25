// The whole path as a key comes first, so 'foo.baz' finds its own property. Otherwise the
// first infer stops at the first dot: Head must be a key, and the rest of the path is looked
// up in that property's type. K is a naked type parameter, so a union of paths distributes.
export type Get<T, K> = K extends keyof T
  ? T[K]
  : K extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
      ? Get<T[Head], Rest>
      : never
    : never;
