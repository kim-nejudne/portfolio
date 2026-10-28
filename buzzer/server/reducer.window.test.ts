import { describe, expect, it } from 'vitest';
import { COLLECTION_WINDOW_MS } from '../shared/constants.js';
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
