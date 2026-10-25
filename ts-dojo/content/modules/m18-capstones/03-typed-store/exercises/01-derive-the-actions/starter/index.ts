// ActionOf<M, K>: one action per key K of the map M, { type: K; payload: M[K] }, or { type: K }
// when the map's value is void or undefined.
export type ActionOf<M, K extends keyof M = keyof M> = unknown;

// SetterMap<S>: one setX action per string key x of S, whose payload is S[x].
export type SetterMap<S> = unknown;
