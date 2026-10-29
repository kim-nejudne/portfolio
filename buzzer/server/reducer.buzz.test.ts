import { describe, expect, it } from 'vitest';
import { COLLECTION_WINDOW_MS, DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Phase, Room } from '../shared/types.js';
import { reduce, type Action, type Effect, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeRoom, withPlayers } from './test/rooms.js';

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;

function act(room: Room, action: Action, now = NOW): ReduceResult {
  return reduce(room, action, now);
}

/** A buzz from `playerId`, received at monotonic `receivedAt` ms. */
function press(playerId: string, receivedAt: number): Action {
  return { type: 'player:buzz', playerId, receivedAt };
}

/** Runs `actions` in order, failing on the first rejection. */
function run(room: Room, ...actions: Action[]): { room: Room; effects: Effect[] } {
  let effects: Effect[] = [];
  for (const action of actions) ({ room, effects } = ok(act(room, action)));
  return { room, effects };
}

/**
 * Three players (p1, p2, p3) who joined before the current opening, on question 2 of 3 in
 * `phase`, with the buzzers opened twice so far.
 */
function inPhase(phase: Phase, overrides: Partial<Room> = {}): Room {
  return withPlayers(makeRoom({ phase, questionIndex: 1, openingCounter: 2, ...overrides }), [
    makePlayer('p1', { joinedAt: T0 + 1, joinedAtOpening: 0 }),
    makePlayer('p2', { joinedAt: T0 + 2, joinedAtOpening: 1 }),
    makePlayer('p3', { joinedAt: T0 + 3, joinedAtOpening: 1, rttMs: 100 }),
  ]);
}

const windowClosed = (room: Room): Action => ({
  type: 'windowClosed',
  questionIndex: room.questionIndex,
  openingCounter: room.openingCounter,
});

describe('reduce: player:buzz opens the collection window', () => {
  it('moves OPEN to COLLECTING on the first valid buzz', () => {
    const { room } = ok(act(inPhase('OPEN'), press('p1', 500)));
    expect(room.phase).toBe('COLLECTING');
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p1']);
  });

  it('schedules windowClosed for now + 150 ms with the question index and opening counter', () => {
    const { effects } = ok(act(inPhase('OPEN'), press('p1', 500)));
    expect(effects).toContainEqual({
      type: 'schedule',
      at: NOW + COLLECTION_WINDOW_MS,
      action: { type: 'windowClosed', questionIndex: 1, openingCounter: 2 },
    });
  });

  it('schedules the window only once per opening', () => {
    const { effects } = run(inPhase('OPEN'), press('p1', 500), press('p2', 520));
    expect(effects.filter((e) => e.type === 'schedule')).toEqual([]);
  });

  it('stamps the buzz with the monotonic receive time and the player’s latency correction', () => {
    const { room } = run(inPhase('OPEN'), press('p1', 500), press('p3', 520));
    expect(room.buzzes).toEqual([
      { playerId: 'p1', receivedAt: 500, oneWayMs: 0, adjustedAt: 500 },
      { playerId: 'p3', receivedAt: 520, oneWayMs: 50, adjustedAt: 470 },
    ]);
  });

  it('accepts other buzzes during COLLECTING without changing phase', () => {
    const { room } = run(inPhase('OPEN'), press('p1', 500), press('p2', 520), press('p3', 600));
    expect(room.phase).toBe('COLLECTING');
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('reduce: player:buzz is logged', () => {
  it('logs every counted buzz with receive time, one-way latency and adjusted time', () => {
    const first = ok(act(inPhase('OPEN'), press('p3', 500)));
    const second = ok(act(first.room, press('p1', 510)));
    const logs = [...first.effects, ...second.effects].filter((e) => e.type === 'log');
    expect(logs).toEqual([
      {
        type: 'log',
        questionIndex: 1,
        openingCounter: 2,
        buzz: { playerId: 'p3', receivedAt: 500, oneWayMs: 50, adjustedAt: 450 },
      },
      {
        type: 'log',
        questionIndex: 1,
        openingCounter: 2,
        buzz: { playerId: 'p1', receivedAt: 510, oneWayMs: 0, adjustedAt: 510 },
      },
    ]);
  });

  it('logs nothing for an ignored buzz', () => {
    const { effects } = ok(act(inPhase('QUESTION'), press('p1', 500)));
    expect(effects).toEqual([]);
  });
});

describe('reduce: player:buzz ignores presses that do not count', () => {
  /** An ignored buzz succeeds silently and hands back the very same room. */
  function expectIgnored(room: Room, action: Action) {
    const result = ok(act(room, action));
    expect(result.room).toBe(room);
    expect(result.effects).toEqual([]);
  }

  for (const phase of ['LOBBY', 'QUESTION', 'REVEAL', 'FINAL'] as const) {
    it(`ignores an early or stray press in ${phase}`, () => {
      expectIgnored(inPhase(phase), press('p1', 500));
    });
  }

  it('ignores a second press from the same player in the same opening', () => {
    const { room } = run(inPhase('OPEN'), press('p1', 500));
    expectIgnored(room, press('p1', 510));
  });

  it('ignores a duplicate press that arrives after the window closed', () => {
    const { room } = run(inPhase('OPEN'), press('p1', 500), windowClosed(inPhase('OPEN')));
    expectIgnored(room, press('p1', 900));
  });

  it('ignores a locked-out player in OPEN and in COLLECTING', () => {
    expectIgnored(inPhase('OPEN', { lockedOut: ['p1'] }), press('p1', 500));
    const { room } = run(inPhase('OPEN', { lockedOut: ['p1'] }), press('p2', 500));
    expectIgnored(room, press('p1', 510));
  });

  it('ignores a player who joined during the current opening', () => {
    const { room } = run(inPhase('OPEN'), { type: 'player:join', playerId: 'new', name: 'New' });
    expectIgnored(room, press('new', 500));
  });

  it('still ignores a player who joined this opening after they reconnect', () => {
    const join: Action = { type: 'player:join', playerId: 'new', name: 'New' };
    const { room } = run(
      inPhase('OPEN'),
      join,
      { type: 'player:disconnect', playerId: 'new' },
      join,
    );
    expectIgnored(room, press('new', 500));
  });

  it('counts a player who joined during an earlier opening', () => {
    const joined = run(inPhase('BUZZED'), { type: 'player:join', playerId: 'new', name: 'New' });
    expect(joined.room.players.new?.joinedAtOpening).toBe(2);
    const reopened = { ...joined.room, phase: 'OPEN' as const, openingCounter: 3 };
    expect(ok(act(reopened, press('new', 500))).room.phase).toBe('COLLECTING');
  });

  it('counts a player who joined before the buzzers opened on this question', () => {
    const { room } = run(
      inPhase('QUESTION'),
      { type: 'player:join', playerId: 'new', name: 'New' },
      { type: 'host:open' },
      press('new', 500),
    );
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['new']);
  });

  it('does not stamp activity for an ignored press', () => {
    const room = inPhase('QUESTION');
    expect(ok(act(room, press('p1', 500))).room.lastActivityAt).toBe(T0);
  });

  it('rejects a buzz from a player who is not in the room', () => {
    expect(act(inPhase('OPEN'), press('ghost', 500))).toEqual({
      ok: false,
      error: 'Unknown player',
    });
  });
});

describe('reduce: windowClosed picks the winner', () => {
  it('moves COLLECTING to BUZZED and sets the lowest adjusted time as winner', () => {
    // p3's 50 ms one-way correction puts its 520 ms arrival at 470, ahead of p1 at 500.
    const open = inPhase('OPEN');
    const { room } = run(open, press('p1', 500), press('p3', 520), windowClosed(open));
    expect(room.phase).toBe('BUZZED');
    expect(room.winnerId).toBe('p3');
  });

  it('emits fx buzz with the winner and every other buzz’s gap in rank order', () => {
    const open = inPhase('OPEN');
    const { effects } = run(
      open,
      press('p2', 560),
      press('p1', 500),
      press('p3', 520),
      windowClosed(open),
    );
    expect(effects).toEqual([
      {
        type: 'fx',
        fx: {
          kind: 'buzz',
          playerId: 'p3',
          gaps: [
            { playerId: 'p1', gapMs: 30 },
            { playerId: 'p2', gapMs: 90 },
          ],
        },
      },
    ]);
  });

  it('breaks an exact tie by earliest arrival, then by join order', () => {
    const open = inPhase('OPEN');
    // p2 joined after p1; both arrive at 500 with no correction.
    const { room } = run(open, press('p2', 500), press('p1', 500), windowClosed(open));
    expect(room.winnerId).toBe('p1');
  });

  it('keeps every buzz of the window for the also-buzzed list', () => {
    const open = inPhase('OPEN');
    const { room } = run(open, press('p1', 500), press('p2', 520), windowClosed(open));
    expect(room.buzzes.map((b) => b.playerId).sort()).toEqual(['p1', 'p2']);
  });
});

describe('reduce: late buzzes in BUZZED', () => {
  it('records a press after the window for the also-buzzed list, without changing the winner', () => {
    const open = inPhase('OPEN');
    const { room, effects } = run(open, press('p1', 500), windowClosed(open), press('p3', 660));
    expect(room.phase).toBe('BUZZED');
    expect(room.winnerId).toBe('p1');
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p1', 'p3']);
    expect(effects).toEqual([
      {
        type: 'log',
        questionIndex: 1,
        openingCounter: 2,
        buzz: { playerId: 'p3', receivedAt: 660, oneWayMs: 50, adjustedAt: 610 },
      },
    ]);
  });

  it('ignores a late press from a locked-out player', () => {
    const open = inPhase('OPEN', { lockedOut: ['p3'] });
    const { room } = run(open, press('p1', 500), windowClosed(open));
    expect(ok(act(room, press('p3', 660))).room).toBe(room);
  });
});

describe('reduce: a stale windowClosed is a no-op', () => {
  /** A stale timer succeeds and hands back the very same room, with no effects. */
  function expectNoop(room: Room, action: Action) {
    const result = ok(act(room, action));
    expect(result.room).toBe(room);
    expect(result.effects).toEqual([]);
  }

  it('is ignored after host:reveal', () => {
    const open = inPhase('OPEN');
    const { room } = run(open, press('p1', 500), { type: 'host:reveal' });
    expectNoop(room, windowClosed(open));
  });

  it('is ignored after host:prev, even when the buzzers reopen on the earlier question', () => {
    const open = inPhase('OPEN', {
      settings: { ...inPhase('OPEN').settings, autoOpenBuzzers: true },
    });
    const { room } = run(open, press('p1', 500), { type: 'host:prev' }, press('p2', 900));
    expect(room.phase).toBe('COLLECTING');
    expectNoop(room, windowClosed(open));
  });

  it('is ignored after a new opening of the same question', () => {
    const open = inPhase('OPEN');
    // Back to question 1 by prev, reveal, next; then a new opening and a new first buzz.
    const { room } = run(
      open,
      press('p1', 500),
      { type: 'host:prev' },
      { type: 'host:reveal' },
      { type: 'host:next' },
      { type: 'host:open' },
      press('p2', 900),
    );
    expect(room).toMatchObject({ phase: 'COLLECTING', questionIndex: 1, openingCounter: 3 });
    expectNoop(room, windowClosed(open));
  });

  it('is ignored once the window has already closed', () => {
    const open = inPhase('OPEN');
    const { room } = run(open, press('p1', 500), windowClosed(open));
    expectNoop(room, windowClosed(open));
  });

  for (const phase of ['LOBBY', 'QUESTION', 'OPEN', 'BUZZED', 'REVEAL', 'FINAL'] as const) {
    it(`is ignored in ${phase}`, () => {
      const room = inPhase(phase);
      expectNoop(room, windowClosed(room));
    });
  }
});

describe('reduce: player:buzz records a false start (F71)', () => {
  const on = (phase: Phase, falseStartMs: 500 | 1000 = 500, overrides: Partial<Room> = {}) =>
    inPhase(phase, { settings: { ...DEFAULT_SETTINGS, falseStartMs }, ...overrides });

  it('records a press in QUESTION and emits fx falseStart for that player', () => {
    const { room, effects } = ok(act(on('QUESTION'), press('p2', 500)));
    expect(room.falseStarts).toEqual(['p2']);
    expect(effects).toEqual([{ type: 'fx', fx: { kind: 'falseStart', playerId: 'p2' } }]);
    expect(room.phase).toBe('QUESTION');
    expect(room.buzzes).toEqual([]);
    expect(room.lastActivityAt).toBe(NOW);
  });

  it('records it at 1000 ms as at 500 ms', () => {
    expect(ok(act(on('QUESTION', 1000), press('p1', 500))).room.falseStarts).toEqual(['p1']);
  });

  it('records each player once per question: a second press changes nothing', () => {
    const first = ok(act(on('QUESTION'), press('p1', 500))).room;
    const second = ok(act(first, press('p1', 900)));
    expect(second.room).toBe(first);
    expect(second.effects).toEqual([]);
  });

  it('records several players in press order', () => {
    const { room } = run(on('QUESTION'), press('p3', 500), press('p1', 520), press('p3', 540));
    expect(room.falseStarts).toEqual(['p3', 'p1']);
  });

  it('also records a press while question 1 holds for its title card', () => {
    const room = on('QUESTION', 500, { questionIndex: 0, autoOpenAt: NOW + 2000 });
    expect(ok(act(room, press('p1', 500))).room.falseStarts).toEqual(['p1']);
  });

  it('ignores a press in QUESTION silently when the setting is off, as before', () => {
    const room = inPhase('QUESTION');
    const result = ok(act(room, press('p1', 500)));
    expect(result.room).toBe(room);
    expect(result.effects).toEqual([]);
  });

  for (const phase of ['LOBBY', 'REVEAL', 'FINAL'] as const) {
    it(`records nothing for a press in ${phase}`, () => {
      const room = on(phase);
      const result = ok(act(room, press('p1', 500)));
      expect(result.room).toBe(room);
      expect(result.effects).toEqual([]);
    });
  }

  it('records nothing for a press in OPEN: it is a buzz', () => {
    const { room } = ok(act(on('OPEN'), press('p1', 500)));
    expect(room.falseStarts).toEqual([]);
    expect(room.phase).toBe('COLLECTING');
  });

  it('rejects a press from a player who is not in the room', () => {
    expect(act(on('QUESTION'), press('ghost', 500))).toEqual({
      ok: false,
      error: 'Unknown player',
    });
  });

  it('starts every room with no false starts', () => {
    expect(makeRoom().falseStarts).toEqual([]);
  });
});
