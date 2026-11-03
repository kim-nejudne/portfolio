// `/api/admin` calls for the admin page (F80; the category editor's since F81, export and import
// since F82). Lazy-loaded with `/admin`, never in the player
// bundle. No zod: the server validates. The session cookie is httpOnly and same-origin, so fetch
// sends it by itself; the page never sees the token.

import { EXPORT_ALL_FILE, exportFileName } from '../../../../shared/constants.js';
import type {
  AdminBulkResponse,
  AdminCategoriesResponse,
  AdminCategoryCreateBody,
  AdminCategoryPatchBody,
  AdminCategoryResponse,
  AdminErrorBody,
  AdminImportClash,
  AdminImportErrorBody,
  AdminImportResponse,
  AdminLoginBody,
  AdminSetupBody,
  AdminStatusResponse,
  AdminWordBody,
  AdminWordPatchBody,
} from '../../../../shared/types.js';

export const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

/**
 * A refused call: the server's message, its status (0 when unreachable) and the field it names. An
 * import may also list the file's problems (`issues`) or the category whose id it has (`clash`).
 */
export class AdminApiError extends Error {
  override name = 'AdminApiError';
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
    readonly issues?: string[],
    readonly clash?: { id: string; title: string },
  ) {
    super(message);
  }
}

/** Any fetch that fails to connect is the same message. */
async function request(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api/admin${path}`, { ...init, credentials: 'same-origin' });
  } catch {
    throw new AdminApiError(UNREACHABLE, 0);
  }
}

/** The refusal in an answer's body, whatever shape it came in. */
function refusal(response: Response, data: unknown): AdminApiError {
  const { error, field, issues, clash } = (data ?? {}) as Partial<AdminImportErrorBody>;
  return new AdminApiError(
    typeof error === 'string' ? error : `Something went wrong (${response.status}).`,
    response.status,
    typeof field === 'string' ? field : undefined,
    Array.isArray(issues) ? issues.filter((i): i is string => typeof i === 'string') : undefined,
    typeof clash?.id === 'string' && typeof clash.title === 'string'
      ? { id: clash.id, title: clash.title }
      : undefined,
  );
}

async function call<T>(path: string, init: RequestInit, check: (data: unknown) => data is T) {
  const response = await request(path, init);
  const data = (await response.json().catch(() => null)) as T | AdminErrorBody | null;
  if (!response.ok || !check(data)) throw refusal(response, data);
  return data;
}

const isStatus = (data: unknown): data is AdminStatusResponse =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as AdminStatusResponse).configured === 'boolean' &&
  typeof (data as AdminStatusResponse).passwordSet === 'boolean' &&
  typeof (data as AdminStatusResponse).signedIn === 'boolean';

const isOk = (data: unknown): data is { ok: true } =>
  typeof data === 'object' && data !== null && (data as { ok?: unknown }).ok === true;

/** `GET /api/admin/status`. */
export function adminStatus(): Promise<AdminStatusResponse> {
  return call('/status', { cache: 'no-store' }, isStatus);
}

/** A write: JSON, as the server's write guard requires (DELETE included, with an empty body). */
function write<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  check: (data: unknown) => data is T,
): Promise<T> {
  return call(
    path,
    { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    check,
  );
}

const post = (path: string, body: unknown) => write('POST', path, body, isOk);

/** First visit: the setup code and a new password. Signs this browser in. */
export const adminSetup = (body: AdminSetupBody) => post('/setup', body);
/** "Forgot password": the setup code and a new password. Signs everyone else out. */
export const adminReset = (body: AdminSetupBody) => post('/reset', body);
export const adminLogin = (body: AdminLoginBody) => post('/login', body);
export const adminLogout = () => post('/logout', {});

const has = (data: unknown, key: string) =>
  typeof data === 'object' && data !== null && key in data;
const isList = (data: unknown): data is AdminCategoriesResponse =>
  has(data, 'categories') && Array.isArray((data as AdminCategoriesResponse).categories);
const isCategory = (data: unknown): data is AdminCategoryResponse =>
  has(data, 'category') && Array.isArray((data as AdminCategoryResponse).category?.words);
const isBulk = (data: unknown): data is AdminBulkResponse =>
  isCategory(data) && Array.isArray((data as AdminBulkResponse).errors);

const categoryPath = (id: string) => `/categories/${encodeURIComponent(id)}`;
const wordPath = (id: string, wordId: string) =>
  `${categoryPath(id)}/words/${encodeURIComponent(wordId)}`;

export const listCategories = () => call('/categories', { cache: 'no-store' }, isList);
export const getCategory = (id: string) =>
  call(categoryPath(id), { cache: 'no-store' }, isCategory);
export const createCategory = (body: AdminCategoryCreateBody) =>
  write('POST', '/categories', body, isCategory);
export const patchCategory = (id: string, body: AdminCategoryPatchBody) =>
  write('PATCH', categoryPath(id), body, isCategory);
export const deleteCategory = (id: string) => write('DELETE', categoryPath(id), {}, isOk);
export const addWord = (id: string, body: AdminWordBody) =>
  write('POST', `${categoryPath(id)}/words`, body, isCategory);
export const patchWord = (id: string, wordId: string, body: AdminWordPatchBody) =>
  write('PATCH', wordPath(id, wordId), body, isCategory);
export const deleteWord = (id: string, wordId: string) =>
  write('DELETE', wordPath(id, wordId), {}, isCategory);
export const addWords = (id: string, text: string) =>
  write('POST', `${categoryPath(id)}/words/bulk`, { text }, isBulk);

// ---------- Export and import (F82) ----------

/** A download: the file's bytes and the name to save it under. */
export interface AdminDownload {
  blob: Blob;
  name: string;
}

/** `GET /api/admin/export/:id`, or every category with no id ("Export all"). */
export async function exportCategories(id?: string): Promise<AdminDownload> {
  const response = await request(
    id === undefined ? '/export' : `/export/${encodeURIComponent(id)}`,
    {
      cache: 'no-store',
    },
  );
  if (!response.ok) throw refusal(response, await response.json().catch(() => null));
  return {
    blob: await response.blob(),
    name: id === undefined ? EXPORT_ALL_FILE : exportFileName(id),
  };
}

/** Saves a download through a temporary link, as the browser's own download. */
export function saveDownload({ blob, name }: AdminDownload): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Late enough that a slow browser (Safari, Firefox) has read the bytes for the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const isImport = (data: unknown): data is AdminImportResponse =>
  isCategory(data) && typeof (data as AdminImportResponse).replaced === 'boolean';

/**
 * `POST /api/admin/import`: the file's text is the body, as chosen (the server parses and checks
 * it). `onClash` answers a 409 for an id that is already a category's.
 */
export function importCategory(text: string, onClash?: AdminImportClash) {
  const query = onClash === undefined ? '' : `?onClash=${onClash}`;
  return call(
    `/import${query}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: text },
    isImport,
  );
}
