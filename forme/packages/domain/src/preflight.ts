/**
 * Predicates over a preflight report. Pure — the report itself is produced by
 * the API's worker, but both sides agree on what it means.
 */
import type { CheckSeverity, PreflightCheckId, PreflightReport } from './types';

export const PREFLIGHT_CHECK_IDS: readonly PreflightCheckId[] = [
  'trim-size',
  'bleed',
  'safety-margin',
  'fonts-embedded',
  'image-resolution',
  'colour-space',
  'total-area-coverage',
  'spot-colours',
  'white-overprint',
  'hairlines',
  'page-count',
  'pdfx4',
];

export const PREFLIGHT_CHECK_COUNT = PREFLIGHT_CHECK_IDS.length;

export function emptySeverityCounts(): Record<CheckSeverity, number> {
  return { PASS: 0, WARN: 0, FAIL: 0, SKIPPED: 0 };
}

/**
 * A waived or overridden check counts as PASS, because that is what it means
 * operationally: a person took responsibility and the job moves.
 */
export function countBySeverity(report: PreflightReport | null): Record<CheckSeverity, number> {
  const counts = emptySeverityCounts();
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
 * SKIPPED is not a pass. It means the analysis for that check was not run —
 * because the tooling to run it honestly is not implemented — and the report
 * says so rather than implying a clean result.
 */
export function skippedChecks(report: PreflightReport | null): readonly PreflightCheckId[] {
  if (!report) return [];
  return report.checks.filter((check) => check.severity === 'SKIPPED').map((check) => check.id);
}

export function isReportComplete(report: PreflightReport | null): boolean {
  return report !== null && report.checks.length === PREFLIGHT_CHECK_COUNT;
}
