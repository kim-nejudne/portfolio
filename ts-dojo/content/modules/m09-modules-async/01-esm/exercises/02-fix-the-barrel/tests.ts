import * as api from './index';
import {
  add,
  format,
  money,
  type Currency,
  type FormatOptions,
  type Money,
} from './index';

const symbol: FormatOptions = { symbol: true };
const code: FormatOptions = { symbol: false };

test('formats with a symbol or a code', () => {
  const price: Money = money(1250, 'EUR');
  expect(format(price, symbol)).toBe('€12.50');
  expect(format(price, code)).toBe('12.50 EUR');
});

test('adds amounts of many sizes in both currencies', () => {
  const currencies: Currency[] = ['EUR', 'USD'];
  for (const currency of currencies) {
    for (let cents = 0; cents <= 2000; cents += 175) {
      expect(add(money(cents, currency), money(99, currency))).toEqual({
        cents: cents + 99,
        currency,
      });
    }
  }
});

test('refuses to add different currencies', () => {
  expect(() => add(money(100, 'EUR'), money(100, 'USD'))).toThrow(
    'cannot add EUR to USD',
  );
});

test('the barrel exports exactly the three functions at run time', () => {
  // Types are erased: they add nothing to the module object. checkCents stays private.
  expect(Object.keys(api).sort()).toEqual(['add', 'format', 'money']);
});
