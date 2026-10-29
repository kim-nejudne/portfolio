import { describe, expect, it } from 'vitest';
import type { BoardView } from '../../../shared/types.js';
import { boardDone, firstUnused, moveCursor, tileAt, tileOf } from './boardCursor.js';

/** `columns` × 3 tiles; `used` lists the question indexes already picked. */
function board(columns: number, used: number[] = []): BoardView {
  return {
    columns: Array.from({ length: columns }, (_, c) => ({
      title: `Category ${c + 1}`,
      tiles: [0, 1, 2].map((r) => ({
        questionIndex: c * 3 + r,
        points: (r + 1) * 100,
        used: used.includes(c * 3 + r),
      })),
    })),
  };
}

describe('firstUnused', () => {
  it('starts at the top left', () => {
    expect(firstUnused(board(3))).toEqual({ column: 0, row: 0 });
  });

  it('takes the first unplayed tile row by row, so the cheap tiles come first', () => {
    expect(firstUnused(board(3, [0, 3]))).toEqual({ column: 2, row: 0 });
    expect(firstUnused(board(2, [0, 3, 1]))).toEqual({ column: 1, row: 1 });
  });

  it('falls back to the top left when every tile is played', () => {
    expect(firstUnused(board(2, [0, 1, 2, 3, 4, 5]))).toEqual({ column: 0, row: 0 });
  });
});

describe('moveCursor', () => {
  const b = board(3);

  it('moves one tile per arrow', () => {
    const at = { column: 1, row: 1 };
    expect(moveCursor(b, at, 'ArrowLeft')).toEqual({ column: 0, row: 1 });
    expect(moveCursor(b, at, 'ArrowRight')).toEqual({ column: 2, row: 1 });
    expect(moveCursor(b, at, 'ArrowUp')).toEqual({ column: 1, row: 0 });
    expect(moveCursor(b, at, 'ArrowDown')).toEqual({ column: 1, row: 2 });
  });

  it('holds at the edges', () => {
    expect(moveCursor(b, { column: 0, row: 0 }, 'ArrowLeft')).toEqual({ column: 0, row: 0 });
    expect(moveCursor(b, { column: 0, row: 0 }, 'ArrowUp')).toEqual({ column: 0, row: 0 });
    expect(moveCursor(b, { column: 2, row: 2 }, 'ArrowRight')).toEqual({ column: 2, row: 2 });
    expect(moveCursor(b, { column: 2, row: 2 }, 'ArrowDown')).toEqual({ column: 2, row: 2 });
  });

  it('may land on a played tile', () => {
    expect(moveCursor(board(2, [3]), { column: 0, row: 0 }, 'ArrowRight')).toEqual({
      column: 1,
      row: 0,
    });
  });

  it('ignores other keys', () => {
    expect(moveCursor(b, { column: 0, row: 0 }, 'Enter')).toBeNull();
    expect(moveCursor(b, { column: 0, row: 0 }, 'n')).toBeNull();
  });
});

describe('tileAt, tileOf and boardDone', () => {
  it('tileAt reads the tile under the cursor', () => {
    expect(tileAt(board(2), { column: 1, row: 2 })).toEqual({
      questionIndex: 5,
      points: 300,
      used: false,
    });
    expect(tileAt(board(2), { column: 4, row: 0 })).toBeUndefined();
  });

  it('tileOf names the column and points of a question', () => {
    expect(tileOf(board(2), 4)).toEqual({ title: 'Category 2', points: 200 });
    expect(tileOf(board(2), 9)).toBeNull();
    expect(tileOf(null, 0)).toBeNull();
  });

  it('boardDone is true only once every tile is played', () => {
    expect(boardDone(board(2, [0, 1, 2, 3, 4]))).toBe(false);
    expect(boardDone(board(2, [0, 1, 2, 3, 4, 5]))).toBe(true);
  });
});
