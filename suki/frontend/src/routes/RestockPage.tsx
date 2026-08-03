import { useMemo, useState } from 'react';
import { useAsync } from '../lib/useAsync';
import { listItems } from '../lib/api/items';
import { formatPeso } from '@suki/domain';
import { MonogramChip } from '../components/MonogramChip';
import type { Item } from '@suki/domain';

interface Row {
  item: Item;
  packsToBuy: number;
  packCost: number;
}

function packsNeeded(i: Item): number {
  if (i.stock >= i.reorderAt) return 0;
  const shortSellUnits = i.reorderAt - i.stock + i.perPack; // aim to overshoot by one pack
  return Math.max(1, Math.ceil(shortSellUnits / i.perPack));
}

export function RestockPage() {
  const { data: items, loaded } = useAsync(() => listItems(), []);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const rows: Row[] = useMemo(() => {
    return (items ?? [])
      .filter((i) => i.stock <= i.reorderAt)
      .map((i) => ({ item: i, packsToBuy: packsNeeded(i), packCost: packsNeeded(i) * i.buyPrice }))
      .sort((a, b) => b.packCost - a.packCost);
  }, [items]);

  const total = rows.reduce((s, r) => (checked.has(r.item.id) ? s : s + r.packCost), 0);
  const totalAll = rows.reduce((s, r) => s + r.packCost, 0);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <header className="rule px-4 pt-4 pb-3">
        <h1 className="text-[26px] leading-tight">Restock</h1>
        <p className="text-[14px] text-muted">Bring this list to the market. Tick as you go.</p>
      </header>

      {!loaded ? (
        <p className="px-4 py-6 text-muted">Reading the shelf…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-[15px]">Nothing to restock today. All shelves are above the mark.</p>
      ) : (
        <ul style={{ paddingBottom: 130 }} data-testid="restock-list">
          {rows.map(({ item, packsToBuy, packCost }) => {
            const isChecked = checked.has(item.id);
            return (
              <li key={item.id} className="rule">
                <label
                  className="flex items-center gap-3 px-4 py-4"
                  style={{ minHeight: 'var(--tap-min)', opacity: isChecked ? 0.5 : 1 }}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => toggle(item.id)}
                    data-testid={`restock-check-${item.id}`}
                  />
                  <span
                    aria-hidden
                    style={{
                      width: 28, height: 28, flex: '0 0 auto',
                      border: '2px solid var(--color-ink)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: isChecked ? 'var(--color-ink)' : 'transparent',
                      color: 'var(--color-paper)',
                      fontSize: 20,
                    }}
                  >
                    {isChecked ? '✓' : ''}
                  </span>
                  <MonogramChip name={item.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[17px] leading-tight"
                      style={{ textDecoration: isChecked ? 'line-through' : 'none' }}
                    >
                      {item.name}
                    </p>
                    <p className="mono text-[13px] text-muted" style={{ whiteSpace: 'nowrap' }}>
                      {packsToBuy} {item.buyUnit}{packsToBuy === 1 ? '' : 's'} &middot; {item.stock} left
                    </p>
                  </div>
                  <p className="amount text-[18px]" style={{ whiteSpace: 'nowrap' }}>{formatPeso(packCost)}</p>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <div
          className="fixed left-0 right-0 px-4 py-3"
          style={{
            bottom: 'var(--bottom-bar-height)',
            background: 'var(--color-paper)',
            borderTop: '1px solid var(--color-rule)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <p className="mono uppercase text-[11px] text-muted">Estimate</p>
            <p className="text-[12px] text-muted">{checked.size} of {rows.length} ticked</p>
          </div>
          <div className="text-right">
            <p className="amount text-[24px]" data-testid="restock-total">{formatPeso(total)}</p>
            {checked.size > 0 && (
              <p className="amount text-[11px] text-muted">all {formatPeso(totalAll)}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
