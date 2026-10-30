import { describe, expect, it } from 'vitest';
import {
  INK_BATCH_MAX_BYTES,
  INK_GRID,
  INK_RADIAL_MIN,
  INK_RDP_EPSILON,
  INK_SEGMENT_MAX,
} from './constants.js';
import {
  applyInkOps,
  createInkStack,
  decodeDeltas,
  encodeDeltas,
  farEnough,
  packBatches,
  pushStroke,
  simplify,
  simplifyIndices,
  stackOps,
  strokeOps,
  visibleStrokes,
  type InkStroke,
} from './ink.js';
import { inkBatchSchema } from './schemas.js';
import type { InkOp } from './types.js';

function stackOf(...batches: InkOp[][]) {
  const stack = createInkStack();
  for (const ops of batches) applyInkOps(stack, ops);
  return stack;
}

/** A small seeded LCG, so the "random" strokes are the same on every run. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomStroke(rand: () => number, id: number, points: number): InkStroke {
  const pts = [Math.floor(rand() * INK_GRID), Math.floor(rand() * INK_GRID)];
  for (let i = 1; i < points; i++) {
    const step = (v: number) =>
      Math.min(INK_GRID - 1, Math.max(0, v + Math.floor(rand() * 61) - 30));
    pts.push(step(pts[pts.length - 2]!), step(pts[pts.length - 1]!));
  }
  return {
    id,
    color: Math.floor(rand() * 9),
    size: Math.floor(rand() * 3),
    points: pts,
    ended: true,
  };
}

/** Distance from point p to the segment a–b. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

describe('codec', () => {
  it('encodes each point relative to the previous one and decodes back to the same points', () => {
    const points = [416, 299, 422, 297, 427, 297, 0, 1023];
    const deltas = encodeDeltas(412, 300, points);
    expect(deltas).toEqual([4, -1, 6, -2, 5, 0, -427, 726]);
    expect(decodeDeltas(412, 300, deltas)).toEqual(points);
  });

  it('clamps decoded points to the grid, continuing from the clamped point', () => {
    expect(decodeDeltas(1020, 3, [10, -10, -5, 2])).toEqual([1023, 0, 1018, 2]);
  });

  it('turns a stroke into b, p (at most 200 points each) and e ops', () => {
    const stroke = randomStroke(lcg(1), 4, 450);
    const ops = strokeOps(stroke);
    expect(ops[0]).toEqual(['b', 4, stroke.color, stroke.size, stroke.points[0], stroke.points[1]]);
    expect(ops.slice(1, -1).map((op) => (op.length - 2) / 2)).toEqual([200, 200, 49]);
    expect(ops[ops.length - 1]).toEqual(['e', 4]);
    expect(strokeOps({ ...stroke, ended: false }).at(-1)?.[0]).toBe('p');
  });

  it('round-trips: replaying the ops of a stack rebuilds the same strokes and clears', () => {
    const rand = lcg(42);
    const stack = createInkStack();
    for (let id = 1; id <= 30; id++) {
      const stroke = randomStroke(rand, id, 1 + Math.floor(rand() * 300));
      applyInkOps(stack, strokeOps(stroke));
      if (id % 7 === 0) applyInkOps(stack, [['c']]);
      if (id % 5 === 0) applyInkOps(stack, [['u']]);
    }
    const ops = stackOps(stack);
    const rebuilt = stackOf(ops);
    expect(rebuilt.actions).toEqual(stack.actions);
    expect(visibleStrokes(rebuilt)).toEqual(visibleStrokes(stack));
    // And through batches that pass the server's schema.
    const batches = packBatches(9, 1, ops);
    for (const b of batches) expect(inkBatchSchema.safeParse(b).success).toBe(true);
    expect(stackOf(...batches.map((b) => b[2])).actions).toEqual(stack.actions);
  });

  it('packs ops into batches with seq counting up, none past 4 KB, in order', () => {
    const ops = strokeOps(randomStroke(lcg(3), 1, 2000));
    const batches = packBatches(7, 5, ops);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.map((b) => b[1])).toEqual(batches.map((_, i) => 5 + i));
    for (const b of batches) {
      expect(b[0]).toBe(7);
      expect(JSON.stringify(b).length).toBeLessThanOrEqual(INK_BATCH_MAX_BYTES);
    }
    expect(batches.flatMap((b) => b[2])).toEqual(ops);
    expect(packBatches(7, 1, [])).toEqual([]);
  });
});

describe('radial filter', () => {
  it(`keeps a point ${INK_RADIAL_MIN} or more grid units from the last kept point, drops a closer one`, () => {
    expect(INK_RADIAL_MIN).toBe(3);
    expect(farEnough(100, 100, 103, 100)).toBe(true);
    expect(farEnough(100, 100, 102, 102)).toBe(false); // 2.83
    expect(farEnough(100, 100, 102, 103)).toBe(true); // 3.61
    expect(farEnough(100, 100, 100, 100)).toBe(false);
  });
});

describe('RDP simplification', () => {
  it('drops points within ε = 1 of a straight line and keeps both ends', () => {
    expect(INK_RDP_EPSILON).toBe(1);
    expect(simplify([0, 0, 5, 1, 10, 0, 15, 1, 20, 0])).toEqual([0, 0, 20, 0]);
  });

  it(`keeps no gap over ${INK_SEGMENT_MAX} grid units where the drawn points allow it, so smoothed corners stay tight`, () => {
    expect(INK_SEGMENT_MAX).toBe(24);
    // A straight run of 5-unit steps, then a right angle.
    const run: number[] = [];
    for (let x = 0; x <= 100; x += 5) run.push(x, 0);
    for (let y = 5; y <= 100; y += 5) run.push(100, y);
    const kept = simplify(run);
    expect(kept.slice(-2)).toEqual([100, 100]);
    expect(kept).toContain(100);
    for (let i = 2; i < kept.length; i += 2)
      expect(Math.hypot(kept[i]! - kept[i - 2]!, kept[i + 1]! - kept[i - 1]!)).toBeLessThanOrEqual(
        INK_SEGMENT_MAX,
      );
    // The corner itself is kept, and far fewer points than drawn.
    expect(kept.join()).toContain('100,0');
    expect(kept.length).toBeLessThan(run.length / 2);
    // Points drawn further apart than the cap stay as they are.
    expect(simplify([0, 0, 100, 0, 200, 0])).toEqual([0, 0, 100, 0, 200, 0]);
  });

  it('keeps a corner further than ε from the line', () => {
    expect(simplify([0, 0, 50, 0, 50, 50])).toEqual([0, 0, 50, 0, 50, 50]);
    expect(simplify([0, 0, 10, 2, 20, 0])).toEqual([0, 0, 10, 2, 20, 0]);
  });

  it('leaves one or two points alone, and keeps a stroke that ends where it began', () => {
    expect(simplify([5, 5])).toEqual([5, 5]);
    expect(simplify([5, 5, 9, 9])).toEqual([5, 5, 9, 9]);
    expect(simplify([0, 0, 40, 0, 40, 40, 0, 0])).toEqual([0, 0, 40, 0, 40, 40, 0, 0]);
  });

  it('always keeps the first and last points, and every dropped point stays within ε', () => {
    const rand = lcg(7);
    for (let n = 0; n < 200; n++) {
      const { points } = randomStroke(rand, 1, 2 + Math.floor(rand() * 120));
      const count = points.length / 2;
      const kept = simplifyIndices(points);
      expect(kept[0]).toBe(0);
      expect(kept.at(-1)).toBe(count - 1);
      expect(simplify(points)).toEqual(kept.flatMap((i) => [points[2 * i], points[2 * i + 1]]));
      // Every point between two kept ones is within ε of the segment joining them.
      for (let k = 1; k < kept.length; k++) {
        const [a, b] = [kept[k - 1]!, kept[k]!];
        expect(b).toBeGreaterThan(a);
        for (let i = a + 1; i < b; i++) {
          const d = segmentDistance(
            points[2 * i]!,
            points[2 * i + 1]!,
            points[2 * a]!,
            points[2 * a + 1]!,
            points[2 * b]!,
            points[2 * b + 1]!,
          );
          expect(d).toBeLessThanOrEqual(INK_RDP_EPSILON);
        }
      }
    }
  });
});

describe('action stack', () => {
  it('turns b/p/e ops into absolute points, deltas relative to the previous point', () => {
    const stack = stackOf([
      ['b', 1, 2, 1, 100, 200],
      ['p', 1, 4, -1, 6, -2],
      ['e', 1],
    ]);
    expect(visibleStrokes(stack)).toEqual([
      { id: 1, color: 2, size: 1, points: [100, 200, 104, 199, 110, 197], ended: true },
    ]);
  });

  it('continues a stroke across batches', () => {
    const stack = stackOf(
      [['b', 1, 0, 1, 10, 10]],
      [['p', 1, 5, 5]],
      [
        ['p', 1, -1, 0],
        ['e', 1],
      ],
    );
    expect(visibleStrokes(stack)[0]?.points).toEqual([10, 10, 15, 15, 14, 15]);
  });

  it('ignores points for a stroke it never saw begin, or one already ended', () => {
    const stack = createInkStack();
    expect(
      applyInkOps(stack, [
        ['p', 3, 4, 4],
        ['e', 3],
      ]),
    ).toEqual({ dirty: [], redraw: false });
    applyInkOps(stack, [
      ['b', 1, 0, 1, 1, 1],
      ['e', 1],
      ['p', 1, 5, 5],
    ]);
    expect(visibleStrokes(stack)[0]?.points).toEqual([1, 1]);
  });

  it('reports the strokes to draw incrementally, and asks for a redraw on undo and clear', () => {
    const stack = createInkStack();
    expect(applyInkOps(stack, [['b', 1, 0, 1, 1, 1]])).toEqual({ dirty: [1], redraw: false });
    expect(applyInkOps(stack, [['c']])).toEqual({ dirty: [], redraw: true });
    expect(applyInkOps(stack, [['u']])).toEqual({ dirty: [], redraw: true });
    expect(applyInkOps(createInkStack(), [['u']])).toEqual({ dirty: [], redraw: false });
  });

  it('a clear hides every earlier stroke; later strokes stay visible', () => {
    const stack = stackOf([['b', 1, 0, 1, 1, 1], ['e', 1], ['c'], ['b', 2, 1, 1, 5, 5], ['e', 2]]);
    expect(visibleStrokes(stack).map((s) => s.id)).toEqual([2]);
  });

  it('undo removes the last stroke, then the one before, down to an empty canvas', () => {
    const stack = stackOf([
      ['b', 1, 0, 1, 1, 1],
      ['e', 1],
      ['b', 2, 0, 1, 2, 2],
      ['e', 2],
    ]);
    applyInkOps(stack, [['u']]);
    expect(visibleStrokes(stack).map((s) => s.id)).toEqual([1]);
    applyInkOps(stack, [['u'], ['u'], ['u']]);
    expect(visibleStrokes(stack)).toEqual([]);
    expect(stack.actions).toEqual([]);
  });

  it('undo of a clear restores the strokes it hid', () => {
    const stack = stackOf([['b', 1, 0, 1, 1, 1], ['e', 1], ['b', 2, 0, 1, 2, 2], ['e', 2], ['c']]);
    expect(visibleStrokes(stack)).toEqual([]);
    applyInkOps(stack, [['u']]);
    expect(visibleStrokes(stack).map((s) => s.id)).toEqual([1, 2]);
  });

  it('undo pops one action at a time across clears: stroke, clear, stroke, clear', () => {
    const stack = stackOf(
      [['b', 1, 0, 1, 1, 1], ['e', 1], ['c']],
      [['b', 2, 0, 1, 2, 2], ['e', 2], ['c']],
      [
        ['b', 3, 0, 1, 3, 3],
        ['e', 3],
      ],
    );
    const seen: number[][] = [visibleStrokes(stack).map((s) => s.id)];
    for (let i = 0; i < 5; i++) {
      applyInkOps(stack, [['u']]);
      seen.push(visibleStrokes(stack).map((s) => s.id));
    }
    expect(seen).toEqual([[3], [], [2], [], [1], []]);
  });

  it('a stroke drawn after an undo takes the undone one’s place', () => {
    const stack = stackOf(
      [['b', 1, 0, 1, 1, 1], ['e', 1], ['b', 2, 0, 1, 2, 2], ['e', 2], ['u']],
      [['b', 3, 4, 1, 3, 3], ['e', 3], ['c'], ['u']],
    );
    expect(visibleStrokes(stack).map((s) => s.id)).toEqual([1, 3]);
  });

  it('a p op for an undone stroke is ignored', () => {
    const stack = stackOf([['b', 1, 0, 1, 1, 1], ['u'], ['p', 1, 5, 5]]);
    expect(stack.actions).toEqual([]);
  });

  it('pushStroke starts a stroke the drawer extends locally, like a b op', () => {
    const stack = createInkStack();
    const stroke = pushStroke(stack, 1, 3, 2, 10, 20);
    stroke.points.push(30, 40);
    expect(visibleStrokes(stack)).toEqual([
      { id: 1, color: 3, size: 2, points: [10, 20, 30, 40], ended: false },
    ]);
  });
});
