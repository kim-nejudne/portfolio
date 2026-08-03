/**
 * The sync contract, shared by the client queue and the server that drains it.
 *
 * The whole protocol rests on one property: **an operation is identified by an
 * id the client generated**, so applying it twice is the same as applying it
 * once. That is what makes a queue safe to replay after the app is killed
 * mid-flush, after a request times out with the write already committed, and
 * after a phone comes back from three days offline. The client never has to
 * know whether the server got it — it can always just send again.
 *
 * Everything else here is bookkeeping around that idea.
 */
import type { Operation, OperationType } from './types';

/** What the client sends. Operations in the order they were created. */
export interface PushRequest {
  /** Identifies the device, so the server can report its own view of progress. */
  clientId: string;
  operations: PushOperation[];
}

/** An operation as it goes over the wire — the local `status` is not sent. */
export interface PushOperation {
  id: string;
  type: OperationType;
  payload: unknown;
  createdAt: string;
}

export interface PushResponse {
  /**
   * The ids the server has durably stored — whether it stored them just now or
   * had already seen them. Both cases are `accepted`, because from the client's
   * point of view they mean the same thing: stop sending this.
   */
  accepted: string[];
  /**
   * Operations the server refused and will never accept: malformed, or invalid
   * against the domain rules. The client must drop these rather than retry
   * forever, and must surface them — a sale that silently vanished is worse
   * than one that failed loudly.
   */
  rejected: RejectedOperation[];
  /** The server's log position after this push, for the next pull. */
  cursor: number;
}

export interface RejectedOperation {
  id: string;
  reason: string;
}

/** What the client asks for: everything after the cursor it last saw. */
export interface PullRequest {
  clientId: string;
  since: number;
}

export interface PullResponse {
  operations: ServerOperation[];
  cursor: number;
  /** True when more remain beyond this page. */
  hasMore: boolean;
}

/**
 * An operation as the server holds it. `seq` is the server's ordering, which is
 * the authoritative one — client clocks on cheap phones are not trustworthy and
 * two devices offline at once will both think they were first.
 */
export interface ServerOperation extends PushOperation {
  seq: number;
  appliedAt: string;
}

export const SYNC_PAGE_SIZE = 200;

/** A local operation, ready to send. */
export function toPushOperation(op: Operation): PushOperation {
  return { id: op.id, type: op.type, payload: op.payload, createdAt: op.createdAt };
}

/**
 * Operations the client still owes the server.
 *
 * `failed` is excluded deliberately: those were rejected with a reason, and
 * retrying them forever would be a queue that never drains and a shopkeeper who
 * never finds out why.
 */
export function unsent(ops: readonly Operation[]): Operation[] {
  return ops.filter((op) => op.status === 'pending');
}
