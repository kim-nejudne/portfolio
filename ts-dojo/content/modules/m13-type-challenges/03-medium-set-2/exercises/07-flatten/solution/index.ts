// Take the first element off. An element that is an array is flattened in turn and spread in;
// anything else goes in as one element. The empty tuple ends the recursion. The constraint
// makes a non-array argument an error.
export type Flatten<T extends unknown[]> = T extends [infer Head, ...infer Rest]
  ? Head extends unknown[]
    ? [...Flatten<Head>, ...Flatten<Rest>]
    : [Head, ...Flatten<Rest>]
  : [];
