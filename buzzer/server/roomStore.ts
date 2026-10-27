import { ROOM_IDLE_TTL_MS, ROOM_SWEEP_INTERVAL_MS } from '../shared/constants.js';
import type { Room } from '../shared/types.js';

/**
 * All room storage goes through this interface, so a persistent store (Redis, a database)
 * can replace the in-memory one later without touching the gateway or the reducer.
 */
export interface RoomStore {
  get(code: string): Room | undefined;
  has(code: string): boolean;
  /** Inserts or replaces the room under `room.code`. */
  set(room: Room): void;
  /** Returns whether a room was deleted. */
  delete(code: string): boolean;
  readonly size: number;
  /** Deletes every room idle for `ROOM_IDLE_TTL_MS` or longer at `now`, and returns their codes. */
  sweep(now: number): string[];
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  set(room: Room): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): boolean {
    return this.rooms.delete(code);
  }

  get size(): number {
    return this.rooms.size;
  }

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
 * Sweeps `store` every `intervalMs` using `clock` for the time, and passes the deleted codes to
 * `onExpired` (to free their images). The timer is unref'd so it never keeps the process alive.
 * Returns a function that stops it.
 */
export function startRoomSweeper(
  store: RoomStore,
  clock: () => number,
  intervalMs = ROOM_SWEEP_INTERVAL_MS,
  onExpired: (codes: string[]) => void = () => {},
): () => void {
  const timer = setInterval(() => {
    const expired = store.sweep(clock());
    if (expired.length > 0) onExpired(expired);
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
