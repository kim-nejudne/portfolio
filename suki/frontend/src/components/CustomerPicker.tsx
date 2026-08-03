import { useMemo, useState } from 'react';
import { formatPeso } from '../lib/money';
import { MonogramChip } from './MonogramChip';
import { daysBetween } from '../lib/date';

interface CustomerRow {
  id: string;
  name: string;
  purok: string;
  balance: number;
  lastActivityAt: string | null;
  lastPaymentAt: string | null;
}

interface Props {
  today: string;
  customers: CustomerRow[];
  onPick: (id: string) => void;
  onClose: () => void;
}

export function CustomerPicker({ today, customers, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    const filtered = query.trim()
      ? customers.filter((c) =>
          [c.name, c.purok].some((v) => v.toLowerCase().includes(query.trim().toLowerCase())),
        )
      : customers;
    // recent activity first
    return [...filtered].sort((a, b) => {
      const av = a.lastActivityAt ?? '';
      const bv = b.lastActivityAt ?? '';
      return bv.localeCompare(av);
    });
  }, [customers, query]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose customer"
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(28,42,58,0.28)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full anim-slide-in"
        style={{ background: 'var(--color-paper)', maxHeight: '86dvh', display: 'flex', flexDirection: 'column' }}
      >
        <header className="px-4 pt-4 pb-3 rule">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[20px]">Lista · choose suki</h2>
            <button
              type="button"
              className="mono text-[13px] uppercase"
              onClick={onClose}
              style={{ minHeight: 'var(--tap-min)', minWidth: 'var(--tap-min)' }}
            >Cancel</button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or purok"
            aria-label="Search customers"
            className="w-full mono text-[15px] px-3"
            style={{ minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)' }}
            data-testid="picker-search"
            autoFocus
          />
          <p className="mt-2 text-[12px] text-muted">Recent suki first. Existing utang in red.</p>
        </header>

        <ul style={{ overflowY: 'auto', flex: 1 }} data-testid="picker-list">
          {sorted.map((c) => {
            const days = c.lastPaymentAt ? daysBetween(c.lastPaymentAt, today) : null;
            return (
              <li key={c.id} className="rule">
                <button
                  type="button"
                  onClick={() => onPick(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ minHeight: 'var(--tap-min)' }}
                  data-testid={`picker-customer-${c.id}`}
                >
                  <MonogramChip name={c.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] truncate">{c.name}</p>
                    <p className="mono text-[11px] text-muted truncate">
                      {c.purok}{days === null ? '' : ` · last bayad ${days}d ago`}
                    </p>
                  </div>
                  {c.balance > 0 ? (
                    <div className="text-right">
                      <p className="mono uppercase text-[10px] text-muted">Utang</p>
                      <p className="amount text-[17px]" style={{ color: 'var(--color-utang)' }}>
                        {formatPeso(c.balance)}
                      </p>
                    </div>
                  ) : (
                    <p className="amount text-[14px] text-muted">clear</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
