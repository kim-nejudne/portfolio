// Cases adapted from type-challenges #00089, https://github.com/type-challenges/type-challenges/blob/main/questions/00089-hard-required-keys/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { RequiredKeys } from './index';

type cases = [
  Expect<Equal<RequiredKeys<{ a: number; b?: string }>, 'a'>>, // one of each
  Expect<Equal<RequiredKeys<{ a: undefined; b?: undefined }>, 'a'>>, // undefined values
  Expect<
    Equal<
      RequiredKeys<{ a: undefined; b?: undefined; c: string; d: null }>,
      'a' | 'c' | 'd'
    >
  >, // three required keys
  Expect<Equal<RequiredKeys<{}>, never>>, // no keys
  // Added in the dojo.
  Expect<Equal<RequiredKeys<{ a: unknown; b?: unknown }>, 'a'>>, // unknown values
];
