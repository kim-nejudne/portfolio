// Cases adapted from type-challenges #00119, https://github.com/type-challenges/type-challenges/blob/main/questions/00119-medium-replaceall/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { ReplaceAll } from './index';

type cases = [
  Expect<Equal<ReplaceAll<'foobar', 'bar', 'foo'>, 'foofoo'>>, // once
  Expect<Equal<ReplaceAll<'foobar', 'bag', 'foo'>, 'foobar'>>, // From not there
  Expect<Equal<ReplaceAll<'foobarbar', 'bar', 'foo'>, 'foofoofoo'>>, // twice
  Expect<Equal<ReplaceAll<'t y p e s', ' ', ''>, 'types'>>, // every space
  Expect<Equal<ReplaceAll<'foobarbar', '', 'foo'>, 'foobarbar'>>, // an empty From
  Expect<Equal<ReplaceAll<'barfoo', 'bar', 'foo'>, 'foofoo'>>, // at the start
  Expect<Equal<ReplaceAll<'foobarfoobar', 'ob', 'b'>, 'fobarfobar'>>, // To is not searched
  Expect<Equal<ReplaceAll<'foboorfoboar', 'bo', 'b'>, 'foborfobar'>>, // To is not searched, again
  Expect<Equal<ReplaceAll<'', '', ''>, ''>>, // all empty
];
