import type { Expect, ExpectExtends } from '@dojo/type-utils';
import { defaultCurrency, formatPrice, sample, type Currency } from './index';

type cases = [
  Expect<ExpectExtends<Currency, typeof defaultCurrency>>, // defaultCurrency holds a Currency, not any string
];

// @ts-expect-error
const pounds = formatPrice(1, 'GBP'); // GBP is not one of the currencies

test('a number amount', () => {
  expect(formatPrice(5, 'EUR')).toBe('5.00 EUR');
});

test('a numeric string amount', () => {
  expect(formatPrice('3.5', 'SEK')).toBe('3.50 SEK');
});

test('rounds to two decimals', () => {
  expect(formatPrice(19.999, 'USD')).toBe('20.00 USD');
});

test('any amount from 0 to 100, as a number or as a string', () => {
  for (let cents = 0; cents <= 10000; cents += 37) {
    const amount = cents / 100;
    const expected = `${amount.toFixed(2)} USD`;
    expect(formatPrice(amount, 'USD')).toBe(expected);
    expect(formatPrice(String(amount), 'USD')).toBe(expected);
  }
});

test('the sample uses the default currency', () => {
  expect(sample).toBe('5.00 EUR');
});

export { pounds };
