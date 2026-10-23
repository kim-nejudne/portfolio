// Cases adapted from type-challenges #00106, https://github.com/type-challenges/type-challenges/blob/main/questions/00106-medium-trimleft/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { TrimLeft } from './index';

type cases = [
  Expect<Equal<TrimLeft<'str'>, 'str'>>, // nothing to trim
  Expect<Equal<TrimLeft<' str'>, 'str'>>, // one space
  Expect<Equal<TrimLeft<'     str'>, 'str'>>, // several spaces
  Expect<Equal<TrimLeft<'     str     '>, 'str     '>>, // the end is kept
  Expect<Equal<TrimLeft<'   \n\t foo bar '>, 'foo bar '>>, // newlines and tabs
  Expect<Equal<TrimLeft<''>, ''>>, // the empty string
  Expect<Equal<TrimLeft<' \n\t'>, ''>>, // only whitespace
];
