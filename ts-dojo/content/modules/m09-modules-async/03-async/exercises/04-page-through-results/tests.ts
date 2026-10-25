import type { Equal, Expect } from '@dojo/type-utils';
import { paginate, take, type Page } from './index';

/** A fake API over `data`: pages of `size` items, the cursor being the index of the first. */
function pagesOf<T>(data: readonly T[], size: number) {
  const fetched: number[] = [];
  async function fetchPage(cursor: number): Promise<Page<T>> {
    fetched.push(cursor);
    const end = cursor + size;
    return {
      items: data.slice(cursor, end),
      next: end < data.length ? end : undefined,
    };
  }
  return { fetchPage, fetched };
}

function range(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i * 7 + 1);
}

async function readAll<T>(source: AsyncIterable<T>): Promise<T[]> {
  const all: T[] = [];
  for await (const item of source) all.push(item);
  return all;
}

type cases = [
  Expect<Equal<ReturnType<typeof paginate<string>>, AsyncGenerator<string>>>, // paginate yields the item type
  Expect<Equal<ReturnType<typeof take<number>>, Promise<number[]>>>, // take resolves to an array of it
];

test('paginate yields every item of every page, in order', async () => {
  for (const count of [1, 5, 9, 10, 23]) {
    for (const size of [1, 3, 5]) {
      const data = range(count);
      const { fetchPage } = pagesOf(data, size);
      await expect(readAll(paginate(fetchPage))).resolves.toEqual(data);
    }
  }
});

test('paginate fetches each page once, starting at cursor 0', async () => {
  const { fetchPage, fetched } = pagesOf(range(10), 4);
  await readAll(paginate(fetchPage));
  expect(fetched).toEqual([0, 4, 8]);
});

test('paginate stops at an empty last page', async () => {
  const { fetchPage, fetched } = pagesOf([], 3);
  await expect(readAll(paginate(fetchPage))).resolves.toEqual([]);
  expect(fetched).toEqual([0]);
});

test('paginate goes on past an empty page that has a next', async () => {
  const pages: Page<string>[] = [
    { items: ['x'], next: 1 },
    { items: [], next: 2 },
    { items: ['y', 'z'], next: undefined },
  ];
  async function fetchPage(cursor: number): Promise<Page<string>> {
    const page = pages[cursor];
    if (page === undefined) throw new Error(`no page ${cursor}`);
    return page;
  }
  await expect(readAll(paginate(fetchPage))).resolves.toEqual(['x', 'y', 'z']);
});

test('paginate fetches nothing until the first item is asked for', async () => {
  const { fetchPage, fetched } = pagesOf(range(6), 2);
  const items = paginate(fetchPage);
  expect(fetched).toEqual([]);
  await items.next();
  expect(fetched).toEqual([0]);
});

test('take reads only the pages it needs', async () => {
  const data = range(20);
  for (const [count, pages] of [
    [1, 1],
    [3, 1],
    [4, 2],
    [9, 3],
  ]) {
    const { fetchPage, fetched } = pagesOf(data, 3);
    await expect(take(paginate(fetchPage), count)).resolves.toEqual(
      data.slice(0, count),
    );
    expect(fetched).toHaveLength(pages);
  }
});

test('take of zero reads nothing', async () => {
  const { fetchPage, fetched } = pagesOf(range(5), 2);
  await expect(take(paginate(fetchPage), 0)).resolves.toEqual([]);
  expect(fetched).toEqual([]);
});

test('take returns everything when the source is shorter', async () => {
  const data = range(5);
  const { fetchPage } = pagesOf(data, 2);
  await expect(take(paginate(fetchPage), 50)).resolves.toEqual(data);
});

test('take reads any async iterable, and no more than it returns', async () => {
  let read = 0;
  async function* letters() {
    for (const letter of 'abcdefg') {
      read += 1;
      yield letter;
    }
  }
  await expect(take(letters(), 3)).resolves.toEqual(['a', 'b', 'c']);
  expect(read).toBe(3);
});
