/**
 * The client half of the replay story.
 *
 * The API tests prove the *server* treats a repeated batch as a no-op. These
 * prove the phone holds up its end: that a sale is durable the moment it is
 * recorded, that a restart does not lose it, that a restart does not re-send
 * what was already accepted, and that a failed drain leaves the queue exactly
 * as it found it.
 *
 * Dexie runs against a real IndexedDB implementation here (see `test/setup.ts`),
 * so "durable" is being observed rather than assumed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, getClientId, getCursor, resetLocalDatabase, setCursor } from './db';
import { enqueue, failed, hydrate, pending, subscribe } from './queue';
import { drain } from './sync-client';
import type { PullResponse, PushResponse } from '@suki/domain';

const CREATED_AT = '2026-08-01T09:00:00.000Z';

function aSale(customerId = 'cus-1') {
  return {
    type: 'credit-sale' as const,
    payload: {
      customerId,
      total: 40,
      items: [{ itemId: 'itm-1', name: 'Sunsilk Sachet', qty: 4, unitPrice: 10, lineTotal: 40 }],
    },
    createdAt: CREATED_AT,
  };
}

/** A server that accepts everything and returns nothing new on pull. */
function acceptingServer() {
  const pushed: string[][] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/sync/push')) {
      const body = JSON.parse(String(init?.body)) as { operations: { id: string }[] };
      const ids = body.operations.map((o) => o.id);
      pushed.push(ids);
      return jsonResponse<PushResponse>({ accepted: ids, rejected: [], cursor: ids.length });
    }
    return jsonResponse<PullResponse>({ operations: [], cursor: 0, hasMore: false });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { pushed, fetchMock };
}

function jsonResponse<T>(value: T): Response {
  return { ok: true, status: 200, json: async () => value } as Response;
}

beforeEach(async () => {
  await resetLocalDatabase();
  await hydrate();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('enqueue', () => {
  it('writes to IndexedDB before it resolves', async () => {
    acceptingServer();
    const op = await enqueue(aSale());

    // Read straight from the table, not from the in-memory cache. The cache
    // proving the row exists would prove nothing about a phone that dies.
    const stored = await db.operations.get(op.id);
    expect(stored).toMatchObject({ id: op.id, type: 'credit-sale', createdAt: CREATED_AT });
  });

  it('generates a UUID the server will accept as an idempotency key', async () => {
    acceptingServer();
    const op = await enqueue(aSale());
    expect(op.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('keeps a caller-supplied id, so a retry reuses it', async () => {
    acceptingServer();
    const id = crypto.randomUUID();
    const op = await enqueue({ ...aSale(), id });
    expect(op.id).toBe(id);
    expect(await db.operations.get(id)).toBeDefined();
  });

  it('notifies subscribers with the new pending row', async () => {
    acceptingServer();
    const seen: number[] = [];
    const stop = subscribe((snap) => seen.push(snap.pending.length));
    await enqueue(aSale());
    stop();
    expect(seen.at(-1)).toBeGreaterThan(seen[0]!);
  });
});

describe('restart', () => {
  /**
   * The phone dies mid-afternoon and is switched back on. Everything recorded
   * must still be there and still be pending — this is the whole reason the
   * queue is in IndexedDB rather than in a React state atom.
   */
  it('recovers pending operations from disk', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    await enqueue(aSale('cus-a'));
    await enqueue(aSale('cus-b'));

    // Simulate the restart: nothing in memory, everything on disk.
    await hydrate();
    expect(pending()).toHaveLength(2);
    expect(await db.operations.count()).toBe(2);
  });

  /**
   * The mirror image, and the one that would silently double a customer's
   * utang if it were wrong: operations the server already accepted must not be
   * pushed again after a restart.
   */
  it('does not re-send operations the server already accepted', async () => {
    const { pushed } = acceptingServer();
    await enqueue(aSale());
    await drain();
    expect(pushed).toHaveLength(1);

    // `drain` writes Dexie; the in-memory cache is refreshed by queue.ts's
    // wrapper, not by the sync client. Re-hydrating here is the restart.
    await hydrate();
    expect(pending()).toHaveLength(0);

    await drain();

    // Second drain found nothing pending, so it never issued a push at all.
    expect(pushed).toHaveLength(1);
    expect(await db.operations.count()).toBe(1);
  });

  it('keeps the same client id across a restart', async () => {
    const first = await getClientId();
    await hydrate();
    expect(await getClientId()).toBe(first);
  });
});

describe('drain', () => {
  it('marks accepted operations synced and clears them from pending', async () => {
    acceptingServer();
    const op = await enqueue(aSale());
    const result = await drain();

    expect(result.ok).toBe(true);
    expect(result.pushed).toBe(1);
    expect((await db.operations.get(op.id))?.status).toBe('synced');
  });

  /**
   * Failure must be uneventful. A shop with one bar of signal fails to drain
   * far more often than it succeeds, and every one of those failures has to
   * leave the queue exactly as it was.
   */
  it('loses nothing when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    const op = await enqueue(aSale());

    const result = await drain();
    expect(result.ok).toBe(false);
    expect(result.pushed).toBe(0);
    expect((await db.operations.get(op.id))?.status).toBe('pending');
    // Still pending on disk and still pending in the cache: a failed drain is
    // a no-op in both directions, so the next attempt sends the same batch.
    expect(pending()).toHaveLength(1);
    await hydrate();
    expect(pending()).toHaveLength(1);
  });

  it('loses nothing when the server answers 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response),
    );
    const op = await enqueue(aSale());
    expect((await drain()).ok).toBe(false);
    expect((await db.operations.get(op.id))?.status).toBe('pending');
  });

  /**
   * A rejection is permanent and must be visible. Dropping the row would make
   * a sale disappear with no explanation, which is worse than one that failed
   * loudly — the shopkeeper can re-key a failure she can see.
   */
  it('marks rejected operations failed and keeps them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/sync/push')) {
          const body = JSON.parse(String(init?.body)) as { operations: { id: string }[] };
          return jsonResponse<PushResponse>({
            accepted: [],
            rejected: body.operations.map((o) => ({ id: o.id, reason: 'Sale total does not match' })),
            cursor: 0,
          });
        }
        return jsonResponse<PullResponse>({ operations: [], cursor: 0, hasMore: false });
      }),
    );

    const op = await enqueue(aSale());
    const result = await drain();

    expect(result.rejected).toHaveLength(1);
    expect((await db.operations.get(op.id))?.status).toBe('failed');
    await hydrate();
    expect(failed().map((o) => o.id)).toEqual([op.id]);
    expect(pending()).toHaveLength(0);
  });

  it('never re-sends a rejected operation', async () => {
    // A permanent rejection retried forever is a queue that never drains.
    const pushes: string[][] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/sync/push')) {
          const body = JSON.parse(String(init?.body)) as { operations: { id: string }[] };
          pushes.push(body.operations.map((o) => o.id));
          return jsonResponse<PushResponse>({
            accepted: [],
            rejected: body.operations.map((o) => ({ id: o.id, reason: 'nope' })),
            cursor: 0,
          });
        }
        return jsonResponse<PullResponse>({ operations: [], cursor: 0, hasMore: false });
      }),
    );

    await enqueue(aSale());
    await drain();
    await drain();
    expect(pushes).toHaveLength(1);
  });

  it('stores pulled operations and advances the cursor', async () => {
    const remote = {
      id: crypto.randomUUID(),
      type: 'payment' as const,
      payload: { customerId: 'cus-1', amount: 25 },
      createdAt: CREATED_AT,
      seq: 7,
      appliedAt: CREATED_AT,
    };
    let served = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/sync/push')) {
          return jsonResponse<PushResponse>({ accepted: [], rejected: [], cursor: 0 });
        }
        if (served) return jsonResponse<PullResponse>({ operations: [], cursor: 7, hasMore: false });
        served = true;
        return jsonResponse<PullResponse>({ operations: [remote], cursor: 7, hasMore: false });
      }),
    );

    const result = await drain();
    expect(result.pulled).toBe(1);
    expect(await getCursor()).toBe(7);
    // Another device's operation arrives already settled — it is on the server
    // by definition, so pushing it back would be a pointless round trip.
    expect((await db.operations.get(remote.id))?.status).toBe('synced');
  });

  it('pages through a pull until the server says there is no more', async () => {
    const page = (seq: number) => ({
      id: crypto.randomUUID(),
      type: 'payment' as const,
      payload: { customerId: 'cus-1', amount: seq },
      createdAt: CREATED_AT,
      seq,
      appliedAt: CREATED_AT,
    });
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/sync/push')) {
          return jsonResponse<PushResponse>({ accepted: [], rejected: [], cursor: 0 });
        }
        call += 1;
        return jsonResponse<PullResponse>({
          operations: [page(call)],
          cursor: call,
          hasMore: call < 3,
        });
      }),
    );

    expect((await drain()).pulled).toBe(3);
    expect(await getCursor()).toBe(3);
  });

  it('resumes a pull from the stored cursor rather than restarting', async () => {
    // A phone back from three days offline must not re-download the whole log.
    await setCursor(42);
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        if (url.includes('/sync/push')) {
          return jsonResponse<PushResponse>({ accepted: [], rejected: [], cursor: 42 });
        }
        return jsonResponse<PullResponse>({ operations: [], cursor: 42, hasMore: false });
      }),
    );

    await drain();
    expect(urls.some((u) => u.includes('since=42'))).toBe(true);
  });

  it('sends the device key on every request', async () => {
    const headers: Record<string, string>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        headers.push(init?.headers as Record<string, string>);
        if (url.includes('/sync/push')) {
          return jsonResponse<PushResponse>({ accepted: [], rejected: [], cursor: 0 });
        }
        return jsonResponse<PullResponse>({ operations: [], cursor: 0, hasMore: false });
      }),
    );

    await enqueue(aSale());
    await drain();
    expect(headers.length).toBeGreaterThan(0);
    for (const h of headers) expect(h).toHaveProperty('x-suki-device-key');
  });

  /**
   * Two drains at once would push the same rows twice. Harmless against this
   * server — that is the point of the whole design — but it doubles the
   * request count on a connection that is already the scarce resource.
   */
  it('runs one drain at a time', async () => {
    const { pushed } = acceptingServer();
    await enqueue(aSale());
    await Promise.all([drain(), drain(), drain()]);
    expect(pushed).toHaveLength(1);
  });
});
