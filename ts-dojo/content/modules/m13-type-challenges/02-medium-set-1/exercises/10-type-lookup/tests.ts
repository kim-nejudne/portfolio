// Cases adapted from type-challenges #00062, https://github.com/type-challenges/type-challenges/blob/main/questions/00062-medium-type-lookup/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { LookUp } from './index';

interface Cat {
  type: 'cat';
  breeds: 'Abyssinian' | 'Shorthair' | 'Curl' | 'Bengal';
}

interface Dog {
  type: 'dog';
  breeds: 'Hound' | 'Brittany' | 'Bulldog' | 'Boxer';
  color: 'brown' | 'white' | 'black';
}

type Animal = Cat | Dog;

type cases = [
  Expect<Equal<LookUp<Animal, 'dog'>, Dog>>, // the dog
  Expect<Equal<LookUp<Animal, 'cat'>, Cat>>, // the cat
  // Added in the dojo: a type no member has, and two types at once.
  Expect<Equal<LookUp<Animal, 'bird'>, never>>, // no such member
  Expect<Equal<LookUp<Animal, 'cat' | 'dog'>, Animal>>, // both members
];
