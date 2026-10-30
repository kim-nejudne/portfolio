// Fixtures for reducer tests: a seeded room, senders, and helpers that unwrap a `ReduceResult`.
import { expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import type { Action, Phase, Room, Sender } from '../../shared/types.js';
import { reduce, type ReduceResult } from '../reducer.js';
import { createRoom } from '../room.js';
import { TEST_PACKS } from './packs.js';

/** Monotonic ms at room creation in tests. */
export const T0 = 1_000_000;

/** A room as its Screen made it: that Screen is connected (`screens: 1`) unless overridden. */
export function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    ...createRoom({ code: 'ABCD', hostTokenHash: 'hash', now: T0, seed: 42, packs: TEST_PACKS }),
    screens: 1,
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

/** A room with these players in CHOOSING, turn 1, dealt at `T0 + 1000`. */
export function dealt(
  names = ['Ana', 'Ben', 'Cy'],
  room?: Room,
): { room: Room; pids: string[]; at: number } {
  const joined = withPlayers(names, room);
  const at = T0 + 1000;
  return {
    room: step(joined.room, { type: 'host:start', by: SCREEN_HOST }, at).room,
    pids: joined.pids,
    at,
  };
}

/** The current drawer picks choice `index` at `now`. */
export function choose(room: Room, now: number, index: 0 | 1 | 2 = 0): Room {
  return step(room, { type: 'drawer:choose', by: asPlayer(room.turn!.drawerPid), index }, now).room;
}

/**
 * A room with these players in DRAWING, turn 1: dealt at `T0 + 1000` and chosen at once, so the
 * clock starts at `at`.
 */
export function started(names = ['Ana', 'Ben', 'Cy']): { room: Room; pids: string[]; at: number } {
  const { room, pids, at } = dealt(names);
  return { room: choose(room, at), pids, at };
}

/** The current turn's word. Tests only: the reducer never hands this to a view. */
export function secretWord(room: Room): string {
  const word = room.turn?.word?.word;
  if (!word) throw new Error('No word in play');
  return word;
}

/**
 * The room in `phase`, reached by playing a 2-player game with the host's Skip and Next: one cycle
 * for FINAL, two to stop at the SCOREBOARD between them.
 */
export function inPhase(phase: Exclude<Phase, 'LOBBY'>): Room {
  const base = makeRoom({
    settings: { ...DEFAULT_SETTINGS, cycles: phase === 'SCOREBOARD' ? 2 : 1 },
  });
  const { room, at } = dealt(['Ana', 'Ben'], base);
  const host = (r: Room, type: 'host:skip' | 'host:next', t: number) =>
    step(r, { type, by: SCREEN_HOST }, t).room;
  const pick = (r: Room, t: number) =>
    step(r, { type: 'drawer:choose', by: asPlayer(r.turn!.drawerPid), index: 0 }, t).room;
  if (phase === 'CHOOSING') return room;
  let r = pick(room, at);
  if (phase === 'DRAWING') return r;
  r = host(r, 'host:skip', at + 1000);
  if (phase === 'REVEAL') return r;
  // Turn 2 (Ben) was dealt at the reveal: take it up, choose if still open, and skip it.
  r = host(r, 'host:next', at + 2000);
  if (r.phase === 'CHOOSING') r = pick(r, at + 2500);
  r = host(host(r, 'host:skip', at + 3000), 'host:next', at + 4000);
  expect(r.phase).toBe(phase);
  return r;
}
