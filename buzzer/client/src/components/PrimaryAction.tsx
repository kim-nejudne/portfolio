import type { HostView } from '../../../shared/types.js';
import { primaryFor, type PrimaryEvent } from '../lib/hostControls.js';
import { HOVER } from '../lib/hover.js';
import { formatGap } from '../lib/screenQuestion.js';
import { BUTTON_PRIMARY, LABEL } from '../lib/ui.js';
import {
  useAnswerCountdown,
  useBuzzCountdown,
  useAnsweringCountdown,
  type AnswerCountdown,
} from '../lib/useAnswerCountdown.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { ColourDot } from './ColourDot.js';
import { Icon, type IconName } from './Icon.js';

interface PrimaryActionProps {
  view: HostView;
  command: HostCommand;
  /** The read-aloud layout (F69): the winner's name larger, for a host calling it out. */
  bigWinner?: boolean;
}

// The phone's game control (design.md Controls): 56px, Archivo Narrow 600 in capitals, square.
const CONTROL = 'flex min-h-14 w-full items-center justify-center gap-3 text-xl';

// Icon above the label: three side by side leave ~93px each at 375px, too narrow for both in a row.
const JUDGE = `flex h-14 flex-col items-center justify-center gap-1 rounded-control font-outlier text-[17px] leading-none font-semibold uppercase transition not-disabled:active:bg-ink-2 not-disabled:active:text-paper disabled:opacity-40 ${HOVER}`;

/** The icon beside each primary label. */
const PRIMARY_ICON: Record<PrimaryEvent, IconName> = {
  'host:start': 'arrow-right',
  'host:open': 'arrow-right',
  'host:reveal': 'eye',
  'host:next': 'arrow-right',
};

/**
 * The remote's full-width primary action (UI spec, Host remote). Its label and event follow the
 * phase; after a buzz it becomes the red judging panel: who buzzed first, then the answer countdown
 * right above Correct / Wrong when an answer time is set. The remote keeps it in a bar stuck to the
 * bottom of the Game tab, and the other buzzes (`AlsoBuzzed`) in the content above (F98). While
 * the buzzers are open with a buzz time, or a choice question takes answers, the seconds left sit
 * beside it. The server decides whether it is allowed.
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
        <button
          type="button"
          disabled
          className={`${CONTROL} bg-bg-deep font-outlier font-semibold text-ink-2 uppercase`}
        >
          Reopening buzzers…
        </button>
      );
    }
    const winner = view.players.find((p) => p.id === view.winnerId);
    return (
      <section
        aria-label="Judging"
        className="flex flex-col gap-3 rounded-card bg-buzz p-4 text-buzz-ink"
      >
        <p className={`${LABEL} text-buzz-ink!`}>Buzzed first</p>
        {winner && (
          <p
            // Anybody 900 in capitals at its normal width: set wide, a name would truncate at four letters.
            className={`flex min-w-0 items-center gap-3 font-display font-black uppercase ${bigWinner ? 'text-[56px]' : 'text-[44px]'} leading-none`}
          >
            <ColourDot color={winner.color} square className="size-4 ring-2 ring-buzz-ink" />
            {/* Read aloud wraps a long name instead of cutting it, so the host can call it out whole. */}
            <span className={`min-w-0 pb-1 ${bigWinner ? '[overflow-wrap:anywhere]' : 'truncate'}`}>
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
            className={`${JUDGE} border-2 border-buzz-ink text-buzz-ink`}
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
    );
  }

  const action = primaryFor(view);
  if (!action) return null;
  const button = (
    <button
      type="button"
      onClick={() => run(action.event, {})}
      disabled={busy}
      // The ink block (design.md Controls): the one primary on the remote.
      className={`${BUTTON_PRIMARY} ${CONTROL}`}
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
      className="flex min-w-[76px] shrink-0 flex-col items-center justify-center bg-buzz px-3 text-buzz-ink"
    >
      <span className="font-display text-3xl leading-none font-black font-stretch-150% tabular-nums">
        {countdown.secondsLeft}
      </span>
      <span className="font-outlier text-sm font-semibold">sec</span>
    </div>
  );
}

/** The other buzzes of this opening, slowest last, with their gap to the winner. */
export function AlsoBuzzed({ view }: { view: HostView }) {
  const others = view.alsoBuzzed.flatMap((gap) => {
    const player = view.players.find((p) => p.id === gap.playerId);
    return player ? [{ player, gapMs: gap.gapMs }] : [];
  });
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="also-buzzed" className="flex flex-col gap-2">
      <h2 id="also-buzzed" className={`${LABEL} font-stretch-normal tracking-normal`}>
        also buzzed
      </h2>
      {/* A ruled table under the 4px ink bar (design.md Rules). */}
      <ol className="flex flex-col border-t-4 border-ink">
        {others.map(({ player, gapMs }) => (
          <li
            key={player.id}
            className="flex items-center gap-3 border-b border-edge px-3.5 py-2.5"
          >
            <ColourDot color={player.color} square className="size-3 ring-2 ring-ink" />
            <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
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
      className="flex items-center justify-between border-t-2 border-buzz-ink px-1 pt-1.5"
    >
      <span className="font-outlier font-semibold text-buzz-ink">Answer time</span>
      {countdown.up ? (
        <span className="bg-buzz-ink px-3 py-1 font-display text-xl font-black text-ink uppercase">
          Time’s up
        </span>
      ) : (
        <span className="font-display text-4xl leading-none font-black font-stretch-150% text-buzz-ink tabular-nums">
          {countdown.secondsLeft}
        </span>
      )}
    </div>
  );
}
