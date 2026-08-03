import type { PreflightCheckId, PreflightReport } from '@forme/domain';
import { apiFetch, apiFetchOrNull } from './client';

export { countBySeverity, hasBlockingFailure, PREFLIGHT_CHECK_COUNT } from '@forme/domain';

export async function getPreflightReport(id: string): Promise<PreflightReport | null> {
  const result = await apiFetchOrNull<{ report: PreflightReport }>(
    `/preflight/${encodeURIComponent(id)}`,
  );
  return result?.report ?? null;
}

/**
 * Records a waiver. The reason is required by the API, not just by the form —
 * eight characters minimum, because it goes on the job's permanent record as
 * the justification for putting a known defect on press.
 */
export async function waiveCheck(
  reportId: string,
  checkId: PreflightCheckId,
  reason: string,
  kind: 'WAIVED' | 'OVERRIDDEN' = 'WAIVED',
): Promise<void> {
  await apiFetch(`/preflight/${encodeURIComponent(reportId)}/waive`, {
    method: 'POST',
    body: JSON.stringify({ checkId, reason, kind }),
  });
}

export async function overrideCheck(
  reportId: string,
  checkId: PreflightCheckId,
  reason: string,
): Promise<void> {
  await waiveCheck(reportId, checkId, reason, 'OVERRIDDEN');
}

// subscribeToPreflight lives in ./live — it runs in the browser and must not
// pull this module's next/headers dependency into the client bundle.
