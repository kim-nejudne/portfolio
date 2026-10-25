// Cases adapted from type-challenges #00010, https://github.com/type-challenges/type-challenges/blob/main/questions/00010-medium-tuple-to-union/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { TupleToUnion } from './index';

type cases = [
  Expect<Equal<TupleToUnion<[123, '456', true]>, 123 | '456' | true>>, // three elements
  Expect<Equal<TupleToUnion<[123]>, 123>>, // one element
  // Added in the dojo: the empty tuple, and a readonly tuple.
  Expect<Equal<TupleToUnion<[]>, never>>, // no elements
  Expect<Equal<TupleToUnion<readonly ['a', 'b']>, 'a' | 'b'>>, // a readonly tuple
];
