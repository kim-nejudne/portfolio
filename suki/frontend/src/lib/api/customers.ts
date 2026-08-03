// Customers API. Read-only; derived balance comes from ledger.
import { CUSTOMERS } from './fixtures/customers';
import { LEDGER } from './fixtures/ledger';
import { delay } from './delay';
import type { Customer, LedgerEntry } from '@suki/domain';

export async function listCustomers(): Promise<Customer[]> {
  return delay(CUSTOMERS);
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  return delay(CUSTOMERS.find((c) => c.id === id));
}

/** Sum of purchases minus payments across the seeded ledger. Integers. */
function persistedBalance(customerId: string): number {
  let balance = 0;
  for (const e of LEDGER) {
    if (e.customerId !== customerId) continue;
    if (e.kind === 'purchase') balance += e.amount;
    else balance -= e.amount;
  }
  return balance;
}

export async function getPersistedBalance(customerId: string): Promise<number> {
  return delay(persistedBalance(customerId));
}

export async function listCustomersWithBalance(
  extra: LedgerEntry[] = [],
): Promise<Array<Customer & { balance: number; lastPaymentAt: string | null; lastActivityAt: string | null }>> {
  const combined = [...LEDGER, ...extra];
  const enriched = CUSTOMERS.map((c) => {
    const entries = combined.filter((e) => e.customerId === c.id);
    let balance = 0;
    let lastPaymentAt: string | null = null;
    let lastActivityAt: string | null = null;
    for (const e of entries) {
      if (e.kind === 'purchase') balance += e.amount;
      else balance -= e.amount;
      if (!lastActivityAt || e.createdAt > lastActivityAt) lastActivityAt = e.createdAt;
      if (e.kind === 'payment' && (!lastPaymentAt || e.createdAt > lastPaymentAt)) lastPaymentAt = e.createdAt;
    }
    return { ...c, balance, lastPaymentAt, lastActivityAt };
  });
  return delay(enriched);
}
