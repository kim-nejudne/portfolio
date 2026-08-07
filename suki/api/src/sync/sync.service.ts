import { Inject, Injectable, Logger } from '@nestjs/common';
import { asc, eq, gt, sql } from 'drizzle-orm';
import {
  SYNC_PAGE_SIZE,
  type PullResponse,
  type PushOperation,
  type PushResponse,
  type RejectedOperation,
  type ServerOperation,
} from '@suki/domain';
import { DATABASE, type Database } from '../db/database.module';
import { clients, operations, rejections } from '../db/schema';
import { validateOperation } from './validate';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Accept a batch of operations from a device.
   *
   * The interesting property is that this is safe to call with operations the
   * server already has. `onConflictDoNothing` on the client-generated primary
   * key turns a replay into a no-op, and the id is still reported as accepted —
   * because from the client's side "you already had it" and "I stored it just
   * now" mean the same thing: stop sending it.
   *
   * That is what lets a phone resend its whole queue after being killed
   * mid-flush without anyone auditing what got through.
   */
  async push(
    clientId: string,
    incoming: readonly PushOperation[],
  ): Promise<PushResponse> {
    const accepted: string[] = [];
    const rejected: RejectedOperation[] = [];

    const valid: PushOperation[] = [];
    for (const op of incoming) {
      const failure = validateOperation(op);
      if (failure) {
        rejected.push({ id: op.id, reason: failure });
        continue;
      }
      valid.push(op);
    }

    if (valid.length > 0) {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(operations)
          .values(
            valid.map((op) => ({
              id: op.id,
              type: op.type,
              payload: op.payload,
              createdAt: new Date(op.createdAt),
              clientId,
            })),
          )
          // The whole idempotency story, in one clause.
          .onConflictDoNothing({ target: operations.id });

        await tx
          .insert(clients)
          .values({ id: clientId, lastSeenAt: new Date() })
          .onConflictDoUpdate({
            target: clients.id,
            set: { lastSeenAt: new Date() },
          });
      });
      accepted.push(...valid.map((op) => op.id));
    }

    if (rejected.length > 0) {
      // Recorded, not discarded: the app has to be able to tell the shopkeeper
      // which entry did not stick and why.
      await this.db
        .insert(rejections)
        .values(
          rejected.map((r) => {
            const original = incoming.find((op) => op.id === r.id);
            return {
              id: r.id,
              clientId,
              type: original?.type ?? null,
              payload: original?.payload ?? null,
              reason: r.reason,
            };
          }),
        )
        .onConflictDoNothing({ target: rejections.id });
      this.logger.warn(`${clientId}: rejected ${rejected.length} operation(s)`);
    }

    return { accepted, rejected, cursor: await this.cursor() };
  }

  /**
   * Everything the server has after `since`.
   *
   * Ordered by the server's own sequence rather than the client's timestamp:
   * clocks on cheap phones drift, and two devices that were both offline will
   * each believe they went first.
   */
  async pull(clientId: string, since: number): Promise<PullResponse> {
    const rows = await this.db
      .select()
      .from(operations)
      .where(gt(operations.seq, since))
      .orderBy(asc(operations.seq))
      .limit(SYNC_PAGE_SIZE + 1);

    const page = rows.slice(0, SYNC_PAGE_SIZE);
    const hasMore = rows.length > SYNC_PAGE_SIZE;

    const out: ServerOperation[] = page.map((row) => ({
      id: row.id,
      type: row.type as ServerOperation['type'],
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
      seq: row.seq,
      appliedAt: row.appliedAt.toISOString(),
    }));

    const cursor = out.length > 0 ? out[out.length - 1]!.seq : since;

    await this.db
      .insert(clients)
      .values({ id: clientId, lastSeenAt: new Date(), lastPulledSeq: cursor })
      .onConflictDoUpdate({
        target: clients.id,
        set: { lastSeenAt: new Date(), lastPulledSeq: cursor },
      });

    return { operations: out, cursor, hasMore };
  }

  async cursor(): Promise<number> {
    const [row] = await this.db
      .select({ max: sql<number>`coalesce(max(${operations.seq}), 0)` })
      .from(operations);
    return Number(row?.max ?? 0);
  }

  /** What a device was told it could not keep. */
  async rejectionsFor(clientId: string) {
    return this.db.select().from(rejections).where(eq(rejections.clientId, clientId));
  }
}
