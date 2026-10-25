// Cases adapted from type-challenges #00296, https://github.com/type-challenges/type-challenges/blob/main/questions/00296-medium-permutation/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Permutation } from './index';

type cases = [
  Expect<Equal<Permutation<'A'>, ['A']>>, // one member
  Expect<
    Equal<
      Permutation<'A' | 'B' | 'C'>,
      | ['A', 'B', 'C']
      | ['A', 'C', 'B']
      | ['B', 'A', 'C']
      | ['B', 'C', 'A']
      | ['C', 'A', 'B']
      | ['C', 'B', 'A']
    >
  >, // three members
  Expect<
    Equal<
      Permutation<'B' | 'A' | 'C'>,
      | ['A', 'B', 'C']
      | ['A', 'C', 'B']
      | ['B', 'A', 'C']
      | ['B', 'C', 'A']
      | ['C', 'A', 'B']
      | ['C', 'B', 'A']
    >
  >, // written in another order
  Expect<Equal<Permutation<boolean>, [false, true] | [true, false]>>, // boolean is a union
  Expect<Equal<Permutation<never>, []>>, // no members
];
