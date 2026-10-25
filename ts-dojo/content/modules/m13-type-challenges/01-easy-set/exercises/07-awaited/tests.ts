// Cases adapted from type-challenges #00189, https://github.com/type-challenges/type-challenges/blob/main/questions/00189-easy-awaited/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { MyAwaited } from './index';

type X = Promise<string>;
type Y = Promise<{ field: number }>;
type Z = Promise<Promise<string | number>>;
type Z1 = Promise<Promise<Promise<string | boolean>>>;
// The original returns `any` from both functions; explicit `any` is forbidden in every file
// of a type-challenge here, so they return `unknown`. The case checks the same thing.
type T = { then: (onfulfilled: (arg: number) => unknown) => unknown };

type cases = [
  Expect<Equal<MyAwaited<X>, string>>, // a promise
  Expect<Equal<MyAwaited<Y>, { field: number }>>, // a promise of an object
  Expect<Equal<MyAwaited<Z>, string | number>>, // a promise of a promise
  Expect<Equal<MyAwaited<Z1>, string | boolean>>, // three levels
  Expect<Equal<MyAwaited<T>, number>>, // a thenable
];
