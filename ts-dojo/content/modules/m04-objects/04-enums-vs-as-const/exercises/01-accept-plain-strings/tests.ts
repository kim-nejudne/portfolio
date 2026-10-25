import type { Equal, Expect } from '@dojo/type-utils';
import { background, saved, Theme } from './index';

type cases = [
  Expect<Equal<Theme, 'light' | 'dark' | 'system'>>, // Theme is the union of the three strings
];

test('the object holds the three themes', () => {
  expect(Object.values(Theme)).toEqual(['light', 'dark', 'system']);
});

test('a member picks its background', () => {
  expect(background(Theme.Light)).toBe('white');
});

test('a plain string picks its background', () => {
  expect(background('system')).toBe('canvas');
});

test('the saved theme is dark', () => {
  expect(background(saved)).toBe('black');
});
