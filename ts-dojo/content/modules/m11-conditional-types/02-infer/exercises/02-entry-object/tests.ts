import type { Equal, Expect } from '@dojo/type-utils';
import type { EntryObject } from './index';

declare const tag: unique symbol;

type cases = [
  Expect<Equal<EntryObject<['id', number]>, { id: number }>>, // a string key
  Expect<Equal<EntryObject<readonly ['name', 'Ada']>, { name: 'Ada' }>>, // a readonly pair, as from as const
  Expect<Equal<EntryObject<[0, 'zero']>, { 0: 'zero' }>>, // a number key
  Expect<Equal<EntryObject<[typeof tag, true]>, { [tag]: true }>>, // a symbol key
  Expect<Equal<EntryObject<['a' | 'b', boolean]>, { a: boolean; b: boolean }>>, // a union of keys
  Expect<Equal<EntryObject<[string, number]>, { [key: string]: number }>>, // any string key
  Expect<Equal<EntryObject<['a', 1] | ['b', 2]>, { a: 1 } | { b: 2 }>>, // one answer per pair
  Expect<Equal<EntryObject<[true, 1]>, never>>, // a boolean can't be a key
  Expect<Equal<EntryObject<[{ id: 1 }, 1]>, never>>, // nor can an object
  Expect<Equal<EntryObject<['id']>, never>>, // no value
  Expect<Equal<EntryObject<['a', 1, 2]>, never>>, // one element too many
  Expect<Equal<EntryObject<string[]>, never>>, // an array is not a pair
  Expect<Equal<EntryObject<'id'>, never>>, // a key alone
  Expect<Equal<EntryObject<never>, never>>, // nothing in, nothing out
];

// @ts-expect-error
const wrong: EntryObject<['id', number]> = { id: '1' }; // the value type is kept

export { wrong };
