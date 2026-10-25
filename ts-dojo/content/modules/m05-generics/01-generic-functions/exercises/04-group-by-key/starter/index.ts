/** Groups the items of a list by the key the callback gives each one, in list order. */
export function groupBy(
  items: readonly unknown[],
  keyOf: (item: unknown) => string,
): Record<string, unknown[]> {
  throw new Error(`not implemented for ${items.length} items, ${keyOf.name}`);
}
