import type { Equal, Expect } from '@dojo/type-utils';
import { Emitter, log, shop } from './index';

type cases = [
  Expect<
    Equal<
      Parameters<Parameters<typeof shop.on<'checkout'>>[1]>[0],
      { total: number }
    >
  >, // a checkout listener gets the total
  Expect<Equal<Parameters<typeof shop.emit<'login'>>[1], { user: string }>>, // a login carries a user
];

// @ts-expect-error
const wrongPayload = () => shop.emit('login', { total: 3 }); // not a checkout payload

// @ts-expect-error
const unknownEvent = () => shop.emit('logout', {}); // no such event

export { wrongPayload, unknownEvent };

test('each listener gets its own event', () => {
  log.length = 0;
  shop.emit('login', { user: 'Ada' });
  shop.emit('addToCart', { sku: 'TEA-1', quantity: 2 });
  shop.emit('checkout', { total: 9 });
  expect(log).toEqual(['hello Ada', '2 x TEA-1', 'paid 9']);
});

test('an event with no listeners does nothing', () => {
  const quiet = new Emitter<{ ping: { at: number } }>();
  expect(() => quiet.emit('ping', { at: 1 })).not.toThrow();
});

test('listeners run in the order they were added', () => {
  const seen: string[] = [];
  const bus = new Emitter<{ saved: { id: number } }>();
  bus.on('saved', (payload) => seen.push(`first ${payload.id}`));
  bus.on('saved', (payload) => seen.push(`second ${payload.id}`));
  bus.emit('saved', { id: 7 });
  expect(seen).toEqual(['first 7', 'second 7']);
});
