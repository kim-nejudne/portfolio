// TypeOf<T>: what `typeof` gives for a value of type T, from 'string' to 'object'.
// Functions and classes give 'function'; everything else, null included, gives 'object'.
export type TypeOf<T> = unknown;
