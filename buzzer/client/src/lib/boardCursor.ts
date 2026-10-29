// The category board's tiles as the Screen and the remote draw them (F90). Which tiles may be
// picked is the server's rule; these only read `used` from the view.

import type { BoardTile, BoardView } from '../../../shared/types.js';

/** A tile's place on the board: its column, and its row from the top (Easy). */
export interface BoardCursor {
  column: number;
  row: number;
}

const MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** The tile under the cursor, if the cursor is on the board. */
export function tileAt(board: BoardView, cursor: BoardCursor): BoardTile | undefined {
  return board.columns[cursor.column]?.tiles[cursor.row];
}

/** The first tile not yet played, row by row from the top left; the top left when all are. */
export function firstUnused(board: BoardView): BoardCursor {
  const rows = Math.max(0, ...board.columns.map((column) => column.tiles.length));
  for (let row = 0; row < rows; row++) {
    const column = board.columns.findIndex((c) => c.tiles[row]?.used === false);
    if (column !== -1) return { column, row };
  }
  return { column: 0, row: 0 };
}

/** The cursor after an arrow key, held at the board's edges; null for any other key. */
export function moveCursor(board: BoardView, cursor: BoardCursor, key: string): BoardCursor | null {
  const move = MOVES[key];
  if (!move) return null;
  const column = clamp(cursor.column + move[0], board.columns.length - 1);
  const row = clamp(cursor.row + move[1], (board.columns[column]?.tiles.length ?? 1) - 1);
  return { column, row };
}

/** The column title and points of the tile holding this question, for "Animals · 200". */
export function tileOf(
  board: BoardView | null,
  questionIndex: number,
): { title: string; points: number } | null {
  for (const column of board?.columns ?? []) {
    const tile = column.tiles.find((t) => t.questionIndex === questionIndex);
    if (tile) return { title: column.title, points: tile.points };
  }
  return null;
}

/** True once every tile has been picked: Next then shows the final results (DECISIONS F89). */
export function boardDone(board: BoardView): boolean {
  return board.columns.every((column) => column.tiles.every((tile) => tile.used));
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

/** "Question 3 of 10", or on a board set the tile's category, as the remote heads a question. */
export function questionHeading(
  board: BoardView | null,
  questionIndex: number,
  questionCount: number,
): string {
  return tileOf(board, questionIndex)?.title ?? `Question ${questionIndex + 1} of ${questionCount}`;
}
