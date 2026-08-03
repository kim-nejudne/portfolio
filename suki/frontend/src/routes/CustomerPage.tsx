import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { getCustomer } from '../lib/api/customers';
import { listEntries, entryStatus } from '../lib/api/ledger';
import { recordPayment } from '../lib/api/sales';
import { formatPeso, formatPesoBare, parsePesoInput } from '../lib/money';
import { shortDate, daysBetween } from '../lib/date';
import { getSessionSync } from '../lib/api/session';
import { MonogramChip } from '../components/MonogramChip';
import { BigButton } from '../components/BigButton';
import { useQueue } from '../lib/useQueue';
import type { LedgerEntry } from '../lib/types';

export function CustomerPage() {
  const { customerId = '' } = useParams();
  const q = useQueue();
  const today = getSessionSync().today;
  const { data: customer } = useAsync(() => getCustomer(customerId), [customerId]);
  const { data: entries, loaded } = useAsync(() => listEntries(customerId), [customerId, q.pending.length]);
  const [payOpen, setPayOpen] = useState(false);
  const navigate = useNavigate();

  if (!customer) {
    return (
      <div className="px-4 py-6">
        <p className="text-muted">Reading page…</p>
      </div>
    );
  }

  const list = entries ?? [];
  let running = 0;
  const rows = list.map((e) => {
    running = e.kind === 'purchase' ? running + e.amount : running - e.amount;
    return { entry: e, balance: running };
  });
  const currentBalance = running;

  const lastPayment = list.filter((e) => e.kind === 'payment').at(-1);
  const daysSince = lastPayment ? daysBetween(lastPayment.createdAt, today) : null;

  return (
    <>
      <header className="rule px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => navigate('/lista')}
          className="mono text-[12px] uppercase text-muted inline-flex items-center gap-1"
          style={{ minHeight: 'var(--tap-min)' }}
        >
          <span aria-hidden>←</span> Lista
        </button>
        <div className="flex items-center gap-3 mt-1">
          <MonogramChip name={customer.name} size={48} />
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight truncate">{customer.name}</h1>
            <p className="mono text-[11px] text-muted truncate">
              {customer.purok} · payday {customer.paydayPreference}
            </p>
          </div>
        </div>
      </header>

      <section className="rule px-4 py-4">
        <p className="mono uppercase text-[11px] text-muted">Balance</p>
        <p
          className="amount text-[36px] leading-none"
          style={{ color: currentBalance > 0 ? 'var(--color-utang)' : 'var(--color-ink)' }}
          aria-label={currentBalance > 0 ? `Utang ${formatPeso(currentBalance)}` : `Balance ${formatPeso(currentBalance)}`}
          data-testid="customer-balance"
        >
          {currentBalance > 0 ? formatPeso(currentBalance) : formatPeso(0)}
        </p>
        {daysSince !== null && (
          <p className="mono text-[12px] text-muted mt-1">Last bayad {daysSince}d ago</p>
        )}
      </section>

      {!loaded ? (
        <p className="px-4 py-6 text-muted">Turning the pages…</p>
      ) : (
        <table
          className="w-full"
          style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}
          data-testid="customer-ledger"
        >
          <caption className="px-4 pt-4 pb-2 text-left text-[12px] text-muted mono uppercase">
            Ledger · append-only
          </caption>
          <colgroup>
            <col style={{ width: '64px' }} />
            <col />
            <col style={{ width: '68px' }} />
            <col style={{ width: '72px' }} />
          </colgroup>
          <thead>
            <tr className="rule">
              <th scope="col" className="text-left px-4 py-2 mono text-[11px] uppercase text-muted">Date</th>
              <th scope="col" className="text-left px-1 py-2 mono text-[11px] uppercase text-muted">Entry</th>
              <th scope="col" className="text-right px-1 py-2 mono text-[11px] uppercase text-muted">Amount</th>
              <th scope="col" className="text-right px-4 py-2 mono text-[11px] uppercase text-muted">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, balance }) => (
              <LedgerRow key={entry.id} entry={entry} balance={balance} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted text-[14px]">
                  No entries yet. This suki has a clean page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div style={{ height: 24 }} />

      <div
        className="fixed left-0 right-0 px-4 py-3"
        style={{
          bottom: 'var(--bottom-bar-height)',
          background: 'var(--color-paper)',
          borderTop: '1px solid var(--color-rule)',
        }}
      >
        <BigButton
          variant="bayad"
          onClick={() => setPayOpen(true)}
          style={{ width: '100%' }}
          data-testid="customer-record-payment"
        >
          Record a payment
        </BigButton>
      </div>

      {payOpen && (
        <PaymentSheet
          maxAmount={currentBalance}
          onClose={() => setPayOpen(false)}
          onSubmit={(amount) => {
            recordPayment({ customerId, amount });
            setPayOpen(false);
          }}
        />
      )}
    </>
  );

  function LedgerRow({ entry, balance }: { entry: LedgerEntry; balance: number }) {
    const status = entryStatus(entry);
    const isPayment = entry.kind === 'payment';
    return (
      <tr
        className={`rule ${status === 'pending' ? 'anim-slide-in' : ''}`}
      >
        <td className="px-4 py-3 align-top mono text-[13px] text-muted" style={{ whiteSpace: 'nowrap' }}>{shortDate(entry.createdAt)}</td>
        <td className="px-1 py-3 align-top">
          <div className="flex items-center gap-2">
            <p className="text-[14px] truncate" style={{ color: isPayment ? 'var(--color-bayad)' : 'var(--color-ink)' }}>
              {isPayment ? 'Bayad' : entry.items && entry.items.length > 0 ? entry.items[0]!.name : 'Purchase'}
              {!isPayment && entry.items && entry.items.length > 1 && (
                <span className="text-muted"> +{entry.items.length - 1}</span>
              )}
            </p>
            {status === 'pending' && (
              <span className="mono text-[10px] uppercase text-muted anim-pending">pending</span>
            )}
          </div>
          {entry.note && <p className="mono text-[11px] text-muted mt-1 truncate">{entry.note}</p>}
        </td>
        <td
          className="amount px-1 py-3 align-top text-[15px]"
          style={{ color: isPayment ? 'var(--color-bayad)' : 'var(--color-ink)' }}
        >
          {isPayment ? '−' : ''}{formatPesoBare(entry.amount)}
        </td>
        <td
          className="amount px-4 py-3 align-top text-[15px]"
          style={{ color: balance > 0 ? 'var(--color-utang)' : 'var(--color-ink)' }}
        >
          {formatPesoBare(balance)}
        </td>
      </tr>
    );
  }

  function PaymentSheet({ maxAmount, onClose, onSubmit }: { maxAmount: number; onClose: () => void; onSubmit: (n: number) => void }) {
    const [raw, setRaw] = useState('');
    const parsed = parsePesoInput(raw);
    const invalid = parsed === null || parsed <= 0;
    const overpay = parsed !== null && parsed > maxAmount;

    return (
      <div role="dialog" aria-modal="true" aria-label="Record a payment"
        className="fixed inset-0 z-50 flex items-end"
        style={{ background: 'rgba(28,42,58,0.28)' }}
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()}
          className="w-full anim-slide-in px-4 pt-4 pb-6"
          style={{ background: 'var(--color-paper)' }}
        >
          <div className="flex items-center justify-between rule pb-3 mb-3">
            <h2 className="text-[18px]">Record a payment</h2>
            <button type="button" className="mono text-[13px] uppercase" onClick={onClose}
              style={{ minHeight: 'var(--tap-min)', minWidth: 'var(--tap-min)' }}>Cancel</button>
          </div>
          <label className="block mono uppercase text-[11px] text-muted" htmlFor="pay-amt">Amount received</label>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="amount text-[28px] text-muted">₱</span>
            <input
              id="pay-amt"
              inputMode="numeric"
              pattern="[0-9]*"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="amount text-[28px] flex-1"
              style={{ minHeight: 'var(--tap-min)', borderBottom: '1px solid var(--color-rule)' }}
              aria-invalid={invalid}
              aria-describedby="pay-help"
              data-testid="payment-input"
              autoFocus
            />
          </div>
          <p id="pay-help" className="mono text-[12px] text-muted mt-2">
            {overpay ? `That is more than the utang of ${formatPeso(maxAmount)}. Partial payments are fine — this will be recorded as more than owed.` :
             invalid ? 'Whole pesos only, no centavos.' :
             `Utang after this bayad: ${formatPeso(maxAmount - (parsed ?? 0))}`}
          </p>
          <div className="mt-4">
            <BigButton
              variant="bayad"
              disabled={invalid}
              onClick={() => { if (!invalid && parsed !== null) onSubmit(parsed); }}
              style={{ width: '100%' }}
              data-testid="payment-submit"
            >
              Record
            </BigButton>
          </div>
        </div>
      </div>
    );
  }
}
