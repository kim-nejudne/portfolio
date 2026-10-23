// Exact equality, the trick Equal uses: the two generic functions are related only when X and Y
// are identical, which assignability (false extends boolean, { a: 'A' } extends {}) is not.
type IsEqual<X, Y> =
  (<V>() => V extends X ? 1 : 2) extends <V>() => V extends Y ? 1 : 2
    ? true
    : false;

// Compare the first element with U; if it isn't U, look in the rest. An empty tuple has no U.
export type Includes<T extends readonly unknown[], U> = T extends readonly [
  infer Head,
  ...infer Rest,
]
  ? IsEqual<Head, U> extends true
    ? true
    : Includes<Rest, U>
  : false;
