import type { PriceEdit, PriceEditResult, PriceMatrix } from '@forme/domain';
import { ApiError, apiFetch } from './client';

export async function getPriceMatrix(): Promise<PriceMatrix> {
  const { matrix } = await apiFetch<{ matrix: PriceMatrix }>('/pricing', {
    authenticated: false,
  });
  return matrix;
}

/**
 * Returns a result rather than throwing: the admin grid shows the message
 * against the cell that was being edited, and a thrown error would replace the
 * whole table with an error boundary over one bad keystroke.
 */
export async function updatePriceCell(edit: PriceEdit): Promise<PriceEditResult> {
  try {
    await apiFetch('/pricing', { method: 'PATCH', body: JSON.stringify(edit) });
    return { ok: true, message: 'Saved.' };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}
