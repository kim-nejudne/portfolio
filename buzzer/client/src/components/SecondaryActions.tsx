import type { HostView } from '../../../shared/types.js';
import { canGoBack, inGame, UNREVEALED } from '../lib/hostControls.js';
import { HOVER } from '../lib/hover.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { DANGER } from '../lib/ui.js';
import { ConfirmButton } from './ConfirmButton.js';
import { Icon } from './Icon.js';

interface SecondaryActionsProps {
  view: HostView;
  command: HostCommand;
}

/**
 * A tile in the one row of secondary actions: icon above a short 14px bold label, at least 64px
 * tall. The row shares its width equally among the tiles there are, so no cell is ever left empty;
 * below 360px it wraps two to a line, and a lone last tile takes the whole line (HST-03).
 */
const TILE =
  'flex min-h-16 min-w-0 flex-1 basis-0 max-[359px]:basis-[40%] flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-edge bg-surface px-1.5 py-2 text-sm leading-tight font-bold transition not-disabled:active:scale-95 disabled:opacity-40';
const small = `${TILE} ${HOVER}`;

/** End game's own row: full width, under the tiles, so arming it moves nothing above. */
const END = `flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border-2 border-edge bg-surface px-4 py-2 font-bold transition not-disabled:active:scale-95 disabled:opacity-40`;

/**
 * The remote's secondary actions (UI spec, Host remote): Skip question, Show/hide scoreboard,
 * Undo last judgement, Previous question and End game. The server decides whether each is allowed;
 * Undo reads `canUndo` from the view rather than working the rule out here.
 *
 * The tiles show a short label (Skip, Undo, Previous, Scoreboard) and keep the full one as their
 * accessible name. End game is apart, in a red row of its own below them (HST-03, FND-07).
 */
export function SecondaryActions({ view, command }: SecondaryActionsProps) {
  const { busy, run } = command;
  const playing = inGame(view);

  return (
    <section aria-label="More actions" className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {UNREVEALED.includes(view.phase) && (
          // SPEC-QUESTION: Skip question is `host:reveal`; see DECISIONS (F22).
          <button
            type="button"
            onClick={() => run('host:reveal', {})}
            disabled={busy}
            aria-label="Skip question"
            className={small}
          >
            <Icon name="skip" className="size-5" />
            Skip
          </button>
        )}
        {playing && (
          <button
            type="button"
            onClick={() => run('host:undo', {})}
            disabled={busy || !view.canUndo}
            aria-label="Undo last judgement"
            className={small}
          >
            <Icon name="undo" className="size-5" />
            Undo
          </button>
        )}
        {/* On the board there is nothing to go back to; from any tile, Previous returns to it (F89). */}
        {playing && view.phase !== 'BOARD' && (
          <button
            type="button"
            onClick={() => run('host:prev', {})}
            disabled={busy || !canGoBack(view)}
            aria-label="Previous question"
            className={small}
          >
            <Icon name="arrow-left" className="size-5" />
            Previous
          </button>
        )}
        <button
          type="button"
          aria-pressed={view.showScoreboard}
          aria-label={view.showScoreboard ? 'Hide scoreboard' : 'Show scoreboard'}
          onClick={() => run('host:scoreboard', { show: !view.showScoreboard })}
          disabled={busy}
          className={`${small} ${view.showScoreboard ? 'border-accent text-accent' : ''}`}
        >
          <Icon name="trophy" className="size-5" />
          Scoreboard
        </button>
      </div>
      {view.phase !== 'FINAL' && (
        <ConfirmButton
          // A new phase or question disarms it, so a stale Confirm end can't be tapped later.
          key={`${view.phase}-${view.questionIndex}`}
          label="End game"
          confirmLabel="Confirm end"
          onConfirm={() => run('host:end', {})}
          disabled={busy}
          // Red before it is armed, so it doesn't pass for a safe tile (FND-07).
          className={`${END} ${DANGER}`}
          cancelClassName={`${END} ${HOVER}`}
          icon={<Icon name="flag" className="size-5" />}
          armedClassName="grid grid-cols-2 gap-2"
        />
      )}
    </section>
  );
}
