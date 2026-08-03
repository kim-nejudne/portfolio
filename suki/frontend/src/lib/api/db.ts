/**
 * The local database.
 *
 * IndexedDB via Dexie, and it is the source of truth while the shop is open.
 * The server is authoritative in the long run, but a phone behind the counter
 * cannot wait to find out — a sale is recorded locally and durably first, and
 * the network catches up whenever it can.
 *
 * Two tables:
 *
 * - `operations` — the append-only log of everything the shopkeeper did. Rows
 *   are only ever added, or have their `status` moved from pending to synced.
 *   Never edited, never deleted.
 * - `meta` — the sync cursor and this device's id. One row each.
 *
 * The base catalogue (items, customers, seeded ledger) stays in the fixture
 * modules. That is deliberate for a demo shop: the interesting durability
 * problem is the operations a shopkeeper creates, not the seed she was handed.
 */
import Dexie, { type Table } from 'dexie';
import type { Operation } from '@suki/domain';

export interface MetaRow {
  key: 'cursor' | 'clientId';
  value: string;
}

class SukiDatabase extends Dexie {
  operations!: Table<Operation, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('suki');
    this.version(1).stores({
      // `status` is indexed because draining asks "what is still pending" on
      // every reconnect, and `createdAt` because the ledger reads in order.
      operations: 'id, status, createdAt, type',
      meta: 'key',
    });
  }
}

export const db = new SukiDatabase();

/**
 * This device's id, generated once and kept.
 *
 * The server uses it to tell devices apart, and the client uses it to skip
 * echoes of its own writes coming back on a pull.
 */
export async function getClientId(): Promise<string> {
  const existing = await db.meta.get('clientId');
  if (existing) return existing.value;
  const id = crypto.randomUUID();
  await db.meta.put({ key: 'clientId', value: id });
  return id;
}

export async function getCursor(): Promise<number> {
  const row = await db.meta.get('cursor');
  return row ? Number(row.value) : 0;
}

export async function setCursor(cursor: number): Promise<void> {
  await db.meta.put({ key: 'cursor', value: String(cursor) });
}

/**
 * Wipes the local database. Used by tests and by "sign out of this device";
 * never by anything a shopkeeper can reach by accident, because the pending
 * queue is the only copy of work that has not reached the server.
 */
export async function resetLocalDatabase(): Promise<void> {
  await db.transaction('rw', db.operations, db.meta, async () => {
    await db.operations.clear();
    await db.meta.clear();
  });
}
