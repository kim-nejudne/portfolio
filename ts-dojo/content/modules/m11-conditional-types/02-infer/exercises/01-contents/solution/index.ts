// Contents<T>: what an array, a tuple, a promise, a set or a map holds, one layer deep.
// Any other type stays as it is.
// The readonly patterns match the mutable kinds too: string[] is assignable to readonly string[],
// and a Set to a ReadonlySet. A map's key type is not wanted, so `unknown` takes any key.
export type Contents<T> = T extends readonly (infer E)[]
  ? E
  : T extends Promise<infer V>
    ? V
    : T extends ReadonlySet<infer V>
      ? V
      : T extends ReadonlyMap<unknown, infer V>
        ? V
        : T;
