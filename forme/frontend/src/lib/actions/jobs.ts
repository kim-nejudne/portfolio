'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addComment, approveProof, createJob, rejectProof } from '@/lib/api/jobs';
import { overrideCheck, waiveCheck } from '@/lib/api/preflight';
import { parseQuoteInput } from '@/lib/api/quotes';
import { getSession } from '@/lib/api/session';
import { storeArtwork } from '@/lib/api/uploads';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function approveProofAction(formData: FormData): Promise<void> {
  const reference = text(formData, 'reference');
  const session = await getSession();
  await approveProof(reference, session.operator);
  revalidatePath(`/app/jobs/${reference}`);
  revalidatePath('/app');
  revalidatePath('/prepress');
}

export async function rejectProofAction(formData: FormData): Promise<void> {
  const reference = text(formData, 'reference');
  const reason = text(formData, 'reason');
  if (reason.length < 4) return;
  const session = await getSession();
  await rejectProof(reference, reason, session.operator);
  revalidatePath(`/app/jobs/${reference}`);
  revalidatePath('/app');
  revalidatePath('/prepress');
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const reference = text(formData, 'reference');
  const body = text(formData, 'body');
  if (body.length === 0) return;
  const session = await getSession();
  await addComment(reference, body, session.operator, session.role);
  revalidatePath(`/app/jobs/${reference}`);
  revalidatePath(`/prepress/jobs/${reference}`);
}

export async function waiveCheckAction(formData: FormData): Promise<void> {
  const reference = text(formData, 'reference');
  const reportId = text(formData, 'reportId');
  const checkId = text(formData, 'checkId');
  const reason = text(formData, 'reason');
  const kind = text(formData, 'kind');
  if (reason.length < 8) return;
  const session = await getSession();
  if (kind === 'OVERRIDE') await overrideCheck(reportId, checkId, reason, session.operator);
  else await waiveCheck(reportId, checkId, reason, session.operator);
  revalidatePath(`/prepress/jobs/${reference}`);
  revalidatePath(`/app/jobs/${reference}`);
  revalidatePath('/prepress');
}

export async function createJobAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const query: Record<string, string | string[]> = {
    product: text(formData, 'product'),
    size: text(formData, 'size'),
    pages: text(formData, 'pages'),
    stock: text(formData, 'stock'),
    colours: text(formData, 'colours'),
    quantity: text(formData, 'quantity'),
    finishing: formData.getAll('finishing').filter((entry): entry is string => typeof entry === 'string'),
    turnaround: text(formData, 'turnaround'),
  };
  const { input } = parseQuoteInput(query);
  const description = text(formData, 'description') || 'Untitled job';
  const file = formData.get('artwork');
  const hasFile = file instanceof File && file.size > 0;

  const job = await createJob({
    customerId: session.customerId ?? 'nine-dots',
    description,
    spec: input,
    fileName: hasFile ? (file as File).name : null,
    fileBytes: hasFile ? (file as File).size : 0,
  });

  if (hasFile) await storeArtwork(job.reference, file as File);

  revalidatePath('/app');
  revalidatePath('/prepress');
  redirect(`/app/jobs/${job.reference}`);
}
