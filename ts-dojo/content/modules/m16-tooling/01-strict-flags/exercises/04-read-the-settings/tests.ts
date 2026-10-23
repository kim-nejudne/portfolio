import type { Equal, Expect } from '@dojo/type-utils';
import { parsePairs, readSettings, type Settings } from './index';

type cases = [
  Expect<
    Equal<
      Settings,
      { theme?: 'light' | 'dark'; pageSize?: number; beta: boolean }
    >
  >, // Settings is unchanged
  Expect<Equal<ReturnType<typeof readSettings>, Settings>>, // readSettings returns Settings
];

test('parsePairs splits each line at its first =', () => {
  expect(parsePairs(['theme=dark', 'pageSize=50'])).toEqual({
    theme: 'dark',
    pageSize: '50',
  });
  expect(parsePairs(['title=a=b', 'empty='])).toEqual({
    title: 'a=b',
    empty: '',
  });
});

test('parsePairs skips lines without = and lets later lines win', () => {
  expect(parsePairs(['# comment', '', 'beta=false', 'beta=true'])).toEqual({
    beta: 'true',
  });
  expect(parsePairs([])).toEqual({});
});

test('readSettings reads every setting', () => {
  expect(
    readSettings({ theme: 'light', pageSize: '20', beta: 'true' }),
  ).toEqual({ theme: 'light', pageSize: 20, beta: true });
  expect(readSettings({ theme: 'dark', beta: 'false' })).toEqual({
    theme: 'dark',
    beta: false,
  });
});

test('readSettings leaves out a theme it does not know, and a missing one', () => {
  for (const raw of [{ theme: 'blue' }, { theme: '' }, { theme: 'Dark' }, {}]) {
    const settings = readSettings(raw);
    expect('theme' in settings).toBe(false);
    expect(Object.keys(settings)).toEqual(['beta']);
  }
});

test('readSettings accepts every page size from 1 to 100', () => {
  for (let size = 1; size <= 100; size++) {
    expect(readSettings({ pageSize: String(size) }).pageSize).toBe(size);
  }
});

test('readSettings leaves out a page size that is not a whole number from 1 to 100', () => {
  for (const pageSize of ['0', '101', '2.5', '-3', 'ten', '']) {
    const settings = readSettings({ pageSize });
    expect('pageSize' in settings).toBe(false);
  }
  expect('pageSize' in readSettings({})).toBe(false);
});

test('readSettings sets beta only for true', () => {
  expect(readSettings({ beta: 'true' }).beta).toBe(true);
  expect(readSettings({ beta: 'yes' }).beta).toBe(false);
  expect(readSettings({}).beta).toBe(false);
});

test('the two together read a settings file', () => {
  const lines = ['theme=dark', 'pageSize=500', 'beta=true', 'pageSize=25'];
  expect(readSettings(parsePairs(lines))).toEqual({
    theme: 'dark',
    pageSize: 25,
    beta: true,
  });
});
