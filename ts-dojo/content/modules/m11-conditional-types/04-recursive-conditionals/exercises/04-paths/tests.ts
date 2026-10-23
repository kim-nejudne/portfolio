import type { Equal, Expect } from '@dojo/type-utils';
import type { Paths } from './index';

interface Profile {
  user: { name: string; address?: { city: string; zip: string } };
  tags: string[];
  save: () => void;
}

type ProfilePaths =
  | 'user'
  | 'user.name'
  | 'user.address'
  | 'user.address.city'
  | 'user.address.zip'
  | 'tags'
  | 'save';

type cases = [
  Expect<Equal<Paths<Profile>, ProfilePaths>>, // the prompt's example
  Expect<
    Equal<
      Paths<{ a: { b: { c: { d: 1 } } } }>,
      'a' | 'a.b' | 'a.b.c' | 'a.b.c.d'
    >
  >, // four levels
  Expect<Equal<Paths<{ a: { b: 1 } | null }>, 'a' | 'a.b'>>, // through null
  Expect<Equal<Paths<{ readonly a?: { readonly b?: 1 } }>, 'a' | 'a.b'>>, // readonly and optional
  Expect<Equal<Paths<{ list: { id: number }[] }>, 'list'>>, // an array is a leaf
  Expect<Equal<Paths<{ on: (e: { x: number }) => void }>, 'on'>>, // a function is a leaf
  Expect<Equal<Paths<{ a: { x: 1 } } | { b: 2 }>, 'a' | 'a.x' | 'b'>>, // a union of objects
  Expect<Equal<Paths<{ 0: string; name: string }>, 'name'>>, // string keys only
  Expect<Equal<Paths<{}>, never>>, // no keys
  Expect<Equal<Paths<string>, never>>, // a primitive
  Expect<Equal<Paths<string[]>, never>>, // an array
  Expect<Equal<Paths<() => void>, never>>, // a function
  Expect<Equal<Paths<never>, never>>, // no members
];

// @ts-expect-error
const typo: Paths<Profile> = 'user.nmae'; // a misspelt key

// @ts-expect-error
const unfinished: Paths<Profile> = 'user.'; // a path ends with a key

// @ts-expect-error
const intoArray: Paths<Profile> = 'tags.length'; // nothing below an array

export { typo, unfinished, intoArray };
