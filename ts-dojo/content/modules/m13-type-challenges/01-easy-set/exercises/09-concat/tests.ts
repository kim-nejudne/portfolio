// Cases adapted from type-challenges #00533, https://github.com/type-challenges/type-challenges/blob/main/questions/00533-easy-concat/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Concat } from './index';

const tuple = [1] as const;

type cases = [
  Expect<Equal<Concat<[], []>, []>>, // two empty tuples
  Expect<Equal<Concat<[], [1]>, [1]>>, // an empty tuple first
  Expect<Equal<Concat<typeof tuple, typeof tuple>, [1, 1]>>, // readonly tuples
  Expect<Equal<Concat<[1, 2], [3, 4]>, [1, 2, 3, 4]>>, // two pairs
  Expect<
    Equal<
      Concat<['1', 2, '3'], [false, boolean, '4']>,
      ['1', 2, '3', false, boolean, '4']
    >
  >, // mixed elements
];

// @ts-expect-error
type error = Concat<null, undefined>; // null and undefined aren't tuples
