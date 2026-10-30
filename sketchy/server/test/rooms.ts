// Fixtures for reducer tests: a seeded room, senders, and helpers that unwrap a `ReduceResult`.
import type { Action, Room, Sender } from '../../shared/types.js';
import { reduce, type ReduceResult } from '../reducer.js';
import { createRoom } from '../room.js';

/** Monotonic ms at room creation in tests. */
export const T0 = 1_000_000;

export function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    ...createRoom({ code: 'ABCD', hostTokenHash: 'hash', now: T0, seed: 42 }),
    ...overrides,
  };
}

export const SCREEN_HOST: Sender = { kind: 'screen', isHost: true };
export const SCREEN: Sender = { kind: 'screen', isHost: false };
export const asPlayer = (pid: string, isHost = false): Sender => ({ kind: 'player', pid, isHost });
/** A new phone joining: the gateway has no pid for it yet. */
export const NEW_PHONE: Sender = { kind: 'player', isHost: false };

export type Ok = Extract<ReduceResult, { ok: true }>;

export function ok(result: ReduceResult): Ok {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

export function step(room: Room, action: Action, now: number): Ok {
  return ok(reduce(room, action, now));
}

/** Joins each name in order (key `key-<name>`), one ms apart. Returns the room and the pids. */
export function withPlayers(names: string[], room = makeRoom()): { room: Room; pids: string[] } {
  const pids: string[] = [];
  for (const [i, name] of names.entries()) {
    const res = step(
      room,
      { type: 'player:join', by: NEW_PHONE, keyHash: `key-${name}`, name },
      T0 + i,
    );
    room = res.room;
    pids.push(Object.values(room.players).find((p) => p.name === name)!.pid);
  }
  return { room, pids };
}

/** A room with these players in DRAWING, turn 1, started at `T0 + 1000`. */
export function started(names = ['Ana', 'Ben', 'Cy']): { room: Room; pids: string[]; at: number } {
  const { room, pids } = withPlayers(names);
  const at = T0 + 1000;
  return { room: step(room, { type: 'host:start', by: SCREEN_HOST }, at).room, pids, at };
}

/** The current turn's word. Tests only: the reducer never hands this to a view. */
export function secretWord(room: Room): string {
  const word = room.turn?.word?.word;
  if (!word) throw new Error('No word in play');
  return word;
}
