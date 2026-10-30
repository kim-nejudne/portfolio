import { describe, expect, it } from 'vitest';
import { visibleStrokes } from '../../../shared/ink.js';
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
