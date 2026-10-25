import type { Equal, Expect } from '@dojo/type-utils';
import { Broker, type Matching, type Message, type Pattern } from './index';

type Topics = {
  'user/created': { id: string; name: string };
  'user/deleted': { id: string };
  'users/exported': { count: number };
  'order/paid': { orderId: string; cents: number };
};

type Chat = {
  'room/joined': { room: string; user: string };
  'room/left': { room: string; user: string };
  'dm/sent': { to: string; text: string };
  presence: { online: boolean };
};

// Keys made by a template literal type: shop1/opened, shop1/closed, shop2/opened, ...
type Shops = { [K in `shop${1 | 2 | 3}/${'opened' | 'closed'}`]: { at: K } };

const broker = new Broker<Topics>();
type UserListener = Parameters<typeof broker.subscribe<'user/*'>>[1];

type cases = [
  Expect<
    Equal<
      Pattern<Topics>,
      | 'user/created'
      | 'user/deleted'
      | 'users/exported'
      | 'order/paid'
      | 'user/*'
      | 'users/*'
      | 'order/*'
    >
  >, // every topic and every namespace
  Expect<
    Equal<
      Pattern<Chat>,
      'room/joined' | 'room/left' | 'dm/sent' | 'presence' | 'room/*' | 'dm/*'
    >
  >, // a topic without a slash has no namespace
  Expect<Equal<Matching<Topics, 'user/*'>, 'user/created' | 'user/deleted'>>, // users/exported is another namespace
  Expect<Equal<Matching<Chat, 'dm/sent'>, 'dm/sent'>>, // a topic receives itself
  Expect<Equal<Matching<Shops, 'shop2/*'>, 'shop2/opened' | 'shop2/closed'>>, // generated keys
  Expect<
    Equal<
      Parameters<UserListener>[0],
      Message<Topics, 'user/created' | 'user/deleted'>
    >
  >, // subscribe's listener gets those messages
];

// @ts-expect-error
const noSuchNamespace = () => broker.subscribe('billing/*', () => {}); // no topic starts with billing/

// @ts-expect-error
const noSuchTopic = () => broker.subscribe('user/updated', () => {}); // not a topic

export { noSuchNamespace, noSuchTopic };

test('a topic subscriber gets that topic only', () => {
  const bus = new Broker<Topics>();
  const seen: unknown[] = [];
  bus.subscribe('order/paid', (message) => seen.push(message));
  bus.publish('user/created', { id: 'u1', name: 'Ada' });
  bus.publish('order/paid', { orderId: 'o1', cents: 450 });
  expect(seen).toEqual([
    { topic: 'order/paid', payload: { orderId: 'o1', cents: 450 } },
  ]);
});

test('a namespace subscriber gets every topic in it, in order', () => {
  const bus = new Broker<Topics>();
  const seen: unknown[] = [];
  bus.subscribe('user/*', (message) => seen.push(message));
  bus.publish('user/created', { id: 'u1', name: 'Ada' });
  bus.publish('order/paid', { orderId: 'o1', cents: 450 });
  bus.publish('users/exported', { count: 2 });
  bus.publish('user/deleted', { id: 'u1' });
  expect(seen).toEqual([
    { topic: 'user/created', payload: { id: 'u1', name: 'Ada' } },
    { topic: 'user/deleted', payload: { id: 'u1' } },
  ]);
});

test('patterns over generated topics', () => {
  const bus = new Broker<Shops>();
  const seen: string[] = [];
  bus.subscribe('shop2/*', (message) => seen.push(message.payload.at));
  bus.subscribe('shop3/closed', (message) => seen.push(message.payload.at));
  for (const shop of ['shop1', 'shop2', 'shop3'] as const) {
    bus.publish(`${shop}/opened`, { at: `${shop}/opened` });
    bus.publish(`${shop}/closed`, { at: `${shop}/closed` });
  }
  expect(seen).toEqual(['shop2/opened', 'shop2/closed', 'shop3/closed']);
});

test('a topic without a namespace', () => {
  const bus = new Broker<Chat>();
  const seen: unknown[] = [];
  bus.subscribe('presence', (message) => seen.push(message.payload));
  bus.subscribe('room/*', (message) => seen.push(message.topic));
  bus.publish('presence', { online: true });
  bus.publish('room/left', { room: 'tea', user: 'Ada' });
  bus.publish('dm/sent', { to: 'Ada', text: 'hi' });
  expect(seen).toEqual([{ online: true }, 'room/left']);
});

test('the returned function unsubscribes', () => {
  const bus = new Broker<Topics>();
  const seen: string[] = [];
  const off = bus.subscribe('user/*', (message) => seen.push(message.topic));
  bus.publish('user/deleted', { id: 'u1' });
  off();
  bus.publish('user/deleted', { id: 'u2' });
  expect(seen).toEqual(['user/deleted']);
});
