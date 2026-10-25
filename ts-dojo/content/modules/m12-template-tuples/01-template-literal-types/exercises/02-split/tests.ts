import type { Equal, Expect } from '@dojo/type-utils';
import type { Split } from './index';

type cases = [
  Expect<Equal<Split<'a,b,c', ','>, ['a', 'b', 'c']>>, // three pieces
  Expect<Equal<Split<'a', ','>, ['a']>>, // no delimiter: one piece
  Expect<Equal<Split<'2026-10-23', '-'>, ['2026', '10', '23']>>, // a date
  Expect<Equal<Split<'red green blue', ' '>, ['red', 'green', 'blue']>>, // words
  Expect<Equal<Split<'one :: two :: three', ' :: '>, ['one', 'two', 'three']>>, // a longer delimiter
  Expect<Equal<Split<'a.b', ','>, ['a.b']>>, // another delimiter is just text
  Expect<Equal<Split<'', ','>, ['']>>, // the empty string is one empty piece
  Expect<Equal<Split<',a,', ','>, ['', 'a', '']>>, // empty pieces at both ends
  Expect<Equal<Split<'a,,b', ','>, ['a', '', 'b']>>, // an empty piece in the middle
  Expect<Equal<Split<'x/y' | 'z', '/'>, ['x', 'y'] | ['z']>>, // each member of a union
  Expect<Equal<Split<string, ','>, string[]>>, // a plain string
  Expect<Equal<Split<`${number}-${number}`, '-'>, [`${number}`, `${number}`]>>, // a pattern, cut at its literal text
];

// @ts-expect-error
const tooFew: Split<'a,b,c', ','> = ['a', 'b']; // three pieces, not two

// @ts-expect-error
const unsplit: Split<'a,b', ','> = ['a,b']; // the comma splits

export { tooFew, unsplit };
