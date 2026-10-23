import type { Equal, Expect } from '@dojo/type-utils';
import { getSetting, setSetting, toNumber, toText } from './index';

const port = getSetting('port', toNumber);
const host = getSetting('host', toText);
const verbose = getSetting('verbose', (value) => value === true);

type cases = [
  Expect<
    Equal<
      typeof getSetting,
      <T>(key: string, decode: (value: unknown) => T) => T
    >
  >, // getSetting takes a key and a decoder, and returns what the decoder returns
  Expect<Equal<typeof port, number>>, // T is inferred from toNumber
  Expect<Equal<typeof host, string>>, // T is inferred from toText
  Expect<Equal<typeof verbose, boolean>>, // T is inferred from a callback
];

// @ts-expect-error
const noDecoder = () => getSetting<number>('port'); // a decoder is required

test('reads the stored settings through their decoders', () => {
  expect(port).toBe(8080);
  expect(host).toBe('localhost');
  expect(verbose).toBe(true);
});

test('returns what the decoder returns, for many stored values', () => {
  for (let i = 0; i < 10; i++) {
    setSetting(`size${i}`, i * 7);
    expect(getSetting(`size${i}`, toNumber)).toBe(i * 7);
    expect(getSetting(`size${i}`, (value) => [value, 'checked'])).toEqual([
      i * 7,
      'checked',
    ]);
    expect(getSetting(`size${i}`, (value) => String(value).length)).toBe(
      String(i * 7).length,
    );
  }
});

test('the decoder sees the stored value', () => {
  const seen: unknown[] = [];
  setSetting('theme', 'dark');
  getSetting('theme', (value) => {
    seen.push(value);
    return 0;
  });
  expect(seen).toEqual(['dark']);
});

test('a value the decoder rejects throws instead of coming back', () => {
  expect(() => getSetting('host', toNumber)).toThrow('expected a number');
  expect(() => getSetting('port', toText)).toThrow('expected a string');
});

test('a missing setting reaches the decoder as undefined', () => {
  expect(() => getSetting('missing', toNumber)).toThrow('expected a number');
  expect(getSetting('missing', (value) => value === undefined)).toBe(true);
});
