// Split<S, D>: S cut at every D, as a tuple. Split<'a,b', ','> is ['a', 'b'].
export type Split<S extends string, D extends string> = string[];
