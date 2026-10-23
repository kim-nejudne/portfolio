/** Groups the items of a list by the key the callback gives each one, in list order. */
export function groupBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyOf(item);
    const group = groups[key];
    if (group === undefined) {
      groups[key] = [item];
    } else {
      group.push(item);
    }
  }
  return groups;
}
