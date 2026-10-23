// Cases adapted from type-challenges #03060, https://github.com/type-challenges/type-challenges/blob/main/questions/03060-easy-unshift/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Unshift } from './index';

type cases = [
  Expect<Equal<Unshift<[], 1>, [1]>>, // onto the empty tuple
  Expect<Equal<Unshift<[1, 2], 0>, [0, 1, 2]>>, // onto a pair
  Expect<Equal<Unshift<['1', 2, '3'], boolean>, [boolean, '1', 2, '3']>>, // a union element
];
