export type Setting = string | number | boolean;

// Widen<T>: a string, number or boolean literal turned into its primitive; any other type as it is.
export type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T;

/** One setting read from `raw`, parsed as the type of `fallback`, or `fallback` when it can't be. */
export function readSetting<T extends Setting>(
  raw: string | undefined,
  fallback: T,
): Widen<T>;
// The implementation signature has plain types: a body can't be checked against Widen<T>
// while T is unknown, so the tests check that each kind of setting is parsed as it should be.
export function readSetting(
  raw: string | undefined,
  fallback: Setting,
): Setting {
  if (raw === undefined) {
    return fallback;
  }
  switch (typeof fallback) {
    case 'number': {
      const value = Number(raw);
      return raw.trim() === '' || Number.isNaN(value) ? fallback : value;
    }
    case 'boolean':
      return raw === 'true' ? true : raw === 'false' ? false : fallback;
    case 'string':
      return raw;
  }
}
