'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ROLE_HOME, isRole, setRole, signOut } from '@/lib/api/session';

export async function chooseRoleAction(formData: FormData): Promise<void> {
  const value = formData.get('role');
  if (typeof value !== 'string' || !isRole(value)) return;
  await setRole(value);
  revalidatePath('/', 'layout');
  redirect(ROLE_HOME[value]);
}

export async function signOutAction(): Promise<void> {
  await signOut();
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}
