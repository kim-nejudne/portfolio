import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import { z } from 'zod';
import {
  createRouter,
  group,
  respond,
  route,
  type Outcome,
  type Route,
} from './index';

const none = z.object({});
const Tab = z.object({ tab: z.enum(['posts', 'likes']).default('posts') });
const Search = z.object({
  q: z.string().trim().min(1),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default(1),
});

const makeRouter = () => {
  const users = group('/users/:id');
  return createRouter({
    home: route({ path: '/', search: none, handle: () => 'home' }),
    signUp: route({
      path: '/users/new',
      search: none,
      handle: () => 'sign up',
    }),
    user: route({
      path: '/users/:id',
      search: Tab,
      handle: ({ params, search }) => `user ${params.id} (${search.tab})`,
    }),
    post: users.route({
      path: '/posts/:postId',
      search: none,
      handle: ({ params }) => `post ${params.postId} by ${params.id}`,
    }),
    files: route({
      path: '/files/*',
      search: none,
      handle: ({ params }) => `file ${params['*']}`,
    }),
    search: route({
      path: '/search',
      search: Search,
      handle: ({ search }) => `search ${search.q}, page ${search.page}`,
    }),
  });
};

type Router = ReturnType<typeof makeRouter>;
type Name = 'home' | 'signUp' | 'user' | 'post' | 'files' | 'search';
declare const typed: Router;
declare const counter: Route<'/count', number>;

type cases = [
  Expect<Equal<ReturnType<Router['resolve']>, Outcome<Name>>>, // the outcome names every route
  Expect<ExpectValidArgs<typeof typed.href<'home'>, ['home']>>, // no parameters, no argument
  Expect<
    ExpectValidArgs<
      typeof typed.href<'post'>,
      ['post', { id: string; postId: string }]
    >
  >, // the group's parameter and the route's
  Expect<
    ExpectValidArgs<typeof typed.href<'files'>, ['files', { '*': string }]>
  >, // a wildcard
  Expect<Equal<ExpectValidArgs<typeof typed.href<'user'>, ['user']>, false>>, // the id is required
  Expect<
    ExpectValidArgs<
      typeof typed.navigate<'post'>,
      ['post', { id: string; postId: string }]
    >
  >, // navigate takes the same arguments
  Expect<Equal<ReturnType<Router['navigate']>, Outcome<Name>>>, // and gives an outcome
  Expect<ExpectValidArgs<typeof respond, [Outcome<Name>]>>, // respond takes a router's outcome
];

// @ts-expect-error
const unknownRoute = () => typed.href('settings'); // no such route

// @ts-expect-error
const missing = () => typed.navigate('post', { id: '7' }); // postId is missing

// @ts-expect-error
const notAPage = () => createRouter({ counter }); // a route returns a page body

export { unknownRoute, missing, notAPage };

test('resolve finds the page for each route', () => {
  const router = makeRouter();
  expect(router.resolve('/')).toEqual({
    kind: 'page',
    name: 'home',
    body: 'home',
  });
  expect(router.resolve('/users/7')).toEqual({
    kind: 'page',
    name: 'user',
    body: 'user 7 (posts)',
  });
  expect(router.resolve('/users/7/posts/42')).toEqual({
    kind: 'page',
    name: 'post',
    body: 'post 42 by 7',
  });
  expect(router.resolve('/files/a/b.txt')).toEqual({
    kind: 'page',
    name: 'files',
    body: 'file a/b.txt',
  });
});

test('the first route whose path matches decides', () => {
  const router = makeRouter();
  expect(router.resolve('/users/new')).toEqual({
    kind: 'page',
    name: 'signUp',
    body: 'sign up',
  });
});

test('resolve parses the query', () => {
  const router = makeRouter();
  expect(router.resolve('/users/7?tab=likes')).toEqual({
    kind: 'page',
    name: 'user',
    body: 'user 7 (likes)',
  });
  expect(router.resolve('/users/a%20b?ref=mail&tab=likes')).toEqual({
    kind: 'page',
    name: 'user',
    body: 'user a b (likes)',
  });
  expect(router.resolve('/search?q=type+script&page=3')).toEqual({
    kind: 'page',
    name: 'search',
    body: 'search type script, page 3',
  });
});

test('a query the route rejects is a bad query, and no later route is tried', () => {
  const router = makeRouter();
  const outcome = router.resolve('/users/7?tab=all');
  expect(outcome.kind).toBe('bad-query');
  if (outcome.kind === 'bad-query') {
    expect(outcome.name).toBe('user');
    expect(outcome.issues.map((issue) => issue.path)).toEqual([['tab']]);
  }
});

test('a URL no route matches is not found', () => {
  const router = makeRouter();
  for (const url of ['/nope', '/users', '/users/7/', '/users/7/posts']) {
    expect(router.resolve(url)).toEqual({ kind: 'not-found', pathname: url });
  }
  expect(router.resolve('/nope?tab=likes')).toEqual({
    kind: 'not-found',
    pathname: '/nope',
  });
});

test('href builds the link to a route by name', () => {
  const router = makeRouter();
  expect(router.href('home')).toBe('/');
  expect(router.href('user', { id: 'ada' })).toBe('/users/ada');
  expect(router.href('post', { id: '7', postId: 'hi there' })).toBe(
    '/users/7/posts/hi%20there',
  );
  expect(router.href('files', { '*': 'a/b.txt' })).toBe('/files/a/b.txt');
});

test('navigate resolves the link href builds, for generated values', () => {
  const router = makeRouter();
  const ids = ['7', 'ada', 'a b', 'x/y', '100%', 'é?&=#'];
  for (const [i, id] of ids.entries()) {
    const postId = `${id}-${i}`;
    expect(router.navigate('post', { id, postId })).toEqual({
      kind: 'page',
      name: 'post',
      body: `post ${postId} by ${id}`,
    });
  }
  expect(router.navigate('home')).toEqual({
    kind: 'page',
    name: 'home',
    body: 'home',
  });
});

test('a router over a generated table', () => {
  const names = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const table = Object.fromEntries(
    names.map((name): [string, Route<string, string>] => [
      name,
      route({
        path: `/${name}/:id`,
        search: none,
        handle: ({ params }) => `${name} ${JSON.stringify(params)}`,
      }),
    ]),
  );
  const router = createRouter(table);
  for (const [i, name] of names.entries()) {
    expect(router.resolve(`/${name}/${i}`)).toEqual({
      kind: 'page',
      name,
      body: `${name} {"id":"${i}"}`,
    });
  }
  expect(router.resolve('/zeta/1')).toEqual({
    kind: 'not-found',
    pathname: '/zeta/1',
  });
});

test('respond turns each outcome into a reply', () => {
  const router = makeRouter();
  expect(respond(router.resolve('/users/7'))).toEqual({
    status: 200,
    body: 'user 7 (posts)',
  });
  expect(respond(router.resolve('/users/7?tab=all'))).toEqual({
    status: 400,
    body: 'bad query for user: tab',
  });
  expect(respond(router.resolve('/search?q=+&page=two'))).toEqual({
    status: 400,
    body: 'bad query for search: q, page',
  });
  expect(respond(router.resolve('/nope?x=1'))).toEqual({
    status: 404,
    body: 'no page at /nope',
  });
});
