import type { Equal, Expect } from '@dojo/type-utils';
import type { Paths } from './index';

interface Category {
  name: string;
  parent: Category | null;
}

interface Author {
  name: string;
  books: Book[];
  latest: Book;
}

interface Book {
  title: string;
  author: Author;
}

interface Profile {
  user: { name: string; address?: { city: string; zip: string } };
  tags: string[];
  save: () => void;
}

type Deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };

// The 13 paths of up to 13 keys into a Category whose last key is name:
// 'name', 'parent.name', 'parent.parent.name', and so on.
type NameAtDepth<
  N extends unknown[] = [],
  P extends string = 'name',
> = N['length'] extends 13 ? never : P | NameAtDepth<[...N, 0], `parent.${P}`>;

// A generated chain: a value, and the next link under the key K. (One key per
// link: with two, the Paths of 11.4 runs for over a minute before it gives up.)
type Chain<K extends string> = { value: number } & { [P in K]: Chain<K> };

// Its expected paths, built step by step: every run of K keys, of at most
// Max keys, that ends in K or in 'value'.
type ChainPaths<
  K extends string,
  Max extends number,
  N extends unknown[] = [],
  Prefix extends string = '',
> = N['length'] extends Max
  ? never
  : `${Prefix}${K | 'value'}` | ChainPaths<K, Max, [...N, 0], `${Prefix}${K}.`>;

type casesGenerated = [
  Expect<Equal<Paths<Chain<'next'>, 3>, ChainPaths<'next', 3>>>, // a chain under next, three keys
  Expect<Equal<Paths<Chain<'child'>, 5>, ChainPaths<'child', 5>>>, // a chain under child, five keys
  Expect<Equal<Paths<Chain<'link'>>, ChainPaths<'link', 4>>>, // the default of four keys
];

type casesNoLimitNeeded = [
  Expect<
    Equal<
      Paths<Profile>,
      | 'user'
      | 'user.name'
      | 'user.address'
      | 'user.address.city'
      | 'user.address.zip'
      | 'tags'
      | 'save'
    >
  >, // 11.4's example, all inside the limit
  Expect<Equal<Paths<string>, never>>, // a primitive has no paths
];

type casesLimit = [
  Expect<Equal<Paths<Deep>, 'a' | 'a.b' | 'a.b.c' | 'a.b.c.d'>>, // four keys by default
  Expect<Equal<Paths<Deep, 2>, 'a' | 'a.b'>>, // two keys
  Expect<Equal<Paths<Deep, 0>, never>>, // no keys at all
  Expect<
    Equal<
      Paths<Category, 3>,
      | 'name'
      | 'parent'
      | 'parent.name'
      | 'parent.parent'
      | 'parent.parent.name'
      | 'parent.parent.parent'
    >
  >, // a type that refers to itself stops after three keys
  Expect<
    Equal<
      Paths<Author>,
      | 'name'
      | 'books'
      | 'latest'
      | 'latest.title'
      | 'latest.author'
      | 'latest.author.name'
      | 'latest.author.books'
      | 'latest.author.latest'
      | 'latest.author.latest.title'
      | 'latest.author.latest.author'
    >
  >, // two types that refer to each other
  Expect<Equal<Extract<Paths<Category, 13>, `${string}name`>, NameAtDepth>>, // thirteen keys deep
];

// @ts-expect-error
const tooDeep: Paths<Category, 3> = 'parent.parent.parent.name'; // four keys

export { tooDeep };
