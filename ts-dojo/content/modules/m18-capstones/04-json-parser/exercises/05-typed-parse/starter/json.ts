// The finished parser from exercise 4. You don't need to change this file.

declare const failure: unique symbol;

/** What a parser returns for input it can't read. No JSON value has a symbol key. */
export type ParseError<Message extends string = string> = {
  readonly [failure]: Message;
};

type Space = ' ' | '\n' | '\r' | '\t';

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

type ParseNumber<S extends string> =
  ReadNumber<S> extends [infer Text extends string, infer Rest extends string]
    ? Text extends `${infer N extends number}`
      ? [N, Rest]
      : ParseError<`Not a number: ${Text}`>
    : never;

type ParseValue<S extends string> =
  SkipSpace<S> extends infer T extends string
    ? T extends `[${infer Rest}`
      ? ParseArray<Rest>
      : T extends `{${infer Rest}`
        ? ParseObject<Rest>
        : T extends `"${string}`
          ? ParseString<T>
          : T extends `${'-' | Digit}${string}`
            ? ParseNumber<T>
            : ParseLiteral<T>
    : never;

type ParseArray<S extends string> =
  SkipSpace<S> extends `]${infer Rest}` ? [[], Rest] : ParseElements<S>;

type ParseElements<S extends string, Acc extends unknown[] = []> =
  ParseValue<S> extends [infer V, infer Rest extends string]
    ? SkipSpace<Rest> extends `,${infer Next}`
      ? ParseElements<Next, [...Acc, V]>
      : SkipSpace<Rest> extends `]${infer Next}`
        ? [[...Acc, V], Next]
        : ParseError<`Expected , or ] at: ${Rest}`>
    : ParseValue<S>;

type With<Obj, K extends string, V> = {
  [P in keyof Obj | K]: P extends K ? V : P extends keyof Obj ? Obj[P] : never;
};

type ParseObject<S extends string> =
  SkipSpace<S> extends `}${infer Rest}` ? [{}, Rest] : ParseMembers<S>;

type ParseMembers<S extends string, Acc = {}> =
  ParseString<SkipSpace<S>> extends [
    infer K extends string,
    infer AfterKey extends string,
  ]
    ? SkipSpace<AfterKey> extends `:${infer AfterColon}`
      ? ParseValue<AfterColon> extends [infer V, infer Rest extends string]
        ? SkipSpace<Rest> extends `,${infer Next}`
          ? ParseMembers<Next, With<Acc, K, V>>
          : SkipSpace<Rest> extends `}${infer Next}`
            ? [With<Acc, K, V>, Next]
            : ParseError<`Expected , or } at: ${Rest}`>
        : ParseValue<AfterColon>
      : ParseError<`Expected : after "${K}"`>
    : ParseString<SkipSpace<S>>;

// The type of the JSON value that S spells, or a ParseError:
// ParseJson<'{"a": [1, true, null]}'> is { a: [1, true, null] }.
export type ParseJson<S extends string> =
  ParseValue<S> extends [infer V, infer Rest extends string]
    ? SkipSpace<Rest> extends ''
      ? V
      : ParseError<`Unexpected text after the value: ${Rest}`>
    : ParseValue<S>;
