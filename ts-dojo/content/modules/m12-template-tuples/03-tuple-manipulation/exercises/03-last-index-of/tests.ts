import type { Equal, Expect } from '@dojo/type-utils';
import type { LastIndexOf } from './index';

type cases = [
  Expect<Equal<LastIndexOf<[1, 2, 3, 2], 2>, 3>>, // the last of two
  Expect<Equal<LastIndexOf<[2, 1, 1, 3], 2>, 0>>, // at the front
  Expect<Equal<LastIndexOf<['a', 'b', 'a', 'c'], 'a'>, 2>>, // strings, not at the end
  Expect<Equal<LastIndexOf<[1, 2, 3], 3>, 2>>, // at the end
  Expect<Equal<LastIndexOf<[1, 2, 3], 4>, -1>>, // not there
  Expect<Equal<LastIndexOf<[], 1>, -1>>, // the empty tuple
  Expect<Equal<LastIndexOf<readonly [0, 0, 1], 0>, 1>>, // a readonly tuple
  Expect<Equal<LastIndexOf<[string], 'a'>, -1>>, // a literal is not string
  Expect<Equal<LastIndexOf<['a', string], string>, 1>>, // string is string
  Expect<Equal<LastIndexOf<[boolean], true>, -1>>, // true is not boolean
  Expect<Equal<LastIndexOf<[true, false, boolean, true], boolean>, 2>>, // boolean is boolean
  Expect<Equal<LastIndexOf<[1 | 2, 1, 2], 1 | 2>, 0>>, // a union element
  Expect<Equal<LastIndexOf<[1, 2], 1 | 2>, -1>>, // a union U is not each member
  Expect<Equal<LastIndexOf<[{ a: 1 }, { readonly a: 1 }], { a: 1 }>, 0>>, // readonly matters
  Expect<Equal<LastIndexOf<[unknown, 1], unknown>, 0>>, // unknown
  Expect<Equal<LastIndexOf<[never, 1], never>, 0>>, // never
  Expect<Equal<LastIndexOf<[1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2], 1>, 9>>, // a longer tuple
];
