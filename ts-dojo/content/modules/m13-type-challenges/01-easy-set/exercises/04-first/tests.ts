// Cases adapted from type-challenges #00014, https://github.com/type-challenges/type-challenges/blob/main/questions/00014-easy-first/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { First } from './index';

type cases = [
  Expect<Equal<First<[3, 2, 1]>, 3>>, // numbers
  Expect<Equal<First<[() => 123, { a: string }]>, () => 123>>, // a function first
  Expect<Equal<First<[]>, never>>, // the empty tuple
  Expect<Equal<First<[undefined]>, undefined>>, // undefined as the first element
];

// The original's `errors` tuple, renamed: only aliases whose name starts with `cases` hold cases.
type casesErrors = [
  // @ts-expect-error
  First<'notArray'>, // a string isn't an array
  // @ts-expect-error
  First<{ 0: 'arrayLike' }>, // an array-like object isn't an array
];
