/** A copy of the item with updatedAt set to now; the item itself is left alone. */
export function touch<T extends { updatedAt: number }>(
  item: T,
  now: number,
): T {
  return { ...item, updatedAt: now };
}
