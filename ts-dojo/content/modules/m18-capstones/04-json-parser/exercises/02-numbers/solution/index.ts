declare const failure: unique symbol;

/** What a parser returns for input it can't read. No JSON value has a symbol key. */
export type ParseError<Message extends string = string> = {
  readonly [failure]: Message;
};

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type NumberChar = Digit | '-' | '+' | '.' | 'e' | 'E';

// The longest run of number characters at the start of S, and what follows it. The run builds
// up in Acc, so the recursive call is a tail call.
type ReadNumber<
  S extends string,
  Acc extends string = '',
> = S extends `${infer C extends NumberChar}${infer Rest}`
  ? ReadNumber<Rest, `${Acc}${C}`>
  : [Acc, S];

// Reads a number from the start of S and returns [value, rest], the value as a number literal
// type: ParseNumber<'42, 1]'> is [42, ', 1]'].
export type ParseNumber<S extends string> =
  ReadNumber<S> extends [infer Text extends string, infer Rest extends string]
    ? Text extends `${infer N extends number}`
      ? [N, Rest]
      : ParseError<`Not a number: ${Text}`>
    : never;
