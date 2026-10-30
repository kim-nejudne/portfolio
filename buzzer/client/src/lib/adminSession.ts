import { useEffect, useSyncExternalStore } from 'react';
import type { AdminSessionResponse, HttpErrorBody } from '../../../shared/types.js';

/**
 * Whether this browser is signed in as the super-admin (F105). `disabled`: the server has no
 * `ADMIN_PASSWORD_HASH`, so every admin route is 404. `failed`: the check never reached the server.
 */
export type AdminSessionState =
  | { kind: 'loading' }
  | { kind: 'disabled' }
  | { kind: 'failed' }
  | { kind: 'signedOut' }
  | { kind: 'signedIn'; expiresAt: number };

const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

// One state for the page's life, shared by every component that asks, like the built-in list.
let state: AdminSessionState = { kind: 'loading' };
let checking = false;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setState(next: AdminSessionState): void {
  clearTimeout(expiryTimer);
  state = next;
  // The server forgets the session at `expiresAt`; the page follows without asking.
  if (next.kind === 'signedIn') {
    expiryTimer = setTimeout(() => setState({ kind: 'signedOut' }), next.expiresAt - Date.now());
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `GET /api/admin/session`, once per page load unless `retry` asks again. */
function check(): void {
  if (checking) return;
  checking = true;
  fetch('/api/admin/session').then(
    async (response) => {
      checking = false;
      if (response.status === 404) return setState({ kind: 'disabled' });
      if (response.status === 401) return setState({ kind: 'signedOut' });
      const data = (await response.json().catch(() => null)) as AdminSessionResponse | null;
      setState(
        response.ok && typeof data?.expiresAt === 'number'
          ? { kind: 'signedIn', expiresAt: data.expiresAt }
          : { kind: 'failed' },
      );
    },
    () => {
      checking = false;
      setState({ kind: 'failed' });
    },
  );
}

/** A same-origin JSON POST, as every admin write must be. */
async function adminPost(path: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`/api/admin${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
}

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  const data = (await response.json().catch(() => null)) as HttpErrorBody | null;
  return new Error(data?.error ?? `${fallback} (${response.status}).`);
}

/** `POST /api/admin/login`. Throws an Error carrying the server's message (wrong password, too many tries). */
export async function adminSignIn(password: string): Promise<void> {
  const response = await adminPost('/login', { password });
  if (response.status === 404) {
    setState({ kind: 'disabled' });
    throw new Error('Admin sign-in is not set up on this server.');
  }
  const data = (await response
    .clone()
    .json()
    .catch(() => null)) as AdminSessionResponse | null;
  if (!response.ok || typeof data?.expiresAt !== 'number') {
    throw await errorFrom(response, 'Could not sign in');
  }
  setState({ kind: 'signedIn', expiresAt: data.expiresAt });
}

/** `POST /api/admin/logout`. Throws a readable Error when the server did not answer. */
export async function adminSignOut(): Promise<void> {
  const response = await adminPost('/logout', {});
  if (!response.ok) throw await errorFrom(response, 'Could not sign out');
  setState({ kind: 'signedOut' });
}

/**
 * For later admin calls: a 401 means the session ended on the server (a restart, or 12 h), so the
 * page shows the sign-in form again.
 */
export function adminSessionEnded(): void {
  setState({ kind: 'signedOut' });
}

/** The admin session, checked with the server on first use. `retry` asks again after `failed`. */
export function useAdminSession(): AdminSessionState & { retry: () => void } {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (state.kind === 'loading') check();
  }, []);
  return {
    ...current,
    retry: () => {
      setState({ kind: 'loading' });
      check();
    },
  };
}

/** Forgets the session state, as a new page load would. For tests. */
export function resetAdminSession(): void {
  clearTimeout(expiryTimer);
  state = { kind: 'loading' };
  checking = false;
}
