import { describe, expect, it } from 'vitest';
import type { Buzz, Phase, Room } from '../shared/types.js';
import { WRONG_PHASE_ERROR, reduce, type Action, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeRoom, makeSet, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

function act(room: Room, action: Action): ReduceResult {
  return reduce(room, action, NOW);
}

const buzz: Buzz = { playerId: 'p1', receivedAt: 5, oneWayMs: 0, adjustedAt: 5 };

/** A room with two players, mid-game in `phase` on `questionIndex` (of 3 questions). */
function inPhase(phase: Phase, questionIndex = 1, overrides: Partial<Room> = {}): Room {
  return withPlayers(makeRoom({ phase, questionIndex, openingCounter: 2, ...overrides }), [
    makePlayer('p1', { score: 300 }),
    makePlayer('p2', { score: -100 }),
  ]);
}

/** Leftovers of an earlier opening that entering a question must clear. */
const dirty: Partial<Room> = { buzzes: [buzz], winnerId: 'p1', lockedOut: ['p2'] };

describe('reduce: host:start', () => {
  it('moves LOBBY to QUESTION 0 when at least one player has joined', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1')]);
    const result = ok(act(room, { type: 'host:start' }));
    expect(result.room.phase).toBe('QUESTION');
    expect(result.room.questionIndex).toBe(0);
    expect(result.room.openingCounter).toBe(0);
    expect(result.effects).toEqual([]);
  });

  it('counts a disconnected player towards the minimum', () => {
    const room = withPlayers(makeRoom(), [makePlayer('p1', { connected: false })]);
    expect(ok(act(room, { type: 'host:start' })).room.phase).toBe('QUESTION');
  });

  it('is rejected with no players', () => {
    expect(act(makeRoom(), { type: 'host:start' })).toEqual({
      ok: false,
      error: 'Wait for at least one player to join',
    });
  });

  it('opens the buzzers at once when autoOpenBuzzers is on', () => {
    const room = withPlayers(
      makeRoom({ settings: { ...makeRoom().settings, autoOpenBuzzers: true } }),
      [makePlayer('p1')],
    );
    const { room: next } = ok(act(room, { type: 'host:start' }));
    expect(next.phase).toBe('OPEN');
    expect(next.questionIndex).toBe(0);
    expect(next.openingCounter).toBe(1);
  });
});

describe('reduce: host:open', () => {
  it('moves QUESTION to OPEN, clears buzzes and counts a new opening', () => {
    const { room } = ok(act(inPhase('QUESTION', 1, { buzzes: [buzz] }), { type: 'host:open' }));
    expect(room.phase).toBe('OPEN');
    expect(room.questionIndex).toBe(1);
    expect(room.buzzes).toEqual([]);
    expect(room.openingCounter).toBe(3);
  });

  it('hides the scoreboard overlay (DECISIONS #7)', () => {
    const { room } = ok(
      act(inPhase('QUESTION', 1, { showScoreboard: true }), { type: 'host:open' }),
    );
    expect(room.showScoreboard).toBe(false);
  });
});

describe('reduce: host:reveal', () => {
  it.each<Phase>(['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'])(
    'moves %s to REVEAL without points and discards an unjudged buzz',
    (phase) => {
      const before = inPhase(phase, 1, { buzzes: [buzz], winnerId: 'p1', showScoreboard: true });
      const { room } = ok(act(before, { type: 'host:reveal' }));
      expect(room.phase).toBe('REVEAL');
      expect(room.questionIndex).toBe(1);
      expect(room.buzzes).toEqual([]);
      expect(room.winnerId).toBeNull();
      expect(room.players).toEqual(before.players);
      expect(room.judgements).toEqual([]);
      expect(room.showScoreboard).toBe(false);
    },
  );

  it('keeps the lockout list, so the Screen can still show who answered wrong', () => {
    const { room } = ok(act(inPhase('OPEN', 1, { lockedOut: ['p2'] }), { type: 'host:reveal' }));
    expect(room.lockedOut).toEqual(['p2']);
  });
});

describe('reduce: host:next', () => {
  it('moves REVEAL to the next QUESTION and resets buzzes, winner and lockout', () => {
    const { room } = ok(act(inPhase('REVEAL', 0, dirty), { type: 'host:next' }));
    expect(room.phase).toBe('QUESTION');
    expect(room.questionIndex).toBe(1);
    expect(room.buzzes).toEqual([]);
    expect(room.winnerId).toBeNull();
    expect(room.lockedOut).toEqual([]);
  });

  it('moves to FINAL after the last question', () => {
    const { room } = ok(act(inPhase('REVEAL', 2, dirty), { type: 'host:next' }));
    expect(room.phase).toBe('FINAL');
    expect(room.questionIndex).toBe(2);
  });

  it('opens the buzzers at once when autoOpenBuzzers is on', () => {
    const settings = { ...makeRoom().settings, autoOpenBuzzers: true };
    const { room } = ok(act(inPhase('REVEAL', 0, { ...dirty, settings }), { type: 'host:next' }));
    expect(room.phase).toBe('OPEN');
    expect(room.questionIndex).toBe(1);
    expect(room.openingCounter).toBe(3);
    expect(room.buzzes).toEqual([]);
    expect(room.lockedOut).toEqual([]);
  });

  it('does not auto-open past the last question', () => {
    const settings = { ...makeRoom().settings, autoOpenBuzzers: true };
    const { room } = ok(act(inPhase('REVEAL', 2, { settings }), { type: 'host:next' }));
    expect(room.phase).toBe('FINAL');
    expect(room.openingCounter).toBe(2);
  });

  it('shows the scoreboard when the finished question number is a multiple of scoreboardEvery', () => {
    const set = makeSet(10);
    const settings = { ...makeRoom().settings, scoreboardEvery: 3 };
    const shown = [0, 1, 2, 3, 4, 5].map(
      (index) =>
        ok(act(inPhase('REVEAL', index, { set, settings }), { type: 'host:next' })).room
          .showScoreboard,
    );
    // Finished question numbers 1..6: multiples of 3 are 3 and 6.
    expect(shown).toEqual([false, false, true, false, false, true]);
  });

  it('hides a showing scoreboard when the finished question is not a multiple', () => {
    const settings = { ...makeRoom().settings, scoreboardEvery: 5 };
    const { room } = ok(
      act(inPhase('REVEAL', 0, { settings, showScoreboard: true }), { type: 'host:next' }),
    );
    expect(room.showScoreboard).toBe(false);
  });

  it('never shows the scoreboard automatically when scoreboardEvery is 0', () => {
    const set = makeSet(10);
    const settings = { ...makeRoom().settings, scoreboardEvery: 0 };
    for (let index = 0; index < 9; index++) {
      const { room } = ok(act(inPhase('REVEAL', index, { set, settings }), { type: 'host:next' }));
      expect(room.showScoreboard).toBe(false);
    }
  });

  it('applies scoreboardEvery to the last question too', () => {
    const settings = { ...makeRoom().settings, scoreboardEvery: 3 };
    const { room } = ok(act(inPhase('REVEAL', 2, { settings }), { type: 'host:next' }));
    expect(room.phase).toBe('FINAL');
    expect(room.showScoreboard).toBe(true);
  });
});

describe('reduce: host:prev', () => {
  it.each<Phase>(['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL'])(
    'moves %s to the previous QUESTION, keeps scores and resets buzzes, winner and lockout',
    (phase) => {
      const before = inPhase(phase, 2, dirty);
      const { room } = ok(act(before, { type: 'host:prev' }));
      expect(room.phase).toBe('QUESTION');
      expect(room.questionIndex).toBe(1);
      expect(room.players).toEqual(before.players);
      expect(room.buzzes).toEqual([]);
      expect(room.winnerId).toBeNull();
      expect(room.lockedOut).toEqual([]);
    },
  );

  it('is rejected on the first question (DECISIONS #8)', () => {
    expect(act(inPhase('REVEAL', 0), { type: 'host:prev' })).toEqual({
      ok: false,
      error: 'Already on the first question',
    });
  });

  it('opens the buzzers at once when autoOpenBuzzers is on', () => {
    const settings = { ...makeRoom().settings, autoOpenBuzzers: true };
    const { room } = ok(act(inPhase('REVEAL', 2, { settings }), { type: 'host:prev' }));
    expect(room.phase).toBe('OPEN');
    expect(room.questionIndex).toBe(1);
    expect(room.openingCounter).toBe(3);
  });

  it('leaves the scoreboard overlay as it was', () => {
    const { room } = ok(act(inPhase('REVEAL', 2, { showScoreboard: true }), { type: 'host:prev' }));
    expect(room.showScoreboard).toBe(true);
  });
});

describe('reduce: host:end', () => {
  it.each<Phase>(['LOBBY', 'QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL', 'FINAL'])(
    'moves %s to FINAL and changes nothing else',
    (phase) => {
      const before = inPhase(phase, 1, { ...dirty, showScoreboard: true });
      const { room } = ok(act(before, { type: 'host:end' }));
      expect(room).toEqual({ ...before, phase: 'FINAL', lastActivityAt: NOW });
    },
  );
});

describe('reduce: host:scoreboard', () => {
  it.each<Phase>(['LOBBY', 'QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL', 'FINAL'])(
    'shows and hides the overlay in %s without changing phase',
    (phase) => {
      const before = inPhase(phase, 1, dirty);
      const shown = ok(act(before, { type: 'host:scoreboard', show: true })).room;
      expect(shown).toEqual({ ...before, showScoreboard: true, lastActivityAt: NOW });
      const hidden = ok(act(shown, { type: 'host:scoreboard', show: false })).room;
      expect(hidden.showScoreboard).toBe(false);
      expect(hidden.phase).toBe(phase);
    },
  );
});

describe('reduce: flow actions in the wrong phase', () => {
  const PHASES: Phase[] = ['LOBBY', 'QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL', 'FINAL'];
  const ALLOWED: Record<string, { action: Action; phases: Phase[] }> = {
    'host:start': { action: { type: 'host:start' }, phases: ['LOBBY'] },
    'host:open': { action: { type: 'host:open' }, phases: ['QUESTION'] },
    'host:reveal': {
      action: { type: 'host:reveal' },
      phases: ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'],
    },
    'host:next': { action: { type: 'host:next' }, phases: ['REVEAL'] },
    'host:prev': {
      action: { type: 'host:prev' },
      phases: ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL'],
    },
    'host:end': { action: { type: 'host:end' }, phases: PHASES },
    'host:scoreboard': { action: { type: 'host:scoreboard', show: true }, phases: PHASES },
  };

  const rejected = Object.entries(ALLOWED).flatMap(([name, { action, phases }]) =>
    PHASES.filter((phase) => !phases.includes(phase)).map((phase) => ({ name, action, phase })),
  );

  it.each(rejected)(
    'rejects $name in $phase and leaves the room as it was',
    ({ action, phase }) => {
      // LOBBY sits at index -1; question phases use a middle question so prev/next are possible.
      const room = inPhase(phase, phase === 'LOBBY' ? -1 : 1);
      const snapshot = structuredClone(room);
      expect(act(room, action)).toEqual({ ok: false, error: WRONG_PHASE_ERROR });
      expect(room).toEqual(snapshot);
    },
  );
});
