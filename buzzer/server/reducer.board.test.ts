import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Phase, Room, RoomSettings } from '../shared/types.js';
import {
  NOT_ON_BOARD_ERROR,
  TILE_USED_ERROR,
  WRONG_PHASE_ERROR,
  canChangeTeams,
  reduce,
  type Action,
  type ReduceResult,
} from './reducer.js';
import { T0, makeBoardSet, makePlayer, makeRoom, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

function step(room: Room, ...actions: Action[]): Room {
  return actions.reduce((r, action) => ok(reduce(r, action, NOW)).room, room);
}

const pick = (questionIndex: number): Action => ({ type: 'host:pick', questionIndex });
const start: Action = { type: 'host:start' };
const reveal: Action = { type: 'host:reveal' };
const next: Action = { type: 'host:next' };
const prev: Action = { type: 'host:prev' };

/** A lobby with two players and a 2 × 3 board (q1–q6), plus `offBoard` questions on no tile. */
function boardLobby(settings: Partial<RoomSettings> = {}, offBoard = 0): Room {
  return withPlayers(
    makeRoom({
      set: makeBoardSet(2, offBoard),
      settings: { ...DEFAULT_SETTINGS, scoreboardEvery: 0, ...settings },
    }),
    [makePlayer('p1'), makePlayer('p2')],
  );
}

/** Picks the tile at `questionIndex`, reveals it and presses Next. */
function play(room: Room, questionIndex: number): Room {
  return step(room, pick(questionIndex), reveal, next);
}

describe('reduce: a board set starts on the board', () => {
  it('host:start goes from LOBBY to BOARD with no question current', () => {
    const { room, effects } = ok(reduce(boardLobby(), start, NOW));
    expect(room.phase).toBe('BOARD');
    expect(room.questionIndex).toBe(-1);
    expect(room.usedQuestionIds).toEqual([]);
    expect(effects).toEqual([]);
  });

  it('auto-open schedules no title-card hold on the board; it waits for the pick', () => {
    const { room, effects } = ok(reduce(boardLobby({ autoOpenBuzzers: true }), start, NOW));
    expect(room.phase).toBe('BOARD');
    expect(room.autoOpenAt).toBeNull();
    expect(effects).toEqual([]);
  });

  it('a set without a board still starts on question 1', () => {
    const lobby = withPlayers(makeRoom(), [makePlayer('p1')]);
    expect(step(lobby, start)).toMatchObject({ phase: 'QUESTION', questionIndex: 0 });
  });
});

describe('reduce: host:pick', () => {
  it('goes from BOARD to QUESTION on the picked tile and marks it used', () => {
    const room = step(boardLobby(), start, pick(4));
    expect(room.phase).toBe('QUESTION');
    expect(room.questionIndex).toBe(4);
    expect(room.usedQuestionIds).toEqual(['q5']);
  });

  it('the picked question then plays as usual: open, buzz, judge correct, reveal', () => {
    let room = step(boardLobby(), start, pick(2), { type: 'host:open' });
    expect(room.phase).toBe('OPEN');
    room = ok(reduce(room, { type: 'player:buzz', playerId: 'p1', receivedAt: 1 }, NOW)).room;
    room = step(room, {
      type: 'windowClosed',
      questionIndex: 2,
      openingCounter: room.openingCounter,
    });
    expect(room.winnerId).toBe('p1');
    room = step(room, { type: 'host:judge', result: 'correct' });
    expect(room.phase).toBe('REVEAL');
    expect(room.players.p1!.score).toBe(300);
  });

  it('opens the buzzers at once on the pick when auto-open is on', () => {
    const room = step(boardLobby({ autoOpenBuzzers: true }), start, pick(0));
    expect(room.phase).toBe('OPEN');
    expect(room.questionIndex).toBe(0);
  });

  it('hides the scoreboard overlay as play moves on', () => {
    const room = step(boardLobby(), start, { type: 'host:scoreboard', show: true }, pick(0));
    expect(room.showScoreboard).toBe(false);
  });

  it('refuses a tile already played', () => {
    const room = play(step(boardLobby(), start), 1);
    expect(reduce(room, pick(1), NOW)).toEqual({ ok: false, error: TILE_USED_ERROR });
  });

  it('refuses an index past the questions, and a question that is on no tile', () => {
    const room = step(boardLobby({}, 1), start);
    expect(reduce(room, pick(9), NOW)).toEqual({ ok: false, error: NOT_ON_BOARD_ERROR });
    // q7 is in the set but off the board.
    expect(reduce(room, pick(6), NOW)).toEqual({ ok: false, error: NOT_ON_BOARD_ERROR });
  });

  it.each<Phase>(['LOBBY', 'QUESTION', 'OPEN', 'BUZZED', 'ANSWERING', 'REVEAL', 'FINAL'])(
    'is rejected in %s',
    (phase) => {
      const room = { ...boardLobby(), phase, questionIndex: phase === 'LOBBY' ? -1 : 0 };
      expect(reduce(room, pick(1), NOW)).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
    },
  );

  it('is rejected on a set without a board, which never reaches BOARD', () => {
    const room = withPlayers(makeRoom({ phase: 'REVEAL', questionIndex: 0 }), [makePlayer('p1')]);
    expect(reduce(room, pick(1), NOW)).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
  });
});

describe('reduce: host:next on a board set', () => {
  it('goes from REVEAL back to BOARD with a clean slate', () => {
    const revealed = step(boardLobby(), start, pick(3), { type: 'host:open' }, reveal);
    const room = step(revealed, next);
    expect(room.phase).toBe('BOARD');
    expect(room.questionIndex).toBe(-1);
    expect(room.usedQuestionIds).toEqual(['q4']);
    expect(room.buzzes).toEqual([]);
    expect(room.lockedOut).toEqual([]);
  });

  it('goes to FINAL after the last tile, in any order, and tallies the game', () => {
    let room = step(boardLobby(), start);
    for (const index of [5, 0, 3, 1, 4]) room = play(room, index);
    expect(room.phase).toBe('BOARD');
    room = step(room, pick(2), { type: 'host:adjustScore', playerId: 'p1', delta: 300 });
    room = step(room, reveal, next);
    expect(room.phase).toBe('FINAL');
    expect(room.usedQuestionIds).toHaveLength(6);
    expect(room.session.totals).toEqual({ p1: 300, p2: 0 });
  });

  it('a question off the board does not hold the game open', () => {
    let room = step(boardLobby({}, 2), start);
    for (const index of [0, 1, 2, 3, 4, 5]) room = play(room, index);
    expect(room.phase).toBe('FINAL');
  });

  it('shows the scoreboard over the board after every N tiles played', () => {
    let room = step(boardLobby({ scoreboardEvery: 2 }), start);
    room = play(room, 5);
    expect(room.showScoreboard).toBe(false);
    room = play(room, 0);
    expect(room.phase).toBe('BOARD');
    expect(room.showScoreboard).toBe(true);
  });
});

describe('reduce: host:prev on a board set', () => {
  it.each<Action[]>([[], [{ type: 'host:open' }], [reveal]])(
    'returns to BOARD and frees nothing (after %j)',
    (...actions) => {
      const room = step(step(boardLobby(), start, pick(0)), ...actions, prev);
      expect(room.phase).toBe('BOARD');
      expect(room.questionIndex).toBe(-1);
      expect(room.usedQuestionIds).toEqual(['q1']);
      expect(reduce(room, pick(0), NOW)).toEqual({ ok: false, error: TILE_USED_ERROR });
    },
  );

  it('keeps the scores', () => {
    let room = step(boardLobby(), start, pick(1), { type: 'host:open' });
    room = ok(reduce(room, { type: 'player:buzz', playerId: 'p2', receivedAt: 1 }, NOW)).room;
    room = step(
      room,
      { type: 'windowClosed', questionIndex: 1, openingCounter: room.openingCounter },
      { type: 'host:judge', result: 'correct' },
      prev,
    );
    expect(room.players.p2!.score).toBe(200);
  });

  it('is rejected in BOARD', () => {
    const room = step(boardLobby(), start);
    expect(reduce(room, prev, NOW)).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
  });

  it('back from the last tile, the board has none left and End game ends it', () => {
    let room = step(boardLobby(), start);
    for (const index of [0, 1, 2, 3, 4]) room = play(room, index);
    room = step(room, pick(5), prev);
    expect(room.phase).toBe('BOARD');
    expect(reduce(room, next, NOW)).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
    expect(step(room, { type: 'host:end' }).phase).toBe('FINAL');
  });
});

describe('reduce: the board between questions', () => {
  it.each<Action>([
    { type: 'host:open' },
    { type: 'host:reveal' },
    { type: 'host:judge', result: 'correct' },
    { type: 'host:undo' },
    { type: 'host:markTyped', groups: ['x'] },
    { type: 'player:answer', playerId: 'p1', choice: 0 },
    { type: 'player:answer', playerId: 'p1', text: 'x' },
    { type: 'player:practice', playerId: 'p1' },
  ])('refuses $type in BOARD', (action) => {
    const result = reduce(step(boardLobby(), start), action, NOW);
    expect(result.ok).toBe(false);
  });

  it('ignores a buzz in BOARD', () => {
    const room = step(boardLobby(), start);
    const result = ok(reduce(room, { type: 'player:buzz', playerId: 'p1', receivedAt: 1 }, NOW));
    expect(result.room).toBe(room);
  });

  it('takes a team move in BOARD, as between questions', () => {
    const room = step(boardLobby({ teams: 2 }), start);
    expect(canChangeTeams(room)).toBe(true);
    const moved = step(room, { type: 'host:setTeam', playerId: 'p1', team: 1 });
    expect(moved.players.p1!.team).toBe(1);
  });

  it('a stale timer from the last question does nothing on the board', () => {
    const open = step(boardLobby({ buzzSeconds: 10 }), start, pick(0), { type: 'host:open' });
    const at = open.buzzTimer!.endsAt;
    const room = step(open, prev);
    const stale: Action = {
      type: 'buzzTimeUp',
      questionIndex: 0,
      openingCounter: open.openingCounter,
      at,
    };
    expect(ok(reduce(room, stale, at)).room).toBe(room);
  });

  it('host:newGame clears the used tiles', () => {
    const finished = step(play(step(boardLobby(), start), 0), { type: 'host:end' });
    expect(finished.usedQuestionIds).toEqual(['q1']);
    const room = step(finished, { type: 'host:newGame', set: makeBoardSet(3), keepScores: false });
    expect(room.phase).toBe('LOBBY');
    expect(room.usedQuestionIds).toEqual([]);
  });
});
