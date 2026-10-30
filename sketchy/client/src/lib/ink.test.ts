import { describe, expect, it } from 'vitest';
import { visibleStrokes } from '../../../shared/ink.js';
import type { InkOp } from '../../../shared/types.js';
import { createScreenInk } from './ink.js';

// The action stack and codec are tested in `shared/ink.test.ts`; this is the Screen's feed.

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

describe('Screen ink feed: seq and snapshots', () => {
  const dot = (id: number): InkOp[] => [['b', id, 0, 1, id, id]];
  const ids = (feed: ReturnType<typeof createScreenInk>) =>
    visibleStrokes(feed.picture()!).map((s) => s.id);

  it('applies batches in seq order and drops a repeat', () => {
    const feed = createScreenInk();
    feed.turn(1);
    expect(feed.batch([1, 1, dot(1)])).toBe('ok');
    expect(feed.batch([1, 1, dot(9)])).toBe('ignored');
    expect(feed.batch([1, 2, dot(2)])).toBe('ok');
    expect(ids(feed)).toEqual([1, 2]);
  });

  it('on a gap, asks once for a snapshot and holds later batches until it arrives', () => {
    const feed = createScreenInk();
    feed.turn(1);
    feed.batch([1, 1, dot(1)]);
    expect(feed.batch([1, 3, dot(3)])).toBe('gap');
    expect(feed.batch([1, 4, dot(4)])).toBe('ignored');
    expect(ids(feed)).toEqual([1]);
    // The snapshot covers everything up to its seq; live batches continue after it.
    feed.snapshot({ turnId: 1, seq: 4, actions: [...dot(1), ...dot(2), ...dot(3), ...dot(4)] });
    expect(feed.batch([1, 4, dot(4)])).toBe('ignored');
    expect(feed.batch([1, 5, dot(5)])).toBe('ok');
    expect(ids(feed)).toEqual([1, 2, 3, 4, 5]);
  });

  it('a snapshot replaces the picture with the whole stack, strokes under a clear included', () => {
    const feed = createScreenInk();
    const seen: unknown[] = [];
    feed.subscribe((c) => seen.push(c));
    feed.snapshot({ turnId: 2, seq: 3, actions: [...dot(1), ['c'], ...dot(2)] });
    expect(feed.picture()).toMatchObject({ turnId: 2, seq: 3 });
    expect(ids(feed)).toEqual([2]);
    expect(seen).toEqual([{ dirty: [], redraw: true }]);
    feed.batch([2, 4, [['u'], ['u']]]);
    expect(ids(feed)).toEqual([1]);
  });

  it('ignores a snapshot of an older turn', () => {
    const feed = createScreenInk();
    feed.turn(5);
    feed.snapshot({ turnId: 4, seq: 2, actions: dot(1) });
    expect(feed.picture()).toMatchObject({ turnId: 5, seq: 0 });
  });

  it('a newer turn met mid-way (seq past 1) asks for a snapshot', () => {
    const feed = createScreenInk();
    feed.turn(1);
    expect(feed.batch([2, 6, dot(1)])).toBe('gap');
    expect(feed.picture()).toMatchObject({ turnId: 2, seq: 0 });
  });
});
