import { history } from '../lib/api/queue';
import type { Operation } from '@suki/domain';
import { formatPeso } from '@suki/domain';
import { shortDate } from '@suki/domain';

interface Props {
  onClose: () => void;
  onToggleOnline: () => void;
}

function opDescription(op: Operation): string {
  switch (op.type) {
    case 'cash-sale': return 'Cash sale';
    case 'credit-sale': return 'Credit sale';
    case 'payment': return 'Payment received';
    case 'stock-adjustment': return 'Stock adjustment';
    case 'buy-price-change': return 'Buy price change';
    case 'settings-change': return 'Settings change';
    default: return op.type;
  }
}

function opAmount(op: Operation): number | null {
  const p = op.payload as { total?: number; amount?: number };
  if (typeof p.total === 'number') return p.total;
  if (typeof p.amount === 'number') return p.amount;
  return null;
}

export function SyncSheet({ onClose, onToggleOnline }: Props) {
  const all = history();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sync queue"
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(28,42,58,0.28)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full anim-slide-in"
        style={{ background: 'var(--color-paper)', maxHeight: '80dvh', overflowY: 'auto' }}
      >
        <header className="px-4 py-3 rule flex items-center justify-between">
          <h2 className="text-[18px]">Sync queue</h2>
          <button
            type="button"
            className="mono text-[13px] uppercase"
            onClick={onClose}
            style={{ minHeight: 'var(--tap-min)', minWidth: 'var(--tap-min)' }}
            aria-label="Close sync sheet"
          >
            Close
          </button>
        </header>

        <div className="px-4 py-3 rule flex items-center justify-between">
          <p className="text-[14px] text-muted">Simulate connection</p>
          <button
            type="button"
            className="mono text-[13px] uppercase px-3"
            style={{ minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)' }}
            onClick={onToggleOnline}
          >
            Toggle offline
          </button>
        </div>

        {all.length === 0 ? (
          <p className="px-4 py-8 text-muted text-[14px]">Nothing has been queued yet. Every sale, payment and stock change will appear here first.</p>
        ) : (
          <ul>
            {all.map((op) => {
              const amount = opAmount(op);
              return (
                <li key={op.id} className="rule px-4 py-3 flex items-center gap-3">
                  <span
                    aria-hidden
                    style={{
                      width: 8, height: 8, borderRadius: 8,
                      background:
                        op.status === 'pending' ? 'var(--color-ink)' :
                        op.status === 'failed'  ? 'var(--color-utang)' :
                                                  'var(--color-bayad)',
                    }}
                    className={op.status === 'pending' ? 'anim-pending' : ''}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] truncate">{opDescription(op)}</p>
                    <p className="text-[12px] text-muted mono">
                      {shortDate(op.createdAt)} · {op.status.toUpperCase()}
                    </p>
                  </div>
                  {amount !== null && (
                    <p className="amount text-[15px]">{formatPeso(amount)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
