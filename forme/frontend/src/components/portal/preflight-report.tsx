import { SeverityMark } from '@/components/furniture/status-mark';
import { formatDateTime } from '@forme/domain';
import type { PreflightCheck, PreflightReport } from '@forme/domain';

function CheckRow({ check, index }: { check: PreflightCheck; index: number }) {
  const waived = check.waiver !== null;
  return (
    <details
      open={waived}
      className="anim-land border-b border-rule last:border-b-0"
      style={{ animationDelay: `${index * 40}ms` }}
      data-testid="preflight-check-row"
    >
      <summary className="flex min-h-8 items-center gap-3 px-3 py-1.5 transition-colors duration-100 hover:bg-skeleton">
        <SeverityMark severity={check.severity} waived={waived} kind={check.waiver?.kind} />
        <span className={`flex-1 truncate text-sm ${waived ? 'text-muted line-through' : ''}`}>
          {check.label}
        </span>
        <span className="num hidden text-2xs text-muted sm:inline">{check.measured}</span>
        <span aria-hidden="true" className="num text-2xs text-muted">
          +
        </span>
      </summary>
      <div className="border-t border-rule bg-paper px-3 py-3">
        <p className={`text-sm ${check.severity === 'FAIL' && !waived ? 'text-magenta' : ''}`}>
          {check.finding}
        </p>
        <dl className="num mt-3 grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
          <dt className="text-muted">MEASURED</dt>
          <dd>{check.measured}</dd>
          <dt className="text-muted">TOLERANCE</dt>
          <dd>{check.tolerance}</dd>
          <dt className="text-muted">LOCATION</dt>
          <dd>{check.page}</dd>
        </dl>
        {check.waiver ? (
          <p className="mt-3 border-t border-rule pt-2 text-xs">
            <span className="num text-muted">{check.waiver.kind} </span>
            <span className="num">{check.waiver.by}</span>
            <span className="num text-muted"> · {formatDateTime(check.waiver.at)}</span>
            <span className="mt-1 block">{check.waiver.reason}</span>
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function PreflightReportPanel({
  report,
  counts,
  blocked,
}: {
  report: PreflightReport | null;
  counts: { PASS: number; WARN: number; FAIL: number };
  blocked: boolean;
}) {
  if (!report) {
    return (
      <section aria-labelledby="preflight" className="border border-rule-strong">
        <h2 id="preflight" className="label-caps border-b-2 border-rule-strong px-3 py-2">
          Preflight
        </h2>
        <p className="px-3 py-6 text-sm text-muted" data-testid="empty-state">
          No report yet. Preflight runs within a minute of the artwork arriving and lands twelve
          checks against the artwork specification.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="preflight" className="border border-rule-strong">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-rule-strong px-3 py-2">
        <h2 id="preflight" className="label-caps">
          Preflight report
        </h2>
        <span className="num flex items-center gap-3 text-2xs">
          <span>{counts.PASS} PASS</span>
          <span className={counts.WARN > 0 ? 'text-ink' : 'text-muted'}>{counts.WARN} WARN</span>
          <span className={counts.FAIL > 0 ? 'text-magenta' : 'text-muted'}>
            {counts.FAIL} FAIL
          </span>
        </span>
      </div>
      <dl className="num grid grid-cols-2 gap-px border-b border-rule bg-rule text-xs sm:grid-cols-4">
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">File</dt>
          <dd className="truncate" title={report.fileName}>
            {report.fileName}
          </dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Pages</dt>
          <dd>{report.pages}pp</dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Ran</dt>
          <dd>{formatDateTime(report.ranAt)}</dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Report</dt>
          <dd>{report.id}</dd>
        </div>
      </dl>
      {blocked ? (
        <p className="border-b border-rule bg-paper px-3 py-2 text-xs text-magenta">
          {counts.FAIL} failure{counts.FAIL === 1 ? '' : 's'} outstanding. The job cannot go to
          proof until prepress overrides each one with a written reason.
        </p>
      ) : null}
      <div>
        {report.checks.map((check, index) => (
          <CheckRow key={check.id} check={check} index={index} />
        ))}
      </div>
    </section>
  );
}
