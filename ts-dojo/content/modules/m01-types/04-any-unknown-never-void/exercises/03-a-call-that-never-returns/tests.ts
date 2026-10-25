import type { Equal, Expect } from '@dojo/type-utils';
import { fail, parsePort, warn } from './index';

type cases = [
  Expect<Equal<typeof fail, (message: string) => never>>, // fail says it never returns
  Expect<Equal<typeof warn, (message: string) => void>>, // warn is unchanged
  Expect<Equal<typeof parsePort, (text: string) => number>>, // parsePort still returns a number
];

test('a port', () => {
  expect(parsePort('8080')).toBe(8080);
});

test('an empty setting gives the default port', () => {
  expect(parsePort('')).toBe(8080);
});

test('a word is not a port', () => {
  expect(() => parsePort('http')).toThrow('not a port: http');
});

test('a port out of range is not a port', () => {
  expect(() => parsePort('70000')).toThrow('not a port: 70000');
});

test('fail throws its message', () => {
  expect(() => fail('stop here')).toThrow('stop here');
});
