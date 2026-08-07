import { describe, expect, it } from 'vitest';
import {
  deriveBalance,
  entrySignedAmount,
  isSettled,
  totalOutstanding,
  withRunningBalance,
} from './ledger';
import type { LedgerEntry } from './types';

function entry(over: Partial<LedgerEntry> & Pick<LedgerEntry, 'kind' | 'amount'>): LedgerEntry {
  return {
    id: over.id ?? `e-${over.kind}-${over.amount}-${over.createdAt ?? ''}`,
    customerId: over.customerId ?? 'cus-1',
    createdAt: over.createdAt ?? '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

const utang: LedgerEntry[] = [
  entry({ kind: 'purchase', amount: 120, createdAt: '2026-07-28T09:00:00.000Z' }),
  entry({ kind: 'purchase', amount: 65, createdAt: '2026-07-29T11:30:00.000Z' }),
  entry({ kind: 'payment', amount: 100, createdAt: '2026-07-31T17:05:00.000Z' }),
  entry({ kind: 'purchase', amount: 40, createdAt: '2026-08-01T08:15:00.000Z' }),
];

describe('entrySignedAmount', () => {
  it('adds purchases and subtracts payments', () => {
    expect(entrySignedAmount(entry({ kind: 'purchase', amount: 120 }))).toBe(120);
    expect(entrySignedAmount(entry({ kind: 'payment', amount: 120 }))).toBe(-120);
  });
});

describe('deriveBalance', () => {
  it('sums a real lista', () => {
    expect(deriveBalance(utang)).toBe(125); // 120 + 65 − 100 + 40
  });

  it('is zero for a customer with no entries', () => {
    expect(deriveBalance([])).toBe(0);
  });

  /**
   * The load-bearing property of the whole offline design.
   *
   * Two phones behind the same counter, both offline, both recording. Their
   * operations reach the server interleaved in an order neither device chose,
   * and a pull replays them in the server's order rather than either client's.
   * If the balance depended on order, every reconnect would be a chance for the
   * two devices to disagree about what somebody owes — and nothing in the app
   * could tell which one was right.
   *
   * It does not, because this is a sum. Asserted over every permutation rather
   * than a couple of hand-picked shuffles, so the claim is checked and not just
   * written down.
   */
  it('gives the same balance for every possible ordering', () => {
    const permutations = permute(utang);
    expect(permutations).toHaveLength(24);
    const balances = new Set(permutations.map(deriveBalance));
    expect([...balances]).toEqual([125]);
  });

  /**
   * The other half of the same idea: an operation that arrives twice must not
   * count twice. Dedup happens by operation id before entries reach here, so
   * this asserts the consequence — the caller's job is to pass a set, and a
   * duplicated entry is visibly wrong rather than quietly absorbed.
   */
  it('counts a duplicated entry twice, which is why dedup happens by id upstream', () => {
    const doubled = [...utang, utang[0]!];
    expect(deriveBalance(doubled)).toBe(245);

    const deduped = [...new Map(doubled.map((e) => [e.id, e])).values()];
    expect(deriveBalance(deduped)).toBe(125);
  });

  it('goes negative when a customer overpays', () => {
    // Handing over a ₱500 note against ₱125 of utang is normal; the change is
    // left on the lista as credit rather than counted out in coins.
    expect(deriveBalance([...utang, entry({ kind: 'payment', amount: 500 })])).toBe(-375);
  });
});

describe('withRunningBalance', () => {
  it('orders oldest first regardless of input order and accumulates down the column', () => {
    const rows = withRunningBalance([...utang].reverse());
    expect(rows.map((r) => r.runningBalance)).toEqual([120, 185, 85, 125]);
    expect(rows.map((r) => r.createdAt)).toEqual([...utang].map((e) => e.createdAt));
  });

  it('ends on the same number deriveBalance returns', () => {
    const rows = withRunningBalance(utang);
    expect(rows.at(-1)?.runningBalance).toBe(deriveBalance(utang));
  });

  it('does not mutate the input array', () => {
    const input = [...utang].reverse();
    const before = input.map((e) => e.id);
    withRunningBalance(input);
    expect(input.map((e) => e.id)).toEqual(before);
  });

  it('returns an empty column for an empty lista', () => {
    expect(withRunningBalance([])).toEqual([]);
  });
});

describe('totalOutstanding', () => {
  it('sums what is owed', () => {
    expect(totalOutstanding([125, 40, 0])).toBe(165);
  });

  /**
   * Customers in credit must not offset customers in debt. The shop is owed
   * ₱125 whether or not somebody else overpaid; netting them would understate
   * the money actually out on the street.
   */
  it('ignores credit balances rather than netting them off', () => {
    expect(totalOutstanding([125, -375])).toBe(125);
  });
});

describe('isSettled', () => {
  it('counts zero and credit as settled, any debt as not', () => {
    expect(isSettled(0)).toBe(true);
    expect(isSettled(-375)).toBe(true);
    expect(isSettled(1)).toBe(false);
  });
});

function permute<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permute([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}
