import type { HostView } from '../../../shared/types.js';
import { primaryFor } from '../lib/hostControls.js';
import type { HostCommand } from '../lib/useHostCommand.js';

interface PrimaryActionProps {
  view: HostView;
  command: HostCommand;
}

const big =
  'w-full rounded-3xl px-6 py-6 font-display text-3xl transition active:scale-95 disabled:opacity-40';

/**
 * The remote's full-width primary action (UI spec, Host remote). Its label and event follow the
 * phase; after a buzz it splits into Correct / Wrong. The server decides whether it is allowed.
 */
export function PrimaryAction({ view, command }: PrimaryActionProps) {
  const { busy, run } = command;

  if (view.phase === 'BUZZED') {
    // After a wrong answer the room waits in BUZZED before the buzzers reopen (DECISIONS #5).
    if (!view.canJudge) {
      return (
        <button type="button" disabled className={`${big} bg-surface text-muted`}>
          Reopening buzzers…
        </button>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => run('host:judge', { result: 'correct' })}
          disabled={busy}
          className={`${big} bg-win text-bg`}
        >
          Correct
        </button>
        <button
          type="button"
          onClick={() => run('host:judge', { result: 'wrong' })}
          disabled={busy}
          className={`${big} bg-buzz text-ink`}
        >
          Wrong
        </button>
      </div>
    );
  }

  const action = primaryFor(view);
  if (!action) return null;
  return (
    <button
      type="button"
      onClick={() => run(action.event, {})}
      disabled={busy}
      className={`${big} bg-accent text-accent-ink`}
    >
      {action.label}
    </button>
  );
}
