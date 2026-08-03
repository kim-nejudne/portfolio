// Today's activity aggregation for /day.
import { TODAY_CASH_SALES } from './fixtures/day';
import { history } from './queue';
import { LEDGER } from './fixtures/ledger';
import { getSessionSync } from './session';
import { delay } from './delay';
import type {
  CashSalePayload,
  CreditSalePayload,
  PaymentPayload,
} from '@suki/domain';

export interface DaySummary {
  isoDate: string;
  cashTotal: number;
  creditExtended: number;
  paymentsReceived: number;
  totalTransactions: number;
  expectedCashInTin: number;
}

export async function getDaySummary(): Promise<DaySummary> {
  const isoDate = getSessionSync().today.slice(0, 10);

  const seededCash = TODAY_CASH_SALES
    .filter((s) => s.createdAt.slice(0, 10) === isoDate)
    .reduce((sum, s) => sum + s.total, 0);

  const seededTxCount = TODAY_CASH_SALES.filter((s) => s.createdAt.slice(0, 10) === isoDate).length;

  let cashTotal = seededCash;
  let creditExtended = 0;
  let paymentsReceived = 0;
  let extraTx = 0;

  for (const op of history()) {
    if (op.createdAt.slice(0, 10) !== isoDate) continue;
    extraTx += 1;
    if (op.type === 'cash-sale') {
      const p = op.payload as CashSalePayload;
      cashTotal += p.total;
    } else if (op.type === 'credit-sale') {
      const p = op.payload as CreditSalePayload;
      creditExtended += p.total;
    } else if (op.type === 'payment') {
      const p = op.payload as PaymentPayload;
      paymentsReceived += p.amount;
      cashTotal += p.amount; // payments are cash-in
    }
  }

  // Reflect any seeded ledger payments/purchases on the same day, if any.
  for (const entry of LEDGER) {
    if (entry.createdAt.slice(0, 10) !== isoDate) continue;
    if (entry.kind === 'payment') {
      paymentsReceived += entry.amount;
      cashTotal += entry.amount;
    } else {
      creditExtended += entry.amount;
    }
  }

  return delay({
    isoDate,
    cashTotal,
    creditExtended,
    paymentsReceived,
    totalTransactions: seededTxCount + extraTx,
    expectedCashInTin: cashTotal,
  });
}
