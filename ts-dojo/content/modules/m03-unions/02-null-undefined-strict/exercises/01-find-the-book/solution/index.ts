export type Book = { id: string; title: string };

const books: Book[] = [
  { id: 'b1', title: 'Dune' },
  { id: 'b2', title: 'Emma' },
];

// The book with this id, or undefined when there is none.
export function findBook(id: string): Book | undefined {
  return books.find((book) => book.id === id);
}

// The title of the book with this id, or 'unknown book' when there is none.
export function titleOf(id: string): string {
  return findBook(id)?.title ?? 'unknown book';
}
