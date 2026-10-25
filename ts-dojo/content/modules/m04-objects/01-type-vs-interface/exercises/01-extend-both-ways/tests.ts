import type { Alike, Expect } from '@dojo/type-utils';
import type { Audiobook, Book, Ebook } from './index';

// Interfaces merge (see the lesson), so this adds `year` to the Book in index.ts. A type built
// on Book picks it up; a copy of Book's properties doesn't.
declare module './index' {
  interface Book {
    year?: number;
  }
}

type cases = [
  Expect<
    Alike<
      Ebook,
      { title: string; author: string; year?: number; sizeMb: number }
    >
  >, // an ebook is a book with a size
  Expect<
    Alike<
      Audiobook,
      {
        title: string;
        author: string;
        year?: number;
        narrator: string;
        hours: number;
      }
    >
  >, // an audiobook is a book with a narrator and a length
];

const book: Book = { title: 'Dune', author: 'Frank Herbert' };
const ebook: Ebook = { ...book, sizeMb: 2 }; // an ebook is accepted
const audiobook: Audiobook = { ...book, narrator: 'Scott Brick', hours: 21 }; // an audiobook is accepted

// @ts-expect-error
const noSize: Ebook = { title: 'Dune', author: 'Frank Herbert' }; // an ebook needs its size

// @ts-expect-error
const noAuthor: Audiobook = { title: 'Dune', narrator: 'Brick', hours: 21 }; // an audiobook still needs an author

export { ebook, audiobook, noSize, noAuthor };
