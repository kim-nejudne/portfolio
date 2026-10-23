// Cases adapted from type-challenges #01097, https://github.com/type-challenges/type-challenges/blob/main/questions/01097-medium-isunion/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { IsUnion } from './index';

// The original writes `string | any`. Explicit `any` is forbidden in every file of a
// type-challenge here, so the case gets its `any` from JSON.parse's return type instead.
type Anything = ReturnType<typeof JSON.parse>;

type cases = [
  Expect<Equal<IsUnion<string>, false>>, // one type
  Expect<Equal<IsUnion<string | number>, true>>, // two types
  Expect<Equal<IsUnion<'a' | 'b' | 'c' | 'd'>, true>>, // four literals
  Expect<Equal<IsUnion<undefined | null | void | ''>, true>>, // undefined, null, void and ''
  Expect<Equal<IsUnion<{ a: string } | { a: number }>, true>>, // two object types
  Expect<Equal<IsUnion<{ a: string | number }>, false>>, // a union inside an object
  Expect<Equal<IsUnion<[string | number]>, false>>, // a union inside a tuple
  // Cases where T resolves to a non-union type.
  Expect<Equal<IsUnion<string | never>, false>>, // never adds nothing
  Expect<Equal<IsUnion<string | unknown>, false>>, // unknown absorbs string
  Expect<Equal<IsUnion<string | Anything>, false>>, // any absorbs string
  Expect<Equal<IsUnion<string | 'a'>, false>>, // 'a' is already a string
  Expect<Equal<IsUnion<never>, false>>, // no members
  // Added in the dojo: boolean is the union true | false.
  Expect<Equal<IsUnion<boolean>, true>>, // boolean
];
