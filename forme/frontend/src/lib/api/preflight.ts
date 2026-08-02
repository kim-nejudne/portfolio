import type { CheckSeverity, PreflightCheck, PreflightReport, PreflightWaiver } from '@/lib/types';
import { getNow } from './clock';
import { apiDelay } from './delay';
import { PREFLIGHT_REPORTS, REPORT_INTAKE } from './fixtures/preflight';
import { readReports, writeReport } from './store';

export async function getPreflightReport(id: string): Promise<PreflightReport | null> {
  await apiDelay(110);
  return readReports().find((report) => report.id === id) ?? null;
}

export async function getReportForJob(reference: string): Promise<PreflightReport | null> {
  await apiDelay(110);
  return readReports().find((report) => report.jobReference === reference) ?? null;
}

export function reportById(id: string | null): PreflightReport | null {
  if (!id) return null;
  return readReports().find((report) => report.id === id) ?? null;
}

export function countBySeverity(
  report: PreflightReport | null,
): Record<CheckSeverity, number> {
  const counts: Record<CheckSeverity, number> = { PASS: 0, WARN: 0, FAIL: 0 };
  if (!report) return counts;
  for (const check of report.checks) {
    if (check.waiver) counts.PASS += 1;
    else counts[check.severity] += 1;
  }
  return counts;
}

/** A job with an unwaived FAIL cannot go to proof. */
export function hasBlockingFailure(report: PreflightReport | null): boolean {
  if (!report) return false;
  return report.checks.some((check) => check.severity === 'FAIL' && check.waiver === null);
}

/**
 * Streams a report check by check, in order. The pacing lives here, not in a
 * component: the real implementation is a WebSocket subscription with the same
 * signature, so no screen changes when it lands.
 */
export function subscribeToPreflight(
  jobId: string,
  onCheck: (check: PreflightCheck, index: number, total: number) => void,
): () => void {
  const report =
    PREFLIGHT_REPORTS.find((entry) => entry.jobReference === jobId) ?? REPORT_INTAKE;
  const checks = report.checks;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  checks.forEach((check, index) => {
    timers.push(
      setTimeout(
        () => {
          if (!cancelled) onCheck(check, index, checks.length);
        },
        420 + index * 260,
      ),
    );
  });

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}

export function preflightCheckCount(): number {
  return REPORT_INTAKE.checks.length;
}

async function applyWaiver(
  reportId: string,
  checkId: string,
  waiver: PreflightWaiver,
): Promise<void> {
  await apiDelay(130);
  const report = readReports().find((entry) => entry.id === reportId);
  if (!report) return;
  writeReport(reportId, {
    ...report,
    checks: report.checks.map((check) =>
      check.id === checkId ? { ...check, waiver } : check,
    ),
  });
}

export async function waiveCheck(
  reportId: string,
  checkId: string,
  reason: string,
  by: string,
): Promise<void> {
  await applyWaiver(reportId, checkId, { reason, by, at: getNow(), kind: 'WAIVED' });
}

export async function overrideCheck(
  reportId: string,
  checkId: string,
  reason: string,
  by: string,
): Promise<void> {
  await applyWaiver(reportId, checkId, { reason, by, at: getNow(), kind: 'OVERRIDDEN' });
}
