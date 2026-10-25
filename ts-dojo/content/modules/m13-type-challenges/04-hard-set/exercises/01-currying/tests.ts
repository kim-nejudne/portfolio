// Cases adapted from type-challenges #00017, https://github.com/type-challenges/type-challenges/blob/main/questions/00017-hard-currying-1/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import { Currying } from './index';

const curried1 = Currying((a: string, b: number, c: boolean) => true);
const curried2 = Currying(
  (
    a: string,
    b: number,
    c: boolean,
    d: boolean,
    e: boolean,
    f: string,
    g: boolean,
  ) => true,
);
const curried3 = Currying(() => true);
// Added in the dojo: a result that isn't a literal.
const curried4 = Currying((a: number, b: string) => ({ a, b }));

// The original writes the expected types inside the cases; the dojo names them.
type Expected1 = (a: string) => (b: number) => (c: boolean) => true;
type Expected2 = (
  a: string,
) => (
  b: number,
) => (
  c: boolean,
) => (d: boolean) => (e: boolean) => (f: string) => (g: boolean) => true;
type Expected4 = (a: number) => (b: string) => { a: number; b: string };

type cases = [
  Expect<Equal<typeof curried1, Expected1>>, // three parameters
  Expect<Equal<typeof curried2, Expected2>>, // seven parameters
  Expect<Equal<typeof curried3, () => true>>, // no parameters
  Expect<Equal<typeof curried4, Expected4>>, // an object result
];
