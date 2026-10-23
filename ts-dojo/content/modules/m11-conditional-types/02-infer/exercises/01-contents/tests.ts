import type { Equal, Expect } from '@dojo/type-utils';
import type { Contents } from './index';

type cases = [
  Expect<Equal<Contents<string[]>, string>>, // an array
  Expect<Equal<Contents<readonly number[]>, number>>, // a readonly array
  Expect<Equal<Contents<unknown[]>, unknown>>, // an array of unknown
  Expect<Equal<Contents<[1, 'a']>, 1 | 'a'>>, // a tuple gives the union of its elements
  Expect<Equal<Contents<readonly ['x', true]>, 'x' | true>>, // a readonly tuple
  Expect<Equal<Contents<[]>, never>>, // an empty tuple holds nothing
  Expect<Equal<Contents<Promise<Date>>, Date>>, // a promise
  Expect<Equal<Contents<Promise<Promise<number>>>, Promise<number>>>, // one promise only
  Expect<Equal<Contents<Promise<string>[]>, Promise<string>>>, // one layer: the array
  Expect<Equal<Contents<Set<'a' | 'b'>>, 'a' | 'b'>>, // a set
  Expect<Equal<Contents<ReadonlySet<number>>, number>>, // a readonly set
  Expect<Equal<Contents<Set<string[]>>, string[]>>, // a set of arrays
  Expect<Equal<Contents<Map<string, Date>>, Date>>, // a map gives its values
  Expect<Equal<Contents<ReadonlyMap<'k', boolean>>, boolean>>, // a readonly map
  Expect<Equal<Contents<Map<number, Set<1>>>, Set<1>>>, // a map of sets
  Expect<Equal<Contents<string>, string>>, // not a container
  Expect<Equal<Contents<{ items: number[] }>, { items: number[] }>>, // an object that holds an array
  Expect<Equal<Contents<null>, null>>, // null
  Expect<Equal<Contents<string[] | Set<number>>, string | number>>, // one answer per member
  Expect<Equal<Contents<Promise<1> | 2>, 1 | 2>>, // a container or not
  Expect<Equal<Contents<never>, never>>, // nothing in, nothing out
];
