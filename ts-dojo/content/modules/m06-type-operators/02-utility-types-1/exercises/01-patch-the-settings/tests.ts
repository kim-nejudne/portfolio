import type { Equal, Expect } from '@dojo/type-utils';
import { DEFAULTS, applyPatch, larger, light, type Settings } from './index';

type Patch = Parameters<typeof applyPatch>[1];

type cases = [
  Expect<Equal<Patch, Partial<Settings>>>, // a patch is any subset of Settings
];

// @ts-expect-error
const textSize = applyPatch(DEFAULTS, { fontSize: '18' }); // a font size is still a number

// @ts-expect-error
const blue = applyPatch(DEFAULTS, { theme: 'blue' }); // blue is not a theme

// @ts-expect-error
const colour = applyPatch(DEFAULTS, { colour: 'red' }); // Settings has no colour

test('a patch with one property changes only that property', () => {
  expect(larger).toEqual({ theme: 'dark', fontSize: 18, vim: true });
  for (let size = 8; size <= 32; size += 1) {
    expect(applyPatch(DEFAULTS, { fontSize: size })).toEqual({
      theme: 'dark',
      fontSize: size,
      vim: true,
    });
  }
});

test('a patch with several properties changes all of them', () => {
  expect(light).toEqual({ theme: 'light', fontSize: 14, vim: false });
  expect(applyPatch(light, { theme: 'dark', fontSize: 20 })).toEqual({
    theme: 'dark',
    fontSize: 20,
    vim: false,
  });
});

test('an empty patch gives an equal copy', () => {
  const copy = applyPatch(DEFAULTS, {});
  expect(copy).toEqual(DEFAULTS);
  expect(copy).not.toBe(DEFAULTS);
});

test('applyPatch leaves the settings it was given alone', () => {
  applyPatch(DEFAULTS, { theme: 'light', fontSize: 30, vim: false });
  expect(DEFAULTS).toEqual({ theme: 'dark', fontSize: 14, vim: true });
});

export { textSize, blue, colour };
