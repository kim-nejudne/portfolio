export interface Page<T> {
  items: T[];
  /** The cursor of the next page, or undefined on the last page. */
  next: number | undefined;
}

/** Yields every item of every page, fetching a page only when its items are needed. */
export async function* paginate<T>(
  fetchPage: (cursor: number) => Promise<Page<T>>,
): AsyncGenerator<T> {
  let cursor: number | undefined = 0;
  while (cursor !== undefined) {
    const page = await fetchPage(cursor);
    for (const item of page.items) {
      yield item;
    }
    cursor = page.next;
  }
}

/** The first `count` items of `source`, reading no more than that. */
export async function take<T>(
  source: AsyncIterable<T>,
  count: number,
): Promise<T[]> {
  const items: T[] = [];
  if (count <= 0) return items;
  for await (const item of source) {
    items.push(item);
    if (items.length >= count) break;
  }
  return items;
}
