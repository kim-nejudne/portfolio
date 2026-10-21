import type { Equal, Expect } from '@dojo/type-utils';
import {
  DEFAULTS,
  parseValue,
  readSettings,
  type SavedSettings,
  type Settings,
} from './index';

type cases = [
  Expect<Equal<typeof parseValue, (text: string) => unknown>>, // callers must check what parseValue returns
  Expect<Equal<typeof readSettings, (saved: SavedSettings) => Settings>>, // readSettings keeps its signature
  Expect<
    Equal<
      Settings,
      {
        readonly fontSize: number;
        readonly theme: string;
        readonly window: readonly [number, number];
      }
    >
  >, // Settings is unchanged
  Expect<
    Equal<
      typeof DEFAULTS,
      {
        readonly fontSize: 14;
        readonly theme: 'dark';
        readonly window: readonly [800, 600];
      }
    >
  >, // DEFAULTS is still as const
];

const saved: SavedSettings = {
  fontSize: '16',
  theme: '"light"',
  window: ['1280', '720'],
};

test('values of the right type are kept', () => {
  expect(readSettings(saved)).toEqual({
    fontSize: 16,
    theme: 'light',
    window: [1280, 720],
  });
});

test('a value of the wrong type gives its default', () => {
  expect(readSettings({ ...saved, fontSize: '"large"', theme: '42' })).toEqual({
    fontSize: 14,
    theme: 'dark',
    window: [1280, 720],
  });
});

test('a damaged text gives its default', () => {
  expect(readSettings({ ...saved, fontSize: '{', theme: '"light' })).toEqual({
    fontSize: 14,
    theme: 'dark',
    window: [1280, 720],
  });
});

test('null is not a number', () => {
  expect(readSettings({ ...saved, fontSize: 'null' }).fontSize).toBe(14);
});

test('a number saved as text, or a boolean, gives its default', () => {
  expect(
    readSettings({
      ...saved,
      fontSize: '"16"',
      theme: 'true',
      window: ['true', '720'],
    }),
  ).toEqual({ fontSize: 14, theme: 'dark', window: [800, 720] });
});

test('an object or a list gives its default', () => {
  expect(
    readSettings({
      ...saved,
      fontSize: '[16]',
      theme: '{"name": "light"}',
      window: ['{"px": 1280}', '[720]'],
    }),
  ).toEqual({ fontSize: 14, theme: 'dark', window: [800, 600] });
});

test('every saved size is kept', () => {
  for (let size = 8; size <= 40; size += 3) {
    const text = String(size);
    expect(
      readSettings({ ...saved, fontSize: text, window: [text, text] }),
    ).toEqual({ fontSize: size, theme: 'light', window: [size, size] });
  }
});

test('each side of the window is checked on its own', () => {
  expect(readSettings({ ...saved, window: ['"wide"', '720'] }).window).toEqual([
    800, 720,
  ]);
});

test('parseValue still reads any JSON, and undefined for a damaged text', () => {
  expect(parseValue('[1, 2]')).toEqual([1, 2]);
  expect(parseValue('{')).toBeUndefined();
});
