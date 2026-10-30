import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INK_BATCH_MAX_BYTES,
  INK_FLUSH_MS,
  INK_GRID,
  INK_POINTS_PER_OP_MAX,
  INK_RADIAL_MIN,
  INK_RDP_EPSILON,
  INK_SEGMENT_MAX,
} from '../../../shared/constants.js';
import { applyInkOps, createInkStack, visibleStrokes } from '../../../shared/ink.js';
import { inkBatchSchema } from '../../../shared/schemas.js';
import type { InkBatch } from '../../../shared/types.js';
import { createInkSender, toGrid } from './inkSender.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function sender(turnId = 7) {
  const sent: InkBatch[] = [];
  return { sent, ink: createInkSender({ turnId, send: (b) => sent.push(b) }) };
}

describe('toGrid', () => {
  it('maps the canvas onto the 1024 grid, clamped to 0…1023', () => {
    expect(INK_GRID).toBe(1024);
    expect(toGrid(0, 300)).toBe(0);
    expect(toGrid(150, 300)).toBe(512);
    expect(toGrid(299.9, 300)).toBe(1023);
    expect(toGrid(300, 300)).toBe(1023);
    expect(toGrid(-12, 300)).toBe(0);
    expect(toGrid(900, 300)).toBe(1023);
    expect(toGrid(10, 0)).toBe(0);
    expect(toGrid(Number.NaN, 300)).toBe(0);
  });
});

describe('createInkSender', () => {
  it('sends b/p/e with relative points, seq from 1, at once when the stroke ends', () => {
    const { sent, ink } = sender();
    expect(ink.begin(0, 1, 412, 300)).toBe(1);
    ink.move(420, 300);
    ink.move(420, 310);
    ink.move(430, 310);
    expect(sent).toEqual([]);
    ink.end();
    expect(sent).toEqual([
      [
        7,
        1,
        [
          ['b', 1, 0, 1, 412, 300],
          ['p', 1, 8, 0, 0, 10, 10, 0],
          ['e', 1],
        ],
      ],
    ]);
    for (const b of sent) expect(inkBatchSchema.safeParse(b).success).toBe(true);
  });

  it(`drops a point closer than ${INK_RADIAL_MIN} grid units to the last kept one, but ends where the finger lifted`, () => {
    const { sent, ink } = sender();
    ink.begin(0, 1, 100, 100);
    ink.move(101, 101); // 1.4 from (100, 100): dropped
    ink.move(102, 102); // 2.8: dropped
    ink.move(100, 110); // 10: kept
    ink.move(101, 111); // 1.4 from (100, 110): dropped
    ink.move(110, 111); // kept
    ink.move(108, 112); // 2.2 from (110, 111): dropped, but it is where the finger lifts
    ink.end();
    expect(sent).toEqual([
      [
        7,
        1,
        [
          ['b', 1, 0, 1, 100, 100],
          ['p', 1, 0, 10, 10, 1, -2, 1],
          ['e', 1],
        ],
      ],
    ]);
  });

  it('a tap with no move is a dot: b then e, no p', () => {
    const { sent, ink } = sender();
    ink.begin(0, 1, 50, 50);
    ink.move(51, 50);
    ink.move(50, 50);
    ink.end();
    expect(sent).toEqual([
      [
        7,
        1,
        [
          ['b', 1, 0, 1, 50, 50],
          ['e', 1],
        ],
      ],
    ]);
  });

  it(`simplifies the pending points with RDP at ε = ${INK_RDP_EPSILON} before each flush, keeping the ends`, () => {
    const { sent, ink } = sender();
    ink.begin(0, 1, 0, 0);
    // An almost straight line (wobble of 1 unit) then a corner, in one flush window, all within
    // INK_SEGMENT_MAX so only RDP is at work.
    for (let x = 5; x <= 20; x += 5) ink.move(x, (x / 5) % 2);
    ink.move(20, 15);
    vi.advanceTimersByTime(INK_FLUSH_MS);
    expect(sent).toEqual([
      [
        7,
        1,
        [
          ['b', 1, 0, 1, 0, 0],
          ['p', 1, 20, 0, 0, 15],
        ],
      ],
    ]);
    // The next flush continues from the last point sent: (20, 15) is the anchor, and the last
    // pending point is kept even on a straight run.
    for (let y = 20; y <= 35; y += 5) ink.move(20, y);
    ink.end();
    expect(sent[1]).toEqual([
      7,
      2,
      [
        ['p', 1, 0, 20],
        ['e', 1],
      ],
    ]);
  });

  it(`never sends a gap over ${INK_SEGMENT_MAX} grid units on a long straight run into a corner`, () => {
    const { sent, ink } = sender();
    ink.begin(0, 1, 100, 100);
    for (let x = 105; x <= 600; x += 5) ink.move(x, 100);
    for (let y = 105; y <= 400; y += 5) ink.move(600, y);
    ink.end();
    const stack = createInkStack();
    for (const [, , ops] of sent) applyInkOps(stack, ops);
    const pts = visibleStrokes(stack)[0]!.points;
    // The corner is kept.
    expect(pts.some((v, k) => k % 2 === 0 && v === 600 && pts[k + 1] === 100)).toBe(true);
    for (let i = 2; i < pts.length; i += 2)
      expect(Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!)).toBeLessThanOrEqual(
        INK_SEGMENT_MAX,
      );
    expect(pts.length / 2).toBeLessThan(160 / 3);
  });

  it('undo and clear send at once, ending the stroke in hand first', () => {
    const { sent, ink } = sender();
    ink.begin(0, 1, 10, 10);
    ink.move(20, 10);
    ink.undo();
    expect(sent).toEqual([[7, 1, [['b', 1, 0, 1, 10, 10], ['p', 1, 10, 0], ['e', 1], ['u']]]]);
    ink.clear();
    expect(sent[1]).toEqual([7, 2, [['c']]]);
    ink.undo();
    expect(sent[2]).toEqual([7, 3, [['u']]]);
    // Strokes keep counting after an undo.
    expect(ink.begin(0, 1, 5, 5)).toBe(2);
    ink.dispose();
    ink.undo();
    ink.clear();
    expect(sent).toHaveLength(3);
  });

  it('what the Screen rebuilds from the batches is the drawn line within ε, from first to last point', () => {
    const { sent, ink } = sender();
    // A circle, drawn with a sample every few px, across several flush windows.
    const drawn: number[] = [];
    for (let i = 0; i <= 240; i++) {
      const x = Math.round(512 + 300 * Math.cos(i / 40));
      const y = Math.round(512 + 300 * Math.sin(i / 40));
      drawn.push(x, y);
      if (i === 0) ink.begin(0, 1, x, y);
      else ink.move(x, y);
      if (i % 10 === 0) vi.advanceTimersByTime(INK_FLUSH_MS);
    }
    ink.end();
    const stack = createInkStack();
    for (const [, , ops] of sent) applyInkOps(stack, ops);
    const [stroke] = visibleStrokes(stack);
    const pts = stroke!.points;
    expect(pts.slice(0, 2)).toEqual(drawn.slice(0, 2));
    expect(pts.slice(-2)).toEqual(drawn.slice(-2));
    expect(pts.length).toBeLessThan(drawn.length / 2);
    // End to end: every drawn point is within the radial filter plus ε of the rebuilt line (RDP
    // alone stays within ε; see shared/ink.test.ts).
    for (let i = 0; i < drawn.length; i += 2) {
      let best = Infinity;
      for (let j = 0; j + 3 < pts.length; j += 2)
        best = Math.min(
          best,
          segDist(drawn[i]!, drawn[i + 1]!, pts[j]!, pts[j + 1]!, pts[j + 2]!, pts[j + 3]!),
        );
      expect(best).toBeLessThanOrEqual(INK_RADIAL_MIN + INK_RDP_EPSILON);
    }
  });

  it('flushes every 50 ms while drawing, and sends nothing while the finger is still', () => {
    expect(INK_FLUSH_MS).toBe(50);
    const { sent, ink } = sender();
    ink.begin(2, 0, 100, 100);
    ink.move(110, 100);
    vi.advanceTimersByTime(INK_FLUSH_MS - 1);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([
      [
        7,
        1,
        [
          ['b', 1, 2, 0, 100, 100],
          ['p', 1, 10, 0],
        ],
      ],
    ]);

    // Still finger: no timer, no batch.
    vi.advanceTimersByTime(10 * INK_FLUSH_MS);
    expect(sent).toHaveLength(1);
    // A repeat of the last point is not a move.
    ink.move(110, 100);
    vi.advanceTimersByTime(10 * INK_FLUSH_MS);
    expect(sent).toHaveLength(1);

    ink.move(110, 120);
    vi.advanceTimersByTime(INK_FLUSH_MS);
    expect(sent[1]).toEqual([7, 2, [['p', 1, 0, 20]]]);
    ink.end();
    expect(sent[2]).toEqual([7, 3, [['e', 1]]]);
  });

  it('numbers strokes 1, 2, 3 and ends an open stroke before starting another', () => {
    const { sent, ink } = sender(3);
    ink.begin(0, 1, 10, 10);
    expect(ink.begin(1, 2, 20, 20)).toBe(2);
    ink.end();
    expect(ink.begin(0, 0, 30, 30)).toBe(3);
    ink.end();
    expect(sent).toEqual([
      [
        3,
        1,
        [
          ['b', 1, 0, 1, 10, 10],
          ['e', 1],
          ['b', 2, 1, 2, 20, 20],
          ['e', 2],
        ],
      ],
      [
        3,
        2,
        [
          ['b', 3, 0, 0, 30, 30],
          ['e', 3],
        ],
      ],
    ]);
  });

  it(`keeps each p op to ${INK_POINTS_PER_OP_MAX} points and each batch within 4 KB`, () => {
    const { sent, ink } = sender();
    ink.begin(0, 1, 0, 0);
    // A long zig-zag with big jumps (no three points in a line), all inside one flush window.
    for (let i = 1; i <= 1000; i++) ink.move(i % 2 ? 1023 : 0, (i * 37) % 1024);
    ink.end();
    expect(sent.length).toBeGreaterThan(1);
    expect(sent.map(([, seq]) => seq)).toEqual(sent.map((_, i) => i + 1));
    let points = 0;
    for (const [i, batch] of sent.entries()) {
      expect(JSON.stringify(batch).length).toBeLessThanOrEqual(INK_BATCH_MAX_BYTES);
      // Full batches are filled close to the cap, not split early.
      if (i < sent.length - 1) {
        expect(JSON.stringify(batch).length).toBeGreaterThan(INK_BATCH_MAX_BYTES - 2500);
      }
      expect(inkBatchSchema.safeParse(batch).success).toBe(true);
      for (const op of batch[2]) if (op[0] === 'p') points += (op.length - 2) / 2;
    }
    expect(points).toBe(1000);
  });

  it('ignores moves with no open stroke, and dispose drops pending ops and the timer', () => {
    const { sent, ink } = sender();
    ink.move(5, 5);
    ink.flush();
    expect(sent).toEqual([]);
    ink.begin(0, 1, 1, 1);
    ink.move(2, 2);
    ink.dispose();
    vi.advanceTimersByTime(10 * INK_FLUSH_MS);
    expect(sent).toEqual([]);
    // A late pointer event after the turn has ended sends nothing under the old turnId.
    expect(ink.begin(0, 1, 5, 5)).toBe(0);
    ink.move(6, 6);
    ink.end();
    vi.advanceTimersByTime(10 * INK_FLUSH_MS);
    expect(sent).toEqual([]);
  });

  it('does not resend ops under a new seq when send throws', () => {
    const sent: InkBatch[] = [];
    let fail = true;
    const ink = createInkSender({
      turnId: 1,
      send: (b) => {
        if (fail) throw new Error('socket gone');
        sent.push(b);
      },
    });
    ink.begin(0, 1, 1, 1);
    expect(() => ink.end()).toThrow();
    fail = false;
    ink.begin(0, 1, 9, 9);
    ink.end();
    expect(sent).toEqual([
      [
        1,
        2,
        [
          ['b', 2, 0, 1, 9, 9],
          ['e', 2],
        ],
      ],
    ]);
  });
});
