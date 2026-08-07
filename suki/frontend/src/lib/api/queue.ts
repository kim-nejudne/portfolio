// The spine. Every write in the app goes through here. Nothing else writes.
//
// This module's exported surface is unchanged from the scaffold — enqueue,
// subscribe, pending, history, setOnline, isOnline — but everything behind it
// is different: operations now live in IndexedDB and drain to a real server.
// No screen changed to make that true, which is the entire reason the seam was
// worth insisting on.
//
// The in-memory array is a cache of the Dexie table, kept so reads stay
// synchronous for components that render on every keystroke. Dexie is the
// durable copy; this is the fast one. They are written in that order.

import type { Operation, OperationStatus, OperationType, QueueSnapshot } from '@suki/domain';
import { db } from './db';
import { drain } from './sync-client';

type Listener = (snap: QueueSnapshot) => void;

interface QueueState {
  ops: Operation[];
  online: boolean;
  listeners: Set<Listener>;
  retryTimer: ReturnType<typeof setTimeout> | null;
  /** Consecutive failed drains, for backoff. */
  failures: number;
}

const state: QueueState = {
  ops: [],
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  listeners: new Set(),
  retryTimer: null,
  failures: 0,
};

/**
 * Backoff between failed drains: 2s, 4s, 8s … capped at a minute.
 *
 * Uncapped retries on a phone with one bar are a battery complaint, and a
 * fixed short interval hammers a server that is down. The cap is a minute
 * because a shopkeeper reconnecting should not wait longer than that to see
 * SYNCED.
 */
function backoffMs(failures: number): number {
  return Math.min(2000 * 2 ** Math.max(0, failures - 1), 60_000);
}

function snapshot(): QueueSnapshot {
  return { pending: state.ops.filter((o) => o.status === 'pending'), online: state.online };
}

function notify(): void {
  const snap = snapshot();
  state.listeners.forEach((fn) => fn(snap));
}

/** Load the durable log into the in-memory cache. Called once at startup. */
export async function hydrate(): Promise<void> {
  state.ops = await db.operations.orderBy('createdAt').toArray();
  notify();
  scheduleDrain(0);
}

function scheduleDrain(delayMs: number): void {
  if (state.retryTimer !== null) clearTimeout(state.retryTimer);
  state.retryTimer = setTimeout(() => {
    state.retryTimer = null;
    void runDrain();
  }, delayMs);
}

async function runDrain(): Promise<void> {
  if (!state.online) return;
  const result = await drain();

  // Re-read from Dexie rather than patching the cache: the drain may have
  // pulled operations from another device, and the durable copy is the one
  // that knows.
  state.ops = await db.operations.orderBy('createdAt').toArray();
  notify();

  if (result.ok) {
    state.failures = 0;
    // Anything still pending means the server took some but not all; keep going.
    if (state.ops.some((o) => o.status === 'pending')) scheduleDrain(1000);
  } else {
    state.failures += 1;
    scheduleDrain(backoffMs(state.failures));
  }
}

/**
 * Append an operation.
 *
 * Written to IndexedDB before the cache and before the UI updates, so a phone
 * that dies between the tap and the render still has the sale. The id is
 * generated here and never by a server — that is what makes the operation safe
 * to send again if we cannot tell whether the first attempt landed.
 */
export async function enqueue<P>(op: {
  type: OperationType;
  payload: P;
  createdAt: string;
  id?: string;
}): Promise<Operation<P>> {
  const entry: Operation<P> = {
    id: op.id ?? crypto.randomUUID(),
    type: op.type,
    payload: op.payload,
    createdAt: op.createdAt,
    status: 'pending' satisfies OperationStatus,
  };

  await db.operations.put(entry as Operation);
  state.ops = [...state.ops, entry as Operation];
  notify();
  scheduleDrain(0);
  return entry;
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  state.listeners.add(fn);
  fn(snapshot());
  return () => {
    state.listeners.delete(fn);
  };
}

/** Currently pending operations (not yet accepted by the server). */
export function pending(): Operation[] {
  return state.ops.filter((o) => o.status === 'pending');
}

/** Operations the server refused, with nothing more to try. */
export function failed(): Operation[] {
  return state.ops.filter((o) => o.status === 'failed');
}

/** All operations, latest first. Used by the sync sheet. */
export function history(): Operation[] {
  return [...state.ops].reverse();
}

/**
 * Connection state. Driven by the browser's own online/offline events in
 * `start()`, and by the demo toggle so the offline path can be shown without
 * turning off anyone's wifi.
 */
export function setOnline(online: boolean): void {
  if (state.online === online) return;
  state.online = online;
  state.failures = 0;
  notify();
  if (online) scheduleDrain(0);
}

export function isOnline(): boolean {
  return state.online;
}

/** Wire the browser's connectivity events and load the durable log. */
export async function start(): Promise<void> {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
  }
  await hydrate();
}
