// AllKeys<T>: every key of any member of T.
export type AllKeys<T> = keyof T;

// Column<T, K>: the type of the column K in a list of T. A row without K gives undefined.
export type Column<T, K extends PropertyKey> = unknown;

// pluck(rows, key): the value of `key` in every row, in order; undefined where a row lacks it.
export function pluck<T extends object, K extends AllKeys<T>>(
  rows: readonly T[],
  key: K,
): Column<T, K>[] {
  throw new Error(`not implemented: ${rows.length} rows, ${String(key)}`);
}
