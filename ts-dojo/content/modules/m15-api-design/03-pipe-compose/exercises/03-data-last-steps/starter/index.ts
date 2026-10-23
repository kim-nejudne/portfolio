// Each step returns the function that pipe calls with the value so far.

export function map(
  fn: (item: unknown) => unknown,
): (items: readonly unknown[]) => unknown[] {
  throw new Error('map is not implemented');
}

export function filter(
  keep: (item: unknown) => boolean,
): (items: readonly unknown[]) => unknown[] {
  throw new Error('filter is not implemented');
}

export function pluck(key: string): (items: readonly unknown[]) => unknown[] {
  throw new Error('pluck is not implemented');
}

export function defaultTo(fallback: unknown): (value: unknown) => unknown {
  throw new Error('defaultTo is not implemented');
}
