/**
 * Projections from the operation log into the shapes screens and reports read.
 *
 * These live here rather than in the web app because the server derives the
 * same things from the same log. If the phone projected a credit sale into a
 * ledger entry one way and the server another, the two would disagree about a
 * balance while both believing they were right — and there would be no way to
 * tell which. One function, both sides.
 */
import type {
  BuyPriceChangePayload,
  CashSalePayload,
  CreditSalePayload,
  Item,
  LedgerEntry,
  Operation,
  PaymentPayload,
  Peso,
  StockAdjustmentPayload,
} from './types';

/**
 * A ledger entry for the operations that move money between the shop and a
 * customer. Cash sales return null: they settle at the counter and never touch
 * anybody's utang.
 */
export function ledgerEntryFromOperation(op: Operation): LedgerEntry | null {
  if (op.type === 'credit-sale') {
    const payload = op.payload as CreditSalePayload;
    return {
      id: `op-${op.id}`,
      customerId: payload.customerId,
      kind: 'purchase',
      amount: payload.total,
      createdAt: op.createdAt,
      items: payload.items,
      operationId: op.id,
    };
  }
  if (op.type === 'payment') {
    const payload = op.payload as PaymentPayload;
    return {
      id: `op-${op.id}`,
      customerId: payload.customerId,
      kind: 'payment',
      amount: payload.amount,
      createdAt: op.createdAt,
      operationId: op.id,
    };
  }
  return null;
}

/**
 * How much an operation moves an item's stock, in sell units.
 *
 * Sales subtract, deliveries add, spoilage subtracts. A single function so the
 * shelf count on the phone and the shelf count on the server cannot drift.
 */
export function stockDeltaFromOperation(op: Operation, itemId: string): number {
  if (op.type === 'cash-sale' || op.type === 'credit-sale') {
    const payload = op.payload as CashSalePayload;
    const sold = (payload.items ?? [])
      .filter((line) => line.itemId === itemId)
      .reduce((sum, line) => sum + line.qty, 0);
    // `-sold` is -0 when nothing matched. It sums correctly, but it renders as
    // "-0" and breaks Object.is comparisons, so it is normalised here rather
    // than left for a caller to trip over.
    return sold === 0 ? 0 : -sold;
  }
  if (op.type === 'stock-adjustment') {
    const payload = op.payload as StockAdjustmentPayload;
    if (payload.itemId !== itemId) return 0;
    // A delivery adds; everything else takes away. `qty` is always positive and
    // the kind carries the direction, so a malformed sign cannot silently
    // inflate the shelf.
    return payload.kind === 'delivery' ? Math.abs(payload.qty) : -Math.abs(payload.qty);
  }
  return 0;
}

/** The buy price after any price-change operations, latest wins. */
export function buyPriceFromOperations(item: Item, ops: readonly Operation[]): Peso {
  let price = item.buyPrice;
  for (const op of ops) {
    if (op.type !== 'buy-price-change') continue;
    const payload = op.payload as BuyPriceChangePayload;
    if (payload.itemId === item.id) price = payload.buyPrice;
  }
  return price;
}

/** An item with every pending and applied operation folded in. */
export function applyOperationsToItem(item: Item, ops: readonly Operation[]): Item {
  let stock = item.stock;
  for (const op of ops) stock += stockDeltaFromOperation(op, item.id);
  return { ...item, stock, buyPrice: buyPriceFromOperations(item, ops) };
}
