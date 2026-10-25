import {
  loadDashboard,
  withTimeout,
  type Api,
  type Post,
  type User,
} from './index';

function after<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

function never<T>(): Promise<T> {
  return new Promise(() => {});
}

/** Resolves to the rejection's message, or to an object holding the value it resolved with. */
function outcome(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => ({ resolved: value }),
    (error: unknown) => (error instanceof Error ? error.message : error),
  );
}

function userFor(id: number): User {
  return { id, name: `user ${id}` };
}

function postsFor(id: number): Post[] {
  return Array.from({ length: id % 4 }, (_, i) => ({
    id: id * 10 + i,
    title: `post ${i} of ${id}`,
  }));
}

/** A fake Api: every call takes `delay` ms, and `inFlight.max` records the most at once. */
function fakeApi(delay: number) {
  const inFlight = { now: 0, max: 0, calls: 0 };
  async function call<T>(value: T): Promise<T> {
    inFlight.now += 1;
    inFlight.calls += 1;
    inFlight.max = Math.max(inFlight.max, inFlight.now);
    const result = await after(delay, value);
    inFlight.now -= 1;
    return result;
  }
  const api: Api = {
    user: (id) => call(userFor(id)),
    posts: (id) => call(postsFor(id)),
    unread: (id) => call(id * 3),
  };
  return { api, inFlight };
}

test('withTimeout resolves with the value of a promise that is already done', async () => {
  await expect(withTimeout(Promise.resolve(42), 50)).resolves.toBe(42);
  await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  const user = userFor(7);
  await expect(withTimeout(Promise.resolve(user), 50)).resolves.toBe(user);
});

test('withTimeout resolves with the value of a promise that is faster than ms', async () => {
  await expect(withTimeout(after(5, 'fast'), 60)).resolves.toBe('fast');
  await expect(withTimeout(after(10, 3), 80)).resolves.toBe(3);
});

test('withTimeout rejects with timeout when the promise is slower than ms', async () => {
  await expect(outcome(withTimeout(after(80, 'slow'), 10))).resolves.toBe(
    'timeout',
  );
  await expect(outcome(withTimeout(never(), 15))).resolves.toBe('timeout');
});

test('withTimeout rejects with an Error', async () => {
  await expect(withTimeout(never(), 5)).rejects.toBeInstanceOf(Error);
});

test('withTimeout passes a rejection through', async () => {
  const failing = Promise.reject(new Error('boom'));
  await expect(outcome(withTimeout(failing, 50))).resolves.toBe('boom');
});

test('loadDashboard resolves to the three parts', async () => {
  for (const id of [1, 2, 5, 11]) {
    const { api } = fakeApi(2);
    await expect(loadDashboard(api, id, 200)).resolves.toEqual({
      user: userFor(id),
      posts: postsFor(id),
      unread: id * 3,
    });
  }
});

test('loadDashboard starts the three calls at once', async () => {
  const { api, inFlight } = fakeApi(10);
  await loadDashboard(api, 4, 200);
  expect(inFlight.calls).toBe(3);
  expect(inFlight.max).toBe(3);
});

test('loadDashboard rejects with timeout when a call never finishes', async () => {
  const { api } = fakeApi(2);
  const hanging: Api = { ...api, posts: () => never() };
  await expect(outcome(loadDashboard(hanging, 1, 30))).resolves.toBe('timeout');
});

test('loadDashboard rejects with timeout when all three together take too long', async () => {
  const { api } = fakeApi(60);
  await expect(outcome(loadDashboard(api, 1, 20))).resolves.toBe('timeout');
});

test('loadDashboard passes the error of a failing call through', async () => {
  const { api } = fakeApi(2);
  const failing: Api = {
    ...api,
    unread: () => Promise.reject(new Error('unread is down')),
  };
  await expect(outcome(loadDashboard(failing, 1, 200))).resolves.toBe(
    'unread is down',
  );
});
