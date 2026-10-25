import type { Equal, Expect } from '@dojo/type-utils';
import { needsAdmin, parsePort } from './index';

type cases = [
  Expect<Equal<typeof parsePort, (text: string) => number>>, // parsePort returns a number
];

test('parsePort reads a number from padded text', () => {
  expect(parsePort(' 8080 ')).toBe(8080);
});

test('port 80 needs admin rights', () => {
  expect(needsAdmin('80')).toBe(true);
});

test('port 8080 does not', () => {
  expect(needsAdmin(' 8080 ')).toBe(false);
});

test('every port from 1 to 2000, padded or not', () => {
  for (let port = 1; port <= 2000; port++) {
    expect(parsePort(`  ${port} `)).toBe(port);
    expect(needsAdmin(String(port))).toBe(port < 1024);
  }
});
