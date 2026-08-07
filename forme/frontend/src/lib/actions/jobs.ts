'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { PreflightCheckId } from '@forme/domain';
import { parseQuoteInput } from '@/lib/quote-url';
import { addComment, approveProof, createJob, rejectProof } from '@/lib/api/jobs';
import { overrideCheck, waiveCheck } from '@/lib/api/preflight';
import { storeArtwork } from '@/lib/api/uploads';

/**
 * The actor is no longer passed in. Every one of these calls carries the
 * session cookie to the API, which resolves who is acting from the token — the
 * scaffold read a name out of a cookie and sent it along, which meant the
 * "approved by" on a job record was whatever the browser claimed.
 */
function revalidateJob(reference: string): void {
  revalidatePath(`/app/jobs/${reference}`);
  revalidatePath('/app');
  revalidatePath('/prepress');
}

export async function approveProofAction(formData: FormData): Promise<void> {
  const reference = String(formData.get('reference') ?? '');
  await approveProof(reference);
  revalidateJob(reference);
}

export async function rejectProofAction(formData: FormData): Promise<void> {
  const reference = String(formData.get('reference') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (reason.length < 4) return;
  await rejectProof(reference, reason);
  revalidateJob(reference);
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const reference = String(formData.get('reference') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (body.length === 0) return;
  await addComment(reference, body);
  revalidateJob(reference);
}

export async function waiveCheckAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');
  const checkId = String(formData.get('checkId') ?? '') as PreflightCheckId;
  const reference = String(formData.get('reference') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'WAIVED');
  if (reason.length < 8) return;

  if (kind === 'OVERRIDDEN') await overrideCheck(reportId, checkId, reason);
  else await waiveCheck(reportId, checkId, reason);

  revalidatePath(`/prepress/jobs/${reference}`);
  revalidateJob(reference);
}

export async function createJobAction(formData: FormData): Promise<void> {
  const description = String(formData.get('description') ?? '').trim();
  const query = Object.fromEntries(
    [...formData.entries()]
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, String(value)]),
  );
  const { input } = parseQuoteInput(query);

  const job = await createJob({ description, spec: input });

  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    await storeArtwork(job.reference, file);
  }

  revalidatePath('/app');
  redirect(`/app/jobs/${job.reference}`);
}
