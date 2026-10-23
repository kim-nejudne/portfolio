// The exact equality of the theory's Includes: true only when X and Y are the same type.
type IsEqual<X, Y> =
  (<V>() => V extends X ? 1 : 2) extends <V>() => V extends Y ? 1 : 2
    ? true
    : false;

// LastIndexOf<[1, 2, 3, 2], 2> is 3: the index of the last element that is exactly U, or -1.
export type LastIndexOf<T extends readonly unknown[], U> = T extends readonly [
  ...infer Before,
  infer Last,
]
  ? IsEqual<Last, U> extends true
    ? Before['length'] // the index of Last is the number of elements before it
    : LastIndexOf<Before, U> // not this one: look further to the front
  : -1; // the empty tuple: not found
