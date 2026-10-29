import { useRef, type CSSProperties } from 'react';
import type { BuzzGap, RankedPlayer, ScreenView } from '../../../shared/types.js';
import { imageUrl } from '../lib/api.js';
import { signedPoints } from '../lib/results.js';
import { buzzersOpen, formatGap, questionTextClass } from '../lib/screenQuestion.js';
import {
  countdownText,
  useAnswerCountdown,
  useBuzzCountdown,
  type AnswerCountdown,
} from '../lib/useAnswerCountdown.js';
import { useFalseStartWait } from '../lib/useFalseStartWait.js';
import { useRecentFx } from '../lib/useRecentFx.js';
import { useShrinkToFit } from '../lib/useShrinkToFit.js';
import { Icon } from './Icon.js';
import { StandingsRail } from './StandingsRail.js';

/** The gold stage ring round the hero panel: 6px of base, then 4px of gold, at 1280 wide. */
const STAGE_RING = 'shadow-[0_0_0_0.47vw_var(--color-bg),0_0_0_0.78vw_var(--color-accent)]';
/** The same ring in the border colour, for a banner judged wrong. */
const DIM_RING = 'shadow-[0_0_0_0.47vw_var(--color-bg),0_0_0_0.78vw_var(--color-edge)]';

/** The question text never shrinks below this, however squeezed the card (F52). */
const QUESTION_MIN_PX = 12;

/** A small uppercase label on the Screen (13–16px at 1280 wide). */
const SCREEN_LABEL = 'text-[min(1.2vw,2.1vh)] font-bold tracking-[0.25em] uppercase';

/**
 * The Screen during a question: its text and image in a card (the number is in the header), then
 * the buzzer status or, once
 * someone has won the buzz, their banner and the "also buzzed" gaps (UI spec, Screen view).
 * The answer shows only when the view carries it, which the server allows at REVEAL alone.
 * `imageSrc` replaces the room's image URL, for the set editor's preview of a stored blob.
 */
export function ScreenQuestion({ view, imageSrc }: { view: ScreenView; imageSrc?: string }) {
  const { question } = view;
  const countdown = useAnswerCountdown(view);
  const buzzCountdown = useBuzzCountdown(view);
  const held = useFalseStartWait(view, view.settings.falseStartMs, view.falseStarts.length > 0);
  const rowRef = useRef<HTMLDivElement>(null);
  // The length step is the most the text gets; the answer and the banner squeeze the card, so it
  // shrinks further when its lines would not fit what is left (F52).
  useShrinkToFit(
    rowRef,
    'css',
    QUESTION_MIN_PX,
    question ? `${question.imageId ?? ''}\n${question.text}` : '',
  );
  if (!question) return null;
  const text = question.text.trim();
  const winner = view.players.find((p) => p.id === view.winnerId);

  return (
    <div className="flex min-h-0 flex-1 gap-[2vw] px-[3.75vw] pt-[1vh] pb-[3vh]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[4vh]">
        <section
          aria-label="Question"
          className="flex min-h-0 flex-1 flex-col gap-[2vh] overflow-hidden rounded-[min(1.56vw,2.8vh)] border-2 border-edge bg-surface px-[2.2vw] py-[min(2vw,3.5vh)]"
        >
          <p className={`shrink-0 truncate text-muted ${SCREEN_LABEL}`}>{view.title}</p>
          {/* Safe centring: text taller than a squeezed card, even at the smallest size, starts at
            the top and clips at the bottom, instead of spilling over the label. The row carries
            the text size, so the hook measures a box that its font size never changes. */}
          <div
            ref={rowRef}
            className={`flex min-h-0 flex-1 items-center-safe gap-[4vw] overflow-hidden ${questionTextClass(text, question.imageId !== undefined)}`}
          >
            {text && <h1 className="min-w-0 flex-1 leading-tight font-bold break-words">{text}</h1>}
            {question.imageId && (
              <img
                src={imageSrc ?? imageUrl(view.code, question.imageId)}
                alt={text ? 'Question image' : `Question ${view.questionIndex + 1}`}
                className="h-full min-h-0 min-w-0 flex-1 rounded-[min(0.94vw,1.67vh)] object-contain"
              />
            )}
          </div>
        </section>
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
            {buzzCountdown && view.buzzTimer ? (
              <BuzzTimeRing countdown={buzzCountdown} seconds={view.buzzTimer.seconds} />
            ) : (
              <BuzzerStatus open={buzzersOpen(view.phase)} />
            )}
            <LockedOut ids={view.lockedOut} players={view.players} />
            {(view.phase === 'QUESTION' || held) && (
              <FalseStarts ids={view.falseStarts} players={view.players} />
            )}
          </>
        )}
      </div>
      <StandingsRail phase={view.phase} players={view.players} show={view.settings.showStandings} />
    </div>
  );
}

function BuzzerStatus({ open }: { open: boolean }) {
  return (
    <p
      role="status"
      className={`shrink-0 self-center rounded-full border-2 px-[4vw] py-[1.6vh] font-display text-[min(3.4vw,6vh)] ${
        open
          ? `border-buzz bg-buzz text-ink [text-shadow:0.25vw_0.25vw_0_var(--color-buzz-ink)] motion-safe:animate-buzz-pulse ${STAGE_RING}`
          : 'border-edge bg-surface text-muted'
      }`}
    >
      {open ? 'Buzzers OPEN' : 'Buzzers locked'}
    </p>
  );
}

/**
 * "Buzzers OPEN" with a buzz time (UI spec, Screen view: Question): the gold stage ring drains
 * clockwise as the seconds run out, and the seconds sit beside the words. At 0 the server reveals
 * the answer (DECISIONS, F63), so the ring never shows time up itself.
 */
function BuzzTimeRing({ countdown, seconds }: { countdown: AnswerCountdown; seconds: number }) {
  const left = seconds > 0 ? countdown.secondsLeft / seconds : 0;
  return (
    <div
      data-buzz-ring
      style={{ '--left': left } as CSSProperties}
      className="shrink-0 self-center rounded-full bg-[conic-gradient(var(--color-accent)_calc(var(--left)*1turn),var(--color-edge)_0)] p-[0.78vw] motion-safe:animate-buzz-pulse"
    >
      <div className="flex items-center gap-[2.4vw] rounded-full border-2 border-buzz bg-buzz px-[4vw] py-[1.6vh] font-display text-[min(3.4vw,6vh)] shadow-[0_0_0_0.47vw_var(--color-bg)]">
        <p role="status" className="text-ink [text-shadow:0.25vw_0.25vw_0_var(--color-buzz-ink)]">
          Buzzers OPEN
        </p>
        <p
          role="timer"
          aria-label="Buzz time"
          className="min-w-[1.6em] rounded-full bg-buzz-ink px-[1vw] text-center leading-tight text-ink tabular-nums"
        >
          {countdown.secondsLeft}
        </p>
      </div>
    </div>
  );
}

/** Players judged wrong on this question, greyed out while the others may still buzz. */
function LockedOut({ ids, players }: { ids: string[]; players: RankedPlayer[] }) {
  const out = players.filter((p) => ids.includes(p.id));
  if (out.length === 0) return null;
  return (
    <div className="flex max-w-full shrink-0 items-baseline justify-center gap-[1.2vw]">
      <p className={`shrink-0 text-muted ${SCREEN_LABEL}`}>locked out</p>
      <ul aria-label="Locked out" className="flex flex-wrap gap-[1vw] overflow-hidden">
        {out.map((player) => (
          <li
            key={player.id}
            className="rounded-full border-2 border-edge bg-surface px-[1.4vw] py-[0.6vh] font-display text-[min(2vw,3.6vh)] text-muted line-through"
          >
            {player.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Players who pressed before the buzzers opened, as chips in their colour with a small amber
 * "Too early" tag (F72): from the press until their wait after the opening ends.
 */
function FalseStarts({ ids, players }: { ids: string[]; players: RankedPlayer[] }) {
  const early = ids.flatMap((id) => players.find((p) => p.id === id) ?? []);
  if (early.length === 0) return null;
  return (
    <ul
      aria-label="Too early"
      className="flex max-w-full shrink-0 flex-wrap justify-center gap-[1vw] overflow-hidden"
    >
      {early.map((player) => (
        <li
          key={player.id}
          style={{ backgroundColor: player.color }}
          className="flex items-center gap-[0.8vw] rounded-full py-[0.6vh] pr-[0.6vw] pl-[1.4vw] font-display text-[min(2vw,3.6vh)] text-bg motion-safe:animate-pop-in"
        >
          {player.name}
          <span
            className={`rounded-full bg-warn px-[0.8vw] py-[0.3vh] text-bg ${SCREEN_LABEL} tracking-[0.12em]`}
          >
            Too early
          </span>
        </li>
      ))}
    </ul>
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
      <p className={`text-muted ${SCREEN_LABEL}`}>Answer</p>
      <p
        className={`max-w-full rounded-[min(1.88vw,3.3vh)] bg-surface px-[4vw] py-[2vh] text-center font-display text-[min(5vw,10vh)] leading-tight break-words text-accent ${STAGE_RING}`}
      >
        {answer}
      </p>
      {scorer && (
        <p
          data-scorer
          style={{ backgroundColor: scorer.color }}
          className="relative flex items-center gap-[0.6vw] rounded-full px-[2.4vw] py-[1vh] font-display text-[min(3vw,6vh)] text-bg"
        >
          {scorer.name}
          <span className="sr-only"> ✓</span>
          <Icon name="check" className="size-[1em]" />
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
      className={`shrink-0 self-end font-display leading-none whitespace-nowrap tabular-nums ${
        countdown.up
          ? 'rounded-full bg-buzz-ink px-[1.6vw] py-[1vh] text-[min(2.6vw,4.6vh)] text-ink'
          : 'text-[min(5.6vw,10vh)] text-buzz-ink'
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
  // Bungee is wide: a long name steps down so more of it fits before the ellipsis.
  const nameSize = winner.name.length > 9 ? 'text-[min(5.6vw,10vh)]' : 'text-[min(8.1vw,14.4vh)]';
  return (
    <section
      aria-label="Buzz result"
      data-judged={judgedWrong ? 'wrong' : undefined}
      className={`mx-[0.8vw] mb-[0.8vw] flex shrink-0 items-center gap-[3vw] rounded-[min(1.88vw,3.3vh)] px-[3vw] py-[2.4vh] transition-colors ${
        judgedWrong ? `bg-surface ${DIM_RING}` : `bg-buzz ${STAGE_RING}`
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[1vh]">
        <p className={`${SCREEN_LABEL} ${judgedWrong ? 'text-muted' : 'text-buzz-ink'}`}>
          First to buzz
        </p>
        <h2
          className={`flex min-w-0 items-center gap-[1.4vw] font-display leading-none ${nameSize} ${
            judgedWrong
              ? 'text-muted line-through'
              : 'text-ink [text-shadow:0.39vw_0.39vw_0_var(--color-buzz-ink)]'
          }`}
        >
          {/* Their palette colour, so the player can tell it is them (DECISIONS, Prime Time). */}
          <span
            aria-hidden="true"
            data-player-color
            style={{ backgroundColor: winner.color }}
            className="size-[0.4em] shrink-0 rounded-full border-[0.05em] border-buzz-ink"
          />
          <span className="min-w-0 truncate pb-[0.08em]">{winner.name}</span>
        </h2>
      </div>
      {(countdown || others.length > 0) && (
        <div className="flex max-w-[58%] shrink-0 flex-col items-end gap-[1.2vh]">
          {countdown && <Countdown countdown={countdown} />}
          {others.length > 0 && (
            <>
              <p className={`${SCREEN_LABEL} ${judgedWrong ? 'text-muted' : 'text-buzz-ink'}`}>
                also buzzed
              </p>
              <ol
                aria-label="Also buzzed"
                className="flex flex-wrap justify-end gap-[0.8vw] overflow-hidden"
              >
                {others.map(({ player, gapMs }) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-[0.5vw] rounded-full bg-buzz-ink px-[1vw] py-[0.6vh] text-[min(1.4vw,2.5vh)] whitespace-nowrap"
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: player.color }}
                      className="size-[0.6em] shrink-0 rounded-full"
                    />
                    <span className="font-bold text-ink">{player.name}</span>
                    <span className="text-buzz-ink-soft tabular-nums">{formatGap(gapMs)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </section>
  );
}
