import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROOM_IDLE_TTL_MS, ROOM_SWEEP_INTERVAL_MS } from '#shared/constants.js';
import { createRoom, RoomStore, startRoomSweeper } from './roomStore.js';

describe('createRoom', () => {
  it('starts an empty LOBBY with the default settings', () => {
    const room = createRoom('ABCD', 1000, 42);
    expect(room).toMatchObject({
      code: 'ABCD',
      phase: 'LOBBY',
      players: {},
      vipId: null,
      game: null,
      screenCount: 0,
      rngState: 42,
      createdAt: 1000,
      lastActivityAt: 1000,
      settings: { categoryId: '', mode: 'name', difficulty: 'mixed', rounds: 10, timerSeconds: 30 },
    });
  });
});

describe('RoomStore', () => {
  it('keeps a room until it has been idle for 3 hours', () => {
    const store = new RoomStore();
    store.set(createRoom('ABCD', 0, 1));
    store.set({ ...createRoom('EFGH', 0, 1), lastActivityAt: 1 });

    expect(store.sweep(ROOM_IDLE_TTL_MS - 1)).toEqual([]);
    expect(store.sweep(ROOM_IDLE_TTL_MS)).toEqual(['ABCD']);
    expect(store.has('ABCD')).toBe(false);
    expect(store.get('EFGH')?.code).toBe('EFGH');
    expect(store.size).toBe(1);
    expect(ROOM_IDLE_TTL_MS).toBe(3 * 60 * 60 * 1000);
  });
});

describe('startRoomSweeper', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sweeps on its interval and reports deleted codes', () => {
    vi.useFakeTimers();
    const store = new RoomStore();
    store.set(createRoom('ABCD', 0, 1));
    const expired: string[][] = [];
    const stop = startRoomSweeper(
      store,
      () => ROOM_IDLE_TTL_MS,
      (codes) => expired.push(codes),
    );

    vi.advanceTimersByTime(ROOM_SWEEP_INTERVAL_MS);
    expect(expired).toEqual([['ABCD']]);
    stop();
  });
});
