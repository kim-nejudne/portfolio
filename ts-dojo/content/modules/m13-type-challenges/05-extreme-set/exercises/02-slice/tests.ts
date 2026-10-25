// Cases adapted from type-challenges #00216, https://github.com/type-challenges/type-challenges/blob/main/questions/00216-extreme-slice/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Slice } from './index';

type Arr = [1, 2, 3, 4, 5];

type cases = [
  // basic
  Expect<Equal<Slice<Arr, 0, 1>, [1]>>, // the first element
  Expect<Equal<Slice<Arr, 0, 0>, []>>, // an empty range
  Expect<Equal<Slice<Arr, 2, 4>, [3, 4]>>, // the middle

  // optional args
  Expect<Equal<Slice<[]>, []>>, // the empty tuple
  Expect<Equal<Slice<Arr>, Arr>>, // no start and no end
  Expect<Equal<Slice<Arr, 0>, Arr>>, // no end
  Expect<Equal<Slice<Arr, 2>, [3, 4, 5]>>, // from 2 to the end

  // negative index
  Expect<Equal<Slice<Arr, 0, -1>, [1, 2, 3, 4]>>, // all but the last
  Expect<Equal<Slice<Arr, -3, -1>, [3, 4]>>, // both from the end

  // invalid
  Expect<Equal<Slice<Arr, 10>, []>>, // a start past the end
  Expect<Equal<Slice<Arr, 1, 0>, []>>, // the end before the start
  Expect<Equal<Slice<Arr, 10, 20>, []>>, // both past the end

  // Added in the dojo.
  Expect<Equal<Slice<Arr, 3, 10>, [4, 5]>>, // an end past the length
  Expect<Equal<Slice<Arr, -10, 2>, [1, 2]>>, // a negative start past the beginning
  Expect<Equal<Slice<Arr, 1, -10>, []>>, // a negative end past the beginning
  Expect<Equal<Slice<Arr, -2>, [4, 5]>>, // the last two
  Expect<Equal<Slice<['a', 1, true], 1>, [1, true]>>, // another tuple
  Expect<Equal<Slice<['a', 'a', 'a'], 1, 2>, ['a']>>, // repeated elements
];
