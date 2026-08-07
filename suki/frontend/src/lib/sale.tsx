/**
 * The sale in progress.
 *
 * This used to be `useState` inside `TillPage`, which was fine while the lines
 * were drawn on top of the Till. They are not any more: the list moved to its
 * own page, and state that lives in a route dies when you leave it. So the sale
 * lifts to the shell — one provider above both screens.
 *
 * It is also **persisted**, and that is not gold-plating. The target phone is a
 * cheap Android with the shop's Facebook page open in another tab; backgrounding
 * a PWA on that device to check a customer's message is enough to have the tab
 * evicted. Losing a committed sale would be a correctness bug and the queue
 * already prevents it — but losing eight items you just walked the shelf for is
 * the same amount of re-work, and nothing was protecting it.
 *
 * The write is deliberately fire-and-forget, unlike everything in `sales.ts`.
 * A draft is not a promise: if the last tap before the phone dies does not make
 * it to disk, the shopkeeper adds that one item again. Awaiting an IndexedDB
 * round trip on every `+` tap to protect against that would be the wrong trade
 * on the screen used a hundred times a day.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { db } from './api/db';
import type { Item, SaleItem } from '@suki/domain';

export interface SaleLine {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

interface SaleContextValue {
  lines: SaleLine[];
  /** Pesos. */
  total: number;
  /** Things on the counter, not distinct products — it is what gets counted. */
  count: number;
  /** False until the stored draft has been read back. */
  hydrated: boolean;
  add: (item: Item) => void;
  increment: (itemId: string) => void;
  decrement: (itemId: string) => void;
  clear: () => void;
  toSaleItems: () => SaleItem[];
}

const SaleContext = createContext<SaleContextValue | null>(null);

const DRAFT_KEY = 'draft';

/**
 * Anything that has been through `JSON.parse` is unknown, and this one survives
 * deploys — a draft written by yesterday's bundle is read by today's. Shape is
 * checked rather than asserted, and a row that fails is dropped silently: a
 * malformed draft must never be able to stop the till from opening.
 */
function isLine(v: unknown): v is SaleLine {
  if (typeof v !== 'object' || v === null) return false;
  const l = v as Record<string, unknown>;
  return (
    typeof l.itemId === 'string' &&
    typeof l.name === 'string' &&
    typeof l.qty === 'number' &&
    Number.isInteger(l.qty) &&
    l.qty > 0 &&
    typeof l.unitPrice === 'number' &&
    Number.isInteger(l.unitPrice)
  );
}

async function readDraft(): Promise<SaleLine[]> {
  try {
    const row = await db.meta.get(DRAFT_KEY);
    if (!row) return [];
    const parsed: unknown = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter(isLine) : [];
  } catch {
    return [];
  }
}

export function SaleProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readDraft().then((stored) => {
      if (cancelled) return;
      if (stored.length > 0) setLines(stored);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Skip the first write. Without this the empty initial state is flushed to
  // disk before the read comes back, and the provider erases the draft it was
  // mounted to restore.
  const written = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!written.current) {
      written.current = true;
      return;
    }
    void db.meta.put({ key: DRAFT_KEY, value: JSON.stringify(lines) }).catch(() => {
      /* A draft that cannot be saved is still a usable draft in memory. */
    });
  }, [lines, hydrated]);

  const add = useCallback((item: Item) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) return prev.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { itemId: item.id, name: item.name, qty: 1, unitPrice: item.sellPrice }];
    });
  }, []);

  const increment = useCallback((itemId: string) => {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l)));
  }, []);

  const decrement = useCallback((itemId: string) => {
    setLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const total = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), [lines]);
  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);

  const toSaleItems = useCallback(
    (): SaleItem[] =>
      lines.map((l) => ({
        itemId: l.itemId,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.qty * l.unitPrice,
      })),
    [lines],
  );

  const value = useMemo(
    () => ({ lines, total, count, hydrated, add, increment, decrement, clear, toSaleItems }),
    [lines, total, count, hydrated, add, increment, decrement, clear, toSaleItems],
  );

  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

export function useSale(): SaleContextValue {
  const ctx = useContext(SaleContext);
  if (!ctx) throw new Error('useSale must be used inside a SaleProvider');
  return ctx;
}
