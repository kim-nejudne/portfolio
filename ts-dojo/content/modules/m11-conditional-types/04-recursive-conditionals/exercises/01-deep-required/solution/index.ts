// DeepRequired<T>: every property at every level of T, required.
// Functions come first: a mapped type over a function type would drop its call signature.
// -? removes the ? and the undefined it added; the recursion does the same one level down.
// Arrays and tuples stay arrays and tuples, because the mapped type is homomorphic.
export type DeepRequired<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]-?: DeepRequired<T[K]> }
    : T;
