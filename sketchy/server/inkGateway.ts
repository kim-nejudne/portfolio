// The `/ink` namespace: the drawer's batches go straight to the room's Screens, outside the reducer
// (see "Drawing data protocol"). A batch is relayed only when it comes from the current drawer's
// socket, in DRAWING, not paused, for the current `turnId`; everything else is dropped. Only
// Screens ever join `ink:<code>:screen`, and nothing is sent anywhere else.
//
// Each relayed batch is applied to the turn's action stack (`shared/ink.ts`, the drawer's and the
// Screen's code too), which clamps points to the grid. The batch goes to the Screens unchanged:
// they decode it with the same code, so they rebuild the same picture.
//
// Limits so far are the schema's 4 KB and 200 points per op and 40 batches per second per player.
// `seq` checks, snapshots, resends, freezing at `inkClose`, the turn size cap and the invalid-batch
// count arrive with F12, which turns the per-room stack into its InkStore.

import type { Namespace, Socket } from 'socket.io';
import { INK_BATCH_RATE_LIMIT, INK_TURN_HARD_MAX_BYTES } from '../shared/constants.js';
import { applyInkOps, createInkStack, type InkStack } from '../shared/ink.js';
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

/** The action stack of a room's latest turn. */
export interface TurnInk {
  turnId: number;
  stack: InkStack;
  /** Encoded bytes of the batches applied so far. */
  bytes: number;
}

export interface InkGateway {
  ink: InkNamespace;
  /** Pass to `attachSockets` as `onInk`: runs the reducer's ink effects. */
  onInk: (code: string, effect: InkEffect) => void;
  /** The room's latest turn's ink, if any (read-only; for F12's snapshots and tests). */
  turnInk: (code: string) => TurnInk | undefined;
  /** Drops a room's ink (the room expired). */
  forget: (code: string) => void;
}

export function attachInkGateway(
  io: GatewayServer,
  { rooms, monotonic = () => performance.now() }: InkGatewayOptions,
): InkGateway {
  // Same engine as the main namespace (WebSocket only, 100 KB frames); its own event types.
  const ink = io.of('/ink') as unknown as InkNamespace;
  // Keyed by player (or socket id before a phone is bound); idle keys are dropped by the limiter.
  const batchLimiter = createRateLimiter(INK_BATCH_RATE_LIMIT, monotonic);
  // SPEC-QUESTION: one turn per room until F12's InkStore keeps frozen turns for the gallery and
  // caps each at INK_TURN_MAX_BYTES; a new turn replaces the last one here.
  const turns = new Map<string, TurnInk>();

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
      // `refuseBatch` passed, so the socket is bound to a live room and `turnId` is current.
      let turn = turns.get(code!);
      if (turn?.turnId !== batch[0]) turns.set(code!, (turn = openTurn(batch[0])));
      // A hard memory bound: a drawer spamming clears or tiny strokes can't grow the stack past
      // it. Refused batches are neither applied nor relayed, so the Screens keep the same stack.
      const bytes = JSON.stringify(batch).length;
      if (turn.bytes + bytes > INK_TURN_HARD_MAX_BYTES) return fail('inkFull');
      turn.bytes += bytes;
      applyInkOps(turn.stack, batch[2]);
      ink.to(inkScreenRoom(code!)).emit('ink:batch', batch);
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
        turns.set(code, openTurn(effect.turnId));
        ink.to(inkScreenRoom(code)).emit('ink:turn', { turnId: effect.turnId });
        break;
      case 'inkClose':
        // SPEC-QUESTION: F12 freezes the log here for the gallery; until then it stays as it is.
        break;
      case 'inkReset':
        turns.delete(code);
        break;
      default:
        effect satisfies never;
    }
  }

  return {
    ink,
    onInk,
    turnInk: (code) => turns.get(code),
    forget: (code) => void turns.delete(code),
  };
}

function openTurn(turnId: number): TurnInk {
  return { turnId, stack: createInkStack(), bytes: 0 };
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
