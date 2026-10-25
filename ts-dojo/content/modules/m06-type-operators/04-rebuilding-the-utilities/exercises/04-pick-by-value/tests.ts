import type { Equal, Expect } from '@dojo/type-utils';
import type { KeysOfType, PickByValue } from './index';

type Product = {
  readonly id: number;
  name: string;
  price: number;
  description?: string;
  tags: string[];
  discontinued: boolean;
  supplier: string | null;
};

type cases = [
  Expect<Equal<KeysOfType<Product, number>, 'id' | 'price'>>, // the number keys, and no undefined
  Expect<Equal<KeysOfType<Product, string>, 'name'>>, // only the properties that are exactly strings
  Expect<
    Equal<KeysOfType<Product, string | undefined>, 'name' | 'description'>
  >, // optional strings too
  Expect<Equal<KeysOfType<Product, string | null>, 'name' | 'supplier'>>, // nullable strings too
  Expect<Equal<KeysOfType<Product, boolean>, 'discontinued'>>, // the one boolean
  Expect<Equal<KeysOfType<Product, Date>, never>>, // no Date properties
  Expect<Equal<KeysOfType<Product, unknown>, keyof Product>>, // everything fits unknown
  Expect<Equal<KeysOfType<{ a: 1; b: 2; c: 1 }, 1>, 'a' | 'c'>>, // works for any type
  Expect<
    Equal<PickByValue<Product, number>, { readonly id: number; price: number }>
  >, // the number properties, readonly kept
  Expect<
    Equal<
      PickByValue<Product, string | undefined>,
      { name: string; description?: string }
    >
  >, // the optional property stays optional
  Expect<Equal<PickByValue<Product, boolean>, { discontinued: boolean }>>, // one property
  Expect<Equal<PickByValue<Product, Date>, {}>>, // nothing fits
];

// @ts-expect-error
const nameKey: KeysOfType<Product, number> = 'name'; // name is a string

const priced: PickByValue<Product, number> = { id: 1, price: 450 };

// @ts-expect-error
const named: PickByValue<Product, number> = { id: 1, price: 450, name: 'Tea' }; // no name

// @ts-expect-error
priced.id = 2; // id is still read-only

export { nameKey, priced, named };
