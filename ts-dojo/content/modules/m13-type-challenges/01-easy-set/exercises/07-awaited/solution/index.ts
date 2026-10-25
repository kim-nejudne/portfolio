// Anything with a then method is unwrapped, as await does: infer the callback that then takes,
// then the value that callback receives, and unwrap that in turn.
export type MyAwaited<T> = T extends {
  then: (onfulfilled: infer Callback) => unknown;
}
  ? Callback extends (value: infer Value) => unknown
    ? MyAwaited<Value>
    : never
  : T;
