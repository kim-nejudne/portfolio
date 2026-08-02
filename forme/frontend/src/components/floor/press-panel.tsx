import { StatusMark } from '@/components/furniture/status-mark';
import { formatDuration, formatShortDate, formatTime } from '@/lib/dates';
import { formatInteger, formatPercent } from '@/lib/money';
import type { Press, PressState, StateOwner } from '@/lib/types';

const STATE_OWNER: Record<PressState, StateOwner> = {
  RUNNING: 'system',
  MAKEREADY: 'held',
  WASHUP: 'held',
  IDLE: 'final',
};

/** Read from six metres: reference, fraction, state, waste, time remaining. */
export function PressPanel({ press }: { press: Press }) {
  const owner = STATE_OWNER[press.state];
  const pct =
    press.sheetsTarget > 0 ? Math.round((press.sheetsRun / press.sheetsTarget) * 100) : 0;

  return (
    <section
      className="@container flex min-w-0 flex-col border-t-2 border-rule-ink bg-ink px-[2cqi] py-[1.5cqi] lg:border-l lg:border-t-0"
      aria-labelledby={`press-${press.id}`}
      data-testid={`press-panel-${press.id}`}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-rule-ink pb-[1cqi]">
        <h2
          id={`press-${press.id}`}
          className="num font-semibold tracking-[0.06em] text-[clamp(1.5rem,3.4cqi,3rem)]"
        >
          {press.id}
        </h2>
        <span className="text-right">
          <span className="block">
            <StatusMark owner={owner} label={press.state} size={16} onInk />
          </span>
          <span className="num block text-muted-ink text-[clamp(0.6875rem,1.1cqi,1rem)]">
            {press.units}
          </span>
        </span>
      </div>

      {press.jobReference === null ? (
        <div className="flex flex-1 flex-col justify-center py-[3cqi]" data-testid="empty-state">
          <p className="num text-muted-ink text-[clamp(2rem,5cqi,5rem)]">IDLE</p>
          <p className="mt-2 text-muted-ink text-[clamp(0.75rem,1.2cqi,1.125rem)]">
            No job on the press. Next job in the queue below.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center py-[1.5cqi]">
          <p
            className="num leading-[0.9] text-[clamp(2.25rem,11cqi,8rem)]"
            data-testid={`press-job-${press.id}`}
          >
            {press.jobReference}
          </p>
          <p className="mt-[1cqi] truncate text-[clamp(0.8125rem,1.5cqi,1.5rem)]">
            {press.customer}
          </p>
          <p className="truncate text-muted-ink text-[clamp(0.6875rem,1.2cqi,1.125rem)]">
            {press.jobDescription}
          </p>

          <p className="mt-[2cqi] flex items-baseline gap-[1cqi]">
            <span className="num leading-none text-[clamp(2rem,9cqi,6rem)]" data-testid={`press-run-${press.id}`}>
              {formatInteger(press.sheetsRun)}
            </span>
            <span aria-hidden="true" className="num text-muted-ink text-[clamp(1.5rem,6cqi,4rem)]">
              /
            </span>
            <span className="num text-muted-ink text-[clamp(1.25rem,5cqi,3.5rem)]">
              {formatInteger(press.sheetsTarget)}
            </span>
            <span className="sr-only">
              sheets run of {press.sheetsTarget} target, {pct} per cent
            </span>
          </p>
          <p className="num text-muted-ink text-[clamp(0.6875rem,1.2cqi,1.125rem)]">
            SHEETS RUN · {formatPercent(pct)} · {formatInteger(press.sheetsPerHour)} SPH
          </p>

          <dl className="mt-[2cqi] grid grid-cols-3 gap-[1cqi] border-t border-rule-ink pt-[1.5cqi]">
            <div>
              <dt className="num text-muted-ink text-[clamp(0.625rem,1cqi,1rem)]">WASTE</dt>
              <dd className="num text-yellow text-[clamp(1.25rem,3.6cqi,2.75rem)]">
                {formatInteger(press.wasteSheets)}
              </dd>
            </div>
            <div>
              <dt className="num text-muted-ink text-[clamp(0.625rem,1cqi,1rem)]">REMAINING</dt>
              <dd className="num text-[clamp(1.25rem,3.6cqi,2.75rem)]">
                {formatDuration(press.minutesRemaining)}
              </dd>
            </div>
            <div>
              <dt className="num text-muted-ink text-[clamp(0.625rem,1cqi,1rem)]">OPERATOR</dt>
              <dd className="num text-[clamp(0.8125rem,1.5cqi,1.5rem)]">{press.operator}</dd>
              <dd className="num text-muted-ink text-[clamp(0.625rem,1cqi,1rem)]">{press.shift}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="border-t border-rule-ink pt-[1cqi]">
        <h3 className="num text-muted-ink text-[clamp(0.625rem,1cqi,1rem)]">NEXT THREE</h3>
        <ol className="mt-[0.5cqi]">
          {press.queue.slice(0, 3).map((item, index) => (
            <li
              key={item.reference}
              className="flex items-baseline justify-between gap-3 border-b border-rule-ink py-[0.6cqi] last:border-b-0"
            >
              <span className="num text-muted-ink text-[clamp(0.625rem,1cqi,1rem)]">
                {index + 1}
              </span>
              <span className="num flex-1 text-[clamp(0.75rem,1.6cqi,1.5rem)]">
                {item.reference}
              </span>
              <span className="truncate text-muted-ink text-[clamp(0.6875rem,1.2cqi,1.125rem)]">
                {item.customer}
              </span>
              <span className="num text-[clamp(0.6875rem,1.2cqi,1.125rem)]">
                {formatInteger(item.sheets)}
              </span>
              <span className="num text-muted-ink text-[clamp(0.625rem,1cqi,1rem)]">
                {formatShortDate(item.dueAt)} {formatTime(item.dueAt)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
