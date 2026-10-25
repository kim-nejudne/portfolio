import type { Equal, Expect } from '@dojo/type-utils';
import type { Repeat } from './index';

type cases = [
  Expect<Equal<Repeat<'ab', 3>, 'ababab'>>, // three copies
  Expect<Equal<Repeat<'na', 1>, 'na'>>, // one copy
  Expect<Equal<Repeat<'x', 0>, ''>>, // zero copies
  Expect<Equal<Repeat<'', 4>, ''>>, // an empty string
  Expect<Equal<Repeat<'-=', 5>, '-=-=-=-=-='>>, // five copies
  Expect<Equal<Repeat<'0123456789', 2>, '01234567890123456789'>>, // a longer S
  Expect<Equal<Repeat<'ab', number>, string>>, // plain number
  Expect<
    Equal<
      Repeat<'ab', 60>,
      'abababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab'
    >
  >, // past the nesting limit
];
