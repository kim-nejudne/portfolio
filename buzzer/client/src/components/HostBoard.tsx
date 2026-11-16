import { Fragment } from 'react';
import type { BoardView } from '../../../shared/types.js';
import { boardDone } from '../lib/boardCursor.js';
import { HOVER } from '../lib/hover.js';
import { LABEL } from '../lib/ui.js';
import type { HostCommand } from '../lib/useHostCommand.js';

interface HostBoardProps {
  board: BoardView;
  command: HostCommand;
}

/**
 * The category board on the remote in BOARD (F90): the Screen's grid on its side, a row per
 * category with its title, then its tiles from Easy to Hard, each open tile a button that picks it.
 * Six columns across a phone would leave a title 48 px to wrap in. Tiles are paper-2 with their
 * points as figures; a played tile stays in place, disabled, flooded with the orange pass and its
 * points for a screen reader only, as on the Screen (F147). The server refuses it anyway.
 */
export function HostBoard({ board, command }: HostBoardProps) {
  const done = boardDone(board);
  const rows = Math.max(0, ...board.columns.map((column) => column.tiles.length));
  return (
    <section aria-label="Category board" className="flex flex-col gap-3">
      <p className={LABEL}>{done ? 'Board finished' : 'Pick a tile'}</p>
      <div
        style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${rows}, 4rem)` }}
        className="grid items-stretch gap-1.5"
      >
        {board.columns.map((column, c) => (
          <Fragment key={c}>
            {/* A table head: Archivo Narrow 600 on a hairline (design.md Rules), as on the Screen. */}
            <h3 className="flex min-w-0 items-center border-b border-edge font-outlier text-base leading-tight font-semibold tracking-normal break-words text-ink font-stretch-normal">
              {column.title}
            </h3>
            {column.tiles.map((tile, r) => (
              <button
                key={r}
                type="button"
                onClick={() => command.run('host:pick', { questionIndex: tile.questionIndex })}
                disabled={tile.used || command.busy}
                className={`min-h-12 rounded-control border-2 border-transparent font-display text-lg font-black font-stretch-150% tabular-nums transition not-disabled:active:bg-ink-2 not-disabled:active:text-paper ${HOVER} ${
                  tile.used ? 'bg-accent-2' : 'bg-surface text-ink'
                }`}
              >
                <span className="sr-only">{column.title},</span>{' '}
                {tile.used ? <span className="sr-only">{tile.points}, played</span> : tile.points}
              </button>
            ))}
          </Fragment>
        ))}
      </div>
      {done && (
        // After a Previous from the last tile nothing is left to pick (DECISIONS F89).
        <p role="note" className="text-ink-2">
          Every tile has been played. End the game to show the final results.
        </p>
      )}
    </section>
  );
}
