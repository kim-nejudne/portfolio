import { describe, expect, it } from 'vitest';
import type { InkOp } from '../../../shared/types.js';
import { applyInkOps, createInkPicture, createScreenInk, visibleStrokes } from './ink.js';

function picture(...batches: InkOp[][]) {
  const pic = createInkPicture(7);
  for (const ops of batches) applyInkOps(pic, ops);
  return pic;
}

describe('ink picture (Screen v0)', () => {
  it('turns b/p/e ops into absolute points, deltas relative to the previous point', () => {
    const pic = picture([
      ['b', 1, 2, 1, 100, 200],
      ['p', 1, 4, -1, 6, -2],
      ['e', 1],
    ]);
    expect(visibleStrokes(pic)).toEqual([
      { id: 1, color: 2, size: 1, points: [100, 200, 104, 199, 110, 197], ended: true },
    ]);
  });

  it('continues a stroke across batches', () => {
    const pic = picture(
      [['b', 1, 0, 1, 10, 10]],
      [['p', 1, 5, 5]],
      [
        ['p', 1, -1, 0],
        ['e', 1],
      ],
    );
    expect(visibleStrokes(pic)[0]?.points).toEqual([10, 10, 15, 15, 14, 15]);
  });

  it('ignores points for a stroke it never saw begin (a Screen that joined mid-stroke)', () => {
    const result = applyInkOps(createInkPicture(7), [
      ['p', 3, 4, 4],
      ['e', 3],
    ]);
    expect(result.dirty).toEqual([]);
  });

  it('reports the strokes to draw incrementally, and asks for a redraw on undo and clear', () => {
    const pic = createInkPicture(7);
    expect(applyInkOps(pic, [['b', 1, 0, 1, 1, 1]])).toEqual({ dirty: [1], redraw: false });
    expect(applyInkOps(pic, [['c']])).toEqual({ dirty: [], redraw: true });
    expect(applyInkOps(pic, [['u']])).toEqual({ dirty: [], redraw: true });
  });

  it('a clear hides every earlier stroke; later strokes stay visible', () => {
    const pic = picture([['b', 1, 0, 1, 1, 1], ['e', 1], ['c'], ['b', 2, 1, 1, 5, 5], ['e', 2]]);
    expect(visibleStrokes(pic).map((s) => s.id)).toEqual([2]);
  });

  it('undo removes the last stroke, and undoing a clear brings the strokes back', () => {
    const pic = picture([['b', 1, 0, 1, 1, 1], ['e', 1], ['b', 2, 0, 1, 2, 2], ['e', 2], ['c']]);
    expect(visibleStrokes(pic)).toEqual([]);
    applyInkOps(pic, [['u']]);
    expect(visibleStrokes(pic).map((s) => s.id)).toEqual([1, 2]);
    applyInkOps(pic, [['u']]);
    expect(visibleStrokes(pic).map((s) => s.id)).toEqual([1]);
  });

  it('undo on an empty picture does nothing', () => {
    const pic = picture([['u']]);
    expect(visibleStrokes(pic)).toEqual([]);
  });
});

describe('Screen ink feed', () => {
  it('ink:turn clears the picture for the new turn', () => {
    const feed = createScreenInk();
    feed.batch([1, 1, [['b', 1, 0, 1, 1, 1]]]);
    feed.turn(2);
    expect(feed.picture()?.turnId).toBe(2);
    expect(visibleStrokes(feed.picture()!)).toEqual([]);
  });

  it('ignores a batch from an older turn', () => {
    const feed = createScreenInk();
    feed.turn(3);
    feed.batch([2, 5, [['b', 1, 0, 1, 1, 1]]]);
    expect(visibleStrokes(feed.picture()!)).toEqual([]);
  });

  it('a batch from a newer turn than it knows starts that turn (ink:turn arrived late or before load)', () => {
    const feed = createScreenInk();
    feed.turn(1);
    feed.batch([1, 1, [['b', 1, 0, 1, 1, 1]]]);
    feed.batch([2, 1, [['b', 1, 3, 1, 9, 9]]]);
    expect(feed.picture()?.turnId).toBe(2);
    expect(visibleStrokes(feed.picture()!).map((s) => s.color)).toEqual([3]);
  });

  it('a repeated ink:turn for the current turn keeps the drawing', () => {
    const feed = createScreenInk();
    feed.turn(4);
    feed.batch([4, 1, [['b', 1, 0, 1, 1, 1]]]);
    feed.turn(4);
    expect(visibleStrokes(feed.picture()!)).toHaveLength(1);
  });

  it('tells listeners what to repaint', () => {
    const feed = createScreenInk();
    const seen: unknown[] = [];
    feed.subscribe((change) => seen.push(change));
    feed.turn(1);
    feed.batch([1, 1, [['b', 9, 0, 1, 1, 1]]]);
    expect(seen).toEqual([
      { dirty: [], redraw: true },
      { dirty: [9], redraw: false },
    ]);
  });
});
