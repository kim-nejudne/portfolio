import { describe, expect, it } from 'vitest';
import {
  costPerPiece,
  isBelowReorder,
  isOutOfStock,
  marginPerPack,
  marginPerPiece,
  packsToReorder,
  restockCost,
} from './tingi';
import type { Item } from './types';

/** A ream of 12 shampoo sachets bought at ₱96, sold at ₱10 each. Divides evenly. */
const shampoo: Item = {
  id: 'itm-shampoo',
  name: 'Sunsilk Sachet',
  category: 'household',
  buyUnit: 'ream',
  sellUnit: 'sachet',
  perPack: 12,
  buyPrice: 96,
  sellPrice: 10,
  stock: 30,
  reorderAt: 12,
};

/** A case of 24 at ₱250 — ₱10.41… a can. The awkward one, and the realistic one. */
const sardines: Item = {
  id: 'itm-sardines',
  name: '555 Sardines',
  category: 'canned',
  buyUnit: 'case',
  sellUnit: 'can',
  perPack: 24,
  buyPrice: 250,
  sellPrice: 15,
  stock: 8,
  reorderAt: 10,
};

describe('costPerPiece', () => {
  it('divides evenly when the pack divides evenly', () => {
    expect(costPerPiece(96, 12)).toBe(8);
  });

  it('floors rather than rounding', () => {
    // 250/24 = 10.416…, and there is no 41-centavo coin behind the counter.
    expect(costPerPiece(250, 24)).toBe(10);
    // 251/24 = 10.458… — rounding would give 10 here and 11 at 252; flooring is
    // monotonic and never claims a piece cost more than it did.
    expect(costPerPiece(251, 24)).toBe(10);
    expect(costPerPiece(263, 24)).toBe(10);
    expect(costPerPiece(264, 24)).toBe(11);
  });

  it('returns zero for a nonsensical pack size instead of dividing by it', () => {
    // Guards against Infinity reaching a margin figure via a bad import row.
    expect(costPerPiece(96, 0)).toBe(0);
    expect(costPerPiece(96, -12)).toBe(0);
  });
});

describe('margins', () => {
  it('agrees between per-piece and per-pack when the pack divides evenly', () => {
    expect(marginPerPiece(shampoo)).toBe(2); // 10 − 8
    expect(marginPerPack(shampoo)).toBe(24); // 10×12 − 96
    expect(marginPerPiece(shampoo) * shampoo.perPack).toBe(marginPerPack(shampoo));
  });

  /**
   * The documented consequence of flooring, asserted so it stays a known
   * trade-off rather than becoming a surprise. Per-piece × pack size
   * *overstates* the pack margin, because the floored cost understates cost.
   */
  it('overstates via per-piece when the pack does not divide evenly', () => {
    expect(marginPerPiece(sardines)).toBe(5); // 15 − 10 (floored from 10.41…)
    expect(marginPerPack(sardines)).toBe(110); // 15×24 − 250
    expect(marginPerPiece(sardines) * sardines.perPack).toBe(120);
    expect(marginPerPack(sardines)).toBeLessThan(marginPerPiece(sardines) * sardines.perPack);
  });

  it('honours a buy-price override without mutating the item', () => {
    // The item page previews margin as the shopkeeper types a new buy price.
    expect(marginPerPiece(shampoo, 120)).toBe(0); // 120/12 = 10, sells at 10
    expect(marginPerPack(shampoo, 120)).toBe(0);
    expect(shampoo.buyPrice).toBe(96);
  });

  it('reports a negative margin rather than clamping to zero', () => {
    // Selling below cost is a real thing a supplier price rise causes, and the
    // shopkeeper needs to see it as a loss, not as break-even.
    expect(marginPerPiece(shampoo, 240)).toBe(-10);
    expect(marginPerPack(shampoo, 240)).toBe(-120);
  });
});

describe('packsToReorder', () => {
  it('rounds up, because packs are indivisible', () => {
    // Target defaults to reorderAt × 2 = 20; stock 8; shortfall 12; per pack 24.
    expect(packsToReorder(sardines)).toBe(1);
  });

  it('buys enough to clear the shortfall, never one pack short', () => {
    const low: Item = { ...shampoo, stock: 0, reorderAt: 20, perPack: 12 };
    // Target 40, shortfall 40, 40/12 = 3.33… → 4 packs (48), not 3 (36).
    expect(packsToReorder(low)).toBe(4);
    expect(4 * low.perPack).toBeGreaterThanOrEqual(40);
  });

  it('returns zero when stock is already above target', () => {
    expect(packsToReorder({ ...shampoo, stock: 500 })).toBe(0);
  });

  it('returns zero for a nonsensical pack size', () => {
    expect(packsToReorder({ ...shampoo, perPack: 0 })).toBe(0);
  });
});

describe('restockCost', () => {
  it('multiplies whole packs by the buy price', () => {
    expect(restockCost(sardines, 3)).toBe(750);
  });

  it('never returns a negative cost', () => {
    expect(restockCost(sardines, -3)).toBe(0);
  });

  it('truncates fractional packs rather than producing fractional pesos', () => {
    expect(restockCost(sardines, 2.9)).toBe(500);
    expect(Number.isInteger(restockCost(sardines, 2.9))).toBe(true);
  });
});

describe('stock predicates', () => {
  it('treats the reorder point itself as below', () => {
    // At exactly the threshold the shopkeeper should already be buying.
    expect(isBelowReorder({ ...shampoo, stock: 12 })).toBe(true);
    expect(isBelowReorder({ ...shampoo, stock: 13 })).toBe(false);
  });

  it('treats a negative count as out of stock, not as stock', () => {
    // Oversell can drive the count below zero before a sync corrects it.
    expect(isOutOfStock({ ...shampoo, stock: -2 })).toBe(true);
    expect(isOutOfStock({ ...shampoo, stock: 0 })).toBe(true);
    expect(isOutOfStock({ ...shampoo, stock: 1 })).toBe(false);
  });
});
