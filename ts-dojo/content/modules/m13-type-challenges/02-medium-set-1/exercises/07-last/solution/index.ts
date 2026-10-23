// A rest element first and one element after it: that element is the last. The empty tuple
// doesn't match the pattern, which needs at least one element.
export type Last<T extends unknown[]> = T extends [...unknown[], infer L]
  ? L
  : never;
