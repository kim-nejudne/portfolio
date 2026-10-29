import { describe, expect, it } from 'vitest';
import { COLLECTION_WINDOW_MS, DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Fx, Phase, Room } from '../shared/types.js';
import { reduce, type Action, type Effect, type ReduceResult } from './reducer.js';
import { T0, makePlayer, makeRoom, withPlayers } from './test/rooms.js';
import { toView } from './views.js';

// F39: the collection window is measured in monotonic time from the first buzz's `receivedAt`.

function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected ok, got error: ${result.error}`);
  return result;
}

const NOW = T0 + 10_000;
const START = 500;

function run(room: Room, ...actions: Action[]): { room: Room; effects: Effect[] } {
  let effects: Effect[] = [];
  for (const action of actions) ({ room, effects } = ok(reduce(room, action, NOW)));
  return { room, effects };
}

const press = (playerId: string, receivedAt: number): Action => ({
  type: 'player:buzz',
  playerId,
  receivedAt,
});

/**
 * p1 and p2 on a fast link; p3's 300 ms RTT gives the full 150 ms correction, so a late arrival
 * from p3 can carry a lower `adjustedAt` than buzzes that made the window.
 */
function inPhase(phase: Phase, overrides: Partial<Room> = {}): Room {
  return withPlayers(makeRoom({ phase, questionIndex: 1, openingCounter: 2, ...overrides }), [
    makePlayer('p1', { joinedAt: T0 + 1 }),
    makePlayer('p2', { joinedAt: T0 + 2 }),
    makePlayer('p3', { joinedAt: T0 + 3, rttMs: 300 }),
  ]);
}

const windowClosed = (room: Room): Action => ({
  type: 'windowClosed',
  questionIndex: room.questionIndex,
  openingCounter: room.openingCounter,
});

const kick = (playerId: string): Action => ({ type: 'host:kick', playerId });

function buzzFx(effects: Effect[]): Extract<Fx, { kind: 'buzz' }> | undefined {
  for (const e of effects) if (e.type === 'fx' && e.fx.kind === 'buzz') return e.fx;
  return undefined;
}

describe('reduce: windowStartedAt', () => {
  it('stores the first buzz’s monotonic receivedAt when the window opens', () => {
    const { room } = run(inPhase('OPEN'), press('p1', START));
    expect(room.windowStartedAt).toBe(START);
  });

  it('keeps the first buzz’s time when more buzzes join the window', () => {
    const { room } = run(inPhase('OPEN'), press('p1', START), press('p2', START + 40));
    expect(room.windowStartedAt).toBe(START);
  });

  it('is null in a new room', () => {
    expect(makeRoom().windowStartedAt).toBeNull();
  });
});

describe('reduce: windowClosed ranks only buzzes inside the window', () => {
  it('counts a buzz received exactly 150 ms after the first, ahead of a later one', () => {
    const open = inPhase('OPEN');
    // p2 arrives at the edge with no correction; p3 arrives 1 ms later with a lower adjusted time.
    const { room, effects } = run(
      open,
      press('p1', START),
      press('p2', START + COLLECTION_WINDOW_MS),
      press('p3', START + COLLECTION_WINDOW_MS + 1),
      windowClosed(open),
    );
    expect(room.winnerId).toBe('p1');
    expect(buzzFx(effects)?.gaps.map((g) => g.playerId)).toEqual(['p2', 'p3']);
    expect(toView(room, 'screen').alsoBuzzed.map((g) => g.playerId)).toEqual(['p2', 'p3']);
  });

  it('a buzz received late while still COLLECTING cannot win, even with a lower adjustedTime', () => {
    const open = inPhase('OPEN');
    // p1 opens the window and is kicked before it closes. p2 made the window at adjusted 600;
    // p3 arrived after it (late timer) at adjusted 501, which would otherwise win.
    const { room } = run(
      open,
      press('p1', START),
      press('p2', START + 100),
      press('p3', START + COLLECTION_WINDOW_MS + 1),
    );
    expect(room.phase).toBe('COLLECTING');
    const p3 = room.buzzes.find((b) => b.playerId === 'p3');
    const p2 = room.buzzes.find((b) => b.playerId === 'p2');
    expect(p3!.adjustedAt).toBeLessThan(p2!.adjustedAt);

    const kicked = run(room, kick('p1')).room;
    // The window stays anchored to the opening's first buzz, as its timer is.
    expect(kicked.windowStartedAt).toBe(START);
    const closed = run(kicked, windowClosed(open));
    expect(closed.room.phase).toBe('BUZZED');
    expect(closed.room.winnerId).toBe('p2');
    // Kept for "also buzzed".
    expect(toView(closed.room, 'screen').alsoBuzzed.map((g) => g.playerId)).toEqual(['p3']);
  });

  it('reopens the buzzers when a kick leaves only late buzzes in the window', () => {
    const open = inPhase('OPEN');
    const { room } = run(
      open,
      press('p1', START),
      press('p3', START + COLLECTION_WINDOW_MS + 1),
      kick('p1'),
      windowClosed(open),
    );
    expect(room.phase).toBe('OPEN');
    expect(room.openingCounter).toBe(3);
    expect(room.buzzes).toEqual([]);
    expect(room.windowStartedAt).toBeNull();
    expect(room.winnerId).toBeNull();
  });

  it('ranks every buzz when no window start is recorded', () => {
    const room = inPhase('COLLECTING', {
      buzzes: [
        { playerId: 'p1', receivedAt: START, oneWayMs: 0, adjustedAt: START },
        { playerId: 'p3', receivedAt: START + 400, oneWayMs: 150, adjustedAt: START - 10 },
      ],
      windowStartedAt: null,
    });
    expect(run(room, windowClosed(room)).room.winnerId).toBe('p3');
  });
});

describe('reduce: windowStartedAt is cleared with the buzzes', () => {
  /** BUZZED on p1's buzz, with the window start recorded. */
  function buzzed(overrides: Partial<Room> = {}): Room {
    const open = inPhase('OPEN', overrides);
    const { room } = run(open, press('p1', START), windowClosed(open));
    expect(room.windowStartedAt).toBe(START);
    return room;
  }

  it('by host:reveal', () => {
    expect(run(buzzed(), { type: 'host:reveal' }).room.windowStartedAt).toBeNull();
  });

  it('by host:next', () => {
    const { room } = run(
      buzzed(),
      { type: 'host:judge', result: 'correct' },
      { type: 'host:next' },
    );
    expect(room.phase).toBe('QUESTION');
    expect(room.windowStartedAt).toBeNull();
  });

  it('by host:next into a question that opens its buzzers at once', () => {
    const settings = { ...inPhase('OPEN').settings, autoOpenBuzzers: true };
    const { room } = run(
      buzzed({ settings }),
      { type: 'host:judge', result: 'correct' },
      { type: 'host:next' },
    );
    expect(room.phase).toBe('OPEN');
    expect(room.windowStartedAt).toBeNull();
  });

  it('by host:next into FINAL', () => {
    const { room } = run(
      buzzed({ questionIndex: 2 }),
      { type: 'host:judge', result: 'correct' },
      { type: 'host:next' },
    );
    expect(room.phase).toBe('FINAL');
    expect(room.windowStartedAt).toBeNull();
  });

  it('by host:prev', () => {
    expect(run(buzzed(), { type: 'host:prev' }).room.windowStartedAt).toBeNull();
  });

  it('by the reopen after a wrong answer', () => {
    const judged = run(buzzed(), { type: 'host:judge', result: 'wrong' }).room;
    const { room } = run(judged, {
      type: 'reopen',
      questionIndex: judged.questionIndex,
      openingCounter: judged.openingCounter,
      at: judged.reopenAt!,
    });
    expect(room.phase).toBe('OPEN');
    expect(room.windowStartedAt).toBeNull();
  });

  it('by a kick of the unjudged winner, which reopens the buzzers', () => {
    const { room } = run(buzzed(), kick('p1'));
    expect(room.phase).toBe('OPEN');
    expect(room.windowStartedAt).toBeNull();
  });

  it('by a kick of the unjudged winner with nobody else eligible, which reveals', () => {
    const { room } = run(buzzed({ lockedOut: ['p2', 'p3'] }), kick('p1'));
    expect(room.phase).toBe('REVEAL');
    expect(room.windowStartedAt).toBeNull();
  });

  it('by a kick that empties the window', () => {
    const { room } = run(inPhase('OPEN'), press('p1', START), kick('p1'));
    expect(room.phase).toBe('OPEN');
    expect(room.windowStartedAt).toBeNull();
  });

  it('and restored with them by host:undo after a reopen', () => {
    const judged = run(buzzed(), { type: 'host:judge', result: 'wrong' }).room;
    const reopened = run(
      judged,
      {
        type: 'reopen',
        questionIndex: judged.questionIndex,
        openingCounter: judged.openingCounter,
        at: judged.reopenAt!,
      },
      press('p2', 2_000),
    ).room;
    expect(reopened.windowStartedAt).toBe(2_000);

    const { room } = run(reopened, { type: 'host:undo' });
    expect(room.phase).toBe('BUZZED');
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p1']);
    expect(room.windowStartedAt).toBe(START);
  });
});

// F71: a false starter's buzzes are ignored until `falseStartMs` after the opening, in monotonic time.
describe('reduce: the false-start wait', () => {
  const OPENED = 2_000;

  /** Runs `actions` in order with the gateway's monotonic time `mono`, failing on a rejection. */
  function at(mono: number, room: Room, ...actions: Action[]): { room: Room; effects: Effect[] } {
    let effects: Effect[] = [];
    for (const action of actions) ({ room, effects } = ok(reduce(room, action, NOW, mono)));
    return { room, effects };
  }

  /** p1 pressed early on question 2 with false starts at `falseStartMs`; the buzzers are shut. */
  function falseStarted(falseStartMs: 500 | 1000 = 500): Room {
    const room = inPhase('QUESTION', { settings: { ...DEFAULT_SETTINGS, falseStartMs } });
    return at(OPENED - 300, room, press('p1', OPENED - 300)).room;
  }

  const open: Action = { type: 'host:open' };

  /** The `reopen` that a wrong judgement scheduled. */
  function scheduledReopen(effects: Effect[]): Action {
    for (const e of effects)
      if (e.type === 'schedule' && e.action.type === 'reopen') return e.action;
    throw new Error('No reopen scheduled');
  }

  it('stamps the opening’s monotonic start, on host:open and on a reopen', () => {
    const opened = at(OPENED, falseStarted(), open).room;
    expect(opened.openedAt).toBe(OPENED);
    const judged = at(OPENED + 300, opened, press('p2', OPENED + 10), windowClosed(opened), {
      type: 'host:judge',
      result: 'wrong',
    });
    const reopened = at(OPENED + 2_000, judged.room, scheduledReopen(judged.effects)).room;
    expect(reopened.openedAt).toBe(OPENED + 2_000);
  });

  it('ignores the false starter’s press 1 ms before the wait ends and counts it at the end', () => {
    const opened = at(OPENED, falseStarted(), open).room;
    const early = at(OPENED + 499, opened, press('p1', OPENED + 499));
    expect(early.room).toBe(opened);
    expect(early.effects).toEqual([]);
    const { room } = at(OPENED + 500, opened, press('p1', OPENED + 500));
    expect(room.phase).toBe('COLLECTING');
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p1']);
  });

  it('holds for 1000 ms with the 1 s setting', () => {
    const opened = at(OPENED, falseStarted(1000), open).room;
    expect(at(OPENED + 999, opened, press('p1', OPENED + 999)).room).toBe(opened);
    expect(at(OPENED + 1000, opened, press('p1', OPENED + 1000)).room.phase).toBe('COLLECTING');
  });

  it('lets everyone else buzz at once', () => {
    const opened = at(OPENED, falseStarted(), open).room;
    const { room } = at(OPENED + 1, opened, press('p2', OPENED + 1));
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p2']);
  });

  it('ignores the false starter in the collection window and in BUZZED during the wait', () => {
    const opened = at(OPENED, falseStarted(), open).room;
    const collecting = at(OPENED + 10, opened, press('p2', OPENED + 10)).room;
    expect(at(OPENED + 20, collecting, press('p1', OPENED + 20)).room).toBe(collecting);
    const buzzed = at(OPENED + 160, collecting, windowClosed(collecting)).room;
    expect(at(OPENED + 400, buzzed, press('p1', OPENED + 400)).room).toBe(buzzed);
    // After the wait, a late press is listed again (DECISIONS #4).
    const late = at(OPENED + 600, buzzed, press('p1', OPENED + 600)).room;
    expect(late.buzzes.map((b) => b.playerId)).toEqual(['p2', 'p1']);
  });

  it('measures the wait from the opening, not from when the press was dispatched', () => {
    // A buzz that arrived inside the wait stays ignored even if the reducer runs it later.
    const opened = at(OPENED, falseStarted(), open).room;
    expect(at(OPENED + 900, opened, press('p1', OPENED + 400)).room).toBe(opened);
  });

  it('keeps the false starts when question 1’s title card hold opens the buzzers', () => {
    const shown = falseStarted();
    const held = { ...shown, questionIndex: 0, autoOpenAt: NOW + 1000 };
    const { questionIndex, openingCounter } = held;
    const opened = at(OPENED, held, {
      type: 'autoOpen',
      questionIndex,
      openingCounter,
      at: NOW + 1000,
    }).room;
    expect(opened.phase).toBe('OPEN');
    expect(opened.falseStarts).toEqual(['p1']);
    expect(at(OPENED + 100, opened, press('p1', OPENED + 100)).room).toBe(opened);
  });

  it('clears the false starts on a reopen after a wrong answer, so the player can buzz at once', () => {
    const opened = at(OPENED, falseStarted(), open).room;
    const judged = at(OPENED + 300, opened, press('p2', OPENED + 10), windowClosed(opened), {
      type: 'host:judge',
      result: 'wrong',
    });
    expect(judged.room.falseStarts).toEqual(['p1']);
    const REOPENED = OPENED + 2_000;
    const reopened = at(REOPENED, judged.room, scheduledReopen(judged.effects)).room;
    expect(reopened.phase).toBe('OPEN');
    expect(reopened.falseStarts).toEqual([]);
    const { room } = at(REOPENED + 1, reopened, press('p1', REOPENED + 1));
    expect(room.buzzes.map((b) => b.playerId)).toEqual(['p1']);
  });

  it('clears the false starts when a kick of the unjudged winner reopens the buzzers', () => {
    const opened = at(OPENED, falseStarted(), open).room;
    const buzzed = at(OPENED + 200, opened, press('p2', OPENED + 10), windowClosed(opened)).room;
    const reopened = at(OPENED + 300, buzzed, kick('p2')).room;
    expect(reopened.phase).toBe('OPEN');
    expect(reopened.falseStarts).toEqual([]);
    expect(at(OPENED + 301, reopened, press('p1', OPENED + 301)).room.phase).toBe('COLLECTING');
  });

  it('drops a kicked false starter from the list', () => {
    const room = at(OPENED, falseStarted(), kick('p1')).room;
    expect(room.falseStarts).toEqual([]);
  });

  it('clears the false starts on the next and the previous question', () => {
    const revealed = at(OPENED, falseStarted(), { type: 'host:reveal' }).room;
    expect(revealed.falseStarts).toEqual(['p1']);
    expect(at(OPENED, revealed, { type: 'host:next' }).room.falseStarts).toEqual([]);
    expect(at(OPENED, falseStarted(), { type: 'host:prev' }).room.falseStarts).toEqual([]);
  });

  it('releases the wait when the host turns false starts off', () => {
    const opened = at(OPENED, falseStarted(), open).room;
    const off = at(OPENED + 50, opened, { type: 'host:settings', settings: { falseStartMs: 0 } });
    expect(at(OPENED + 100, off.room, press('p1', OPENED + 100)).room.phase).toBe('COLLECTING');
  });

  it('holds nobody when the opening has no monotonic start', () => {
    const opened = ok(reduce(falseStarted(), open, NOW)).room;
    expect(opened.openedAt).toBeNull();
    expect(at(OPENED, opened, press('p1', OPENED)).room.phase).toBe('COLLECTING');
  });
});
