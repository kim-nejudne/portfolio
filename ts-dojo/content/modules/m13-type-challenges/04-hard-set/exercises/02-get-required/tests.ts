// Cases adapted from type-challenges #00057, https://github.com/type-challenges/type-challenges/blob/main/questions/00057-hard-get-required/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { GetRequired } from './index';

type cases = [
  Expect<Equal<GetRequired<{ foo: number; bar?: string }>, { foo: number }>>, // one of each
  Expect<
    Equal<GetRequired<{ foo: undefined; bar?: undefined }>, { foo: undefined }>
  >, // undefined, required and optional
  // Added in the dojo.
  Expect<Equal<GetRequired<{ readonly a: 1; b?: 2 }>, { readonly a: 1 }>>, // readonly is kept
  Expect<Equal<GetRequired<{ a: unknown; b?: unknown }>, { a: unknown }>>, // unknown, required and optional
  Expect<Equal<GetRequired<{}>, {}>>, // no properties
];
