// Infer the rest element in front of the last one. The empty tuple has no last element to
// drop and stays empty.
export type Pop<T extends unknown[]> = T extends [...infer Rest, unknown]
  ? Rest
  : [];
