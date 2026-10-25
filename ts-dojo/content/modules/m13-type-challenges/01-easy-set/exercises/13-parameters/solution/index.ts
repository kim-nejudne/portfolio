// Match T against a function with one rest parameter, and infer that rest parameter's tuple.
export type MyParameters<T extends (...args: never[]) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;
