/**
 * The SUKI schema.
 *
 * There is essentially one table. Everything the shop knows is an operation:
 * a sale, a payment, a stock adjustment, a price change. Balances, stock levels
 * and margins are all *derived* from that log rather than stored beside it, by
 * the same functions the phone uses.
 *
 * Two consequences worth stating, because they are the design:
 *
 * 1. **The primary key is the client's UUID.** Not a server sequence, not a
 *    composite. That is what makes push idempotent: a replayed operation
 *    collides with itself and is a no-op. The client can therefore always
 *    resend without asking whether the server already has it.
 *
 * 2. **Nothing is ever updated or deleted.** A ledger you can quietly rewrite is
 *    not a record anyone would trust, and an append-only log is also the only
 *    shape that survives arriving out of order.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * The log. `seq` gives the server's authoritative ordering — client clocks on
 * cheap phones drift, and two devices offline at once will both believe they
 * were first, so `createdAt` is kept as the shop's record of when a thing
 * happened but is never used to order the log.
 */
export const operations = pgTable(
  'operations',
  {
    /** The client-generated UUID. Primary key, which is the whole idempotency story. */
    id: text('id').primaryKey(),
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<unknown>().notNull(),
    /** When the shopkeeper did it, from the device. Display only. */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    /** When the server durably had it. Authoritative for ordering. */
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    /** Which device sent it, so a client can skip echoes of its own writes. */
    clientId: text('client_id').notNull(),
  },
  (table) => [
    // Pull is "everything after this cursor", so this index is the hot path.
    uniqueIndex('operations_seq_idx').on(table.seq),
    index('operations_client_idx').on(table.clientId, table.seq),
  ],
);

/**
 * Operations the server refused. Kept rather than dropped: a sale that vanished
 * without explanation is worse than one that failed loudly, and this is what
 * lets the app tell the shopkeeper which entry did not stick and why.
 */
export const rejections = pgTable(
  'rejections',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull(),
    type: text('type'),
    payload: jsonb('payload').$type<unknown>(),
    reason: text('reason').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('rejections_client_idx').on(table.clientId, table.at)],
);

/**
 * One row per device, so `/sync/pull` can report how far behind a phone is and
 * the shop can see that the tablet in the back has not synced since Tuesday.
 */
export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  label: text('label'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastPushedSeq: integer('last_pushed_seq').notNull().default(0),
  lastPulledSeq: integer('last_pulled_seq').notNull().default(0),
});

/** The current server sequence, used as the cursor a client pulls from. */
export const currentSeq = sql<number>`coalesce((select max(seq) from operations), 0)`;

export type OperationRow = typeof operations.$inferSelect;
export type RejectionRow = typeof rejections.$inferSelect;
export type ClientRow = typeof clients.$inferSelect;
