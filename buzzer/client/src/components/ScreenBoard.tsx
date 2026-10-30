import { Fragment, useEffect, useRef, type CSSProperties } from 'react';
import type { BoardView } from '../../../shared/types.js';
import type { BoardCursor } from '../lib/boardCursor.js';
import { HOVER } from '../lib/hover.js';

interface ScreenBoardProps {
  board: BoardView;
  /** The host's keyboard cursor, ringed; only on a Screen with host controls. */
  cursor?: BoardCursor;
  /** Moves the cursor to a tile that takes focus (a click, Tab), so one tile is marked (SCR-16). */
  onCursor?: (cursor: BoardCursor) => void;
  /** Picks a tile by its question index; only on a Screen with host controls. */
  onPick?: (questionIndex: number) => void;
  /** True while a host command waits for its snapshot. */
  busy?: boolean;
}

/**
 * The category board between questions (UI spec, Screen view: Board; F90): a column per category
 * under its title, a tile per question showing only its points, played tiles dimmed. No question
 * text reaches a tile: the view has none to give.
 */
export function ScreenBoard({ board, cursor, onCursor, onPick, busy = false }: ScreenBoardProps) {
  const rows = Math.max(0, ...board.columns.map((column) => column.tiles.length));
  const grid = useRef<HTMLElement>(null);
  // The other way round: while a tile has focus, the arrow keys carry focus with the cursor. A
  // played tile is disabled and cannot take it; the old tile then keeps focus, unmarked.
  useEffect(() => {
    if (!cursor || !grid.current?.contains(document.activeElement)) return;
    grid.current
      .querySelector<HTMLButtonElement>(
        `[data-tile="${cursor.column}-${cursor.row}"]:not(:disabled)`,
      )
      ?.focus();
  }, [cursor]);
  return (
    <section
      ref={grid}
      aria-label="Category board"
      // One grid for the whole board, filled column by column, so every title shares the tallest
      // title's row and the tiles line up across columns. Titles shrink as columns are added, so
      // a long word ("SUPERHEROES") still fits a sixth of the width.
      style={
        {
          gridTemplateColumns: `repeat(${board.columns.length}, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${rows}, minmax(0, 1fr))`,
          fontSize: `max(var(--screen-min-label), min(2vw, ${(9 / board.columns.length).toFixed(2)}vw, 3.6vh))`,
          // Tile values shrink with the column count too (SCR-05). Up to 6 columns the new term is
          // never below 4.5vw, so 16:9 sizes are as before (F100).
          '--tile-text': `min(4.5vw, ${(27 / board.columns.length).toFixed(2)}vw, 8vh)`,
        } as CSSProperties
      }
      className="grid min-h-0 flex-1 grid-flow-col gap-[min(1.2vw,2.14vh)] px-[min(3.75vw,6.67vh)] pt-[1vh] pb-[3vh]"
    >
      {board.columns.map((column, c) => (
        <Fragment key={c}>
          <h2 className="flex min-h-[12vh] min-w-0 items-center justify-center rounded-[min(1.2vw,2.1vh)] border-2 border-accent bg-bg-deep px-[min(0.8vw,1.43vh)] py-[1vh] text-center font-display leading-tight text-balance hyphens-auto break-words text-accent">
            {column.title}
          </h2>
          {column.tiles.map((tile, r) => {
            const selected = cursor?.column === c && cursor.row === r;
            // Read as "Animals, 200, played"; the title is above and the dimming shows "played".
            const content = (
              <>
                <span className="sr-only">{column.title},</span> {tile.points}
                {tile.used && <span className="sr-only">, played</span>}
              </>
            );
            const look = `flex min-h-0 min-w-0 items-center justify-center rounded-[min(1.2vw,2.1vh)] border-2 font-display text-[max(var(--screen-min-body),var(--tile-text))] tabular-nums transition ${
              tile.used
                ? 'border-edge bg-bg text-muted opacity-30'
                : 'border-edge bg-surface text-ink'
            } ${selected ? 'shadow-[0_0_0_min(0.3vw,0.54vh)_var(--color-bg),0_0_0_min(0.6vw,1.07vh)_var(--color-accent)]' : ''}`;
            return onPick ? (
              <button
                key={r}
                type="button"
                data-tile={`${c}-${r}`}
                aria-current={selected || undefined}
                onFocus={() => onCursor?.({ column: c, row: r })}
                onClick={() => onPick(tile.questionIndex)}
                disabled={tile.used || busy}
                // The cursor's ring follows focus, so the focus ring would only mark it twice.
                className={`${look} ${HOVER} ${onCursor ? 'focus-visible:outline-none' : ''}`}
              >
                {content}
              </button>
            ) : (
              <p key={r} className={look}>
                {content}
              </p>
            );
          })}
        </Fragment>
      ))}
    </section>
  );
}
