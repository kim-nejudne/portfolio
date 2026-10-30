// The super-admin's tools on the Built-in tab (F106): import, delete, export and hide the sample.
// Each change is live at once, so every built-in list on the page fetches again after it. Then the
// draft API the set editor saves a built-in through, and Publish and Discard draft (F107).

import type {
  AdminDraftIdsResponse,
  AdminDraftResponse,
  AdminImportResponse,
  AdminPublishErrorBody,
  QuestionSet,
} from '../../../shared/types.js';
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

/** An admin GET, throwing a readable Error when the server cannot be reached. */
async function adminGet(path: string): Promise<Response> {
  try {
    return await fetch(`/api/admin${path}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
}

/** `GET /api/admin/built-in-sets/export`: the file's text and the name the server gave it. */
export async function exportBuiltIns(): Promise<{ text: string; fileName: string }> {
  const response = await adminGet('/built-in-sets/export');
  await checked(response, 'Could not export');
  const named = /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '');
  return { text: await response.text(), fileName: named?.[1] ?? 'buzzr-built-ins.json' };
}

const draftPath = (id: string) => `/built-in-sets/${encodeURIComponent(id)}/draft`;

/** `GET /api/admin/built-in-sets/drafts`: which built-in sets have a draft, for the "Draft" badges. */
export async function loadDraftIds(): Promise<string[]> {
  const response = await checked(await adminGet('/built-in-sets/drafts'), 'Could not load drafts');
  return ((await response.json()) as AdminDraftIdsResponse).ids;
}

/** The draft, or the live set when there is none; undefined when the set is not a built-in. */
export async function loadDraft(id: string): Promise<AdminDraftResponse | undefined> {
  const response = await adminGet(draftPath(id));
  if (response.status === 404) return undefined;
  await checked(response, 'Could not load the set');
  return (await response.json()) as AdminDraftResponse;
}

/** `PUT /api/admin/built-in-sets/:id/draft`: the editor's autosave. */
export async function saveDraft(set: QuestionSet): Promise<void> {
  await checked(await adminWrite('PUT', draftPath(set.id), set), 'Could not save the draft');
}

/** `DELETE /api/admin/built-in-sets/:id/draft`: the live set, which the editor shows again. */
export async function discardDraft(id: string): Promise<QuestionSet> {
  const response = await checked(
    await adminWrite('DELETE', draftPath(id), {}),
    'Could not discard the draft',
  );
  return ((await response.json()) as AdminDraftResponse).set;
}

export type PublishResult = { ok: true } | { ok: false; error: string; problems: string[] };

/**
 * `POST /api/admin/built-in-sets/:id/publish`. A draft that is not playable comes back as its
 * problems ("Question 2 › answer: The answer is required"); any other failure throws.
 */
export async function publishDraft(id: string): Promise<PublishResult> {
  const response = await adminWrite('POST', `/built-in-sets/${encodeURIComponent(id)}/publish`, {});
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as AdminPublishErrorBody | null;
    if (Array.isArray(body?.problems)) {
      return { ok: false, error: body.error, problems: body.problems };
    }
  }
  await checked(response, 'Could not publish');
  refreshBuiltInSets();
  return { ok: true };
}
