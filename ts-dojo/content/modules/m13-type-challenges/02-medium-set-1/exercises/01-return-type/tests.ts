// Cases adapted from type-challenges #00002, https://github.com/type-challenges/type-challenges/blob/main/questions/00002-medium-return-type/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { MyReturnType } from './index';

type cases = [
  Expect<Equal<string, MyReturnType<() => string>>>, // a string
  Expect<Equal<123, MyReturnType<() => 123>>>, // a literal
  Expect<Equal<ComplexObject, MyReturnType<() => ComplexObject>>>, // an object
  Expect<Equal<Promise<boolean>, MyReturnType<() => Promise<boolean>>>>, // a promise, not unwrapped
  Expect<Equal<() => 'foo', MyReturnType<() => () => 'foo'>>>, // a function
  Expect<Equal<1 | 2, MyReturnType<typeof fn>>>, // a parameter
  Expect<Equal<1 | 2, MyReturnType<typeof fn1>>>, // two parameters
];

type ComplexObject = {
  a: [12, 'foo'];
  bar: 'hello';
  prev(): number;
};

const fn = (v: boolean) => (v ? 1 : 2);
// The original types w as `any`; explicit `any` is forbidden in every file of a type-challenge
// here, so it is `unknown`. The case checks the same thing.
const fn1 = (v: boolean, w: unknown) => (v ? 1 : 2);
