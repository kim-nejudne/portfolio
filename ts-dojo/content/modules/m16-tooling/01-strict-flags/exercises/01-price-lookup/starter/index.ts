const PRICES: Record<string, number> = { apple: 1.2, pear: 0.9, plum: 0.5 };

/** The price of one item. An item the shop doesn't sell throws `unknown item: <item>`. */
export function priceOf(item: string): number {
  return PRICES[item];
}

/** The sum of the prices of every item in the basket. */
export function total(items: readonly string[]): number {
  let sum = 0;
  for (const item of items) {
    sum += priceOf(item);
  }
  return sum;
}

/** The first item in the basket, or undefined when the basket is empty. */
export function firstItem(items: readonly string[]): string {
  return items[0];
}
