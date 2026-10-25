import type { Equal, Expect } from '@dojo/type-utils';
import { findBook, titleOf, type Book } from './index';

type cases = [
  Expect<Equal<ReturnType<typeof findBook>, Book | undefined>>, // findBook says it can come back empty
];

const unknownIds = Array.from({ length: 20 }, (_, n) => `x${String(n)}`);

test('findBook finds a book by id', () => {
  expect(findBook('b2')).toEqual({ id: 'b2', title: 'Emma' });
});

test('findBook gives undefined for an unknown id', () => {
  expect(findBook('')).toBeUndefined();
  for (const id of unknownIds) expect(findBook(id)).toBeUndefined();
});

test('titleOf gives the title', () => {
  expect(titleOf('b1')).toBe('Dune');
  expect(titleOf('b2')).toBe('Emma');
});

test('titleOf an unknown id is unknown book', () => {
  for (const id of unknownIds) expect(titleOf(id)).toBe('unknown book');
});
