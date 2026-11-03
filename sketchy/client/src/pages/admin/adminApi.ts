// `/api/admin` calls for the admin page (F80). Lazy-loaded with `/admin`, never in the player
// bundle. No zod: the server validates. The session cookie is httpOnly and same-origin, so fetch
// sends it by itself; the page never sees the token.

import type {
  AdminLoginBody,
  AdminSetupBody,
  AdminStatusResponse,
  HttpErrorBody,
} from '../../../../shared/types.js';

export const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

async function call<T>(path: string, init: RequestInit, check: (data: unknown) => data is T) {
  let response: Response;
  try {
    response = await fetch(`/api/admin${path}`, { ...init, credentials: 'same-origin' });
  } catch {
    throw new Error(UNREACHABLE);
  }
  const data = (await response.json().catch(() => null)) as T | HttpErrorBody | null;
  if (!response.ok || !check(data)) {
    const error = (data as HttpErrorBody | null)?.error;
    throw new Error(
      typeof error === 'string' ? error : `Something went wrong (${response.status}).`,
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

function post(path: string, body: unknown): Promise<{ ok: true }> {
  return call(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    isOk,
  );
}

/** First visit: the setup code and a new password. Signs this browser in. */
export const adminSetup = (body: AdminSetupBody) => post('/setup', body);
/** "Forgot password": the setup code and a new password. Signs everyone else out. */
export const adminReset = (body: AdminSetupBody) => post('/reset', body);
export const adminLogin = (body: AdminLoginBody) => post('/login', body);
export const adminLogout = () => post('/logout', {});
