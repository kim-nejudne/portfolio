// The drawer's side of "Reconnects and snapshots", for one turn's sender. On every `/ink` connect:
// a sender that hasn't started says `ink:hello` and continues from the snapshot of its own turn
// (a fresh turn's is empty; after a reload it holds what was drawn so far). A started sender says
// `ink:sync` and, from the answer's `lastSeq`, resends the kept batches the server is missing.
// `ink:resend` (the server saw a gap) resends from there. Messages for another turn are ignored.
//
// Nothing waits forever: a hello answered without a snapshot (or not at all) is asked again, as
// is a sync with no answer. Resends go out INK_RESEND_BURST at a time, under the server's batch
// rate limit, with a fresh sync for the rest; a batch refused as `rateLimited` (or a pause that
// lifts, through `resync`) is recovered the same way.

import { INK_DRAWER_RETRY_MS, INK_RESEND_BURST } from '../../../shared/constants.js';
import { applyInkOps, createInkStack, type InkStack } from '../../../shared/ink.js';
import type {
  Ack,
  InkBatch,
  InkClientPayloads,
  InkOp,
  InkSnapshot,
} from '../../../shared/types.js';
import type { InkSender } from './inkSender.js';

/** Sends on the `/ink` socket; `onAck` gets the answer, or null when none came in time. */
export type DrawerEmit = <E extends 'ink:hello' | 'ink:sync'>(
  event: E,
  payload: InkClientPayloads[E],
  onAck: (res: Ack | null) => void,
) => void;

export interface DrawerSyncOptions {
  code: string;
  turnId: number;
  sender: InkSender;
  /** Only called while the socket is connected. */
  emit: DrawerEmit;
  /** The turn's drawing so far, to put under the pad's strokes; `offset` was added to their ids. */
  onSnapshot: (snapshot: InkSnapshot, offset: number) => void;
}

/** What the pad needs from the page's `/ink` socket. */
export interface DrawerInkLink {
  /** Sends a batch now, or drops it while the socket is down (it stays kept for a resend). */
  send(batch: InkBatch): void;
  /** Ties this turn's sender to the socket (see `createDrawerSync`); returns the undo. */
  bind(turnId: number, sender: InkSender, onSnapshot: DrawerSyncOptions['onSnapshot']): () => void;
}

export interface DrawerSync {
  connected(): void;
  disconnected(): void;
  snapshot(snapshot: InkSnapshot): void;
  state(payload: { turnId: number; lastSeq: number }): void;
  resend(payload: { turnId: number; from: number }): void;
  /** The ack of a live `ink:batch`. */
  batchAck(res: Ack): void;
  /** Asks where the server is and resends from there (a refused batch, a pause that lifted). */
  resync(): void;
  /** The turn is over: stops retrying. */
  dispose(): void;
}

export function createDrawerSync({
  code,
  turnId,
  sender,
  emit,
  onSnapshot,
}: DrawerSyncOptions): DrawerSync {
  let up = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  /** Runs `fn` after INK_DRAWER_RETRY_MS, unless a retry is already waiting. */
  const later = (fn: () => void) => {
    if (disposed || timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, INK_DRAWER_RETRY_MS);
  };

  const hello = () => {
    if (!up || disposed || sender.started()) return;
    sender.release();
    // The snapshot, if any, arrives before the ack: no start by then means ask again.
    emit('ink:hello', { code }, () => {
      if (!sender.started()) later(hello);
    });
  };

  const resync = () => {
    if (!up || disposed || !sender.started()) return;
    // Pending ops wait for `ink:state`, then follow the resent batches.
    sender.hold();
    emit('ink:sync', { turnId, lastSentSeq: sender.lastSeq() }, (res) => {
      if (res === null || (!res.ok && res.error === 'rateLimited')) later(resync);
    });
  };

  /** Resends a burst; the rest after the next sync. Returns whether all were sent. */
  const resendAfter = (lastSeq: number) => {
    const left = sender.resendAfter(lastSeq, INK_RESEND_BURST);
    if (left > 0) later(resync);
    return left === 0;
  };

  return {
    connected() {
      up = true;
      cancel();
      if (sender.started()) resync();
      else hello();
    },
    disconnected() {
      up = false;
      cancel();
      sender.hold();
    },
    snapshot(snapshot) {
      if (disposed || snapshot.turnId !== turnId || sender.started()) return;
      const offset = sender.start(snapshot.seq, maxStrokeId(snapshot.actions));
      onSnapshot(snapshot, offset);
    },
    state({ turnId: t, lastSeq }) {
      if (disposed || t !== turnId) return;
      if (resendAfter(lastSeq)) sender.release();
    },
    resend({ turnId: t, from }) {
      if (!disposed && t === turnId) resendAfter(from - 1);
    },
    batchAck(res) {
      if (!res.ok && res.error === 'rateLimited') later(resync);
    },
    resync,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}

/** The largest strokeId the ops begin, or 0. */
export function maxStrokeId(ops: readonly InkOp[]): number {
  let max = 0;
  for (const op of ops) if (op[0] === 'b' && op[1] > max) max = op[1];
  return max;
}

/**
 * Puts the snapshot's actions under the pad's own (drawn before it arrived, their strokeIds
 * already moved up by `offset`), so the pad shows the same stack the server will have.
 */
export function mergeSnapshot(stack: InkStack, actions: readonly InkOp[], offset: number): void {
  const merged = createInkStack();
  applyInkOps(merged, actions);
  for (const action of stack.actions) {
    if (action.kind === 'stroke') {
      action.stroke.id += offset;
      merged.byId.set(action.stroke.id, action.stroke);
    }
    merged.actions.push(action);
  }
  stack.actions = merged.actions;
  stack.byId = merged.byId;
}
