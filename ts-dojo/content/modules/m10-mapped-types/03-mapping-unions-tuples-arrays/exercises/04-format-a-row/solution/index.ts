// Formatters<T>: one function per element of T, which turns that element into a string.
// Homomorphic over a type parameter: a tuple gives a tuple of the same length, with readonly
// kept, an array gives an array, and an object type gives one function per property.
export type Formatters<T> = { [K in keyof T]: (value: T[K]) => string };

/** Formats each cell of the row with the formatter at the same position. */
export function formatRow<T extends readonly unknown[]>(
  row: T,
  formatters: Formatters<T>,
): string[] {
  const cells: string[] = [];
  for (let i = 0; i < row.length; i++) {
    cells.push(formatters[i](row[i]));
  }
  return cells;
}
