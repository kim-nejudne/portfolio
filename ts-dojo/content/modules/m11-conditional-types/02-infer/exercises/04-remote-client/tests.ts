import type { Equal, Expect } from '@dojo/type-utils';
import { remote, type Client } from './index';

type User = { id: number; name: string };

function format(value: number): string;
function format(value: Date, utc: boolean): string;
function format(value: number | Date, utc = false): string {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return utc ? value.toISOString() : value.toDateString();
}

function makeApi() {
  return {
    version: '1.4.0',
    base: 10,
    format,
    add(a: number, b: number) {
      return a + b;
    },
    async user(id: number): Promise<User> {
      return { id, name: `user ${id}` };
    },
    offset(n: number) {
      return this.base + n;
    },
    greet(name?: string) {
      return `hello ${name ?? 'you'}`;
    },
    fail(): never {
      throw new Error('boom');
    },
  };
}

type Api = ReturnType<typeof makeApi>;
// Built inside each test, so a starter that throws fails the tests one by one.
const makeClient = () => remote(makeApi());

type cases = [
  Expect<Equal<ReturnType<typeof makeClient>, Client<Api>>>, // remote gives a Client
  Expect<Equal<Client<Api>['add'], (a: number, b: number) => Promise<number>>>, // a method keeps its parameters
  Expect<Equal<Client<Api>['user'], (id: number) => Promise<User>>>, // a promise is not wrapped twice
  Expect<Equal<Client<Api>['greet'], (name?: string) => Promise<string>>>, // an optional parameter stays optional
  Expect<Equal<Client<Api>['fail'], () => Promise<never>>>, // a method that never returns
  Expect<
    Equal<Client<Api>['format'], (value: Date, utc: boolean) => Promise<string>>
  >, // an overload gives its last signature
  Expect<Equal<Client<Api>['version'], () => Promise<string>>>, // a value becomes a call
  Expect<
    Equal<Client<{ later: Promise<number> }>, { later: () => Promise<number> }>
  >, // a value that is a promise is not wrapped twice
  Expect<
    Equal<
      Client<{ readonly ping: () => 'pong'; count: 0 }>,
      { readonly ping: () => Promise<'pong'>; count: () => Promise<0> }
    >
  >, // readonly is kept, literals too
  Expect<
    Equal<
      Client<{ log: (...lines: string[]) => void }>,
      { log: (...lines: string[]) => Promise<void> }
    >
  >, // a rest parameter
  Expect<Equal<Client<{}>, {}>>, // nothing to wrap
];

// @ts-expect-error
const oneNumber = () => makeClient().add(1); // add takes two numbers

// @ts-expect-error
const asText = () => makeClient().version.toUpperCase(); // version is a call now

// @ts-expect-error
const firstOverload = () => makeClient().format(1); // only the last overload is kept

test('a method gives a promise of its result', async () => {
  const client = makeClient();
  const pending = client.add(2, 3);
  expect(pending).toBeInstanceOf(Promise);
  expect(await pending).toBe(5);
  expect(await client.add(-1, 1)).toBe(0);
  expect(await client.greet('Ada')).toBe('hello Ada');
  expect(await client.greet()).toBe('hello you');
  const day = new Date(Date.UTC(2026, 9, 23));
  expect(await client.format(day, true)).toBe(day.toISOString());
});

test('a method that returns a promise is unwrapped', async () => {
  const client = makeClient();
  expect(await client.user(7)).toEqual({ id: 7, name: 'user 7' });
});

test('a value becomes a call that gives the value', async () => {
  const client = makeClient();
  const pending = client.version();
  expect(pending).toBeInstanceOf(Promise);
  expect(await pending).toBe('1.4.0');
  expect(await client.base()).toBe(10);
});

test('a method is called on the api', async () => {
  const client = makeClient();
  expect(await client.offset(5)).toBe(15);
});

test('each call reads the api at the time of the call', async () => {
  const api = makeApi();
  const fresh = remote(api);
  api.version = '2.0.0';
  api.base = 100;
  api.add = (a, b) => a * b;
  expect(await fresh.version()).toBe('2.0.0');
  expect(await fresh.offset(1)).toBe(101);
  expect(await fresh.add(3, 4)).toBe(12);
});

test('a method that throws gives a rejected promise', async () => {
  const client = makeClient();
  let pending: Promise<unknown> | undefined;
  expect(() => {
    pending = client.fail();
  }).not.toThrow();
  await expect(pending).rejects.toThrow('boom');
});

test('the client has the keys of the api', () => {
  const client = makeClient();
  expect(Object.keys(client)).toEqual(Object.keys(makeApi()));
  expect(Object.keys(remote({}))).toEqual([]);
});

export { oneNumber, asText, firstOverload };
