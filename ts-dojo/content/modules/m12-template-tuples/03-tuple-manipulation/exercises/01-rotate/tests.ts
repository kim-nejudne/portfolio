import type { Equal, Expect } from '@dojo/type-utils';
import type { RotateLeft, RotateRight } from './index';

type cases = [
  Expect<Equal<RotateLeft<[1, 2, 3]>, [2, 3, 1]>>, // left: three elements
  Expect<Equal<RotateLeft<['a', 'b']>, ['b', 'a']>>, // left: two elements
  Expect<
    Equal<
      RotateLeft<[string, number, boolean, null]>,
      [number, boolean, null, string]
    >
  >, // left: four types
  Expect<Equal<RotateLeft<[true]>, [true]>>, // left: one element stays
  Expect<Equal<RotateLeft<readonly ['a', 'b']>, ['b', 'a']>>, // left: readonly in, mutable out
  Expect<Equal<RotateLeft<[]>, []>>, // left: empty stays empty
  Expect<Equal<RotateLeft<string[]>, string[]>>, // left: an array stays
  Expect<Equal<RotateLeft<[1, 2] | [3, 4, 5]>, [2, 1] | [4, 5, 3]>>, // left: a union
  Expect<Equal<RotateRight<[1, 2, 3]>, [3, 1, 2]>>, // right: three elements
  Expect<Equal<RotateRight<['a', 'b']>, ['b', 'a']>>, // right: two elements
  Expect<
    Equal<
      RotateRight<[string, number, boolean, null]>,
      [null, string, number, boolean]
    >
  >, // right: four types
  Expect<Equal<RotateRight<[true]>, [true]>>, // right: one element stays
  Expect<Equal<RotateRight<readonly [0, 1, 2]>, [2, 0, 1]>>, // right: readonly in, mutable out
  Expect<Equal<RotateRight<[]>, []>>, // right: empty stays empty
  Expect<Equal<RotateRight<number[]>, number[]>>, // right: an array stays
  Expect<Equal<RotateRight<[1, 2] | [3, 4, 5]>, [2, 1] | [5, 3, 4]>>, // right: a union
];
