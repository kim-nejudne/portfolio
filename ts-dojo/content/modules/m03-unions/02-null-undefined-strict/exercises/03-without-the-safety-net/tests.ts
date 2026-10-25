import { cartTotal, quantityOf, unitPrice, type Item } from './index';

const cart: readonly Item[] = [
  { sku: 'apple', quantity: 4 },
  { sku: 'bread', quantity: 1 },
];

// Twenty SKUs the shop doesn't sell, and a cart with one of each.
const unsold = Array.from({ length: 20 }, (_, n) => `sku-${String(n)}`);
const bigCart: readonly Item[] = unsold.map((sku, n) => ({
  sku,
  quantity: n + 1,
}));

test('unitPrice of a SKU the shop sells', () => {
  expect(unitPrice('bread')).toBe(2.25);
  expect(unitPrice('milk')).toBe(1.2);
});

test('unitPrice of a SKU the shop does not sell is 0', () => {
  expect(unitPrice('caviar')).toBe(0);
  for (const sku of unsold) expect(unitPrice(sku)).toBe(0);
});

test('quantityOf a SKU in the cart', () => {
  expect(quantityOf(cart, 'apple')).toBe(4);
  expect(quantityOf(cart, 'bread')).toBe(1);
  unsold.forEach((sku, n) => expect(quantityOf(bigCart, sku)).toBe(n + 1));
});

test('quantityOf a SKU not in the cart is 0', () => {
  expect(quantityOf(cart, 'milk')).toBe(0);
  expect(quantityOf([], 'apple')).toBe(0);
  for (const sku of unsold) expect(quantityOf(cart, sku)).toBe(0);
});

test('cartTotal adds up the cart', () => {
  expect(cartTotal(cart)).toBeCloseTo(4.25);
  expect(cartTotal([])).toBe(0);
});

test('cartTotal: what the shop does not sell costs nothing', () => {
  const withCaviar = [...cart, { sku: 'caviar', quantity: 2 }];
  expect(cartTotal(withCaviar)).toBeCloseTo(4.25);
});
