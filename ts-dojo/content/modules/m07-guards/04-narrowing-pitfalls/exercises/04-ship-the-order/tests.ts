import type { Equal, Expect } from '@dojo/type-utils';
import {
  canShip,
  itemLines,
  orderTotal,
  type ItemLine,
  type Line,
  type Product,
  type Stock,
} from './index';

type cases = [
  Expect<Equal<ReturnType<typeof itemLines>, ItemLine[]>>, // itemLines returns item lines only
  Expect<
    Equal<typeof canShip, (lines: readonly Line[], stock: Stock) => boolean>
  >, // canShip keeps its signature
  Expect<
    Equal<
      typeof orderTotal,
      (catalog: readonly Product[], lines: readonly Line[]) => number
    >
  >, // orderTotal keeps its signature
];

const catalog: Product[] = [
  { sku: 'tea', name: 'Green tea', price: 4 },
  { sku: 'cup', name: 'Cup', price: 10 },
  { sku: 'pot', name: 'Teapot', price: 25 },
];

const item = (sku: string, quantity: number): Line => ({
  kind: 'item',
  sku,
  quantity,
});
const discount = (code: string, percent: number): Line => ({
  kind: 'discount',
  code,
  percent,
});

test('itemLines keeps the item lines in order', () => {
  const lines = [
    item('tea', 2),
    discount('SPRING', 10),
    item('cup', 1),
    discount('VIP', 5),
    item('pot', 3),
  ];
  expect(itemLines(lines)).toEqual([
    item('tea', 2),
    item('cup', 1),
    item('pot', 3),
  ]);
  expect(itemLines([discount('A', 1)])).toEqual([]);
  expect(itemLines([])).toEqual([]);
});

test('canShip is true when every item has enough stock', () => {
  expect(canShip([item('tea', 2), item('cup', 1)], { tea: 2, cup: 5 })).toBe(
    true,
  );
  expect(canShip([], {})).toBe(true);
  expect(canShip([discount('SPRING', 10)], {})).toBe(true);
});

test('canShip compares each count with its quantity', () => {
  for (let units = 0; units <= 6; units++) {
    for (let quantity = 1; quantity <= 6; quantity++) {
      const lines = [item('cup', 1), item('tea', quantity)];
      expect(canShip(lines, { cup: 1, tea: units })).toBe(units >= quantity);
    }
  }
});

test('canShip is false when a sku was never counted', () => {
  expect(canShip([item('tea', 1)], {})).toBe(false);
  expect(canShip([item('tea', 1), item('pot', 1)], { tea: 9 })).toBe(false);
  expect(canShip([item('tea', 1)], { tea: undefined })).toBe(false);
  expect(canShip([item('tea', 0)], {})).toBe(false);
});

test('orderTotal adds price times quantity', () => {
  expect(orderTotal(catalog, [item('tea', 2), item('cup', 1)])).toBe(18);
  expect(orderTotal(catalog, [])).toBe(0);
  for (let quantity = 1; quantity <= 5; quantity++) {
    expect(orderTotal(catalog, [item('pot', quantity)])).toBe(25 * quantity);
  }
});

test('orderTotal applies each discount in turn', () => {
  expect(
    orderTotal(catalog, [item('cup', 2), discount('SPRING', 10)]),
  ).toBeCloseTo(18);
  expect(
    orderTotal(catalog, [
      discount('VIP', 50),
      item('pot', 4),
      discount('SPRING', 10),
    ]),
  ).toBeCloseTo(45);
  expect(
    orderTotal(catalog, [item('tea', 1), discount('ALL', 100)]),
  ).toBeCloseTo(0);
});

test('orderTotal throws for a sku that is not in the catalog', () => {
  expect(() => orderTotal(catalog, [item('tea', 1), item('mug', 2)])).toThrow(
    'unknown sku: mug',
  );
  expect(() => orderTotal([], [item('tea', 1)])).toThrow('unknown sku: tea');
});
