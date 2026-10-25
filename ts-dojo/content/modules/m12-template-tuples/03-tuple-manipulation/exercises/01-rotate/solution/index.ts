// RotateLeft<[1, 2, 3]> is [2, 3, 1]; RotateRight<[1, 2, 3]> is [3, 1, 2].
export type RotateLeft<T extends readonly unknown[]> = T extends readonly [
  infer First,
  ...infer Rest,
]
  ? [...Rest, First] // the first element goes to the end
  : T; // nothing to take off: an empty tuple or an array

export type RotateRight<T extends readonly unknown[]> = T extends readonly [
  ...infer Rest,
  infer Last,
]
  ? [Last, ...Rest] // the last element goes to the front
  : T;
