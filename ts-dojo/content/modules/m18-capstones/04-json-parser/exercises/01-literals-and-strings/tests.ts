import type { Equal, Expect } from '@dojo/type-utils';
import type { ParseError, ParseScalar } from './index';

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

type cases = [
  Expect<Equal<ParseScalar<'true, 1]'>, [true, ', 1]']>>, // true
  Expect<Equal<ParseScalar<'false}'>, [false, '}']>>, // false
  Expect<Equal<ParseScalar<'null'>, [null, '']>>, // null with nothing after it
  Expect<Equal<ParseScalar<'nullable'>, [null, 'able']>>, // what follows isn't checked
  Expect<Equal<ParseScalar<' \n\t\r false'>, [false, '']>>, // whitespace first
  Expect<Equal<ParseScalar<'"id": 7'>, ['id', ': 7']>>, // a string
  Expect<Equal<ParseScalar<'"", 1'>, ['', ', 1']>>, // the empty string
  Expect<Equal<ParseScalar<'  "a b" "c"'>, ['a b', ' "c"']>>, // a string ends at its closing quote
  Expect<
    Equal<
      ParseScalar<`${Repeat<' ', 40>}"${Repeat<'ab', 20>}",`>,
      [Repeat<'ab', 20>, ',']
    >
  >, // built: 40 spaces, then a string of 40 characters
  Expect<Equal<ParseScalar<`true${string}`>, [true, string]>>, // a pattern: true, then any text
  Expect<Equal<ParseScalar<`"${Repeat<'x', 5>}"${string}`>, ['xxxxx', string]>>, // a pattern after a string
  Expect<IsError<ParseScalar<'tru'>>>, // a literal cut short
  Expect<IsError<ParseScalar<'True'>>>, // the wrong case
  Expect<IsError<ParseScalar<'"open'>>>, // no closing quote
  Expect<IsError<ParseScalar<'"a\\"b"'>>>, // an escaped quote
  Expect<IsError<ParseScalar<'"line\\nbreak"'>>>, // another escape
  Expect<IsError<ParseScalar<''>>>, // nothing at all
  Expect<IsError<ParseScalar<' \n '>>>, // only whitespace
];
