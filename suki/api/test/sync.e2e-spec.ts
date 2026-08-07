/**
 * End-to-end tests for the sync API, against a real Postgres.
 *
 * The centrepiece is the replay test. Every other guarantee in this app rests
 * on one claim — that pushing the same batch again is a no-op — and that claim
 * is not provable by reading the code, because it depends on a database
 * constraint, a conflict clause, and a client that generates its own ids all
 * agreeing. So it is asserted against the real stack: the same batch is pushed
 * three times and the log, the cursor and the derived balance must be identical
 * after the third as after the first.
 *
 * Runs against `DATABASE_URL`, which the npm script points at `suki_test`.
 * `NODE_ENV=test` makes the app ignore `.env` entirely — FORME's suite once
 * seeded one database and asserted against another because a `.env` file beat
 * an explicit environment variable, and it only surfaced by accident.
 */
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { deriveBalance, ledgerEntryFromOperation } from '@suki/domain';
import type { LedgerEntry, Operation, PullResponse, PushResponse } from '@suki/domain';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { DEVICE_HEADER } from '../src/common/device.guard';
import { DATABASE, type Database } from '../src/db/database.module';
import { operations, rejections } from '../src/db/schema';

const DEVICE_KEY = process.env.DEVICE_KEY!;
const CLIENT = 'client-e2e-fixed';

let app: INestApplication;
let db: Database;

/** A batch representing one afternoon: two credit sales and a part payment. */
function anAfternoon(customerId: string) {
  const line = (qty: number, unitPrice: number) => ({
    itemId: 'itm-shampoo',
    name: 'Sunsilk Sachet',
    qty,
    unitPrice,
    lineTotal: qty * unitPrice,
  });
  return [
    {
      id: randomUUID(),
      type: 'credit-sale' as const,
      payload: { customerId, total: 40, items: [line(4, 10)] },
      createdAt: '2026-08-01T09:00:00.000Z',
    },
    {
      id: randomUUID(),
      type: 'credit-sale' as const,
      payload: { customerId, total: 30, items: [line(3, 10)] },
      createdAt: '2026-08-01T14:20:00.000Z',
    },
    {
      id: randomUUID(),
      type: 'payment' as const,
      payload: { customerId, amount: 25 },
      createdAt: '2026-08-01T17:45:00.000Z',
    },
  ];
}

function push(body: unknown, key: string | null = DEVICE_KEY) {
  const req = request(app.getHttpServer() as App).post('/api/sync/push');
  if (key !== null) void req.set(DEVICE_HEADER, key);
  return req.send(body as object);
}

function pull(since = 0, key: string | null = DEVICE_KEY) {
  const req = request(app.getHttpServer() as App).get(
    `/api/sync/pull?clientId=${CLIENT}&since=${since}`,
  );
  if (key !== null) void req.set(DEVICE_HEADER, key);
  return req;
}

/** Every operation the server holds, paged through to the end. */
async function pullEverything(): Promise<{ ops: Operation[]; cursor: number }> {
  const ops: Operation[] = [];
  let cursor = 0;
  for (;;) {
    const res = await pull(cursor).expect(200);
    const body = res.body as PullResponse;
    ops.push(...(body.operations as unknown as Operation[]));
    cursor = body.cursor;
    if (!body.hasMore) return { ops, cursor };
  }
}

beforeAll(async () => {
  if (!DEVICE_KEY) throw new Error('DEVICE_KEY must be set for the e2e suite.');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get<Database>(DATABASE);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  await db.delete(rejections);
  await db.delete(operations);
});

describe('device guard', () => {
  /**
   * The sweep. A sync endpoint that accepts anonymous writes is one anyone on
   * the internet can append to, and "append-only log" makes that permanent.
   */
  it.each([
    ['push', () => push({ clientId: CLIENT, operations: [] }, null)],
    ['pull', () => pull(0, null)],
  ])('rejects %s with no device key', async (_name, call) => {
    await call().expect(401);
  });

  it.each([
    ['push', () => push({ clientId: CLIENT, operations: [] }, 'not-the-key')],
    ['pull', () => pull(0, 'not-the-key')],
  ])('rejects %s with the wrong device key', async (_name, call) => {
    await call().expect(401);
  });

  it('rejects a key that is a prefix of the real one', async () => {
    // Guards against a comparison that stops at the first mismatch or at the
    // shorter length. timingSafeEqual requires equal lengths; this asserts the
    // length check is actually there rather than assumed.
    await push({ clientId: CLIENT, operations: [] }, DEVICE_KEY.slice(0, -1)).expect(401);
  });

  it('accepts the right device key', async () => {
    await push({ clientId: CLIENT, operations: [] }).expect(200);
  });

  it('leaves health open, so a probe does not need the shop key', async () => {
    await request(app.getHttpServer() as App).get('/api/health').expect(200);
  });
});

describe('push replay', () => {
  /**
   * The load-bearing test.
   *
   * A phone flushes its queue, the request times out, and the phone has no way
   * to know whether the write landed. Its only safe move is to send the whole
   * batch again — which is only safe if the server treats a repeat as a no-op.
   */
  it('changes nothing when the same batch is pushed three times', async () => {
    const customerId = 'cus-replay';
    const batch = anAfternoon(customerId);
    const body = { clientId: CLIENT, operations: batch };

    const first = (await push(body).expect(200)).body as PushResponse;
    expect(first.accepted.sort()).toEqual(batch.map((o) => o.id).sort());
    expect(first.rejected).toEqual([]);

    const afterFirst = await pullEverything();
    expect(afterFirst.ops).toHaveLength(3);

    const balanceOf = (ops: Operation[]) =>
      deriveBalance(
        ops.map(ledgerEntryFromOperation).filter((e): e is LedgerEntry => e !== null),
      );
    expect(balanceOf(afterFirst.ops)).toBe(45); // 40 + 30 − 25

    for (const attempt of [2, 3]) {
      const again = (await push(body).expect(200)).body as PushResponse;

      // Already-stored ids come back accepted, not rejected: from the client's
      // side "we stored it" and "we already had it" mean the same thing — stop
      // sending. Reporting a conflict here would strand the row as pending.
      expect(again.accepted.sort()).toEqual(batch.map((o) => o.id).sort());
      expect(again.rejected).toEqual([]);

      const after = await pullEverything();
      expect(after.ops).toHaveLength(3);
      expect(after.cursor).toBe(afterFirst.cursor);
      expect(after.ops.map((o) => o.id)).toEqual(afterFirst.ops.map((o) => o.id));
      expect(balanceOf(after.ops)).toBe(45);

      // The seq column must not advance either. A replay that appended rows
      // with new sequence numbers would leave every other device pulling
      // duplicates forever, even with the ids deduplicated.
      expect((after.ops as unknown as { seq: number }[]).map((o) => o.seq)).toEqual(
        (afterFirst.ops as unknown as { seq: number }[]).map((o) => o.seq),
      );
      expect(attempt).toBeGreaterThan(1);
    }
  });

  it('accepts a batch that overlaps one already sent, storing only what is new', async () => {
    // The realistic case: the phone flushed 3, got a timeout after 2 landed,
    // then queued a 4th and sent all four.
    const batch = anAfternoon('cus-overlap');
    await push({ clientId: CLIENT, operations: batch.slice(0, 2) }).expect(200);

    const extra = {
      id: randomUUID(),
      type: 'payment' as const,
      payload: { customerId: 'cus-overlap', amount: 15 },
      createdAt: '2026-08-01T18:00:00.000Z',
    };
    const second = (await push({ clientId: CLIENT, operations: [...batch, extra] }).expect(200))
      .body as PushResponse;

    expect(second.accepted).toHaveLength(4);
    expect((await pullEverything()).ops).toHaveLength(4);
  });

  it('preserves server order across a replay from a second device', async () => {
    const batch = anAfternoon('cus-two-devices');
    await push({ clientId: 'device-a', operations: batch.slice(0, 2) }).expect(200);
    await push({ clientId: 'device-b', operations: batch.slice(2) }).expect(200);
    const before = await pullEverything();

    // Device A comes back from a week offline and resends everything it has.
    await push({ clientId: 'device-a', operations: batch }).expect(200);
    const after = await pullEverything();

    expect(after.ops.map((o) => o.id)).toEqual(before.ops.map((o) => o.id));
    expect(after.cursor).toBe(before.cursor);
  });
});

describe('pull', () => {
  it('returns nothing new when the client is already at the cursor', async () => {
    await push({ clientId: CLIENT, operations: anAfternoon('cus-cursor') }).expect(200);
    const { cursor } = await pullEverything();

    const res = (await pull(cursor).expect(200)).body as PullResponse;
    expect(res.operations).toEqual([]);
    expect(res.cursor).toBe(cursor);
    expect(res.hasMore).toBe(false);
  });

  it('treats a nonsense cursor as the beginning rather than erroring', async () => {
    await push({ clientId: CLIENT, operations: anAfternoon('cus-junk') }).expect(200);
    for (const since of ['-5', 'abc', '']) {
      const res = await request(app.getHttpServer() as App)
        .get(`/api/sync/pull?clientId=${CLIENT}&since=${since}`)
        .set(DEVICE_HEADER, DEVICE_KEY)
        .expect(200);
      expect((res.body as PullResponse).operations).toHaveLength(3);
    }
  });
});

describe('validation', () => {
  const base = {
    id: randomUUID(),
    type: 'credit-sale' as const,
    payload: {
      customerId: 'cus-1',
      total: 40,
      items: [{ itemId: 'itm-1', name: 'X', qty: 4, unitPrice: 10, lineTotal: 40 }],
    },
    createdAt: '2026-08-01T09:00:00.000Z',
  };

  async function rejectionFor(op: unknown): Promise<string> {
    const res = (await push({ clientId: CLIENT, operations: [op] }).expect(200))
      .body as PushResponse;
    expect(res.accepted).toEqual([]);
    expect(res.rejected).toHaveLength(1);
    return res.rejected[0]!.reason;
  }

  it('recomputes the sale total instead of trusting it', async () => {
    // The number that ends up in somebody's utang. A client that computes it
    // wrongly — or a body edited in transit — must not set what is owed.
    const reason = await rejectionFor({
      ...base,
      id: randomUUID(),
      payload: { ...base.payload, total: 4 },
    });
    expect(reason).toMatch(/does not match its lines/);
  });

  it('refuses fractional pesos', async () => {
    const reason = await rejectionFor({
      ...base,
      id: randomUUID(),
      payload: {
        customerId: 'cus-1',
        total: 10.5,
        items: [{ itemId: 'itm-1', name: 'X', qty: 1, unitPrice: 10.5, lineTotal: 10.5 }],
      },
    });
    expect(reason).toMatch(/whole peso/i);
  });

  it('refuses an id that is not a UUID', async () => {
    // The id is both primary key and idempotency key. A client that invents its
    // own format could send the same write twice under two names.
    expect(await rejectionFor({ ...base, id: 'sale-1' })).toMatch(/UUID/i);
  });

  it('refuses an unknown operation type', async () => {
    expect(await rejectionFor({ ...base, id: randomUUID(), type: 'drop-tables' })).toMatch(
      /Unknown operation type/i,
    );
  });

  it('refuses a sale with no lines', async () => {
    expect(
      await rejectionFor({
        ...base,
        id: randomUUID(),
        payload: { customerId: 'cus-1', total: 0, items: [] },
      }),
    ).toMatch(/at least one item/i);
  });

  it('refuses a credit sale with no customer', async () => {
    const { customerId: _drop, ...rest } = base.payload;
    expect(await rejectionFor({ ...base, id: randomUUID(), payload: rest })).toMatch(/customer/i);
  });

  it('refuses a negative payment', async () => {
    expect(
      await rejectionFor({
        ...base,
        id: randomUUID(),
        type: 'payment',
        payload: { customerId: 'cus-1', amount: -100 },
      }),
    ).toMatch(/above zero/i);
  });

  it('rejects the bad operation without dropping the good ones beside it', async () => {
    // A malformed row from an old app version must not cost the shopkeeper the
    // rest of the day's takings that were batched with it.
    const good = anAfternoon('cus-mixed');
    const res = (await push({
      clientId: CLIENT,
      operations: [good[0]!, { ...base, id: 'not-a-uuid' }, good[1]!],
    }).expect(200)) as { body: PushResponse };

    expect(res.body.accepted.sort()).toEqual([good[0]!.id, good[1]!.id].sort());
    expect(res.body.rejected).toHaveLength(1);
    expect((await pullEverything()).ops).toHaveLength(2);
  });

  it('records a rejection so the client can be told why', async () => {
    await rejectionFor({ ...base, id: 'not-a-uuid' });
    const res = await request(app.getHttpServer() as App)
      .get(`/api/sync/rejections?clientId=${CLIENT}`)
      .set(DEVICE_HEADER, DEVICE_KEY)
      .expect(200);
    expect((res.body as { rejections: unknown[] }).rejections).toHaveLength(1);
  });
});

describe('request shape', () => {
  it('refuses a body with unexpected properties', async () => {
    // whitelist + forbidNonWhitelisted, asserted rather than assumed — this is
    // exactly what a test built without configureApp would silently miss.
    await push({ clientId: CLIENT, operations: [], sneaky: true }).expect(400);
  });

  it('refuses a push with no clientId', async () => {
    await push({ operations: [] }).expect(400);
  });

  it('refuses a batch larger than the declared maximum', async () => {
    const many = Array.from({ length: 501 }, () => ({
      id: randomUUID(),
      type: 'payment',
      payload: { customerId: 'c', amount: 1 },
      createdAt: '2026-08-01T09:00:00.000Z',
    }));
    await push({ clientId: CLIENT, operations: many }).expect(400);
  });
});
