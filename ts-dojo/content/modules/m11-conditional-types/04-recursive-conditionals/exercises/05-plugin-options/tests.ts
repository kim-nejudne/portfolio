import type { Equal, Expect } from '@dojo/type-utils';
import {
  createApp,
  type AppOptions,
  type OptionsOf,
  type UnionToIntersection,
} from './index';

const logger = {
  name: 'logger',
  setup: (options: { level: 'info' | 'debug' }) => `level ${options.level}`,
};
const cache = {
  name: 'cache',
  setup: (options: { ttl: number; level?: 'info' | 'debug' }) =>
    `ttl ${options.ttl}${options.level === 'debug' ? ', verbose' : ''}`,
};
const metrics = {
  name: 'metrics',
  setup: (options: { port: number }) => `port ${options.port}`,
};
const health = { name: 'health', setup: () => 'ok' };

type Logger = typeof logger;
type Cache = typeof cache;
type Metrics = typeof metrics;
type Health = typeof health;

type cases = [
  Expect<Equal<UnionToIntersection<{ a: 1 } | { b: 2 }>, { a: 1 } & { b: 2 }>>, // two members
  Expect<Equal<UnionToIntersection<{ a: 1 }>, { a: 1 }>>, // one member
  Expect<Equal<UnionToIntersection<'a' | 'b'>, never>>, // no value is both
  Expect<Equal<OptionsOf<Logger>, { level: 'info' | 'debug' }>>, // a setup's options
  Expect<
    Equal<
      OptionsOf<Logger | Metrics>,
      { level: 'info' | 'debug' } | { port: number }
    >
  >, // one per member
  Expect<
    Equal<
      AppOptions<[Logger, Metrics]>,
      { level: 'info' | 'debug'; port: number }
    >
  >, // merged into one object
  Expect<
    Equal<AppOptions<[Logger, Cache]>, { level: 'info' | 'debug'; ttl: number }>
  >, // a shared option is required if one plugin needs it
  Expect<Equal<AppOptions<[Metrics]>, { port: number }>>, // one plugin
  Expect<Equal<AppOptions<[Logger, Health]>, { level: 'info' | 'debug' }>>, // a setup without options adds nothing
  Expect<Equal<AppOptions<[Health]>, {}>>, // no options at all
  Expect<
    Equal<
      AppOptions<(Cache | Metrics)[]>,
      { ttl: number; level?: 'info' | 'debug'; port: number }
    >
  >, // an array of plugins
  Expect<
    Equal<
      AppOptions<readonly [Metrics, Logger]>,
      { port: number; level: 'info' | 'debug' }
    >
  >, // a readonly tuple
  Expect<Equal<CreateAppOptions, { level: 'info' | 'debug'; port: number }>>, // createApp takes AppOptions
];

type CreateAppOptions = Parameters<typeof createApp<[Logger, Metrics]>>[1];

// @ts-expect-error
const noPort: AppOptions<[Logger, Metrics]> = { level: 'info' }; // port is missing

// @ts-expect-error
const badLevel: AppOptions<[Logger]> = { level: 'warn' }; // not a level

// @ts-expect-error
const hidden: AppOptions<[Health, Metrics]> = {}; // health doesn't hide port

// @ts-expect-error
type NotAPlugin = AppOptions<[{ name: 'x'; setup: 1 }]>; // not a plugin

test('each plugin is set up with the options, in order', () => {
  expect(createApp([logger, metrics], { level: 'info', port: 9090 })).toEqual([
    'logger: level info',
    'metrics: port 9090',
  ]);
});

test('every plugin sees all the options', () => {
  expect(createApp([cache, logger], { level: 'debug', ttl: 60 })).toEqual([
    'cache: ttl 60, verbose',
    'logger: level debug',
  ]);
});

test('a plugin without options', () => {
  expect(createApp([health], {})).toEqual(['health: ok']);
  expect(createApp([metrics, health], { port: 1 })).toEqual([
    'metrics: port 1',
    'health: ok',
  ]);
});

test('no plugins', () => {
  expect(createApp([], {})).toEqual([]);
});

export { noPort, badLevel, hidden };
