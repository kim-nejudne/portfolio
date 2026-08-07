// Sales API. Cash sales + credit sales both flow through the queue.
// Stock is decremented via the items overlay.
//
// These await the durable write rather than firing it off. A shopkeeper who
// sees a sale land on screen has to be able to trust that killing the app on
// the next tap does not lose it — and the window between an optimistic render
// and an IndexedDB commit is small, but it is exactly the window a dying phone
// falls into.

import { enqueue } from './queue';
import { adjustStockOverlay } from './items';
import { getSessionSync } from './session';
import type { CashSalePayload, CreditSalePayload, PaymentPayload } from '@suki/domain';

export async function recordCashSale(payload: CashSalePayload): Promise<string> {
  const id = crypto.randomUUID();
  for (const line of payload.items) adjustStockOverlay(line.itemId, -line.qty);
  await enqueue({ id, type: 'cash-sale', payload, createdAt: getSessionSync().today });
  return id;
}

export async function recordCreditSale(payload: CreditSalePayload): Promise<string> {
  const id = crypto.randomUUID();
  for (const line of payload.items) adjustStockOverlay(line.itemId, -line.qty);
  await enqueue({ id, type: 'credit-sale', payload, createdAt: getSessionSync().today });
  return id;
}

export async function recordPayment(payload: PaymentPayload): Promise<string> {
  const id = crypto.randomUUID();
  await enqueue({ id, type: 'payment', payload, createdAt: getSessionSync().today });
  return id;
}
