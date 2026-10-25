export type Tier = 'basic' | 'silver' | 'gold';

// Percent off an order, by tier.
export const discounts: Record<Tier, number> = {
  basic: 0,
  silver: 5,
  gold: 10,
};

// Prices in cents, by product name. A product that isn't listed has no price.
export type PriceList = Record<string, number | undefined>;

// Quantities, by product name.
export type Order = Record<string, number>;

/** The order's price in cents after the tier's discount, rounded with Math.round. */
export function orderTotal(
  order: Order,
  prices: PriceList,
  tier: Tier,
): number {
  let subtotal = 0;
  for (const [product, quantity] of Object.entries(order)) {
    const price = prices[product];
    if (price === undefined) {
      throw new Error(`no price for ${product}`);
    }
    subtotal += price * quantity;
  }
  return Math.round((subtotal * (100 - discounts[tier])) / 100);
}
