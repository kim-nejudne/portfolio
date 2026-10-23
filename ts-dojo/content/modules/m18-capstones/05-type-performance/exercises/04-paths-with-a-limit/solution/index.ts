// Arrays and functions are leaves: listed, but not walked into.
type Leaf = readonly unknown[] | ((...args: never[]) => unknown);

// Paths of at most Max keys. Depth counts the keys already in the path, one
// element per key, as the counters of lesson 12.4 do.
export type Paths<
  T,
  Max extends number = 4,
  Depth extends unknown[] = [],
> = Depth['length'] extends Max
  ? never
  : T extends Leaf
    ? never
    : T extends object
      ? KeyPaths<T, keyof T, Max, [...Depth, unknown]>
      : never;

type KeyPaths<
  T,
  K extends keyof T,
  Max extends number,
  Depth extends unknown[],
> = K extends string ? K | `${K}.${Paths<T[K], Max, Depth>}` : never;
