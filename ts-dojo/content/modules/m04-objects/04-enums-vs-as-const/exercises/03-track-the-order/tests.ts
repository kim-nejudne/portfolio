import type { Equal, Expect } from '@dojo/type-utils';
import { labels, next, OrderStatus, parseStatus } from './index';

type cases = [
  Expect<Equal<OrderStatus, 'pending' | 'paid' | 'shipped' | 'cancelled'>>, // OrderStatus is the union of the four values
  Expect<Equal<typeof labels, Record<OrderStatus, string>>>, // labels needs every status
];

test('every status has a label', () => {
  expect(labels).toEqual({
    pending: 'Waiting for payment',
    paid: 'Paid, packing soon',
    shipped: 'On its way',
    cancelled: 'Cancelled',
  });
});

test('a pending order moves on to paid', () => {
  expect(next(OrderStatus.Pending)).toBe('paid');
});

test('a paid order moves on to shipped', () => {
  expect(next('paid')).toBe(OrderStatus.Shipped);
});

test('a shipped order goes no further', () => {
  expect(next('shipped')).toBeUndefined();
});

test('a cancelled order goes no further', () => {
  expect(next(OrderStatus.Cancelled)).toBeUndefined();
});

test('a status next does not know throws', () => {
  expect(() => next('refunded' as never)).toThrow();
});

test('a status value parses to that status', () => {
  expect(parseStatus('shipped')).toBe(OrderStatus.Shipped);
});

test('every value parses to itself', () => {
  for (const status of Object.values(OrderStatus)) {
    expect(parseStatus(status)).toBe(status);
  }
});

test('a member name is not a status', () => {
  expect(parseStatus('Paid')).toBeUndefined();
});

test('an unknown text is not a status', () => {
  expect(parseStatus('lost')).toBeUndefined();
});

test('a name every object inherits is not a status', () => {
  expect(parseStatus('toString')).toBeUndefined();
});
