import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Phase, Room, RoomSettings } from '../shared/types.js';
import { makeBuzz } from './fairness.js';
import { reduce, TEAMS_PHASE_ERROR, type Action, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeRoom, withPlayers } from './test/rooms.js';
import { toView } from './views.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

function step(room: Room, action: Action, now = NOW): Room {
  return ok(reduce(room, action, now)).room;
}

const join = (playerId: string): Action => ({ type: 'player:join', playerId, name: playerId });
const setTeam = (playerId: string, team: number): Action => ({
  type: 'host:setTeam',
  playerId,
  team,
});
const settings = (patch: Partial<RoomSettings>): Action => ({
  type: 'host:settings',
  settings: patch,
});

/** Each player's team, by id. */
function teamsOf(room: Room): Record<string, number | null> {
  return Object.fromEntries(Object.values(room.players).map((p) => [p.id, p.team]));
}

/** A room with `teams` on and nobody in it. */
function teamRoom(teams: RoomSettings['teams'], overrides: Partial<Room> = {}): Room {
  return makeRoom({ settings: { ...DEFAULT_SETTINGS, teams }, ...overrides });
}

/** `ids` joined in that order, one ms apart. */
function joined(room: Room, ids: string[]): Room {
  return ids.reduce((r, id, i) => step(r, join(id), NOW + i), room);
}

const ALL_PHASES: Phase[] = [
  'LOBBY',
  'QUESTION',
  'OPEN',
  'COLLECTING',
  'BUZZED',
  'REVEAL',
  'FINAL',
];
const TEAM_PHASES: Phase[] = ['LOBBY', 'REVEAL'];
const LOCKED_PHASES = ALL_PHASES.filter((p) => !TEAM_PHASES.includes(p));

describe('reduce: teams on join', () => {
  it('gives a new player no team while teams are off', () => {
    const room = joined(makeRoom(), ['a', 'b']);
    expect(teamsOf(room)).toEqual({ a: null, b: null });
  });

  it('assigns joiners to the smallest team, lowest index on a tie', () => {
    const room = joined(teamRoom(3), ['a', 'b', 'c', 'd', 'e']);
    expect(teamsOf(room)).toEqual({ a: 0, b: 1, c: 2, d: 0, e: 1 });
  });

  it('fills the team a move left short before any other', () => {
    let room = joined(teamRoom(3), ['a', 'b', 'c']);
    room = step(room, setTeam('c', 0)); // sizes 2, 1, 0
    room = joined(room, ['d', 'e']);
    expect(teamsOf(room)).toMatchObject({ d: 2, e: 1 });
  });

  it('counts disconnected players, who still belong to their team', () => {
    let room = joined(teamRoom(2), ['a', 'b']);
    room = step(room, { type: 'player:disconnect', playerId: 'a' });
    expect(step(room, join('c')).players.c?.team).toBe(0);
  });

  it('keeps the team of a player who reconnects', () => {
    let room = joined(teamRoom(2), ['a', 'b']);
    room = step(room, setTeam('a', 1));
    room = step(room, { type: 'player:disconnect', playerId: 'a' });
    expect(step(room, join('a')).players.a).toMatchObject({ team: 1, connected: true });
  });

  it('assigns a mid-game joiner too', () => {
    const room = joined(teamRoom(2, { phase: 'OPEN', questionIndex: 0, openingCounter: 1 }), [
      'a',
      'b',
      'c',
    ]);
    expect(teamsOf(room)).toEqual({ a: 0, b: 1, c: 0 });
  });
});

describe('reduce: the teams setting', () => {
  it('turning teams on balances everyone in join order', () => {
    // Listed out of join order, so the order must come from joinedAt.
    const room = withPlayers(makeRoom(), [
      makePlayer('late', { joinedAt: T0 + 5, team: null }),
      makePlayer('first', { joinedAt: T0 + 1, team: null }),
      makePlayer('second', { joinedAt: T0 + 2, team: null }),
      makePlayer('third', { joinedAt: T0 + 3, team: null }),
      makePlayer('fourth', { joinedAt: T0 + 4, team: null }),
    ]);
    expect(teamsOf(step(room, settings({ teams: 2 })))).toEqual({
      first: 0,
      second: 1,
      third: 0,
      fourth: 1,
      late: 0,
    });
  });

  it('changing the count balances everyone again across the new teams', () => {
    let room = joined(teamRoom(2), ['a', 'b', 'c', 'd']);
    room = step(room, settings({ teams: 4 }));
    expect(teamsOf(room)).toEqual({ a: 0, b: 1, c: 2, d: 3 });
    room = step(room, settings({ teams: 3 }));
    expect(teamsOf(room)).toEqual({ a: 0, b: 1, c: 2, d: 0 });
  });

  it('turning teams off takes everyone out of their team', () => {
    const room = step(joined(teamRoom(3), ['a', 'b']), settings({ teams: 0 }));
    expect(room.settings.teams).toBe(0);
    expect(teamsOf(room)).toEqual({ a: null, b: null });
  });

  it('sending the same count keeps the host’s moves', () => {
    let room = joined(teamRoom(2), ['a', 'b']);
    room = step(room, setTeam('b', 0));
    room = step(room, settings({ teams: 2, wrongPenalty: true }));
    expect(teamsOf(room)).toEqual({ a: 0, b: 0 });
    expect(room.settings.wrongPenalty).toBe(true);
  });

  it.each(['REVEAL'] as Phase[])('changes the count in %s', (phase) => {
    const room = joined(teamRoom(0, { phase, questionIndex: 0 }), ['a', 'b']);
    expect(teamsOf(step(room, settings({ teams: 2 })))).toEqual({ a: 0, b: 1 });
  });

  it.each(LOCKED_PHASES)('rejects a change of count in %s and changes nothing', (phase) => {
    const room = withPlayers(teamRoom(2, { phase, questionIndex: 0 }), [
      makePlayer('a', { team: 0 }),
    ]);
    expect(reduce(room, settings({ teams: 3, wrongPenalty: true }), NOW)).toEqual({
      ok: false,
      error: TEAMS_PHASE_ERROR,
    });
  });

  it.each(LOCKED_PHASES)('accepts the unchanged count with other settings in %s', (phase) => {
    const room = teamRoom(2, { phase, questionIndex: 0 });
    expect(step(room, settings({ teams: 2, wrongPenalty: true })).settings).toMatchObject({
      teams: 2,
      wrongPenalty: true,
    });
  });
});

describe('reduce: host:setTeam', () => {
  it.each(TEAM_PHASES)('moves a player to another team in %s', (phase) => {
    const room = joined(teamRoom(3, { phase, questionIndex: 0 }), ['a', 'b']);
    const moved = ok(reduce(room, setTeam('a', 2), NOW));
    expect(teamsOf(moved.room)).toEqual({ a: 2, b: 1 });
    expect(moved.room.players.a?.score).toBe(0);
    expect(moved.effects).toEqual([]);
  });

  it.each(LOCKED_PHASES)('rejects a move in %s', (phase) => {
    const room = withPlayers(teamRoom(2, { phase, questionIndex: 0 }), [
      makePlayer('a', { team: 0 }),
    ]);
    expect(reduce(room, setTeam('a', 1), NOW)).toEqual({ ok: false, error: TEAMS_PHASE_ERROR });
  });

  it('rejects a move while teams are off', () => {
    const room = joined(makeRoom(), ['a']);
    expect(reduce(room, setTeam('a', 0), NOW)).toEqual({ ok: false, error: 'Teams are off' });
  });

  it('rejects a team the room does not play', () => {
    const room = joined(teamRoom(2), ['a']);
    expect(reduce(room, setTeam('a', 2), NOW)).toEqual({ ok: false, error: 'No such team' });
  });

  it('rejects an unknown player', () => {
    expect(reduce(teamRoom(2), setTeam('ghost', 0), NOW)).toEqual({
      ok: false,
      error: 'Unknown player',
    });
  });

  it('a move to the team the player is on changes nothing', () => {
    const room = joined(teamRoom(2), ['a']);
    expect(ok(reduce(room, setTeam('a', 0), NOW)).room).toBe(room);
  });

  it('a player who leaves or is kicked does not rebalance the others', () => {
    let room = joined(teamRoom(2), ['a', 'b', 'c', 'd']);
    room = step(room, { type: 'player:leave', playerId: 'b' });
    room = step(room, { type: 'host:kick', playerId: 'd' });
    expect(teamsOf(room)).toEqual({ a: 0, c: 0 });
  });

  it('a new game keeps everyone’s team', () => {
    let room = joined(teamRoom(2), ['a', 'b']);
    room = step(room, setTeam('b', 0));
    room = step(
      { ...room, phase: 'FINAL' },
      { type: 'host:newGame', set: room.set, keepScores: false },
    );
    expect(room.phase).toBe('LOBBY');
    expect(teamsOf(room)).toEqual({ a: 0, b: 0 });
  });
});

describe('reduce: team scoring', () => {
  /** Two teams: a and c on Red, b on Blue; question 1 of 3, BUZZED with `winner` first. */
  function buzzed(winner: string, overrides: Partial<Room> = {}): Room {
    return withPlayers(
      teamRoom(2, {
        phase: 'BUZZED',
        questionIndex: 0,
        openingCounter: 1,
        buzzes: [makeBuzz(winner, 500, 0)],
        winnerId: winner,
        ...overrides,
      }),
      [
        makePlayer('a', { team: 0, joinedAt: T0 + 1, score: 100 }),
        makePlayer('b', { team: 1, joinedAt: T0 + 2, score: 150 }),
        makePlayer('c', { team: 0, joinedAt: T0 + 3, score: 0 }),
      ],
    );
  }

  const teamScores = (room: Room) => toView(room, 'host').teams?.map((t) => [t.score, t.rank]);

  it('a correct answer scores the player alone, and the team gains it through the sum', () => {
    const room = step(buzzed('c'), { type: 'host:judge', result: 'correct' });
    expect(room.players.c?.score).toBe(100);
    expect(room.players.a?.score).toBe(100);
    expect(room.judgements).toEqual([
      { questionIndex: 0, playerId: 'c', result: 'correct', pointsDelta: 100 },
    ]);
    expect(teamScores(room)).toEqual([
      [200, 1],
      [150, 2],
    ]);
  });

  it('a wrong answer locks out only that player, not their teammates', () => {
    const room = step(buzzed('a'), { type: 'host:judge', result: 'wrong' });
    expect(room.lockedOut).toEqual(['a']);
    expect(room.reopenAt).not.toBeNull();
  });

  it('a penalty, an adjustment and an undo all move the team score with the player', () => {
    let room = buzzed('a', { settings: { ...DEFAULT_SETTINGS, teams: 2, wrongPenalty: true } });
    room = step(room, { type: 'host:judge', result: 'wrong' });
    expect(teamScores(room)).toEqual([
      [0, 2],
      [150, 1],
    ]);
    room = step(room, { type: 'host:undo' });
    expect(teamScores(room)).toEqual([
      [100, 2],
      [150, 1],
    ]);
    room = step(room, { type: 'host:adjustScore', playerId: 'c', delta: 50 });
    expect(teamScores(room)).toEqual([
      [150, 1],
      [150, 1],
    ]);
  });

  it('a move takes the player’s points to their new team', () => {
    const room = step({ ...buzzed('a'), phase: 'REVEAL', winnerId: null }, setTeam('a', 1));
    expect(teamScores(room)).toEqual([
      [0, 2],
      [250, 1],
    ]);
  });
});
