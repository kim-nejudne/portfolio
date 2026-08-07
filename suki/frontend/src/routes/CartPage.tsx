/**
 * The sale, on its own page.
 *
 * The lines used to sit in a fixed tray over the Till, capped at `32dvh` and
 * cleared by a padding constant guessed at 220px. Those two numbers cannot
 * agree: a full tray is the list plus a total block plus two 56px buttons —
 * comfortably past 300px on a 640px phone — so the bottom row of the shelf sat
 * underneath it. A page has no such arithmetic to get wrong.
 *
 * The action block is `sticky` rather than `fixed`, which is the whole reason
 * the bug cannot come back here: a sticky element occupies flow, so the list
 * cannot run under it however long the sale gets, and on a short sale it simply
 * sits after the last line instead of floating.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { formatPeso } from '@suki/domain';
import { PageHeader } from '../components/PageHeader';
import { BigButton } from '../components/BigButton';
import { CustomerPicker } from '../components/CustomerPicker';
import { useSale } from '../lib/sale';
import { useAsync } from '../lib/useAsync';
import { listCustomersWithBalance } from '../lib/api/customers';
import { collectQueueEntries } from '../lib/api/ledger';
import { recordCashSale, recordCreditSale } from '../lib/api/sales';
import { getSessionSync } from '../lib/api/session';

export function CartPage() {
  const sale = useSale();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Latched, not just "in flight": it also holds the empty-cart redirect below
  // off while we clear the lines and leave under our own steam.
  const [committing, setCommitting] = useState(false);

  const { data: customers } = useAsync(() => listCustomersWithBalance(collectQueueEntries()), []);
  const today = getSessionSync().today;

  // Nothing to sell — someone typed the URL, or emptied the last line. Wait for
  // hydration first, or a restored draft would bounce straight back to the Till.
  if (sale.hydrated && sale.lines.length === 0 && !committing) {
    return <Navigate to="/till" replace />;
  }

  async function completeCash() {
    if (sale.lines.length === 0 || committing) return;
    setCommitting(true);
    const total = sale.total;
    // Awaited. `recordCashSale` writes to IndexedDB before it resolves, and the
    // old tray dropped that promise on the floor with `void` — resetting the UI
    // and telling the shopkeeper it was done while the commit was still in
    // flight. That is the exact window `sales.ts` says it exists to close.
    await recordCashSale({ items: sale.toSaleItems(), total });
    sale.clear();
    navigate('/till', { replace: true, state: { receipt: total } });
  }

  async function completeCredit(customerId: string) {
    if (sale.lines.length === 0 || committing) return;
    setCommitting(true);
    await recordCreditSale({ items: sale.toSaleItems(), total: sale.total, customerId });
    sale.clear();
    setPickerOpen(false);
    navigate(`/lista/${customerId}`, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Sale"
        back="/till"
        right={
          // Up here on purpose. In the tray, Clear sat on the same row as the
          // total and a thumb's width from Bayad; a mis-tap threw away a walk
          // of the shelf. Now it is at the far end of the screen from both.
          <button
            type="button"
            onClick={sale.clear}
            className="mono text-[12px] uppercase text-muted px-2"
            style={{ minHeight: 'var(--tap-min)' }}
            data-testid="cart-clear"
          >
            Clear
          </button>
        }
      />

      <ul data-testid="cart-lines">
        {sale.lines.map((l) => (
          <li key={l.itemId} className="rule px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] leading-tight">{l.name}</p>
              <p className="mono text-[11px] text-muted mt-0.5">
                {formatPeso(l.unitPrice)} each
              </p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                aria-label={`Remove one ${l.name}`}
                onClick={() => sale.decrement(l.itemId)}
                className="mono text-[18px]"
                style={{
                  minWidth: 'var(--tap-min)',
                  minHeight: 'var(--tap-min)',
                  border: '1px solid var(--color-rule)',
                  borderRadius: 'var(--radius-tap)',
                }}
              >
                −
              </button>
              <span className="mono text-[15px] w-8 text-center" aria-hidden>
                {l.qty}
              </span>
              <button
                type="button"
                aria-label={`Add one more ${l.name}`}
                onClick={() => sale.increment(l.itemId)}
                className="mono text-[18px]"
                style={{
                  minWidth: 'var(--tap-min)',
                  minHeight: 'var(--tap-min)',
                  border: '1px solid var(--color-rule)',
                  borderRadius: 'var(--radius-tap)',
                }}
              >
                +
              </button>
            </div>

            {/* The quantity is drawn between the steppers for the thumb and
                read aloud here for the screen reader, so the line announces as
                "3 × Kopiko Brown, 18 pesos each, 54 pesos" instead of a bare
                number floating between two buttons. */}
            <span className="amount text-[16px] w-[72px] flex-shrink-0">
              <span className="sr-only">{l.qty} × </span>
              {formatPeso(l.qty * l.unitPrice)}
            </span>
          </li>
        ))}
      </ul>

      <div
        className="sticky px-4 pt-3 pb-4"
        style={{
          bottom: 'var(--bottom-bar-height)',
          background: 'var(--color-paper)',
          borderTop: '1px solid var(--color-rule)',
        }}
      >
        <div className="flex items-baseline justify-between">
          <p className="mono uppercase text-[11px] text-muted">Total</p>
          <p className="amount text-[32px] leading-none" data-testid="cart-total">
            {formatPeso(sale.total)}
          </p>
        </div>

        <div className="flex gap-2 mt-3">
          <BigButton
            variant="outline"
            onClick={() => setPickerOpen(true)}
            disabled={committing}
            data-testid="cart-lista"
            style={{ flex: 1 }}
          >
            Lista
          </BigButton>
          <BigButton
            variant="ink"
            onClick={() => void completeCash()}
            disabled={committing}
            data-testid="cart-bayad"
            style={{ flex: 1 }}
          >
            Bayad
          </BigButton>
        </div>
      </div>

      {pickerOpen && customers && (
        <CustomerPicker
          today={today}
          customers={customers}
          onPick={(id) => void completeCredit(id)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
