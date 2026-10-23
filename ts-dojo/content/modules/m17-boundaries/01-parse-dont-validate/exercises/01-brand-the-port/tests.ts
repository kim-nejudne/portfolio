import type { Equal, Expect } from '@dojo/type-utils';
import { isPort, listen, parsePort, type Port } from './index';

type cases = [
  Expect<Equal<ReturnType<typeof parsePort>, Port>>, // parsePort returns a Port
  Expect<Equal<Parameters<typeof listen>[0], Port>>, // listen takes a Port
  Expect<Equal<typeof isPort, (n: number) => n is Port>>, // isPort keeps what it found
];

// @ts-expect-error
const plain: Port = 8080; // a plain number is no Port

export { plain };

test('parsePort returns good ports', () => {
  expect(parsePort('8080')).toBe(8080);
  expect(parsePort('1')).toBe(1);
  expect(parsePort('65535')).toBe(65535);
});

test('parsePort returns every port it is given', () => {
  for (let port = 1; port <= 65535; port += 997) {
    expect(parsePort(String(port))).toBe(port);
  }
});

test('parsePort throws for text that is no port', () => {
  for (const text of ['0', '65536', '-80', '80.5', 'http', '', 'NaN']) {
    expect(() => parsePort(text)).toThrow(`not a port: ${text}`);
  }
});

test('isPort still answers both ways', () => {
  expect(isPort(443)).toBe(true);
  expect(isPort(0)).toBe(false);
  expect(isPort(1.5)).toBe(false);
});

test('a parsed port can be passed to listen', () => {
  expect(listen(parsePort('3000'))).toBe('listening on 3000');
});
