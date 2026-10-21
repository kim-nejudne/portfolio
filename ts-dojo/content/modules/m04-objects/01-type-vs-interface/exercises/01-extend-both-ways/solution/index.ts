export interface Book {
  title: string;
  author: string;
}

// Ebook: an interface that extends Book with sizeMb, a number.
export interface Ebook extends Book {
  sizeMb: number;
}

// Audiobook: a type alias, Book intersected with narrator (a string) and hours (a number).
export type Audiobook = Book & {
  narrator: string;
  hours: number;
};
