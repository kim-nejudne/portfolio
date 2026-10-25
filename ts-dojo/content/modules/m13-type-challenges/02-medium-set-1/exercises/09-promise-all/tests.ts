// Cases adapted from type-challenges #00020, https://github.com/type-challenges/type-challenges/blob/main/questions/00020-medium-promise-all/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import { PromiseAll } from './index';

const promiseAllTest1 = PromiseAll([1, 2, 3] as const);
const promiseAllTest2 = PromiseAll([1, 2, Promise.resolve(3)] as const);
const promiseAllTest3 = PromiseAll([1, 2, Promise.resolve(3)]);
const promiseAllTest4 = PromiseAll<Array<number | Promise<number>>>([1, 2, 3]);
const promiseAllTest5 = PromiseAll<(number | Promise<string>)[]>([
  1,
  2,
  Promise.resolve('3'),
]);

type cases = [
  Expect<Equal<typeof promiseAllTest1, Promise<[1, 2, 3]>>>, // as const values
  Expect<Equal<typeof promiseAllTest2, Promise<[1, 2, number]>>>, // as const, with a promise
  Expect<Equal<typeof promiseAllTest3, Promise<[number, number, number]>>>, // a literal, as a tuple
  Expect<Equal<typeof promiseAllTest4, Promise<number[]>>>, // an array type
  Expect<Equal<typeof promiseAllTest5, Promise<(number | string)[]>>>, // an array type of two kinds
];
