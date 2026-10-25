import type { Equal, Expect } from '@dojo/type-utils';
import { defaultTo, filter, map, pluck } from './index';
import { pipe } from './pipe';

interface Book {
  title: string;
  pages: number;
  year: number;
}

type Theme = 'light' | 'dark';

const books: Book[] = [
  { title: 'Middlemarch', pages: 880, year: 1871 },
  { title: 'Orlando', pages: 333, year: 1928 },
  { title: 'Beloved', pages: 324, year: 1987 },
];

function readTheme(raw: string): Theme | undefined {
  return raw === 'light' || raw === 'dark' ? raw : undefined;
}

const modern = pipe(
  books,
  filter((book) => book.year > 1900),
  pluck('title'),
);
const lengths = pipe(
  books,
  pluck('title'),
  map((title) => title.length),
);
const shortYears = pipe(
  books,
  filter((book) => book.pages < 400),
  map((book) => book.year),
);
const theme = pipe(readTheme('sepia'), defaultTo('light'));

type cases = [
  Expect<Equal<typeof modern, string[]>>, // filter keeps Book, pluck reads a title
  Expect<Equal<typeof lengths, number[]>>, // map's callback gets a string
  Expect<Equal<typeof shortYears, number[]>>, // map's callback gets a Book
  Expect<Equal<typeof theme, Theme>>, // the pipe decides T, not the fallback
];

// @ts-expect-error
const noSuchKey = () => pipe(books, pluck('author')); // not a key of Book

// @ts-expect-error
const notATheme = () => pipe(readTheme('x'), defaultTo('blue')); // not a Theme

export { noSuchKey, notATheme };

test('filter, pluck and map', () => {
  expect(modern).toEqual(['Orlando', 'Beloved']);
  expect(lengths).toEqual([11, 7, 7]);
  expect(shortYears).toEqual([1928, 1987]);
});

test('steps work on other data too', () => {
  const words = ['tea', 'coffee', 'mate', 'cocoa'];
  const long = pipe(
    words,
    filter((word) => word.length > 3),
    map((word) => word.toUpperCase()),
  );
  expect(long).toEqual(['COFFEE', 'MATE', 'COCOA']);
  const points = [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ];
  expect(pipe(points, pluck('y'))).toEqual([2, 4]);
});

test('defaultTo replaces undefined only', () => {
  expect(theme).toBe('light');
  expect(pipe(readTheme('dark'), defaultTo('light'))).toBe('dark');
  const counts = new Map([['tea', 0]]);
  expect(pipe(counts.get('tea'), defaultTo(5))).toBe(0);
  expect(pipe(counts.get('rum'), defaultTo(5))).toBe(5);
  const notes = new Map<string, string | null>([['tea', null]]);
  expect(pipe(notes.get('tea'), defaultTo('none'))).toBeNull();
  expect(pipe(notes.get('rum'), defaultTo('none'))).toBe('none');
});

test('steps are new each time and leave the input alone', () => {
  const input = [3, 1, 2];
  const doubled = pipe(
    input,
    map((n) => n * 2),
  );
  expect(doubled).toEqual([6, 2, 4]);
  expect(input).toEqual([3, 1, 2]);
  expect(doubled).not.toBe(input);
});
