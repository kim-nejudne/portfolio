// Cases adapted from type-challenges #00476, https://github.com/type-challenges/type-challenges/blob/main/questions/00476-extreme-sum/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Sum } from './index';

// Added in the dojo: a number of 60 digits.
type Long = '123456789012345678901234567890123456789012345678901234567890';

type cases = [
  Expect<Equal<Sum<2, 3>, '5'>>, // two numbers
  Expect<Equal<Sum<'13', '21'>, '34'>>, // two strings
  Expect<Equal<Sum<'328', 7>, '335'>>, // a string and a number, with a carry
  Expect<Equal<Sum<1_000_000_000_000n, '123'>, '1000000000123'>>, // a bigint
  Expect<Equal<Sum<9999, 1>, '10000'>>, // a carry through every digit
  Expect<Equal<Sum<4325234, '39532'>, '4364766'>>, // seven digits
  Expect<Equal<Sum<728, 0>, '728'>>, // plus zero
  Expect<Equal<Sum<'0', 213>, '213'>>, // zero plus
  Expect<Equal<Sum<0, '0'>, '0'>>, // zero plus zero
  // Added in the dojo.
  Expect<Equal<Sum<'999', '999'>, '1998'>>, // a carry into a new digit
  Expect<Equal<Sum<1n, 2n>, '3'>>, // two bigints
  Expect<
    Equal<
      Sum<Long, Long>,
      '246913578024691357802469135780246913578024691357802469135780'
    >
  >, // 60 digits each
  Expect<
    Equal<
      Sum<'1', Long>,
      '123456789012345678901234567890123456789012345678901234567891'
    >
  >, // 1 and 60 digits
];
