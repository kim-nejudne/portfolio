import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import { readSetting, type Widen } from './index';

const port = readSetting('8080', 3000);
const debug = readSetting(undefined, false);
const host = readSetting('db.local', 'localhost');
const either = (fallback: number | 'auto') => readSetting('4', fallback);

type cases = [
  Expect<Equal<Widen<'hi'>, string>>, // a string literal widens
  Expect<Equal<Widen<string>, string>>, // string stays string
  Expect<Equal<Widen<-1>, number>>, // a number literal widens
  Expect<Equal<Widen<number>, number>>, // number stays number
  Expect<Equal<Widen<true>, boolean>>, // true widens to boolean
  Expect<Equal<Widen<boolean>, boolean>>, // boolean stays boolean
  Expect<Equal<Widen<1 | 'a'>, number | string>>, // one answer per member
  Expect<Equal<Widen<null>, null>>, // other types as they are
  Expect<Equal<Widen<Date>, Date>>, // an object type as it is
  Expect<Equal<Widen<'a'[]>, 'a'[]>>, // an array is not a literal
  Expect<Equal<Widen<never>, never>>, // nothing in, nothing out
  Expect<Equal<typeof port, number>>, // a number, not the literal 3000
  Expect<Equal<typeof debug, boolean>>, // a boolean, not false
  Expect<Equal<typeof host, string>>, // a string, not 'localhost'
  Expect<ExpectValidArgs<typeof readSetting, [string, number | 'auto']>>, // a union fallback is accepted
  Expect<Equal<ReturnType<typeof either>, number | string>>, // and gives a union back
];

// @ts-expect-error
const later = () => readSetting('1', new Date()); // only strings, numbers and booleans

// @ts-expect-error
const literal: 3000 = readSetting('8080', 3000); // the result is any number

test('a number setting is parsed', () => {
  expect(readSetting('8080', 3000)).toBe(8080);
  for (const value of [0, 1, -5, 2.5, 1e6, 0.125]) {
    expect(readSetting(String(value), 7)).toBe(value);
  }
  expect(readSetting(' 42 ', 7)).toBe(42);
});

test('a number setting falls back when raw is missing, blank or not a number', () => {
  expect(readSetting(undefined, 3000)).toBe(3000);
  expect(readSetting('', 3000)).toBe(3000);
  expect(readSetting('   ', 12)).toBe(12);
  expect(readSetting('eighty', 3000)).toBe(3000);
  expect(readSetting('80px', 5)).toBe(5);
});

test('a boolean setting is true or false', () => {
  expect(readSetting('true', false)).toBe(true);
  expect(readSetting('false', true)).toBe(false);
  expect(readSetting('true', true)).toBe(true);
  expect(readSetting('false', false)).toBe(false);
});

test('a boolean setting falls back for anything else', () => {
  expect(readSetting(undefined, true)).toBe(true);
  expect(readSetting(undefined, false)).toBe(false);
  for (const raw of ['yes', 'no', '1', '0', 'TRUE', '']) {
    expect(readSetting(raw, true)).toBe(true);
    expect(readSetting(raw, false)).toBe(false);
  }
});

test('a string setting is used as it is', () => {
  expect(readSetting('db.local', 'localhost')).toBe('db.local');
  expect(readSetting('', 'localhost')).toBe('');
  expect(readSetting('42', 'localhost')).toBe('42');
  expect(readSetting('true', 'localhost')).toBe('true');
  expect(readSetting(undefined, 'localhost')).toBe('localhost');
});

test('the fallback decides the parsing, whatever the raw value looks like', () => {
  expect(readSetting('7', 'seven')).toBe('7');
  expect(readSetting('7', 0)).toBe(7);
  expect(readSetting('7', false)).toBe(false);
  expect(either(9)).toBe(4);
  expect(either('auto')).toBe('4');
});

export { later, literal };
