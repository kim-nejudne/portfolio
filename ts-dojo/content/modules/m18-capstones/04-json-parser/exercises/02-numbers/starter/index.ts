declare const failure: unique symbol;

/** What a parser returns for input it can't read. No JSON value has a symbol key. */
export type ParseError<Message extends string = string> = {
  readonly [failure]: Message;
};

// Reads a number from the start of S and returns [value, rest], the value as a number literal
// type: ParseNumber<'42, 1]'> is [42, ', 1]'].
export type ParseNumber<S extends string> = unknown;
