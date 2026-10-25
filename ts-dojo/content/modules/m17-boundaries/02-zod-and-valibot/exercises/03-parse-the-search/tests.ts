import type { Equal, Expect } from '@dojo/type-utils';
import type { z } from 'zod';
import { SearchQuery } from './index';

type cases = [
  Expect<
    Equal<
      z.input<typeof SearchQuery>,
      {
        q: string;
        page?: string | undefined;
        tags?: string | undefined;
        sort?: 'newest' | 'oldest' | undefined;
      }
    >
  >, // the input: strings, all but q optional
  Expect<
    Equal<
      z.output<typeof SearchQuery>,
      { q: string; page: number; tags: string[]; sort: 'newest' | 'oldest' }
    >
  >, // the output: every key present
];

function pathsOf(input: unknown): PropertyKey[][] {
  const result = SearchQuery.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

test('SearchQuery parses a full query', () => {
  expect(
    SearchQuery.parse({
      q: '  zod  ',
      page: '3',
      tags: ' ts, schema,,  zod ',
      sort: 'oldest',
    }),
  ).toEqual({
    q: 'zod',
    page: 3,
    tags: ['ts', 'schema', 'zod'],
    sort: 'oldest',
  });
});

test('SearchQuery fills in what is missing', () => {
  expect(SearchQuery.parse({ q: 'zod' })).toEqual({
    q: 'zod',
    page: 1,
    tags: [],
    sort: 'newest',
  });
  expect(SearchQuery.parse({ q: 'zod', tags: '' })).toEqual({
    q: 'zod',
    page: 1,
    tags: [],
    sort: 'newest',
  });
});

test('SearchQuery parses generated pages and tags', () => {
  for (let page = 1; page <= 400; page += 37) {
    const tags = Array.from({ length: page % 5 }, (_, i) => `tag${page + i}`);
    expect(
      SearchQuery.parse({
        q: `q${page}`,
        page: String(page),
        tags: tags.join(' , '),
      }),
    ).toEqual({ q: `q${page}`, page, tags, sort: 'newest' });
  }
});

test('SearchQuery drops keys it does not name', () => {
  const parsed = SearchQuery.parse({ q: 'zod', utm_source: 'mail', ref: '7' });
  expect(Object.keys(parsed).sort()).toEqual(['page', 'q', 'sort', 'tags']);
});

test('SearchQuery rejects a page that is no whole number from 1 up', () => {
  for (const page of ['0', '-2', '2.5', 'two', '', 'NaN']) {
    expect(pathsOf({ q: 'zod', page })).toEqual([['page']]);
  }
});

test('SearchQuery rejects an empty q and an unknown sort', () => {
  for (const q of ['', '   ', undefined]) {
    expect(pathsOf({ q })).toEqual([['q']]);
  }
  for (const sort of ['top', 'Newest', '']) {
    expect(pathsOf({ q: 'zod', sort })).toEqual([['sort']]);
  }
});

test('SearchQuery reports every bad key', () => {
  expect(
    pathsOf({ q: ' ', page: 'x', tags: ['a'], sort: 'top' })
      .map((path) => path.join('.'))
      .sort(),
  ).toEqual(['page', 'q', 'sort', 'tags']);
  expect(pathsOf(null)).toEqual([[]]);
});
