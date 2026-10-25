// Cases adapted from type-challenges #00016, https://github.com/type-challenges/type-challenges/blob/main/questions/00016-medium-pop/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Pop } from './index';

type cases = [
  Expect<Equal<Pop<[3, 2, 1]>, [3, 2]>>, // three elements
  Expect<Equal<Pop<['a', 'b', 'c', 'd']>, ['a', 'b', 'c']>>, // four elements
  Expect<Equal<Pop<[]>, []>>, // the empty tuple
  // Added in the dojo: one element leaves the empty tuple.
  Expect<Equal<Pop<[1]>, []>>, // one element
];
