import type { HostView, Phase } from '../../../shared/types.js';
import type { HostCommand } from '../lib/useHostCommand.js';

/** The host events the primary button sends without a payload. */
export type PrimaryEvent = 'host:start' | 'host:open' | 'host:reveal' | 'host:next';

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

const BY_PHASE: Partial<Record<Phase, { label: string; event: PrimaryEvent }>> = {
  LOBBY: { label: 'Start game', event: 'host:start' },
  QUESTION: { label: 'Open buzzers', event: 'host:open' },
  OPEN: { label: 'Reveal answer', event: 'host:reveal' },
  COLLECTING: { label: 'Reveal answer', event: 'host:reveal' },
};

function primaryFor(view: HostView): { label: string; event: PrimaryEvent } | null {
  if (view.phase === 'REVEAL') {
    // `host:next` after the last question shows the final results instead of another question.
    const last = view.questionIndex >= view.questionCount - 1;
    return { label: last ? 'Show final results' : 'Next question', event: 'host:next' };
  }
  return BY_PHASE[view.phase] ?? null;
}
