import { describe, expect, it } from 'vitest';
import { REOPEN_DELAY_MS } from '../shared/constants.js';
import type { JudgeResult, Phase, Room } from '../shared/types.js';
import { makeBuzz } from './fairness.js';
import {
  WRONG_PHASE_ERROR,
  applyJudgement,
  reduce,
  type Action,
  type ReduceResult,
} from './reducer.js';
import { T0, makePlayer, makeQuestion, makeRoom, makeSet, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

const judge = (result: JudgeResult): Action => ({ type: 'host:judge', result });

/** The `reopen` timer action for `room`'s current question, opening and pending reopen time. */
const reopen = (room: Room): Action => ({
  type: 'reopen',
  questionIndex: room.questionIndex,
  openingCounter: room.openingCounter,
  at: room.reopenAt ?? NOW + REOPEN_DELAY_MS,
});

/**
 * Three connected players on question 2 of 3 (worth 250 points), in BUZZED after the second
 * opening: p1 won, p2 also buzzed, p3 did not buzz.
 */
function buzzed(overrides: Partial<Room> = {}): Room {
  const set = makeSet();
  set.questions[1] = makeQuestion(2, { points: 250 });
  return withPlayers(
    makeRoom({
      set,
      phase: 'BUZZED',
      questionIndex: 1,
      openingCounter: 2,
      buzzes: [makeBuzz('p1', 500, 0), makeBuzz('p2', 520, 0)],
      winnerId: 'p1',
      ...overrides,
    }),
    [
      makePlayer('p1', { joinedAt: T0 + 1, score: 100 }),
      makePlayer('p2', { joinedAt: T0 + 2, score: 200 }),
      makePlayer('p3', { joinedAt: T0 + 3 }),
    ],
  );
}

function withPenalty(room: Room): Room {
  return { ...room, settings: { ...room.settings, wrongPenalty: true } };
}

function disconnect(room: Room, playerId: string): Room {
  const player = room.players[playerId];
  if (!player) throw new Error(`No player ${playerId}`);
  return { ...room, players: { ...room.players, [playerId]: { ...player, connected: false } } };
}

const scores = (room: Room) =>
  Object.fromEntries(Object.values(room.players).map((p) => [p.id, p.score]));

describe('reduce: host:judge is accepted only in BUZZED', () => {
  const others: Phase[] = ['LOBBY', 'QUESTION', 'OPEN', 'COLLECTING', 'REVEAL', 'FINAL'];
  it.each(others)('is rejected in %s', (phase) => {
    for (const result of ['correct', 'half', 'wrong'] as const) {
      expect(reduce(buzzed({ phase }), judge(result), NOW)).toEqual({
        ok: false,
        error: WRONG_PHASE_ERROR,
      });
    }
  });

  it('rejects a second judgement after a correct one', () => {
    const { room } = ok(reduce(buzzed(), judge('correct'), NOW));
    expect(reduce(room, judge('correct'), NOW + 50).ok).toBe(false);
    expect(reduce(room, judge('wrong'), NOW + 50).ok).toBe(false);
  });

  it('rejects a second judgement while the reopen is pending', () => {
    const { room } = ok(reduce(buzzed(), judge('wrong'), NOW));
    expect(room.phase).toBe('BUZZED');
    expect(reduce(room, judge('wrong'), NOW + 50)).toEqual({ ok: false, error: 'Already judged' });
    expect(reduce(room, judge('correct'), NOW + 50)).toEqual({
      ok: false,
      error: 'Already judged',
    });
  });
});

describe('reduce: host:judge correct', () => {
  it("adds the question's points to the winner only", () => {
    const { room } = ok(reduce(buzzed(), judge('correct'), NOW));
    expect(scores(room)).toEqual({ p1: 350, p2: 200, p3: 0 });
  });

  it('moves to REVEAL and keeps the judged winner', () => {
    const { room } = ok(reduce(buzzed(), judge('correct'), NOW));
    expect(room.phase).toBe('REVEAL');
    expect(room.winnerId).toBe('p1');
    expect(room.reopenAt).toBeNull();
  });

  it('emits fx correct with the points and schedules nothing', () => {
    const { effects } = ok(reduce(buzzed(), judge('correct'), NOW));
    expect(effects).toEqual([{ type: 'fx', fx: { kind: 'correct', playerId: 'p1', points: 250 } }]);
  });

  it('records the judgement', () => {
    const { room } = ok(reduce(buzzed(), judge('correct'), NOW));
    expect(room.judgements).toEqual([
      { questionIndex: 1, playerId: 'p1', result: 'correct', pointsDelta: 250 },
    ]);
  });

  it('ignores the wrong-answer penalty setting', () => {
    const { room } = ok(reduce(withPenalty(buzzed()), judge('correct'), NOW));
    expect(room.players.p1?.score).toBe(350);
  });
});

describe('reduce: host:judge half', () => {
  it("adds half the question's points to the winner only", () => {
    const { room } = ok(reduce(buzzed(), judge('half'), NOW));
    expect(scores(room)).toEqual({ p1: 225, p2: 200, p3: 0 });
  });

  it.each([
    [75, 38],
    [1, 1],
    [0, 0],
    [10_000, 5000],
  ])('rounds half of %i points to %i', (points, half) => {
    const room = buzzed();
    room.set.questions[1] = makeQuestion(2, { points });
    const { room: next, effects } = ok(reduce(room, judge('half'), NOW));
    expect(next.players.p1?.score).toBe(100 + half);
    expect(effects).toEqual([
      { type: 'fx', fx: { kind: 'correct', playerId: 'p1', points: half } },
    ]);
  });

  it('moves to REVEAL like correct, keeping the winner and locking nobody out', () => {
    const { room } = ok(reduce(buzzed(), judge('half'), NOW));
    expect(room.phase).toBe('REVEAL');
    expect(room.winnerId).toBe('p1');
    expect(room.lockedOut).toEqual([]);
    expect(room.reopenAt).toBeNull();
  });

  it('emits fx correct with the half points and schedules nothing', () => {
    const { effects } = ok(reduce(buzzed(), judge('half'), NOW));
    expect(effects).toEqual([{ type: 'fx', fx: { kind: 'correct', playerId: 'p1', points: 125 } }]);
  });

  it('records the judgement as half', () => {
    const { room } = ok(reduce(buzzed(), judge('half'), NOW));
    expect(room.judgements).toEqual([
      { questionIndex: 1, playerId: 'p1', result: 'half', pointsDelta: 125 },
    ]);
  });

  it('ignores the wrong-answer penalty setting', () => {
    const { room } = ok(reduce(withPenalty(buzzed()), judge('half'), NOW));
    expect(room.players.p1?.score).toBe(225);
  });

  it('is rejected outside BUZZED and after another judgement', () => {
    expect(reduce(buzzed({ phase: 'OPEN' }), judge('half'), NOW)).toEqual({
      ok: false,
      error: WRONG_PHASE_ERROR,
    });
    const { room } = ok(reduce(buzzed(), judge('wrong'), NOW));
    expect(reduce(room, judge('half'), NOW + 50)).toEqual({ ok: false, error: 'Already judged' });
  });
});

describe('reduce: host:judge wrong with others still eligible', () => {
  it('locks the winner out and leaves scores alone with the penalty off', () => {
    const { room } = ok(reduce(buzzed(), judge('wrong'), NOW));
    expect(room.lockedOut).toEqual(['p1']);
    expect(scores(room)).toEqual({ p1: 100, p2: 200, p3: 0 });
    expect(room.judgements).toEqual([
      { questionIndex: 1, playerId: 'p1', result: 'wrong', pointsDelta: 0 },
    ]);
  });

  it("takes the question's points off the winner with the penalty on", () => {
    const { room } = ok(reduce(withPenalty(buzzed()), judge('wrong'), NOW));
    expect(scores(room)).toEqual({ p1: -150, p2: 200, p3: 0 });
    expect(room.judgements[0]?.pointsDelta).toBe(-250);
  });

  it('lets a score go negative from zero', () => {
    const room = withPenalty(buzzed({ winnerId: 'p3' }));
    expect(ok(reduce(room, judge('wrong'), NOW)).room.players.p3?.score).toBe(-250);
  });

  it('stays in BUZZED, emits fx wrong and schedules reopen at now + 1500 ms', () => {
    const { room, effects } = ok(reduce(buzzed(), judge('wrong'), NOW));
    expect(room.phase).toBe('BUZZED');
    expect(room.reopenAt).toBe(NOW + REOPEN_DELAY_MS);
    expect(effects).toEqual([
      { type: 'fx', fx: { kind: 'wrong', playerId: 'p1' } },
      {
        type: 'schedule',
        at: NOW + 1500,
        action: { type: 'reopen', questionIndex: 1, openingCounter: 2, at: NOW + 1500 },
      },
    ]);
  });

  it('counts a player who joined during this opening as eligible for the next one', () => {
    const base = buzzed({ lockedOut: ['p2'] });
    const room = withPlayers(base, [
      ...Object.values(base.players).filter((p) => p.id !== 'p3'),
      makePlayer('p4', { joinedAt: T0 + 9, joinedAtOpening: 2 }),
    ]);
    const { room: next, effects } = ok(reduce(room, judge('wrong'), NOW));
    expect(next.phase).toBe('BUZZED');
    expect(effects.some((e) => e.type === 'schedule')).toBe(true);
  });
});

describe('reduce: host:judge wrong with nobody left (everyone locked out)', () => {
  it('goes straight to REVEAL when every other player is locked out', () => {
    const { room, effects } = ok(reduce(buzzed({ lockedOut: ['p2', 'p3'] }), judge('wrong'), NOW));
    expect(room.phase).toBe('REVEAL');
    expect(room.lockedOut).toEqual(['p2', 'p3', 'p1']);
    expect(room.reopenAt).toBeNull();
    expect(effects).toEqual([{ type: 'fx', fx: { kind: 'wrong', playerId: 'p1' } }]);
  });

  it('does not count disconnected players as eligible (DECISIONS #9)', () => {
    const room = disconnect(buzzed({ lockedOut: ['p2'] }), 'p3');
    expect(ok(reduce(room, judge('wrong'), NOW)).room.phase).toBe('REVEAL');
  });

  it('still applies the penalty on the way to REVEAL', () => {
    const room = withPenalty(buzzed({ lockedOut: ['p2', 'p3'] }));
    expect(ok(reduce(room, judge('wrong'), NOW)).room.players.p1?.score).toBe(-150);
  });

  it('goes to REVEAL when the winner is the only player', () => {
    const base = buzzed();
    const room = withPlayers(base, [base.players.p1!]);
    expect(ok(reduce(room, judge('wrong'), NOW)).room.phase).toBe('REVEAL');
  });
});

describe('reduce: a disconnected winner can be judged', () => {
  it('scores a correct answer', () => {
    const { room } = ok(reduce(disconnect(buzzed(), 'p1'), judge('correct'), NOW));
    expect(room.players.p1?.score).toBe(350);
    expect(room.phase).toBe('REVEAL');
  });

  it('locks out and reopens on a wrong answer', () => {
    const { room } = ok(reduce(disconnect(buzzed(), 'p1'), judge('wrong'), NOW));
    expect(room.lockedOut).toEqual(['p1']);
    expect(room.reopenAt).toBe(NOW + REOPEN_DELAY_MS);
  });
});

describe('reduce: reopen', () => {
  function pending(): Room {
    return ok(reduce(buzzed(), judge('wrong'), NOW)).room;
  }

  it('opens a new opening for the others, keeping the lockout', () => {
    const room = pending();
    const { room: next, effects } = ok(reduce(room, reopen(room), NOW + REOPEN_DELAY_MS));
    expect(next).toMatchObject({
      phase: 'OPEN',
      openingCounter: 3,
      buzzes: [],
      winnerId: null,
      reopenAt: null,
      lockedOut: ['p1'],
    });
    expect(effects).toEqual([]);
  });

  it('ignores a buzz from the locked-out player and counts one from another', () => {
    const room = pending();
    const opened = ok(reduce(room, reopen(room), NOW + REOPEN_DELAY_MS)).room;
    expect(ok(reduce(opened, press('p1'), NOW + 1600)).room).toBe(opened);
    expect(ok(reduce(opened, press('p2'), NOW + 1600)).room.phase).toBe('COLLECTING');
  });

  it('is a no-op after the host reveals during the wait', () => {
    const room = pending();
    const revealed = ok(reduce(room, { type: 'host:reveal' }, NOW + 100)).room;
    expect(revealed.reopenAt).toBeNull();
    expect(ok(reduce(revealed, reopen(room), NOW + REOPEN_DELAY_MS)).room).toBe(revealed);
  });

  it('is a no-op after the host moves to another question', () => {
    const room = pending();
    const revealed = ok(reduce(room, { type: 'host:reveal' }, NOW + 100)).room;
    const next = ok(reduce(revealed, { type: 'host:next' }, NOW + 200)).room;
    expect(next.reopenAt).toBeNull();
    expect(ok(reduce(next, reopen(room), NOW + REOPEN_DELAY_MS)).room).toBe(next);
  });

  it('is a no-op after the host goes back a question', () => {
    const room = pending();
    const back = ok(reduce(room, { type: 'host:prev' }, NOW + 100)).room;
    expect(back.reopenAt).toBeNull();
    expect(ok(reduce(back, reopen(room), NOW + REOPEN_DELAY_MS)).room).toBe(back);
  });

  it('is a no-op after the host ends the game', () => {
    const room = pending();
    const ended = ok(reduce(room, { type: 'host:end' }, NOW + 100)).room;
    expect(ok(reduce(ended, reopen(room), NOW + REOPEN_DELAY_MS)).room).toBe(ended);
  });

  it('is a no-op for another question index, opening or reopen time', () => {
    const room = pending();
    for (const stale of [
      { type: 'reopen', questionIndex: 0, openingCounter: 2, at: NOW + REOPEN_DELAY_MS },
      { type: 'reopen', questionIndex: 1, openingCounter: 1, at: NOW + REOPEN_DELAY_MS },
      { type: 'reopen', questionIndex: 1, openingCounter: 2, at: NOW + 1 },
    ] as const) {
      expect(ok(reduce(room, stale, NOW + REOPEN_DELAY_MS)).room).toBe(room);
    }
  });

  it('is a no-op in BUZZED with no reopen pending', () => {
    const room = buzzed();
    expect(ok(reduce(room, reopen(room), NOW)).room).toBe(room);
  });
});

describe('applyJudgement: the one place scores change', () => {
  it('adds the delta to the player, records the judgement and locks out on wrong', () => {
    const room = applyJudgement(buzzed(), 'p2', 'wrong', -250);
    expect(scores(room)).toEqual({ p1: 100, p2: -50, p3: 0 });
    expect(room.lockedOut).toEqual(['p2']);
    expect(room.judgements).toEqual([
      { questionIndex: 1, playerId: 'p2', result: 'wrong', pointsDelta: -250 },
    ]);
  });

  it('does not lock out on correct, and does not mutate the room', () => {
    const before = buzzed();
    const snapshot = JSON.stringify(before);
    const room = applyJudgement(before, 'p1', 'correct', 250);
    expect(room.lockedOut).toEqual([]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

function press(playerId: string): Action {
  return { type: 'player:buzz', playerId, receivedAt: 2000 };
}
