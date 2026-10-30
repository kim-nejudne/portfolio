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

/** A grid tile: icon above a 14px bold label, at least 64px tall. */
const TILE =
  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-edge bg-surface px-1.5 py-2 text-sm leading-tight font-bold transition not-disabled:active:scale-95 disabled:opacity-40';
const small = `${TILE} ${HOVER}`;

/**
 * The remote's secondary actions (UI spec, Host remote): Skip question, Show/hide scoreboard,
 * Undo last judgement, Previous question and End game. The server decides whether each is allowed;
 * Undo reads `canUndo` from the view rather than working the rule out here.
 */
export function SecondaryActions({ view, command }: SecondaryActionsProps) {
  const { busy, run } = command;
  const playing = inGame(view);

  return (
    <section aria-label="More actions" className="grid grid-cols-3 gap-2">
      {UNREVEALED.includes(view.phase) && (
        // SPEC-QUESTION: Skip question is `host:reveal`; see DECISIONS (F22).
        <button
          type="button"
          onClick={() => run('host:reveal', {})}
          disabled={busy}
          className={small}
        >
          <Icon name="skip" className="size-5" />
          Skip question
        </button>
      )}
      {playing && (
        <button
          type="button"
          onClick={() => run('host:undo', {})}
          disabled={busy || !view.canUndo}
          className={small}
        >
          <Icon name="undo" className="size-5" />
          Undo last judgement
        </button>
      )}
      {/* On the board there is nothing to go back to; from any tile, Previous returns to it (F89). */}
      {playing && view.phase !== 'BOARD' && (
        <button
          type="button"
          onClick={() => run('host:prev', {})}
          disabled={busy || !canGoBack(view)}
          className={small}
        >
          <Icon name="arrow-left" className="size-5" />
          Previous question
        </button>
      )}
      <button
        type="button"
        aria-pressed={view.showScoreboard}
        onClick={() => run('host:scoreboard', { show: !view.showScoreboard })}
        disabled={busy}
        className={`${small} ${view.showScoreboard ? 'border-accent text-accent' : ''}`}
      >
        <Icon name="trophy" className="size-5" />
        {view.showScoreboard ? 'Hide scoreboard' : 'Show scoreboard'}
      </button>
      {view.phase !== 'FINAL' && (
        <ConfirmButton
          // A new phase or question disarms it, so a stale Confirm end can't be tapped later.
          key={`${view.phase}-${view.questionIndex}`}
          label="End game"
          confirmLabel="Confirm end"
          onConfirm={() => run('host:end', {})}
          disabled={busy}
          // Red before it is armed, so it doesn't pass for a safe tile (FND-07).
          className={`${TILE} ${DANGER}`}
          cancelClassName={small}
          icon={<Icon name="flag" className="size-5" />}
          armedClassName="col-span-2 grid grid-cols-2 gap-2"
        />
      )}
    </section>
  );
}
