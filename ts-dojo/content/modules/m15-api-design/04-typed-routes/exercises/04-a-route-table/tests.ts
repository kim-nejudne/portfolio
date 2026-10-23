import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import { defineRoutes, href } from './index';

const app = defineRoutes({
  home: '/',
  user: '/users/:id',
  userPost: '/users/:id/posts/:postId',
});

type cases = [
  Expect<
    Equal<
      typeof app.routes,
      {
        readonly home: '/';
        readonly user: '/users/:id';
        readonly userPost: '/users/:id/posts/:postId';
      }
    >
  >, // the patterns keep their literal types, readonly as with as const
  Expect<
    ExpectValidArgs<
      typeof href<`/v${number}/items/:itemId`>,
      [`/v${number}/items/:itemId`, { itemId: string }]
    >
  >, // a pattern type takes its parameters
  Expect<
    Equal<
      ExpectValidArgs<
        typeof href<`/v${number}/items/:itemId`>,
        [`/v${number}/items/:itemId`]
      >,
      false
    >
  >, // and requires them
  Expect<
    ExpectValidArgs<typeof href<`/v${number}/status`>, [`/v${number}/status`]>
  >, // a pattern type without parameters takes nothing
  Expect<ExpectValidArgs<typeof app.link<'home'>, ['home']>>, // no parameters, no argument
  Expect<Equal<ExpectValidArgs<typeof app.link<'user'>, ['user']>, false>>, // the id is required
  Expect<
    ExpectValidArgs<
      typeof app.link<'userPost'>,
      ['userPost', { id: string; postId: string }]
    >
  >, // both parameters
  Expect<
    ExpectValidArgs<typeof href<string>, [string, Record<string, string>]>
  >, // a pattern known only at run time takes a record
];

// @ts-expect-error
const noSlash = () => defineRoutes({ home: 'home' }); // a pattern starts with a slash

// @ts-expect-error
const missing = () => app.link('userPost', { id: '7' }); // postId is missing

// @ts-expect-error
const extra = () => app.link('home', {}); // home has no parameters

// @ts-expect-error
const unknownRoute = () => app.link('settings'); // no such route

export { noSlash, missing, extra, unknownRoute };

test('href fills in each parameter', () => {
  expect(href('/users/:id/posts/:postId', { id: '7', postId: '42' })).toBe(
    '/users/7/posts/42',
  );
  expect(href('/:lang/docs', { lang: 'en' })).toBe('/en/docs');
});

test('href leaves a pattern without parameters as it is', () => {
  expect(href('/about')).toBe('/about');
  expect(href('/')).toBe('/');
});

test('href encodes the values', () => {
  expect(href('/search/:query', { query: 'a b/c?' })).toBe(
    '/search/a%20b%2Fc%3F',
  );
});

test('a name runs to the next slash, and a colon inside a segment is text', () => {
  expect(href('/at/12:30/:room-name', { 'room-name': 'tea' })).toBe(
    '/at/12:30/tea',
  );
});

test('patterns known only at run time', () => {
  const names = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
  for (let n = 1; n <= names.length; n++) {
    const used = names.slice(0, n);
    const pattern = used.map((name) => `/${name}s/:${name}`).join('');
    const params = Object.fromEntries(
      used.map((name, i): [string, string] => [name, `${name} ${i}`]),
    );
    const expected = used.map((name, i) => `/${name}s/${name}%20${i}`).join('');
    expect(href(pattern, params)).toBe(expected);
  }
});

test('a missing value throws with its segment', () => {
  const pattern: string = '/users/:id/posts/:postId';
  expect(() => href(pattern, { id: '7' })).toThrow('missing :postId');
});

test('link builds the link for a route by name', () => {
  expect(app.link('home')).toBe('/');
  expect(app.link('user', { id: 'ada' })).toBe('/users/ada');
  expect(app.link('userPost', { id: '7', postId: 'hi there' })).toBe(
    '/users/7/posts/hi%20there',
  );
});

test('another table', () => {
  const shop = defineRoutes({
    cart: '/cart',
    item: '/shops/:shopId/items/:itemId',
  });
  expect(shop.routes).toEqual({
    cart: '/cart',
    item: '/shops/:shopId/items/:itemId',
  });
  expect(shop.link('cart')).toBe('/cart');
  expect(shop.link('item', { shopId: 's1', itemId: 'tea & cake' })).toBe(
    '/shops/s1/items/tea%20%26%20cake',
  );
});
