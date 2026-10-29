import { describe, expect, it } from 'vitest';
import { PLAYER_KICKED_ERROR } from '../shared/constants.js';
import type { Buzz, Phase, QuestionSet, Room } from '../shared/types.js';
import { WRONG_PHASE_ERROR, reduce, type Action, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeQuestion, makeRoom, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 60_000;

function act(room: Room, action: Action, now = NOW): ReduceResult {
  return reduce(room, action, now);
}

const buzz: Buzz = { playerId: 'p1', receivedAt: 5, oneWayMs: 0, adjustedAt: 5 };

/** The next game's set: two questions, nothing in common with `makeSet`. */
const nextSet: QuestionSet = {
  id: 'set2',
  title: 'Movies',
  questions: [
    makeQuestion(1, { id: 'm1', answer: 'Jaws', hostNotes: '1975' }),
    makeQuestion(2, { id: 'm2', answer: 'Alien', hostNotes: '1979' }),
  ],
  createdAt: T0,
  updatedAt: T0,
  schemaVersion: 1,
};

const newGame = (keepScores = false): Action => ({
  type: 'host:newGame',
  set: nextSet,
  keepScores,
});

/**
 * A room at the end of a game: FINAL on its last question, with leftovers of play in every
 * per-game field, a disconnected player, a kicked one and non-default settings.
 */
function finished(overrides: Partial<Room> = {}): Room {
  return withPlayers(
    makeRoom({
      phase: 'FINAL',
      questionIndex: 2,
      openingCounter: 7,
      buzzes: [buzz],
      windowStartedAt: 5,
      openedAt: 4,
      winnerId: 'p1',
      lockedOut: ['p2'],
      falseStarts: ['p2'],
      judgements: [{ questionIndex: 2, playerId: 'p1', result: 'correct', pointsDelta: 100 }],
      reopenAt: T0 + 1500,
      undo: [{ buzzes: [buzz], windowStartedAt: 5, winnerId: 'p1' }],
      answerTimer: { seconds: 5, endsAt: T0 + 5000, up: true },
      answers: { p1: 1 },
      showScoreboard: true,
      kickedIds: ['gone'],
      settings: {
        wrongPenalty: true,
        autoOpenBuzzers: false,
        scoreboardEvery: 3,
        answerSeconds: 5,
        buzzSeconds: 10,
        falseStartMs: 1000,
        showStandings: false,
        teams: 2,
        choiceSeconds: 20,
        copy: 'taglish',
      },
      ...overrides,
    }),
    [
      makePlayer('p1', { score: 300, joinedAtOpening: 0, team: 1 }),
      makePlayer('p2', { score: -100, connected: false, joinedAtOpening: 2, team: 1 }),
    ],
  );
}

describe('reduce: host:newGame', () => {
  it('returns FINAL to LOBBY with the new set and every per-game field reset', () => {
    const room = finished();
    const result = ok(act(room, newGame()));
    expect(result.room).toEqual({
      ...room,
      set: nextSet,
      phase: 'LOBBY',
      questionIndex: -1,
      buzzes: [],
      windowStartedAt: null,
      openedAt: null,
      winnerId: null,
      lockedOut: [],
      falseStarts: [],
      judgements: [],
      reopenAt: null,
      undo: [],
      answerTimer: null,
      buzzTimer: null,
      answers: {},
      showScoreboard: false,
      session: { ...room.session, gameNumber: 2 },
      players: {
        p1: { ...room.players.p1, score: 0 },
        p2: { ...room.players.p2, score: 0 },
      },
      lastActivityAt: NOW,
    });
    expect(result.effects).toEqual([]);
  });

  it('keeps the code, the host token, the settings, the kicks and the opening counter', () => {
    const room = finished();
    const next = ok(act(room, newGame())).room;
    expect(next.code).toBe(room.code);
    expect(next.hostTokenHash).toBe(room.hostTokenHash);
    expect(next.settings).toEqual(room.settings);
    expect(next.kickedIds).toEqual(['gone']);
    expect(next.openingCounter).toBe(7);
    expect(next.createdAt).toBe(room.createdAt);
  });

  it('carries the scores into the next game with keepScores', () => {
    const next = ok(act(finished(), newGame(true))).room;
    expect(next.players.p1!.score).toBe(300);
    expect(next.players.p2!.score).toBe(-100);
  });

  it('keeps disconnected players, still disconnected, with their colour and name', () => {
    const room = finished();
    const next = ok(act(room, newGame())).room;
    expect(Object.keys(next.players)).toEqual(['p1', 'p2']);
    expect(next.players.p2).toEqual({ ...room.players.p2, score: 0 });
  });

  it('still refuses a kicked player in the new lobby, and lets a new one join', () => {
    const lobby = ok(act(finished(), newGame())).room;
    expect(act(lobby, { type: 'player:join', playerId: 'gone', name: 'Gone' })).toEqual({
      ok: false,
      error: PLAYER_KICKED_ERROR,
    });
    const joined = ok(act(lobby, { type: 'player:join', playerId: 'p3', name: 'Cat' })).room;
    expect(joined.players.p3?.joinedAtOpening).toBe(7);
  });

  it.each<Phase>(['LOBBY', 'QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL'])(
    'is rejected in %s',
    (phase) => {
      expect(act(finished({ phase }), newGame())).toEqual({
        ok: false,
        error: WRONG_PHASE_ERROR,
      });
    },
  );

  it('cannot undo a judgement of the previous game', () => {
    const lobby = ok(act(finished(), newGame(true))).room;
    const started = ok(act(lobby, { type: 'host:start' })).room;
    expect(act(started, { type: 'host:undo' })).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
    const open = ok(act(started, { type: 'host:open' })).room;
    expect(act(open, { type: 'host:undo' })).toEqual({ ok: false, error: 'Nothing to undo' });
  });

  it('starts again on the new set, and opens a fresh opening', () => {
    const lobby = ok(act(finished(), newGame())).room;
    const started = ok(act(lobby, { type: 'host:start' })).room;
    expect(started.phase).toBe('QUESTION');
    expect(started.questionIndex).toBe(0);
    expect(started.set.questions[0]?.id).toBe('m1');
    const open = ok(act(started, { type: 'host:open' })).room;
    expect(open.openingCounter).toBe(8);
    // Both players joined at earlier openings, so both can buzz.
    const buzzed = ok(act(open, { type: 'player:buzz', playerId: 'p1', receivedAt: 50 })).room;
    expect(buzzed.phase).toBe('COLLECTING');
  });

  it('ends after the last question of the new set', () => {
    let room = ok(act(finished(), newGame())).room;
    room = ok(act(room, { type: 'host:start' })).room;
    room = ok(act(room, { type: 'host:reveal' })).room;
    room = ok(act(room, { type: 'host:next' })).room;
    expect(room.questionIndex).toBe(1);
    room = ok(act(room, { type: 'host:reveal' })).room;
    room = ok(act(room, { type: 'host:next' })).room;
    expect(room.phase).toBe('FINAL');
  });

  describe('a stale timer from the previous game is ignored', () => {
    const stale: Action[] = [
      { type: 'windowClosed', questionIndex: 0, openingCounter: 7 },
      { type: 'reopen', questionIndex: 0, openingCounter: 7, at: T0 + 1500 },
      { type: 'answerTimeUp', questionIndex: 0, openingCounter: 7, at: T0 + 5000 },
      { type: 'windowClosed', questionIndex: 0, openingCounter: 8 },
      { type: 'reopen', questionIndex: 0, openingCounter: 8, at: T0 + 1500 },
      { type: 'answerTimeUp', questionIndex: 0, openingCounter: 8, at: T0 + 5000 },
    ];

    it.each(stale)('in the lobby: $type', (timer) => {
      const lobby = ok(act(finished(), newGame())).room;
      const result = ok(act(lobby, timer));
      expect(result.room).toBe(lobby);
      expect(result.effects).toEqual([]);
    });

    it.each(stale)('on the first question of the new game: $type', (timer) => {
      const lobby = ok(act(finished(), newGame())).room;
      const started = ok(act(lobby, { type: 'host:start' })).room;
      const result = ok(act(started, timer));
      expect(result.room).toBe(started);
      expect(result.effects).toEqual([]);
    });

    it("a windowClosed of the previous game does not close the new game's window", () => {
      let room = ok(act(finished(), newGame())).room;
      room = ok(act(room, { type: 'host:start' })).room;
      room = ok(act(room, { type: 'host:open' })).room;
      room = ok(act(room, { type: 'player:buzz', playerId: 'p1', receivedAt: 50 })).room;
      expect(room.phase).toBe('COLLECTING');
      const old = ok(act(room, { type: 'windowClosed', questionIndex: 0, openingCounter: 7 }));
      expect(old.room).toBe(room);
      const fresh = ok(act(room, { type: 'windowClosed', questionIndex: 0, openingCounter: 8 }));
      expect(fresh.room.phase).toBe('BUZZED');
    });
  });
});

describe('reduce: session totals', () => {
  /** Applies each step in turn, failing the test on the first rejected one. */
  function run(room: Room, ...actions: Action[]): Room {
    return actions.reduce((r, a) => ok(act(r, a)).room, room);
  }

  const adjust = (playerId: string, delta: number): Action => ({
    type: 'host:adjustScore',
    playerId,
    delta,
  });
  const end: Action = { type: 'host:end' };

  /** A first game in its lobby: Ann joined before Ben. */
  function lobby(): Room {
    return withPlayers(makeRoom(), [
      makePlayer('p1', { name: 'Ann', avatar: '🦊', joinedAt: T0 }),
      makePlayer('p2', { name: 'Ben', color: '#3B82F6', joinedAt: T0 + 1 }),
    ]);
  }

  /** Plays a game: the host gives each player `points` during it, then ends it (FINAL). */
  function game(room: Room, points: Record<string, number>): Room {
    const started = run(room, { type: 'host:start' });
    const scored = Object.entries(points).map(([id, delta]) => adjust(id, delta));
    return run(started, ...scored, end);
  }

  /** Three games with the same points, Keep scores on or off between them. */
  function threeGames(keepScores: boolean): Room {
    let room = game(lobby(), { p1: 300, p2: 100 });
    room = game(run(room, newGame(keepScores)), { p1: 100, p2: 200 });
    return game(run(room, newGame(keepScores)), { p1: -50, p2: 0 });
  }

  it('starts at game 1 with no totals', () => {
    expect(makeRoom().session).toEqual({ gameNumber: 1, totals: {}, players: {}, carried: {} });
  });

  it('adds each score once on reaching FINAL after the last question', () => {
    let room = run(lobby(), { type: 'host:start' }, adjust('p1', 100), adjust('p2', 50));
    room = run(room, { type: 'host:reveal' }, { type: 'host:next' });
    room = run(room, { type: 'host:reveal' }, { type: 'host:next' });
    expect(room.session.totals).toEqual({});
    room = run(room, { type: 'host:reveal' }, { type: 'host:next' });
    expect(room.phase).toBe('FINAL');
    expect(room.session.totals).toEqual({ p1: 100, p2: 50 });
  });

  it('counts host:end as FINAL, and a second end adds nothing', () => {
    const room = game(lobby(), { p1: 300, p2: 100 });
    expect(room.session.totals).toEqual({ p1: 300, p2: 100 });
    expect(run(room, end).session.totals).toEqual({ p1: 300, p2: 100 });
  });

  it('records who each total belongs to', () => {
    expect(game(lobby(), {}).session.players).toEqual({
      p1: { name: 'Ann', color: '#EF4444', avatar: '🦊', joinedAt: T0 },
      p2: { name: 'Ben', color: '#3B82F6', joinedAt: T0 + 1 },
    });
  });

  it('cannot be undone after FINAL', () => {
    expect(act(game(lobby(), { p1: 300 }), { type: 'host:undo' })).toEqual({
      ok: false,
      error: WRONG_PHASE_ERROR,
    });
  });

  it('adds up two games without Keep scores, and numbers the games', () => {
    const first = game(lobby(), { p1: 300, p2: 100 });
    const second = run(first, newGame());
    expect(second.session.gameNumber).toBe(2);
    expect(second.session.totals).toEqual({ p1: 300, p2: 100 });
    expect(game(second, { p1: 100, p2: 200 }).session.totals).toEqual({ p1: 400, p2: 300 });
  });

  it('gives the same totals over three games with Keep scores on and off', () => {
    const kept = threeGames(true);
    const reset = threeGames(false);
    expect(reset.session.gameNumber).toBe(3);
    expect(reset.session.totals).toEqual({ p1: 350, p2: 300 });
    expect(kept.session.totals).toEqual(reset.session.totals);
    // Keep scores still carries the score itself; only the totals ignore what was carried.
    expect(kept.players.p1!.score).toBe(350);
    expect(reset.players.p1!.score).toBe(-50);
  });

  it('leaves the totals as they were when a new game starts, Keep scores on or off', () => {
    const first = game(lobby(), { p1: 300, p2: 100 });
    expect(run(first, newGame(true)).session.totals).toEqual(first.session.totals);
    expect(run(first, newGame(false)).session.totals).toEqual(first.session.totals);
  });

  it('gives a late joiner the points of the games they played', () => {
    let room = run(game(lobby(), { p1: 300 }), newGame(true));
    room = run(room, { type: 'player:join', playerId: 'p3', name: 'Cal' });
    room = game(room, { p1: 100, p3: 200 });
    expect(room.session.totals).toEqual({ p1: 400, p2: 0, p3: 200 });
    expect(room.session.players.p3?.name).toBe('Cal');
  });

  it('keeps the total and name of a player who leaves or is kicked', () => {
    let room = run(game(lobby(), { p1: 300, p2: 100 }), newGame());
    room = run(room, { type: 'player:leave', playerId: 'p1' });
    room = run(room, { type: 'host:kick', playerId: 'p2' });
    room = run(room, { type: 'player:join', playerId: 'p3', name: 'Cal' });
    room = game(room, { p3: 50 });
    expect(room.session.totals).toEqual({ p1: 300, p2: 100, p3: 50 });
    expect(room.session.players.p1?.name).toBe('Ann');
  });

  it('drops the points of a game a player left before its end', () => {
    let room = run(game(lobby(), { p1: 300 }), newGame());
    room = run(room, { type: 'host:start' }, adjust('p1', 500));
    room = run(room, { type: 'player:leave', playerId: 'p1' }, end);
    expect(room.session.totals.p1).toBe(300);
  });

  it('takes a new name at the next tally', () => {
    let room = run(game(lobby(), {}), newGame());
    room = run(room, { type: 'player:rename', playerId: 'p1', name: 'Annie' });
    expect(room.session.players.p1?.name).toBe('Ann');
    expect(game(room, {}).session.players.p1?.name).toBe('Annie');
  });

  it('keeps totals right when a score corrected in FINAL is carried into the next game', () => {
    const first = run(game(lobby(), { p1: 300 }), adjust('p1', -100));
    const second = game(run(first, newGame(true)), { p1: 50 });
    expect(second.players.p1!.score).toBe(250);
    expect(second.session.totals.p1).toBe(250);
  });

  it('follows a score corrected in FINAL, but not one changed before it', () => {
    const first = game(lobby(), { p1: 300 });
    expect(run(first, adjust('p1', -100)).session.totals.p1).toBe(200);
    const lobby2 = run(first, newGame());
    expect(run(lobby2, adjust('p1', 50)).session.totals.p1).toBe(300);
  });
});
