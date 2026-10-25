import type { Equal, Expect } from '@dojo/type-utils';
import { formatPrice } from './index';

type cases = [
  Expect<Equal<formatPrice.Options, { currency: string; decimals: number }>>, // the options type
  Expect<Equal<typeof formatPrice.defaults, formatPrice.Options>>, // the defaults are options
  Expect<
    Equal<
      Parameters<typeof formatPrice>,
      [cents: number, options?: formatPrice.Options]
    >
  >, // formatPrice takes cents and optional options
];

test('formats with the defaults', () => {
  expect(formatPrice.defaults).toEqual({ currency: 'EUR', decimals: 2 });
  expect(formatPrice(450)).toBe('4.50 EUR');
  expect(formatPrice(5)).toBe('0.05 EUR');
  expect(formatPrice(129900)).toBe('1299.00 EUR');
});

test('formats with options of its own', () => {
  expect(formatPrice(129900, { currency: 'SEK', decimals: 0 })).toBe(
    '1299 SEK',
  );
  expect(formatPrice(1250, { currency: 'USD', decimals: 1 })).toBe('12.5 USD');
});
