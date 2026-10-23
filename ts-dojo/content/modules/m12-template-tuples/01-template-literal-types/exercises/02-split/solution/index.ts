// Split<S, D>: S cut at every D, as a tuple. Split<'a,b', ','> is ['a', 'b'].
export type Split<S extends string, D extends string> = string extends S
  ? string[] // a plain string: the pieces aren't known
  : S extends `${infer Head}${D}${infer Rest}`
    ? [Head, ...Split<Rest, D>] // Head stops at the first D; split the rest again
    : [S]; // no D left: the whole string is the last piece
