export type Role = 'staff' | 'demo';

const TOKEN_KEY = 'tallow.session.token';
const ROLE_KEY = 'tallow.session.role';

/**
 * The session lives in sessionStorage, not localStorage: a staff session should
 * not outlive the tab it was opened in.
 */
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRole(): Role | null {
  try {
    const r = sessionStorage.getItem(ROLE_KEY);
    return r === 'staff' || r === 'demo' ? r : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, role: Role) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(ROLE_KEY, role);
  } catch {
    /* private browsing — the in-flight session still works, it just won't survive a reload */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ROLE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export class ReadOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlyError';
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Your staff session has expired. Sign in again.');
    this.name = 'SessionExpiredError';
  }
}

/**
 * fetch for /api/admin/* — attaches the bearer token and turns the two auth
 * failures into typed errors so callers do not have to inspect status codes.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    clearSession();
    throw new SessionExpiredError();
  }
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new ReadOnlyError(
      data.error || 'Changes are disabled on the public preview.'
    );
  }
  return res;
}
