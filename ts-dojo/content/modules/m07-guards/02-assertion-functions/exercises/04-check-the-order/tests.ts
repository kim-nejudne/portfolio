import type { Equal, Expect } from '@dojo/type-utils';
import {
  OrderChecker,
  totalQuantity,
  type LineItem,
  type Order,
} from './index';

type cases = [
  Expect<
    Equal<
      OrderChecker['assertLineItem'],
      (value: unknown) => asserts value is LineItem
    >
  >, // assertLineItem is an assertion method for LineItem
  Expect<
    Equal<
      OrderChecker['assertOrder'],
      (value: unknown) => asserts value is Order
    >
  >, // assertOrder is an assertion method for Order
  Expect<
    Equal<typeof totalQuantity, (json: string, checker: OrderChecker) => number>
  >, // totalQuantity takes the text and a checker
];

/** The error that fn throws, or undefined when it returns. */
function thrownBy(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

const ten = new OrderChecker(10);
const three = new OrderChecker(3);

test('assertLineItem returns for every quantity from 1 to maxQuantity', () => {
  for (let quantity = 1; quantity <= 10; quantity++) {
    expect(thrownBy(() => ten.assertLineItem({ sku: 'A1', quantity }))).toBe(
      undefined,
    );
  }
  for (let quantity = 1; quantity <= 3; quantity++) {
    expect(thrownBy(() => three.assertLineItem({ sku: 'B2', quantity }))).toBe(
      undefined,
    );
  }
});

test('assertLineItem throws a TypeError above maxQuantity', () => {
  for (let quantity = 11; quantity <= 15; quantity++) {
    expect(
      thrownBy(() => ten.assertLineItem({ sku: 'A1', quantity })),
    ).toBeInstanceOf(TypeError);
  }
  for (let quantity = 4; quantity <= 10; quantity++) {
    expect(
      thrownBy(() => three.assertLineItem({ sku: 'B2', quantity })),
    ).toBeInstanceOf(TypeError);
  }
});

test('assertLineItem throws a TypeError for anything that is not a line item', () => {
  for (const value of [
    null,
    'A1',
    3,
    [],
    {},
    { sku: 'A1' },
    { quantity: 2 },
    { sku: 7, quantity: 2 },
    { sku: 'A1', quantity: '2' },
    { sku: 'A1', quantity: 0 },
    { sku: 'A1', quantity: -1 },
    { sku: 'A1', quantity: 1.5 },
  ]) {
    expect(thrownBy(() => ten.assertLineItem(value))).toBeInstanceOf(TypeError);
  }
});

test('assertOrder returns for an order, with or without a coupon', () => {
  const items = [
    { sku: 'A1', quantity: 2 },
    { sku: 'B2', quantity: 3 },
  ];
  expect(thrownBy(() => ten.assertOrder({ id: 'o1', items }))).toBe(undefined);
  expect(
    thrownBy(() => ten.assertOrder({ id: 'o2', items, coupon: 'SPRING' })),
  ).toBe(undefined);
  expect(thrownBy(() => ten.assertOrder({ id: 'o3', items: [] }))).toBe(
    undefined,
  );
});

test('assertOrder throws a TypeError for anything that is not an order', () => {
  const items = [{ sku: 'A1', quantity: 2 }];
  for (const value of [
    null,
    'o1',
    [],
    {},
    { items },
    { id: 'o1' },
    { id: 1, items },
    { id: 'o1', items: 'A1' },
    { id: 'o1', items: { sku: 'A1', quantity: 2 } },
    { id: 'o1', items, coupon: 10 },
    { id: 'o1', items, coupon: null },
  ]) {
    expect(thrownBy(() => ten.assertOrder(value))).toBeInstanceOf(TypeError);
  }
});

test('assertOrder checks every item with assertLineItem', () => {
  const good = { sku: 'A1', quantity: 2 };
  expect(
    thrownBy(() =>
      ten.assertOrder({ id: 'o1', items: [good, good, { sku: 'C3' }] }),
    ),
  ).toBeInstanceOf(TypeError);
  expect(
    thrownBy(() =>
      three.assertOrder({
        id: 'o1',
        items: [good, { sku: 'C3', quantity: 4 }],
      }),
    ),
  ).toBeInstanceOf(TypeError);
  expect(
    thrownBy(() =>
      ten.assertOrder({ id: 'o1', items: [good, { sku: 'C3', quantity: 4 }] }),
    ),
  ).toBe(undefined);
});

test('totalQuantity adds up the quantities', () => {
  for (let n = 0; n <= 8; n++) {
    const items = Array.from({ length: n }, (_, i) => ({
      sku: `S${i}`,
      quantity: (i % 3) + 1,
    }));
    const expected = items.reduce((sum, item) => sum + item.quantity, 0);
    expect(totalQuantity(JSON.stringify({ id: `o${n}`, items }), three)).toBe(
      expected,
    );
  }
});

test('totalQuantity uses the checker it is given', () => {
  const order = JSON.stringify({
    id: 'o1',
    items: [
      { sku: 'A1', quantity: 5 },
      { sku: 'B2', quantity: 1 },
    ],
  });
  expect(totalQuantity(order, ten)).toBe(6);
  expect(thrownBy(() => totalQuantity(order, three))).toBeInstanceOf(TypeError);
});

test('totalQuantity throws a TypeError for data that is not an order', () => {
  expect(thrownBy(() => totalQuantity('null', ten))).toBeInstanceOf(TypeError);
  expect(thrownBy(() => totalQuantity('[]', ten))).toBeInstanceOf(TypeError);
  expect(
    thrownBy(() => totalQuantity('{"id":"o1","items":[{"sku":"A1"}]}', ten)),
  ).toBeInstanceOf(TypeError);
});
