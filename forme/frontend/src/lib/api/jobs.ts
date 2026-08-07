import type { Job, JobFilter } from '@forme/domain';
import { apiFetch, apiFetchOrNull } from './client';

/**
 * Scoping is the API's job, not this module's. A customer's token restricts the
 * result server-side, so there is no customerId to pass and no way to ask for
 * someone else's account by editing a URL.
 */
export async function getJobs(filter: JobFilter = {}): Promise<readonly Job[]> {
  const query = filter.states?.length ? `?state=${filter.states.join(',')}` : '';
  const { jobs } = await apiFetch<{ jobs: Job[] }>(`/jobs${query}`);
  return jobs;
}

export async function getJob(reference: string): Promise<Job | null> {
  const result = await apiFetchOrNull<{ job: Job }>(`/jobs/${encodeURIComponent(reference)}`);
  return result?.job ?? null;
}

export async function getPrepressQueue(): Promise<readonly Job[]> {
  const { jobs } = await apiFetch<{ jobs: Job[] }>('/jobs/queue');
  return jobs;
}

export async function approveProof(reference: string): Promise<void> {
  await apiFetch(`/jobs/${encodeURIComponent(reference)}/approve`, { method: 'POST' });
}

export async function rejectProof(reference: string, reason: string): Promise<void> {
  await apiFetch(`/jobs/${encodeURIComponent(reference)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function addComment(reference: string, body: string): Promise<void> {
  await apiFetch(`/jobs/${encodeURIComponent(reference)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function setJobState(
  reference: string,
  to: string,
  reason?: string,
): Promise<void> {
  await apiFetch(`/jobs/${encodeURIComponent(reference)}/state`, {
    method: 'PATCH',
    body: JSON.stringify({ to, ...(reason ? { reason } : {}) }),
  });
}

export interface NewJobInput {
  description: string;
  spec: import('@forme/domain').QuoteInput;
}

/** The API recomputes the price and the due date; neither is sent from here. */
export async function createJob(input: NewJobInput): Promise<Job> {
  const { job } = await apiFetch<{ job: Job }>('/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return job;
}
