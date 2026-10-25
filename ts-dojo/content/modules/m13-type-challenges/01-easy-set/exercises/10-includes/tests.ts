// Cases adapted from type-challenges #00898, https://github.com/type-challenges/type-challenges/blob/main/questions/00898-easy-includes/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Includes } from './index';

type cases = [
  Expect<
    Equal<Includes<['Kars', 'Esidisi', 'Wamuu', 'Santana'], 'Kars'>, true>
  >, // the first element
  Expect<
    Equal<Includes<['Kars', 'Esidisi', 'Wamuu', 'Santana'], 'Dio'>, false>
  >, // a string not there
  Expect<Equal<Includes<[1, 2, 3, 5, 6, 7], 7>, true>>, // the last element
  Expect<Equal<Includes<[1, 2, 3, 5, 6, 7], 4>, false>>, // a number not there
  Expect<Equal<Includes<[1, 2, 3], 2>, true>>, // a middle element
  Expect<Equal<Includes<[1, 2, 3], 1>, true>>, // the first number
  Expect<Equal<Includes<[{}], { a: 'A' }>, false>>, // assignable to {} is not equal to {}
  Expect<Equal<Includes<[boolean, 2, 3, 5, 6, 7], false>, false>>, // false is not boolean
  Expect<Equal<Includes<[true, 2, 3, 5, 6, 7], boolean>, false>>, // boolean is not true
  Expect<Equal<Includes<[false, 2, 3, 5, 6, 7], false>, true>>, // false is false
  Expect<Equal<Includes<[{ a: 'A' }], { readonly a: 'A' }>, false>>, // readonly differs
  Expect<Equal<Includes<[{ readonly a: 'A' }], { a: 'A' }>, false>>, // readonly differs, the other way
  Expect<Equal<Includes<[1], 1 | 2>, false>>, // a union is not one of its members
  Expect<Equal<Includes<[1 | 2], 1>, false>>, // a member is not the union
  Expect<Equal<Includes<[null], undefined>, false>>, // undefined is not null
  Expect<Equal<Includes<[undefined], null>, false>>, // null is not undefined
  // Added in the dojo: the constraint takes readonly tuples, and so must the search.
  Expect<Equal<Includes<readonly [1, 2], 2>, true>>, // a readonly tuple
];
