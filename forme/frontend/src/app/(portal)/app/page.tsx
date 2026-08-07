import type { Metadata } from 'next';
import Link from 'next/link';
import { JobTable } from '@/components/portal/job-table';
import { StateFilter } from '@/components/portal/state-filter';
import { getNow } from '@/lib/api/clock';
import { getJobs } from '@/lib/api/jobs';
import { getPriceMatrix } from '@/lib/api/pricing';
import { getSession } from '@/lib/api/session';
import { dueStatus, formatDate } from '@forme/domain';
import { JOB_STATE_LABEL } from '@forme/domain';
import { formatInteger } from '@forme/domain';
import type { Job, JobRow, JobState, PriceMatrix } from '@forme/domain';

export const metadata: Metadata = {
  title: 'Jobs',
  robots: { index: false, follow: false },
};

function toRow(job: Job, matrix: PriceMatrix, now: string): JobRow {
  const due = dueStatus(job.dueAt, now);
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
    overdue: due.overdue && job.state !== 'DESPATCHED' && job.state !== 'CANCELLED',
    progress: job.progress,
    press: job.quote.press,
    total: job.quote.total,
    href: `/app/jobs/${job.reference}`,
  };
}

export default async function JobListPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const [{ state }, session, matrix] = await Promise.all([
    searchParams,
    getSession(),
    getPriceMatrix(),
  ]);
  const customerId = session.customerId ?? undefined;
  const all = await getJobs({ customerId });
  const now = getNow();

  const counts = all.reduce<Record<string, number>>((totals, job) => {
    totals[job.state] = (totals[job.state] ?? 0) + 1;
    return totals;
  }, {});
  const filterList = Object.keys(counts)
    .map((key) => ({ state: key as JobState, count: counts[key] }))
    .sort((a, b) => b.count - a.count);

  const active = state && counts[state] !== undefined ? state : null;
  const rows = all
    .filter((job) => (active ? job.state === active : true))
    .map((job) => toRow(job, matrix, now));
  const outstanding = all.filter((job) => job.owner === 'human').length;
  const value = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-rule-strong pb-3">
        <div>
          <p className="label-caps text-muted">Nine Dots Studio · account ND-063 · pro forma</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Jobs</h1>
        </div>
        <dl className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <dt className="label-caps text-muted">On the books</dt>
            <dd className="num text-lg">{all.length}</dd>
          </div>
          <div>
            <dt className="label-caps text-muted">Waiting on you</dt>
            <dd className={`num text-lg ${outstanding > 0 ? 'text-magenta' : ''}`}>{outstanding}</dd>
          </div>
          <div>
            <dt className="label-caps text-muted">Shown, inc VAT</dt>
            <dd className="num text-lg">₱{formatInteger(value)}</dd>
          </div>
          <Link
            href="/app/new"
            data-testid="new-job-link"
            className="border border-ink px-4 py-2 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
          >
            Submit a job
          </Link>
        </dl>
      </div>

      <div className="py-3">
        <StateFilter counts={filterList} active={active} total={all.length} />
      </div>

      {rows.length === 0 ? (
        <p className="border border-rule-strong px-4 py-8 text-sm text-muted" data-testid="empty-state">
          No jobs in {active ? JOB_STATE_LABEL[active as JobState] : 'this account'}. Jobs appear
          here the moment an estimate is priced, and stay until they are despatched.
        </p>
      ) : (
        <JobTable rows={rows} />
      )}

      <p className="mt-3 text-xs text-muted">
        Sorted by due date by default. Column headers sort; the filter above is held in the URL, so
        a filtered list is a link you can keep.
      </p>
    </main>
  );
}
