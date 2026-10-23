import type { Equal, Expect } from '@dojo/type-utils';
import { Database, cheap, shop, type Order, type Product } from './index';

type Item = { n: number; even: boolean; label: string };
const items = Array.from({ length: 20 }, (_, n) => ({
  n,
  even: n % 2 === 0,
  label: `item ${n}`,
}));
const store = new Database<{ items: Item }>({ items });

const big = store.from('items').where('n', '>', 14).select('label').run();
const open = shop.from('orders').where('customer', '=', null).run();

type cases = [
  Expect<Equal<typeof cheap, Pick<Product, 'sku' | 'price'>[]>>, // the selected columns
  Expect<Equal<typeof big, Pick<Item, 'label'>[]>>, // where keeps the output
  Expect<Equal<typeof open, Order[]>>, // no select: every column
];

// @ts-expect-error
const colour = () => shop.from('products').select('colour'); // not a column

// @ts-expect-error
const total = () => shop.from('orders').where('total', '>', 1); // nor is this

// @ts-expect-error
const textPrice = () => shop.from('products').where('price', '<', '10'); // price is a number

// @ts-expect-error
const numericSku = () => shop.from('orders').where('sku', '=', 42); // sku is a string

// @ts-expect-error
const flagged = () => store.from('items').where('even', '=', 'yes'); // even is a boolean

export { colour, total, textPrice, numericSku, flagged };

test('cheap has the selected columns of the cheap products', () => {
  expect(cheap).toEqual([
    { sku: 'P-1', price: 2 },
    { sku: 'P-2', price: 6 },
  ]);
});

test('where tests a column the select leaves out', () => {
  expect(big.map((row) => row.label)).toEqual(
    items.filter((item) => item.n > 14).map((item) => item.label),
  );
});

test('filters add up', () => {
  for (let limit = 0; limit < 20; limit += 4) {
    const rows = store
      .from('items')
      .where('even', '=', true)
      .where('n', '<', limit)
      .select('n')
      .run();
    expect(rows).toEqual(
      items
        .filter((item) => item.even && item.n < limit)
        .map((item) => ({ n: item.n })),
    );
  }
});

test('null is a value like any other', () => {
  expect(open).toEqual([{ id: 2, sku: 'P-3', quantity: 1, customer: null }]);
});
