import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusMark } from '@/components/furniture/status-mark';
import { CommentThread } from '@/components/portal/comment-thread';
import { ImpositionPlanner } from '@/components/prepress/imposition-planner';
import { TechnicalReport } from '@/components/prepress/technical-report';
import { getNow } from '@/lib/api/clock';
import { getJob } from '@/lib/api/jobs';
import { largestSchemeThatFits } from '@forme/domain';
import { countBySeverity, getPreflightReport, hasBlockingFailure } from '@/lib/api/preflight';
import { getPriceMatrix } from '@/lib/api/pricing';
import { dueStatus, formatDate, formatDateTime } from '@forme/domain';
import { JOB_STATE_LABEL } from '@forme/domain';
import { formatInteger } from '@forme/domain';
import type { BindingStyle } from '@forme/domain';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function bindingFor(finishing: readonly string[]): BindingStyle {
  if (finishing.includes('saddle-stitch')) return 'saddle-stitch';
  if (finishing.includes('perfect-bound')) return 'perfect-bound';
  return 'none';
}

export default async function PrepressJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, matrix] = await Promise.all([getJob(id), getPriceMatrix()]);
  if (!job) notFound();

  const report = job.preflightReportId ? await getPreflightReport(job.preflightReportId) : null;
  const counts = countBySeverity(report);
  const blocked = hasBlockingFailure(report);
  const due = dueStatus(job.dueAt, getNow());
  const size = matrix.sizes.find((entry) => entry.id === job.spec.size);
  const trimWidthMm = size ? size.widthMm : 148;
  const trimHeightMm = size ? size.heightMm : 210;
  const pageCount = job.spec.pageCount ?? 4;
  const binding = bindingFor(job.spec.finishing);
  const scheme = largestSchemeThatFits(job.quote.sheetId, trimWidthMm, trimHeightMm, pageCount);

  return (
    <main id="main" className="mx-auto max-w-[100rem] px-4 py-5">
      <header className="border-b-2 border-rule-strong pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="label-caps text-muted">
              {job.customer.name} · {job.customer.contact} · {job.customer.terms}
            </p>
            <h1 className="num mt-1 text-2xl tracking-tight" data-testid="job-reference">
              {job.reference}
            </h1>
            <p className="mt-1 max-w-[70ch] text-sm">{job.description}</p>
          </div>
          <dl className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <dt className="label-caps text-muted">State</dt>
              <dd className="mt-1">
                <StatusMark owner={job.owner} label={JOB_STATE_LABEL[job.state]} />
              </dd>
            </div>
            <div>
              <dt className="label-caps text-muted">Due</dt>
              <dd className="num text-sm">{formatDate(job.dueAt)}</dd>
              <dd className={`num text-2xs ${due.overdue ? 'text-magenta' : 'text-muted'}`}>
                {due.overdue ? `OVERDUE ${due.label}` : due.label}
              </dd>
            </div>
            <div>
              <dt className="label-caps text-muted">Press</dt>
              <dd className="num text-sm">{job.quote.press}</dd>
            </div>
            <div>
              <dt className="label-caps text-muted">Sheets</dt>
              <dd className="num text-sm">{formatInteger(job.quote.sheetsRequired)}</dd>
            </div>
            <Link
              href={`/app/jobs/${job.reference}`}
              className="border border-rule-strong px-3 py-1.5 label-caps text-muted transition-colors duration-100 hover:border-ink hover:text-ink"
            >
              Customer view
            </Link>
          </dl>
        </div>
        {blocked ? (
          <p className="mt-3 border-l-2 border-magenta pl-3 text-sm text-magenta">
            {counts.FAIL} failure{counts.FAIL === 1 ? '' : 's'} outstanding. Override each one with
            a written reason or send the job back to the customer for a resupply. Nothing goes to
            proof until this list is clear.
          </p>
        ) : null}
      </header>

      <div className="mt-5 grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-6">
          {report ? (
            <TechnicalReport report={report} reference={job.reference} counts={counts} />
          ) : (
            <section className="border border-rule-strong">
              <h2 className="label-caps border-b-2 border-rule-strong px-3 py-2">Preflight</h2>
              <p className="px-3 py-6 text-sm text-muted" data-testid="empty-state">
                No artwork logged against this job yet, so there is nothing to check. The report
                appears here within a minute of the file arriving.
              </p>
            </section>
          )}
          <CommentThread reference={job.reference} comments={job.comments} />
        </div>

        <div className="space-y-6">
          <ImpositionPlanner
            sizeId={job.spec.size}
            trimWidthMm={trimWidthMm}
            trimHeightMm={trimHeightMm}
            initial={{
              sheetId: job.quote.sheetId,
              sizeId: job.spec.size,
              scheme,
              binding,
              workStyle: binding === 'none' ? 'sheetwise' : 'work-and-turn',
              gripperMm: 10,
              creepMm: binding === 'saddle-stitch' ? 0.6 : 0,
              pageCount,
              quantity: job.spec.quantity,
            }}
          />
          <section className="border border-rule-strong">
            <h2 className="label-caps border-b-2 border-rule-strong px-3 py-2">Job record</h2>
            <dl className="num grid grid-cols-[9rem_1fr] gap-y-1 px-3 py-3 text-xs">
              <dt className="label-caps text-muted">Received</dt>
              <dd>{formatDateTime(job.receivedAt)}</dd>
              <dt className="label-caps text-muted">Proof</dt>
              <dd>{job.proofAt ? formatDateTime(job.proofAt) : 'Not issued'}</dd>
              <dt className="label-caps text-muted">Proof state</dt>
              <dd>{job.proofState.replace('_', ' ')}</dd>
              <dt className="label-caps text-muted">Report</dt>
              <dd>{job.preflightReportId ?? 'None'}</dd>
              <dt className="label-caps text-muted">Files</dt>
              <dd>{job.files.length}</dd>
            </dl>
            {job.note ? (
              <p className="border-t border-rule px-3 py-2 text-xs text-muted">{job.note}</p>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
