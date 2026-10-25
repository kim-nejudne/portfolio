// T[0] would give undefined for []. Matching "at least one element" tells an empty tuple apart
// from one whose first element is undefined.
export type First<T extends unknown[]> = T extends [infer Head, ...unknown[]]
  ? Head
  : never;
