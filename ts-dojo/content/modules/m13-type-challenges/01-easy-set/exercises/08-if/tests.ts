// Cases adapted from type-challenges #00268, https://github.com/type-challenges/type-challenges/blob/main/questions/00268-easy-if/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { If } from './index';

type cases = [
  Expect<Equal<If<true, 'a', 'b'>, 'a'>>, // true
  Expect<Equal<If<false, 'a', 2>, 2>>, // false
  Expect<Equal<If<boolean, 'a', 2>, 'a' | 2>>, // boolean, either one
];

// @ts-expect-error
type error = If<null, 'a', 'b'>; // null isn't a boolean
