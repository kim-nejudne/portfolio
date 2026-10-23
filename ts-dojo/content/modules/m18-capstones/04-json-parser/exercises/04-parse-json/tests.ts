import type { Equal, Expect } from '@dojo/type-utils';
import type { ParseError, ParseJson } from './index';

// True when T is a ParseError; never doesn't count as one.
type IsError<T> = [T] extends [never]
  ? false
  : [T] extends [ParseError]
    ? true
    : false;

// N copies of S, so that some inputs are built rather than written out.
type Repeat<
  S extends string,
  N extends number,
  Acc extends string = '',
  Count extends unknown[] = [],
> = Count['length'] extends N
  ? Acc
  : Repeat<S, N, `${Acc}${S}`, [...Count, unknown]>;

// A tuple of N copies of T.
type Fill<
  T,
  N extends number,
  Acc extends unknown[] = [],
> = Acc['length'] extends N ? Acc : Fill<T, N, [...Acc, T]>;

// Every tuple of N booleans: 2 to the power N of them.
type Bools<
  N extends number,
  Acc extends boolean[] = [],
> = Acc['length'] extends N
  ? Acc
  : Bools<N, [...Acc, true]> | Bools<N, [...Acc, false]>;

// One text for each choice of the placeholders below.
type B = 'true' | 'false';
type Id = 1 | 2 | 3;

// One object for each choice of id, admin and tag.
type Users<I, A, T> = I extends unknown
  ? A extends unknown
    ? T extends unknown
      ? { user: { id: I; admin: A }; tags: [T, 'x'] }
      : never
    : never
  : never;

type cases = [
  Expect<Equal<ParseJson<'{"a": [1, true, null]}'>, { a: [1, true, null] }>>, // the capstone
  Expect<Equal<ParseJson<'true'>, true>>, // a literal alone
  Expect<Equal<ParseJson<' 42 '>, 42>>, // a number with whitespace around it
  Expect<Equal<ParseJson<'"hi"'>, 'hi'>>, // a string alone
  Expect<Equal<ParseJson<'[]'>, []>>, // an empty array
  Expect<Equal<ParseJson<'{ }'>, {}>>, // an empty object
  Expect<Equal<ParseJson<'[[1, 2], [3, [4]], []]'>, [[1, 2], [3, [4]], []]>>, // nested arrays
  Expect<
    Equal<
      ParseJson<'{"user": {"name": "Ada", "tags": ["x", "y"]}, "ok": false}'>,
      { user: { name: 'Ada'; tags: ['x', 'y'] }; ok: false }
    >
  >, // nested objects
  Expect<
    Equal<
      ParseJson<'{\n  "id": -3,\n  "items": [\n    null,\n    {"n": 0.5}\n  ]\n}'>,
      { id: -3; items: [null, { n: 0.5 }] }
    >
  >, // newlines and indents
  Expect<Equal<ParseJson<'{"a": 1, "a": 2}'>, { a: 2 }>>, // a repeated key keeps the last value
  Expect<Equal<ParseJson<'{"error": "disk full"}'>, { error: 'disk full' }>>, // a value, not a failure
  Expect<Equal<ParseJson<`[${Repeat<'7, ', 149>}7]`>, Fill<7, 150>>>, // built: 150 elements
  Expect<
    Equal<
      ParseJson<`{"list": [${Repeat<'{"ok": true}, ', 9>}{"ok": true}]}`>,
      { list: Fill<{ ok: true }, 10> }
    >
  >, // built: ten objects in an array
  Expect<Equal<ParseJson<'[1]' | '{"a": 2}'>, [1] | { a: 2 }>>, // a union of two texts
  Expect<Equal<ParseJson<`[${B}, ${B}, ${B}, ${B}, ${B}, ${B}]`>, Bools<6>>>, // built: 64 texts, one for each tuple of six booleans
  Expect<
    Equal<
      ParseJson<`{"user": {"id": ${Id}, "admin": ${B}}, "tags": [${B}, "x"]}`>,
      Users<Id, boolean, boolean>
    >
  >, // built: 12 texts of nested objects
  Expect<IsError<ParseJson<'[1,'>>>, // an array cut short
  Expect<IsError<ParseJson<'[1 2]'>>>, // a missing comma
  Expect<IsError<ParseJson<'[1,]'>>>, // a trailing comma in an array
  Expect<IsError<ParseJson<'{"a": 1,}'>>>, // a trailing comma in an object
  Expect<IsError<ParseJson<'{"a" 1}'>>>, // a missing colon
  Expect<IsError<ParseJson<'{"a": }'>>>, // a missing value
  Expect<IsError<ParseJson<'{a: 1}'>>>, // a key without quotes
  Expect<IsError<ParseJson<'[[1, @]]'>>>, // an error two levels down
  Expect<IsError<ParseJson<'{"a": {"b": tru}}'>>>, // an error inside an object
  Expect<IsError<ParseJson<'[1] [2]'>>>, // text after the value
  Expect<IsError<ParseJson<''>>>, // nothing at all
];
