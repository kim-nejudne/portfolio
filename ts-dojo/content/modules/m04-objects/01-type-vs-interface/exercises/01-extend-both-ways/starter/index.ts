export interface Book {
  title: string;
  author: string;
}

// Ebook: an interface that extends Book with sizeMb, a number.
export type Ebook = unknown;

// Audiobook: a type alias, Book intersected with narrator (a string) and hours (a number).
export type Audiobook = unknown;
