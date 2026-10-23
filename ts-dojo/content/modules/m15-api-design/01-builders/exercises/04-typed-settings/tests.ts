import type { Equal, Expect } from '@dojo/type-utils';
import { settings } from './index';

const server = settings()
  .set('host', 'localhost')
  .set('port', 8080)
  .set('tags', ['api', 'v2'])
  .build();
const flags = settings().set('debug', true).set('retries', 3).build();
const empty = settings().build();
const base = settings().set('region', 'eu');

type cases = [
  Expect<Equal<typeof server, { host: string; port: number; tags: string[] }>>, // one flat object type
  Expect<Equal<typeof flags, { debug: boolean; retries: number }>>, // other keys, other values
  Expect<Equal<typeof empty, {}>>, // nothing set
];

// @ts-expect-error
const portTwice = () => settings().set('port', 1).set('port', 2); // a key only once

// @ts-expect-error
const regionTwice = () => base.set('debug', false).set('region', 'us'); // even later on

export { portTwice, regionTwice };

test('build returns every key with its value', () => {
  expect(server).toEqual({
    host: 'localhost',
    port: 8080,
    tags: ['api', 'v2'],
  });
  expect(flags).toEqual({ debug: true, retries: 3 });
  expect(empty).toEqual({});
});

test('keys made at run time', () => {
  let built = {};
  for (let index = 0; index < 5; index++) {
    built = settings()
      .set(`key${index}`, index * 10)
      .build();
    expect(built).toEqual({ [`key${index}`]: index * 10 });
  }
});

test('a partial builder can be finished in several ways', () => {
  const debug = base.set('debug', true).build();
  const quiet = base.set('debug', false).set('level', 'warn').build();
  expect(debug).toEqual({ region: 'eu', debug: true });
  expect(quiet).toEqual({ region: 'eu', debug: false, level: 'warn' });
  expect(base.build()).toEqual({ region: 'eu' });
});
