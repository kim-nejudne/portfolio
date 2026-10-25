export type Product = { sku: string; name: string; price: number };

export type Line =
  | { kind: 'item'; sku: string; quantity: number }
  | { kind: 'discount'; code: string; percent: number };

export type ItemLine = Extract<Line, { kind: 'item' }>;

/** Units on hand by sku. A sku that was never counted has no entry. */
export type Stock = Record<string, number | undefined>;

/** The item lines of an order, in their order. */
export function itemLines(lines: readonly Line[]): ItemLine[] {
  return lines.filter((line) => line.kind === 'item');
}

/** True when every item line can ship: its sku has a count of at least its quantity. */
export function canShip(lines: readonly Line[], stock: Stock): boolean {
  return itemLines(lines).every(({ sku, quantity }) => {
    const units = stock[sku];
    return units !== undefined && units >= quantity;
  });
}

/**
 * The price of every item line, each discount applied in turn. Throws an Error whose message
 * is `unknown sku: <sku>` when an item's sku is not in the catalog.
 */
export function orderTotal(
  catalog: readonly Product[],
  lines: readonly Line[],
): number {
  let total = 0;
  for (const line of lines) {
    if (line.kind !== 'item') {
      continue;
    }
    const product = catalog.find((entry) => entry.sku === line.sku);
    if (product === undefined) {
      throw new Error(`unknown sku: ${line.sku}`);
    }
    total += product.price * line.quantity;
  }
  for (const line of lines) {
    if (line.kind === 'discount') {
      total *= 1 - line.percent / 100;
    }
  }
  return total;
}
