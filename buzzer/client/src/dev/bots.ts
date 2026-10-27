// Simulated players for `/dev/bots/:code` (Dev tool: fake players). Development builds only.

import { MAX_PLAYERS_PER_ROOM } from '../../../shared/constants.js';
import type { Ack } from '../../../shared/types.js';
import { keepPinging } from '../lib/ping.js';
import { createSocket, type GameSocket } from '../lib/socket.js';

/** Bots buzz after a random delay up to this, so the collection window sees a spread. */
export const BOT_BUZZ_MAX_DELAY_MS = 300;
/** No ack by then counts as an error: `player:buzz` has no server handler until F15. */
export const BOT_ACK_TIMEOUT_MS = 2000;

export const DEFAULT_BOT_COUNT = 8;

/** The count input as a whole number of bots in [1, MAX_PLAYERS_PER_ROOM]; junk falls back to 1. */
export function clampBotCount(raw: string): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) ? Math.min(MAX_PLAYERS_PER_ROOM, Math.max(1, n)) : 1;
}

export type BotStatus = 'connecting' | 'joined' | 'error' | 'offline';

export interface BotState {
  id: string;
  name: string;
  status: BotStatus;
  /** The last join or buzz error, or the last buzz result. */
  message: string | null;
  /** Round trip of the last `ping`, once the server answers with `pong`. */
  rttMs: number | null;
}

export interface Bot {
  readonly id: string;
  /** Sends `player:buzz` after `delayMs`. */
  buzz(delayMs: number): void;
  disconnect(): void;
}

export interface BotOptions {
  code: string;
  /** 1-based. The id and name come from it, so a re-spawn reconnects the same player. */
  index: number;
  onChange: (state: BotState) => void;
  makeSocket?: () => GameSocket;
  /** Monotonic ms for ping timestamps. */
  clock?: () => number;
}

export const botId = (index: number) => `bot-${index}`;
export const botName = (index: number) => `Bot ${index}`;

/** A delay in [0, BOT_BUZZ_MAX_DELAY_MS] from a `Math.random`-style source. */
export function buzzDelay(random: () => number = Math.random): number {
  return Math.round(random() * BOT_BUZZ_MAX_DELAY_MS);
}

export function createBot({
  code,
  index,
  onChange,
  makeSocket = createSocket,
  clock = () => performance.now(),
}: BotOptions): Bot {
  const socket = makeSocket();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let state: BotState = {
    id: botId(index),
    name: botName(index),
    status: 'connecting',
    message: null,
    rttMs: null,
  };
  let closed = false;

  const update = (patch: Partial<BotState>) => {
    if (closed) return;
    state = { ...state, ...patch };
    onChange(state);
  };

  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };

  /** Socket.IO acks never time out by themselves; an unhandled event would leave the bot waiting. */
  const withTimeout = (onAck: (res: Ack) => void) => {
    let settled = false;
    later(() => {
      if (settled) return;
      settled = true;
      onAck({ ok: false, error: `No reply in ${BOT_ACK_TIMEOUT_MS / 1000} s` });
    }, BOT_ACK_TIMEOUT_MS);
    return (res: Ack) => {
      if (settled) return;
      settled = true;
      onAck(res);
    };
  };

  // Pings only while connected; a reconnect restarts them.
  const stopPing = keepPinging(socket, { clock, onRtt: (rttMs) => update({ rttMs }) });
  socket.on('connect', () => {
    socket.emit('player:join', { code, playerId: state.id, name: state.name }, (res) =>
      update(
        res.ok ? { status: 'joined', message: null } : { status: 'error', message: res.error },
      ),
    );
  });
  socket.on('disconnect', () => update({ status: 'offline' }));

  socket.connect();

  return {
    id: state.id,
    buzz(delayMs) {
      later(() => {
        socket.emit(
          'player:buzz',
          {},
          withTimeout((res) => update({ message: res.ok ? 'Buzz accepted' : res.error })),
        );
      }, delayMs);
    },
    disconnect() {
      closed = true;
      stopPing();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      socket.disconnect();
    },
  };
}
