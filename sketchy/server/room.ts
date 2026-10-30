// Adapted from Buzzr (buzzer/server/room.ts): Sketchy's room shape and a PRNG seed.
import { randomInt } from 'node:crypto';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Room, RoomSettings } from '../shared/types.js';

export interface NewRoom {
  code: string;
  hostTokenHash: string;
  /** Validated partial settings from `POST /api/rooms`, applied over the defaults. */
  settings?: Partial<RoomSettings>;
  /** Wall-clock ms (`Date.now`), so the sweeper can compare `lastActivityAt`. */
  now: number;
  /** `Room.rngState`. Tests pass one; otherwise it comes from the CSPRNG. */
  seed?: number;
}

/** A fresh `Room.rngState` from the CSPRNG. Never call it from the reducer. */
export function newSeed(): number {
  return randomInt(2 ** 32);
}

/** A fresh room in LOBBY with no players. The code and token hash come from the caller. */
export function createRoom({
  code,
  hostTokenHash,
  settings,
  now,
  seed = newSeed(),
}: NewRoom): Room {
  return {
    code,
    hostTokenHash,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: {},
    kickedKeyHashes: [],
    crownPid: null,
    screens: 0,
    phase: 'LOBBY',
    paused: null,
    timerEpoch: 0,
    rngState: seed,
    cycle: 0,
    turnOrder: [],
    turnIndex: 0,
    turnCounter: 0,
    turn: null,
    upcoming: null,
    history: [],
    awards: [],
    deck: { remaining: [], usedIds: [] },
    customWords: [],
    rematchAt: null,
    session: { gameNumber: 1, totals: {}, firstDrawerJoinedAt: null },
    createdAt: now,
    lastActivityAt: now,
  };
}
