import type { Equal, Expect } from '@dojo/type-utils';
import type { Lazy } from './index';

type Account = { readonly id: number; tag?: string };

type cases = [
  Expect<
    Equal<
      Lazy<[name: string, age: number]>,
      [name: () => string, age: () => number]
    >
  >, // the prompt's example
  Expect<Equal<Lazy<[1, 2, 3]>, [() => 1, () => 2, () => 3]>>, // a second tuple
  Expect<
    Equal<
      Lazy<readonly [string, boolean]>,
      readonly [() => string, () => boolean]
    >
  >, // a readonly tuple stays readonly
  Expect<
    Equal<
      Lazy<[a: string, b?: number]>,
      [a: () => string, b?: () => number | undefined]
    >
  >, // an optional element stays optional
  Expect<
    Equal<Lazy<[string, ...number[]]>, [() => string, ...(() => number)[]]>
  >, // a rest element
  Expect<Equal<Lazy<[]>, []>>, // the empty tuple
  Expect<Equal<Lazy<number[]>, (() => number)[]>>, // an array
  Expect<Equal<Lazy<readonly string[]>, readonly (() => string)[]>>, // a readonly array
  Expect<
    Equal<
      Lazy<Account>,
      { readonly id: () => number; tag?: () => string | undefined }
    >
  >, // an object keeps its modifiers
  Expect<Equal<Lazy<[boolean] | { a: 1 }>, [() => boolean] | { a: () => 1 }>>, // a union, member by member
  Expect<Equal<Lazy<string>, string>>, // a primitive passes through
  Expect<Equal<Lazy<never>, never>>, // the empty union
];

// @ts-expect-error
const tooLong: Lazy<[string, number]> = [() => 'a', () => 1, () => 2]; // still two cells

// @ts-expect-error
const notAList: Lazy<[string]> = { 0: () => 'a' }; // still an array

// @ts-expect-error
const wrongCell: Lazy<[string, number]> = [() => 'a', () => 'b']; // the second cell is a number

export { tooLong, notAList, wrongCell };
