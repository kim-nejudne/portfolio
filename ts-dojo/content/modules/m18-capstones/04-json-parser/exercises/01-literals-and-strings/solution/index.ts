declare const failure: unique symbol;

/** What a parser returns for input it can't read. No JSON value has a symbol key. */
export type ParseError<Message extends string = string> = {
  readonly [failure]: Message;
};

type Space = ' ' | '\n' | '\r' | '\t';

// S without its leading whitespace; a tail call, so long runs of it are fine.
type SkipSpace<S extends string> = S extends `${Space}${infer Rest}`
  ? SkipSpace<Rest>
  : S;

type ParseLiteral<S extends string> = S extends `true${infer Rest}`
  ? [true, Rest]
  : S extends `false${infer Rest}`
    ? [false, Rest]
    : S extends `null${infer Rest}`
      ? [null, Rest]
      : ParseError<`Unexpected input: ${S}`>;

// Body stops at the first quote after the opening one, so an escaped quote would end it early.
type ParseString<S extends string> = S extends `"${infer Body}"${infer Rest}`
  ? Body extends `${string}\\${string}`
    ? ParseError<'Escapes are not supported'>
    : [Body, Rest]
  : ParseError<'Expected a closing quote'>;

// Reads true, false, null or a string from the start of S, after any whitespace, and returns
// [value, rest]: ParseScalar<' true, 1'> is [true, ', 1'].
export type ParseScalar<S extends string> =
  SkipSpace<S> extends `"${string}`
    ? ParseString<SkipSpace<S>>
    : ParseLiteral<SkipSpace<S>>;
