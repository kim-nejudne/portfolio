import { describe, expect, it } from 'vitest';
import { INK_ACTION_OVERHEAD_BYTES, INK_RESEND_ASK_MS } from '../shared/constants.js';
import { applyInkOps, createInkStack, stackOps, visibleStrokes } from '../shared/ink.js';
import type { InkBatch, InkOp } from '../shared/types.js';
import { createInkStore, visibleBytes, type InkStoreLimits } from './inkStore.js';

const CODE = 'ABCD';
const T = 7;

const stroke = (id: number, x = 100, y = 100): InkOp[] => [
  ['b', id, 0, 1, x, y],
  ['p', id, 4, -1, 6, -2, 5, 0],
  ['e', id],
];

/** A store with a turn open, and a helper that applies batches numbered from 1. */
function live(limits?: Partial<InkStoreLimits>) {
  const store = createInkStore(limits);
  store.open(CODE, T);
  let seq = 0;
  const send = (ops: InkOp[], now = 0) => store.apply(CODE, [T, ++seq, ops], now);
  return { store, send };
}

/** What a Screen holds after applying `batches` to an empty stack. */
function rebuild(ops: readonly InkOp[]) {
  const stack = createInkStack();
  applyInkOps(stack, ops);
  return stack;
}

describe('InkStore sequence', () => {
  it('applies batches in order, and the snapshot rebuilds the exact action stack', () => {
    const { store, send } = live();
    expect(send(stroke(1)).kind).toBe('applied');
    send(stroke(2, 900, 900));
    send([['c']]);
    send(stroke(3, 50, 50));
    const log = store.turn(CODE)!;
    expect(log.lastSeq).toBe(4);

    const snap = store.snapshot(CODE)!;
    expect(snap).toMatchObject({ turnId: T, seq: 4 });
    const screen = rebuild(snap.actions);
    expect(screen.actions).toEqual(log.stack.actions);
    // Strokes under the clear are in the snapshot: undoing stroke 3 and the clear brings them back.
    applyInkOps(screen, [['u'], ['u']]);
    expect(visibleStrokes(screen).map((s) => s.id)).toEqual([1, 2]);
  });

  it('ignores a duplicate seq without touching the stack', () => {
    const { store, send } = live();
    send(stroke(1));
    const before = structuredClone(store.turn(CODE)!.stack.actions);
    expect(store.apply(CODE, [T, 1, [['c']]], 0)).toEqual({ kind: 'duplicate' });
    expect(store.turn(CODE)!.stack.actions).toEqual(before);
    expect(store.turn(CODE)!.lastSeq).toBe(1);
  });

  it('drops a batch after a gap and asks for the missing ones, at most once a second per gap', () => {
    const { store, send } = live();
    send(stroke(1));
    expect(store.apply(CODE, [T, 3, [['c']]], 0)).toEqual({ kind: 'gap', from: 2, ask: true });
    expect(store.apply(CODE, [T, 4, [['c']]], 10)).toEqual({ kind: 'gap', from: 2, ask: false });
    expect(store.apply(CODE, [T, 4, [['c']]], INK_RESEND_ASK_MS)).toEqual({
      kind: 'gap',
      from: 2,
      ask: true,
    });
    expect(store.turn(CODE)!.stack.actions).toHaveLength(1);
    expect(store.turn(CODE)!.lastSeq).toBe(1);

    // The resend fills the gap; the next gap asks again at once.
    expect(store.apply(CODE, [T, 2, stroke(2)], 1001).kind).toBe('applied');
    expect(store.apply(CODE, [T, 3, [['c']]], 1002).kind).toBe('applied');
    expect(store.apply(CODE, [T, 5, [['c']]], 1003)).toEqual({ kind: 'gap', from: 4, ask: true });
  });

  it('relays the batch unchanged when every op applied', () => {
    const { store } = live();
    const batch: InkBatch = [T, 1, stroke(1)];
    const out = store.apply(CODE, batch, 0);
    expect(out).toEqual({ kind: 'applied', relay: batch, full: false });
  });

  it('opens a newer turn on its first batch, freezing the last one', () => {
    const { store, send } = live();
    send(stroke(1));
    expect(store.apply(CODE, [T + 1, 1, stroke(1)], 0).kind).toBe('applied');
    expect(store.turn(CODE)!.turnId).toBe(T + 1);
    expect(store.frozen(CODE, T)).toEqual(stroke(1));
    // A batch for the older turn is refused.
    expect(store.apply(CODE, [T, 2, [['c']]], 0)).toEqual({ kind: 'closed' });
  });
});

describe('InkStore caps', () => {
  // `stroke(n)` counts 40 bytes: its `b` and `p` ops as encoded (an `e` adds nothing to keep).
  it('refuses new strokes once the visible picture passes the cap, and lets undo and clear through', () => {
    const { store, send } = live({ turnMax: 80 });
    send(stroke(1));
    send(stroke(2));
    expect(visibleBytes(store.turn(CODE)!)).toBeGreaterThanOrEqual(80);

    // Stroke 3 is refused whole: its begin, points and end are dropped from the relay too.
    const refused = send([...stroke(3), ['u']]);
    expect(refused).toEqual({ kind: 'applied', relay: [T, 3, [['u']]], full: true });
    expect(visibleStrokes(store.turn(CODE)!.stack).map((s) => s.id)).toEqual([1]);

    // Under the cap again after the undo: a new stroke is accepted.
    expect(send(stroke(4))).toMatchObject({ full: false });
    // A clear empties the visible picture, so drawing goes on.
    expect(send(stroke(5))).toMatchObject({ full: true, relay: [T, 5, []] });
    expect(send([['c'], ...stroke(6)])).toMatchObject({ full: false });
    expect(visibleStrokes(store.turn(CODE)!.stack).map((s) => s.id)).toEqual([6]);
  });

  it('cuts a stroke in progress where it passes the cap', () => {
    const { store, send } = live({ turnMax: 50 });
    send([
      ['b', 1, 0, 1, 10, 10],
      ['p', 1, 30, 30, 30, 30, 30, 30],
    ]);
    expect(visibleBytes(store.turn(CODE)!)).toBeLessThan(50);
    send([['p', 1, 30, 30]]);
    expect(visibleBytes(store.turn(CODE)!)).toBeGreaterThanOrEqual(50);
    const out = send([
      ['p', 1, 1, 1],
      ['e', 1],
    ]);
    expect(out).toEqual({ kind: 'applied', relay: [T, 3, [['e', 1]]], full: true });
    expect(store.turn(CODE)!.stack.actions[0]).toMatchObject({
      stroke: { points: [10, 10, 40, 40, 70, 70, 100, 100, 130, 130], ended: true },
    });
  });

  it('stops the whole stack at the hard cap: clears are refused there, undo still works', () => {
    const { store, send } = live({ turnMax: 10_000, hardMax: 200 });
    for (let i = 0; i < 10; i++) send(Array.from({ length: 10 }, (): InkOp => ['c']));
    const log = store.turn(CODE)!;
    expect(log.bytes).toBeLessThanOrEqual(200);
    expect(log.stack.actions).toHaveLength(40); // 5 bytes per clear
    expect(send([['c']])).toMatchObject({ full: true, relay: [T, 11, []] });
    expect(send([['u'], ['u']])).toMatchObject({ full: false });
    expect(log.stack.actions).toHaveLength(38);
    expect(log.bytes).toBe(190);
  });

  it('caps the strokes and clears on the stack, whatever their size', () => {
    const { store, send } = live({ maxActions: 3 });
    send([...stroke(1), ['c'], ...stroke(2)]);
    expect(send([['c'], ...stroke(3)])).toMatchObject({ full: true, relay: [T, 2, []] });
    expect(store.turn(CODE)!.stack.actions).toHaveLength(3);
    send([['u']]);
    expect(send(stroke(4))).toMatchObject({ full: false });
  });

  it('counts bytes back down on undo, so the stack and the counters agree', () => {
    const { store, send } = live();
    send(stroke(1));
    send([['c']]);
    send(stroke(2));
    send([['u'], ['u'], ['u']]);
    const log = store.turn(CODE)!;
    expect(log.stack.actions).toEqual([]);
    expect(log.bytes).toBe(0);
    expect(visibleBytes(log)).toBe(0);
  });

  it('the relayed batches rebuild the same stack as the store, refusals included', () => {
    const { store, send } = live({ turnMax: 120, hardMax: 400 });
    const relayed: InkOp[] = [];
    const script: InkOp[][] = [
      stroke(1),
      stroke(2),
      stroke(3),
      [['c'], ...stroke(4)],
      [['u']],
      [['u'], ...stroke(5)],
      stroke(6),
      [['p', 99, 1, 1]], // a stroke that never began
    ];
    for (const ops of script) {
      const out = send(ops);
      if (out.kind === 'applied') relayed.push(...out.relay[2]);
    }
    expect(rebuild(relayed).actions).toEqual(store.turn(CODE)!.stack.actions);
    expect(rebuild(stackOps(store.turn(CODE)!.stack)).actions).toEqual(
      store.turn(CODE)!.stack.actions,
    );
  });
});

describe('InkStore freezing and the room budget', () => {
  it('freezes the log at close: no more batches, kept for the gallery and as the snapshot', () => {
    const { store, send } = live();
    send(stroke(1));
    store.close(CODE, T);
    expect(store.apply(CODE, [T, 2, stroke(2)], 0)).toEqual({ kind: 'closed' });
    expect(store.frozen(CODE, T)).toEqual(stroke(1));
    expect(store.snapshot(CODE)).toEqual({ turnId: T, seq: 1, actions: stroke(1) });
    expect(store.lastSeq(CODE, T)).toBeNull();
  });

  it('keeps no frozen copy of a live turn', () => {
    const { store, send } = live();
    send(stroke(1));
    expect(store.frozen(CODE, T)).toBeNull();
    expect(store.lastSeq(CODE, T)).toBe(1);
  });

  it('drops the oldest frozen logs past the room budget', () => {
    // Each turn counts 40 encoded bytes plus 64 for its one stroke: two fit, three don't.
    const store = createInkStore({ roomMax: 250 });
    for (const turnId of [1, 2, 3]) {
      store.open(CODE, turnId);
      store.apply(CODE, [turnId, 1, stroke(1)], 0);
      store.close(CODE, turnId);
    }
    expect(store.frozen(CODE, 1)).toBeNull();
    expect(store.frozen(CODE, 2)).toEqual(stroke(1));
    expect(store.frozen(CODE, 3)).toEqual(stroke(1));
    expect(store.keptBytes(CODE)).toBe(2 * (40 + INK_ACTION_OVERHEAD_BYTES));
  });

  it('drops everything on reset and forget', () => {
    const { store, send } = live();
    send(stroke(1));
    store.close(CODE, T);
    store.open(CODE, T + 1);
    store.reset(CODE);
    expect(store.snapshot(CODE)).toBeNull();
    expect(store.frozen(CODE, T)).toBeNull();
    store.open(CODE, T + 2);
    store.forget(CODE);
    expect(store.turn(CODE)).toBeUndefined();
    expect(store.keptBytes(CODE)).toBe(0);
  });

  it('keeps rooms apart', () => {
    const { store, send } = live();
    send(stroke(1));
    expect(store.snapshot('WXYZ')).toBeNull();
    expect(store.apply('WXYZ', [T, 1, stroke(1)], 0).kind).toBe('applied');
    expect(store.turn(CODE)!.stack.actions).toHaveLength(1);
  });
});
