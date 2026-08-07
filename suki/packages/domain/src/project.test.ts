import { describe, expect, it } from 'vitest';
import {
  applyOperationsToItem,
  buyPriceFromOperations,
  ledgerEntryFromOperation,
  stockDeltaFromOperation,
} from './project';
import { deriveBalance } from './ledger';
import type { Item, LedgerEntry, Operation } from './types';

const item: Item = {
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

function op<P>(type: Operation['type'], payload: P, id = `op-${type}-${JSON.stringify(payload)}`): Operation {
  return { id, type, payload, createdAt: '2026-08-01T08:00:00.000Z', status: 'pending' };
}

const creditSale = op('credit-sale', {
  customerId: 'cus-1',
  total: 40,
  items: [{ itemId: 'itm-shampoo', name: 'Sunsilk Sachet', qty: 4, unitPrice: 10, lineTotal: 40 }],
});

const cashSale = op('cash-sale', {
  total: 20,
  items: [{ itemId: 'itm-shampoo', name: 'Sunsilk Sachet', qty: 2, unitPrice: 10, lineTotal: 20 }],
});

const payment = op('payment', { customerId: 'cus-1', amount: 25 });

describe('ledgerEntryFromOperation', () => {
  it('turns a credit sale into a purchase against the customer', () => {
    const entry = ledgerEntryFromOperation(creditSale);
    expect(entry).toMatchObject({ customerId: 'cus-1', kind: 'purchase', amount: 40 });
    expect(entry?.operationId).toBe(creditSale.id);
  });

  it('turns a payment into a payment entry', () => {
    expect(ledgerEntryFromOperation(payment)).toMatchObject({ kind: 'payment', amount: 25 });
  });

  /**
   * A cash sale settles at the counter and must never touch anybody's utang.
   * Projecting it into the ledger would inflate what a customer owes by the
   * value of everything else sold that day.
   */
  it('returns null for operations that do not move credit', () => {
    expect(ledgerEntryFromOperation(cashSale)).toBeNull();
    expect(ledgerEntryFromOperation(op('stock-adjustment', { itemId: item.id, kind: 'delivery', qty: 24 }))).toBeNull();
    expect(ledgerEntryFromOperation(op('buy-price-change', { itemId: item.id, buyPrice: 104 }))).toBeNull();
  });

  it('derives a balance from projected entries alone', () => {
    const entries = [creditSale, cashSale, payment]
      .map(ledgerEntryFromOperation)
      .filter((e): e is LedgerEntry => e !== null);
    expect(entries).toHaveLength(2);
    expect(deriveBalance(entries)).toBe(15); // 40 − 25, the cash sale excluded
  });

  /**
   * Two devices projecting the same operation must produce the same entry id,
   * or dedup-by-id fails and the balance doubles.
   */
  it('derives a stable entry id from the operation id', () => {
    expect(ledgerEntryFromOperation(creditSale)?.id).toBe(ledgerEntryFromOperation(creditSale)?.id);
    expect(ledgerEntryFromOperation(creditSale)?.id).toContain(creditSale.id);
  });
});

describe('stockDeltaFromOperation', () => {
  it('subtracts sold units for both sale kinds', () => {
    expect(stockDeltaFromOperation(creditSale, item.id)).toBe(-4);
    expect(stockDeltaFromOperation(cashSale, item.id)).toBe(-2);
  });

  it('ignores lines for other items', () => {
    expect(stockDeltaFromOperation(creditSale, 'itm-other')).toBe(0);
  });

  it('sums repeated lines for the same item within one sale', () => {
    const split = op('cash-sale', {
      total: 30,
      items: [
        { itemId: item.id, name: item.name, qty: 1, unitPrice: 10, lineTotal: 10 },
        { itemId: item.id, name: item.name, qty: 2, unitPrice: 10, lineTotal: 20 },
      ],
    });
    expect(stockDeltaFromOperation(split, item.id)).toBe(-3);
  });

  it('adds on delivery and subtracts on everything else', () => {
    expect(stockDeltaFromOperation(op('stock-adjustment', { itemId: item.id, kind: 'delivery', qty: 24 }), item.id)).toBe(24);
    expect(stockDeltaFromOperation(op('stock-adjustment', { itemId: item.id, kind: 'spoilage', qty: 3 }), item.id)).toBe(-3);
    expect(stockDeltaFromOperation(op('stock-adjustment', { itemId: item.id, kind: 'adjustment', qty: 5 }), item.id)).toBe(-5);
  });

  /**
   * The direction lives in `kind`, never in the sign of `qty`. A payload that
   * arrives with a negative quantity must not flip a spoilage into a delivery
   * and silently inflate the shelf.
   */
  it('takes direction from the kind, not the sign of qty', () => {
    expect(stockDeltaFromOperation(op('stock-adjustment', { itemId: item.id, kind: 'spoilage', qty: -3 }), item.id)).toBe(-3);
    expect(stockDeltaFromOperation(op('stock-adjustment', { itemId: item.id, kind: 'delivery', qty: -24 }), item.id)).toBe(24);
  });

  it('is zero for operations that do not move stock', () => {
    expect(stockDeltaFromOperation(payment, item.id)).toBe(0);
    expect(stockDeltaFromOperation(op('buy-price-change', { itemId: item.id, buyPrice: 104 }), item.id)).toBe(0);
  });
});

describe('buyPriceFromOperations', () => {
  it('keeps the item price when nothing changed it', () => {
    expect(buyPriceFromOperations(item, [creditSale, payment])).toBe(96);
  });

  it('takes the last change, not the first', () => {
    const ops = [
      op('buy-price-change', { itemId: item.id, buyPrice: 104 }, 'op-a'),
      op('buy-price-change', { itemId: item.id, buyPrice: 112 }, 'op-b'),
    ];
    expect(buyPriceFromOperations(item, ops)).toBe(112);
  });

  it('ignores changes to other items', () => {
    expect(buyPriceFromOperations(item, [op('buy-price-change', { itemId: 'itm-other', buyPrice: 1 })])).toBe(96);
  });
});

describe('applyOperationsToItem', () => {
  it('folds sales, deliveries and price changes into one shelf state', () => {
    const result = applyOperationsToItem(item, [
      creditSale, // −4
      cashSale, // −2
      op('stock-adjustment', { itemId: item.id, kind: 'delivery', qty: 24 }),
      op('stock-adjustment', { itemId: item.id, kind: 'spoilage', qty: 1 }),
      op('buy-price-change', { itemId: item.id, buyPrice: 104 }),
    ]);
    expect(result.stock).toBe(47); // 30 − 4 − 2 + 24 − 1
    expect(result.buyPrice).toBe(104);
  });

  it('does not mutate the item it was given', () => {
    applyOperationsToItem(item, [creditSale]);
    expect(item.stock).toBe(30);
    expect(item.buyPrice).toBe(96);
  });

  /**
   * Stock deltas are also a sum, so the shelf count survives arriving in the
   * server's order rather than the phone's — same property the balance relies
   * on. The buy price is deliberately *not* order-independent (last write
   * wins), which is why it is derived separately rather than folded in as a
   * delta.
   */
  it('reaches the same stock count in any order', () => {
    const ops = [
      creditSale,
      cashSale,
      op('stock-adjustment', { itemId: item.id, kind: 'delivery', qty: 24 }),
    ];
    const counts = new Set(permute(ops).map((o) => applyOperationsToItem(item, o).stock));
    expect([...counts]).toEqual([48]);
  });

  it('lets stock go negative rather than clamping an oversell to zero', () => {
    // Two offline phones can both sell the last sachet. A negative count is the
    // shop's evidence that happened; clamping would erase it.
    const oversold = applyOperationsToItem(
      { ...item, stock: 1 },
      [op('cash-sale', { total: 30, items: [{ itemId: item.id, name: item.name, qty: 3, unitPrice: 10, lineTotal: 30 }] })],
    );
    expect(oversold.stock).toBe(-2);
  });
});

function permute<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((x, i) =>
    permute([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]),
  );
}
