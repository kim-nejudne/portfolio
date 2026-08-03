/**
 * Balance derivation.
 *
 * A customer's balance is never stored. It is the sum of their ledger entries,
 * recomputed on every read — purchases add, payments subtract. That is what
 * makes the offline queue safe: an operation that arrives late, or twice, or
 * out of order still produces the same number, because addition does not care
 * about any of those things.
 *
 * The server derives balances with this same function. If it did not, an
 * offline device and the server could disagree about what somebody owes, and
 * the shop would trust whichever one it happened to be looking at.
 */
import type { LedgerEntry, Peso } from './types';

/** Purchases add to what is owed; payments reduce it. */
export function entrySignedAmount(entry: LedgerEntry): Peso {
  return entry.kind === 'purchase' ? entry.amount : -entry.amount;
}

/**
 * The balance after a set of entries.
 *
 * Order-independent on purpose — this is a sum, and sums commute. That property
 * is the entire reason this design survives an unreliable connection, and it is
 * worth stating rather than leaving implicit.
 */
export function deriveBalance(entries: readonly LedgerEntry[]): Peso {
  let balance = 0;
  for (const entry of entries) balance += entrySignedAmount(entry);
  return balance;
}

/**
 * The same entries with a running balance attached, oldest first — the column
 * down the right-hand side of the page, exactly as it would be written by hand.
 */
export function withRunningBalance<T extends LedgerEntry>(
  entries: readonly T[],
): (T & { runningBalance: Peso })[] {
  const ordered = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let balance = 0;
  return ordered.map((entry) => {
    balance += entrySignedAmount(entry);
    return { ...entry, runningBalance: balance };
  });
}

/** Total credit the shop has out, across everyone. */
export function totalOutstanding(balances: readonly Peso[]): Peso {
  return balances.reduce((sum, balance) => sum + Math.max(0, balance), 0);
}

/**
 * A customer is settled when their balance is zero or they are in credit.
 * Negative balances happen — somebody overpays to round up a note — and they
 * are not debts.
 */
export function isSettled(balance: Peso): boolean {
  return balance <= 0;
}
