/** One line of a basket: a product's sku and how many of it. */
export type Line = { sku: string; quantity: number };

/**
 * The basket's total in cents: each line's price from `prices` times its quantity; then, when a
 * coupon is given, minus its percentage from `coupons`, rounded to whole cents.
 * Throws 'no price for <sku>' and 'unknown coupon <code>'.
 */
export function basketTotal(
  lines: readonly Line[],
  prices: Map<string, number>,
  coupons: Map<string, number>,
  coupon?: string,
): number {
  throw new Error('not implemented');
}
