import { cookies } from 'next/headers';
import type { ErrorEnvelope } from './errors';

const BASE = process.env.API_URL ?? 'http://127.0.0.1:4000/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The one place the web app talks to the API.
 *
 * Every call runs on the server — there is no client-side fetch in this app —
 * so the auth cookies have to be forwarded by hand: a Server Component's fetch
 * carries no browser cookie jar of its own.
 *
 * Errors arrive in a single envelope shape from the API's exception filter, so
 * this is also the only place that shape is parsed. Callers get an ApiError
 * with a message already written to be shown to a person.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { authenticated?: boolean } = {},
): Promise<T> {
  const { authenticated = true, ...rest } = init;

  const headers = new Headers(rest.headers);
  if (rest.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (authenticated) {
    const jar = await cookies();
    const forwarded = jar
      .getAll()
      .filter((cookie) => cookie.name.startsWith('forme_'))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
    if (forwarded) headers.set('cookie', forwarded);
  }

  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    // Job state changes under us constantly; a cached queue is a wrong queue.
    cache: 'no-store',
  });

  if (!response.ok) {
    let envelope: ErrorEnvelope | null = null;
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      // A non-JSON body means the API is down or something else answered.
    }
    throw new ApiError(
      response.status,
      envelope?.error.code ?? 'UNKNOWN',
      envelope?.error.message ?? `The API returned ${response.status}.`,
      envelope?.error.fields,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Reads that should render an empty state rather than an error page on 401/404. */
export async function apiFetchOrNull<T>(
  path: string,
  init?: RequestInit & { authenticated?: boolean },
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 401)) return null;
    throw error;
  }
}

export { BASE as API_BASE };
