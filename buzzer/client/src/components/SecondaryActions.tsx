import type { HostView } from '../../../shared/types.js';
import { inGame, UNREVEALED } from '../lib/hostControls.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { ConfirmButton } from './ConfirmButton.js';

interface SecondaryActionsProps {
  view: HostView;
  command: HostCommand;
}

const small =
  'rounded-2xl border-2 border-edge bg-surface px-4 py-3 text-lg transition active:scale-95 disabled:opacity-40';

/**
 * The remote's secondary actions (UI spec, Host remote): Skip question, Show/hide scoreboard,
 * Undo last judgement, Previous question and End game. The server decides whether each is allowed;
 * Undo reads `canUndo` from the view rather than working the rule out here.
 */
export function SecondaryActions({ view, command }: SecondaryActionsProps) {
  const { busy, run } = command;
  const playing = inGame(view);

  return (
    <section aria-label="More actions" className="grid grid-cols-2 gap-2">
      {UNREVEALED.includes(view.phase) && (
        // SPEC-QUESTION: Skip question is `host:reveal`; see DECISIONS (F22).
        <button
          type="button"
          onClick={() => run('host:reveal', {})}
          disabled={busy}
          className={small}
        >
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
          Undo last judgement
        </button>
      )}
      {playing && (
        <button
          type="button"
          onClick={() => run('host:prev', {})}
          disabled={busy || view.questionIndex <= 0}
          className={small}
        >
          Previous question
        </button>
      )}
      <button
        type="button"
        aria-pressed={view.showScoreboard}
        onClick={() => run('host:scoreboard', { show: !view.showScoreboard })}
        disabled={busy}
        className={small}
      >
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
          className={small}
        />
      )}
    </section>
  );
}
