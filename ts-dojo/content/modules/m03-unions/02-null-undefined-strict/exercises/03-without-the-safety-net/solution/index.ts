// This exercise compiles with strictNullChecks: false.

export type Item = { sku: string; quantity: number };

const prices = new Map<string, number>([
  ['apple', 0.5],
  ['bread', 2.25],
  ['milk', 1.2],
]);

// The price of one unit; a SKU the shop doesn't sell costs 0.
export function unitPrice(sku: string): number {
  return prices.get(sku) ?? 0;
}

// How many of `sku` the cart holds; 0 when it isn't in the cart.
export function quantityOf(items: readonly Item[], sku: string): number {
  return items.find((item) => item.sku === sku)?.quantity ?? 0;
}

// The cost of the whole cart.
export function cartTotal(items: readonly Item[]): number {
  let total = 0;
  for (const item of items) {
    total += unitPrice(item.sku) * item.quantity;
  }
  return total;
}
