import type { Equal, Expect } from '@dojo/type-utils';
import { addTax, assertIsPrice } from './index';

type cases = [
  Expect<
    Equal<typeof assertIsPrice, (value: unknown) => asserts value is number>
  >, // assertIsPrice is an assertion function for number
  Expect<Equal<typeof addTax, (price: unknown, rate: number) => number>>, // addTax still takes unknown
];

test('assertIsPrice returns for prices', () => {
  for (const price of [0, 0.5, 1, 9.99, 120, 1e6]) {
    expect(() => assertIsPrice(price)).not.toThrow();
  }
});

test('assertIsPrice throws for anything else', () => {
  for (const value of [-1, -0.01, NaN, Infinity, '12', null, undefined, {}]) {
    expect(() => assertIsPrice(value)).toThrow('not a price');
  }
});

test('addTax adds the tax to a price', () => {
  for (let price = 0; price <= 200; price += 12.5) {
    expect(addTax(price, 0.2)).toBeCloseTo(price * 1.2);
    expect(addTax(price, 0.07)).toBeCloseTo(price * 1.07);
  }
});

test('addTax throws for a value that is not a price', () => {
  expect(() => addTax('12', 0.2)).toThrow('not a price');
  expect(() => addTax(-5, 0.2)).toThrow('not a price');
  expect(() => addTax(undefined, 0.2)).toThrow('not a price');
});
