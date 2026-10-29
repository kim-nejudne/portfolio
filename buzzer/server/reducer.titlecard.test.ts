import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, TITLE_CARD_MS } from '../shared/constants.js';
import type { Room, RoomSettings } from '../shared/types.js';
import { reduce, type Action, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeRoom, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;
const AT = NOW + TITLE_CARD_MS;

function step(room: Room, action: Action, now = NOW): Room {
  return ok(reduce(room, action, now)).room;
}

/** A lobby with two players and auto-open on (and any other settings). */
function lobby(settings: Partial<RoomSettings> = {}): Room {
  return withPlayers(
    makeRoom({ settings: { ...DEFAULT_SETTINGS, autoOpenBuzzers: true, ...settings } }),
    [makePlayer('p1'), makePlayer('p2')],
  );
}

/** Started with auto-open on: question 0 shown, the buzzers held for the title card. */
const held = (settings: Partial<RoomSettings> = {}) =>
  step(lobby(settings), { type: 'host:start' });

/** The `autoOpen` action the start scheduled, as the gateway would dispatch it. */
function autoOpen(room: Room, overrides: Partial<Extract<Action, { type: 'autoOpen' }>> = {}) {
  return {
    type: 'autoOpen',
    questionIndex: 0,
    openingCounter: 0,
    at: AT,
    ...overrides,
  } as const satisfies Action & { type: 'autoOpen' };
}

describe('title card: auto-open waits on the first question', () => {
  it('opens the buzzers when the hold ends', () => {
    const { room, effects } = ok(reduce(held(), autoOpen(held()), AT));
    expect(room).toMatchObject({
      phase: 'OPEN',
      questionIndex: 0,
      openingCounter: 1,
      autoOpenAt: null,
      lastActivityAt: AT,
    });
    expect(effects).toEqual([]);
  });

  it('lets players buzz in the new opening', () => {
    const open = step(held(), autoOpen(held()), AT);
    const buzzed = step(open, { type: 'player:buzz', playerId: 'p1', receivedAt: 5 }, AT + 100);
    expect(buzzed.phase).toBe('COLLECTING');
  });

  it('ignores a buzz during the hold', () => {
    const room = held();
    expect(
      ok(reduce(room, { type: 'player:buzz', playerId: 'p1', receivedAt: 5 }, NOW + 1)).room,
    ).toBe(room);
  });

  it('starts the buzz timer from the hold end, not from the start', () => {
    const start = ok(reduce(lobby({ buzzSeconds: 10 }), { type: 'host:start' }, NOW));
    expect(start.room.buzzTimer).toBeNull();
    expect(start.effects).toHaveLength(1);

    const { room, effects } = ok(reduce(start.room, autoOpen(start.room), AT));
    expect(room.buzzTimer).toEqual({ seconds: 10, endsAt: AT + 10_000 });
    expect(effects).toContainEqual({
      type: 'schedule',
      at: AT + 10_000,
      action: { type: 'buzzTimeUp', questionIndex: 0, openingCounter: 1, at: AT + 10_000 },
    });
  });

  it('does not hold without auto-open, nor on next and prev', () => {
    const plain = ok(reduce(lobby({ autoOpenBuzzers: false }), { type: 'host:start' }, NOW));
    expect(plain.room).toMatchObject({ phase: 'QUESTION', autoOpenAt: null });
    expect(plain.effects).toEqual([]);

    const onNext = step({ ...held(), phase: 'REVEAL' }, { type: 'host:next' });
    expect(onNext).toMatchObject({ phase: 'OPEN', questionIndex: 1, autoOpenAt: null });
    const onPrev = step({ ...onNext, phase: 'REVEAL' }, { type: 'host:prev' });
    expect(onPrev).toMatchObject({ phase: 'OPEN', questionIndex: 0, autoOpenAt: null });
  });

  it('a host who opens sooner ends the hold, and the late autoOpen is ignored', () => {
    const open = step(held(), { type: 'host:open' }, NOW + 1000);
    expect(open).toMatchObject({ phase: 'OPEN', openingCounter: 1, autoOpenAt: null });
    expect(ok(reduce(open, autoOpen(open), AT)).room).toBe(open);
  });

  it('keeps the hold when auto-open is turned off during it', () => {
    const room = step(held(), { type: 'host:settings', settings: { autoOpenBuzzers: false } });
    expect(step(room, autoOpen(room), AT).phase).toBe('OPEN');
  });

  it.each<[string, (room: Room) => Room]>([
    ['revealed', (r) => step(r, { type: 'host:reveal' })],
    ['ended', (r) => step(r, { type: 'host:end' })],
    ['moved on', (r) => step(step(r, { type: 'host:reveal' }), { type: 'host:next' })],
    [
      'moved on and back without auto-open',
      (r) => {
        const off = step(r, { type: 'host:settings', settings: { autoOpenBuzzers: false } });
        const next = step(step(off, { type: 'host:reveal' }), { type: 'host:next' });
        return step(step(next, { type: 'host:reveal' }), { type: 'host:prev' });
      },
    ],
  ])('ignores the autoOpen once the room has %s', (_, change) => {
    const room = change(held());
    expect(ok(reduce(room, autoOpen(room), AT)).room).toBe(room);
  });

  it.each([
    ['another question', { questionIndex: 1 }],
    ['another opening', { openingCounter: 1 }],
    ['another hold', { at: AT + 1 }],
  ])('ignores an autoOpen for %s', (_, overrides) => {
    const room = held();
    expect(ok(reduce(room, autoOpen(room, overrides), AT)).room).toBe(room);
  });

  it('starts a new game held again after New game', () => {
    const final = step(step(held(), autoOpen(held()), AT), { type: 'host:end' }, AT + 1);
    const again = step(final, { type: 'host:newGame', set: final.set, keepScores: false }, AT + 2);
    expect(again.autoOpenAt).toBeNull();
    const restarted = ok(reduce(again, { type: 'host:start' }, AT + 3));
    expect(restarted.room).toMatchObject({ phase: 'QUESTION', autoOpenAt: AT + 3 + TITLE_CARD_MS });
  });
});

describe('hostDevices', () => {
  it('stores a new count', () => {
    const room = step(makeRoom(), { type: 'hostDevices', count: 2 });
    expect(room.hostDevices).toBe(2);
    expect(room.lastActivityAt).toBe(NOW);
  });

  it('ignores the same count: no new room, no activity stamp', () => {
    const room = makeRoom({ hostDevices: 1 });
    expect(ok(reduce(room, { type: 'hostDevices', count: 1 }, NOW)).room).toBe(room);
  });

  it.each(['LOBBY', 'OPEN', 'FINAL'] as const)('is accepted in %s', (phase) => {
    expect(step(makeRoom({ phase }), { type: 'hostDevices', count: 1 }).hostDevices).toBe(1);
  });

  it('starts at 0 in a new room', () => {
    expect(makeRoom().hostDevices).toBe(0);
  });
});
