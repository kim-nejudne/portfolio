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

/** Fetches `url` and parses its body with `schema`; never rejects. */
export async function fetchJson<T>(
  fetcher: Fetch,
  url: string,
  schema: z.ZodType<T>,
): Promise<FetchResult<T>> {
  throw new Error(`not implemented: ${url}`);
}

/** One line for a log. */
export function describe(error: FetchError): string {
  throw new Error(`not implemented: ${error.kind}`);
}
