import type { Equal, Expect } from '@dojo/type-utils';
import { hasParams, matchPath, type Params } from './index';

type cases = [
  Expect<
    Equal<ReturnType<typeof matchPath<'/users/:id'>>, { id: string } | null>
  >, // the result is typed from the pattern
  Expect<Equal<Params<'/files/*'>, { '*': string }>>, // a trailing wildcard
  Expect<Equal<Params<'/files/*/raw'>, {}>>, // a * in the middle is text
];

test('matchPath reads each :name segment', () => {
  expect(matchPath('/users/:id/posts/:postId', '/users/7/posts/42')).toEqual({
    id: '7',
    postId: '42',
  });
  expect(matchPath('/:lang/docs', '/en/docs')).toEqual({ lang: 'en' });
});

test('matchPath decodes the values of :name segments', () => {
  expect(matchPath('/search/:query', '/search/a%20b%2Fc')).toEqual({
    query: 'a b/c',
  });
});

test('matchPath compares every other segment as it is', () => {
  expect(matchPath('/about', '/about')).toEqual({});
  expect(matchPath('/', '/')).toEqual({});
  expect(matchPath('/about', '/abut')).toBeNull();
  expect(matchPath('/users/:id/posts', '/users/7/likes')).toBeNull();
});

test('without a wildcard, the segment counts must agree', () => {
  expect(matchPath('/users/:id', '/users')).toBeNull();
  expect(matchPath('/users/:id', '/users/7/posts')).toBeNull();
  expect(matchPath('/users/:id', '/users/7/')).toBeNull();
  expect(matchPath('/about', '/about/')).toBeNull();
});

test('a :name segment needs at least one character', () => {
  expect(matchPath('/users/:id', '/users/')).toBeNull();
  expect(matchPath('/users/:id/posts', '/users//posts')).toBeNull();
});

test('a trailing * takes the rest of the pathname, as it is', () => {
  expect(matchPath('/files/*', '/files/a/b/c.txt')).toEqual({
    '*': 'a/b/c.txt',
  });
  expect(matchPath('/files/*', '/files/a%20b')).toEqual({ '*': 'a%20b' });
  expect(matchPath('/files/*', '/files/')).toEqual({ '*': '' });
  expect(matchPath('/files/*', '/files')).toEqual({ '*': '' });
  expect(matchPath('/files/*', '/static/a')).toBeNull();
  expect(matchPath('/users/:id/*', '/users/7/a/b')).toEqual({
    id: '7',
    '*': 'a/b',
  });
});

test('a * that is not last is plain text', () => {
  expect(matchPath('/files/*/raw', '/files/*/raw')).toEqual({});
  expect(matchPath('/files/*/raw', '/files/a/raw')).toBeNull();
});

test('hasParams checks every parameter of the pattern', () => {
  expect(hasParams('/users/:id/posts/:postId', { id: '7', postId: '42' })).toBe(
    true,
  );
  expect(hasParams('/users/:id/posts/:postId', { id: '7' })).toBe(false);
  expect(hasParams('/users/:id', { id: undefined })).toBe(false);
  expect(hasParams('/about', {})).toBe(true);
  expect(hasParams('/files/*', {})).toBe(false);
  expect(hasParams('/files/*', { '*': '' })).toBe(true);
  expect(hasParams('/files/*/raw', {})).toBe(true);
});

test('generated patterns', () => {
  const names = ['org', 'team', 'project', 'board', 'card', 'task'];
  for (let n = 1; n <= names.length; n++) {
    const used = names.slice(0, n);
    const pattern = used.map((name) => `/${name}s/:${name}Id`).join('');
    const pathname = used.map((name, i) => `/${name}s/${name}%20${i}`).join('');
    const expected = Object.fromEntries(
      used.map((name, i): [string, string] => [`${name}Id`, `${name} ${i}`]),
    );
    expect(matchPath(pattern, pathname)).toEqual(expected);
    expect(matchPath(`${pattern}/*`, `${pathname}/x/y`)).toEqual({
      ...expected,
      '*': 'x/y',
    });
    expect(matchPath(pattern, `${pathname}/extra`)).toBeNull();
    expect(matchPath(pattern, pathname.replace('s/', '/'))).toBeNull();
  }
});
