import { useRef, type CSSProperties } from 'react';
import { CHOICE_COLORS, CHOICE_LETTERS } from '../../../shared/constants.js';
import type {
  BuzzGap,
  ChoiceView,
  Phase,
  RankedPlayer,
  ScreenView,
  TypedView,
} from '../../../shared/types.js';
import { imageUrl } from '../lib/api.js';
import { useCopy } from '../lib/copy.js';
import { signedPoints } from '../lib/results.js';
import { buzzersOpen, formatGap, questionTextClass } from '../lib/screenQuestion.js';
import {
  countdownText,
  useAnswerCountdown,
  useBuzzCountdown,
  useAnsweringCountdown,
  type AnswerCountdown,
} from '../lib/useAnswerCountdown.js';
import { useFalseStartWait } from '../lib/useFalseStartWait.js';
import { useRecentFx } from '../lib/useRecentFx.js';
import { useShrinkToFit } from '../lib/useShrinkToFit.js';
import { Icon } from './Icon.js';
import { StandingsRail } from './StandingsRail.js';

/** The gold stage ring round the hero panel: 6px of base, then 4px of gold, at 1280 wide. */
const STAGE_RING = 'shadow-[0_0_0_0.47cqw_var(--color-bg),0_0_0_0.78cqw_var(--color-accent)]';
/** The same ring in the border colour, for a banner judged wrong. */
const DIM_RING = 'shadow-[0_0_0_0.47cqw_var(--color-bg),0_0_0_0.78cqw_var(--color-edge)]';

/** The question text never shrinks below this, however squeezed the card (F52). */
const QUESTION_MIN_PX = 12;

/** A small uppercase label on the Screen (13–16px at 1280 wide). */
const SCREEN_LABEL = 'text-[min(1.2cqw,2.1cqh)] font-bold tracking-[0.25em] uppercase';

/**
 * The Screen during a question: its text and image in a card (the number is in the header), then
 * the buzzer status or, once
 * someone has won the buzz, their banner and the "also buzzed" gaps (UI spec, Screen view).
 * The answer shows only when the view carries it, which the server allows at REVEAL alone.
 * `imageSrc` replaces the room's image URL, for the set editor's preview of a stored blob.
 * Sizes are in `cqw`/`cqh`. On the Screen no size container wraps it, so they are the window's
 * (`svw`/`svh`); the editor's preview wraps it in a 16:9 stage, a small TV (EDT-08).
 */
export function ScreenQuestion({ view, imageSrc }: { view: ScreenView; imageSrc?: string }) {
  const { question } = view;
  const countdown = useAnswerCountdown(view);
  const buzzCountdown = useBuzzCountdown(view);
  const answeringCountdown = useAnsweringCountdown(view);
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
    <div className="flex min-h-0 flex-1 gap-[2cqw] px-[3.75cqw] pt-[1cqh] pb-[3cqh]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[4cqh]">
        <section
          aria-label="Question"
          className="flex min-h-0 flex-1 flex-col gap-[2cqh] overflow-hidden rounded-[min(1.56cqw,2.8cqh)] border-2 border-edge bg-surface px-[2.2cqw] py-[min(2cqw,3.5cqh)]"
        >
          <p className={`shrink-0 truncate text-muted ${SCREEN_LABEL}`}>{view.title}</p>
          {/* Safe centring: text taller than a squeezed card, even at the smallest size, starts at
            the top and clips at the bottom, instead of spilling over the label. The row carries
            the text size, so the hook measures a box that its font size never changes. */}
          <div
            ref={rowRef}
            className={`flex min-h-0 flex-1 items-center-safe gap-[4cqw] overflow-hidden ${questionTextClass(text, question.imageId !== undefined)}`}
          >
            {text && <h1 className="min-w-0 flex-1 leading-tight font-bold break-words">{text}</h1>}
            {question.imageId && (
              <img
                src={imageSrc ?? imageUrl(view.code, question.imageId)}
                alt={text ? 'Question image' : `Question ${view.questionIndex + 1}`}
                className="h-full min-h-0 min-w-0 flex-1 rounded-[min(0.94cqw,1.67cqh)] object-contain"
              />
            )}
          </div>
        </section>
        {view.choice ? (
          // A choice question shows its tiles in place of the buzzer status, the lit tile in
          // place of the answer at REVEAL, and nobody's name: several players may be right (F86).
          <ChoiceBoard choice={view.choice} phase={view.phase} countdown={answeringCountdown} />
        ) : view.typed ? (
          // A typed question has no buzzers; at REVEAL every player marked right is named (F88).
          <TypedBoard
            typed={view.typed}
            phase={view.phase}
            countdown={answeringCountdown}
            answer={question.answer}
            players={view.players}
          />
        ) : view.phase === 'REVEAL' ? (
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
      <StandingsRail
        phase={view.phase}
        players={view.players}
        show={view.settings.showStandings}
        teams={view.teams}
      />
    </div>
  );
}

function BuzzerStatus({ open }: { open: boolean }) {
  const t = useCopy();
  return (
    <p
      role="status"
      className={`shrink-0 self-center rounded-full border-2 px-[4cqw] py-[1.6cqh] font-display text-[min(3.4cqw,6cqh)] ${
        open
          ? `border-buzz bg-buzz text-ink [text-shadow:0.25cqw_0.25cqw_0_var(--color-buzz-ink)] motion-safe:animate-buzz-pulse ${STAGE_RING}`
          : 'border-edge bg-surface text-muted'
      }`}
    >
      {open ? t('buzzersOpen') : t('buzzersLocked')}
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
  const t = useCopy();
  return (
    <div
      data-buzz-ring
      style={{ '--left': left } as CSSProperties}
      className="shrink-0 self-center rounded-full bg-[conic-gradient(var(--color-accent)_calc(var(--left)*1turn),var(--color-edge)_0)] p-[0.78cqw] motion-safe:animate-buzz-pulse"
    >
      <div className="flex items-center gap-[2.4cqw] rounded-full border-2 border-buzz bg-buzz px-[4cqw] py-[1.6cqh] font-display text-[min(3.4cqw,6cqh)] shadow-[0_0_0_0.47cqw_var(--color-bg)]">
        <p role="status" className="text-ink [text-shadow:0.25cqw_0.25cqw_0_var(--color-buzz-ink)]">
          {t('buzzersOpen')}
        </p>
        <p
          role="timer"
          aria-label="Buzz time"
          className="min-w-[1.6em] rounded-full bg-buzz-ink px-[1cqw] text-center leading-tight text-ink tabular-nums"
        >
          {countdown.secondsLeft}
        </p>
      </div>
    </div>
  );
}

/**
 * A choice question's 2–4 tiles, A–D in their colours (F86). While answers are taken, the time left
 * and "N of M answered" sit under them. At REVEAL the correct tile lights in the gold ring with a
 * check, the others dim, and each shows how many picked it. Before REVEAL the view carries neither
 * the correct choice nor the counts, so nothing here can give the answer away.
 */
function ChoiceBoard({
  choice,
  phase,
  countdown,
}: {
  choice: ChoiceView;
  phase: Phase;
  countdown: AnswerCountdown | null;
}) {
  const revealed = choice.correctChoice !== undefined;
  const t = useCopy();
  return (
    <section aria-label="Choices" className="flex shrink-0 flex-col gap-[2.4cqh]">
      <ol className="grid grid-cols-2 gap-x-[1.6cqw] gap-y-[2cqh] px-[0.8cqw] pt-[0.8cqw]">
        {choice.choices.map((text, index) => {
          const correct = revealed && index === choice.correctChoice;
          const count = choice.counts?.[index];
          return (
            <li
              key={index}
              data-choice={CHOICE_LETTERS[index]}
              data-correct={correct || undefined}
              style={{ backgroundColor: CHOICE_COLORS[index] }}
              className={`flex min-w-0 items-center gap-[1.4cqw] rounded-[min(1.56cqw,2.8cqh)] px-[1.4cqw] py-[1.4cqh] text-bg transition-opacity ${
                correct ? STAGE_RING : revealed ? 'opacity-35' : ''
              }`}
            >
              <span className="grid size-[min(4.4cqw,7.8cqh)] shrink-0 place-items-center rounded-full bg-bg font-display text-[min(2.6cqw,4.6cqh)] text-ink">
                {CHOICE_LETTERS[index]}
              </span>
              <span className="min-w-0 flex-1 text-[min(2.4cqw,4.3cqh)] leading-tight font-bold break-words">
                {text}
              </span>
              {correct && (
                <>
                  <span className="sr-only">, correct</span>
                  <Icon name="check" className="size-[min(3.4cqw,6cqh)] shrink-0" />
                </>
              )}
              {count !== undefined && (
                <span
                  data-count
                  className="min-w-[1.8em] shrink-0 rounded-full bg-bg px-[0.8cqw] py-[0.4cqh] text-center font-display text-[min(2.4cqw,4.3cqh)] leading-tight text-ink tabular-nums"
                >
                  {count}
                  <span className="sr-only"> picked</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {phase === 'ANSWERING' && (
        <AnsweringProgress
          countdown={countdown}
          status={t('answeredOf', { answered: choice.answered, expected: choice.expected })}
        />
      )}
      {phase === 'QUESTION' && <AnswersPill label={t('answersLocked')} />}
    </section>
  );
}

/** The time left to answer in a red pill, and how many have answered (F86, F88). */
function AnsweringProgress({
  countdown,
  status,
}: {
  countdown: AnswerCountdown | null;
  status: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-[2cqw]">
      {countdown && (
        <p
          role="timer"
          aria-label="Time to answer"
          className={`min-w-[2.2em] rounded-full bg-buzz px-[1.4cqw] py-[0.6cqh] text-center font-display text-[min(3.4cqw,6cqh)] leading-tight text-ink tabular-nums ${STAGE_RING}`}
        >
          {countdown.secondsLeft}
        </p>
      )}
      <p role="status" className="font-display text-[min(2.6cqw,4.6cqh)] text-accent">
        {status}
      </p>
    </div>
  );
}

/** A grey pill for answers not taken: before they open, or once typed answers lock. */
function AnswersPill({ label }: { label: string }) {
  return (
    <p
      role="status"
      className="shrink-0 self-center rounded-full border-2 border-edge bg-surface px-[3cqw] py-[1.2cqh] font-display text-[min(2.6cqw,4.6cqh)] text-muted"
    >
      {label}
    </p>
  );
}

interface TypedBoardProps {
  typed: TypedView;
  phase: Phase;
  countdown: AnswerCountdown | null;
  /** In the view at REVEAL only. */
  answer: string | undefined;
  players: RankedPlayer[];
}

/**
 * A typed question (F88): "Answers locked" before it opens; the time left and "N of M answered"
 * while answers come in; "Answers closed" once they lock and the host marks them. At REVEAL, the
 * answer, and the names of the players whose answers were marked right. The view carries no
 * answers or groups before REVEAL, so nothing here can give one away.
 */
function TypedBoard({ typed, phase, countdown, answer, players }: TypedBoardProps) {
  const t = useCopy();
  if (phase === 'REVEAL') {
    const right = new Set(
      (typed.groups ?? []).filter((group) => group.correct).flatMap((group) => group.playerIds),
    );
    const winners = players.filter((player) => right.has(player.id));
    return (
      <section aria-label="Answer" className="flex shrink-0 flex-col items-center gap-[2cqh]">
        <p className={`text-muted ${SCREEN_LABEL}`}>{t('answer')}</p>
        <AnswerText answer={answer} />
        {winners.length > 0 ? (
          <ul
            aria-label="Got it"
            className="flex max-w-full flex-wrap justify-center gap-[1cqw] overflow-hidden"
          >
            {winners.map((player) => (
              <li
                key={player.id}
                data-scorer
                style={{ backgroundColor: player.color }}
                className="flex items-center gap-[0.6cqw] rounded-full px-[2cqw] py-[0.8cqh] font-display text-[min(2.4cqw,4.6cqh)] text-bg motion-safe:animate-pop-in"
              >
                {player.name}
                <span className="sr-only"> ✓</span>
                <Icon name="check" className="size-[1em]" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-display text-[min(2.6cqw,4.6cqh)] text-muted">{t('nobodyGotIt')}</p>
        )}
      </section>
    );
  }
  if (phase === 'ANSWERING' && typed.closed) {
    return (
      <div className="flex shrink-0 items-center justify-center gap-[2cqw]">
        <AnswersPill label={t('answersClosed')} />
        <p className="font-display text-[min(2.6cqw,4.6cqh)] text-accent">
          {t('answeredCount', { n: typed.answered })}
        </p>
      </div>
    );
  }
  if (phase === 'ANSWERING') {
    return (
      <AnsweringProgress
        countdown={countdown}
        status={t('answeredOf', { answered: typed.answered, expected: typed.expected })}
      />
    );
  }
  return <AnswersPill label={t('answersLocked')} />;
}

/** Players judged wrong on this question, greyed out while the others may still buzz. */
function LockedOut({ ids, players }: { ids: string[]; players: RankedPlayer[] }) {
  const out = players.filter((p) => ids.includes(p.id));
  const t = useCopy();
  if (out.length === 0) return null;
  return (
    <div className="flex max-w-full shrink-0 items-baseline justify-center gap-[1.2cqw]">
      <p className={`shrink-0 text-muted ${SCREEN_LABEL}`}>{t('lockedOut')}</p>
      <ul aria-label="Locked out" className="flex flex-wrap gap-[1cqw] overflow-hidden">
        {out.map((player) => (
          <li
            key={player.id}
            className="rounded-full border-2 border-edge bg-surface px-[1.4cqw] py-[0.6cqh] font-display text-[min(2cqw,3.6cqh)] text-muted line-through"
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
  const t = useCopy();
  if (early.length === 0) return null;
  return (
    <ul
      aria-label="Too early"
      className="flex max-w-full shrink-0 flex-wrap justify-center gap-[1cqw] overflow-hidden"
    >
      {early.map((player) => (
        <li
          key={player.id}
          style={{ backgroundColor: player.color }}
          className="flex items-center gap-[0.8cqw] rounded-full py-[0.6cqh] pr-[0.6cqw] pl-[1.4cqw] font-display text-[min(2cqw,3.6cqh)] text-bg motion-safe:animate-pop-in"
        >
          {player.name}
          <span
            className={`rounded-full bg-warn px-[0.8cqw] py-[0.3cqh] text-bg ${SCREEN_LABEL} tracking-[0.12em]`}
          >
            {t('tooEarlyTag')}
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
  const t = useCopy();
  return (
    <section aria-label="Answer" className="flex shrink-0 flex-col items-center gap-[2cqh]">
      <p className={`text-muted ${SCREEN_LABEL}`}>{t('answer')}</p>
      <AnswerText answer={answer} />
      {scorer && (
        <p
          data-scorer
          style={{ backgroundColor: scorer.color }}
          className="relative flex items-center gap-[0.6cqw] rounded-full px-[2.4cqw] py-[1cqh] font-display text-[min(3cqw,6cqh)] text-bg"
        >
          {scorer.name}
          <span className="sr-only"> ✓</span>
          <Icon name="check" className="size-[1em]" />
          {scored?.fx.kind === 'correct' && (
            <span
              key={scored.seq}
              className="absolute top-1/2 left-full ml-[1.5cqw] -translate-y-1/2 font-display text-[min(3.2cqw,6cqh)] leading-none whitespace-nowrap text-win motion-safe:animate-float-up"
            >
              {signedPoints(scored.fx.points)}
            </span>
          )}
        </p>
      )}
    </section>
  );
}

/** The answer in large type, in the gold stage ring. */
function AnswerText({ answer }: { answer: string | undefined }) {
  return (
    <p
      className={`max-w-full rounded-[min(1.88cqw,3.3cqh)] bg-surface px-[4cqw] py-[2cqh] text-center font-display text-[min(5cqw,10cqh)] leading-tight break-words text-accent ${STAGE_RING}`}
    >
      {answer}
    </p>
  );
}

/** The answer countdown beside the winner's banner (UI spec, Screen view: Buzzed), then "Time's up!". */
function Countdown({ countdown }: { countdown: AnswerCountdown }) {
  const t = useCopy();
  return (
    <p
      role="timer"
      aria-label="Answer time"
      data-up={countdown.up || undefined}
      className={`shrink-0 self-end font-display leading-none whitespace-nowrap tabular-nums ${
        countdown.up
          ? 'rounded-full bg-buzz-ink px-[1.6cqw] py-[1cqh] text-[min(2.6cqw,4.6cqh)] text-ink'
          : 'text-[min(5.6cqw,10cqh)] text-buzz-ink'
      }`}
    >
      {countdownText(countdown, t)}
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
  const t = useCopy();
  const nameSize =
    winner.name.length > 9 ? 'text-[min(5.6cqw,10cqh)]' : 'text-[min(8.1cqw,14.4cqh)]';
  return (
    <section
      aria-label="Buzz result"
      data-judged={judgedWrong ? 'wrong' : undefined}
      className={`mx-[0.8cqw] mb-[0.8cqw] flex shrink-0 items-center gap-[3cqw] rounded-[min(1.88cqw,3.3cqh)] px-[3cqw] py-[2.4cqh] transition-colors ${
        judgedWrong ? `bg-surface ${DIM_RING}` : `bg-buzz ${STAGE_RING}`
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[1cqh]">
        <p className={`${SCREEN_LABEL} ${judgedWrong ? 'text-muted' : 'text-buzz-ink'}`}>
          {t('firstToBuzz')}
        </p>
        <h2
          className={`flex min-w-0 items-center gap-[1.4cqw] font-display leading-none ${nameSize} ${
            judgedWrong
              ? 'text-muted line-through'
              : 'text-ink [text-shadow:0.39cqw_0.39cqw_0_var(--color-buzz-ink)]'
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
        <div className="flex max-w-[58%] shrink-0 flex-col items-end gap-[1.2cqh]">
          {countdown && <Countdown countdown={countdown} />}
          {others.length > 0 && (
            <>
              <p className={`${SCREEN_LABEL} ${judgedWrong ? 'text-muted' : 'text-buzz-ink'}`}>
                {t('alsoBuzzed')}
              </p>
              <ol
                aria-label="Also buzzed"
                className="flex flex-wrap justify-end gap-[0.8cqw] overflow-hidden"
              >
                {others.map(({ player, gapMs }) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-[0.5cqw] rounded-full bg-buzz-ink px-[1cqw] py-[0.6cqh] text-[min(1.4cqw,2.5cqh)] whitespace-nowrap"
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
