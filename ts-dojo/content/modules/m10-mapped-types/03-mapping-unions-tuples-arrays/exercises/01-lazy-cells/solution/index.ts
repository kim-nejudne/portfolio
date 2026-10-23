// Lazy<T>: the same shape as T, with every element or property replaced by a function that
// returns it.
// Homomorphic over a type parameter, so a tuple stays a tuple, an array an array, a union is
// mapped member by member, and a primitive passes through.
export type Lazy<T> = { [K in keyof T]: () => T[K] };
