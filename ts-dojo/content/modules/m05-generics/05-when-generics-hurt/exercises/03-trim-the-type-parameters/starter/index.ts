/** Calls fn on every item and collects the results. */
export function mapAll<T, U, F extends (item: T) => U>(
  items: readonly T[],
  fn: F,
): U[] {
  return items.map((item) => fn(item));
}

/** The first item that passes the test, or undefined. */
export function findFirst<T, P extends (item: T) => boolean>(
  items: readonly T[],
  test: P,
): T | undefined {
  for (const item of items) {
    if (test(item)) {
      return item;
    }
  }
  return undefined;
}

/** A sorted copy of the items, by the property key. */
export function sortBy<T, K extends keyof T>(items: readonly T[], key: K): T[] {
  return [...items].sort((a, b) =>
    a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0,
  );
}

/** A log line for a value. */
export function formatEntry<T>(label: string, value: T): string {
  return `${label}=${JSON.stringify(value)}`;
}

export const lengths = mapAll(
  ['tea', 'coffee', 'cocoa'],
  (drink) => drink.length,
);
export const longest = Math.max(...lengths);
