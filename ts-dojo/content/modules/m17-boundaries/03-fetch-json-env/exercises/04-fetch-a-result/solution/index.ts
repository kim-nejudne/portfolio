import { z } from 'zod';

/** Anything shaped like fetch: the real one, or a stand-in in the tests. */
export type Fetch = (url: string) => Promise<Response>;

export type FetchError =
  | { kind: 'network'; message: string }
  | { kind: 'status'; status: number }
  | { kind: 'syntax'; message: string }
  | { kind: 'shape'; issues: { path: string; message: string }[] };

export type FetchResult<T> =
  { ok: true; value: T } | { ok: false; error: FetchError };

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Fetches `url` and parses its body with `schema`; never rejects. */
export async function fetchJson<T>(
  fetcher: Fetch,
  url: string,
  schema: z.ZodType<T>,
): Promise<FetchResult<T>> {
  let res: Response;
  try {
    res = await fetcher(url);
  } catch (reason) {
    return {
      ok: false,
      error: { kind: 'network', message: messageOf(reason) },
    };
  }
  if (!res.ok) {
    return { ok: false, error: { kind: 'status', status: res.status } };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch (reason) {
    return { ok: false, error: { kind: 'syntax', message: messageOf(reason) } };
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    return { ok: false, error: { kind: 'shape', issues } };
  }
  return { ok: true, value: result.data };
}

/** One line for a log. */
export function describe(error: FetchError): string {
  switch (error.kind) {
    case 'network':
      return `network: ${error.message}`;
    case 'status':
      return `HTTP ${error.status}`;
    case 'syntax':
      return `not JSON: ${error.message}`;
    case 'shape':
      return error.issues
        .map(({ path, message }) => (path ? `${path}: ${message}` : message))
        .join('; ');
    default: {
      const unhandled: never = error;
      return unhandled;
    }
  }
}
