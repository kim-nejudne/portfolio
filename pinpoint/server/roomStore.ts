import {
  DEFAULT_ROUNDS,
  DEFAULT_TIMER_SECONDS,
  ROOM_IDLE_TTL_MS,
  ROOM_SWEEP_INTERVAL_MS,
} from '#shared/constants.js';
import type { Room } from '#shared/types.js';

/** A fresh LOBBY room. `rngState` seeds the room's `mulberry32` (place picking). */
export function createRoom(code: string, now: number, rngState: number): Room {
  return {
    code,
    phase: 'LOBBY',
    players: {},
    vipId: null,
    kickedIds: [],
    // SPEC-QUESTION: DECISIONS 13 (no category until the lobby picks one: "Pick a category")
    settings: {
      categoryId: '',
      mode: 'name',
      difficulty: 'mixed',
      rounds: DEFAULT_ROUNDS,
      timerSeconds: DEFAULT_TIMER_SECONDS,
    },
    game: null,
    previousGames: [],
    placeUsage: {},
    paused: null,
    rematchAt: null,
    timerEpoch: 0,
    screenCount: 0,
    rngState,
    createdAt: now,
    lastActivityAt: now,
  };
}

/** Rooms live in server memory only; a restart ends every game. */
export class RoomStore {
  private readonly rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  /** Inserts or replaces the room under `room.code`. */
  set(room: Room): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): boolean {
    return this.rooms.delete(code);
  }

  get size(): number {
    return this.rooms.size;
  }

  /** Deletes every room idle for `ROOM_IDLE_TTL_MS` or longer at `now`, and returns their codes. */
  sweep(now: number): string[] {
    const expired: string[] = [];
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivityAt >= ROOM_IDLE_TTL_MS) expired.push(code);
    }
    for (const code of expired) this.rooms.delete(code);
    return expired;
  }
}

/**
 * Sweeps `store` every `intervalMs` and passes the deleted codes to `onExpired`. The timer is
 * unref'd so it never keeps the process alive. Returns a function that stops it.
 */
export function startRoomSweeper(
  store: RoomStore,
  clock: () => number,
  onExpired: (codes: string[]) => void = () => {},
  intervalMs = ROOM_SWEEP_INTERVAL_MS,
): () => void {
  const timer = setInterval(() => {
    const expired = store.sweep(clock());
    if (expired.length > 0) onExpired(expired);
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
