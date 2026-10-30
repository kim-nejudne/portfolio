import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import { createRoom } from './room.js';

const T0 = 1_800_000_000_000;

describe('createRoom', () => {
  it('makes an empty LOBBY room with default settings, stamped with now', () => {
    const room = createRoom({ code: 'ABCD', hostTokenHash: 'hash', now: T0, seed: 42 });
    expect(room).toEqual({
      code: 'ABCD',
      hostTokenHash: 'hash',
      settings: DEFAULT_SETTINGS,
      players: {},
      kickedKeyHashes: [],
      crownPid: null,
      screens: 0,
      phase: 'LOBBY',
      paused: null,
      timerEpoch: 0,
      rngState: 42,
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
      createdAt: T0,
      lastActivityAt: T0,
    });
  });

  it('applies partial settings over the defaults without changing DEFAULT_SETTINGS', () => {
    const before = { ...DEFAULT_SETTINGS };
    const room = createRoom({
      code: 'ABCD',
      hostTokenHash: 'hash',
      now: T0,
      seed: 1,
      settings: { drawSeconds: 60, hints: false },
    });
    expect(room.settings).toEqual({ ...DEFAULT_SETTINGS, drawSeconds: 60, hints: false });
    expect(DEFAULT_SETTINGS).toEqual(before);
    expect(room.settings).not.toBe(DEFAULT_SETTINGS);
  });

  it('seeds the PRNG from the CSPRNG when no seed is given', () => {
    const seeds = new Set(
      Array.from(
        { length: 5 },
        () => createRoom({ code: 'ABCD', hostTokenHash: 'h', now: T0 }).rngState,
      ),
    );
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});
