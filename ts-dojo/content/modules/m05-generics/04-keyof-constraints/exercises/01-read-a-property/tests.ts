import type { Equal, Expect } from '@dojo/type-utils';
import { prop } from './index';

type Book = { title: string; pages: number; tags: string[] };
type Point = { x: number; y: number; label?: string };

const book: Book = { title: 'Dune', pages: 412, tags: ['sf'] };
const point: Point = { x: 3, y: -4 };

const title = prop(book, 'title');
const pages = prop(book, 'pages');
const tags = prop(book, 'tags');
const label = prop(point, 'label');

type cases = [
  Expect<Equal<typeof title, string>>, // the title of a book is a string
  Expect<Equal<typeof pages, number>>, // its pages are a number
  Expect<Equal<typeof tags, string[]>>, // its tags are a string[]
  Expect<Equal<typeof label, string | undefined>>, // an optional property keeps its undefined
];

// @ts-expect-error
prop(book, 'author'); // a book has no author

// @ts-expect-error
prop(point, 'title'); // a point has no title

test('reads each property of a book', () => {
  expect(title).toBe('Dune');
  expect(pages).toBe(412);
  expect(tags).toEqual(['sf']);
});

test('reads the property that was asked for, for many objects', () => {
  for (let i = 0; i < 10; i++) {
    const p: Point = { x: i, y: i * 2, label: `p${i}` };
    expect(prop(p, 'x')).toBe(i);
    expect(prop(p, 'y')).toBe(i * 2);
    expect(prop(p, 'label')).toBe(`p${i}`);
  }
});

test('a missing optional property reads as undefined', () => {
  expect(label).toBeUndefined();
});
