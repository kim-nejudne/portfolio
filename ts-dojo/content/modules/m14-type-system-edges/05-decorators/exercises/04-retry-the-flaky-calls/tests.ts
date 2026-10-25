import { retry, StockClient } from './index';

/** Fails with the reasons it is given, one per call, then succeeds. */
class Feed {
  attempts: string[] = [];

  constructor(private readonly reasons: unknown[]) {}

  @retry(4)
  async load(page: number, size: number): Promise<string> {
    this.attempts.push(`${page}/${size}`);
    if (this.reasons.length > 0) {
      throw this.reasons.shift();
    }
    return `page ${page} of ${size}`;
  }

  @retry(1)
  async once(): Promise<number> {
    this.attempts.push('once');
    if (this.reasons.length > 0) {
      throw this.reasons.shift();
    }
    return this.attempts.length;
  }

  @retry(2)
  static async ping(host: string): Promise<string> {
    return `pong from ${host}`;
  }
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => 'resolved',
    (reason: unknown) => reason,
  );
}

test('a call that succeeds at once is tried once', async () => {
  const feed = new Feed([]);
  expect(await feed.load(1, 20)).toBe('page 1 of 20');
  expect(feed.attempts).toEqual(['1/20']);
});

test('failed attempts are retried with the same arguments and this', async () => {
  const feed = new Feed([new Error('a'), new Error('b')]);
  expect(await feed.load(3, 10)).toBe('page 3 of 10');
  expect(feed.attempts).toEqual(['3/10', '3/10', '3/10']);
});

test('the StockClient succeeds on its third attempt', async () => {
  const client = new StockClient(2);
  expect(await client.count('pear')).toBe(40);
  expect(client.calls).toBe(3);
});

test('after the last attempt the call rejects with the method name and the count', async () => {
  const client = new StockClient(5);
  await expect(client.count('plum')).rejects.toThrow(
    'count failed after 3 attempts',
  );
  expect(client.calls).toBe(3);

  const feed = new Feed(['x', 'y', 'z', 'w', 'v']);
  await expect(feed.load(1, 1)).rejects.toThrow('load failed after 4 attempts');
  expect(feed.attempts).toHaveLength(4);
});

test('the rejection keeps the last reason as its cause', async () => {
  const last = new Error('timeout');
  const error = await rejection(
    new Feed(['busy', 'busy', 'busy', last]).load(2, 5),
  );
  expect(error).toBeInstanceOf(Error);
  if (error instanceof Error) {
    expect(error.cause).toBe(last);
  }
});

test('retry(1) tries once', async () => {
  const feed = new Feed(['down']);
  const error = await rejection(feed.once());
  expect(error).toBeInstanceOf(Error);
  if (error instanceof Error) {
    expect(error.message).toBe('once failed after 1 attempts');
    expect(error.cause).toBe('down');
  }
  expect(feed.attempts).toEqual(['once']);
});

test('instances keep their own state', async () => {
  const flaky = new StockClient(1);
  const steady = new StockClient(0);
  expect(await steady.count('fig')).toBe(30);
  expect(await flaky.count('kiwi')).toBe(40);
  expect(steady.calls).toBe(1);
  expect(flaky.calls).toBe(2);
});

test('a static method can be retried', async () => {
  expect(await Feed.ping('db')).toBe('pong from db');
});

test('retry rejects a count that is not a whole number from 1', () => {
  for (const times of [0, -2, 1.5, Number.NaN]) {
    let error: unknown;
    try {
      retry(times);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(RangeError);
  }
  expect(() => retry(3)).not.toThrow();
});

declare const syncMethod: (this: object, sku: string) => number;
declare const syncContext: ClassMethodDecoratorContext<
  object,
  (this: object, sku: string) => number
>;

// @ts-expect-error
const rejectsSync = () => retry(2)(syncMethod, syncContext); // only async methods
