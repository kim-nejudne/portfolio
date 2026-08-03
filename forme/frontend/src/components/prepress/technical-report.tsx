import { SeverityMark } from '@/components/furniture/status-mark';
import { waiveCheckAction } from '@/lib/actions/jobs';
import { formatDateTime } from '@forme/domain';
import type { PreflightCheck, PreflightReport } from '@forme/domain';

function WaiverForm({
  reference,
  reportId,
  check,
}: {
  reference: string;
  reportId: string;
  check: PreflightCheck;
}) {
  const override = check.severity === 'FAIL';
  const inputId = `reason-${check.id}`;
  return (
    <form action={waiveCheckAction} className="mt-3 border-t border-rule pt-3">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="checkId" value={check.id} />
      <input type="hidden" name="kind" value={override ? 'OVERRIDE' : 'WAIVE'} />
      <label htmlFor={inputId} className="label-caps text-muted">
        {override ? 'Reason for overriding this failure' : 'Reason for waiving this warning'}
      </label>
      <textarea
        id={inputId}
        name="reason"
        required
        minLength={8}
        rows={2}
        aria-describedby={`${inputId}-help`}
        className="mt-1 w-full border border-rule-strong bg-paper px-2 py-1 text-xs focus:border-ink"
        data-testid={`waive-reason-${check.id}`}
      />
      <p id={`${inputId}-help`} className="mt-1 text-2xs text-muted">
        Required, eight characters or more. The reason goes on the job&apos;s permanent record with
        your name against it, and the customer can read it.
      </p>
      <button
        type="submit"
        data-testid={`waive-submit-${check.id}`}
        className={`mt-2 border px-3 py-1.5 label-caps transition-colors duration-100 ${
          override
            ? 'border-magenta text-magenta hover:bg-magenta hover:text-paper'
            : 'border-ink hover:bg-ink hover:text-paper'
        }`}
      >
        {override ? 'Override failure' : 'Waive warning'}
      </button>
    </form>
  );
}

function TechnicalRow({
  check,
  reference,
  reportId,
  index,
}: {
  check: PreflightCheck;
  reference: string;
  reportId: string;
  index: number;
}) {
  const waived = check.waiver !== null;
  const actionable = !waived && check.severity !== 'PASS';
  return (
    <details
      open={actionable || waived}
      className="anim-land border-b border-rule last:border-b-0"
      style={{ animationDelay: `${index * 30}ms` }}
      data-testid="preflight-check-row"
    >
      <summary className="flex min-h-8 items-center gap-3 px-3 py-1.5 transition-colors duration-100 hover:bg-skeleton">
        <SeverityMark severity={check.severity} waived={waived} kind={check.waiver?.kind} />
        <span className={`flex-1 truncate text-xs ${waived ? 'text-muted line-through' : ''}`}>
          {check.label}
        </span>
        <span className="num hidden text-2xs text-muted lg:inline">
          {check.measured} / {check.tolerance}
        </span>
      </summary>
      <div className="border-t border-rule px-3 py-3">
        <p className={`text-xs ${check.severity === 'FAIL' && !waived ? 'text-magenta' : ''}`}>
          {check.finding}
        </p>
        <dl className="num mt-2 grid grid-cols-[6.5rem_1fr] gap-y-0.5 text-2xs">
          <dt className="text-muted">MEASURED</dt>
          <dd>{check.measured}</dd>
          <dt className="text-muted">TOLERANCE</dt>
          <dd>{check.tolerance}</dd>
          <dt className="text-muted">LOCATION</dt>
          <dd>{check.page}</dd>
        </dl>
        {waived && check.waiver ? (
          <p className="mt-2 border-t border-rule pt-2 text-2xs">
            <span className="num">{check.waiver.kind}</span>
            <span className="num text-muted">
              {' '}
              {check.waiver.by} · {formatDateTime(check.waiver.at)}
            </span>
            <span className="mt-1 block text-xs">{check.waiver.reason}</span>
          </p>
        ) : check.severity === 'PASS' ? null : (
          <WaiverForm reference={reference} reportId={reportId} check={check} />
        )}
      </div>
    </details>
  );
}

export function TechnicalReport({
  report,
  reference,
  counts,
}: {
  report: PreflightReport;
  reference: string;
  counts: { PASS: number; WARN: number; FAIL: number };
}) {
  return (
    <section aria-labelledby="report" className="border border-rule-strong">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-rule-strong px-3 py-2">
        <h2 id="report" className="label-caps">
          Preflight report {report.id}
        </h2>
        <span className="num flex gap-3 text-2xs">
          <span>{counts.PASS} PASS</span>
          <span>{counts.WARN} WARN</span>
          <span className={counts.FAIL > 0 ? 'text-magenta' : 'text-muted'}>{counts.FAIL} FAIL</span>
        </span>
      </div>
      <dl className="num grid grid-cols-2 gap-px border-b border-rule bg-rule text-2xs">
        <div className="bg-paper px-3 py-1.5">
          <dt className="label-caps text-muted">File</dt>
          <dd className="truncate" title={report.fileName}>
            {report.fileName}
          </dd>
        </div>
        <div className="bg-paper px-3 py-1.5">
          <dt className="label-caps text-muted">Ran</dt>
          <dd>{formatDateTime(report.ranAt)}</dd>
        </div>
      </dl>
      {report.checks.map((check, index) => (
        <TechnicalRow
          key={check.id}
          check={check}
          reference={reference}
          reportId={report.id}
          index={index}
        />
      ))}
    </section>
  );
}
