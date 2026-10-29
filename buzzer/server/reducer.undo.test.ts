import { describe, expect, it } from 'vitest';
import { REOPEN_DELAY_MS } from '../shared/constants.js';
import type { JudgeResult, Phase, Room } from '../shared/types.js';
import { makeBuzz } from './fairness.js';
import { WRONG_PHASE_ERROR, reduce, type Action, type ReduceResult } from './reducer.js';
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

describe('reduce: host:undo is one level per question', () => {
  it('rejects a second undo of the same question', () => {
    const undone = step(step(buzzed(), judge('correct')), UNDO);
    expect(reduce(undone, UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
  });

  it('undoes only the newest of two wrong answers', () => {
    const first = step(buzzed(), judge('wrong'));
    const opened = step(first, reopen(first), NOW + REOPEN_DELAY_MS);
    const rebuzzed = step(
      step(opened, { type: 'player:buzz', playerId: 'p2', receivedAt: 3000 }, NOW + 1600),
      { type: 'windowClosed', questionIndex: 1, openingCounter: 3 },
      NOW + 1750,
    );
    const second = step(rebuzzed, judge('wrong'), NOW + 1800);
    expect(second.lockedOut).toEqual(['p1', 'p2']);

    const room = step(second, UNDO, NOW + 1900);
    expect(room).toMatchObject({ phase: 'BUZZED', winnerId: 'p2', lockedOut: ['p1'] });
    expect(room.judgements.map((j) => j.playerId)).toEqual(['p2', 'p1']);
    expect(reduce(room, UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
  });

  it('allows a fresh undo after the host judges again', () => {
    const undone = step(step(buzzed(), judge('correct')), UNDO);
    const rejudged = step(undone, judge('wrong'));
    expect(step(rejudged, UNDO)).toMatchObject({ phase: 'BUZZED', lockedOut: [], reopenAt: null });
  });

  it('rejects an undo before any judgement of this question', () => {
    expect(reduce(buzzed(), UNDO, NOW)).toEqual({ ok: false, error: 'Nothing to undo' });
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
