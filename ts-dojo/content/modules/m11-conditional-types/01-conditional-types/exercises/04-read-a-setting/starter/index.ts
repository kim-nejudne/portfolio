export type Setting = string | number | boolean;

// Widen<T>: a string, number or boolean literal turned into its primitive; any other type as it is.
export type Widen<T> = unknown;

/** One setting read from `raw`, parsed as the type of `fallback`, or `fallback` when it can't be. */
export function readSetting<T extends Setting>(
  raw: string | undefined,
  fallback: T,
): Widen<T> {
  throw new Error(`not implemented: ${raw} or ${fallback}`);
}
