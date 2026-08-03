// Stock API. Movement list + adjustment writes.
import { STOCK_MOVEMENTS } from './fixtures/stock';
import { delay } from './delay';
import type { StockAdjustmentPayload, StockMovement } from '@suki/domain';
import { enqueue } from './queue';
import { adjustStockOverlay } from './items';
import { getSessionSync } from './session';

// New movements from queued operations, appended in memory.
const extraMovements: StockMovement[] = [];

export async function listMovements(itemId: string): Promise<StockMovement[]> {
  const combined = [...STOCK_MOVEMENTS, ...extraMovements]
    .filter((m) => m.itemId === itemId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(combined);
}

export function recordStockAdjustment(payload: StockAdjustmentPayload): void {
  const id = crypto.randomUUID();
  const createdAt = getSessionSync().today;
  extraMovements.push({ id, itemId: payload.itemId, kind: payload.kind, qty: payload.qty, createdAt, ...(payload.note ? { note: payload.note } : {}) });
  // deliveries add, sale/spoilage/adjustment subtract
  const delta = payload.kind === 'delivery' ? payload.qty : -payload.qty;
  adjustStockOverlay(payload.itemId, delta);
  enqueue({ id, type: 'stock-adjustment', payload, createdAt });
}
