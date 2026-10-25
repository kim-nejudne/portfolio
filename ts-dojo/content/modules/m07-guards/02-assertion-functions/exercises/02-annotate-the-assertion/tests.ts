import type { Equal, Expect } from '@dojo/type-utils';
import { address, assertConfig, readConfig, type Config } from './index';

type cases = [
  Expect<
    Equal<typeof assertConfig, (value: unknown) => asserts value is Config>
  >, // assertConfig is still an assertion function for Config
  Expect<Equal<typeof readConfig, (json: string) => Config>>, // readConfig returns a Config
];

test('assertConfig returns for a config', () => {
  expect(() => assertConfig({ host: 'localhost', port: 8080 })).not.toThrow();
  expect(() =>
    assertConfig({ host: 'db', port: 5432, user: 'admin' }),
  ).not.toThrow();
});

test('assertConfig throws for anything else', () => {
  for (const value of [
    null,
    'localhost:8080',
    8080,
    [],
    {},
    { host: 'localhost' },
    { port: 8080 },
    { host: 7, port: 8080 },
    { host: 'localhost', port: '8080' },
    { host: 'localhost', port: 80.5 },
  ]) {
    expect(() => assertConfig(value)).toThrow('not a config');
  }
});

test('readConfig returns the parsed config', () => {
  for (let port = 3000; port <= 3010; port++) {
    expect(readConfig(JSON.stringify({ host: 'api', port }))).toEqual({
      host: 'api',
      port,
    });
  }
});

test('readConfig throws for data that is not a config', () => {
  expect(() => readConfig('null')).toThrow('not a config');
  expect(() => readConfig('{"host":"api"}')).toThrow('not a config');
  expect(() => readConfig('{"host":"api","port":"80"}')).toThrow(
    'not a config',
  );
});

test('address joins the host and the port', () => {
  expect(address('{"host":"localhost","port":8080}')).toBe('localhost:8080');
  expect(address('{"host":"db","port":5432}')).toBe('db:5432');
  expect(() => address('{"port":5432}')).toThrow('not a config');
});
