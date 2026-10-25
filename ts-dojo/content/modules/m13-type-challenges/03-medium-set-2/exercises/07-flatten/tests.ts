// Cases adapted from type-challenges #00459, https://github.com/type-challenges/type-challenges/blob/main/questions/00459-medium-flatten/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Flatten } from './index';

type cases = [
  Expect<Equal<Flatten<[]>, []>>, // the empty tuple
  Expect<Equal<Flatten<[1, 2, 3, 4]>, [1, 2, 3, 4]>>, // already flat
  Expect<Equal<Flatten<[1, [2]]>, [1, 2]>>, // one level
  Expect<Equal<Flatten<[1, 2, [3, 4], [[[5]]]]>, [1, 2, 3, 4, 5]>>, // three levels
  Expect<
    Equal<
      Flatten<[{ foo: 'bar'; 2: 10 }, 'foobar']>,
      [{ foo: 'bar'; 2: 10 }, 'foobar']
    >
  >, // an object stays whole
  // Added in the dojo: empty tuples inside leave nothing behind.
  Expect<Equal<Flatten<[[], [[]], 1]>, [1]>>, // nested empty tuples
];

// @ts-expect-error
type error = Flatten<'1'>; // not an array
