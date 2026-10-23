import type { Equal, Expect } from '@dojo/type-utils';
import type { ParseError, ParseNumber } from './index';

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
  Expect<Equal<ParseNumber<'42, 1]'>, [42, ', 1]']>>, // an integer
  Expect<Equal<ParseNumber<'0'>, [0, '']>>, // zero with nothing after it
  Expect<Equal<ParseNumber<'-7}'>, [-7, '}']>>, // a negative number
  Expect<Equal<ParseNumber<'0.25 ]'>, [0.25, ' ]']>>, // a fraction
  Expect<Equal<ParseNumber<'12abc'>, [12, 'abc']>>, // the run stops at a letter
  Expect<Equal<ParseNumber<'1.50]'>, [number, ']']>>, // 1.50 prints back as 1.5
  Expect<Equal<ParseNumber<'1e3,'>, [number, ',']>>, // 1e3 prints back as 1000
  Expect<Equal<ParseNumber<`${Repeat<'9', 12>}, 0`>, [999999999999, ', 0']>>, // built: twelve nines
  Expect<
    Equal<
      ParseNumber<`${Repeat<'5', 3>}.5${Repeat<' ', 30>}`>,
      [555.5, Repeat<' ', 30>]
    >
  >, // built: a fraction and 30 spaces
  Expect<Equal<ParseNumber<`12${string}`>, [12, string]>>, // a pattern: 12, then any text
  Expect<IsError<ParseNumber<'abc'>>>, // no number at all
  Expect<IsError<ParseNumber<'-'>>>, // a sign alone
  Expect<IsError<ParseNumber<'1-2'>>>, // a run that isn't one number
  Expect<IsError<ParseNumber<'1e'>>>, // an exponent with no digits
  Expect<IsError<ParseNumber<''>>>, // nothing at all
  Expect<IsError<ParseNumber<' 1'>>>, // whitespace isn't skipped here
];
