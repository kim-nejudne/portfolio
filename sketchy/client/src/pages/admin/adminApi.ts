// `/api/admin` calls for the admin page (F80; the category editor's since F81). Lazy-loaded with `/admin`, never in the player
// bundle. No zod: the server validates. The session cookie is httpOnly and same-origin, so fetch
// sends it by itself; the page never sees the token.

import type {
  AdminBulkResponse,
  AdminCategoriesResponse,
  AdminCategoryCreateBody,
  AdminCategoryPatchBody,
  AdminCategoryResponse,
  AdminErrorBody,
  AdminLoginBody,
  AdminSetupBody,
  AdminStatusResponse,
  AdminWordBody,
  AdminWordPatchBody,
} from '../../../../shared/types.js';

export const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

/** A refused call: the server's message, its status (0 when unreachable) and the field it names. */
export class AdminApiError extends Error {
  override name = 'AdminApiError';
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit, check: (data: unknown) => data is T) {
  let response: Response;
  try {
    response = await fetch(`/api/admin${path}`, { ...init, credentials: 'same-origin' });
  } catch {
    throw new AdminApiError(UNREACHABLE, 0);
  }
  const data = (await response.json().catch(() => null)) as T | AdminErrorBody | null;
  if (!response.ok || !check(data)) {
    const { error, field } = (data ?? {}) as Partial<AdminErrorBody>;
    throw new AdminApiError(
      typeof error === 'string' ? error : `Something went wrong (${response.status}).`,
      response.status,
      typeof field === 'string' ? field : undefined,
    );
  }
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
