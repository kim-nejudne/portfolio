/** The items grouped by their value of the property `key`, in order of first appearance. */
export function groupBy<T, K extends keyof T>(
  items: readonly T[],
  key: K,
): Map<T[K], T[]> {
  const groups = new Map<T[K], T[]>();
  for (const item of items) {
    const value = item[key];
    const group = groups.get(value);
    if (group === undefined) {
      groups.set(value, [item]);
    } else {
      group.push(item);
    }
  }
  return groups;
}
