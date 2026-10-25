import type { Equal, Expect, ExpectExtends } from '@dojo/type-utils';
import { accentHex, palette, textRgb, type Palette, type Rgb } from './index';

type cases = [
  Expect<
    Equal<Palette, Record<'background' | 'text' | 'accent', string | Rgb>>
  >, // Palette is unchanged
  Expect<Equal<Rgb, [number, number, number]>>, // Rgb is unchanged
  Expect<ExpectExtends<Palette, typeof palette>>, // palette fits Palette
  Expect<Equal<typeof palette.accent, string>>, // accent is known to be a string
  Expect<Equal<typeof palette.background, string>>, // background is known to be a string
  Expect<Equal<typeof palette.text, [number, number, number]>>, // text is known to be an Rgb triple
];

test('the accent in upper case', () => {
  expect(accentHex()).toBe('#B58900');
});

test('the text colour as rgb()', () => {
  expect(textRgb()).toBe('rgb(101, 123, 131)');
});

test('both functions follow the theme editor', () => {
  const accents = ['#2aa198', '#d33682', '#6c71c4'];
  for (const accent of accents) {
    palette.accent = accent;
    expect(accentHex()).toBe(accent.toUpperCase());
  }
  for (let grey = 0; grey <= 255; grey += 51) {
    palette.text = [grey, 255 - grey, 7];
    expect(textRgb()).toBe(`rgb(${grey}, ${255 - grey}, 7)`);
  }
  palette.accent = '#b58900';
  palette.text = [101, 123, 131];
});
