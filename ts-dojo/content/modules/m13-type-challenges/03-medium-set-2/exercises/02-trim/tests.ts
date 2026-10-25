// Cases adapted from type-challenges #00108, https://github.com/type-challenges/type-challenges/blob/main/questions/00108-medium-trim/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Trim } from './index';

type cases = [
  Expect<Equal<Trim<'str'>, 'str'>>, // nothing to trim
  Expect<Equal<Trim<' str'>, 'str'>>, // one space at the start
  Expect<Equal<Trim<'     str'>, 'str'>>, // several at the start
  Expect<Equal<Trim<'str   '>, 'str'>>, // several at the end
  Expect<Equal<Trim<'     str     '>, 'str'>>, // both ends
  Expect<Equal<Trim<'   \n\t foo bar \t'>, 'foo bar'>>, // newlines and tabs, the middle kept
  Expect<Equal<Trim<''>, ''>>, // the empty string
  Expect<Equal<Trim<' \n\t '>, ''>>, // only whitespace
];
