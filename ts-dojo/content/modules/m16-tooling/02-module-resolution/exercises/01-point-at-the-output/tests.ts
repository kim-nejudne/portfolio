import { priceLine } from './index';

test('a price without a discount', () => {
  expect(priceLine('Tea', 450, 0)).toBe('Tea: 4.50 EUR');
});

test('a price with a discount', () => {
  expect(priceLine('Coffee', 1000, 25)).toBe('Coffee: 7.50 EUR');
});

test('a discount that rounds to whole cents', () => {
  expect(priceLine('Cake', 999, 10)).toBe('Cake: 8.99 EUR');
});
