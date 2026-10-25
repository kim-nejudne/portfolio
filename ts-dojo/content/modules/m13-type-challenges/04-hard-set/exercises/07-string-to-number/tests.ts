// Cases adapted from type-challenges #00300, https://github.com/type-challenges/type-challenges/blob/main/questions/00300-hard-string-to-number/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { ToNumber } from './index';

type cases = [
  Expect<Equal<ToNumber<'0'>, 0>>, // zero
  Expect<Equal<ToNumber<'5'>, 5>>, // one digit
  Expect<Equal<ToNumber<'12'>, 12>>, // two digits
  Expect<Equal<ToNumber<'27'>, 27>>, // two other digits
  Expect<Equal<ToNumber<'18@7_$%'>, never>>, // not a number
  // Added in the dojo.
  Expect<Equal<ToNumber<'-3'>, -3>>, // a negative number
  Expect<Equal<ToNumber<''>, never>>, // the empty string
  Expect<Equal<ToNumber<'1' | '20'>, 1 | 20>>, // a union
];
