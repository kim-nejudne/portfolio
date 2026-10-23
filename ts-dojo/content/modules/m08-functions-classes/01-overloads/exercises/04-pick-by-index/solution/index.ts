/** One element by index, or several by a list of indexes. A negative index counts from the end. */
export function pick<T>(list: readonly T[], index: number): T | undefined;
export function pick<T>(
  list: readonly T[],
  indexes: readonly number[],
): (T | undefined)[];
export function pick<T>(
  list: readonly T[],
  which: number | readonly number[],
): T | undefined | (T | undefined)[];
export function pick<T>(
  list: readonly T[],
  which: number | readonly number[],
): T | undefined | (T | undefined)[] {
  return typeof which === 'number'
    ? list.at(which)
    : which.map((index) => list.at(index));
}
