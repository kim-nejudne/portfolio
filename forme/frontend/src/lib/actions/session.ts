'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ROLE_HOME, isRole, signIn, signOut } from '@/lib/api/session';
import { ApiError } from '@/lib/api/client';
import { safeRedirectPath } from '@/lib/safe-redirect';

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = formData.get('next');

  let role: string;
  try {
    role = await signIn(email, password);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const params = new URLSearchParams({ error: error.message });
    if (typeof next === 'string' && next) params.set('next', next);
    redirect(`/sign-in?${params.toString()}`);
  }

  revalidatePath('/', 'layout');
  const home = isRole(role) ? ROLE_HOME[role] : '/';
  redirect(safeRedirectPath(next, home));
}

/**
 * The demo picker, kept from the scaffold but no longer a lie.
 *
 * It used to write `forme_role=admin` straight into a cookie the app then
 * trusted. It now signs in as that role's seeded demo account, so the picker is
 * a convenience over real authentication rather than a bypass of it — and those
 * accounts are flagged read-only, so a visitor can walk every surface without
 * being able to change what the next visitor sees.
 */
export async function chooseRoleAction(formData: FormData): Promise<void> {
  const role = String(formData.get('role') ?? '');
  if (!isRole(role)) return;

  const password = process.env.DEMO_PASSWORD ?? 'forme-demo-2026';
  // Used as a bare <form action>, so it cannot return a value. A failure here
  // means the seed never ran; sending the visitor to sign-in is more useful
  // than a blank screen.
  try {
    await signIn(`${role}@forme.demo`, password);
  } catch (error) {
    if (error instanceof ApiError) redirect('/sign-in?demo=unavailable');
    throw error;
  }

  revalidatePath('/', 'layout');
  redirect(safeRedirectPath(formData.get('next'), ROLE_HOME[role]));
}

export async function signOutAction(): Promise<void> {
  await signOut();
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}
