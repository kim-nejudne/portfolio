// Repeat<'ab', 3> is 'ababab'.
export type Repeat<
  S extends string,
  N extends number,
  Count extends unknown[] = [], // one element per copy written so far
  Acc extends string = '', // the copies written so far
> = number extends N
  ? string // plain number: the result isn't known
  : Count['length'] extends N
    ? Acc
    : Repeat<S, N, [...Count, unknown], `${Acc}${S}`>; // a tail call
