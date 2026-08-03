// Sales API. Cash sales + credit sales both flow through the queue.
// Stock is decremented via the items overlay.

import { enqueue } from './queue';
import { adjustStockOverlay } from './items';
import { getSessionSync } from './session';
import type { CashSalePayload, CreditSalePayload, PaymentPayload } from '../types';

export function recordCashSale(payload: CashSalePayload): string {
  const id = crypto.randomUUID();
  for (const line of payload.items) adjustStockOverlay(line.itemId, -line.qty);
  enqueue({ id, type: 'cash-sale', payload, createdAt: getSessionSync().today });
  return id;
}

export function recordCreditSale(payload: CreditSalePayload): string {
  const id = crypto.randomUUID();
  for (const line of payload.items) adjustStockOverlay(line.itemId, -line.qty);
  enqueue({ id, type: 'credit-sale', payload, createdAt: getSessionSync().today });
  return id;
}

export function recordPayment(payload: PaymentPayload): string {
  const id = crypto.randomUUID();
  enqueue({ id, type: 'payment', payload, createdAt: getSessionSync().today });
  return id;
}
