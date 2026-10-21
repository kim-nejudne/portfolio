import { contactFor, couponCode, findOrder, type Order } from './index';

const ada: Order = {
  id: 'o1',
  customer: { name: 'Ada', email: 'ada@example.com' },
  coupon: 'spring10',
};
const grace: Order = { id: 'o2', customer: { name: 'Grace' }, coupon: null };
const orders: readonly Order[] = [ada, grace];

// Twenty more orders: even ones have an email, odd ones a coupon.
const generated: readonly Order[] = Array.from({ length: 20 }, (_, n) => ({
  id: `g${String(n)}`,
  customer:
    n % 2 === 0
      ? { name: `name${String(n)}`, email: `c${String(n)}@example.com` }
      : { name: `name${String(n)}` },
  coupon: n % 2 === 1 ? `deal${String(n)}` : null,
}));
const unknownIds = Array.from({ length: 20 }, (_, n) => `x${String(n)}`);

test('findOrder finds an order by id', () => {
  expect(findOrder(orders, 'o1')).toBe(ada);
  expect(findOrder(orders, 'o2')).toBe(grace);
  for (const order of generated) {
    expect(findOrder(generated, order.id)).toBe(order);
  }
});

test('findOrder gives undefined for an unknown id', () => {
  expect(findOrder([], 'o1')).toBeUndefined();
  for (const id of unknownIds) expect(findOrder(orders, id)).toBeUndefined();
});

test('contactFor prefers the email', () => {
  expect(contactFor(orders, 'o1')).toBe('ada@example.com');
  expect(contactFor(generated, 'g4')).toBe('c4@example.com');
});

test('contactFor falls back to the name', () => {
  expect(contactFor(orders, 'o2')).toBe('Grace');
  expect(contactFor(generated, 'g7')).toBe('name7');
});

test('contactFor an unknown order is nobody', () => {
  for (const id of unknownIds) expect(contactFor(orders, id)).toBe('nobody');
});

test('couponCode upper-cases the coupon', () => {
  expect(couponCode(ada)).toBe('SPRING10');
  expect(couponCode(ada, '-')).toBe('SPRING10');
  expect(couponCode(generated[9])).toBe('DEAL9');
});

test('couponCode of an order without a coupon is the fallback', () => {
  expect(couponCode(grace)).toBe('NONE');
  expect(couponCode(grace, '-')).toBe('-');
});

test('couponCode of no order is the fallback', () => {
  expect(couponCode(undefined)).toBe('NONE');
  expect(couponCode(findOrder(orders, 'o9'), 'n/a')).toBe('n/a');
});
