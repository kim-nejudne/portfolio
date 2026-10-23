import type { Equal, Expect } from '@dojo/type-utils';
import { t, use, type MessageKey, type Register } from './i18n';
import { cartLabel, en, sv } from './app';

type cases = [
  Expect<Equal<Register['messages'], typeof en>>, // Register holds the type of en
  Expect<Equal<MessageKey, 'cart.empty' | 'cart.one' | 'cart.many'>>, // t takes en's keys
  Expect<Equal<keyof typeof sv, MessageKey>>, // sv has every key and no other
];

// @ts-expect-error
const typo = () => t('cart.emty'); // a misspelt key is an error

// @ts-expect-error
const partial = () => use({ 'cart.empty': 'Leer' }); // a catalog needs every key

export { typo, partial };

test('labels the cart in English', () => {
  use(en);
  expect(cartLabel(0)).toBe('Your cart is empty');
  expect(cartLabel(1)).toBe('One item in your cart');
  for (let count = 2; count <= 40; count += 7) {
    expect(cartLabel(count)).toBe(`${count} items in your cart`);
  }
});

test('labels the cart in Swedish', () => {
  use(sv);
  expect(cartLabel(0)).toBe('Din varukorg är tom');
  expect(cartLabel(1)).toBe('En vara i din varukorg');
  for (let count = 2; count <= 40; count += 7) {
    expect(cartLabel(count)).toBe(`${count} varor i din varukorg`);
  }
});

test('follows whichever catalog is in use', () => {
  use({ 'cart.empty': 'E', 'cart.one': 'O', 'cart.many': 'M{count}' });
  expect([cartLabel(0), cartLabel(1), cartLabel(3)]).toEqual(['E', 'O', 'M3']);
});
