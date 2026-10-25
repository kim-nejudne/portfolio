import type { Equal, Expect } from '@dojo/type-utils';
import { formatPrice } from './index';

type cases = [
  Expect<Equal<typeof formatPrice, (price: unknown) => string>>, // price is still unknown
];

test('a number gets two decimals and the currency', () => {
  expect(formatPrice(4.5)).toBe('4.50 EUR');
});

test('a whole number gets two decimals too', () => {
  expect(formatPrice(12)).toBe('12.00 EUR');
});

test('a word is not a price', () => {
  expect(formatPrice('free')).toBe('price on request');
});

test('a numeric string is not a price either', () => {
  expect(formatPrice('4.5')).toBe('price on request');
});

test('nothing at all is not a price', () => {
  expect(formatPrice(undefined)).toBe('price on request');
});

test('null and true are not prices', () => {
  expect(formatPrice(null)).toBe('price on request');
  expect(formatPrice(true)).toBe('price on request');
});

test('an object or a list is not a price', () => {
  expect(formatPrice({ amount: 4.5 })).toBe('price on request');
  expect(formatPrice([4.5])).toBe('price on request');
});

test('every number gets two decimals', () => {
  for (let cents = 0; cents <= 2000; cents += 37) {
    const price = cents / 100;
    expect(formatPrice(price)).toBe(`${price.toFixed(2)} EUR`);
  }
});
