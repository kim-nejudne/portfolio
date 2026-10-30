// The super-admin's tools on the Built-in tab (F106): import, delete, export and hide the sample.
// Each change is live at once, so every built-in list on the page fetches again after it.

import type { AdminImportResponse } from '../../../shared/types.js';
import { adminSessionEnded, adminWrite, errorFrom, UNREACHABLE } from './adminSession.js';
import { refreshBuiltInSets } from './builtInSets.js';

export const ADMIN_SESSION_ENDED_ERROR = 'Your admin session has ended. Sign in again at /admin.';

/** A 401 ends the session here too, so the admin tools hide; any other failure throws its message. */
async function checked(response: Response, fallback: string): Promise<Response> {
  if (response.status === 401) {
    adminSessionEnded();
    throw new Error(ADMIN_SESSION_ENDED_ERROR);
  }
  if (!response.ok) throw await errorFrom(response, fallback);
  return response;
}

/** `POST /api/admin/built-in-sets/import` with the file's text as the body. */
export async function importToBuiltIns(fileText: string): Promise<AdminImportResponse> {
  const response = await checked(
    await adminWrite('POST', '/built-in-sets/import', fileText),
    'Could not import',
  );
  refreshBuiltInSets();
  return (await response.json()) as AdminImportResponse;
}

/** `DELETE /api/admin/built-in-sets/:id`: the live set and its draft. */
export async function deleteBuiltIn(id: string): Promise<void> {
  await checked(
    await adminWrite('DELETE', `/built-in-sets/${encodeURIComponent(id)}`, {}),
    'Could not delete',
  );
  refreshBuiltInSets();
}

/** `PUT /api/admin/sample-hidden`. */
export async function setSampleHidden(hidden: boolean): Promise<void> {
  await checked(
    await adminWrite('PUT', '/sample-hidden', { hidden }),
    'Could not change the sample',
  );
  refreshBuiltInSets();
}

/** `GET /api/admin/built-in-sets/export`: the file's text and the name the server gave it. */
export async function exportBuiltIns(): Promise<{ text: string; fileName: string }> {
  let response: Response;
  try {
    response = await fetch('/api/admin/built-in-sets/export');
  } catch {
    throw new Error(UNREACHABLE);
  }
  await checked(response, 'Could not export');
  const named = /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '');
  return { text: await response.text(), fileName: named?.[1] ?? 'buzzr-built-ins.json' };
}
