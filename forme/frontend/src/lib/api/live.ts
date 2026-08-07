/**
 * Browser-side live updates, over one socket.
 *
 * Deliberately separate from the rest of `src/lib/api/`: those modules run on
 * the server and import `next/headers` to forward the session cookie, which
 * cannot be bundled for the browser.
 *
 * The subscriptions keep the shape the scaffold defined, which is the whole
 * reason that seam was worth insisting on — the screens have never known
 * whether their data arrives by timer, by poll or by socket, and this is the
 * third transport they have had.
 */
import { io, type Socket } from 'socket.io-client';
import type { JobState, PreflightCheck, Press, ProofState } from '@forme/domain';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api';

/**
 * One shared socket per tab, reference-counted.
 *
 * The floor board mounts three panels and a job page has several live regions;
 * a socket each would mean a handshake and a JWT verification each.
 */
let socket: Socket | null = null;
let refCount = 0;

function apiOrigin(): string {
  try {
    return new URL(API_URL, 'http://127.0.0.1:4000').origin;
  } catch {
    return 'http://127.0.0.1:4000';
  }
}

function acquire(): Socket {
  refCount += 1;
  if (!socket) {
    socket = io(apiOrigin(), {
      path: '/api/events',
      // Sends the httpOnly auth cookie with the handshake. Without it the
      // gateway rejects the connection, which is the intended behaviour.
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
  }
  return socket;
}

function release(): void {
  refCount = Math.max(refCount - 1, 0);
  if (refCount === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}

export interface PreflightStreamHandlers {
  onCheck: (check: PreflightCheck, index: number, total: number) => void;
  onDone?: (result: { reportId: string; blocked: boolean; total: number }) => void;
  onError?: (message: string) => void;
}

/**
 * Streams a job's preflight report check by check as the worker produces it.
 *
 * Keyed on the job reference, not the report id: a re-upload produces a new
 * report, and a screen watching the job should follow it without having to
 * learn a new id first.
 */
export function subscribeToPreflight(
  jobReference: string,
  handlers: PreflightStreamHandlers,
): () => void {
  const connection = acquire();
  let cancelled = false;

  const onCheck = (payload: {
    jobReference: string;
    check: PreflightCheck;
    index: number;
    total: number;
  }): void => {
    // The room already filters, but one shared socket may be in several rooms.
    if (cancelled || payload.jobReference !== jobReference) return;
    handlers.onCheck(payload.check, payload.index, payload.total);
  };

  const onDone = (payload: {
    jobReference: string;
    reportId: string;
    blocked: boolean;
    total: number;
  }): void => {
    if (cancelled || payload.jobReference !== jobReference) return;
    handlers.onDone?.(payload);
  };

  const onUnauthorized = (payload: { message: string }): void => {
    if (!cancelled) handlers.onError?.(payload.message);
  };

  const join = (): void => {
    connection.emit(
      'subscribe:job',
      { reference: jobReference },
      (result: { ok: boolean; error?: string }) => {
        if (!cancelled && !result?.ok && result?.error) handlers.onError?.(result.error);
      },
    );
  };

  connection.on('preflight.check', onCheck);
  connection.on('preflight.done', onDone);
  connection.on('unauthorized', onUnauthorized);
  // Re-join on every connect, including reconnects — rooms do not survive a
  // dropped socket, and a silently un-joined client looks exactly like a job
  // that stopped producing checks.
  connection.on('connect', join);
  if (connection.connected) join();

  return () => {
    cancelled = true;
    connection.emit('unsubscribe:job', { reference: jobReference });
    connection.off('preflight.check', onCheck);
    connection.off('preflight.done', onDone);
    connection.off('unauthorized', onUnauthorized);
    connection.off('connect', join);
    release();
  };
}

/** Live job state, for screens that show it without owning the preflight panel. */
export function subscribeToJobState(
  jobReference: string,
  onState: (state: JobState, proofState: ProofState) => void,
): () => void {
  const connection = acquire();
  let cancelled = false;

  const handler = (payload: {
    reference: string;
    state: JobState;
    proofState: ProofState;
  }): void => {
    if (cancelled || payload.reference !== jobReference) return;
    onState(payload.state, payload.proofState);
  };

  const join = (): void => {
    connection.emit('subscribe:job', { reference: jobReference }, () => undefined);
  };

  connection.on('job.state', handler);
  connection.on('connect', join);
  if (connection.connected) join();

  return () => {
    cancelled = true;
    connection.off('job.state', handler);
    connection.off('connect', join);
    release();
  };
}

/** Pushes the floor board. The server only ticks while someone is watching. */
export function subscribeToFloor(onTick: (presses: readonly Press[]) => void): () => void {
  const connection = acquire();
  let cancelled = false;

  const handler = (payload: { presses: Press[] }): void => {
    if (!cancelled) onTick(payload.presses);
  };

  const join = (): void => {
    connection.emit('subscribe:floor', {}, () => undefined);
  };

  connection.on('floor.tick', handler);
  connection.on('connect', join);
  if (connection.connected) join();

  return () => {
    cancelled = true;
    connection.off('floor.tick', handler);
    connection.off('connect', join);
    release();
  };
}

/** The wall clock. Local, and starts after mount so hydration stays honest. */
export function subscribeToClock(onTick: (iso: string) => void, intervalMs = 1000): () => void {
  const timer = setInterval(() => onTick(new Date().toISOString()), intervalMs);
  return () => clearInterval(timer);
}
