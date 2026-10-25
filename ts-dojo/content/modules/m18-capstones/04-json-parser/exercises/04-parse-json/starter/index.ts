declare const failure: unique symbol;

/** What a parser returns for input it can't read. No JSON value has a symbol key. */
export type ParseError<Message extends string = string> = {
  readonly [failure]: Message;
};

// ---- Given: the pieces from exercises 1 and 2. Each returns [value, rest] or a ParseError. ----

type Space = ' ' | '\n' | '\r' | '\t';

// S without its leading whitespace.
type SkipSpace<S extends string> = S extends `${Space}${infer Rest}`
  ? SkipSpace<Rest>
  : S;

// true, false or null at the start of S.
type ParseLiteral<S extends string> = S extends `true${infer Rest}`
  ? [true, Rest]
  : S extends `false${infer Rest}`
    ? [false, Rest]
    : S extends `null${infer Rest}`
      ? [null, Rest]
      : ParseError<`Unexpected input: ${S}`>;

// A string without escapes at the start of S, its opening quote included.
type ParseString<S extends string> = S extends `"${infer Body}"${infer Rest}`
  ? Body extends `${string}\\${string}`
    ? ParseError<'Escapes are not supported'>
    : [Body, Rest]
  : ParseError<'Expected a string'>;

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type NumberChar = Digit | '-' | '+' | '.' | 'e' | 'E';

type ReadNumber<
  S extends string,
  Acc extends string = '',
> = S extends `${infer C extends NumberChar}${infer Rest}`
  ? ReadNumber<Rest, `${Acc}${C}`>
  : [Acc, S];

// A number at the start of S, as a number literal type where it prints back as the same text.
type ParseNumber<S extends string> =
  ReadNumber<S> extends [infer Text extends string, infer Rest extends string]
    ? Text extends `${infer N extends number}`
      ? [N, Rest]
      : ParseError<`Not a number: ${Text}`>
    : never;

// ---- Yours: any value, arrays, objects, and the whole text. ----

// The type of the JSON value that S spells, or a ParseError:
// ParseJson<'{"a": [1, true, null]}'> is { a: [1, true, null] }.
export type ParseJson<S extends string> = unknown;
