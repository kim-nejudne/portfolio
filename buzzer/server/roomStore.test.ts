import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, ROOM_IDLE_TTL_MS, ROOM_SWEEP_INTERVAL_MS } from '../shared/constants.js';
import type { Room } from '../shared/types.js';
import { InMemoryImageStore } from './imageStore.js';
import { InMemoryRoomStore, startRoomSweeper } from './roomStore.js';

const T0 = 1_800_000_000_000;

function makeRoom(code: string, lastActivityAt = T0): Room {
  return {
    code,
    hostTokenHash: 'hash',
    set: {
      id: 'set1',
      title: 'Quiz',
      questions: [],
      createdAt: T0,
      updatedAt: T0,
      schemaVersion: 1,
    },
    settings: { ...DEFAULT_SETTINGS },
    players: {},
    kickedIds: [],
    phase: 'LOBBY',
    questionIndex: -1,
    openingCounter: 0,
    buzzes: [],
    windowStartedAt: null,
    winnerId: null,
    lockedOut: [],
    judgements: [],
    reopenAt: null,
    undo: [],
    answerTimer: null,
    buzzTimer: null,
    autoOpenAt: null,
    hostDevices: 0,
    showScoreboard: false,
    createdAt: T0,
    lastActivityAt,
  };
}

describe('InMemoryRoomStore', () => {
  it('returns a stored room by code', () => {
    const store = new InMemoryRoomStore();
    const room = makeRoom('ABCD');
    store.set(room);
    expect(store.get('ABCD')).toBe(room);
    expect(store.has('ABCD')).toBe(true);
    expect(store.size).toBe(1);
  });

  it('returns undefined for an unknown code', () => {
    const store = new InMemoryRoomStore();
    expect(store.get('ZZZZ')).toBeUndefined();
    expect(store.has('ZZZZ')).toBe(false);
  });

  it('replaces a room when set again with the same code', () => {
    const store = new InMemoryRoomStore();
    store.set(makeRoom('ABCD'));
    const next = { ...makeRoom('ABCD'), phase: 'QUESTION' as const };
    store.set(next);
    expect(store.get('ABCD')).toBe(next);
    expect(store.size).toBe(1);
  });

  it('deletes a room and reports whether it existed', () => {
    const store = new InMemoryRoomStore();
    store.set(makeRoom('ABCD'));
    expect(store.delete('ABCD')).toBe(true);
    expect(store.get('ABCD')).toBeUndefined();
    expect(store.delete('ABCD')).toBe(false);
  });
});

describe('InMemoryRoomStore.sweep', () => {
  it('keeps a room idle for 1 ms under 3 hours', () => {
    const store = new InMemoryRoomStore();
    store.set(makeRoom('ABCD'));
    expect(store.sweep(T0 + ROOM_IDLE_TTL_MS - 1)).toEqual([]);
    expect(store.has('ABCD')).toBe(true);
  });

  it('deletes a room idle for exactly 3 hours', () => {
    expect(ROOM_IDLE_TTL_MS).toBe(3 * 60 * 60 * 1000);
    const store = new InMemoryRoomStore();
    store.set(makeRoom('ABCD'));
    expect(store.sweep(T0 + ROOM_IDLE_TTL_MS)).toEqual(['ABCD']);
    expect(store.has('ABCD')).toBe(false);
  });

  it('measures idleness from the last activity, not from creation', () => {
    const store = new InMemoryRoomStore();
    store.set(makeRoom('DEAD', T0));
    store.set(makeRoom('BUSY', T0 + 60_000));
    expect(store.sweep(T0 + ROOM_IDLE_TTL_MS)).toEqual(['DEAD']);
    expect(store.has('BUSY')).toBe(true);
  });
});

describe('startRoomSweeper', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sweeps on every interval with the injected clock, until stopped', () => {
    vi.useFakeTimers();
    const store = new InMemoryRoomStore();
    store.set(makeRoom('ABCD'));
    let now = T0 + ROOM_IDLE_TTL_MS - 1;
    const stop = startRoomSweeper(store, () => now);

    vi.advanceTimersByTime(ROOM_SWEEP_INTERVAL_MS);
    expect(store.has('ABCD')).toBe(true);

    now += 1;
    vi.advanceTimersByTime(ROOM_SWEEP_INTERVAL_MS);
    expect(store.has('ABCD')).toBe(false);

    stop();
    store.set(makeRoom('EFGH'));
    vi.advanceTimersByTime(ROOM_SWEEP_INTERVAL_MS);
    expect(store.has('EFGH')).toBe(true);
  });

  it("frees a swept room's images through onExpired", () => {
    vi.useFakeTimers();
    const store = new InMemoryRoomStore();
    const images = new InMemoryImageStore();
    store.set(makeRoom('ABCD'));
    store.set(makeRoom('EFGH', T0 + ROOM_IDLE_TTL_MS));
    images.put('ABCD', 'img1', { type: 'image/png', data: Buffer.alloc(10) });
    images.put('EFGH', 'img1', { type: 'image/png', data: Buffer.alloc(20) });
    const stop = startRoomSweeper(
      store,
      () => T0 + ROOM_IDLE_TTL_MS,
      ROOM_SWEEP_INTERVAL_MS,
      (codes) => {
        for (const code of codes) images.deleteRoom(code);
      },
    );

    vi.advanceTimersByTime(ROOM_SWEEP_INTERVAL_MS);
    expect(images.get('ABCD', 'img1')).toBeUndefined();
    expect(images.get('EFGH', 'img1')).toBeDefined();
    expect(images.totalBytes).toBe(20);
    stop();
  });
});
