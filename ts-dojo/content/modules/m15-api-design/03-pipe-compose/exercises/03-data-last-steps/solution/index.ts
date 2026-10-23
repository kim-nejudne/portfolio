// Each step returns the function that pipe calls with the value so far.

export function map<T, U>(fn: (item: T) => U): (items: readonly T[]) => U[] {
  return (items) => items.map((item) => fn(item));
}

export function filter<T>(
  keep: (item: T) => boolean,
): (items: readonly T[]) => T[] {
  return (items) => items.filter((item) => keep(item));
}

export function pluck<T, K extends keyof T>(
  key: K,
): (items: readonly T[]) => T[K][] {
  return (items) => items.map((item) => item[key]);
}

export function defaultTo<T>(
  fallback: NoInfer<T>,
): (value: T | undefined) => T {
  return (value) => (value === undefined ? fallback : value);
}
