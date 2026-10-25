export type Tier = 'basic' | 'silver' | 'gold';

// Percent off an order, by tier. Gold is missing, and the type didn't notice.
export const discounts: Record<string, number> = {
  basic: 0,
  silver: 5,
};

// Prices in cents, by product name. A product that isn't listed has no price,
// yet a read of one says `number`.
export type PriceList = Record<string, number>;

// Quantities, by product name.
export type Order = Record<string, number>;

/** The order's price in cents after the tier's discount, rounded with Math.round. */
export function orderTotal(
  order: Order,
  prices: PriceList,
  tier: Tier,
): number {
  throw new Error(`not implemented for ${tier}`);
}
