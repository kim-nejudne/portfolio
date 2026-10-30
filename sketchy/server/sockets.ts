// The Socket.IO gateway for the main namespace. Ported from Buzzr (buzzer/server/sockets.ts): role
// rooms, guarded ack callbacks, `state` + `fx`, ping/pong. Changes: no host room (host is a socket
// capability: a Screen holding the token, or the crown holder's phone), the reducer's `now` is
// monotonic, effects carry `turnId`/`timerEpoch`, and errors are closed codes (`AckError`).
//
// Flow per event: zod parse → auth → `reduce` → store (stamping `lastActivityAt`) → a fresh
// `toView` for every socket in the room → run the effects. See "Realtime events and HTTP API".

import { createHash } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  PING_RATE_LIMIT,
  PONG_ACK_TIMEOUT_MS,
  SOCKET_MAX_BUFFER_BYTES,
  SOCKET_PING_INTERVAL_MS,
  SOCKET_PING_TIMEOUT_MS,
} from '../shared/constants.js';
import { clientPayloadSchemas } from '../shared/schemas.js';
import type {
  Ack,
  AckError,
  Action,
  ClientEvent,
  ClientPayloads,
  ClientToServerEvents,
  Effect,
  Room,
  RoomClosedReason,
  Sender,
  ServerToClientEvents,
  SystemAction,
} from '../shared/types.js';
import { addRttSample, medianRtt, oneWayMs } from './fairness.js';
import { verifyHostToken } from './hostToken.js';
import { createRateLimiter } from './rateLimit.js';
import { reduce } from './reducer.js';
import type { RoomStore } from './roomStore.js';
import { toView } from './views.js';

/** What a socket joined as. Set once, by a successful `*:join`; later events read it. */
export interface SocketData {
  code?: string;
  role?: 'screen' | 'player';
  pid?: string;
  /** A Screen that joined with a valid hostToken. A player's host right is the crown, checked per event. */
  screenHost: boolean;
}

export type GatewayServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type GatewaySocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** Ink effects, handed to the `/ink` gateway (F06). */
export type InkEffect = Extract<Effect, { type: 'inkOpen' | 'inkClose' | 'inkReset' }>;

/** Runs `fn` after `delayMs`; returns a cancel function. Tests pass a manual scheduler. */
export type Scheduler = (fn: () => void, delayMs: number) => () => void;

export interface GatewayOptions {
  rooms: RoomStore;
  /** Wall-clock ms, for `lastActivityAt` (the idle sweeper compares it with `Date.now`). */
  clock?: () => number;
  /** Monotonic ms (`performance.now`): the reducer's `now` and guess arrival times. */
  monotonic?: () => number;
  scheduler?: Scheduler;
  /** Receives `inkOpen`, `inkClose` and `inkReset` for the room `code`. */
  onInk?: (code: string, effect: InkEffect) => void;
}

/** Reduces `action` in room `code`, stores it, sends every socket its view and runs the effects. */
export type Dispatch = (code: string, action: Action) => Ack;

export interface Gateway {
  io: GatewayServer;
  dispatch: Dispatch;
}

/** Every joined socket of a room: `room:closed` goes here. */
export const anyRoom = (code: string) => `room:${code}`;
export const screenRoom = (code: string) => `room:${code}:screen`;
export const playerRoom = (code: string, pid: string) => `room:${code}:player:${pid}`;

const defaultScheduler: Scheduler = (fn, delayMs) => {
  const timer = setTimeout(fn, delayMs);
  return () => clearTimeout(timer);
};

/** SHA-256 of a device's playerKey, as hex. The room stores only this. */
export function hashPlayerKey(playerKey: string): string {
  return createHash('sha256').update(playerKey, 'utf8').digest('hex');
}

export function attachSockets(
  httpServer: HttpServer,
  {
    rooms,
    clock = Date.now,
    monotonic = () => performance.now(),
    scheduler = defaultScheduler,
    onInk = () => {},
  }: GatewayOptions,
): Gateway {
  const io: GatewayServer = new Server(httpServer, {
    transports: ['websocket'],
    pingInterval: SOCKET_PING_INTERVAL_MS,
    pingTimeout: SOCKET_PING_TIMEOUT_MS,
    // A bigger frame closes the connection.
    maxHttpBufferSize: SOCKET_MAX_BUFFER_BYTES,
  });

  // Keyed by socket id: one phone's pings can't use up another's.
  const pingLimiter = createRateLimiter(PING_RATE_LIMIT, monotonic);
  // Each connection's RTT samples, by socket id, for the Screen's `?debug=1` overlay (F16).
  const rttBySocket = new Map<string, () => readonly number[]>();

  // Scheduled effects still pending. A timer must not fire into a gateway that has shut down.
  const pending = new Set<{ cancel: () => void }>();
  httpServer.once('close', () => {
    for (const timer of pending) timer.cancel();
    pending.clear();
  });

  const socketsIn = (room: string): GatewaySocket[] =>
    [...(io.sockets.adapter.rooms.get(room) ?? [])].flatMap((id) => {
      const socket = io.sockets.sockets.get(id);
      return socket ? [socket] : [];
    });

  /** Sends every socket in the room its own view: each Screen by its token, each player by pid. */
  function broadcast(room: Room, now: number): void {
    const screens = socketsIn(screenRoom(room.code));
    if (screens.length > 0) {
      const plain = toView(room, { kind: 'screen', isHost: false }, now);
      const host = toView(room, { kind: 'screen', isHost: true }, now);
      for (const socket of screens) socket.emit('state', socket.data.screenHost ? host : plain);
    }
    for (const pid of Object.keys(room.players)) {
      io.to(playerRoom(room.code, pid)).emit('state', toView(room, { kind: 'player', pid }, now));
    }
  }

  function runEffects(room: Room, effects: Effect[], now: number): void {
    const { code } = room;
    for (const effect of effects) {
      switch (effect.type) {
        case 'schedule': {
          const { timer, turnId, epoch } = effect;
          scheduleTimer(code, { type: 'timer', timer, turnId, epoch }, effect.at - now);
          break;
        }
        case 'fx': {
          const { to } = effect;
          const target =
            to === 'screen'
              ? screenRoom(code)
              : to === 'all'
                ? anyRoom(code)
                : playerRoom(code, to.pid);
          io.to(target).emit('fx', effect.fx);
          break;
        }
        case 'kick': {
          // `kicked` first, then the disconnect on the same connection; Socket.IO clients don't
          // reconnect after a server disconnect.
          const own = playerRoom(code, effect.pid);
          io.to(own).emit('kicked', {});
          io.in(own).disconnectSockets(true);
          break;
        }
        case 'inkOpen':
        case 'inkClose':
        case 'inkReset':
          onInk(code, effect);
          break;
        default:
          effect satisfies never;
      }
    }
  }

  /** Dispatches the timer after `delayMs`. The reducer drops it if the room has moved on. */
  function scheduleTimer(code: string, action: SystemAction, delayMs: number): void {
    // Added before scheduling, so a scheduler that runs `fn` synchronously still finds it.
    const entry = { cancel: () => {} };
    pending.add(entry);
    entry.cancel = scheduler(
      () => {
        pending.delete(entry);
        try {
          // A stale or no-longer-valid timer is dropped silently: no broadcast, no log.
          dispatch(code, action);
        } catch (err) {
          // The message only: an error object could carry room state, and with it the word.
          console.error('[sockets] timer failed', err instanceof Error ? err.message : 'unknown');
        }
      },
      Math.max(0, delayMs),
    );
  }

  /**
   * Reduces, stores, then calls `beforePublish` (to put a joining socket in its rooms), then
   * broadcasts and runs the effects. Every game action goes through here.
   */
  function commit(
    code: string,
    action: Action,
    beforePublish?: (room: Room) => void,
  ): { ok: true; room: Room } | { ok: false; error: AckError } {
    const current = rooms.get(code);
    if (!current) return { ok: false, error: 'roomNotFound' };
    const now = monotonic();
    const result = reduce(current, action, now);
    if (!result.ok) return result;
    // The reducer can't read the wall clock; a live room must not look idle to the sweeper.
    const room: Room = { ...result.room, lastActivityAt: clock() };
    rooms.set(room);
    beforePublish?.(room);
    broadcast(room, now);
    runEffects(room, result.effects, now);
    return { ok: true, room };
  }

  function dispatch(code: string, action: Action): Ack {
    const res = commit(code, action);
    return res.ok ? { ok: true } : res;
  }

  /** Tells the room how many Screens are connected. */
  function countScreens(code: string): void {
    if (!rooms.has(code)) return;
    const count = io.sockets.adapter.rooms.get(screenRoom(code))?.size ?? 0;
    dispatch(code, { type: 'sys:screens', count });
  }

  io.on('connection', (socket) => {
    socket.data = { screenHost: false };
    // This connection's last RTT_SAMPLES round trips. Never in the room, so pings cause no
    // broadcasts; a reconnect starts again from 0 (no correction until the first sample).
    let rttSamples: number[] = [];
    rttBySocket.set(socket.id, () => rttSamples);

    /** The sender of a player or host event, or why there is none. */
    const sender = (): { code: string; by: Sender } | AckError => {
      const { code, role, pid, screenHost } = socket.data;
      if (!code || !role) return 'notJoined';
      if (role === 'screen') return { code, by: { kind: 'screen', isHost: screenHost } };
      const room = rooms.get(code);
      if (!room) return 'roomNotFound';
      return { code, by: { kind: 'player', pid, isHost: room.crownPid === pid } };
    };

    const asPlayer = (build: (by: Sender) => Action): Ack => {
      const s = sender();
      if (typeof s === 'string') return fail(s);
      if (s.by.kind !== 'player') return fail('notPlayer');
      return dispatch(s.code, build(s.by));
    };

    const asHost = (build: (by: Sender) => Action): Ack => {
      const s = sender();
      if (typeof s === 'string') return fail(s);
      // The reducer checks again: a player sender must still hold the crown.
      if (!s.by.isHost) return fail('notHost');
      return dispatch(s.code, build(s.by));
    };

    handle(socket, 'screen:join', ({ code, hostToken }) => {
      if (socket.data.role) return fail('alreadyJoined');
      const room = rooms.get(code);
      if (!room) return fail('roomNotFound');
      if (hostToken !== undefined && !verifyHostToken(hostToken, room.hostTokenHash)) {
        return fail('badHostToken');
      }
      socket.data = { code, role: 'screen', screenHost: hostToken !== undefined };
      void socket.join([anyRoom(code), screenRoom(code)]);
      // The new count reaches every socket, this one included.
      countScreens(code);
      return { ok: true };
    });

    handle(socket, 'player:join', ({ code, playerKey, name, takeOver }) => {
      if (socket.data.role) return fail('alreadyJoined');
      const keyHash = hashPlayerKey(playerKey);
      let pid: string | undefined;
      const res = commit(
        code,
        {
          type: 'player:join',
          by: { kind: 'player', isHost: false },
          keyHash,
          name,
          ...(takeOver === undefined ? {} : { takeOver }),
        },
        (room) => {
          // Before the broadcast and the effects, so this socket gets its state and `crowned`.
          // A `takeOver` only succeeds for a disconnected player, and a player is marked
          // disconnected only once their last socket has gone, so no old phone shares this room.
          pid = Object.values(room.players).find((p) => p.keyHash === keyHash)?.pid;
          if (!pid) return;
          void socket.join([anyRoom(code), playerRoom(code, pid)]);
          socket.data = { code, role: 'player', pid, screenHost: false };
        },
      );
      if (!res.ok) return res;
      if (!pid) return fail('serverError');
      return { ok: true, pid };
    });

    // SPEC-QUESTION: `pong {t}` alone lets only the phone time the RTT. As in Buzzr, the server
    // times its own sample from emitting `pong` to the phone's ack of it (DECISIONS 36).
    handle(socket, 'ping', ({ t }) => {
      if (!pingLimiter.hit(socket.id)) return fail('rateLimited');
      const sentAt = monotonic();
      const pong = { t, serverNow: clock() };
      socket.timeout(PONG_ACK_TIMEOUT_MS).emit('pong', pong, (err: Error | null) => {
        if (!err) rttSamples = addRttSample(rttSamples, monotonic() - sentAt);
      });
      return { ok: true };
    });

    // SPEC-QUESTION: the spec wants every player's RTT on the `?debug=1` overlay but names no event
    // for it. The Screen asks with `debug:rtt` (DECISIONS 39), so pings cause no broadcasts.
    // Shares the ping limit: a Screen in debug mode asks every PING_INTERVAL_MS and pings as often,
    // well under it; a burst only costs that Screen its own pings. Not gated: see DECISIONS 39.
    handle(socket, 'debug:rtt', () => {
      if (!pingLimiter.hit(socket.id)) return fail('rateLimited');
      const { code, role } = socket.data;
      if (!code || !role) return fail('notJoined');
      if (role !== 'screen') return fail('notScreen');
      const rtt: Record<string, number> = {};
      for (const other of socketsIn(anyRoom(code))) {
        const samples = rttBySocket.get(other.id)?.() ?? [];
        if (other.data.role === 'player' && other.data.pid && samples.length > 0)
          rtt[other.data.pid] = medianRtt(samples);
      }
      return { ok: true, rtt };
    });

    handle(socket, 'player:guess', ({ text }) => {
      // Arrival time first: scoring measures from it, less the one-way latency at this moment.
      const receivedAt = monotonic();
      const latency = oneWayMs(medianRtt(rttSamples));
      return asPlayer((by) => ({ type: 'player:guess', by, text, receivedAt, oneWayMs: latency }));
    });

    handle(socket, 'player:react', ({ emoji }) =>
      asPlayer((by) => ({ type: 'player:react', by, emoji })),
    );
    handle(socket, 'player:visibility', ({ hidden }) =>
      asPlayer((by) => ({ type: 'player:visibility', by, hidden })),
    );
    handle(socket, 'player:rename', ({ name }) =>
      asPlayer((by) => ({ type: 'player:rename', by, name })),
    );
    handle(socket, 'drawer:choose', ({ index }) =>
      asPlayer((by) => ({ type: 'drawer:choose', by, index })),
    );

    handle(socket, 'player:leave', () => {
      const { code, pid } = socket.data;
      const ack = asPlayer((by) => ({ type: 'player:leave', by }));
      if (!ack.ok || !code || !pid) return ack;
      // Not a kick: this player's sockets stay connected but unjoined, so the phone can join again.
      for (const own of socketsIn(playerRoom(code, pid))) {
        void own.leave(playerRoom(code, pid));
        void own.leave(anyRoom(code));
        own.data = { screenHost: false };
      }
      return ack;
    });

    handle(socket, 'host:start', () => asHost((by) => ({ type: 'host:start', by })));
    handle(socket, 'host:pause', () => asHost((by) => ({ type: 'host:pause', by })));
    handle(socket, 'host:resume', () => asHost((by) => ({ type: 'host:resume', by })));
    handle(socket, 'host:skip', () => asHost((by) => ({ type: 'host:skip', by })));
    handle(socket, 'host:next', () => asHost((by) => ({ type: 'host:next', by })));
    handle(socket, 'host:end', () => asHost((by) => ({ type: 'host:end', by })));
    handle(socket, 'host:rematch', () => asHost((by) => ({ type: 'host:rematch', by })));
    handle(socket, 'host:rematchCancel', () =>
      asHost((by) => ({ type: 'host:rematchCancel', by })),
    );
    handle(socket, 'host:backToLobby', () => asHost((by) => ({ type: 'host:backToLobby', by })));
    handle(socket, 'host:kick', ({ pid }) => asHost((by) => ({ type: 'host:kick', by, pid })));
    handle(socket, 'host:crown', ({ pid }) => asHost((by) => ({ type: 'host:crown', by, pid })));
    handle(socket, 'host:settings', (settings) =>
      asHost((by) => ({ type: 'host:settings', by, ...settings })),
    );
    handle(socket, 'host:customWords', ({ words }) =>
      asHost((by) => ({ type: 'host:customWords', by, words })),
    );

    socket.on('disconnect', () => {
      rttBySocket.delete(socket.id);
      const { code, role, pid } = socket.data;
      if (!code) return;
      // Socket.IO has already taken the socket out of its rooms, so counts leave it out.
      if (role === 'screen') return countScreens(code);
      if (role !== 'player' || !pid) return;
      // A phone that reconnected before its old socket timed out is still here: keep it connected.
      if (io.sockets.adapter.rooms.get(playerRoom(code, pid))?.size) return;
      if (!rooms.get(code)?.players[pid]) return;
      dispatch(code, { type: 'sys:disconnected', pid });
    });
  });

  return { io, dispatch };
}

/**
 * Tells every socket still in each of `codes` that its room is gone, then disconnects them. Call it
 * after the rooms have left the store.
 */
export function closeRooms(io: GatewayServer, codes: string[], reason: RoomClosedReason): void {
  for (const code of codes) {
    io.to(anyRoom(code)).emit('room:closed', { reason });
    io.in(anyRoom(code)).disconnectSockets(true);
  }
}

/**
 * Registers `event` with a zod parse of its payload and a guarded ack. A client may omit the ack
 * or send garbage; neither can throw out of the handler, and a bad payload is never echoed back
 * or logged (it may be a guess or a custom word).
 */
function handle<E extends ClientEvent>(
  socket: GatewaySocket,
  event: E,
  fn: (payload: ClientPayloads[E]) => Ack,
): void {
  const listener = (raw: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (res: Ack) => void) : () => {};
    const parsed = clientPayloadSchemas[event].safeParse(raw);
    if (!parsed.success) return reply(fail('invalidPayload'));
    try {
      reply(fn(parsed.data as ClientPayloads[E]));
    } catch (err) {
      console.error(`[sockets] ${event} failed`, err instanceof Error ? err.message : 'unknown');
      reply(fail('serverError'));
    }
  };
  socket.on(event, listener as never);
}

function fail(error: AckError): Ack {
  return { ok: false, error };
}
