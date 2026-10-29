import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Room, RoomSettings } from '../shared/types.js';
import {
  ANSWERS_CLOSED_ERROR,
  canUndo,
  NOT_TYPED_ERROR,
  PICK_CHOICE_ERROR,
  reduce,
  TYPE_ANSWER_ERROR,
  WRONG_PHASE_ERROR,
  type Action,
  type ReduceResult,
} from './reducer.js';
import { T0, makePlayer, makeQuestion, makeRoom, makeSet, withPlayers } from './test/rooms.js';
import { acceptedKeys, normaliseAnswer, typedGroups } from './typed.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

function step(room: Room, action: Action, now = NOW): Room {
  return ok(reduce(room, action, now)).room;
}

const typedAnswer = (playerId: string, text: string): Action => ({
  type: 'player:answer',
  playerId,
  text,
});

const mark = (...groups: string[]): Action => ({ type: 'host:markTyped', groups });

/** The `answeringClosed` action for `room`'s running answer timer, as the gateway would dispatch it. */
function timeUp(room: Room): Extract<Action, { type: 'answeringClosed' }> {
  if (!room.answeringTimer) throw new Error('No answer timer running');
  return {
    type: 'answeringClosed',
    questionIndex: room.questionIndex,
    openingCounter: room.openingCounter,
    at: room.answeringTimer.endsAt,
  };
}

/**
 * Question 2 of 3 is typed (Beyoncé, alternative "Queen B", 200 points); question 3 is a choice
 * question; question 1 is a buzz question.
 */
function typedSet() {
  const set = makeSet(3);
  set.questions[1] = makeQuestion(2, {
    mode: 'typed',
    answer: 'Beyoncé',
    hostNotes: 'Queen B\n\n  beyonce knowles  ',
    points: 200,
  });
  set.questions[2] = makeQuestion(3, {
    mode: 'choice',
    choices: ['Paris', 'Lyon'],
    correctChoice: 0,
    answer: 'Paris',
  });
  return set;
}

/** Three connected players on the typed question, shown and not yet open. */
function question(settings: Partial<RoomSettings> = {}): Room {
  return withPlayers(
    makeRoom({
      set: typedSet(),
      settings: { ...DEFAULT_SETTINGS, ...settings },
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

/** The typed question taking answers, opened at `NOW`. */
function answering(settings: Partial<RoomSettings> = {}): Room {
  return step(question(settings), { type: 'host:open' });
}

/** Answers in order; any that closes the question still leaves it in ANSWERING. */
function answered(room: Room, answers: Record<string, string>): Room {
  return Object.entries(answers).reduce((r, [id, text]) => step(r, typedAnswer(id, text)), room);
}

const scores = (room: Room) =>
  Object.fromEntries(Object.values(room.players).map((p) => [p.id, p.score]));

const verdicts = (room: Room) =>
  Object.fromEntries(typedGroups(room).map((g) => [g.key, g.correct]));

describe('normaliseAnswer', () => {
  it('ignores case, accents and spacing', () => {
    expect(normaliseAnswer('  Beyoncé ')).toBe('beyonce');
    expect(normaliseAnswer('BEYONCE')).toBe('beyonce');
    expect(normaliseAnswer('São   Paulo')).toBe('sao paulo');
    expect(normaliseAnswer('Zoë\tKravitz')).toBe('zoe kravitz');
  });

  it('keeps punctuation and inner spaces apart', () => {
    expect(normaliseAnswer('Spider-Man')).not.toBe(normaliseAnswer('Spider Man'));
    expect(normaliseAnswer('new york')).not.toBe(normaliseAnswer('newyork'));
  });

  it('accepts the answer and each non-blank line of the host notes', () => {
    expect([...acceptedKeys(typedSet().questions[1]!)]).toEqual([
      'beyonce',
      'queen b',
      'beyonce knowles',
    ]);
  });
});

describe('host:open on a typed question', () => {
  it('goes QUESTION → ANSWERING as a new opening with no answers', () => {
    const room = answering();
    expect(room.phase).toBe('ANSWERING');
    expect(room.openingCounter).toBe(2);
    expect(room.typed).toEqual({ answers: {}, marks: {}, closed: false });
    expect(room.buzzTimer).toBeNull();
  });

  it('schedules answeringClosed after choiceSeconds', () => {
    const result = ok(reduce(question({ choiceSeconds: 15 }), { type: 'host:open' }, NOW));
    const at = NOW + 15_000;
    expect(result.room.answeringTimer).toEqual({ seconds: 15, endsAt: at });
    expect(result.effects).toEqual([
      {
        type: 'schedule',
        at,
        action: { type: 'answeringClosed', questionIndex: 1, openingCounter: 2, at },
      },
    ]);
  });

  it('with auto-open on, Next into a typed question starts the answering', () => {
    const revealed = makeRoom({
      ...question({ autoOpenBuzzers: true }),
      phase: 'REVEAL',
      questionIndex: 0,
    });
    const room = step(revealed, { type: 'host:next' });
    expect(room.phase).toBe('ANSWERING');
    expect(room.typed?.closed).toBe(false);
  });

  it('a choice question gets no typed answers', () => {
    const choice = step(makeRoom({ ...question(), questionIndex: 2 }), { type: 'host:open' });
    expect(choice.phase).toBe('ANSWERING');
    expect(choice.typed).toBeNull();
  });

  it('a press before a typed question opens is no false start', () => {
    const room = step(question({ falseStartMs: 500 }), {
      type: 'player:buzz',
      playerId: 'p1',
      receivedAt: 1,
    });
    expect(room.falseStarts).toEqual([]);
  });
});

describe('player:answer {text}', () => {
  it('records one answer per player, and a later one replaces it', () => {
    const room = answered(answering(), { p1: 'Beyonce', p2: 'Rihanna' });
    expect(step(room, typedAnswer('p2', 'Adele')).typed?.answers).toEqual({
      p1: 'Beyonce',
      p2: 'Adele',
    });
  });

  it('the same text again changes nothing', () => {
    const room = answered(answering(), { p1: 'Beyonce' });
    expect(step(room, typedAnswer('p1', 'Beyonce'))).toBe(room);
  });

  it('is refused outside ANSWERING', () => {
    const result = reduce(question(), typedAnswer('p1', 'Beyonce'), NOW);
    expect(result).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
  });

  it('a choice on a typed question, or text on a choice question, is refused', () => {
    expect(reduce(answering(), { type: 'player:answer', playerId: 'p1', choice: 0 }, NOW)).toEqual({
      ok: false,
      error: TYPE_ANSWER_ERROR,
    });
    const choice = step(makeRoom({ ...question(), questionIndex: 2 }), { type: 'host:open' });
    expect(reduce(choice, typedAnswer('p1', 'Paris'), NOW)).toEqual({
      ok: false,
      error: PICK_CHOICE_ERROR,
    });
  });

  it('refuses an unknown player', () => {
    const result = reduce(answering(), typedAnswer('nobody', 'Beyonce'), NOW);
    expect(result).toEqual({ ok: false, error: 'Unknown player' });
  });

  it('is refused once the answers have closed', () => {
    const room = step(answering(), timeUp(answering()));
    const result = reduce(room, typedAnswer('p1', 'Beyonce'), NOW);
    expect(result).toEqual({ ok: false, error: ANSWERS_CLOSED_ERROR });
  });
});

describe('grouping and pre-marks', () => {
  it('groups answers by normalised text, largest first, with the commonest spelling', () => {
    const four = step(answering(), { type: 'player:join', playerId: 'p4', name: 'Dana' });
    const room = answered(four, { p1: 'Rihanna', p2: 'beyonce', p3: 'Beyoncé', p4: 'Beyoncé' });
    expect(typedGroups(room)).toEqual([
      {
        key: 'beyonce',
        text: 'Beyoncé',
        playerIds: ['p2', 'p3', 'p4'],
        preMarked: true,
        correct: true,
      },
      { key: 'rihanna', text: 'Rihanna', playerIds: ['p1'], preMarked: false, correct: false },
    ]);
  });

  it('pre-marks a group equal to an alternative in the host notes', () => {
    const room = answered(answering(), { p1: 'queen  b', p2: 'Beyonce Knowles', p3: 'Queen' });
    expect(verdicts(room)).toEqual({ 'queen b': true, 'beyonce knowles': true, queen: false });
  });

  it('leaves out the answers of players who have left', () => {
    const room = step(answered(answering(), { p1: 'Adele', p2: 'Adele' }), {
      type: 'player:leave',
      playerId: 'p2',
    });
    expect(typedGroups(room)).toMatchObject([{ key: 'adele', playerIds: ['p1'] }]);
    expect(room.typed?.answers).toEqual({ p1: 'Adele' });
  });
});

describe('answers that name object properties', () => {
  it('"constructor" and "__proto__" are wrong unless pre-marked or marked', () => {
    const room = step(answered(answering(), { p1: 'Constructor', p2: '__proto__' }), {
      type: 'host:reveal',
    });
    // Entries, not an object literal: `{ __proto__: … }` would set the prototype, not a key.
    expect(typedGroups(room).map((g) => [g.key, g.correct])).toEqual([
      ['__proto__', false],
      ['constructor', false],
    ]);
    expect(scores(room)).toEqual({ p1: 100, p2: 0, p3: 0 });
  });

  it('the host can mark them correct', () => {
    const open = answered(answering(), { p1: 'Constructor', p2: '__proto__' });
    const room = step(step(open, mark('constructor', '__proto__')), { type: 'host:reveal' });
    expect(scores(room)).toEqual({ p1: 300, p2: 200, p3: 0 });
  });
});

describe('host:markTyped', () => {
  it('sets which groups are correct while answering', () => {
    const room = step(
      answered(answering(), { p1: 'Beyonce', p2: 'Sasha Fierce' }),
      mark('sasha fierce'),
    );
    expect(verdicts(room)).toEqual({ beyonce: false, 'sasha fierce': true });
    expect(room.phase).toBe('ANSWERING');
  });

  it('works after the answers close, and normalises the keys it is given', () => {
    const closed = step(answered(answering(), { p1: 'Beyonce' }), timeUp(answering()));
    expect(closed.typed?.closed).toBe(true);
    const room = step(closed, mark(' SASHA Fierce '));
    expect(room.typed?.marks).toEqual({ beyonce: false, 'sasha fierce': true });
  });

  it('a group that arrives after a mark keeps its pre-mark unless it was listed', () => {
    const marked = step(answered(answering(), { p1: 'Rihanna' }), mark('rihanna', 'adele'));
    const room = answered(marked, { p2: 'Beyoncé', p3: 'Adele' });
    expect(verdicts(room)).toEqual({ rihanna: true, beyonce: true, adele: true });
  });

  it('a later mark replaces the earlier verdicts of the groups it sees', () => {
    const one = step(answered(answering(), { p1: 'Rihanna', p2: 'Beyonce' }), mark('rihanna'));
    const room = step(one, mark('beyonce'));
    expect(verdicts(room)).toEqual({ rihanna: false, beyonce: true });
  });

  it('is refused outside ANSWERING and off a typed question', () => {
    expect(reduce(question(), mark('beyonce'), NOW)).toEqual({
      ok: false,
      error: WRONG_PHASE_ERROR,
    });
    const revealed = step(answering(), { type: 'host:reveal' });
    expect(reduce(revealed, mark('beyonce'), NOW)).toEqual({
      ok: false,
      error: WRONG_PHASE_ERROR,
    });
    const choice = step(makeRoom({ ...question(), questionIndex: 2 }), { type: 'host:open' });
    expect(reduce(choice, mark('paris'), NOW)).toEqual({ ok: false, error: NOT_TYPED_ERROR });
  });
});

describe('closing a typed question', () => {
  it('locks the answers once every connected player has answered, and stays in ANSWERING', () => {
    const room = answered(answering(), { p1: 'Beyonce', p2: 'Adele', p3: 'Queen B' });
    expect(room.phase).toBe('ANSWERING');
    expect(room.typed?.closed).toBe(true);
    expect(room.answeringTimer).toBeNull();
    expect(scores(room)).toEqual({ p1: 100, p2: 0, p3: 0 });
  });

  it('does not wait for a disconnected player, and closes when the last one yet to answer leaves', () => {
    const two = answered(answering(), { p1: 'Beyonce', p2: 'Adele' });
    expect(two.typed?.closed).toBe(false);
    const room = step(two, { type: 'player:disconnect', playerId: 'p3' });
    expect(room.typed?.closed).toBe(true);
  });

  it('locks the answers when the time is up', () => {
    const open = answered(answering(), { p1: 'Beyonce' });
    const room = step(open, timeUp(open));
    expect(room.phase).toBe('ANSWERING');
    expect(room.typed?.closed).toBe(true);
    expect(room.answeringTimer).toBeNull();
  });

  it('a stale or repeated answeringClosed changes nothing', () => {
    const open = answering();
    const tick = timeUp(open);
    const closed = answered(open, { p1: 'a', p2: 'b', p3: 'c' });
    expect(step(closed, tick)).toBe(closed);
    const moved = step(step(open, { type: 'host:reveal' }), { type: 'host:next' });
    expect(step(moved, tick)).toBe(moved);
  });

  it('with every player disconnected, it waits for the timer', () => {
    let room = answering();
    for (const id of ['p1', 'p2', 'p3']) {
      room = step(room, { type: 'player:disconnect', playerId: id });
    }
    expect(room.typed?.closed).toBe(false);
  });
});

describe('host:reveal on a typed question', () => {
  it('scores the correct groups, gives a wrong answer nothing, and skips the unanswered', () => {
    const open = answered(answering(), { p1: 'Beyoncé', p2: 'Adele' });
    const room = step(open, { type: 'host:reveal' });
    expect(room.phase).toBe('REVEAL');
    expect(scores(room)).toEqual({ p1: 300, p2: 0, p3: 0 });
    expect(room.judgements).toEqual([
      { questionIndex: 1, playerId: 'p1', result: 'correct', pointsDelta: 200 },
      { questionIndex: 1, playerId: 'p2', result: 'wrong', pointsDelta: 0 },
    ]);
  });

  it('scores as the host marked it, after the answers closed', () => {
    const closed = answered(answering(), { p1: 'Beyoncé', p2: 'Sasha Fierce', p3: 'Adele' });
    const room = step(step(closed, mark('sasha fierce')), { type: 'host:reveal' });
    expect(scores(room)).toEqual({ p1: 100, p2: 200, p3: 0 });
  });

  it('with the penalty on, a wrong answer loses the points', () => {
    const open = answered(answering({ wrongPenalty: true }), { p1: 'Adele', p2: 'Beyonce' });
    const room = step(open, { type: 'host:reveal' });
    expect(scores(room)).toEqual({ p1: -100, p2: 200, p3: 0 });
  });

  it('locks nobody out, offers no undo, and keeps the groups through REVEAL', () => {
    const room = step(answered(answering(), { p1: 'Adele', p2: 'Beyonce' }), {
      type: 'host:reveal',
    });
    expect(room.lockedOut).toEqual([]);
    expect(room.undo).toEqual([]);
    expect(canUndo(room)).toBe(false);
    expect(room.typed?.closed).toBe(true);
    expect(typedGroups(room)).toHaveLength(2);
  });

  it('the next question starts with no typed answers', () => {
    const room = step(step(answered(answering(), { p1: 'Adele' }), { type: 'host:reveal' }), {
      type: 'host:next',
    });
    expect(room.typed).toBeNull();
  });

  it('host:prev drops the answers without scoring', () => {
    const room = step(answered(answering(), { p1: 'Beyonce' }), { type: 'host:prev' });
    expect(room.phase).toBe('QUESTION');
    expect(room.typed).toBeNull();
    expect(scores(room)).toEqual({ p1: 100, p2: 0, p3: 0 });
  });

  it('host:judge is refused while answering', () => {
    const result = reduce(answering(), { type: 'host:judge', result: 'correct' }, NOW);
    expect(result.ok).toBe(false);
  });
});
