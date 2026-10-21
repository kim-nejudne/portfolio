import { basketTotal, type Line } from './index';

const prices = new Map([
  ['apple', 50],
  ['bread', 249],
  ['sample', 0],
]);

const coupons = new Map([
  ['SPRING', 10],
  ['STAFF', 25],
  ['NOTHING', 0],
]);

// 3 * 50 + 2 * 249 = 648
const basket: readonly Line[] = [
  { sku: 'apple', quantity: 3 },
  { sku: 'bread', quantity: 2 },
];

test('an empty basket costs nothing', () => {
  expect(basketTotal([], prices, coupons)).toBe(0);
});

test('each line costs its price times its quantity', () => {
  expect(basketTotal(basket, prices, coupons)).toBe(648);
  expect(basketTotal([{ sku: 'bread', quantity: 1 }], prices, coupons)).toBe(
    249,
  );
});

test('a free sample has a price of 0', () => {
  expect(basketTotal([{ sku: 'sample', quantity: 5 }], prices, coupons)).toBe(
    0,
  );
  expect(
    basketTotal([...basket, { sku: 'sample', quantity: 1 }], prices, coupons),
  ).toBe(648);
});

test('a sku with no price throws', () => {
  const lines: Line[] = [{ sku: 'pear', quantity: 1 }];
  expect(() => basketTotal(lines, prices, coupons)).toThrow(
    'no price for pear',
  );
});

test('a coupon takes its percentage off', () => {
  expect(basketTotal(basket, prices, coupons, 'STAFF')).toBe(486);
});

test('the discounted total is rounded to whole cents', () => {
  // 10% off 648 is 583.2
  expect(basketTotal(basket, prices, coupons, 'SPRING')).toBe(583);
  // 10% off 249 is 224.1
  expect(
    basketTotal([{ sku: 'bread', quantity: 1 }], prices, coupons, 'SPRING'),
  ).toBe(224);
});

test('a coupon worth 0 is still a known coupon', () => {
  expect(basketTotal(basket, prices, coupons, 'NOTHING')).toBe(648);
});

test('an unknown coupon throws', () => {
  expect(() => basketTotal(basket, prices, coupons, 'WINTER')).toThrow(
    'unknown coupon WINTER',
  );
});

test('an empty coupon code is given, and unknown', () => {
  expect(() => basketTotal(basket, prices, coupons, '')).toThrow(
    'unknown coupon',
  );
});

test('without a coupon nothing is taken off', () => {
  expect(basketTotal(basket, prices, coupons, undefined)).toBe(648);
});
