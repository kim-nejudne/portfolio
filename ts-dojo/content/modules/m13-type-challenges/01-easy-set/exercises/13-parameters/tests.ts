// Cases adapted from type-challenges #03312, https://github.com/type-challenges/type-challenges/blob/main/questions/03312-easy-parameters/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { MyParameters } from './index';

function foo(arg1: string, arg2: number): void {}
function bar(arg1: boolean, arg2: { a: 'A' }): void {}
function baz(): void {}

type cases = [
  Expect<Equal<MyParameters<typeof foo>, [string, number]>>, // two parameters
  Expect<Equal<MyParameters<typeof bar>, [boolean, { a: 'A' }]>>, // an object parameter
  Expect<Equal<MyParameters<typeof baz>, []>>, // no parameters
];
