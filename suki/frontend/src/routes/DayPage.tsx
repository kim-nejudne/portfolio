import { useAsync } from '../lib/useAsync';
import { getDaySummary } from '../lib/api/day';
import { formatPeso } from '@suki/domain';
import { getSessionSync } from '../lib/api/session';
import { shortDate } from '@suki/domain';
import { useQueue } from '../lib/useQueue';
import { NavLink } from 'react-router-dom';

export function DayPage() {
  const q = useQueue();
  // Re-fetch when queue changes so today's numbers reflect just-added ops.
  const { data: summary, loaded } = useAsync(() => getDaySummary(), [q.pending.length]);
  const today = getSessionSync().today;

  return (
    <>
      <header className="rule px-4 pt-4 pb-3">
        <h1 className="text-[24px] leading-tight">Closing up</h1>
        <p className="text-[13px] text-muted mono">{shortDate(today)} · 06:00 to 21:00</p>
      </header>

      {!loaded || !summary ? (
        <p className="px-4 py-6 text-muted">Tallying today…</p>
      ) : (
        <>
          <dl className="rule px-4 py-4 grid grid-cols-[1fr_auto] gap-y-3">
            <dt className="text-[15px]">Cash today</dt>
            <dd className="amount text-[20px]">{formatPeso(summary.cashTotal)}</dd>

            <dt className="text-[15px]">Bayad received</dt>
            <dd className="amount text-[20px]" style={{ color: 'var(--color-bayad)' }}>
              {formatPeso(summary.paymentsReceived)}
            </dd>

            <dt className="text-[15px]">Utang extended</dt>
            <dd className="amount text-[20px]" style={{ color: 'var(--color-utang)' }}>
              {formatPeso(summary.creditExtended)}
            </dd>

            <dt className="text-[15px]">Transactions</dt>
            <dd className="mono text-[18px]">{summary.totalTransactions}</dd>
          </dl>

          <section className="rule px-4 py-4">
            <p className="mono uppercase text-[11px] text-muted">Should be in the tin</p>
            <p className="amount text-[36px] leading-none mt-1" data-testid="day-tin">{formatPeso(summary.expectedCashInTin)}</p>
            <p className="text-[13px] text-muted mt-2">
              Count the tin. If it matches, close the door.
            </p>
          </section>

          <div className="px-4 py-4">
            <NavLink
              to="/settings"
              className="mono uppercase text-[13px] px-3"
              style={{ minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)', display: 'inline-flex', alignItems: 'center' }}
              data-testid="day-goto-settings"
            >
              Settings
            </NavLink>
          </div>
        </>
      )}
    </>
  );
}
