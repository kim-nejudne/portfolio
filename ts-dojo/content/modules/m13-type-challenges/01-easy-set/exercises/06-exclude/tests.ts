// Cases adapted from type-challenges #00043, https://github.com/type-challenges/type-challenges/blob/main/questions/00043-easy-exclude/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { MyExclude } from './index';

type cases = [
  Expect<Equal<MyExclude<'a' | 'b' | 'c', 'a'>, 'b' | 'c'>>, // one member removed
  Expect<Equal<MyExclude<'a' | 'b' | 'c', 'a' | 'b'>, 'c'>>, // two members removed
  Expect<
    Equal<MyExclude<string | number | (() => void), Function>, string | number>
  >, // a function type removed by Function
];
