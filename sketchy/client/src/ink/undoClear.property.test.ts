// F31 property test: random drawing sessions with undo and clear at any moment (a finger still down
// included) leave identical action stacks on the drawer's pad, the server's ink log and every
// Screen: one watching live, one that joined late from a snapshot, and one that lost a batch and
// recovered from a snapshot. Each runs its own code path, the pad as `DrawPad` drives it, the
// server through `createInkStore`, the Screens through `createScreenInk`.
//
// The pad keeps every point it drew; the sender filters and simplifies what goes out. So the
// drawer's stack has the same actions (kind, strokeId, colour, size, ended) and, per stroke, the
// server's points are a subsequence of the pad's with the same first point and, once ended, the
// same last point. The server's and the Screens' stacks are equal point for point.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERASER_COLOR_INDEX, INK_FLUSH_MS, INK_GRID } from '../../../shared/constants.js';
import { createInkStack, pushStroke, visibleStrokes, type InkStack } from '../../../shared/ink.js';
import type { InkBatch } from '../../../shared/types.js';
import { createInkStore } from '../../../server/inkStore.js';
import { createRng, type SeededRng } from '../../../server/rng.js';
import { createScreenInk, type ScreenInk } from '../lib/ink.js';
import { createInkSender } from './inkSender.js';
import { padClear, padState, padUndo } from './padTools.js';

const CODE = 'ABCD';
const TURN = 3;
const SEEDS = 150;
const STEPS = 160;

/** An action stack as plain data, for deep comparison. */
const actions = (s: InkStack) =>
  s.actions.map((a) =>
    a.kind === 'clear'
      ? { kind: 'clear' as const }
      : {
          kind: 'stroke' as const,
          id: a.stroke.id,
          color: a.stroke.color,
          size: a.stroke.size,
          ended: a.stroke.ended,
          points: [...a.stroke.points],
        },
  );

/** The same, without the points (the pad keeps more of them than it sends). */
const shape = (s: InkStack) =>
  actions(s).map((a) => (a.kind === 'clear' ? a : { ...a, points: 0 }));

function isSubsequence(sub: readonly number[], of: readonly number[]): boolean {
  let j = 0;
  for (let i = 0; i + 1 < of.length && j + 1 < sub.length; i += 2)
    if (of[i] === sub[j] && of[i + 1] === sub[j + 1]) j += 2;
  return j >= sub.length;
}

/** One random session: the pad, the server and three Screens, wired as in the app. */
function session(seed: number) {
  const rng: SeededRng = createRng(seed);
  const store = createInkStore();
  store.open(CODE, TURN);

  const live = createScreenInk();
  live.turn(TURN);
  const lossy = createScreenInk();
  lossy.turn(TURN);
  let late: ScreenInk | null = null;
  /** A batch never reached the lossy Screen, which can't know until the next one arrives. */
  let lossyDropped = false;
  let lossyWaiting = false;

  const send = (batch: InkBatch) => {
    const out = store.apply(CODE, batch, 0);
    expect(out.kind).toBe('applied');
    if (out.kind !== 'applied') return;
    expect(out.full).toBe(false);
    // `inkGateway` relays to the Screens' room.
    live.batch(out.relay);
    late?.batch(out.relay);
    // Now and then a batch never reaches this Screen: the next one is a gap, and it asks for a
    // snapshot (`ink:hello`), which comes back after a few more batches have gone by.
    if (!lossyDropped && rng.next() < 0.08) {
      lossyDropped = true;
      return;
    }
    const got = lossy.batch(out.relay);
    if (lossyDropped && !lossyWaiting) {
      expect(got).toBe('gap');
      lossyWaiting = true;
    }
  };

  const sender = createInkSender({ turnId: TURN, send });
  const pad = createInkStack();
  let open: ReturnType<typeof pushStroke> | null = null;
  let x = 0;
  let y = 0;
  let undos = 0;
  let clears = 0;

  // `DrawPad`'s handlers, minus the DOM.
  const down = () => {
    x = rng.int(INK_GRID);
    y = rng.int(INK_GRID);
    const color = rng.next() < 0.15 ? ERASER_COLOR_INDEX : rng.int(8);
    const size = rng.int(3);
    open = pushStroke(pad, sender.begin(color, size, x, y), color, size, x, y);
  };
  const move = () => {
    if (!open) return;
    const step = () => rng.int(41) - 20;
    x = Math.min(INK_GRID - 1, Math.max(0, x + step()));
    y = Math.min(INK_GRID - 1, Math.max(0, y + step()));
    const p = open.points;
    if (p[p.length - 2] === x && p[p.length - 1] === y) return;
    p.push(x, y);
    sender.move(x, y);
  };
  const up = () => {
    if (!open) return;
    open.ended = true;
    open = null;
    sender.end();
  };
  const tool = (act: typeof padUndo) => {
    up();
    if (act(pad, sender)) {
      if (act === padUndo) undos++;
      else clears++;
    }
  };

  const syncLossy = () => {
    if (!lossyWaiting) return;
    lossy.snapshot(store.snapshot(CODE)!);
    lossyWaiting = lossyDropped = false;
  };

  /** Every model agrees once nothing is pending. */
  const check = () => {
    const server = store.turn(CODE)!.stack;
    const want = actions(server);
    expect(actions(live.picture()!)).toEqual(want);
    if (late) expect(actions(late.picture()!)).toEqual(want);
    if (!lossyDropped) expect(actions(lossy.picture()!)).toEqual(want);

    expect(shape(pad)).toEqual(shape(server));
    for (const [i, a] of pad.actions.entries()) {
      const b = server.actions[i]!;
      if (a.kind === 'clear' || b.kind === 'clear') continue;
      const [mine, sent] = [a.stroke.points, b.stroke.points];
      expect(isSubsequence(sent, mine)).toBe(true);
      expect(sent.slice(0, 2)).toEqual(mine.slice(0, 2));
      if (a.stroke.ended) expect(sent.slice(-2)).toEqual(mine.slice(-2));
    }
    expect(visibleStrokes(pad).map((s) => s.id)).toEqual(visibleStrokes(server).map((s) => s.id));
    expect(padState(pad, sender)).toEqual({
      ready: true,
      canUndo: server.actions.length > 0,
      canClear: visibleStrokes(server).length > 0,
    });
  };

  for (let i = 0; i < STEPS; i++) {
    const r = rng.next();
    if (!open && r < 0.2) down();
    else if (open && r < 0.55) move();
    else if (open && r < 0.65) up();
    else if (r < 0.77) tool(padUndo);
    else if (r < 0.83) tool(padClear);
    else if (r < 0.93) vi.advanceTimersByTime(INK_FLUSH_MS);
    else if (!late) late = createScreenInk();
    if (late && !late.picture()) late.snapshot(store.snapshot(CODE)!);
    if (rng.next() < 0.1) syncLossy();
    // Undo, clear and a lifted finger send at once; with no stroke open, nothing is pending.
    if (!open) {
      syncLossy();
      check();
    }
  }
  // The turn ends with whatever is still drawn: undo everything, back to an empty canvas.
  up();
  while (padUndo(pad, sender)) undos++;
  syncLossy();
  check();
  expect(store.turn(CODE)!.stack.actions).toEqual([]);
  return { undos, clears };
}

describe('undo and clear across drawer, server and Screen (F31)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('random op sequences give identical action stacks on drawer, server and Screen models', () => {
    let undos = 0;
    let clears = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      let n: ReturnType<typeof session>;
      try {
        n = session(seed);
      } catch (err) {
        throw new Error(`seed ${seed}: ${String(err)}`, { cause: err });
      }
      undos += n.undos;
      clears += n.clears;
    }
    // The sessions really exercise both tools (not a vacuous pass).
    expect(undos).toBeGreaterThan(SEEDS * 5);
    expect(clears).toBeGreaterThan(SEEDS);
  });
});
