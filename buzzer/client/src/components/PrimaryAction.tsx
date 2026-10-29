import type { HostView } from '../../../shared/types.js';
import { primaryFor, type PrimaryEvent } from '../lib/hostControls.js';
import { formatGap } from '../lib/screenQuestion.js';
import { LABEL } from '../lib/ui.js';
import {
  useAnswerCountdown,
  useBuzzCountdown,
  useAnsweringCountdown,
  type AnswerCountdown,
} from '../lib/useAnswerCountdown.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { Icon, type IconName } from './Icon.js';

interface PrimaryActionProps {
  view: HostView;
  command: HostCommand;
  /** The read-aloud layout (F69): the winner's name larger, for a host calling it out. */
  bigWinner?: boolean;
}

const big =
  'flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl px-6 py-3 font-display text-xl transition not-disabled:active:scale-95 disabled:opacity-40';

// Icon above the label: three side by side leave ~93px each at 375px, too narrow for both in a row.
const JUDGE =
  'flex h-14 flex-col items-center justify-center gap-1 rounded-[14px] font-display text-[17px] leading-none transition not-disabled:active:scale-95 disabled:opacity-40';

/** The icon beside each primary label. */
const PRIMARY_ICON: Record<PrimaryEvent, IconName> = {
  'host:start': 'arrow-right',
  'host:open': 'arrow-right',
  'host:reveal': 'eye',
  'host:next': 'arrow-right',
};

/**
 * The remote's full-width primary action (UI spec, Host remote). Its label and event follow the
 * phase; after a buzz it becomes the red judging panel: who buzzed first, the answer countdown
 * right above Correct / Wrong when an answer time is set, then the other buzzes. While the buzzers
 * are open with a buzz time, or a choice question takes answers, the seconds left sit beside it.
 * The server decides whether it is allowed.
 */
export function PrimaryAction({ view, command, bigWinner = false }: PrimaryActionProps) {
  const { busy, run } = command;
  const countdown = useAnswerCountdown(view);
  const buzzCountdown = useBuzzCountdown(view);
  const answeringCountdown = useAnsweringCountdown(view);

  if (view.phase === 'BUZZED') {
    // After a wrong answer the room waits in BUZZED before the buzzers reopen (DECISIONS #5).
    if (!view.canJudge) {
      return (
        <button type="button" disabled className={`${big} bg-surface text-muted`}>
          Reopening buzzers…
        </button>
      );
    }
    const winner = view.players.find((p) => p.id === view.winnerId);
    return (
      <div className="flex flex-col gap-3">
        <section
          aria-label="Judging"
          className="flex flex-col gap-3 rounded-[18px] bg-buzz p-4 shadow-[0_0_0_4px_var(--color-bg),0_0_0_7px_var(--color-accent)]"
        >
          <p className={`${LABEL} text-buzz-ink!`}>Buzzed first</p>
          {winner && (
            <p
              className={`flex min-w-0 items-center gap-3 font-display ${bigWinner ? 'text-[56px]' : 'text-[44px]'} leading-none text-ink [text-shadow:3px_3px_0_var(--color-buzz-ink)]`}
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: winner.color }}
                className="size-4 shrink-0 rounded-full ring-2 ring-buzz-ink"
              />
              {/* Read aloud wraps a long name instead of cutting it, so the host can call it out whole. */}
              <span
                className={`min-w-0 pb-1 ${bigWinner ? '[overflow-wrap:anywhere]' : 'truncate'}`}
              >
                {winner.name}
              </span>
            </p>
          )}
          {countdown && <JudgeCountdown countdown={countdown} />}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => run('host:judge', { result: 'correct' })}
              disabled={busy}
              className={`${JUDGE} bg-win text-win-ink`}
            >
              <Icon name="check" className="size-5" />
              Correct
            </button>
            <button
              type="button"
              onClick={() => run('host:judge', { result: 'half' })}
              disabled={busy}
              className={`${JUDGE} bg-accent text-accent-ink`}
            >
              <Icon name="half" className="size-5" />
              Half
            </button>
            <button
              type="button"
              onClick={() => run('host:judge', { result: 'wrong' })}
              disabled={busy}
              className={`${JUDGE} bg-buzz-ink text-ink`}
            >
              <Icon name="x" className="size-5" />
              Wrong
            </button>
          </div>
        </section>
        <AlsoBuzzed view={view} />
      </div>
    );
  }

  const action = primaryFor(view);
  if (!action) return null;
  const button = (
    <button
      type="button"
      onClick={() => run(action.event, {})}
      disabled={busy}
      className={`${big} bg-accent text-accent-ink not-disabled:hover:bg-accent-hover`}
    >
      {action.label}
      <Icon name={PRIMARY_ICON[action.event]} className="size-6" />
    </button>
  );
  const side = buzzCountdown
    ? { countdown: buzzCountdown, label: 'Buzz time' }
    : answeringCountdown && { countdown: answeringCountdown, label: 'Time to answer' };
  if (!side) return button;
  return (
    <div className="flex items-stretch gap-3">
      {button}
      <SideCountdown {...side} />
    </div>
  );
}

/**
 * The buzz time left beside Reveal answer, or the answer time beside Close answers; at 0 the
 * server reveals by itself (DECISIONS, F63 and F85).
 */
function SideCountdown({ countdown, label }: { countdown: AnswerCountdown; label: string }) {
  return (
    <div
      role="timer"
      aria-label={label}
      className="flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-buzz bg-surface px-3"
    >
      <span className="font-display text-3xl leading-none text-buzz tabular-nums">
        {countdown.secondsLeft}
      </span>
      <span className="text-xs font-bold text-muted">sec</span>
    </div>
  );
}

/** The other buzzes of this opening, slowest last, with their gap to the winner. */
function AlsoBuzzed({ view }: { view: HostView }) {
  const others = view.alsoBuzzed.flatMap((gap) => {
    const player = view.players.find((p) => p.id === gap.playerId);
    return player ? [{ player, gapMs: gap.gapMs }] : [];
  });
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="also-buzzed" className="flex flex-col gap-2">
      <h2 id="also-buzzed" className={LABEL}>
        also buzzed
      </h2>
      <ol className="flex flex-col gap-1.5">
        {others.map(({ player, gapMs }) => (
          <li
            key={player.id}
            className="flex items-center gap-3 rounded-xl border-2 border-edge bg-surface px-3.5 py-2.5"
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: player.color }}
              className="size-3 shrink-0 rounded-full"
            />
            <span className="min-w-0 flex-1 truncate font-bold">{player.name}</span>
            <span className="text-muted tabular-nums">{formatGap(gapMs)}</span>
          </li>
        ))}
      </ol>
    </section>
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
      className="flex items-center justify-between rounded-xl bg-buzz-ink/15 px-3 py-1.5"
    >
      <span className="font-bold text-buzz-ink">Answer time</span>
      {countdown.up ? (
        <span className="rounded-full bg-buzz-ink px-4 py-1 font-display text-xl text-ink">
          Time’s up
        </span>
      ) : (
        <span className="font-display text-4xl leading-none text-buzz-ink tabular-nums">
          {countdown.secondsLeft}
        </span>
      )}
    </div>
  );
}
