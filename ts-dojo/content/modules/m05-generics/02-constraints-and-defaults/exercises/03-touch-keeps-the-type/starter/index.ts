/** A copy of the item with updatedAt set to now; the item itself is left alone. */
export function touch(
  item: { updatedAt: number },
  now: number,
): { updatedAt: number } {
  throw new Error(`not implemented for ${item.updatedAt} and ${now}`);
}
