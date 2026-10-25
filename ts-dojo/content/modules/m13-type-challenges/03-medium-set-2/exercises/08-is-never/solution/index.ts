// A conditional on the naked T would distribute, and never, the empty union, would give never.
// Wrapped in a one-element tuple, T is checked as one type: only [never] fits in [never].
export type IsNever<T> = [T] extends [never] ? true : false;
