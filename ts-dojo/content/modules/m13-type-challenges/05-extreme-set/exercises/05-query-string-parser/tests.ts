// Cases adapted from type-challenges #00151, https://github.com/type-challenges/type-challenges/blob/main/questions/00151-extreme-query-string-parser/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { ParseQueryString } from './index';

type cases = [
  Expect<Equal<ParseQueryString<''>, {}>>, // the empty string
  Expect<Equal<ParseQueryString<'k1'>, { k1: true }>>, // a key alone
  Expect<Equal<ParseQueryString<'k1&k1'>, { k1: true }>>, // the same key alone twice
  Expect<Equal<ParseQueryString<'k1&k2'>, { k1: true; k2: true }>>, // two keys alone
  Expect<Equal<ParseQueryString<'k1=v1'>, { k1: 'v1' }>>, // a key and a value
  Expect<Equal<ParseQueryString<'k1=v1&k1=v2'>, { k1: ['v1', 'v2'] }>>, // two values
  Expect<Equal<ParseQueryString<'k1=v1&k2=v2'>, { k1: 'v1'; k2: 'v2' }>>, // two keys
  Expect<
    Equal<ParseQueryString<'k1=v1&k2=v2&k1=v2'>, { k1: ['v1', 'v2']; k2: 'v2' }>
  >, // a key repeated after another
  Expect<Equal<ParseQueryString<'k1=v1&k2'>, { k1: 'v1'; k2: true }>>, // a value and a key alone
  Expect<Equal<ParseQueryString<'k1=v1&k1=v1'>, { k1: 'v1' }>>, // the same value twice
  Expect<Equal<ParseQueryString<'k1=v1&k1=v2&k1=v1'>, { k1: ['v1', 'v2'] }>>, // a value seen again in a tuple
  Expect<
    Equal<
      ParseQueryString<'k1=v1&k2=v1&k1=v2&k1=v1'>,
      { k1: ['v1', 'v2']; k2: 'v1' }
    >
  >, // two keys with repeats
  Expect<
    Equal<
      ParseQueryString<'k1=v1&k2=v2&k1=v2&k1=v3'>,
      { k1: ['v1', 'v2', 'v3']; k2: 'v2' }
    >
  >, // three values
  Expect<Equal<ParseQueryString<'k1=v1&k1'>, { k1: ['v1', true] }>>, // a value, then the key alone
  Expect<Equal<ParseQueryString<'k1&k1=v1'>, { k1: [true, 'v1'] }>>, // the key alone, then a value
  // Added in the dojo.
  Expect<Equal<ParseQueryString<'q=a=b'>, { q: 'a=b' }>>, // an = in the value
  Expect<Equal<ParseQueryString<'flag=true&flag'>, { flag: ['true', true] }>>, // 'true' is not true
  Expect<
    Equal<
      ParseQueryString<'page=2&tag=a&sort&tag=b&tag=a'>,
      { page: '2'; tag: ['a', 'b']; sort: true }
    >
  >, // every rule at once
];
