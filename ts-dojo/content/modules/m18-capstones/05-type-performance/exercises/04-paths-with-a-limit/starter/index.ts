// Arrays and functions are leaves: listed, but not walked into.
type Leaf = readonly unknown[] | ((...args: never[]) => unknown);

// The Paths of lesson 11.4. It never stops on a type that refers to itself,
// and it ignores Max. Make it stop after Max keys.
export type Paths<T, Max extends number = 4> = T extends Leaf
  ? never
  : T extends object
    ? KeyPaths<T, keyof T>
    : never;

type KeyPaths<T, K extends keyof T> = K extends string
  ? K | `${K}.${Paths<T[K]>}`
  : never;
