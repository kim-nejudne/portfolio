import type { Equal, Expect } from '@dojo/type-utils';
import { getJson, getUser, type Fetch, type User } from './index';

type cases = [
  Expect<Equal<ReturnType<typeof getUser>, Promise<User>>>, // getUser resolves to a User
];

/** A stand-in for fetch that answers every URL with `body` and records what it was asked. */
function answer(body: unknown, status = 200) {
  const urls: string[] = [];
  const fetcher: Fetch = async (url) => {
    urls.push(url);
    return new Response(JSON.stringify(body), { status });
  };
  return { fetcher, urls };
}

test('getUser fetches /users/<id> and returns the parsed user', async () => {
  for (const id of [1, 7, 42, 1009]) {
    const { fetcher, urls } = answer({ id, name: `user ${id}`, admin: true });
    expect(await getUser(fetcher, id)).toEqual({ id, name: `user ${id}` });
    expect(urls).toEqual([`/users/${id}`]);
  }
});

test('getUser rejects a body that is not a user', async () => {
  await expect(
    getUser(answer({ id: '7', name: 'Ada' }).fetcher, 7),
  ).rejects.toBeInstanceOf(Error);
  await expect(getUser(answer({ id: 7 }).fetcher, 7)).rejects.toBeInstanceOf(
    Error,
  );
  await expect(getUser(answer(null).fetcher, 7)).rejects.toBeInstanceOf(Error);
});

test('getUser rejects a response that is not ok', async () => {
  const { fetcher } = answer({ id: 7, name: 'Ada' }, 404);
  await expect(getUser(fetcher, 7)).rejects.toThrow(
    'GET /users/7 failed with 404',
  );
});

test('getJson returns what its parser returns', async () => {
  const { fetcher } = answer([3, 4, 5]);
  const count = (data: unknown) => (Array.isArray(data) ? data.length : -1);
  expect(await getJson(fetcher, '/numbers', count)).toBe(3);
  expect(await getJson(answer('text').fetcher, '/text', count)).toBe(-1);
});
