import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERASER_COLOR_INDEX } from '../../../shared/constants.js';
import {
  applyInkOps,
  createInkStack,
  pushStroke,
  visibleStrokes,
  type InkStack,
} from '../../../shared/ink.js';
import type { InkBatch } from '../../../shared/types.js';
import { createInkSender, type InkSender } from './inkSender.js';
import { padClear, padState, padUndo } from './padTools.js';

/** What the pad holds, and what the server (and so every Screen) rebuilds from the batches. */
function setup(started = true) {
  const sent: InkBatch[] = [];
  const sender = createInkSender({ turnId: 7, send: (b) => sent.push(b), held: !started });
  const pad = createInkStack();
  const server = () => {
    const s = createInkStack();
    for (const [, , ops] of sent) applyInkOps(s, ops);
    return s;
  };
  return { sent, sender, pad, server };
}

/** A stroke drawn on the pad and sent, as `DrawPad` does. */
function draw(pad: InkStack, sender: InkSender, color: number, size: number, x: number) {
  const id = sender.begin(color, size, x, 100);
  const stroke = pushStroke(pad, id, color, size, x, 100);
  for (const y of [200, 300, 400]) {
    stroke.points.push(x, y);
    sender.move(x, y);
  }
  stroke.ended = true;
  sender.end();
}

const picture = (s: InkStack) =>
  visibleStrokes(s).map(({ id, color, size }) => ({ id, color, size }));

describe('the pad’s undo and clear (F30)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('colours, sizes and the eraser reach the server as drawn', () => {
    const { sender, pad, server } = setup();
    draw(pad, sender, 1, 0, 100);
    draw(pad, sender, 5, 2, 200);
    draw(pad, sender, ERASER_COLOR_INDEX, 2, 150);
    expect(picture(pad)).toEqual([
      { id: 1, color: 1, size: 0 },
      { id: 2, color: 5, size: 2 },
      { id: 3, color: ERASER_COLOR_INDEX, size: 2 },
    ]);
    expect(picture(server())).toEqual(picture(pad));
  });

  it('undo takes the last stroke off the pad and the server alike, back to an empty canvas', () => {
    const { sender, pad, server, sent } = setup();
    draw(pad, sender, 0, 1, 100);
    draw(pad, sender, 3, 1, 200);
    expect(padUndo(pad, sender)).toBe(true);
    expect(sent[sent.length - 1]![2]).toEqual([['u']]);
    expect(picture(pad)).toEqual([{ id: 1, color: 0, size: 1 }]);
    expect(picture(server())).toEqual(picture(pad));
    expect(padUndo(pad, sender)).toBe(true);
    expect(picture(pad)).toEqual([]);
    expect(picture(server())).toEqual([]);
    expect(padState(pad, sender)).toEqual({ canUndo: false, canClear: false });
    const before = sent.length;
    expect(padUndo(pad, sender)).toBe(false);
    expect(sent).toHaveLength(before);
  });

  it('clear empties the canvas in one tap, and undo brings the drawing back', () => {
    const { sender, pad, server, sent } = setup();
    draw(pad, sender, 0, 1, 100);
    draw(pad, sender, 2, 0, 200);
    expect(padClear(pad, sender)).toBe(true);
    expect(sent[sent.length - 1]![2]).toEqual([['c']]);
    expect(picture(pad)).toEqual([]);
    expect(picture(server())).toEqual([]);
    expect(padState(pad, sender)).toEqual({ canUndo: true, canClear: false });
    // A clear on an empty canvas sends nothing.
    const before = sent.length;
    expect(padClear(pad, sender)).toBe(false);
    expect(sent).toHaveLength(before);
    expect(padUndo(pad, sender)).toBe(true);
    expect(picture(pad)).toHaveLength(2);
    expect(picture(server())).toEqual(picture(pad));
  });

  it('undo during a stroke ends it, then takes it off', () => {
    const { sender, pad, server } = setup();
    draw(pad, sender, 0, 1, 100);
    const id = sender.begin(4, 1, 300, 300);
    const open = pushStroke(pad, id, 4, 1, 300, 300);
    open.points.push(300, 400);
    sender.move(300, 400);
    expect(padUndo(pad, sender)).toBe(true);
    expect(picture(pad)).toEqual([{ id: 1, color: 0, size: 1 }]);
    expect(picture(server())).toEqual(picture(pad));
  });

  it('waits for the turn’s snapshot before undo or clear, so they never act on unseen ink', () => {
    const { sender, pad, sent } = setup(false);
    draw(pad, sender, 0, 1, 100);
    expect(padState(pad, sender)).toEqual({ canUndo: false, canClear: false });
    expect(padUndo(pad, sender)).toBe(false);
    expect(padClear(pad, sender)).toBe(false);
    expect(picture(pad)).toHaveLength(1);
    sender.start(0, 0);
    expect(padState(pad, sender)).toEqual({ canUndo: true, canClear: true });
    expect(sent.flatMap(([, , ops]) => ops).some((op) => op[0] === 'u' || op[0] === 'c')).toBe(
      false,
    );
  });
});
