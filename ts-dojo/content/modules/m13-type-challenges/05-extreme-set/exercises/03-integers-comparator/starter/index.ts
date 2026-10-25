export enum Comparison {
  Greater,
  Equal,
  Lower,
}

// Comparator<A, B>: how A compares to B, as a member of Comparison.
export type Comparator<A extends number, B extends number> = unknown;
