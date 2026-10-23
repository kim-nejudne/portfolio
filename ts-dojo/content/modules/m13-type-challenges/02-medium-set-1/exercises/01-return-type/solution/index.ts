// Match T against a function that takes anything (never[] parameters accept every parameter
// list) and infer what it returns. T is unconstrained, so a non-function falls through to never.
export type MyReturnType<T> = T extends (...args: never[]) => infer R
  ? R
  : never;
