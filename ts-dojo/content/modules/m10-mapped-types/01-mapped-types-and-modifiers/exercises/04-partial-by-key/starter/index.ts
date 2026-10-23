// PartialBy<T, K>: the properties of T named by K become optional; the rest stay as they are.
export type PartialBy<T, K extends keyof T> = unknown;

// RequiredBy<T, K>: the properties of T named by K become required; the rest stay as they are.
export type RequiredBy<T, K extends keyof T> = unknown;
