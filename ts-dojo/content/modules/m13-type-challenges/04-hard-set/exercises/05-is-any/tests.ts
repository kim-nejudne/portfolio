// Cases adapted from type-challenges #00223, https://github.com/type-challenges/type-challenges/blob/main/questions/00223-hard-isany/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { IsAny } from './index';

// The original writes `IsAny<any>`. Explicit `any` is forbidden in every file of a
// type-challenge here, so the case gets its `any` from JSON.parse's return type instead.
type Anything = ReturnType<typeof JSON.parse>;

type cases = [
  Expect<Equal<IsAny<Anything>, true>>, // any

  Expect<Equal<IsAny<undefined>, false>>, // undefined
  Expect<Equal<IsAny<unknown>, false>>, // unknown
  Expect<Equal<IsAny<never>, false>>, // never
  Expect<Equal<IsAny<string>, false>>, // string
  // Added in the dojo.
  Expect<Equal<IsAny<object>, false>>, // object
  Expect<Equal<IsAny<Anything[]>, false>>, // an array of any
  Expect<Equal<IsAny<string | Anything>, true>>, // any absorbs string
];
