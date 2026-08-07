/**
 * The sync engine.
 *
 * Push what we have, pull what we lack, repeat when the network says it is
 * worth trying. The design decision that makes this simple enough to trust:
 * **push is safe to repeat**. Operations carry a client-generated UUID and the
 * server's primary key is that id, so re-sending is a no-op.
 *
 * That removes the hardest question in offline sync — "did that request
 * actually land?" — because the answer never has to be known. A request that
 * times out with the write already committed and a request that never arrived
 * are handled identically: send it again.
 */
import { toPushOperation, type Operation, type PullResponse, type PushResponse } from '@suki/domain';
import { db, getClientId, getCursor, setCursor } from './db';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4100/api';
const DEVICE_KEY = import.meta.env.VITE_DEVICE_KEY ?? '';

/** One request in flight at a time. Two drains would push the same rows twice. */
let draining = false;

export interface DrainResult {
  pushed: number;
  pulled: number;
  rejected: { id: string; reason: string }[];
  ok: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-suki-device-key': DEVICE_KEY,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Send everything still pending, then take everything new.
 *
 * Failure is not an error condition here. The shop keeps working; the queue
 * keeps its rows; the next attempt sends the same batch. The only thing that
 * removes an operation from `pending` is the server saying it has it — or
 * saying it will never take it.
 */
export async function drain(): Promise<DrainResult> {
  if (draining) return { pushed: 0, pulled: 0, rejected: [], ok: true };
  draining = true;
  try {
    const clientId = await getClientId();
    const pending = await db.operations.where('status').equals('pending').toArray();

    let pushed = 0;
    const rejected: DrainResult['rejected'] = [];

    if (pending.length > 0) {
      const result = await request<PushResponse>('/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          operations: pending.map(toPushOperation),
        }),
      });

      // Accepted covers both "stored just now" and "already had it". From here
      // they mean the same thing: stop sending.
      if (result.accepted.length > 0) {
        await db.transaction('rw', db.operations, async () => {
          for (const id of result.accepted) {
            await db.operations.update(id, { status: 'synced' });
          }
        });
        pushed = result.accepted.length;
      }

      // Rejected is permanent. Marking these failed rather than deleting them
      // keeps the reason on screen — a sale that vanished without explanation
      // is worse than one that failed loudly.
      if (result.rejected.length > 0) {
        await db.transaction('rw', db.operations, async () => {
          for (const item of result.rejected) {
            await db.operations.update(item.id, { status: 'failed' });
          }
        });
        rejected.push(...result.rejected);
      }
    }

    let pulled = 0;
    let hasMore = true;
    while (hasMore) {
      const since = await getCursor();
      const page = await request<PullResponse>(
        `/sync/pull?clientId=${encodeURIComponent(clientId)}&since=${since}`,
      );
      if (page.operations.length > 0) {
        await db.transaction('rw', db.operations, async () => {
          for (const op of page.operations) {
            // Anything already here is ours coming back, or a page replayed.
            // `put` with the same id is idempotent on this side too.
            await db.operations.put({
              id: op.id,
              type: op.type,
              payload: op.payload,
              createdAt: op.createdAt,
              status: 'synced',
            } as Operation);
          }
        });
        pulled += page.operations.length;
      }
      await setCursor(page.cursor);
      hasMore = page.hasMore;
    }

    return { pushed, pulled, rejected, ok: true };
  } catch {
    // Offline, or the server is down. Neither is exceptional in a shop with one
    // bar of signal, and neither loses anything: the rows are still pending.
    return { pushed: 0, pulled: 0, rejected: [], ok: false };
  } finally {
    draining = false;
  }
}
