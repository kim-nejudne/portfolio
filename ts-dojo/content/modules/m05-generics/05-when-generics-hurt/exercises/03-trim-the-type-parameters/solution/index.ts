/** Calls fn on every item and collects the results. */
export function mapAll<T, U>(items: readonly T[], fn: (item: T) => U): U[] {
  return items.map((item) => fn(item));
}

/** The first item that passes the test, or undefined. */
export function findFirst<T>(
  items: readonly T[],
  test: (item: T) => boolean,
): T | undefined {
  for (const item of items) {
    if (test(item)) {
      return item;
    }
  }
  return undefined;
}

/** A sorted copy of the items, by the property key. */
export function sortBy<T>(items: readonly T[], key: keyof T): T[] {
  return [...items].sort((a, b) =>
    a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0,
  );
}

/** A log line for a value. */
export function formatEntry(label: string, value: unknown): string {
  return `${label}=${JSON.stringify(value)}`;
}

export const lengths = mapAll(
  ['tea', 'coffee', 'cocoa'],
  (drink) => drink.length,
);
export const longest = Math.max(...lengths);
