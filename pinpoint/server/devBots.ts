// Fake players for `/dev/bots/:code` (spec: Dev tools). Loaded only outside production, by a
// dynamic import in http.ts, so the production server never needs socket.io-client.
import { randomBytes } from 'node:crypto';
import { io as connect, type Socket } from 'socket.io-client';
import { EMOJI, MAX_PLAYERS, PLAYER_KEY_LENGTH } from '#shared/constants.js';
import type { ClientToServerEvents } from '#shared/schemas.js';
import type { Box, LatLng, PlayerView, Room, ServerToClientEvents } from '#shared/types.js';

type BotSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// SPEC-QUESTION: DECISIONS 34 (uniform in the region box, lock-in timing)
/** Bots lock in by this share of the time left, so a slow round trip still beats the timer. */
const LOCK_BY = 0.9;

export interface BotIdentity {
  name: string;
  emoji: (typeof EMOJI)[number];
}

/** Up to `count` names ("Bot 1"…) and emoji free in the room, within the player cap. */
export function botIdentities(room: Room, count: number): BotIdentity[] {
  const players = Object.values(room.players);
  const names = new Set(players.map((p) => p.name.toLowerCase()));
  const freeEmoji = EMOJI.filter((e) => !players.some((p) => p.emoji === e));
  const n = Math.min(count, MAX_PLAYERS - players.length, freeEmoji.length);
  const out: BotIdentity[] = [];
  for (let i = 1; out.length < n; i++) {
    if (!names.has(`bot ${i}`)) out.push({ name: `Bot ${i}`, emoji: freeEmoji[out.length]! });
  }
  return out;
}

/** A uniform point in the box; a box across the antimeridian (east > 180) wraps back. */
export function randomPointIn(box: Box, random: () => number): LatLng {
  const lng = box.west + random() * (box.east - box.west);
  return {
    lat: box.south + random() * (box.north - box.south),
    lng: lng > 180 ? lng - 360 : lng,
  };
}

export interface SpawnOptions {
  /** The server itself, e.g. `http://127.0.0.1:3010`. */
  url: string;
  code: string;
  identities: BotIdentity[];
  random?: () => number;
  /** Runs `fn` after `ms`; tests fire it by hand. */
  setTimer?: (fn: () => void, ms: number) => void;
}

export interface Bots {
  /** The bots that joined. */
  names: string[];
  stop: () => void;
}

/**
 * Joins one Socket.IO player per identity. In each GUESSING round a bot aims at a random point
 * of the game's region and locks in there at a random moment before the timer. The server
 * disconnects it on a kick or when the room closes; it stays through rematches.
 */
export async function spawnBots({
  url,
  code,
  identities,
  random = Math.random,
  setTimer = (fn, ms) => void setTimeout(fn, ms),
}: SpawnOptions): Promise<Bots> {
  const sockets: BotSocket[] = [];
  const names: string[] = [];
  // One at a time, so the room's player cap and emoji checks see each bot before the next.
  for (const { name, emoji } of identities) {
    const socket: BotSocket = connect(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false, // a restarted server has lost the room anyway
    });
    let plannedRound: number | null = null;
    socket.on('state', (view) => {
      if (view.role !== 'player') return;
      const v: PlayerView = view;
      if (v.phase !== 'GUESSING' || !v.round || !v.region || v.paused || v.me.waiting) {
        if (v.phase !== 'GUESSING') plannedRound = null;
        return;
      }
      const { round, region } = v;
      if (round.myLock || round.endsAt === null || plannedRound === round.number) return;
      plannedRound = round.number;
      const target = randomPointIn(region.box, random);
      socket.emit('player:aim', target, () => {});
      const left = Math.max(0, round.endsAt - v.serverNow);
      setTimer(
        () => {
          // Refused (paused meanwhile, say): plan again on the next GUESSING state.
          void socket.emitWithAck('player:lockIn', target).then((ack) => {
            if (!ack.ok && plannedRound === round.number) plannedRound = null;
          });
        },
        Math.round(random() * left * LOCK_BY),
      );
    });
    sockets.push(socket);
    const connected = await new Promise<boolean>((resolve) => {
      socket.once('connect', () => resolve(true));
      socket.once('connect_error', () => resolve(false));
    });
    if (!connected) break;
    const playerKey = randomBytes(16).toString('base64url').slice(0, PLAYER_KEY_LENGTH);
    const ack = await socket.emitWithAck('player:join', { code, playerKey, name, emoji });
    if (!ack.ok) {
      socket.disconnect();
      break; // full, ended or rate-limited: the rest would fail the same way
    }
    names.push(name);
  }
  return { names, stop: () => sockets.forEach((s) => s.disconnect()) };
}
