import { Fragment } from 'react';
import type { BoardView } from '../../../shared/types.js';
import { boardDone } from '../lib/boardCursor.js';
import { LABEL } from '../lib/ui.js';
import type { HostCommand } from '../lib/useHostCommand.js';

interface HostBoardProps {
  board: BoardView;
  command: HostCommand;
}

/**
 * The category board on the remote in BOARD (F90): the Screen's grid on its side, a row per
 * category with its title, then its tiles from Easy to Hard, each open tile a button that picks it.
 * Six columns across a phone would leave a title 48 px to wrap in. Played tiles stay in place,
 * dimmed and disabled; the server refuses them anyway.
 */
export function HostBoard({ board, command }: HostBoardProps) {
  const done = boardDone(board);
  const rows = Math.max(0, ...board.columns.map((column) => column.tiles.length));
  return (
    <section
      aria-label="Category board"
      className="flex flex-col gap-3 rounded-[20px] border-2 border-edge bg-surface p-3"
    >
      <p className={LABEL}>{done ? 'Board finished' : 'Pick a tile'}</p>
      <div
        style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${rows}, 3.5rem)` }}
        className="grid items-stretch gap-1.5"
      >
        {board.columns.map((column, c) => (
          <Fragment key={c}>
            <h3 className="flex min-w-0 items-center text-base leading-tight font-bold break-words text-accent">
              {column.title}
            </h3>
            {column.tiles.map((tile, r) => (
              <button
                key={r}
                type="button"
                onClick={() => command.run('host:pick', { questionIndex: tile.questionIndex })}
                disabled={tile.used || command.busy}
                className={`min-h-12 rounded-xl border-2 font-display text-lg tabular-nums transition not-disabled:active:scale-95 ${
                  tile.used
                    ? 'border-edge bg-bg text-muted opacity-30'
                    : 'border-accent bg-bg text-ink'
                }`}
              >
                <span className="sr-only">{column.title},</span> {tile.points}
                {tile.used && <span className="sr-only">, played</span>}
              </button>
            ))}
          </Fragment>
        ))}
      </div>
      {done && (
        // After a Previous from the last tile nothing is left to pick (DECISIONS F89).
        <p role="note" className="text-muted">
          Every tile has been played. End the game to show the final results.
        </p>
      )}
    </section>
  );
}
