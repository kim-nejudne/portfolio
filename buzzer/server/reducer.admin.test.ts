import { describe, expect, it } from 'vitest';
import { PLAYER_KICKED_ERROR } from '../shared/constants.js';
import type { Phase, Room } from '../shared/types.js';
import { makeBuzz } from './fairness.js';
import { reduce, type Action, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeRoom, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

function step(room: Room, action: Action, now = NOW): Room {
  return ok(reduce(room, action, now)).room;
}

const ALL_PHASES: Phase[] = [
  'LOBBY',
  'QUESTION',
  'OPEN',
  'COLLECTING',
  'BUZZED',
  'ANSWERING',
  'REVEAL',
  'FINAL',
];

/** Three players on question 2 of 3, in `phase` of the second opening. */
function inPhase(phase: Phase, overrides: Partial<Room> = {}): Room {
  return withPlayers(makeRoom({ phase, questionIndex: 1, openingCounter: 2, ...overrides }), [
    makePlayer('p1', { joinedAt: T0 + 1, score: 100, color: '#EF4444' }),
    makePlayer('p2', { joinedAt: T0 + 2, score: 200, color: '#F97316' }),
    makePlayer('p3', { joinedAt: T0 + 3, color: '#FACC15' }),
  ]);
}

/** BUZZED with p1 the winner and p2 also buzzed. */
const buzzed = (overrides: Partial<Room> = {}) =>
  inPhase('BUZZED', {
    buzzes: [makeBuzz('p1', 500, 0), makeBuzz('p2', 520, 0)],
    winnerId: 'p1',
    ...overrides,
  });

const adjust = (playerId: string, delta: number): Action => ({
  type: 'host:adjustScore',
  playerId,
  delta,
});
const kick = (playerId: string): Action => ({ type: 'host:kick', playerId });

describe('reduce: host:adjustScore', () => {
  it.each(ALL_PHASES)('adds the delta to one player in %s', (phase) => {
    const { room, effects } = ok(reduce(inPhase(phase), adjust('p2', 250), NOW));
    expect(room.players.p2?.score).toBe(450);
    expect(room.players.p1?.score).toBe(100);
    expect(room.phase).toBe(phase);
    expect(effects).toEqual([]);
  });

  it('subtracts a negative delta, below zero if need be', () => {
    expect(step(inPhase('REVEAL'), adjust('p1', -250)).players.p1?.score).toBe(-150);
  });

  it('records no judgement and locks nobody out', () => {
    const room = step(buzzed(), adjust('p1', -100));
    expect(room.judgements).toEqual([]);
    expect(room.lockedOut).toEqual([]);
    expect(room.winnerId).toBe('p1');
  });

  it('rejects an unknown player', () => {
    expect(reduce(inPhase('OPEN'), adjust('ghost', 100), NOW)).toEqual({
      ok: false,
      error: 'Unknown player',
    });
  });
});

describe('reduce: host:kick', () => {
  it.each(ALL_PHASES)('removes the player and bars the id in %s', (phase) => {
    const room = step(inPhase(phase), kick('p3'));
    expect(Object.keys(room.players)).toEqual(['p1', 'p2']);
    expect(room.kickedIds).toEqual(['p3']);
    expect(room.phase).toBe(phase);
  });

  it('refuses a rejoin with the same id, even under another name', () => {
    const room = step(inPhase('LOBBY'), kick('p3'));
    expect(reduce(room, { type: 'player:join', playerId: 'p3', name: 'New name' }, NOW)).toEqual({
      ok: false,
      error: PLAYER_KICKED_ERROR,
    });
  });

  it('frees the name and the colour for a new player', () => {
    const room = step(inPhase('LOBBY'), kick('p2'));
    const joined = step(room, { type: 'player:join', playerId: 'p4', name: 'p2' });
    expect(joined.players.p4?.color).toBe('#F97316');
  });

  it('rejects an unknown player', () => {
    expect(reduce(inPhase('LOBBY'), kick('ghost'), NOW)).toEqual({
      ok: false,
      error: 'Unknown player',
    });
  });

  it('drops the player from the lockout', () => {
    expect(step(inPhase('OPEN', { lockedOut: ['p2', 'p3'] }), kick('p2')).lockedOut).toEqual([
      'p3',
    ]);
  });

  it('drops a losing buzz from BUZZED and keeps the winner', () => {
    const room = step(buzzed(), kick('p2'));
    expect(room).toMatchObject({ phase: 'BUZZED', winnerId: 'p1', openingCounter: 2 });
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p1']);
  });

  it('discards an unjudged winning buzz and reopens at once (DECISIONS #10)', () => {
    const { room, effects } = ok(reduce(buzzed(), kick('p1'), NOW));
    expect(room).toMatchObject({
      phase: 'OPEN',
      openingCounter: 3,
      buzzes: [],
      winnerId: null,
      reopenAt: null,
      judgements: [],
    });
    expect(room.players.p2?.score).toBe(200);
    expect(effects).toEqual([]);
  });

  it('moves to REVEAL when it discards an unjudged winner and nobody else is eligible', () => {
    const room = step(buzzed({ lockedOut: ['p2', 'p3'] }), kick('p1'));
    expect(room).toMatchObject({
      phase: 'REVEAL',
      openingCounter: 2,
      buzzes: [],
      winnerId: null,
      lockedOut: ['p2', 'p3'],
    });
  });

  it('still reopens during the wait when the kick leaves nobody eligible', () => {
    const waiting = step(buzzed({ lockedOut: ['p3'] }), { type: 'host:judge', result: 'wrong' });
    const room = step(waiting, kick('p2'), NOW + 100);
    expect(room).toMatchObject({ phase: 'BUZZED', reopenAt: waiting.reopenAt });
  });

  it('reopens at once when the kicked winner was waiting for a reopen', () => {
    const waiting = step(buzzed(), { type: 'host:judge', result: 'wrong' });
    expect(waiting.reopenAt).not.toBeNull();
    const room = step(waiting, kick('p1'), NOW + 100);
    expect(room).toMatchObject({ phase: 'OPEN', openingCounter: 3, reopenAt: null, undo: [] });
    expect(room.lockedOut).toEqual([]);
  });

  it('keeps COLLECTING while another buzz is in the window', () => {
    const collecting = inPhase('COLLECTING', {
      buzzes: [makeBuzz('p1', 500, 0), makeBuzz('p2', 520, 0)],
    });
    const room = step(collecting, kick('p1'));
    expect(room).toMatchObject({ phase: 'COLLECTING', openingCounter: 2 });
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p2']);
  });

  it('reopens at once when it empties the window, so the old window timer is stale', () => {
    const collecting = inPhase('COLLECTING', { buzzes: [makeBuzz('p1', 500, 0)] });
    const room = step(collecting, kick('p1'));
    expect(room).toMatchObject({ phase: 'OPEN', openingCounter: 3, buzzes: [] });

    const stale: Action = { type: 'windowClosed', questionIndex: 1, openingCounter: 2 };
    expect(step(room, stale)).toBe(room);
  });

  it('clears a judged winner in REVEAL and the undo that names them', () => {
    const revealed = step(buzzed(), { type: 'host:judge', result: 'correct' });
    const room = step(revealed, kick('p1'));
    expect(room).toMatchObject({ phase: 'REVEAL', winnerId: null, undo: [] });
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p2']);
    expect(reduce(room, { type: 'host:undo' }, NOW)).toEqual({
      ok: false,
      error: 'Nothing to undo',
    });
  });

  it('keeps the undo of another player, without the kicked player’s buzz', () => {
    const revealed = step(buzzed(), { type: 'host:judge', result: 'correct' });
    const room = step(step(revealed, kick('p2')), { type: 'host:undo' });
    expect(room).toMatchObject({ phase: 'BUZZED', winnerId: 'p1' });
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p1']);
  });

  it('keeps the judgement history', () => {
    const revealed = step(buzzed(), { type: 'host:judge', result: 'correct' });
    expect(step(revealed, kick('p1')).judgements).toEqual(revealed.judgements);
  });
});

describe('reduce: host:settings', () => {
  it.each(ALL_PHASES)('merges a partial update in %s', (phase) => {
    const { room, effects } = ok(
      reduce(inPhase(phase), { type: 'host:settings', settings: { wrongPenalty: true } }, NOW),
    );
    expect(room.settings).toEqual({
      wrongPenalty: true,
      autoOpenBuzzers: false,
      scoreboardEvery: 5,
      answerSeconds: 0,
      buzzSeconds: 0,
      falseStartMs: 0,
      showStandings: true,
      teams: 0,
      choiceSeconds: 10,
      copy: 'en',
    });
    expect(room.phase).toBe(phase);
    expect(effects).toEqual([]);
  });

  it('sets several keys at once and leaves an empty update unchanged', () => {
    const settings = {
      autoOpenBuzzers: true,
      scoreboardEvery: 0,
      answerSeconds: 7,
      buzzSeconds: 15,
      falseStartMs: 500,
      showStandings: false,
      teams: 3,
      choiceSeconds: 20,
      copy: 'taglish',
    } as const;
    const room = step(inPhase('LOBBY'), { type: 'host:settings', settings });
    expect(room.settings).toEqual({ wrongPenalty: false, ...settings });
    expect(step(room, { type: 'host:settings', settings: {} }).settings).toEqual(room.settings);
  });

  it('ignores a key that is present but undefined', () => {
    const room = step(inPhase('LOBBY'), {
      type: 'host:settings',
      settings: { wrongPenalty: undefined, scoreboardEvery: 3 },
    });
    expect(room.settings).toEqual({
      wrongPenalty: false,
      autoOpenBuzzers: false,
      scoreboardEvery: 3,
      answerSeconds: 0,
      buzzSeconds: 0,
      falseStartMs: 0,
      showStandings: true,
      teams: 0,
      choiceSeconds: 10,
      copy: 'en',
    });
  });

  it('applies the penalty to the next wrong judgement', () => {
    const room = step(buzzed(), { type: 'host:settings', settings: { wrongPenalty: true } });
    const judged = step(room, { type: 'host:judge', result: 'wrong' });
    expect(judged.players.p1?.score).toBe(0);
  });

  it('turns the standings rail off and on again, keeping the other keys', () => {
    const off = step(inPhase('OPEN'), {
      type: 'host:settings',
      settings: { showStandings: false },
    });
    expect(off.settings).toEqual({ ...inPhase('OPEN').settings, showStandings: false });
    const on = step(off, { type: 'host:settings', settings: { showStandings: true } });
    expect(on.settings.showStandings).toBe(true);
  });

  it('switches the phone and Screen language in any phase, keeping the other keys', () => {
    const taglish = step(inPhase('BUZZED'), {
      type: 'host:settings',
      settings: { copy: 'taglish' },
    });
    expect(taglish.settings).toEqual({ ...inPhase('BUZZED').settings, copy: 'taglish' });
    const en = step(taglish, { type: 'host:settings', settings: { copy: 'en' } });
    expect(en.settings.copy).toBe('en');
  });

  it('does not open the buzzers on the current question when auto-open turns on', () => {
    const room = step(inPhase('QUESTION'), {
      type: 'host:settings',
      settings: { autoOpenBuzzers: true },
    });
    expect(room.phase).toBe('QUESTION');
    expect(step(step(room, { type: 'host:reveal' }), { type: 'host:next' }).phase).toBe('OPEN');
  });
});
