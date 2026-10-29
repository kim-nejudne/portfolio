import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Room, RoomSettings } from '../shared/types.js';
import { canUndo, reduce, WRONG_PHASE_ERROR, type Action, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeQuestion, makeRoom, makeSet, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

function step(room: Room, action: Action, now = NOW): Room {
  return ok(reduce(room, action, now)).room;
}

const answer = (playerId: string, choice: number): Action => ({
  type: 'player:answer',
  playerId,
  choice,
});

/** The `answeringClosed` action for `room`'s running answer timer, as the gateway would dispatch it. */
function closed(room: Room): Extract<Action, { type: 'answeringClosed' }> {
  if (!room.answeringTimer) throw new Error('No answer timer running');
  return {
    type: 'answeringClosed',
    questionIndex: room.questionIndex,
    openingCounter: room.openingCounter,
    at: room.answeringTimer.endsAt,
  };
}

/** Question 2 of 3 is a choice question (Paris correct, 200 points); 1 and 3 are buzz questions. */
function choiceSet() {
  const set = makeSet(3);
  set.questions[1] = makeQuestion(2, {
    mode: 'choice',
    choices: ['Paris', 'Lyon', 'Nice'],
    correctChoice: 0,
    answer: 'Paris',
    points: 200,
  });
  return set;
}

/** Three connected players on the choice question, shown and not yet open. */
function question(settings: Partial<RoomSettings> = {}): Room {
  return withPlayers(
    makeRoom({
      set: choiceSet(),
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

/** The choice question taking answers, opened at `NOW`. */
function answering(settings: Partial<RoomSettings> = {}): Room {
  return step(question(settings), { type: 'host:open' });
}

const scores = (room: Room) =>
  Object.fromEntries(Object.values(room.players).map((p) => [p.id, p.score]));

describe('host:open on a choice question', () => {
  it('goes QUESTION → ANSWERING as a new opening with no answers', () => {
    const room = answering();
    expect(room.phase).toBe('ANSWERING');
    expect(room.openingCounter).toBe(2);
    expect(room.answers).toEqual({});
    expect(room.buzzTimer).toBeNull();
  });

  it('schedules answeringClosed after choiceSeconds, default 10', () => {
    const { room, effects } = ok(reduce(question(), { type: 'host:open' }, NOW));
    expect(room.answeringTimer).toEqual({ seconds: 10, endsAt: NOW + 10_000 });
    expect(effects).toEqual([
      {
        type: 'schedule',
        at: NOW + 10_000,
        action: { type: 'answeringClosed', questionIndex: 1, openingCounter: 2, at: NOW + 10_000 },
      },
    ]);
  });

  it('reads choiceSeconds when it opens', () => {
    const room = answering({ choiceSeconds: 25 });
    expect(room.answeringTimer).toEqual({ seconds: 25, endsAt: NOW + 25_000 });
  });

  it('a settings change while answering waits for the next choice question', () => {
    const room = step(answering(), { type: 'host:settings', settings: { choiceSeconds: 30 } });
    expect(room.settings.choiceSeconds).toBe(30);
    expect(room.answeringTimer).toEqual({ seconds: 10, endsAt: NOW + 10_000 });
  });

  it('opens the buzzers on a buzz question, with no answer timer', () => {
    const room = step({ ...question(), questionIndex: 0 }, { type: 'host:open' });
    expect(room.phase).toBe('OPEN');
    expect(room.answeringTimer).toBeNull();
  });

  it('with auto-open on, Next into a choice question starts the answering and its timer', () => {
    const reveal = { ...question({ autoOpenBuzzers: true }), phase: 'REVEAL', questionIndex: 0 };
    const { room, effects } = ok(reduce(reveal as Room, { type: 'host:next' }, NOW));
    expect(room.phase).toBe('ANSWERING');
    expect(room.questionIndex).toBe(1);
    expect(effects).toContainEqual(expect.objectContaining({ type: 'schedule', at: NOW + 10_000 }));
  });

  it("question 1's auto-open after the title card starts the answering on a choice question", () => {
    // The choice question first.
    const set = choiceSet();
    set.questions = [set.questions[1]!, set.questions[0]!, set.questions[2]!];
    const lobby = withPlayers(
      makeRoom({ set, settings: { ...DEFAULT_SETTINGS, autoOpenBuzzers: true } }),
      [makePlayer('p1')],
    );
    const shown = ok(reduce(lobby, { type: 'host:start' }, NOW));
    const auto = shown.effects.find((e) => e.type === 'schedule');
    if (auto?.type !== 'schedule') throw new Error('No auto-open scheduled');
    const room = step(shown.room, auto.action, auto.at);
    expect(room.phase).toBe('ANSWERING');
    expect(room.answeringTimer?.endsAt).toBe(auto.at + 10_000);
  });
});

describe('player:answer', () => {
  it('records one answer per player', () => {
    const room = step(step(answering(), answer('p1', 0)), answer('p2', 2));
    expect(room.answers).toEqual({ p1: 0, p2: 2 });
    expect(room.phase).toBe('ANSWERING');
  });

  it('a player may change their answer until it closes', () => {
    const room = step(step(answering(), answer('p1', 0)), answer('p1', 1));
    expect(room.answers).toEqual({ p1: 1 });
  });

  it('the same answer again changes nothing', () => {
    const once = step(answering(), answer('p1', 0));
    expect(step(once, answer('p1', 0))).toBe(once);
  });

  it('is refused outside ANSWERING', () => {
    for (const phase of ['LOBBY', 'QUESTION', 'OPEN', 'BUZZED', 'REVEAL', 'FINAL'] as const) {
      expect(reduce({ ...question(), phase }, answer('p1', 0), NOW)).toEqual({
        ok: false,
        error: WRONG_PHASE_ERROR,
      });
    }
  });

  it('refuses a choice the question does not have', () => {
    expect(reduce(answering(), answer('p1', 3), NOW)).toEqual({
      ok: false,
      error: 'No such choice',
    });
  });

  it('refuses an unknown player', () => {
    expect(reduce(answering(), answer('ghost', 0), NOW)).toEqual({
      ok: false,
      error: 'Unknown player',
    });
  });

  it('a buzz press while answering is ignored', () => {
    const room = answering();
    expect(step(room, { type: 'player:buzz', playerId: 'p1', receivedAt: 500 })).toBe(room);
  });

  it('a press before a choice question opens is no false start', () => {
    const room = question({ falseStartMs: 500 });
    const after = ok(reduce(room, { type: 'player:buzz', playerId: 'p1', receivedAt: 500 }, NOW));
    expect(after.room).toBe(room);
    expect(after.effects).toEqual([]);
  });
});

describe('closing when every connected player has answered', () => {
  it('goes to REVEAL once the last connected player answers', () => {
    const two = step(step(answering(), answer('p1', 0)), answer('p2', 1));
    expect(two.phase).toBe('ANSWERING');
    const room = step(two, answer('p3', 0));
    expect(room.phase).toBe('REVEAL');
    expect(room.answeringTimer).toBeNull();
  });

  it('does not wait for a disconnected player', () => {
    const away = step(answering(), { type: 'player:disconnect', playerId: 'p3' });
    const room = step(step(away, answer('p1', 0)), answer('p2', 0));
    expect(room.phase).toBe('REVEAL');
  });

  it('closes when the last player yet to answer disconnects', () => {
    const two = step(step(answering(), answer('p1', 0)), answer('p2', 1));
    const room = step(two, { type: 'player:disconnect', playerId: 'p3' });
    expect(room.phase).toBe('REVEAL');
    expect(scores(room)).toEqual({ p1: 300, p2: 0, p3: 0 });
  });

  it('closes when the last player yet to answer is kicked', () => {
    const two = step(step(answering(), answer('p1', 0)), answer('p2', 1));
    const room = step(two, { type: 'host:kick', playerId: 'p3' });
    expect(room.phase).toBe('REVEAL');
  });

  it('a kicked player answer is dropped and not scored', () => {
    const one = step(answering(), answer('p3', 0));
    const room = step(one, { type: 'host:kick', playerId: 'p3' });
    expect(room.answers).toEqual({});
    expect(room.phase).toBe('ANSWERING');
  });

  it('a player who joins while answering is waited for', () => {
    const joined = step(answering(), { type: 'player:join', playerId: 'p4', name: 'Dana' });
    const three = step(step(step(joined, answer('p1', 0)), answer('p2', 0)), answer('p3', 0));
    expect(three.phase).toBe('ANSWERING');
    expect(step(three, answer('p4', 1)).phase).toBe('REVEAL');
  });

  it('with every player disconnected, it waits for the timer', () => {
    let room = answering();
    for (const id of ['p1', 'p2', 'p3']) {
      room = step(room, { type: 'player:disconnect', playerId: id });
    }
    expect(room.phase).toBe('ANSWERING');
  });
});

describe('answeringClosed', () => {
  it('when time is up the room goes to REVEAL and scores the answers', () => {
    const one = step(answering(), answer('p1', 0));
    const room = step(one, closed(one), NOW + 10_000);
    expect(room.phase).toBe('REVEAL');
    expect(room.answeringTimer).toBeNull();
    expect(scores(room)).toEqual({ p1: 300, p2: 0, p3: 0 });
  });

  it('is ignored once the room has moved on', () => {
    const room = answering();
    const timer = closed(room);
    const revealed = step(room, { type: 'host:reveal' });
    expect(step(revealed, timer)).toBe(revealed);
  });

  it('is ignored for another opening of the same question', () => {
    const first = answering();
    const timer = closed(first);
    const again = step(step(step(first, { type: 'host:reveal' }), { type: 'host:next' }), {
      type: 'host:prev',
    });
    const reopened = step(again, { type: 'host:open' }, NOW + 5_000);
    expect(reopened.phase).toBe('ANSWERING');
    expect(step(reopened, timer)).toBe(reopened);
  });

  it('is ignored when its time does not match the running timer', () => {
    const room = answering();
    expect(step(room, { ...closed(room), at: NOW + 1 })).toBe(room);
  });
});

describe('scoring choice answers', () => {
  it('each correct player gets the points; a wrong or missing answer gets none', () => {
    const room = step(step(answering(), answer('p1', 0)), answer('p2', 2));
    const scored = step(room, { type: 'host:reveal' });
    expect(scores(scored)).toEqual({ p1: 300, p2: 0, p3: 0 });
  });

  it('records a judgement for each answer, so the phone can show its points', () => {
    const room = step(step(answering(), answer('p1', 0)), answer('p2', 2));
    const scored = step(room, { type: 'host:reveal' });
    expect(scored.judgements).toEqual([
      { questionIndex: 1, playerId: 'p1', result: 'correct', pointsDelta: 200 },
      { questionIndex: 1, playerId: 'p2', result: 'wrong', pointsDelta: 0 },
    ]);
  });

  it('a wrong answer locks nobody out', () => {
    const room = step(step(answering(), answer('p1', 0)), answer('p2', 2));
    expect(step(room, { type: 'host:reveal' }).lockedOut).toEqual([]);
  });

  it('with the penalty on, a wrong answer loses the points', () => {
    const room = step(step(answering({ wrongPenalty: true }), answer('p1', 0)), answer('p2', 2));
    expect(scores(step(room, { type: 'host:reveal' }))).toEqual({ p1: 300, p2: -200, p3: 0 });
  });

  it('scores the changed answer, not the first one', () => {
    const room = step(step(answering(), answer('p2', 1)), answer('p2', 0));
    expect(scores(step(room, { type: 'host:reveal' })).p2).toBe(200);
  });

  it('the answers stay through REVEAL and clear on the next question', () => {
    const scored = step(step(answering(), answer('p1', 0)), { type: 'host:reveal' });
    expect(scored.answers).toEqual({ p1: 0 });
    expect(step(scored, { type: 'host:next' }).answers).toEqual({});
  });
});

describe('host actions while answering', () => {
  it('host:reveal closes it early and scores', () => {
    const one = step(answering(), answer('p1', 0));
    const room = step(one, { type: 'host:reveal' });
    expect(room.phase).toBe('REVEAL');
    expect(room.answeringTimer).toBeNull();
    expect(scores(room).p1).toBe(300);
  });

  it('undo is not offered for a choice question', () => {
    const scored = step(step(answering(), answer('p1', 0)), { type: 'host:reveal' });
    expect(canUndo(scored)).toBe(false);
    expect(reduce(scored, { type: 'host:undo' }, NOW)).toEqual({
      ok: false,
      error: 'Nothing to undo',
    });
  });

  it('host:judge is refused', () => {
    expect(reduce(answering(), { type: 'host:judge', result: 'correct' }, NOW)).toEqual({
      ok: false,
      error: WRONG_PHASE_ERROR,
    });
  });

  it('host:open is refused', () => {
    expect(reduce(answering(), { type: 'host:open' }, NOW)).toEqual({
      ok: false,
      error: WRONG_PHASE_ERROR,
    });
  });

  it('host:prev goes back a question without scoring and drops the answers', () => {
    const room = step(step(answering(), answer('p1', 0)), { type: 'host:prev' });
    expect(room.phase).toBe('QUESTION');
    expect(room.questionIndex).toBe(0);
    expect(room.answers).toEqual({});
    expect(room.answeringTimer).toBeNull();
    expect(scores(room).p1).toBe(100);
  });

  it('host:end goes to FINAL without scoring', () => {
    const room = step(step(answering(), answer('p1', 0)), { type: 'host:end' });
    expect(room.phase).toBe('FINAL');
    expect(room.answeringTimer).toBeNull();
    expect(scores(room).p1).toBe(100);
  });

  it('host:reveal before opening reveals with no points', () => {
    const room = step(question(), { type: 'host:reveal' });
    expect(room.phase).toBe('REVEAL');
    expect(room.judgements).toEqual([]);
  });
});
