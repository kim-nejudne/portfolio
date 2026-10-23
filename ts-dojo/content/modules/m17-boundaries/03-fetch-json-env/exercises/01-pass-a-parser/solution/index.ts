import { z } from 'zod';

/** Anything shaped like fetch: the real one, or a stand-in in the tests. */
export type Fetch = (url: string) => Promise<Response>;

export const User = z.object({ id: z.number().int(), name: z.string() });
export type User = z.infer<typeof User>;

/** Fetches `url` and parses its JSON body with `parse`. */
export async function getJson<T>(
  fetcher: Fetch,
  url: string,
  parse: (data: unknown) => T,
): Promise<T> {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}`);
  const data: unknown = await res.json();
  return parse(data);
}

/** Loads one user. */
export function getUser(fetcher: Fetch, id: number): Promise<User> {
  return getJson(fetcher, `/users/${id}`, User.parse);
}
