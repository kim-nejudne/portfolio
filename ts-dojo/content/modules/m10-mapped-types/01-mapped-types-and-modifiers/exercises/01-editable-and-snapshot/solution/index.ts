// Editable<T>: every property of T is writable and required.
export type Editable<T> = { -readonly [K in keyof T]-?: T[K] };

// Snapshot<T>: every property of T is read-only and optional.
export type Snapshot<T> = { readonly [K in keyof T]?: T[K] };
