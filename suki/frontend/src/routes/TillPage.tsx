import { useMemo, useState } from 'react';
import { useAsync } from '../lib/useAsync';
import { listItems } from '../lib/api/items';
import { listCustomersWithBalance } from '../lib/api/customers';
import { collectQueueEntries } from '../lib/api/ledger';
import { recordCashSale, recordCreditSale } from '../lib/api/sales';
import { getSessionSync } from '../lib/api/session';
import { formatPeso } from '../lib/money';
import type { Item, SaleItem } from '../lib/types';
import { MonogramChip } from '../components/MonogramChip';
import { BigButton } from '../components/BigButton';
import { CustomerPicker } from '../components/CustomerPicker';
import { useNavigate } from 'react-router-dom';

interface LineState {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export function TillPage() {
  const { data: items, loaded } = useAsync(() => listItems(), []);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<LineState[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const navigate = useNavigate();

  const inStock = (items ?? []).filter((i) => i.stock > 0);
  const filtered = query.trim()
    ? inStock.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : inStock;

  const total = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), [lines]);

  function addOne(item: Item) {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { itemId: item.id, name: item.name, qty: 1, unitPrice: item.sellPrice }];
    });
    setFlash(item.id);
    window.setTimeout(() => setFlash(null), 200);
  }

  function incrementByLine(itemId: string) {
    setLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l)),
    );
    setFlash(itemId);
    window.setTimeout(() => setFlash(null), 200);
  }

  function removeOne(itemId: string) {
    setLines((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function reset() {
    setLines([]);
    setQuery('');
  }

  function completeCash() {
    if (lines.length === 0) return;
    const items: SaleItem[] = lines.map((l) => ({
      itemId: l.itemId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.qty * l.unitPrice,
    }));
    recordCashSale({ items, total });
    reset();
  }

  function completeCredit(customerId: string) {
    if (lines.length === 0) return;
    const items: SaleItem[] = lines.map((l) => ({
      itemId: l.itemId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.qty * l.unitPrice,
    }));
    recordCreditSale({ items, total, customerId });
    setPickerOpen(false);
    reset();
    navigate(`/lista/${customerId}`);
  }

  const { data: customers } = useAsync(() => listCustomersWithBalance(collectQueueEntries()), []);
  const today = getSessionSync().today;

  return (
    <>
      <div className="rule px-4 pt-4 pb-3" style={{ background: 'var(--color-paper)' }}>
        <h1 className="text-[22px] leading-tight">Till</h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items"
          aria-label="Search items"
          className="mt-2 w-full mono text-[15px] px-3"
          style={{
            minHeight: 'var(--tap-min)',
            border: '1px solid var(--color-rule)',
            borderRadius: 'var(--radius-tap)',
            background: 'transparent',
          }}
          data-testid="till-search"
        />
      </div>

      <div className="px-4 py-3" style={{ paddingBottom: lines.length > 0 ? 220 : 24 }}>
        {!loaded ? (
          <p className="text-muted text-[14px]">Reading the shelf…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-[14px]">No items match “{query}”.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3" data-testid="till-grid">
            {filtered.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => addOne(it)}
                  className={`w-full text-left ${flash === it.id ? 'anim-bump' : ''}`}
                  style={{
                    minHeight: 96,
                    padding: 12,
                    border: '1px solid var(--color-rule)',
                    borderRadius: 'var(--radius-tap)',
                    background: 'var(--color-paper)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                  data-testid={`till-item-${it.id}`}
                >
                  <div className="flex items-start gap-2">
                    <MonogramChip name={it.name} size={36} />
                    <span className="text-[13px] leading-tight line-clamp-2">{it.name}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-auto">
                    <span className="amount text-[18px]">{formatPeso(it.sellPrice)}</span>
                    <span className="mono text-[11px] text-muted">{it.stock} left</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lines.length > 0 && (
        <SaleTray
          lines={lines}
          total={total}
          onIncrement={incrementByLine}
          onDecrement={removeOne}
          onCash={completeCash}
          onCredit={() => setPickerOpen(true)}
          onClear={reset}
        />
      )}

      {pickerOpen && customers && (
        <CustomerPicker
          today={today}
          customers={customers}
          onPick={(id) => completeCredit(id)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

interface TrayProps {
  lines: LineState[];
  total: number;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onCash: () => void;
  onCredit: () => void;
  onClear: () => void;
}

function SaleTray({ lines, total, onIncrement, onDecrement, onCash, onCredit, onClear }: TrayProps) {
  return (
    <aside
      aria-label="Current sale"
      className="fixed left-0 right-0 anim-slide-in"
      style={{
        bottom: 'var(--bottom-bar-height)',
        background: 'var(--color-paper)',
        borderTop: '1px solid var(--color-rule)',
      }}
    >
      <div style={{ maxHeight: '32dvh', overflowY: 'auto' }}>
        <ul>
          {lines.map((l) => (
            <li key={l.itemId} className="rule px-4 py-2 flex items-center gap-3">
              <span className="flex-1 truncate text-[14px]">{l.name}</span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label={`Remove one ${l.name}`}
                  onClick={() => onDecrement(l.itemId)}
                  className="mono text-[18px]" style={{ minWidth: 'var(--tap-min)', minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)' }}>−</button>
                <span className="mono text-[15px] w-8 text-center">{l.qty}</span>
                <button type="button" aria-label={`Add one more ${l.name}`}
                  onClick={() => onIncrement(l.itemId)}
                  className="mono text-[18px]" style={{ minWidth: 'var(--tap-min)', minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)' }}>+</button>
              </div>
              <span className="amount text-[15px] w-16">{formatPeso(l.qty * l.unitPrice)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-4 py-3 flex items-center justify-between rule">
        <button type="button" onClick={onClear} className="mono text-[12px] uppercase text-muted"
          style={{ minHeight: 'var(--tap-min)' }}>Clear</button>
        <div className="text-right">
          <p className="mono uppercase text-[11px] text-muted">Total</p>
          <p className="amount text-[28px]" data-testid="till-total">{formatPeso(total)}</p>
        </div>
      </div>
      <div className="px-4 pt-1 pb-3 flex gap-2">
        <BigButton variant="outline" onClick={onCredit} data-testid="till-lista" style={{ flex: 1 }}>Lista</BigButton>
        <BigButton variant="ink" onClick={onCash} data-testid="till-bayad" style={{ flex: 1 }}>Bayad</BigButton>
      </div>
    </aside>
  );
}
