import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INK_BATCH_MAX_BYTES,
  INK_FLUSH_MS,
  INK_GRID,
  INK_POINTS_PER_OP_MAX,
} from '../../../shared/constants.js';
import { inkBatchSchema } from '../../../shared/schemas.js';
import type { InkBatch } from '../../../shared/types.js';
import { createInkSender, toGrid } from './inkSender.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

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
    ink.move(416, 299);
    ink.move(422, 297);
    ink.move(427, 297);
    expect(sent).toEqual([]);
    ink.end();
    expect(sent).toEqual([
      [
        7,
        1,
        [
          ['b', 1, 0, 1, 412, 300],
          ['p', 1, 4, -1, 6, -2, 5, 0],
          ['e', 1],
        ],
      ],
    ]);
    for (const b of sent) expect(inkBatchSchema.safeParse(b).success).toBe(true);
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
    // A long zig-zag with big jumps, all inside one flush window.
    for (let i = 1; i <= 1000; i++) ink.move(i % 2 ? 1023 : 0, i % 2 ? 0 : 1023);
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
