// The `/ink` namespace: the drawer's batches go straight to the room's Screens, outside the reducer
// (see "Drawing data protocol"). A batch is taken only when it comes from the current drawer's
// socket, in DRAWING, not paused, for the current `turnId`; everything else is dropped. Only
// Screens ever join `ink:<code>:screen`. The one ink a phone ever receives is the current drawer's
// own snapshot, and `ink:state`/`ink:resend` tell the drawer only `seq` numbers.
//
// Taken batches go through the InkStore (`server/inkStore.ts`) in `seq` order: a duplicate is
// ignored, a gap is dropped and answered with `ink:resend`, and the applied batch (less any ops a
// full canvas refused) is relayed to the Screens. A refused batch reaches neither the store nor
// the Screens. `ink:hello` answers with the latest turn's snapshot (Screens, and the drawer for its
// own live turn), `ink:sync` with the drawer's `ink:state`, and `ink:get` with a frozen turn for
// a Screen's gallery.
//
// Limits: the schema's 4 KB and 200 points per op, 40 batches per second per player, the store's
// caps, INK_INVALID_BATCHES_MAX invalid batches in a turn (which disconnect the socket), and per
// socket rate limits on `ink:hello`/`ink:sync` and on `ink:get`.

import type { Namespace, Socket } from 'socket.io';
import {
  INK_BATCH_RATE_LIMIT,
  INK_GET_RATE_LIMIT,
  INK_HELLO_RATE_LIMIT,
  INK_INVALID_BATCHES_MAX,
} from '../shared/constants.js';
import { inkAuthSchema, inkPayloadSchemas } from '../shared/schemas.js';
import type {
  Ack,
  AckError,
  InkClientEvent,
  InkClientPayloads,
  InkClientToServerEvents,
  InkServerToClientEvents,
} from '../shared/types.js';
import { createInkStore, type InkStore, type TurnLog } from './inkStore.js';
import { createRateLimiter } from './rateLimit.js';
import type { RoomStore } from './roomStore.js';
import { hashPlayerKey, type GatewayServer, type InkEffect } from './sockets.js';

/** What an `/ink` socket is. A phone is bound at the handshake; a Screen by `ink:hello`. */
export interface InkSocketData {
  code?: string;
  role?: 'screen' | 'player';
  pid?: string;
  /** Invalid batches this socket sent during the room's turn `turnId`. */
  invalid?: { turnId: number; count: number };
}

type InkNamespace = Namespace<
  InkClientToServerEvents,
  InkServerToClientEvents,
  Record<string, never>,
  InkSocketData
>;
type InkSocket = Socket<
  InkClientToServerEvents,
  InkServerToClientEvents,
  Record<string, never>,
  InkSocketData
>;

/** The only `/ink` room: the Screens of room `code`. */
export const inkScreenRoom = (code: string) => `ink:${code}:screen`;

export interface InkGatewayOptions {
  rooms: RoomStore;
  /** Monotonic ms, for the batch rate limit and resend asks. */
  monotonic?: () => number;
  /** The ink logs (tests pass one with small caps). */
  store?: InkStore;
}

export interface InkGateway {
  ink: InkNamespace;
  /** Pass to `attachSockets` as `onInk`: runs the reducer's ink effects. */
  onInk: (code: string, effect: InkEffect) => void;
  /** The room's latest turn's log, if any (read-only; for tests). */
  turnInk: (code: string) => TurnLog | undefined;
  store: InkStore;
  /** Drops a room's ink (the room expired). */
  forget: (code: string) => void;
}

export function attachInkGateway(
  io: GatewayServer,
  { rooms, monotonic = () => performance.now(), store = createInkStore() }: InkGatewayOptions,
): InkGateway {
  // Same engine as the main namespace (WebSocket only, 100 KB frames); its own event types.
  const ink = io.of('/ink') as unknown as InkNamespace;
  // Keyed by player (or socket id before a phone is bound); idle keys are dropped by the limiter.
  const batchLimiter = createRateLimiter(INK_BATCH_RATE_LIMIT, monotonic);
  // Per socket: a hello can send a whole snapshot, `ink:get` a whole drawing.
  const helloLimiter = createRateLimiter(INK_HELLO_RATE_LIMIT, monotonic);
  const getLimiter = createRateLimiter(INK_GET_RATE_LIMIT, monotonic);

  // A phone proves who it is with its playerKey; only the hash is compared, as on `player:join`.
  ink.use((socket, next) => {
    const auth = inkAuthSchema.safeParse(socket.handshake.auth);
    if (!auth.success) return next(new Error('invalidPayload'));
    if (!('code' in auth.data)) {
      socket.data = {};
      return next();
    }
    const { code, playerKey } = auth.data;
    const room = rooms.get(code);
    if (!room) return next(new Error('roomNotFound'));
    const keyHash = hashPlayerKey(playerKey);
    const player = Object.values(room.players).find((p) => p.keyHash === keyHash);
    if (!player) return next(new Error('notPlayer'));
    socket.data = { code, role: 'player', pid: player.pid };
    next();
  });

  ink.on('connection', (socket) => {
    handle(socket, 'ink:hello', ({ code }) => {
      if (!helloLimiter.hit(socket.id)) return fail('rateLimited');
      const { role, pid, code: joined } = socket.data;
      if (joined && joined !== code) return fail('alreadyJoined');
      const room = rooms.get(code);
      if (!room) return fail('roomNotFound');
      if (role === 'player') {
        // Only the current drawer of the live turn gets drawing data: its own, after a reload. A
        // player socket never joins the Screen room, so no other phone can receive ink.
        const turn = room.turn;
        if (room.phase === 'DRAWING' && turn && turn.drawerPid === pid) {
          // `inkOpen` started the log with the phase; should it be missing, start it now, as a
          // first batch would, so the drawer's held sender always gets its answer.
          if ((store.turn(code)?.turnId ?? 0) < turn.id) store.open(code, turn.id);
          const snapshot = store.snapshot(code);
          if (snapshot?.turnId === turn.id && store.lastSeq(code, turn.id) !== null)
            socket.emit('ink:snapshot', snapshot);
        }
        return { ok: true };
      }
      socket.data = { ...socket.data, code, role: 'screen' };
      // Joined first, then the snapshot: batches relayed from here on follow it on this socket,
      // all with `seq > snapshot.seq`. A Screen that saw a gap says hello again for a fresh one.
      void socket.join(inkScreenRoom(code));
      const snapshot = store.snapshot(code);
      if (snapshot) socket.emit('ink:snapshot', snapshot);
      return { ok: true };
    });

    handle(
      socket,
      'ink:batch',
      (batch) => {
        // Per player, so a second `/ink` socket with the same playerKey doesn't double the budget.
        const { code, pid } = socket.data;
        if (!batchLimiter.hit(pid ? `${code}:${pid}` : socket.id)) return fail('rateLimited');
        const error = refuseDrawer(socket.data, batch[0], true);
        if (error) return fail(error);
        // `refuseDrawer` passed, so the socket is bound to a live room and `turnId` is current.
        const out = store.apply(code!, batch, monotonic());
        switch (out.kind) {
          case 'duplicate':
            return { ok: true };
          case 'gap':
            if (out.ask) socket.emit('ink:resend', { turnId: batch[0], from: out.from });
            return fail('inkGap');
          case 'closed':
            return fail('staleTurn');
          case 'applied':
            // Relayed even with no ops left, so the Screens' `seq` stays contiguous.
            ink.to(inkScreenRoom(code!)).emit('ink:batch', out.relay);
            return out.full ? fail('inkFull') : { ok: true };
        }
      },
      () => countInvalid(socket),
    );

    // The drawer's socket came back: it resends every kept batch after `lastSeq`. Allowed while
    // paused, so the drawer is in step again by the time drawing resumes.
    handle(socket, 'ink:sync', ({ turnId }) => {
      if (!helloLimiter.hit(socket.id)) return fail('rateLimited');
      const error = refuseDrawer(socket.data, turnId, false);
      if (error) return fail(error);
      const lastSeq = store.lastSeq(socket.data.code!, turnId);
      if (lastSeq === null) return fail('staleTurn');
      socket.emit('ink:state', { turnId, lastSeq });
      return { ok: true };
    });

    // The gallery: a frozen turn, for Screens only (it was on the TV already).
    handle(socket, 'ink:get', ({ turnId }) => {
      if (!getLimiter.hit(socket.id)) return fail('rateLimited');
      const { code, role } = socket.data;
      if (!code || !role) return fail('notJoined');
      if (role !== 'screen') return fail('notScreen');
      const actions = store.frozen(code, turnId);
      if (!actions) return fail('inkNotKept');
      return { ok: true, turnId, actions };
    });

    // Doodles arrive with F27.
    handle(socket, 'doodle:batch', () => fail('notAvailable'));
  });

  /** Counts an invalid batch against the room's current turn; too many disconnect the socket. */
  function countInvalid(socket: InkSocket): void {
    const { code } = socket.data;
    const turnId = (code && rooms.get(code)?.turn?.id) || 0;
    const prev = socket.data.invalid;
    const count = prev?.turnId === turnId ? prev.count + 1 : 1;
    socket.data.invalid = { turnId, count };
    if (count >= INK_INVALID_BATCHES_MAX) socket.disconnect(true);
  }

  /**
   * Why this socket can't send ink for `turnId`, or null when it is the drawer of the live turn.
   * `drawing` refuses while paused too (batches); `ink:sync` is allowed then.
   */
  function refuseDrawer(
    { code, role, pid }: InkSocketData,
    turnId: number,
    drawing: boolean,
  ): AckError | null {
    if (!code || !role) return 'notJoined';
    if (role !== 'player') return 'notDrawer';
    const room = rooms.get(code);
    if (!room) return 'roomNotFound';
    if (room.phase !== 'DRAWING' || !room.turn) return 'wrongPhase';
    if (drawing && room.paused) return 'paused';
    if (room.turn.drawerPid !== pid) return 'notDrawer';
    if (turnId !== room.turn.id) return 'staleTurn';
    return null;
  }

  function onInk(code: string, effect: InkEffect): void {
    switch (effect.type) {
      case 'inkOpen':
        store.open(code, effect.turnId);
        ink.to(inkScreenRoom(code)).emit('ink:turn', { turnId: effect.turnId });
        break;
      case 'inkClose':
        store.close(code, effect.turnId);
        break;
      case 'inkReset':
        store.reset(code);
        break;
      default:
        effect satisfies never;
    }
  }

  return {
    ink,
    onInk,
    turnInk: (code) => store.turn(code),
    store,
    forget: (code) => store.forget(code),
  };
}

/**
 * Registers `event` with a zod parse and a guarded, optional ack. A bad payload is dropped
 * without echoing it, like the main namespace's handler.
 */
function handle<E extends InkClientEvent>(
  socket: InkSocket,
  event: E,
  fn: (payload: InkClientPayloads[E]) => Ack<object>,
  onInvalid?: () => void,
): void {
  const listener = (raw: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (res: Ack<object>) => void) : () => {};
    const parsed = inkPayloadSchemas[event].safeParse(raw);
    if (!parsed.success) {
      reply(fail('invalidPayload'));
      return onInvalid?.();
    }
    try {
      reply(fn(parsed.data as InkClientPayloads[E]));
    } catch (err) {
      console.error(`[ink] ${event} failed`, err instanceof Error ? err.message : 'unknown');
      reply(fail('serverError'));
    }
  };
  socket.on(event, listener as never);
}

function fail(error: AckError): Ack {
  return { ok: false, error };
}
