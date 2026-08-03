import type { Metadata } from 'next';
import { QueueTable } from '@/components/prepress/queue-table';
import { StateFilter } from '@/components/portal/state-filter';
import { getNow } from '@/lib/api/clock';
import { getPrepressQueue } from '@/lib/api/jobs';
import { getPriceMatrix } from '@/lib/api/pricing';
import { dueStatus, formatDate, formatDuration, minutesBetween } from '@forme/domain';
import { JOB_STATE_LABEL } from '@forme/domain';
import { formatInteger } from '@forme/domain';
import type { Job, JobState, PriceMatrix, QueueRow } from '@forme/domain';

export const metadata: Metadata = {
  title: 'Prepress queue',
  robots: { index: false, follow: false },
};

function toQueueRow(job: Job, matrix: PriceMatrix, now: string): QueueRow {
  const due = dueStatus(job.dueAt, now);
  const since = job.stamps[job.state] ?? job.receivedAt;
  const ageMinutes = minutesBetween(since, now);
  return {
    reference: job.reference,
    description: job.description,
    quantity: job.spec.quantity,
    stockLabel: matrix.stocks.find((stock) => stock.id === job.spec.stock)?.label ?? job.spec.stock,
    state: job.state,
    stateLabel: JOB_STATE_LABEL[job.state],
    owner: job.owner,
    dueAt: job.dueAt,
    dueDate: formatDate(job.dueAt),
    dueLabel: due.label,
    overdue: due.overdue,
    progress: job.progress,
    press: job.quote.press,
    total: job.quote.total,
    href: `/prepress/jobs/${job.reference}`,
    customer: job.customer.shortName,
    productLabel:
      matrix.products.find((product) => product.id === job.spec.product)?.label ?? job.spec.product,
    sheetLabel: job.quote.sheetId,
    sheets: job.quote.sheetsRequired,
    ageMinutes,
    ageLabel: formatDuration(ageMinutes),
  };
}

export default async function PrepressQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const [{ state }, queue, matrix] = await Promise.all([
    searchParams,
    getPrepressQueue(),
    getPriceMatrix(),
  ]);
  const now = getNow();
  const all = queue.map((job) => toQueueRow(job, matrix, now));

  const counts = all.reduce<Record<string, number>>((totals, row) => {
    totals[row.state] = (totals[row.state] ?? 0) + 1;
    return totals;
  }, {});
  const filters = Object.keys(counts)
    .map((key) => ({ state: key as JobState, count: counts[key] }))
    .sort((a, b) => b.count - a.count);
  const active = state && counts[state] !== undefined ? state : null;
  const rows = all.filter((row) => (active ? row.state === active : true));

  const overdue = all.filter((row) => row.overdue).length;
  const blocked = all.filter((row) => row.owner === 'human' && row.state === 'PREFLIGHT').length;
  const sheets = all.reduce((sum, row) => sum + row.sheets, 0);

  return (
    <main id="main" className="mx-auto max-w-[100rem] px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-rule-strong pb-3">
        <div>
          <p className="label-caps text-muted">All customers · awaiting preflight, imposition or proof</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Queue</h1>
        </div>
        <dl className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <dt className="label-caps text-muted">In queue</dt>
            <dd className="num text-lg">{all.length}</dd>
          </div>
          <div>
            <dt className="label-caps text-muted">Overdue</dt>
            <dd className={`num text-lg ${overdue > 0 ? 'text-magenta' : ''}`}>{overdue}</dd>
          </div>
          <div>
            <dt className="label-caps text-muted">Blocked on failures</dt>
            <dd className={`num text-lg ${blocked > 0 ? 'text-magenta' : ''}`}>{blocked}</dd>
          </div>
          <div>
            <dt className="label-caps text-muted">Sheets committed</dt>
            <dd className="num text-lg">{formatInteger(sheets)}</dd>
          </div>
        </dl>
      </div>

      <div className="py-3">
        <StateFilter counts={filters} active={active} total={all.length} basePath="/prepress" />
      </div>

      {rows.length === 0 ? (
        <p className="border border-rule-strong px-4 py-8 text-sm text-muted" data-testid="empty-state">
          Nothing in this state. Jobs arrive here on upload and leave when the proof is approved.
        </p>
      ) : (
        <QueueTable rows={rows} />
      )}

      <p className="mt-3 text-xs text-muted">
        Sorted by due time. Overdue jobs carry a magenta label as well as the colour. Focus a
        reference and use the up and down arrows to walk the queue.
      </p>
    </main>
  );
}
