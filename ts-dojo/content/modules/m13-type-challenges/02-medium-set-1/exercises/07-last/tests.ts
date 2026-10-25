// Cases adapted from type-challenges #00015, https://github.com/type-challenges/type-challenges/blob/main/questions/00015-medium-last/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Last } from './index';

type cases = [
  Expect<Equal<Last<[]>, never>>, // the empty tuple
  Expect<Equal<Last<[2]>, 2>>, // one element
  Expect<Equal<Last<[3, 2, 1]>, 1>>, // three elements
  Expect<Equal<Last<[() => 123, { a: string }]>, { a: string }>>, // an object last
  // Added in the dojo: an undefined last element is not a missing one.
  Expect<Equal<Last<[1, undefined]>, undefined>>, // undefined last
];
