/** One element by index, or several by a list of indexes. A negative index counts from the end. */
export function pick<T>(
  list: readonly T[],
  which: number | readonly number[],
): T | undefined | (T | undefined)[] {
  throw new Error(`not implemented for ${list.length} elements and ${which}`);
}
