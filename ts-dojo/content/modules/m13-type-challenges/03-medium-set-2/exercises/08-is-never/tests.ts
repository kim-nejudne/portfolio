// Cases adapted from type-challenges #01042, https://github.com/type-challenges/type-challenges/blob/main/questions/01042-medium-isnever/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { IsNever } from './index';

type cases = [
  Expect<Equal<IsNever<never>, true>>, // never
  Expect<Equal<IsNever<never | string>, false>>, // never in a union is gone
  Expect<Equal<IsNever<''>, false>>, // the empty string
  Expect<Equal<IsNever<undefined>, false>>, // undefined
  Expect<Equal<IsNever<null>, false>>, // null
  Expect<Equal<IsNever<[]>, false>>, // the empty tuple
  Expect<Equal<IsNever<{}>, false>>, // the empty object type
  // Added in the dojo: the top type is not the bottom one.
  Expect<Equal<IsNever<unknown>, false>>, // unknown
];
