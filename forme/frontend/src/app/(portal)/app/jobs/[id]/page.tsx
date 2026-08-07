import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProgressStrip } from '@/components/furniture/progress-strip';
import { StatusMark } from '@/components/furniture/status-mark';
import { CommentThread } from '@/components/portal/comment-thread';
import { FileListPanel, JobSpecPanel } from '@/components/portal/job-panels';
import { PreflightReportPanel } from '@/components/portal/preflight-report';
import { LivePreflight } from '@/components/portal/live-preflight';
import { ProofDecision } from '@/components/portal/proof-decision';
import { ProofViewer } from '@/components/portal/proof-viewer';
import { StateTimeline } from '@/components/portal/state-timeline';
import { getNow } from '@/lib/api/clock';
import { getJob } from '@/lib/api/jobs';
import { countBySeverity, getPreflightReport, hasBlockingFailure } from '@/lib/api/preflight';
import { getPriceMatrix } from '@/lib/api/pricing';
import { getSession } from '@/lib/api/session';
import { dueStatus, formatDate, formatDateTime } from '@forme/domain';
import { JOB_STATE_LABEL, OWNER_LABEL } from '@forme/domain';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, session, matrix] = await Promise.all([getJob(id), getSession(), getPriceMatrix()]);
  if (!job || (session.customerId && job.customerId !== session.customerId)) notFound();

  const report = job.preflightReportId ? await getPreflightReport(job.preflightReportId) : null;
  const counts = countBySeverity(report);
  const blocked = hasBlockingFailure(report);
  const due = dueStatus(job.dueAt, getNow());
  const warnings = report
    ? report.checks.filter((check) => check.severity === 'WARN').map((check) => check.finding)
    : [];

  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 py-6">
      <header className="border-b-2 border-rule-strong pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="label-caps text-muted">
              {job.customer.name} · account {job.customer.account} · {job.customer.city}
            </p>
            <h1 className="num mt-1 text-2xl tracking-tight" data-testid="job-reference">
              {job.reference}
            </h1>
            <p className="mt-1 max-w-[60ch] text-md">{job.description}</p>
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="label-caps text-muted">State</p>
              <p className="mt-1">
                <StatusMark owner={job.owner} label={JOB_STATE_LABEL[job.state]} testId="job-state" />
              </p>
              <p className="num mt-1 text-2xs text-muted">{OWNER_LABEL[job.owner]}</p>
            </div>
            <div>
              <p className="label-caps text-muted">Due</p>
              <p className="num mt-1 text-sm">{formatDate(job.dueAt)}</p>
              <p className={`num text-2xs ${due.overdue ? 'text-magenta' : 'text-muted'}`}>
                {due.label}
              </p>
            </div>
            <div>
              <p className="label-caps text-muted">Press</p>
              <p className="num mt-1 text-sm">{job.quote.press}</p>
              <p className="num text-2xs text-muted">{job.quote.sheetId}</p>
            </div>
            <div>
              <p className="label-caps text-muted">Progress</p>
              <p className="mt-2">
                <ProgressStrip progress={job.progress} owner={job.owner} width={140} />
              </p>
            </div>
          </div>
        </div>
        {job.note ? (
          <p
            className={`mt-3 border-l-2 pl-3 text-sm ${
              job.state === 'HELD'
                ? 'border-yellow'
                : job.state === 'CANCELLED'
                  ? 'border-ink'
                  : 'border-rule-strong text-muted'
            }`}
          >
            {job.note}
          </p>
        ) : null}
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          <StateTimeline job={job} blocked={blocked} />
        </div>

        <div className="space-y-6">
          {job.proofState === 'AWAITING_APPROVAL' ? (
            <ProofDecision
              reference={job.reference}
              despatchAt={job.quote.despatchAt}
              disabled={blocked}
              disabledReason={`${counts.FAIL} check${counts.FAIL === 1 ? '' : 's'} failed. Prepress must override each failure with a written reason before this proof can be approved.`}
            />
          ) : null}

          {job.proofState === 'NONE' ? (
            <section className="border border-rule-strong">
              <h2 className="label-caps border-b-2 border-rule-strong px-3 py-2">Proof</h2>
              <p className="px-3 py-4 text-sm text-muted" data-testid="empty-state">
                No proof yet. A proof is issued once preflight is clear, or once prepress has
                overridden every failure. You will see it here and the job will wait on you.
              </p>
            </section>
          ) : (
            <ProofViewer
              reference={job.reference}
              fileName={report ? report.fileName : job.files[0]?.name ?? 'no file'}
              warnings={warnings}
            />
          )}

          {job.proofState === 'APPROVED' && job.stamps.APPROVED ? (
            <p className="num border border-ink px-3 py-2 text-xs">
              PROOF APPROVED {formatDateTime(job.stamps.APPROVED)} · artwork locked
            </p>
          ) : null}
          {job.proofState === 'REJECTED' ? (
            <p className="num border border-magenta px-3 py-2 text-xs text-magenta">
              PROOF REJECTED · back with prepress for a new proof
            </p>
          ) : null}

          {/* While the worker is running there is no report to render yet, so
              the live panel takes the slot and hands it back on completion. */}
          {job.state === 'PREFLIGHT' && report === null ? (
            <LivePreflight reference={job.reference} />
          ) : (
            <PreflightReportPanel report={report} counts={counts} blocked={blocked} />
          )}
          <CommentThread reference={job.reference} comments={job.comments} />
        </div>

        <div className="space-y-6">
          <JobSpecPanel job={job} matrix={matrix} />
          <FileListPanel job={job} />
        </div>
      </div>
    </main>
  );
}
