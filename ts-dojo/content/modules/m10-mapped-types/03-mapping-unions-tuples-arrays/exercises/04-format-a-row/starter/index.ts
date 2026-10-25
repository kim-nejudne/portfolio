// Formatters<T>: one function per element of T, which turns that element into a string.
export type Formatters<T> = unknown;

/** Formats each cell of the row with the formatter at the same position. */
export function formatRow<T extends readonly unknown[]>(
  row: T,
  formatters: Formatters<T>,
): string[] {
  throw new Error('not implemented');
}
