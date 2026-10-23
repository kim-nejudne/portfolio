declare const failure: unique symbol;

/** What a parser returns for input it can't read. No JSON value has a symbol key. */
export type ParseError<Message extends string = string> = {
  readonly [failure]: Message;
};

// Reads true, false, null or a string from the start of S, after any whitespace, and returns
// [value, rest]: ParseScalar<' true, 1'> is [true, ', 1'].
export type ParseScalar<S extends string> = unknown;
