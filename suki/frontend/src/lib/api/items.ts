// Items API. Reads from fixtures; buyPrice changes go through queue.
import { ITEMS } from './fixtures/items';
import { delay } from './delay';
import type { Item, BuyPriceChangePayload } from '@suki/domain';
import { enqueue } from './queue';
import { getSessionSync } from './session';

// Local overlay for queued mutations (buy price + stock adjustments).
const buyPriceOverlay = new Map<string, number>();
const stockOverlay = new Map<string, number>();

function applyOverlays(item: Item): Item {
  const buyPrice = buyPriceOverlay.get(item.id) ?? item.buyPrice;
  const stock = stockOverlay.get(item.id) ?? item.stock;
  return { ...item, buyPrice, stock };
}

export async function listItems(): Promise<Item[]> {
  return delay(ITEMS.map(applyOverlays));
}

export async function getItem(id: string): Promise<Item | undefined> {
  const found = ITEMS.find((i) => i.id === id);
  return delay(found ? applyOverlays(found) : undefined);
}

export function changeBuyPrice(itemId: string, buyPrice: number): void {
  buyPriceOverlay.set(itemId, buyPrice);
  const payload: BuyPriceChangePayload = { itemId, buyPrice };
  enqueue({
    id: crypto.randomUUID(),
    type: 'buy-price-change',
    payload,
    createdAt: getSessionSync().today,
  });
}

/** Called by sales/adjustments to update the in-memory stock overlay. Not itself a write. */
export function adjustStockOverlay(itemId: string, delta: number): void {
  const current = stockOverlay.get(itemId);
  const base = ITEMS.find((i) => i.id === itemId)?.stock ?? 0;
  const next = (current ?? base) + delta;
  stockOverlay.set(itemId, next < 0 ? 0 : next);
}
