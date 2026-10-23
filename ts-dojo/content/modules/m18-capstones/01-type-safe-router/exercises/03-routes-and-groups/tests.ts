import type { Equal, Expect } from '@dojo/type-utils';
import { z } from 'zod';
import { group, route, type Route } from './index';

const Tab = z.object({ tab: z.enum(['posts', 'likes']).default('posts') });
const none = z.object({});
const Numbers = z.object({ page: z.number() });

// Each handler returns what it was given, so the route's type shows it.
const makeUser = () =>
  route({ path: '/users/:id', search: Tab, handle: (ctx) => ctx });
const makePost = () =>
  group('/users/:id').route({
    path: '/posts/:postId',
    search: none,
    handle: (ctx) => ctx,
  });
const makeComment = () =>
  group('/users/:id')
    .group('/posts/:postId')
    .route({
      path: '/comments/:commentId',
      search: none,
      handle: ({ params }) => params,
    });

// The same routes, made where a `Route<string, unknown>` is expected, as in a router's table.
const makeUserInTable = () =>
  route({
    path: '/users/:id',
    search: Tab,
    handle: (ctx) => ctx,
  }) satisfies Route<string, unknown>;
const makePostInTable = () =>
  group('/users/:id').route({
    path: '/posts/:postId',
    search: none,
    handle: (ctx) => ctx,
  }) satisfies Route<string, unknown>;

// A prefix made by a type: /orgs/:orgId/teams/:teamId/...
type Nested<Names extends string[]> = Names extends [
  infer N extends string,
  ...infer Rest extends string[],
]
  ? `/${N}s/:${N}Id${Nested<Rest>}`
  : '';
type Deep = Nested<['org', 'team', 'project', 'board', 'card']>;
declare const deep: Deep;
const makeDeep = () =>
  group(deep).route({
    path: '/items/:itemId',
    search: none,
    handle: ({ params }) => params,
  });

type cases = [
  Expect<
    Equal<
      ReturnType<typeof makeUser>,
      Route<
        '/users/:id',
        { params: { id: string }; search: { tab: 'posts' | 'likes' } }
      >
    >
  >, // params from the path, search from the schema
  Expect<
    Equal<
      ReturnType<typeof makePost>,
      Route<
        '/users/:id/posts/:postId',
        {
          params: { id: string; postId: string };
          search: Record<string, never>;
        }
      >
    >
  >, // a group adds its prefix and its parameters
  Expect<
    Equal<
      ReturnType<typeof makeComment>,
      Route<
        '/users/:id/posts/:postId/comments/:commentId',
        { id: string; postId: string; commentId: string }
      >
    >
  >, // groups nest
  Expect<
    Equal<
      ReturnType<typeof makeDeep>,
      Route<
        `${Deep}/items/:itemId`,
        {
          orgId: string;
          teamId: string;
          projectId: string;
          boardId: string;
          cardId: string;
          itemId: string;
        }
      >
    >
  >, // a generated prefix
  Expect<
    Equal<ReturnType<typeof makeUserInTable>, ReturnType<typeof makeUser>>
  >, // a route made inside a table keeps its pattern
  Expect<
    Equal<ReturnType<typeof makePostInTable>, ReturnType<typeof makePost>>
  >, // and so does a group's route
];

// @ts-expect-error
const numeric = () => route({ path: '/', search: Numbers, handle: () => 0 }); // a query holds strings

export { numeric };

test('route matches the path and parses the query', () => {
  const user = makeUser();
  expect(user.path).toBe('/users/:id');
  expect(user.resolve('/users/7', { tab: 'likes' })).toEqual({
    ok: true,
    value: { params: { id: '7' }, search: { tab: 'likes' } },
  });
  expect(user.resolve('/users/a%20b', { ref: 'mail' })).toEqual({
    ok: true,
    value: { params: { id: 'a b' }, search: { tab: 'posts' } },
  });
});

test('route gives null when the path does not match', () => {
  const user = makeUser();
  expect(user.resolve('/users', {})).toBeNull();
  expect(user.resolve('/users/7/posts', {})).toBeNull();
  expect(user.resolve('/posts/7', { tab: 'likes' })).toBeNull();
});

test('route reports a query its schema rejects', () => {
  const result = makeUser().resolve('/users/7', { tab: 'all' });
  expect(result?.ok).toBe(false);
  if (result?.ok === false) {
    expect(result.issues.map((issue) => issue.path)).toEqual([['tab']]);
  }
});

test('the handler runs once for each match, and only then', () => {
  const seen: string[] = [];
  const user = route({
    path: '/users/:id',
    search: Tab,
    handle: ({ params }) => {
      seen.push(params.id);
      return params.id.length;
    },
  });
  expect(user.resolve('/posts/1', {})).toBeNull();
  expect(user.resolve('/users/2', { tab: 'all' })?.ok).toBe(false);
  expect(user.resolve('/users/three', {})).toEqual({ ok: true, value: 5 });
  expect(seen).toEqual(['three']);
});

test('a group puts its prefix before each path', () => {
  const post = makePost();
  expect(post.path).toBe('/users/:id/posts/:postId');
  expect(post.resolve('/users/7/posts/42', {})).toEqual({
    ok: true,
    value: { params: { id: '7', postId: '42' }, search: {} },
  });
  expect(post.resolve('/posts/42', {})).toBeNull();
});

test('groups nest', () => {
  const comment = makeComment();
  expect(comment.path).toBe('/users/:id/posts/:postId/comments/:commentId');
  expect(comment.resolve('/users/7/posts/42/comments/c1', {})).toEqual({
    ok: true,
    value: { id: '7', postId: '42', commentId: 'c1' },
  });
});

test('generated groups', () => {
  const names = ['org', 'team', 'project', 'board', 'card'];
  for (let n = 1; n <= names.length; n++) {
    const used = names.slice(0, n);
    const prefixes = used.map((name) => `/${name}s/:${name}Id`);
    const inner = prefixes.reduce(
      (outer: { prefix: string; path: string }, prefix) => ({
        prefix: outer.prefix + prefix,
        path: outer.path + prefix.replace(/:(\w+)/, '$1-value'),
      }),
      { prefix: '', path: '' },
    );
    const [first = '', ...rest] = prefixes;
    const nested = rest.reduce((g, prefix) => g.group(prefix), group(first));
    const item = nested.route({
      path: '/items/:itemId',
      search: none,
      handle: ({ params }) => JSON.stringify(params),
    });
    expect(item.path).toBe(`${inner.prefix}/items/:itemId`);
    const params = Object.fromEntries(
      used.map((name): [string, string] => [`${name}Id`, `${name}Id-value`]),
    );
    expect(item.resolve(`${inner.path}/items/i${n}`, {})).toEqual({
      ok: true,
      value: JSON.stringify({ ...params, itemId: `i${n}` }),
    });
  }
});
