import type { Equal, Expect } from '@dojo/type-utils';
import type { DeepRequired } from './index';

interface Account {
  id: number;
  profile?: {
    name?: string;
    address?: { city?: string; zip: string };
  };
}

type Save = (id: number, force?: boolean) => void;

type cases = [
  Expect<
    Equal<
      DeepRequired<Account>,
      {
        id: number;
        profile: { name: string; address: { city: string; zip: string } };
      }
    >
  >, // three levels
  Expect<
    Equal<
      DeepRequired<{ user?: { name?: string } }>,
      { user: { name: string } }
    >
  >, // the prompt's example
  Expect<
    Equal<
      DeepRequired<{ items?: { id?: number }[] }>,
      { items: { id: number }[] }
    >
  >, // an array of objects
  Expect<Equal<DeepRequired<[number, string?]>, [number, string]>>, // a tuple keeps its length
  Expect<Equal<DeepRequired<[{ a?: 1 }]>, [{ a: 1 }]>>, // inside a tuple
  Expect<Equal<DeepRequired<{ onSave?: Save }>, { onSave: Save }>>, // a function is kept
  Expect<Equal<DeepRequired<Save>, Save>>, // a function on its own
  Expect<
    Equal<
      DeepRequired<{ readonly r?: { readonly s?: 1 } }>,
      { readonly r: { readonly s: 1 } }
    >
  >, // readonly stays
  Expect<
    Equal<
      DeepRequired<{ note: string | undefined }>,
      { note: string | undefined }
    >
  >, // never optional
  Expect<
    Equal<
      DeepRequired<{ a?: { b?: 1 } } | { c?: 2 }>,
      { a: { b: 1 } } | { c: 2 }
    >
  >, // a union
  Expect<Equal<DeepRequired<{ a?: 1 } | null>, { a: 1 } | null>>, // null passes through
  Expect<Equal<DeepRequired<string>, string>>, // a primitive
  Expect<Equal<DeepRequired<{}>, {}>>, // nothing to require
  Expect<Equal<DeepRequired<never>, never>>, // no members
];
