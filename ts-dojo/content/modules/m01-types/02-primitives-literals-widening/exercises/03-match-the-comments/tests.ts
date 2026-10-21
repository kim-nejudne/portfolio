import type { Equal, Expect } from '@dojo/type-utils';
import { appName, bookTitle, display, fontSizes } from './index';

type cases = [
  Expect<Equal<typeof appName, 'Reader'>>, // appName keeps its literal
  Expect<Equal<typeof bookTitle, string>>, // bookTitle is a primitive string
  Expect<Equal<typeof fontSizes, readonly [12, 14, 16, 20]>>, // fontSizes is a fixed tuple
  Expect<Equal<typeof display, { mode: 'dark'; fontSize: number }>>, // only display.mode is fixed
];

test('the values are unchanged', () => {
  expect(appName).toBe('Reader');
  expect(bookTitle).toBe('Dune');
  expect(fontSizes).toEqual([12, 14, 16, 20]);
  expect(display).toEqual({ mode: 'dark', fontSize: 14 });
});
