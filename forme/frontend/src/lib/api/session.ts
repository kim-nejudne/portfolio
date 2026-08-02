import { cookies } from 'next/headers';
import type { Role, Session } from '@/lib/types';

export const ROLE_COOKIE = 'forme_role';

const ROLES: readonly Role[] = ['customer', 'prepress', 'floor', 'admin'];

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

const OPERATORS: Record<Role, string> = {
  customer: 'Ivy Sarmiento',
  prepress: 'L. Bautista',
  floor: 'A. Mendoza',
  admin: 'M. Reyes',
};

/** Customer sessions are scoped to one account. Nine Dots Studio is the demo account. */
const DEMO_CUSTOMER_ID = 'nine-dots';

/**
 * The whole session mechanism. Layouts read this server-side; no component
 * checks a role for itself. A real auth layer replaces the cookie read here.
 */
export async function getSession(): Promise<Session> {
  const store = await cookies();
  const value = store.get(ROLE_COOKIE)?.value;
  const role = ROLES.find((entry) => entry === value);
  return {
    role: role ?? 'customer',
    operator: OPERATORS[role ?? 'customer'],
    customerId: (role ?? 'customer') === 'customer' ? DEMO_CUSTOMER_ID : null,
    signedIn: role !== undefined,
  };
}

export async function setRole(role: Role): Promise<void> {
  const store = await cookies();
  store.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(ROLE_COOKIE);
}

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role === value);
}
