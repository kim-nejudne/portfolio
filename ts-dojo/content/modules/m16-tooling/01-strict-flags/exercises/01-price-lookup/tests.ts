import type { Equal, Expect } from '@dojo/type-utils';
import { firstItem, priceOf, total } from './index';

type cases = [
  Expect<Equal<ReturnType<typeof priceOf>, number>>, // priceOf returns a number
  Expect<Equal<ReturnType<typeof firstItem>, string | undefined>>, // firstItem may find nothing
];

test('priceOf finds every item the shop sells', () => {
  expect(priceOf('apple')).toBe(1.2);
  expect(priceOf('pear')).toBe(0.9);
  expect(priceOf('plum')).toBe(0.5);
});

test('priceOf throws for an item the shop does not sell', () => {
  expect(() => priceOf('kiwi')).toThrow('unknown item: kiwi');
  expect(() => priceOf('mango')).toThrow('unknown item: mango');
});

test('total adds the prices', () => {
  expect(total(['apple', 'plum', 'plum'])).toBeCloseTo(2.2);
  expect(total([])).toBe(0);
});

test('total throws instead of returning NaN for an unknown item', () => {
  expect(() => total(['apple', 'kiwi'])).toThrow('unknown item: kiwi');
});

test('firstItem returns the first item, or undefined', () => {
  expect(firstItem(['pear', 'apple'])).toBe('pear');
  expect(firstItem([])).toBeUndefined();
});
