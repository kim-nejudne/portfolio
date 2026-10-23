// Nullable<T>: every property of T also accepts null; its modifiers stay as they are.
export type Nullable<T> = unknown;

// Mutable<T>: every property of T loses readonly, and keeps its type and its ?.
export type Mutable<T> = unknown;
