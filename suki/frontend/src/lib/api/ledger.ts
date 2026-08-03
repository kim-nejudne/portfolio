// Ledger API. Reads combine the seeded fixture with any queued ops that
// touch a customer's account (credit sale or payment). Nothing else writes.

import { LEDGER } from './fixtures/ledger';
import { delay } from './delay';
import type {
  LedgerEntry,
  Operation,
  PaymentPayload,
  CreditSalePayload,
} from '../types';
import { history } from './queue';

function opToEntry(op: Operation): LedgerEntry | null {
  if (op.type === 'credit-sale') {
    const p = op.payload as CreditSalePayload;
    return {
      id: `op-${op.id}`,
      customerId: p.customerId,
      kind: 'purchase',
      amount: p.total,
      createdAt: op.createdAt,
      items: p.items,
      operationId: op.id,
    };
  }
  if (op.type === 'payment') {
    const p = op.payload as PaymentPayload;
    return {
      id: `op-${op.id}`,
      customerId: p.customerId,
      kind: 'payment',
      amount: p.amount,
      createdAt: op.createdAt,
      operationId: op.id,
    };
  }
  return null;
}

export function collectQueueEntries(): LedgerEntry[] {
  return history()
    .map(opToEntry)
    .filter((e): e is LedgerEntry => e !== null);
}

export async function listEntries(customerId: string): Promise<LedgerEntry[]> {
  const seeded = LEDGER.filter((e) => e.customerId === customerId);
  const queued = collectQueueEntries().filter((e) => e.customerId === customerId);
  const combined = [...seeded, ...queued].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return delay(combined);
}

export function balanceFor(customerId: string): number {
  let balance = 0;
  for (const e of LEDGER) {
    if (e.customerId !== customerId) continue;
    if (e.kind === 'purchase') balance += e.amount;
    else balance -= e.amount;
  }
  for (const e of collectQueueEntries()) {
    if (e.customerId !== customerId) continue;
    if (e.kind === 'purchase') balance += e.amount;
    else balance -= e.amount;
  }
  return balance;
}

/** Whether a ledger entry is a live queue op (still pending). */
export function entryStatus(entry: LedgerEntry): 'seeded' | 'pending' | 'synced' {
  if (!entry.operationId) return 'seeded';
  const op = history().find((o) => o.id === entry.operationId);
  if (!op) return 'seeded';
  return op.status === 'pending' ? 'pending' : 'synced';
}
