// Arrays and functions are leaves: listed, but not walked into.
type Leaf = readonly unknown[] | ((...args: never[]) => unknown);

// Paths<T>: every dotted path to a property of T, at any depth.
// T is naked, so a union of objects, or an object | null, is walked one member at a time.
export type Paths<T> = T extends Leaf
  ? never
  : T extends object
    ? KeyPaths<T, keyof T>
    : never;

// K is naked too, so each key is asked on its own; number and symbol keys give never.
// A key whose value has no paths gives `${K}.${never}`, which is never, so only K is left.
type KeyPaths<T, K extends keyof T> = K extends string
  ? K | `${K}.${Paths<T[K]>}`
  : never;
