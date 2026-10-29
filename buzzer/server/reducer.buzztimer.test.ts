import { describe, expect, it } from 'vitest';
import { BUZZ_SECONDS_CHOICES, DEFAULT_SETTINGS } from '../shared/constants.js';
import type { BuzzSeconds, Room, RoomSettings } from '../shared/types.js';
import { reduce, type Action, type Effect, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeRoom, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

function step(room: Room, action: Action, now = NOW): Room {
  return ok(reduce(room, action, now)).room;
}

const press = (playerId: string, receivedAt = 500): Action => ({
  type: 'player:buzz',
  playerId,
  receivedAt,
});
const windowClosed = (room: Room): Action => ({
  type: 'windowClosed',
  questionIndex: room.questionIndex,
  openingCounter: room.openingCounter,
});
const wrong: Action = { type: 'host:judge', result: 'wrong' };
const correct: Action = { type: 'host:judge', result: 'correct' };

/** The `buzzTimeUp` action for `room`'s running timer, as the gateway would dispatch it. */
function timeUp(room: Room): Extract<Action, { type: 'buzzTimeUp' }> {
  if (!room.buzzTimer) throw new Error('No buzz timer running');
  return {
    type: 'buzzTimeUp',
    questionIndex: room.questionIndex,
    openingCounter: room.openingCounter,
    at: room.buzzTimer.endsAt,
  };
}

/** The `reopen` action the last wrong judgement scheduled. */
function reopen(room: Room): Action {
  if (room.reopenAt === null) throw new Error('No reopen pending');
  return {
    type: 'reopen',
    questionIndex: room.questionIndex,
    openingCounter: room.openingCounter,
    at: room.reopenAt,
  };
}

/** Three connected players on question 2 of 3, shown with the buzzers still locked. */
function question(buzzSeconds: BuzzSeconds = 10, settings: Partial<RoomSettings> = {}): Room {
  return withPlayers(
    makeRoom({
      settings: { ...DEFAULT_SETTINGS, buzzSeconds, ...settings },
      phase: 'QUESTION',
      questionIndex: 1,
      openingCounter: 1,
    }),
    [
      makePlayer('p1', { joinedAt: T0 + 1, score: 100 }),
      makePlayer('p2', { joinedAt: T0 + 2 }),
      makePlayer('p3', { joinedAt: T0 + 3 }),
    ],
  );
}

/** `host:open` at `now`: the room and its effects. */
function opened(room: Room, now = NOW): { room: Room; effects: Effect[] } {
  return ok(reduce(room, { type: 'host:open' }, now));
}

/** OPEN with a 10 s buzz timer started at `NOW`. */
function open(buzzSeconds: BuzzSeconds = 10): Room {
  return opened(question(buzzSeconds)).room;
}

/** p1 buzzes alone and the window closes: BUZZED with p1 as the winner. */
function buzzed(room: Room, playerId = 'p1', now = NOW + 1000): Room {
  const collecting = step(room, press(playerId), now);
  return step(collecting, windowClosed(collecting), now + 150);
}

/** Wrong on p1, then the reopen fires at `now`: the second opening of the question. */
function reopened(now = NOW + 5000): Room {
  const judged = step(buzzed(open()), wrong, now - 1500);
  return step(judged, reopen(judged), now);
}

/** Asserts that `action` is ignored as stale: the same room object, no effects. */
function expectStale(room: Room, action: Action): void {
  const result = ok(reduce(room, action, NOW + 60_000));
  expect(result.room).toBe(room);
  expect(result.effects).toEqual([]);
}

describe('buzz timer: each opening starts one', () => {
  it('host:open starts the timer and schedules buzzTimeUp with index, counter and at', () => {
    const { room, effects } = opened(question(10));
    const at = NOW + 10_000;
    expect(room.phase).toBe('OPEN');
    expect(room.buzzTimer).toEqual({ seconds: 10, endsAt: at });
    expect(effects).toEqual([
      {
        type: 'schedule',
        at,
        action: { type: 'buzzTimeUp', questionIndex: 1, openingCounter: 2, at },
      },
    ]);
  });

  it.each(BUZZ_SECONDS_CHOICES.filter((s) => s > 0))(
    'a %i s setting ends that many seconds after the opening',
    (seconds) => {
      expect(open(seconds).buzzTimer).toEqual({ seconds, endsAt: NOW + seconds * 1000 });
    },
  );

  it('starts no timer and schedules nothing when the buzz time is off', () => {
    const { room, effects } = opened(question(0));
    expect(room.phase).toBe('OPEN');
    expect(room.buzzTimer).toBeNull();
    expect(effects).toEqual([]);
  });

  it('a reopen after a wrong answer starts a fresh countdown for the new opening', () => {
    const at = NOW + 5000;
    const room = reopened(at);
    expect(room.phase).toBe('OPEN');
    expect(room.openingCounter).toBe(3);
    expect(room.buzzTimer).toEqual({ seconds: 10, endsAt: at + 10_000 });
    const judged = step(buzzed(open()), wrong, at - 1500);
    expect(ok(reduce(judged, reopen(judged), at)).effects).toEqual([
      {
        type: 'schedule',
        at: at + 10_000,
        action: { type: 'buzzTimeUp', questionIndex: 1, openingCounter: 3, at: at + 10_000 },
      },
    ]);
  });

  it.each([
    ['host:start', { type: 'host:start' }, 'LOBBY', 0],
    ['host:next', { type: 'host:next' }, 'REVEAL', 1],
    ['host:prev', { type: 'host:prev' }, 'REVEAL', 1],
  ] as const)('auto-open on %s starts the timer too', (_, action, phase, questionIndex) => {
    const room = { ...question(15, { autoOpenBuzzers: true }), phase, questionIndex };
    const { room: next, effects } = ok(reduce(room, action, NOW));
    expect(next.phase).toBe('OPEN');
    expect(next.buzzTimer).toEqual({ seconds: 15, endsAt: NOW + 15_000 });
    expect(effects).toContainEqual(
      expect.objectContaining({
        type: 'schedule',
        action: expect.objectContaining({ type: 'buzzTimeUp' }),
      }),
    );
  });

  it('a kick that empties the collection window reopens with a fresh countdown', () => {
    const collecting = step(open(), press('p1'), NOW + 2000);
    const room = step(collecting, { type: 'host:kick', playerId: 'p1' }, NOW + 2050);
    expect(room.phase).toBe('OPEN');
    expect(room.openingCounter).toBe(collecting.openingCounter + 1);
    expect(room.buzzTimer).toEqual({ seconds: 10, endsAt: NOW + 2050 + 10_000 });
  });

  it('keeps running unchanged through other actions in the same opening', () => {
    const room = open(10);
    for (const action of [
      { type: 'player:join', playerId: 'p4', name: 'Dee' },
      { type: 'player:disconnect', playerId: 'p2' },
      { type: 'host:adjustScore', playerId: 'p3', delta: 50 },
      { type: 'host:scoreboard', show: true },
      { type: 'host:kick', playerId: 'p3' },
    ] as const) {
      const { room: next, effects } = ok(reduce(room, action, NOW + 3000));
      expect(next.buzzTimer, action.type).toEqual(room.buzzTimer);
      expect(
        effects.filter((e) => e.type === 'schedule'),
        action.type,
      ).toEqual([]);
    }
  });

  it('a settings change waits for the next opening', () => {
    const room = step(open(10), { type: 'host:settings', settings: { buzzSeconds: 30 } }, NOW + 1);
    expect(room.buzzTimer).toEqual({ seconds: 10, endsAt: NOW + 10_000 });
    const off = step(open(10), { type: 'host:settings', settings: { buzzSeconds: 0 } }, NOW + 1);
    expect(off.buzzTimer).toEqual({ seconds: 10, endsAt: NOW + 10_000 });

    const judged = step(buzzed(room), wrong, NOW + 2000);
    expect(step(judged, reopen(judged), NOW + 3500).buzzTimer).toEqual({
      seconds: 30,
      endsAt: NOW + 3500 + 30_000,
    });
  });
});

describe('buzz timer: leaving OPEN clears it', () => {
  it('the first buzz clears the timer and schedules no buzzTimeUp', () => {
    const { room, effects } = ok(reduce(open(), press('p1'), NOW + 1000));
    expect(room.phase).toBe('COLLECTING');
    expect(room.buzzTimer).toBeNull();
    expect(effects.some((e) => e.type === 'schedule' && e.action.type === 'buzzTimeUp')).toBe(
      false,
    );
  });

  it.each([
    ['host:reveal', { type: 'host:reveal' }, 'REVEAL'],
    ['host:end', { type: 'host:end' }, 'FINAL'],
    ['host:prev', { type: 'host:prev' }, 'QUESTION'],
  ] as const)('%s clears it', (_, action, phase) => {
    const room = step(open(), action);
    expect(room.phase).toBe(phase);
    expect(room.buzzTimer).toBeNull();
  });

  it('host:undo back to BUZZED clears it', () => {
    const room = step(reopened(), { type: 'host:undo' });
    expect(room.phase).toBe('BUZZED');
    expect(room.buzzTimer).toBeNull();
  });
});

describe('buzz timer: time up', () => {
  it('a fresh buzzTimeUp in OPEN goes to REVEAL with no points and emits fx buzzTimeUp', () => {
    const room = open();
    const { room: next, effects } = ok(reduce(room, timeUp(room), NOW + 10_000));
    expect(next.phase).toBe('REVEAL');
    expect(next.buzzTimer).toBeNull();
    expect(next.winnerId).toBeNull();
    expect(next.judgements).toEqual(room.judgements);
    expect(Object.values(next.players).map((p) => p.score)).toEqual([100, 0, 0]);
    expect(next.lastActivityAt).toBe(NOW + 10_000);
    expect(effects).toEqual([{ type: 'fx', fx: { kind: 'buzzTimeUp' } }]);
  });

  it('after a reopen, time up keeps the lockouts and the wrong answer’s judgement', () => {
    const room = reopened();
    const next = step(room, timeUp(room), NOW + 60_000);
    expect(next.phase).toBe('REVEAL');
    expect(next.lockedOut).toEqual(['p1']);
    expect(next.judgements).toEqual(room.judgements);
  });

  it('hides the scoreboard overlay, as a reveal does', () => {
    const room = { ...open(), showScoreboard: true };
    expect(step(room, timeUp(room)).showScoreboard).toBe(false);
  });
});

describe('buzz timer: stale buzzTimeUp is ignored', () => {
  it('once the room has moved to another question', () => {
    const room = open();
    const action = timeUp(room);
    const next = step(step(room, { type: 'host:reveal' }), { type: 'host:next' });
    expectStale(next, action);
  });

  it('in COLLECTING, after the first buzz', () => {
    const room = open();
    expectStale(step(room, press('p1')), timeUp(room));
  });

  it('in BUZZED, before and after the judgement', () => {
    const room = open();
    const action = timeUp(room);
    const won = buzzed(room);
    expectStale(won, action);
    expectStale(step(won, wrong), action);
  });

  it('in REVEAL, after a correct answer or the host revealing', () => {
    const room = open();
    const action = timeUp(room);
    expectStale(step(buzzed(room), correct), action);
    expectStale(step(room, { type: 'host:reveal' }), action);
  });

  it('from an earlier opening of the same question, after a reopen', () => {
    const first = open();
    const action = timeUp(first);
    const room = reopened();
    expect(room.buzzTimer).not.toBeNull();
    expectStale(room, action);
  });

  it('whose time is not the running timer’s, or with no timer running', () => {
    const room = open();
    expectStale(room, { ...timeUp(room), at: timeUp(room).at - 1 });
    expectStale({ ...room, buzzTimer: null }, timeUp(room));
  });

  it('in QUESTION after host:prev back and in FINAL', () => {
    const room = { ...open(), questionIndex: 2 };
    const action = timeUp(room);
    expectStale(step(room, { type: 'host:prev' }), action);
    expectStale(step(room, { type: 'host:end' }), action);
  });
});
