import type { Equal, Expect } from '@dojo/type-utils';
import {
  describe,
  darkMode,
  fontSize,
  theme,
  type Setting,
  type Theme,
} from './index';

type Toggle<T> = { kind: 'toggle'; value: T };
type Choice<T> = { kind: 'choice'; value: T; options: readonly T[] };

type cases = [
  Expect<Equal<Setting<boolean>, Toggle<boolean>>>, // boolean is one toggle
  Expect<Equal<Setting<true>, Toggle<true>>>, // a toggle stuck at true
  Expect<Equal<Setting<Theme>, Choice<Theme>>>, // one choice over the whole union
  Expect<Equal<Setting<number>, Choice<number>>>, // a single type
  Expect<Equal<Setting<boolean | 'auto'>, Choice<boolean | 'auto'>>>, // a choice: not all booleans
  Expect<Equal<typeof darkMode, Setting<boolean>>>, // darkMode keeps its type
  Expect<Equal<typeof theme, Setting<Theme>>>, // theme keeps its type
  Expect<Equal<typeof fontSize, Setting<12 | 14 | 16>>>, // fontSize keeps its type
];

test('a toggle is described as on or off', () => {
  expect(describe(darkMode)).toBe('off');
  expect(describe({ kind: 'toggle', value: true })).toBe('on');
});

test('a choice lists its options', () => {
  expect(describe(theme)).toBe('system of light, dark, system');
  expect(theme.options).toEqual(['light', 'dark', 'system']);
  expect(fontSize.options).toEqual([12, 14, 16]);
  expect(fontSize.value).toBe(14);
});
