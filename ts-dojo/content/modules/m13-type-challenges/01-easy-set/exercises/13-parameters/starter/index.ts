// MyParameters<T>: the parameter types of T, as a tuple.
export type MyParameters<T extends (...args: never[]) => unknown> = unknown;
