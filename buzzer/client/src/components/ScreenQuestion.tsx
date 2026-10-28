import type { BuzzGap, RankedPlayer, ScreenView } from '../../../shared/types.js';
import { imageUrl } from '../lib/api.js';
import { signedPoints } from '../lib/results.js';
import { buzzersOpen, formatGap, questionTextClass } from '../lib/screenQuestion.js';
import {
  countdownText,
  useAnswerCountdown,
  type AnswerCountdown,
} from '../lib/useAnswerCountdown.js';
import { useRecentFx } from '../lib/useRecentFx.js';

/**
 * The Screen during a question: its number, text and image, then the buzzer status or, once
 * someone has won the buzz, their banner and the "also buzzed" gaps (UI spec, Screen view).
 * The answer shows only when the view carries it, which the server allows at REVEAL alone.
 * `imageSrc` replaces the room's image URL, for the set editor's preview of a stored blob.
 */
export function ScreenQuestion({ view, imageSrc }: { view: ScreenView; imageSrc?: string }) {
  const { question } = view;
  const countdown = useAnswerCountdown(view);
  if (!question) return null;
  const text = question.text.trim();
  const winner = view.players.find((p) => p.id === view.winnerId);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3vh] px-[5vw] pt-[4vh] pb-[3vh]">
      <p className="shrink-0 text-[2.4vw] text-muted">
        Question {view.questionIndex + 1} of {view.questionCount}
      </p>
      <div className="flex min-h-0 flex-1 items-center gap-[4vw]">
        {text && (
          <h1
            className={`min-w-0 flex-1 overflow-hidden font-display leading-tight break-words ${questionTextClass(text, question.imageId !== undefined)}`}
          >
            {text}
          </h1>
        )}
        {question.imageId && (
          <img
            src={imageSrc ?? imageUrl(view.code, question.imageId)}
            alt={text ? 'Question image' : `Question ${view.questionIndex + 1}`}
            className="h-full min-h-0 min-w-0 flex-1 object-contain"
          />
        )}
      </div>
      {view.phase === 'REVEAL' ? (
        <Reveal
          answer={question.answer}
          scorer={view.players.find((p) => p.id === view.scorerId)}
        />
      ) : view.phase === 'BUZZED' && winner ? (
        <BuzzResult
          winner={winner}
          judgedWrong={view.lockedOut.includes(winner.id)}
          countdown={countdown}
          alsoBuzzed={view.alsoBuzzed}
          players={view.players}
        />
      ) : (
        <>
          <BuzzerStatus open={buzzersOpen(view.phase)} />
          <LockedOut ids={view.lockedOut} players={view.players} />
        </>
      )}
    </div>
  );
}

function BuzzerStatus({ open }: { open: boolean }) {
  return (
    <p
      role="status"
      className={`shrink-0 self-center rounded-full px-[4vw] py-[1.6vh] font-display text-[3.4vw] ${
        open ? 'bg-buzz text-ink motion-safe:animate-buzz-pulse' : 'bg-surface text-muted'
      }`}
    >
      {open ? 'Buzzers OPEN' : 'Buzzers locked'}
    </p>
  );
}

/** Players judged wrong on this question, greyed out while the others may still buzz. */
function LockedOut({ ids, players }: { ids: string[]; players: RankedPlayer[] }) {
  const out = players.filter((p) => ids.includes(p.id));
  if (out.length === 0) return null;
  return (
    <div className="flex max-w-full shrink-0 items-baseline justify-center gap-[1.2vw]">
      <p className="shrink-0 text-[2vw] text-muted">locked out</p>
      <ul aria-label="Locked out" className="flex flex-wrap gap-[1vw] overflow-hidden">
        {out.map((player) => (
          <li
            key={player.id}
            className="rounded-full bg-edge px-[1.4vw] py-[0.6vh] font-display text-[2vw] text-muted line-through"
          >
            {player.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The answer in large type under the question, and the player who got it right (UI spec, Screen
 * view: Reveal). "+100" floats up beside their name when the correct judgement's `fx` arrives.
 */
function Reveal({ answer, scorer }: { answer: string | undefined; scorer?: RankedPlayer }) {
  const recent = useRecentFx();
  const scored =
    recent?.fx.kind === 'correct' && recent.fx.playerId === scorer?.id ? recent : undefined;
  return (
    <section aria-label="Answer" className="flex shrink-0 flex-col items-center gap-[2vh]">
      <p className="text-[2vw] text-muted">Answer</p>
      <p className="max-w-full rounded-[3vh] bg-surface px-[4vw] py-[2vh] text-center font-display text-[min(5vw,10vh)] leading-tight break-words text-accent">
        {answer}
      </p>
      {scorer && (
        <p
          style={{ backgroundColor: scorer.color }}
          className="relative rounded-full px-[2.4vw] py-[1vh] font-display text-[min(3vw,6vh)] text-bg"
        >
          {scorer.name} ✓
          {scored?.fx.kind === 'correct' && (
            <span
              key={scored.seq}
              className="absolute top-1/2 left-full ml-[1.5vw] -translate-y-1/2 font-display text-[min(3.2vw,6vh)] leading-none whitespace-nowrap text-win motion-safe:animate-float-up"
            >
              {signedPoints(scored.fx.points)}
            </span>
          )}
        </p>
      )}
    </section>
  );
}

/** The answer countdown beside the winner's banner (UI spec, Screen view: Buzzed), then "Time's up!". */
function Countdown({ countdown }: { countdown: AnswerCountdown }) {
  return (
    <p
      role="timer"
      aria-label="Answer time"
      data-up={countdown.up || undefined}
      className={`flex min-w-[14vw] shrink-0 items-center justify-center rounded-[3vh] px-[2vw] font-display leading-none whitespace-nowrap tabular-nums ${
        countdown.up
          ? 'bg-buzz text-[min(4vw,8vh)] text-ink'
          : 'bg-surface text-[min(8vw,16vh)] text-accent'
      }`}
    >
      {countdownText(countdown)}
    </p>
  );
}

interface BuzzResultProps {
  winner: RankedPlayer;
  /** Judged wrong and waiting for the reopen: the banner goes grey. */
  judgedWrong: boolean;
  /** The winner's answer countdown, shown beside the banner; null with no answer time. */
  countdown: AnswerCountdown | null;
  alsoBuzzed: BuzzGap[];
  players: RankedPlayer[];
}

function BuzzResult({ winner, judgedWrong, countdown, alsoBuzzed, players }: BuzzResultProps) {
  const others = alsoBuzzed.flatMap((gap) => {
    const player = players.find((p) => p.id === gap.playerId);
    return player ? [{ player, gapMs: gap.gapMs }] : [];
  });
  return (
    <section aria-label="Buzz result" className="flex shrink-0 flex-col items-center gap-[2vh]">
      <div className="flex w-full items-stretch gap-[2vw]">
        <h2
          style={judgedWrong ? undefined : { backgroundColor: winner.color }}
          data-judged={judgedWrong ? 'wrong' : undefined}
          className={`min-w-0 flex-1 truncate rounded-[3vh] px-[3vw] py-[2vh] text-center font-display text-[min(8vw,16vh)] leading-none transition-colors ${
            judgedWrong ? 'bg-edge text-muted line-through' : 'text-bg'
          }`}
        >
          {winner.name}
        </h2>
        {countdown && <Countdown countdown={countdown} />}
      </div>
      {others.length > 0 && (
        <div className="flex max-w-full items-baseline gap-[1.6vw]">
          <p className="shrink-0 text-[2vw] text-muted">also buzzed</p>
          <ol aria-label="Also buzzed" className="flex flex-wrap gap-[1.2vw] overflow-hidden">
            {others.map(({ player, gapMs }) => (
              <li
                key={player.id}
                className="flex items-baseline gap-[0.6vw] text-[2.2vw] whitespace-nowrap"
              >
                <span style={{ color: player.color }} className="font-display">
                  {player.name}
                </span>
                <span className="text-muted tabular-nums">{formatGap(gapMs)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
