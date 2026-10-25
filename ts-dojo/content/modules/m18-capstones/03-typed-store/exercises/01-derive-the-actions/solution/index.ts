// ActionOf<M, K>: map every key to its action, then index with K to collect them into a union.
// M[P] isn't a naked type parameter, so the check doesn't distribute: only a value that is
// void or undefined as a whole drops the payload.
export type ActionOf<M, K extends keyof M = keyof M> = {
  [P in keyof M]: M[P] extends void ? { type: P } : { type: P; payload: M[P] };
}[K];

// SetterMap<S>: keyof S & string leaves out number and symbol keys, which Capitalize can't take.
export type SetterMap<S> = {
  [K in keyof S & string as `set${Capitalize<K>}`]: S[K];
};
