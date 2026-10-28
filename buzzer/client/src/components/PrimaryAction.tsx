import type { HostView } from '../../../shared/types.js';
import { primaryFor } from '../lib/hostControls.js';
import { useAnswerCountdown, type AnswerCountdown } from '../lib/useAnswerCountdown.js';
import type { HostCommand } from '../lib/useHostCommand.js';

interface PrimaryActionProps {
  view: HostView;
  command: HostCommand;
}

const big =
  'w-full rounded-3xl px-6 py-6 font-display text-3xl transition not-disabled:active:scale-95 disabled:opacity-40';

/**
 * The remote's full-width primary action (UI spec, Host remote). Its label and event follow the
 * phase; after a buzz it splits into Correct / Wrong, with the answer countdown right above them
 * when an answer time is set. The server decides whether it is allowed.
 */
export function PrimaryAction({ view, command }: PrimaryActionProps) {
  const { busy, run } = command;
  const countdown = useAnswerCountdown(view);

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
      <div className="flex flex-col gap-3">
        {countdown && <JudgeCountdown countdown={countdown} />}
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

/**
 * The winner's seconds left, then a "Time's up" badge. Time up judges nothing: the host still
 * taps Correct or Wrong (DECISIONS, F35).
 */
function JudgeCountdown({ countdown }: { countdown: AnswerCountdown }) {
  return (
    <div
      role="timer"
      aria-label="Answer time"
      className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2"
    >
      <span className="text-lg text-muted">Answer time</span>
      {countdown.up ? (
        <span className="rounded-full bg-buzz px-4 py-1 font-display text-2xl text-ink">
          Time’s up
        </span>
      ) : (
        <span className="font-display text-4xl leading-none text-accent tabular-nums">
          {countdown.secondsLeft}
        </span>
      )}
    </div>
  );
}
