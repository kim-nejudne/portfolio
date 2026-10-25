// Cases adapted from type-challenges #00116, https://github.com/type-challenges/type-challenges/blob/main/questions/00116-medium-replace/README.md
// MIT License, Copyright (c) 2020 Anthony Fu <https://github.com/antfu>
import type { Equal, Expect } from '@dojo/type-utils';
import type { Replace } from './index';

type cases = [
  Expect<Equal<Replace<'foobar', 'bar', 'foo'>, 'foofoo'>>, // at the end
  Expect<Equal<Replace<'foobarbar', 'bar', 'foo'>, 'foofoobar'>>, // only the first
  Expect<Equal<Replace<'foobarbar', '', 'foo'>, 'foobarbar'>>, // an empty From
  Expect<Equal<Replace<'foobarbar', 'bar', ''>, 'foobar'>>, // an empty To
  Expect<Equal<Replace<'foobarbar', 'bra', 'foo'>, 'foobarbar'>>, // From not there
  Expect<Equal<Replace<'', '', ''>, ''>>, // all empty
];
