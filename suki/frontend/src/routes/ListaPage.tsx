import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { listCustomersWithBalance } from '../lib/api/customers';
import { collectQueueEntries } from '../lib/api/ledger';
import { formatPeso } from '../lib/money';
import { getSessionSync } from '../lib/api/session';
import { daysBetween, daysUntilNextPayday, paydayKindFor } from '../lib/date';
import { MonogramChip } from '../components/MonogramChip';
import { PaydayBand } from '../components/PaydayBand';
import { useQueue } from '../lib/useQueue';

export function ListaPage() {
  const q = useQueue(); // re-render on queue updates so new sales appear
  const today = getSessionSync().today;
  const { data: customers, loaded } = useAsync(() => listCustomersWithBalance(collectQueueEntries()), [q.pending.length]);

  const withBalance = useMemo(() => (customers ?? []).filter((c) => c.balance > 0), [customers]);

  const isPayday = paydayKindFor(today) !== null;
  const sorted = useMemo(() => {
    if (isPayday) {
      const kind = paydayKindFor(today);
      return [...withBalance].sort((a, b) => {
        const aMatch = a.paydayPreference === kind ? 0 : 1;
        const bMatch = b.paydayPreference === kind ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return b.balance - a.balance;
      });
    }
    return [...withBalance].sort((a, b) => b.balance - a.balance);
  }, [withBalance, isPayday, today]);

  const totalOut = withBalance.reduce((s, c) => s + c.balance, 0);
  const upcoming = daysUntilNextPayday(today);

  return (
    <>
      <header className="rule px-4 pt-4 pb-3">
        <h1 className="text-[24px] leading-tight">Lista</h1>
        <p className="text-[13px] text-muted">The credit book. Every suki with utang.</p>
      </header>

      <section className="rule px-4 py-3 flex items-baseline justify-between">
        <div>
          <p className="mono uppercase text-[11px] text-muted">Total utang</p>
          <p className="amount text-[26px]" style={{ color: 'var(--color-utang)' }}>
            {formatPeso(totalOut)}
          </p>
        </div>
        <div className="text-right">
          <p className="mono uppercase text-[11px] text-muted">Next payday</p>
          <p className="mono text-[15px]">
            {upcoming.kind} · in {upcoming.days}d
          </p>
        </div>
      </section>

      <PaydayBand today={today} />

      {!loaded ? (
        <p className="px-4 py-6 text-muted text-[14px]">Reading the notebook…</p>
      ) : sorted.length === 0 ? (
        <p className="px-4 py-8 text-muted text-[14px]">No utang today. Wala’y utang. Every page is clear.</p>
      ) : (
        <ul data-testid="lista-list">
          {sorted.map((c) => {
            const days = c.lastPaymentAt ? daysBetween(c.lastPaymentAt, today) : null;
            return (
              <li key={c.id} className="rule">
                <NavLink
                  to={`/lista/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ minHeight: 'var(--tap-min)' }}
                  data-testid={`lista-row-${c.id}`}
                >
                  <MonogramChip name={c.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] truncate">{c.name}</p>
                    <p className="mono text-[11px] text-muted truncate">
                      {c.purok} · {days === null ? 'never paid' : `${days}d since bayad`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="mono uppercase text-[10px] text-muted">Utang</p>
                    <p className="amount text-[18px]" style={{ color: 'var(--color-utang)' }}>
                      {formatPeso(c.balance)}
                    </p>
                  </div>
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
