import { cookies } from 'next/headers';
import type { Role, Session } from '@forme/domain';
import { ApiError, apiFetch } from './client';

export const ROLE_LABEL: Record<Role, string> = {
  customer: 'Customer',
  prepress: 'Prepress',
  floor: 'Press floor',
  admin: 'Admin',
};

export const ROLE_HOME: Record<Role, string> = {
  customer: '/app',
  prepress: '/prepress',
  floor: '/floor',
  admin: '/admin/pricing',
};

const SIGNED_OUT: Session = {
  role: 'customer',
  operator: '',
  customerId: null,
  signedIn: false,
};

interface MeResponse {
  user: { id: string; email: string; name: string; role: Role; customerId: string | null };
}

/**
 * The session, read from the API rather than trusted from a cookie.
 *
 * The scaffold stored the role in a plain `forme_role` cookie, which meant
 * anyone who could open devtools could set `forme_role=admin` and walk into the
 * price matrix. The cookie now carries a signed token the API verifies, and the
 * role comes back from `/auth/me` — the browser no longer asserts anything.
 */
export async function getSession(): Promise<Session> {
  try {
    const { user } = await apiFetch<MeResponse>('/auth/me');
    return {
      role: user.role,
      operator: user.name,
      customerId: user.customerId,
      signedIn: true,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return SIGNED_OUT;
    throw error;
  }
}

export async function signIn(email: string, password: string): Promise<Role> {
  const response = await fetch(`${process.env.API_URL ?? 'http://127.0.0.1:4000/api'}/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  const body = (await response.json()) as
    | MeResponse
    | { error: { message: string } };

  if (!response.ok) {
    throw new ApiError(
      response.status,
      'SIGN_IN_FAILED',
      'error' in body ? body.error.message : 'Email or password is incorrect.',
    );
  }

  // Forward the API's Set-Cookie headers onto our own response, so the browser
  // ends up holding the tokens rather than this server process.
  const jar = await cookies();
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(';');
    const index = pair?.indexOf('=') ?? -1;
    if (index > 0 && pair) {
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      jar.set(name, value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: name === 'forme_refresh' ? '/auth' : '/',
      });
    }
  }

  return (body as MeResponse).user.role;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete('forme_access');
  jar.delete('forme_refresh');
}

export function isRole(value: string): value is Role {
  return value === 'customer' || value === 'prepress' || value === 'floor' || value === 'admin';
}
