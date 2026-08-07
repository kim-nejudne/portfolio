/**
 * Tingi arithmetic — buying in packs and selling by the piece.
 *
 * This is the shop's whole business model and it belongs in one place. It was
 * computed inside `ItemPage.tsx` with a `useMemo`, which meant a view owned a
 * pricing rule and the API had nowhere to get the same answer from. A margin
 * shown on a phone and a margin recorded on the server must be the same number
 * or one of them is lying.
 *
 * Every value here is whole pesos held as an integer.
 */
import type { Item, Peso } from './types';

/**
 * What one sell unit cost to buy.
 *
 * Floored, deliberately. A ream of 12 at ₱96 is exactly ₱8 a sachet, but a case
 * of 24 at ₱250 is ₱10.41…, and there is no such coin. Flooring understates the
 * cost by up to a peso, which overstates margin — so `marginPerPack` below is
 * the honest figure and the per-piece one is the convenient one. Both are shown
 * because a shopkeeper thinks in both.
 */
export function costPerPiece(buyPrice: Peso, perPack: number): Peso {
  if (perPack <= 0) return 0;
  return Math.floor(buyPrice / perPack);
}

/** Margin on a single piece: what it sells for, less what it cost. */
export function marginPerPiece(item: Item, buyPriceOverride?: Peso): Peso {
  const buyPrice = buyPriceOverride ?? item.buyPrice;
  return item.sellPrice - costPerPiece(buyPrice, item.perPack);
}

/**
 * Margin on a whole pack, if every piece sells.
 *
 * The truthful one: no flooring, so it carries the remainder the per-piece
 * figure drops.
 */
export function marginPerPack(item: Item, buyPriceOverride?: Peso): Peso {
  const buyPrice = buyPriceOverride ?? item.buyPrice;
  return item.sellPrice * item.perPack - buyPrice;
}

/** How many whole packs to buy to get back above the reorder point. */
export function packsToReorder(item: Item, targetStock?: number): number {
  if (item.perPack <= 0) return 0;
  const target = targetStock ?? item.reorderAt * 2;
  const shortfall = target - item.stock;
  if (shortfall <= 0) return 0;
  return Math.ceil(shortfall / item.perPack);
}

/** What a restock run costs, in whole pesos. */
export function restockCost(item: Item, packs: number): Peso {
  return item.buyPrice * Math.max(0, Math.trunc(packs));
}

export function isBelowReorder(item: Item): boolean {
  return item.stock <= item.reorderAt;
}

export function isOutOfStock(item: Item): boolean {
  return item.stock <= 0;
}
