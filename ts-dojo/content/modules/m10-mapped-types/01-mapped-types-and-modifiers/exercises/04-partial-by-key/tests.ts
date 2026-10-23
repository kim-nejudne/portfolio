import type { Equal, Expect } from '@dojo/type-utils';
import type { PartialBy, RequiredBy } from './index';

type User = {
  readonly id: number;
  name: string;
  email?: string;
  bio?: string;
};

type Product = { readonly sku: string; price: number; discount?: number };

type cases = [
  Expect<
    Equal<
      PartialBy<User, 'name'>,
      { readonly id: number; name?: string; email?: string; bio?: string }
    >
  >, // one key becomes optional
  Expect<
    Equal<
      PartialBy<User, 'id' | 'name'>,
      { readonly id?: number; name?: string; email?: string; bio?: string }
    >
  >, // several keys, and readonly kept on a key made optional
  Expect<
    Equal<
      PartialBy<User, keyof User>,
      { readonly id?: number; name?: string; email?: string; bio?: string }
    >
  >, // every key
  Expect<
    Equal<
      PartialBy<User, never>,
      { readonly id: number; name: string; email?: string; bio?: string }
    >
  >, // no key: nothing changes
  Expect<
    Equal<
      PartialBy<User, 'email'>,
      { readonly id: number; name: string; email?: string; bio?: string }
    >
  >, // a key that is optional already
  Expect<
    Equal<
      PartialBy<Product, 'price'>,
      { readonly sku: string; price?: number; discount?: number }
    >
  >, // a second type
  Expect<Equal<PartialBy<{}, never>, {}>>, // no properties at all
  Expect<
    Equal<
      RequiredBy<User, 'email'>,
      { readonly id: number; name: string; email: string; bio?: string }
    >
  >, // one key becomes required, without undefined
  Expect<
    Equal<
      RequiredBy<User, 'id' | 'email' | 'bio'>,
      { readonly id: number; name: string; email: string; bio: string }
    >
  >, // several keys, readonly kept
  Expect<
    Equal<
      RequiredBy<User, never>,
      { readonly id: number; name: string; email?: string; bio?: string }
    >
  >, // no key: nothing changes
  Expect<
    Equal<
      RequiredBy<Product, 'discount'>,
      { readonly sku: string; price: number; discount: number }
    >
  >, // a second type
  Expect<
    Equal<
      RequiredBy<{ a?: string | undefined; b?: 1 }, 'a'>,
      { a: string; b?: 1 }
    >
  >, // the undefined of a ? goes, even when written out
];

// @ts-expect-error
type NoAge = PartialBy<User, 'age'>; // User has no age

// @ts-expect-error
type NoColour = RequiredBy<Product, 'colour'>; // Product has no colour

const draft: PartialBy<User, 'name'> = { id: 1 };

// @ts-expect-error
const noId: PartialBy<User, 'name'> = { name: 'Ada' }; // id is still required

// @ts-expect-error
draft.id = 2; // id is still read-only

export type { NoAge, NoColour };
export { draft, noId };
