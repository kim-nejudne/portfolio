// Every element becomes a key, so the elements must be PropertyKey (string | number | symbol);
// readonly lets as const tuples in. T[number] is the union of the elements.
export type TupleToObject<T extends readonly PropertyKey[]> = {
  [K in T[number]]: K;
};
