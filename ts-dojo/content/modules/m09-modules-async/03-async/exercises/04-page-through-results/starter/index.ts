export interface Page<T> {
  items: T[];
  /** The cursor of the next page, or undefined on the last page. */
  next: number | undefined;
}

/** Yields every item of every page, fetching a page only when its items are needed. */
export async function* paginate<T>(
  fetchPage: (cursor: number) => Promise<Page<T>>,
): AsyncGenerator<T> {
  throw new Error(`not implemented: ${fetchPage.name}`);
}

/** The first `count` items of `source`, reading no more than that. */
export async function take<T>(
  source: AsyncIterable<T>,
  count: number,
): Promise<T[]> {
  throw new Error(`not implemented: ${String(source)}, ${count}`);
}
