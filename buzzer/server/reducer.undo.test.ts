import { describe, expect, it } from 'vitest';
import { REOPEN_DELAY_MS } from '../shared/constants.js';
import type { JudgeResult, Phase, Room } from '../shared/types.js';
import { makeBuzz } from './fairness.js';
import { WRONG_PHASE_ERROR, canUndo, reduce, type Action, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeQuestion, makeRoom, makeSet, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

function step(room: Room, action: Action, now = NOW): Room {
  return ok(reduce(room, action, now)).room;
}

const NOW = T0 + 10_000;
const UNDO: Action = { type: 'host:undo' };

const judge = (result: JudgeResult): Action => ({ type: 'host:judge', result });

/** The `reopen` timer action the last wrong judgement scheduled for `room`. */
function reopen(room: Room): Action {
  if (room.reopenAt === null) throw new Error('No reopen pending');
  return {
    type: 'reopen',
    questionIndex: room.questionIndex,
    openingCounter: room.openingCounter,
    at: room.reopenAt,
  };
}

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
      judgements: [{ questionIndex: 0, playerId: 'p2', result: 'correct', pointsDelta: 100 }],
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

/** `room` as undo must restore it: the activity stamp is the only field allowed to differ. */
const restorable = (room: Room) => ({ ...room, lastActivityAt: expect.any(Number) as number });

describe('reduce: host:undo restores the state right after the judged buzz', () => {
  it('reverses a correct answer from REVEAL', () => {
    const before = buzzed();
    const revealed = step(before, judge('correct'));
    expect(revealed.phase).toBe('REVEAL');

    const { room, effects } = ok(reduce(revealed, UNDO, NOW + 100));
    expect(room).toEqual(restorable(before));
    expect(room.lastActivityAt).toBe(NOW + 100);
    expect(effects).toEqual([]);
  });

  it('reverses a half-points answer from REVEAL', () => {
    const before = buzzed();
    const revealed = step(before, judge('half'));
    expect(revealed.players.p1?.score).toBe(225);

    const { room, effects } = ok(reduce(revealed, UNDO, NOW + 100));
    expect(room).toEqual(restorable(before));
    expect(effects).toEqual([]);
  });

  it('lets the host judge half again after undoing a correct answer', () => {
    const undone = step(step(buzzed(), judge('correct')), UNDO);
    const room = step(undone, judge('half'));
    expect(room.players.p1?.score).toBe(225);
    expect(room.judgements.at(-1)).toEqual({
      questionIndex: 1,
      playerId: 'p1',
      result: 'half',
      pointsDelta: 125,
    });
  });

  it('reverses a wrong answer with the penalty during the wait before the reopen', () => {
    const before = withPenalty(buzzed());
    const waiting = step(before, judge('wrong'));
    expect(waiting.players.p1?.score).toBe(-150);

    expect(step(waiting, UNDO, NOW + 100)).toEqual(restorable(before));
  });

  it('reverses a wrong answer after the reopen, discarding the newer opening', () => {
    const before = withPenalty(buzzed());
    const waiting = step(before, judge('wrong'));
    const opened = step(waiting, reopen(waiting), NOW + REOPEN_DELAY_MS);
    const collecting = step(
      opened,
      { type: 'player:buzz', playerId: 'p3', receivedAt: 3000 },
      NOW + 1600,
    );
    expect(collecting).toMatchObject({ phase: 'COLLECTING', openingCounter: 3 });

    const room = step(collecting, UNDO, NOW + 1700);
    // The counter only grows, so the newer opening's timers stay stale (DECISIONS F20).
    expect(room).toEqual({ ...restorable(before), openingCounter: 3 });
  });

  it('reverses the last wrong answer when nobody was left, from REVEAL', () => {
    const before = withPenalty(buzzed({ lockedOut: ['p2', 'p3'] }));
    const revealed = step(before, judge('wrong'));
    expect(revealed.phase).toBe('REVEAL');

    expect(step(revealed, UNDO)).toEqual(restorable(before));
  });

  it('works from OPEN and BUZZED of a later opening too', () => {
    const waiting = step(buzzed(), judge('wrong'));
    const opened = step(waiting, reopen(waiting), NOW + REOPEN_DELAY_MS);
    expect(step(opened, UNDO, NOW + 1600)).toMatchObject({ phase: 'BUZZED', winnerId: 'p1' });

    const rebuzzed = step(
      step(opened, { type: 'player:buzz', playerId: 'p2', receivedAt: 3000 }, NOW + 1600),
      { type: 'windowClosed', questionIndex: 1, openingCounter: 3 },
      NOW + 1750,
    );
    expect(rebuzzed).toMatchObject({ phase: 'BUZZED', winnerId: 'p2' });
    expect(step(rebuzzed, UNDO, NOW + 1800)).toMatchObject({
      phase: 'BUZZED',
      winnerId: 'p1',
      buzzes: buzzed().buzzes,
      lockedOut: [],
    });
  });

  it('keeps a manual score adjustment made after the judgement', () => {
    const revealed = step(buzzed(), judge('correct'));
    const adjusted = step(revealed, { type: 'host:adjustScore', playerId: 'p1', delta: 50 });
    expect(adjusted.players.p1?.score).toBe(400);
    expect(step(adjusted, UNDO).players.p1?.score).toBe(150);
  });
});

/** The buzz and closed window that make `playerId` the winner of the opening `room` is in. */
function buzzIn(room: Room, playerId: string, now: number): Room {
  const buzzing = step(room, { type: 'player:buzz', playerId, receivedAt: now - T0 }, now);
  const { questionIndex, openingCounter } = buzzing;
  return step(buzzing, { type: 'windowClosed', questionIndex, openingCounter }, now + 150);
}

/**
 * Question 2 with the penalty on and a fourth player: p1, p2 and p3 are judged wrong in turn,
 * each after their own opening, then p4 correct. `before[i]` is the room right before judgement
 * i, `waiting[i]` right after wrong judgement i, and `revealed` the end.
 */
function threeWrongThenCorrect() {
  const first = withPenalty(buzzed());
  const start: Room = {
    ...first,
    players: { ...first.players, p4: makePlayer('p4', { joinedAt: T0 + 4 }) },
  };
  const before: Room[] = [start];
  const waiting: Room[] = [];
  let room = start;
  ['p2', 'p3', 'p4'].forEach((next, i) => {
    const at = NOW + i * 10_000;
    const judged = step(room, judge('wrong'), at);
    waiting.push(judged);
    room = buzzIn(step(judged, reopen(judged), at + REOPEN_DELAY_MS), next, at + 2000);
    before.push(room);
  });
  const revealed = step(room, judge('correct'), NOW + 40_000);
  return { before, waiting, revealed };
}

describe('reduce: host:undo walks back every judgement of the question', () => {
  it('undoes three wrong answers and a correct one, newest first, each state exact', () => {
    const { before, revealed } = threeWrongThenCorrect();
    expect(revealed).toMatchObject({ phase: 'REVEAL', lockedOut: ['p1', 'p2', 'p3'] });
    expect(revealed.undo.map((u) => u.winnerId)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(revealed.players.p4?.score).toBe(250);
    // The penalty took 250 from each wrong answer.
    expect([1, 2, 3].map((n) => revealed.players[`p${n}`]?.score)).toEqual([-150, -50, -250]);

    let room = revealed;
    for (let i = 3; i >= 0; i--) {
      expect(canUndo(room)).toBe(true);
      room = step(room, UNDO, NOW + 50_000 + i);
      // The counter only grows, so the discarded openings' timers stay stale (DECISIONS F20).
      expect(room).toEqual({ ...restorable(before[i] as Room), openingCounter: 5 });
    }
    expect(canUndo(room)).toBe(false);
    expect(room.undo).toEqual([]);
    expect(reduce(room, UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
  });

  it('ignores every undone reopen while walking back', () => {
    const { waiting, revealed } = threeWrongThenCorrect();
    const reopens = waiting.map(reopen);
    let room = revealed;
    for (let i = 0; i < 4; i++) {
      room = step(room, UNDO, NOW + 50_000 + i);
      for (const [n, action] of reopens.entries()) {
        expect(step(room, action, NOW + 60_000 + n)).toBe(room);
      }
    }
  });

  it('walks back from the wait before a reopen, one wrong answer at a time', () => {
    const { before, waiting } = threeWrongThenCorrect();
    const back = step(waiting[2] as Room, UNDO, NOW + 50_000);
    expect(back).toEqual({ ...restorable(before[2] as Room), openingCounter: 4 });
    expect(step(back, reopen(waiting[2] as Room), NOW + 60_000)).toBe(back);
    expect(step(back, UNDO, NOW + 50_001)).toMatchObject({
      phase: 'BUZZED',
      winnerId: 'p2',
      lockedOut: ['p1'],
    });
  });

  it('takes back a judgement made again after an undo, then the older ones', () => {
    const { revealed } = threeWrongThenCorrect();
    const rejudged = step(step(revealed, UNDO), judge('half'));
    expect(rejudged.undo.map((u) => u.winnerId)).toEqual(['p1', 'p2', 'p3', 'p4']);
    const room = step(step(rejudged, UNDO), UNDO);
    expect(room).toMatchObject({ phase: 'BUZZED', winnerId: 'p3', lockedOut: ['p1', 'p2'] });
    expect(room.players.p4?.score).toBe(0);
    expect(room.players.p3?.score).toBe(0);
  });

  it('keeps a single judgement to one undo', () => {
    const undone = step(step(buzzed(), judge('correct')), UNDO);
    expect(reduce(undone, UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
  });

  it('allows a fresh undo after the host judges again', () => {
    const undone = step(step(buzzed(), judge('correct')), UNDO);
    const rejudged = step(undone, judge('wrong'));
    expect(step(rejudged, UNDO)).toMatchObject({ phase: 'BUZZED', lockedOut: [], reopenAt: null });
  });

  it('rejects an undo before any judgement of this question', () => {
    expect(reduce(buzzed(), UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
  });
});

describe('reduce: the undo stack clears when the question changes', () => {
  it.each<[string, Action]>([
    ['next', { type: 'host:next' }],
    ['prev', { type: 'host:prev' }],
    ['end', { type: 'host:end' }],
  ])('empties a stack of four on %s', (_, action) => {
    const { revealed } = threeWrongThenCorrect();
    const room = step(revealed, action);
    expect(room.undo).toEqual([]);
    expect(canUndo(room)).toBe(false);
  });

  it('empties it on new game', () => {
    // A FINAL room still holding the stack, so new game clears it whatever end did.
    const final: Room = { ...threeWrongThenCorrect().revealed, phase: 'FINAL' };
    const newGame: Action = { type: 'host:newGame', set: makeSet(), keepScores: true };
    expect(step(final, newGame).undo).toEqual([]);
  });

  it('cannot reach a judgement of an earlier question after next or prev', () => {
    const revealed = step(buzzed(), judge('correct'));
    const next = step(revealed, { type: 'host:next' });
    const opened = step(next, { type: 'host:open' });
    expect(reduce(opened, UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });

    const back = step(opened, { type: 'host:prev' });
    const reopened = step(back, { type: 'host:open' });
    expect(reduce(reopened, UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
  });
});

describe('reduce: host:undo after a kick', () => {
  const kick = (playerId: string): Action => ({ type: 'host:kick', playerId });

  it('stops short of the kicked player’s judgement, which stays in the history', () => {
    const { revealed } = threeWrongThenCorrect();
    const kicked = step(revealed, kick('p2'));
    expect(kicked.undo.map((u) => u.winnerId)).toEqual(['p3', 'p4']);
    const room = step(step(kicked, UNDO), UNDO);
    expect(room).toMatchObject({ phase: 'BUZZED', winnerId: 'p3', lockedOut: ['p1'] });
    expect(room.judgements.at(-1)).toMatchObject({ playerId: 'p2', result: 'wrong' });
    expect(reduce(room, UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
  });

  it('keeps the newer points without the kicked player’s buzz', () => {
    const { revealed } = threeWrongThenCorrect();
    const kicked = step(revealed, kick('p1'));
    expect(kicked.undo.map((u) => u.winnerId)).toEqual(['p2', 'p3', 'p4']);
    const room = step(step(step(kicked, UNDO), UNDO), UNDO);
    expect(room).toMatchObject({ phase: 'BUZZED', winnerId: 'p2', lockedOut: [] });
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p2']);
    expect(reduce(room, UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
  });
});

describe('reduce: host:undo phase guard', () => {
  const rejected: Phase[] = ['LOBBY', 'QUESTION', 'FINAL'];
  it.each(rejected)('is rejected in %s', (phase) => {
    const judged = step(buzzed(), judge('correct'));
    expect(reduce({ ...judged, phase }, UNDO, NOW)).toEqual({
      ok: false,
      error: WRONG_PHASE_ERROR,
    });
  });

  it('is rejected after the host ends the game', () => {
    const ended = step(step(buzzed(), judge('correct')), { type: 'host:end' });
    expect(reduce(ended, UNDO, NOW)).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
  });

  it('is allowed in COLLECTING of a later opening', () => {
    const waiting = step(buzzed(), judge('wrong'));
    const opened = step(waiting, reopen(waiting), NOW + REOPEN_DELAY_MS);
    const collecting = step(
      opened,
      { type: 'player:buzz', playerId: 'p2', receivedAt: 3000 },
      NOW + 1600,
    );
    expect(step(collecting, UNDO, NOW + 1650)).toMatchObject({ phase: 'BUZZED', winnerId: 'p1' });
  });
});

describe('reduce: timers after an undo', () => {
  it('ignores the undone reopen when the host judges wrong again', () => {
    const first = step(buzzed(), judge('wrong'));
    const undone = step(first, UNDO, NOW + 100);
    const second = step(undone, judge('wrong'), NOW + 200);
    expect(second.reopenAt).toBe(NOW + 200 + REOPEN_DELAY_MS);

    // The first reopen fires 200 ms early for the second judgement and must change nothing.
    expect(step(second, reopen(first), NOW + REOPEN_DELAY_MS)).toBe(second);
    expect(step(second, reopen(second), NOW + 200 + REOPEN_DELAY_MS).phase).toBe('OPEN');
  });

  it('ignores the undone reopen once the host judges correct instead', () => {
    const first = step(buzzed(), judge('wrong'));
    const corrected = step(step(first, UNDO, NOW + 100), judge('correct'), NOW + 200);
    expect(step(corrected, reopen(first), NOW + REOPEN_DELAY_MS)).toBe(corrected);
  });

  it('ignores the discarded opening window after an undo from COLLECTING', () => {
    const waiting = step(buzzed(), judge('wrong'));
    const opened = step(waiting, reopen(waiting), NOW + REOPEN_DELAY_MS);
    const collecting = step(
      opened,
      { type: 'player:buzz', playerId: 'p2', receivedAt: 3000 },
      NOW + 1600,
    );
    const undone = step(collecting, UNDO, NOW + 1650);
    const window: Action = { type: 'windowClosed', questionIndex: 1, openingCounter: 3 };
    expect(step(undone, window, NOW + 1750)).toBe(undone);
  });
});
