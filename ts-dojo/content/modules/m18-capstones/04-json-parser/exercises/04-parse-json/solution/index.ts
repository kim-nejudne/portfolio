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

// One value of any kind, after any whitespace. Its first character says which kind.
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

// What follows a [: an empty array, or the elements.
type ParseArray<S extends string> =
  SkipSpace<S> extends `]${infer Rest}` ? [[], Rest] : ParseElements<S>;

// One element, then a , to go on or a ] to stop. The recursive call is a tail call, and an
// element's error is returned as it is.
type ParseElements<S extends string, Acc extends unknown[] = []> =
  ParseValue<S> extends [infer V, infer Rest extends string]
    ? SkipSpace<Rest> extends `,${infer Next}`
      ? ParseElements<Next, [...Acc, V]>
      : SkipSpace<Rest> extends `]${infer Next}`
        ? [[...Acc, V], Next]
        : ParseError<`Expected , or ] at: ${Rest}`>
    : ParseValue<S>;

// Obj with K set to V, as one object type. A key seen again takes the new value, as in
// JSON.parse.
type With<Obj, K extends string, V> = {
  [P in keyof Obj | K]: P extends K ? V : P extends keyof Obj ? Obj[P] : never;
};

// What follows a {: an empty object, or the members.
type ParseObject<S extends string> =
  SkipSpace<S> extends `}${infer Rest}` ? [{}, Rest] : ParseMembers<S>;

// "key", a :, a value, then a , to go on or a } to stop.
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
