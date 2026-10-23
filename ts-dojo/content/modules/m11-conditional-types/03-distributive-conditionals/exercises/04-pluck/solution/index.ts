// AllKeys<T>: every key of any member of T.
// keyof a union gives only the shared keys, so ask keyof once per member.
export type AllKeys<T> = T extends unknown ? keyof T : never;

// Column<T, K>: the type of the column K in a list of T. A row without K gives undefined.
// The outer condition splits T into its members; K is naked too, so a union of keys splits
// as well, and each member reads only the keys it has.
export type Column<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : undefined
  : never;

// pluck(rows, key): the value of `key` in every row, in order; undefined where a row lacks it.
// Callers see the generic overload. Column<T, K> is deferred inside a generic body, so the
// implementation below has plain types, as in lesson 11.1, and indexes rows by any key.
export function pluck<T extends object, K extends AllKeys<T>>(
  rows: readonly T[],
  key: K,
): Column<T, K>[];
export function pluck(
  rows: readonly Partial<Record<PropertyKey, unknown>>[],
  key: PropertyKey,
): unknown[] {
  return rows.map((row) => row[key]);
}
