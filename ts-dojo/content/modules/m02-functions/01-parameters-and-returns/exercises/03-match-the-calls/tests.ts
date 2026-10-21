import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import { discount, examples, formatPrice, total } from './index';

type cases = [
  Expect<Equal<ExpectValidArgs<typeof formatPrice, []>, false>>, // the amount is still required
  Expect<Equal<ReturnType<typeof discount>, number>>, // discount always returns a number
];

test('every example returns what its comment says', () => {
  expect(examples).toEqual([
    '$9.50',
    '€9.50',
    '€10',
    '$9.50',
    '$0.00',
    '$12.00',
    '$0.00',
  ]);
});

test('formatPrice defaults to dollars and two digits', () => {
  expect(formatPrice(3)).toBe('$3.00');
});

test('formatPrice takes a currency', () => {
  expect(formatPrice(3, '£')).toBe('£3.00');
});

test('formatPrice takes a currency and digits', () => {
  expect(formatPrice(3.14159, '£', 3)).toBe('£3.142');
});

test('total adds any number of prices', () => {
  expect(total(1, 2, 3, 4)).toBe(10);
});

test('total of no prices is 0', () => {
  expect(total()).toBe(0);
});

test('discount is 10% from 100', () => {
  expect(discount(200)).toBeCloseTo(20);
});

test('discount is 5% from 50', () => {
  expect(discount(60)).toBeCloseTo(3);
});

test('discount is 0 below 50', () => {
  expect(discount(49)).toBe(0);
});
