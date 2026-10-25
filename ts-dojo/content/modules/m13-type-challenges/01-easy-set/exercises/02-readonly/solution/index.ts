// Mapping over keyof T keeps each property's ?, and the readonly in front adds the modifier.
export type MyReadonly<T> = { readonly [P in keyof T]: T[P] };
