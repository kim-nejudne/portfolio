// One arrow per parameter: take the first element of the tuple off, and curry the rest.
type Curried<Args extends unknown[], R> = Args extends [
  infer First,
  ...infer Rest,
]
  ? (arg: First) => Curried<Rest, R>
  : R;

// F is the whole function type. A parameter typed with a bare type parameter gives the arrow
// function passed in no return type to match, so its literal true survives into F, and infer
// reads it back. A function with no parameters keeps its own arrow.
export declare function Currying<F>(
  fn: F,
): F extends (...args: infer Args) => infer R
  ? Args extends []
    ? () => R
    : Curried<Args, R>
  : never;
