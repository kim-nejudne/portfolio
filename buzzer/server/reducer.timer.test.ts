import { describe, expect, it } from 'vitest';
import { ANSWER_SECONDS_CHOICES, DEFAULT_SETTINGS } from '../shared/constants.js';
import type { AnswerSeconds, JudgeResult, Room } from '../shared/types.js';
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

const judge = (result: JudgeResult): Action => ({ type: 'host:judge', result });
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

/** The `answerTimeUp` action for `room`'s running timer, as the gateway would dispatch it. */
function timeUp(room: Room): Extract<Action, { type: 'answerTimeUp' }> {
  if (!room.answerTimer) throw new Error('No answer timer running');
  return {
    type: 'answerTimeUp',
    questionIndex: room.questionIndex,
    openingCounter: room.openingCounter,
    at: room.answerTimer.endsAt,
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

/** Three connected players on question 2 of 3, buzzers open for the second time. */
function open(answerSeconds: AnswerSeconds = 5): Room {
  return withPlayers(
    makeRoom({
      settings: { ...DEFAULT_SETTINGS, answerSeconds },
      phase: 'OPEN',
      questionIndex: 1,
      openingCounter: 2,
    }),
    [
      makePlayer('p1', { joinedAt: T0 + 1 }),
      makePlayer('p2', { joinedAt: T0 + 2 }),
      makePlayer('p3', { joinedAt: T0 + 3 }),
    ],
  );
}

/** p1 buzzes and the window closes at `NOW`: the result of entering BUZZED. */
function enterBuzzed(room: Room, playerId = 'p1'): { room: Room; effects: Effect[] } {
  const collecting = step(room, press(playerId), NOW - 150);
  return ok(reduce(collecting, windowClosed(collecting), NOW));
}

/** BUZZED with p1's answer timer running (5 s unless given). */
function buzzed(answerSeconds: AnswerSeconds = 5): Room {
  return enterBuzzed(open(answerSeconds)).room;
}

/** Asserts that `action` is ignored as stale: the same room object, no effects. */
function expectStale(room: Room, action: Action): void {
  const result = ok(reduce(room, action, NOW + 60_000));
  expect(result.room).toBe(room);
  expect(result.effects).toEqual([]);
}

describe('answer timer: entering BUZZED', () => {
  it('starts the winner’s timer and schedules answerTimeUp with index, counter and at', () => {
    const { room, effects } = enterBuzzed(open(5));
    const at = NOW + 5000;
    expect(room.phase).toBe('BUZZED');
    expect(room.answerTimer).toEqual({ seconds: 5, endsAt: at, up: false });
    expect(effects).toContainEqual({
      type: 'schedule',
      at,
      action: { type: 'answerTimeUp', questionIndex: 1, openingCounter: 2, at },
    });
    expect(effects).toContainEqual(expect.objectContaining({ type: 'fx' }));
  });

  it.each(ANSWER_SECONDS_CHOICES.filter((s) => s > 0))(
    'a %i s setting ends that many seconds later',
    (seconds) => {
      expect(buzzed(seconds).answerTimer).toEqual({
        seconds,
        endsAt: NOW + seconds * 1000,
        up: false,
      });
    },
  );

  it('starts no timer and schedules nothing when the answer time is off', () => {
    const { room, effects } = enterBuzzed(open(0));
    expect(room.phase).toBe('BUZZED');
    expect(room.answerTimer).toBeNull();
    expect(effects).toEqual([{ type: 'fx', fx: expect.objectContaining({ kind: 'buzz' }) }]);
  });

  it('starts no timer during the collection window', () => {
    expect(step(open(5), press('p1')).answerTimer).toBeNull();
  });
});

describe('answer timer: time up', () => {
  it('marks the timer up and emits fx timeUp for the winner', () => {
    const room = buzzed();
    const { room: after, effects } = ok(reduce(room, timeUp(room), NOW + 5000));
    expect(after.answerTimer).toEqual({ seconds: 5, endsAt: NOW + 5000, up: true });
    expect(effects).toEqual([{ type: 'fx', fx: { kind: 'timeUp', playerId: 'p1' } }]);
  });

  it('judges nothing: same phase, winner, scores, lockouts and judgements', () => {
    const room = buzzed();
    const after = step(room, timeUp(room), NOW + 5000);
    expect(after.phase).toBe('BUZZED');
    expect(after.winnerId).toBe('p1');
    expect(after.players).toEqual(room.players);
    expect(after.lockedOut).toEqual([]);
    expect(after.judgements).toEqual([]);
  });

  it.each(['correct', 'wrong'] as const)(
    'the host can still judge %s after time is up',
    (result) => {
      const room = buzzed();
      const up = step(room, timeUp(room), NOW + 5000);
      const judged = step(up, judge(result), NOW + 6000);
      expect(judged.judgements).toEqual([expect.objectContaining({ playerId: 'p1', result })]);
      expect(judged.answerTimer).toBeNull();
    },
  );
});

describe('answer timer: cleared, and a stale answerTimeUp ignored', () => {
  it.each(['correct', 'wrong'] as const)('a %s judgement clears it', (result) => {
    const room = buzzed();
    const judged = step(room, judge(result));
    expect(judged.answerTimer).toBeNull();
    expectStale(judged, timeUp(room));
  });

  it('a last wrong answer that goes to REVEAL clears it', () => {
    const room = step(buzzed(), { type: 'host:kick', playerId: 'p3' });
    const lone = step(room, { type: 'host:kick', playerId: 'p2' });
    const judged = step(lone, judge('wrong'));
    expect(judged.phase).toBe('REVEAL');
    expect(judged.answerTimer).toBeNull();
    expectStale(judged, timeUp(lone));
  });

  it('is stale while a reopen is pending and after the reopen', () => {
    const room = buzzed();
    const waiting = step(room, judge('wrong'));
    expectStale(waiting, timeUp(room));
    const reopened = step(waiting, reopen(waiting));
    expect(reopened.phase).toBe('OPEN');
    expect(reopened.answerTimer).toBeNull();
    expectStale(reopened, timeUp(room));
  });

  it('the next buzz after a reopen gets a fresh timer; the old one stays stale', () => {
    const room = buzzed();
    const waiting = step(room, judge('wrong'));
    const reopened = step(waiting, reopen(waiting), NOW + 1500);
    const second = enterBuzzed(reopened, 'p2').room;
    expect(second.answerTimer).toEqual({ seconds: 5, endsAt: NOW + 5000, up: false });
    expect(second.openingCounter).toBe(3);
    expectStale(second, timeUp(room));
    expect(step(second, timeUp(second)).answerTimer?.up).toBe(true);
  });

  it('host:reveal clears it', () => {
    const room = buzzed();
    const revealed = step(room, { type: 'host:reveal' });
    expect(revealed.answerTimer).toBeNull();
    expectStale(revealed, timeUp(room));
  });

  it('kicking the winner clears it', () => {
    const room = buzzed();
    const kicked = step(room, { type: 'host:kick', playerId: 'p1' });
    expect(kicked.phase).toBe('OPEN');
    expect(kicked.answerTimer).toBeNull();
    expectStale(kicked, timeUp(room));
  });

  it('kicking the winner when nobody else is eligible clears it', () => {
    const room = step(step(buzzed(), { type: 'host:kick', playerId: 'p2' }), {
      type: 'host:kick',
      playerId: 'p3',
    });
    const kicked = step(room, { type: 'host:kick', playerId: 'p1' });
    expect(kicked.phase).toBe('REVEAL');
    expect(kicked.answerTimer).toBeNull();
    expectStale(kicked, timeUp(room));
  });

  it('kicking another player keeps it running', () => {
    const room = buzzed();
    const kicked = step(room, { type: 'host:kick', playerId: 'p2' });
    expect(kicked.answerTimer).toEqual(room.answerTimer);
    expect(step(kicked, timeUp(room)).answerTimer?.up).toBe(true);
  });

  it('the winner disconnecting keeps it running', () => {
    const room = buzzed();
    const gone = step(room, { type: 'player:disconnect', playerId: 'p1' });
    expect(step(gone, timeUp(room)).answerTimer?.up).toBe(true);
  });

  it.each([
    ['host:next', (r: Room) => step(step(r, judge('correct')), { type: 'host:next' })],
    ['host:prev', (r: Room) => step(r, { type: 'host:prev' })],
    ['host:end', (r: Room) => step(r, { type: 'host:end' })],
  ])('%s clears it', (_, move) => {
    const room = buzzed();
    const moved = move(room);
    expect(moved.answerTimer).toBeNull();
    expectStale(moved, timeUp(room));
  });

  it('undo clears it and returns to BUZZED without a timer', () => {
    const room = buzzed();
    const undone = step(step(room, judge('correct')), { type: 'host:undo' });
    expect(undone.phase).toBe('BUZZED');
    expect(undone.winnerId).toBe('p1');
    expect(undone.answerTimer).toBeNull();
    expectStale(undone, timeUp(room));
  });

  it('is stale after undo then wrong again (same index and counter)', () => {
    const room = buzzed();
    const wrong = step(room, judge('wrong'));
    const undone = step(wrong, { type: 'host:undo' });
    const again = step(undone, judge('wrong'));
    expect(again.questionIndex).toBe(room.questionIndex);
    expect(again.openingCounter).toBe(room.openingCounter);
    expectStale(undone, timeUp(room));
    expectStale(again, timeUp(room));
  });

  it('is stale when `at` does not match the running timer', () => {
    const room = buzzed();
    const action = timeUp(room);
    expectStale(room, { ...action, at: action.at + 1 });
  });

  it('is stale for another question index or opening counter', () => {
    const room = buzzed();
    const action = timeUp(room);
    expectStale(room, { ...action, questionIndex: action.questionIndex + 1 });
    expectStale(room, { ...action, openingCounter: action.openingCounter - 1 });
  });

  it('fires once: a repeat after time is up is ignored', () => {
    const room = buzzed();
    const up = step(room, timeUp(room));
    expectStale(up, timeUp(room));
  });
});

describe('answer timer: settings change mid-countdown', () => {
  it('leaves the running timer alone and applies from the next buzz', () => {
    const room = buzzed(5);
    const { room: changed, effects } = ok(
      reduce(room, { type: 'host:settings', settings: { answerSeconds: 10 } }, NOW + 1000),
    );
    expect(effects).toEqual([]);
    expect(changed.answerTimer).toEqual(room.answerTimer);
    expect(step(changed, timeUp(room)).answerTimer?.up).toBe(true);

    const waiting = step(changed, judge('wrong'));
    const next = enterBuzzed(step(waiting, reopen(waiting)), 'p2').room;
    expect(next.answerTimer).toEqual({ seconds: 10, endsAt: NOW + 10_000, up: false });
  });

  it('turning it off lets the running timer finish and starts none on the next buzz', () => {
    const room = buzzed(5);
    const off = step(room, { type: 'host:settings', settings: { answerSeconds: 0 } });
    expect(step(off, timeUp(room)).answerTimer?.up).toBe(true);

    const waiting = step(off, judge('wrong'));
    const { room: next, effects } = enterBuzzed(step(waiting, reopen(waiting)), 'p2');
    expect(next.answerTimer).toBeNull();
    expect(effects.some((e) => e.type === 'schedule')).toBe(false);
  });
});
