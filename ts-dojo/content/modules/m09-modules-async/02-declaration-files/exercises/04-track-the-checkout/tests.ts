import type { Equal, Expect } from '@dojo/type-utils';
import type { EventMap, Tracker } from 'analytics-lite';
import { checkout, type CartLine } from './checkout';

type cases = [
  Expect<Equal<typeof globalThis.tracker, Tracker>>, // globalThis.tracker is a Tracker
  Expect<Equal<EventMap['purchase'], { sku: string; total: number }>>, // the purchase event
  Expect<Equal<EventMap['pageview'], { path: string }>>, // the pageview event is unchanged
  Expect<Equal<keyof EventMap, 'pageview' | 'purchase'>>, // and there are no others
];

// @ts-expect-error
const noTotal = () => tracker.send('purchase', { sku: 'TEA-1' }); // a purchase needs its total

// @ts-expect-error
const noRefund = () => tracker.send('refund', { sku: 'TEA-1' }); // there is no refund event

export { noTotal, noRefund };

interface Sent {
  name: string;
  data: unknown;
}

/** Does what analytics-lite's script does: defines tracker, here one that records. */
function page(): Sent[] {
  const sent: Sent[] = [];
  const recorder: Tracker = {
    send: (name, data) => {
      sent.push({ name, data });
    },
  };
  Object.assign(globalThis, { tracker: recorder });
  return sent;
}

function cart(size: number): CartLine[] {
  const lines: CartLine[] = [];
  for (let i = 0; i < size; i++) {
    lines.push({ sku: `SKU-${i}`, cents: 125 * i + 99, qty: (i % 4) + 1 });
  }
  return lines;
}

test('an empty cart sends only the receipt pageview', () => {
  const sent = page();
  expect(checkout([])).toBe(0);
  expect(sent).toEqual([{ name: 'pageview', data: { path: '/receipt' } }]);
});

test('sends a purchase per line, then the pageview', () => {
  const sent = page();
  checkout([
    { sku: 'TEA-1', cents: 450, qty: 2 },
    { sku: 'MUG-2', cents: 1200, qty: 1 },
  ]);
  expect(sent).toEqual([
    { name: 'purchase', data: { sku: 'TEA-1', total: 900 } },
    { name: 'purchase', data: { sku: 'MUG-2', total: 1200 } },
    { name: 'pageview', data: { path: '/receipt' } },
  ]);
});

test('returns the total of carts of many sizes', () => {
  for (let size = 1; size <= 8; size++) {
    const lines = cart(size);
    const sent = page();
    const expected = lines.reduce((sum, l) => sum + l.cents * l.qty, 0);
    expect(checkout(lines)).toBe(expected);
    expect(sent).toHaveLength(size + 1);
    expect(sent[size - 1]).toEqual({
      name: 'purchase',
      data: {
        sku: `SKU-${size - 1}`,
        total: lines[size - 1].cents * lines[size - 1].qty,
      },
    });
  }
});

test('checkout does not change its input', () => {
  page();
  const lines = cart(3);
  const copy = lines.map((line) => ({ ...line }));
  checkout(lines);
  expect(lines).toEqual(copy);
});
