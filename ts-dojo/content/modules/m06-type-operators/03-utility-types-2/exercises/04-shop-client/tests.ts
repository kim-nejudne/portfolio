import type { Equal, Expect } from '@dojo/type-utils';
import {
  applyCoupon,
  nextStatus,
  receipt,
  total,
  type Coupon,
  type MoneyOptions,
  type OpenStatus,
  type Order,
  type Status,
} from './index';

type cases = [
  Expect<
    Equal<
      Order,
      {
        id: string;
        status: 'cart' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
        lines: { sku: string; qty: number; unitCents: number }[];
        coupon: { code: string; percentOff: number } | null;
      }
    >
  >, // an order is what fetchOrder resolves to
  Expect<
    Equal<Status, 'cart' | 'paid' | 'shipped' | 'delivered' | 'cancelled'>
  >, // every status
  Expect<Equal<OpenStatus, 'cart' | 'paid' | 'shipped'>>, // the statuses that can move on
  Expect<Equal<Coupon, { code: string; percentOff: number }>>, // a coupon is never null
  Expect<
    Equal<MoneyOptions, { currency: 'EUR' | 'USD' | 'GBP'; withCode?: boolean }>
  >, // the options of formatCents
  Expect<Equal<Parameters<typeof nextStatus>, [status: OpenStatus]>>, // nextStatus takes an open status
  Expect<Equal<ReturnType<typeof total>, number>>, // total is a number of cents
];

const tea: Order = {
  id: 'A-1',
  status: 'paid',
  lines: [
    { sku: 'TEA-01', qty: 2, unitCents: 450 },
    { sku: 'MUG-02', qty: 1, unitCents: 1250 },
  ],
  coupon: null,
};

// @ts-expect-error
const afterDelivered = () => nextStatus('delivered'); // a delivered order doesn't move on

// @ts-expect-error
const afterCancelled = () => nextStatus('cancelled'); // nor does a cancelled one

// @ts-expect-error
const noCoupon = () => applyCoupon(tea, null); // applyCoupon needs a coupon

// @ts-expect-error
const yen = () => receipt(tea, { currency: 'JPY' }); // formatCents has no yen

const welcome: Coupon = { code: 'WELCOME10', percentOff: 10 };

function orderOf(qty: number, unitCents: number, percentOff: number): Order {
  return {
    id: `O-${qty}-${unitCents}-${percentOff}`,
    status: 'cart',
    lines: [
      { sku: 'A', qty, unitCents },
      { sku: 'B', qty: 1, unitCents: unitCents + 1 },
    ],
    coupon: percentOff === 0 ? null : { code: 'C', percentOff },
  };
}

test('total adds up every line', () => {
  expect(total(tea)).toBe(2150);
  expect(total({ ...tea, lines: [] })).toBe(0);
});

test('total takes the coupon off, rounded to a cent', () => {
  expect(total({ ...tea, coupon: welcome })).toBe(1935);
  expect(total({ ...tea, coupon: { code: 'THIRD', percentOff: 33 } })).toBe(
    1440,
  );
  for (let qty = 0; qty <= 6; qty += 1) {
    for (const unitCents of [1, 99, 450, 1999]) {
      for (const percentOff of [0, 5, 10, 15, 33, 50, 100]) {
        const sum = qty * unitCents + unitCents + 1;
        expect(total(orderOf(qty, unitCents, percentOff))).toBe(
          sum - Math.round((sum * percentOff) / 100),
        );
      }
    }
  }
});

test('nextStatus moves an open order on by one step', () => {
  expect(nextStatus('cart')).toBe('paid');
  expect(nextStatus('paid')).toBe('shipped');
  expect(nextStatus('shipped')).toBe('delivered');
});

test('nextStatus throws for a status the types do not allow', () => {
  // JSON.parse returns any, so these compile although none of them is an OpenStatus.
  for (const status of ['delivered', 'cancelled', 'lost']) {
    const parsed: OpenStatus = JSON.parse(JSON.stringify(status));
    expect(() => nextStatus(parsed)).toThrow();
  }
});

test('applyCoupon returns a copy with the coupon', () => {
  const discounted = applyCoupon(tea, welcome);
  expect(discounted).toEqual({ ...tea, coupon: welcome });
  expect(discounted).not.toBe(tea);
  expect(tea.coupon).toBeNull();
  const replaced = applyCoupon(discounted, { code: 'HALF', percentOff: 50 });
  expect(replaced.coupon).toEqual({ code: 'HALF', percentOff: 50 });
  expect(discounted.coupon).toEqual(welcome);
});

test('receipt shows the id and the formatted total', () => {
  expect(receipt(tea, { currency: 'EUR' })).toBe('A-1: €21.50');
  expect(receipt(tea, { currency: 'USD', withCode: true })).toBe(
    'A-1: $21.50 USD',
  );
  expect(receipt(applyCoupon(tea, welcome), { currency: 'GBP' })).toBe(
    'A-1: £19.35',
  );
  for (let qty = 1; qty <= 5; qty += 1) {
    const order = orderOf(qty, 250, 20);
    const cents = total(order);
    expect(receipt(order, { currency: 'EUR' })).toBe(
      `${order.id}: €${(cents / 100).toFixed(2)}`,
    );
  }
});

export { afterDelivered, afterCancelled, noCoupon, yen };
