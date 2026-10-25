// Fill<3, 'x'> is ['x', 'x', 'x'].
export type Fill<N extends number, T, Acc extends T[] = []> = number extends N
  ? T[] // plain number: the length isn't known
  : Acc['length'] extends N
    ? Acc // the tuple is the counter: stop when it has N elements
    : Fill<N, T, [...Acc, T]>; // a tail call, so it runs for up to 999 steps
