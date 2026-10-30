// The `/ink` namespace: the drawer's batches go straight to the room's Screens, outside the reducer
// (see "Drawing data protocol"). A batch is relayed only when it comes from the current drawer's
// socket, in DRAWING, not paused, for the current `turnId`; everything else is dropped. Only
// Screens ever join `ink:<code>:screen`, and nothing is sent anywhere else.
//
// v0 (F06): limits are the schema's 4 KB and 200 points per op and 40 batches per second per
// socket. No ink log, `seq` checks, snapshots, resends, turn size cap or invalid-batch count yet;
// those arrive with F11/F12.

import type { Namespace, Socket } from 'socket.io';
import { INK_BATCH_RATE_LIMIT } from '../shared/constants.js';
import { inkAuthSchema, inkPayloadSchemas } from '../shared/schemas.js';
import type {
  Ack,
  AckError,
  InkBatch,
  InkClientEvent,
  InkClientPayloads,
  InkClientToServerEvents,
  InkServerToClientEvents,
} from '../shared/types.js';
import { createRateLimiter } from './rateLimit.js';
import type { RoomStore } from './roomStore.js';
import { hashPlayerKey, type GatewayServer, type InkEffect } from './sockets.js';

/** What an `/ink` socket is. A phone is bound at the handshake; a Screen by `ink:hello`. */
export interface InkSocketData {
  code?: string;
  role?: 'screen' | 'player';
  pid?: string;
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
  /** Monotonic ms, for the batch rate limit. */
  monotonic?: () => number;
}

export interface InkGateway {
  ink: InkNamespace;
  /** Pass to `attachSockets` as `onInk`: runs the reducer's ink effects. */
  onInk: (code: string, effect: InkEffect) => void;
}

export function attachInkGateway(
  io: GatewayServer,
  { rooms, monotonic = () => performance.now() }: InkGatewayOptions,
): InkGateway {
  // Same engine as the main namespace (WebSocket only, 100 KB frames); its own event types.
  const ink = io.of('/ink') as unknown as InkNamespace;
  // Keyed by player (or socket id before a phone is bound); idle keys are dropped by the limiter.
  const batchLimiter = createRateLimiter(INK_BATCH_RATE_LIMIT, monotonic);

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
      const { role, code: joined } = socket.data;
      if (joined && joined !== code) return fail('alreadyJoined');
      if (!rooms.has(code)) return fail('roomNotFound');
      // SPEC-QUESTION: F12 answers the current drawer's hello with its own snapshot. A player
      // socket never joins the Screen room, so no other phone can receive ink this way.
      if (role === 'player') return { ok: true };
      socket.data = { code, role: 'screen' };
      void socket.join(inkScreenRoom(code));
      return { ok: true };
    });

    handle(socket, 'ink:batch', (batch) => {
      // Per player, so a second `/ink` socket with the same playerKey doesn't double the budget.
      const { code, pid } = socket.data;
      if (!batchLimiter.hit(pid ? `${code}:${pid}` : socket.id)) return fail('rateLimited');
      const error = refuseBatch(socket.data, batch);
      if (error) return fail(error);
      ink.to(inkScreenRoom(socket.data.code!)).emit('ink:batch', batch);
      return { ok: true };
    });

    // Snapshots, resends and the gallery arrive with F12, doodles with F27.
    handle(socket, 'ink:sync', () => fail('notAvailable'));
    handle(socket, 'ink:get', () => fail('notAvailable'));
    handle(socket, 'doodle:batch', () => fail('notAvailable'));
  });

  /** Why a batch can't be relayed, or null when it comes from the drawer of the live turn. */
  function refuseBatch({ code, role, pid }: InkSocketData, [turnId]: InkBatch): AckError | null {
    if (!code || !role) return 'notJoined';
    if (role !== 'player') return 'notDrawer';
    const room = rooms.get(code);
    if (!room) return 'roomNotFound';
    if (room.phase !== 'DRAWING' || !room.turn) return 'wrongPhase';
    if (room.paused) return 'paused';
    if (room.turn.drawerPid !== pid) return 'notDrawer';
    if (turnId !== room.turn.id) return 'staleTurn';
    return null;
  }

  function onInk(code: string, effect: InkEffect): void {
    switch (effect.type) {
      case 'inkOpen':
        ink.to(inkScreenRoom(code)).emit('ink:turn', { turnId: effect.turnId });
        break;
      case 'inkClose':
      case 'inkReset':
        // SPEC-QUESTION: no ink log in v0; F12 freezes it at inkClose and drops it at inkReset.
        break;
      default:
        effect satisfies never;
    }
  }

  return { ink, onInk };
}

/**
 * Registers `event` with a zod parse and a guarded, optional ack. A bad payload is dropped
 * without echoing it, like the main namespace's handler.
 */
function handle<E extends InkClientEvent>(
  socket: InkSocket,
  event: E,
  fn: (payload: InkClientPayloads[E]) => Ack,
): void {
  const listener = (raw: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (res: Ack) => void) : () => {};
    const parsed = inkPayloadSchemas[event].safeParse(raw);
    if (!parsed.success) return reply(fail('invalidPayload'));
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
