// Cases adapted from type-challenges #00018, https://github.com/type-challenges/type-challenges/blob/main/questions/00018-easy-tuple-length/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Length } from './index';

const tesla = ['tesla', 'model 3', 'model X', 'model Y'] as const;
const spaceX = [
  'FALCON 9',
  'FALCON HEAVY',
  'DRAGON',
  'STARSHIP',
  'HUMAN SPACEFLIGHT',
] as const;

type cases = [
  Expect<Equal<Length<typeof tesla>, 4>>, // four elements
  Expect<Equal<Length<typeof spaceX>, 5>>, // five elements
  // @ts-expect-error
  Length<5>, // a number isn't a tuple
  // @ts-expect-error
  Length<'hello world'>, // a string isn't a tuple
  // Added in the dojo: the empty tuple, and an array whose length isn't known.
  Expect<Equal<Length<[]>, 0>>, // the empty tuple
  Expect<Equal<Length<string[]>, number>>, // an array type
];
