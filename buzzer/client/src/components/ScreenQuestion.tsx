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
import { ColourDot } from './ColourDot.js';
import { Icon } from './Icon.js';
import { StandingsRail } from './StandingsRail.js';

/** A player's chip on the Screen: a square paper-2 tile, their colour as a square in an ink ring (design.md Rules). */
const PLAYER_CHIP = 'flex items-center gap-[min(0.6cqw,1.07cqh)] bg-surface font-semibold text-ink';

/** The question text never shrinks below this, however squeezed the card (F52); the floor (F100). */
const QUESTION_MIN_PX = 14;

/**
 * A small sentence-case label on the Screen (13–16px at 1280 wide). Like every Screen size, it has a
 * floor for small displays (F100): `--screen-min-label`, `-body` or `-name`, 0 in the editor's preview.
 */
const SCREEN_LABEL =
  'font-outlier text-[max(var(--screen-min-label),min(1.2cqw,2.1cqh))] font-semibold';

/** A figure on the Screen: Anybody 900 at 150% in tabular figures (design.md Rules). */
const FIGURE = 'font-display font-black font-stretch-150% tabular-nums';

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
    <div className="flex min-h-0 flex-1 gap-[min(2cqw,3.56cqh)] px-[min(3.75cqw,6.67cqh)] pt-[1cqh] pb-[max(3cqh,var(--hint-reserve,0px))]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[4cqh]">
        <section
          aria-label="Question"
          // Under the 4px ink bar on the stock, no fill: the answer's card is the one paper surface (M32).
          className="flex min-h-0 flex-1 flex-col gap-[2cqh] overflow-hidden border-t-4 border-ink pt-[min(1cqw,1.8cqh)] pb-[min(1cqw,1.8cqh)]"
        >
          <p className={`shrink-0 truncate text-muted ${SCREEN_LABEL}`}>{view.title}</p>
          {/* Safe centring: text taller than a squeezed card, even at the smallest size, starts at
            the top and clips at the bottom, instead of spilling over the label. The row carries
            the text size, so the hook measures a box that its font size never changes. */}
          {/* On a portrait display the image goes under the text, across the card's width (F100). */}
          <div
            ref={rowRef}
            className={`flex min-h-0 flex-1 items-center-safe gap-[min(4cqw,7.12cqh)] overflow-hidden ${question.imageId ? 'stage-portrait:flex-col stage-portrait:items-stretch' : ''} ${questionTextClass(text, question.imageId !== undefined)}`}
          >
            {text && (
              <h1
                // Reading text, so Archivo 600: wide capitals are for heads and figures (design.md Rules).
                className={`min-w-0 flex-1 font-sans leading-tight font-semibold tracking-normal break-words font-stretch-normal ${question.imageId ? 'stage-portrait:flex-none' : ''}`}
              >
                {text}
              </h1>
            )}
            {question.imageId && (
              <img
                src={imageSrc ?? imageUrl(view.code, question.imageId)}
                alt={text ? 'Question image' : `Question ${view.questionIndex + 1}`}
                className="h-full min-h-0 min-w-0 flex-1 object-contain stage-portrait:h-auto stage-portrait:w-full"
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
      // Open prints the teal pass and pulses; locked sinks to paper-3. Wide capitals (M32).
      className={`shrink-0 self-center px-[min(4cqw,7.12cqh)] py-[1.6cqh] font-display text-[max(var(--screen-min-name),min(3cqw,5.4cqh))] leading-none font-black uppercase font-stretch-140% ${
        open ? 'bg-accent text-accent-ink motion-safe:animate-buzz-pulse' : 'bg-bg-deep text-muted'
      }`}
    >
      {open ? t('buzzersOpen') : t('buzzersLocked')}
    </p>
  );
}

/**
 * "Buzzers OPEN" with a buzz time (UI spec, Screen view: Question): on the teal pass, an ink bar
 * along its foot drains as the seconds run out, and the seconds sit beside the words (flat, M32). At 0 the server reveals
 * the answer (DECISIONS, F63), so the ring never shows time up itself.
 */
function BuzzTimeRing({ countdown, seconds }: { countdown: AnswerCountdown; seconds: number }) {
  const left = seconds > 0 ? countdown.secondsLeft / seconds : 0;
  const t = useCopy();
  return (
    <div
      data-buzz-ring
      style={{ '--left': left } as CSSProperties}
      className="relative shrink-0 self-center bg-accent text-accent-ink motion-safe:animate-buzz-pulse"
    >
      <div className="flex items-center gap-[min(2.4cqw,4.27cqh)] px-[min(4cqw,7.12cqh)] py-[1.6cqh] font-display text-[max(var(--screen-min-name),min(3cqw,5.4cqh))] leading-none font-black uppercase font-stretch-140%">
        <p role="status">{t('buzzersOpen')}</p>
        <p
          role="timer"
          aria-label="Buzz time"
          className={`min-w-[1.6em] bg-ink px-[min(1cqw,1.78cqh)] py-[0.2em] text-center text-paper ${FIGURE}`}
        >
          {countdown.secondsLeft}
        </p>
      </div>
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-[min(0.6cqw,1.07cqh)] w-[calc(var(--left)*100%)] bg-ink"
      />
    </div>
  );
}

/**
 * A choice question's 2–4 tiles, A–D in their colours (F86). While answers are taken, the time left
 * and "N of M answered" sit under them. At REVEAL the correct tile takes an ink ring and a
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
      <ol className="grid grid-cols-2 gap-x-[min(1.6cqw,2.85cqh)] gap-y-[2cqh] px-[min(0.8cqw,1.43cqh)] pt-[min(0.8cqw,1.43cqh)]">
        {choice.choices.map((text, index) => {
          const correct = revealed && index === choice.correctChoice;
          const count = choice.counts?.[index];
          return (
            <li
              key={index}
              data-choice={CHOICE_LETTERS[index]}
              data-correct={correct || undefined}
              style={{ backgroundColor: CHOICE_COLORS[index] }}
              className={`flex min-w-0 items-center gap-[min(1.4cqw,2.49cqh)] px-[min(1.4cqw,2.49cqh)] py-[1.4cqh] text-bg transition-opacity ${
                correct ? 'ring-[min(0.47cqw,0.84cqh)] ring-ink' : revealed ? 'opacity-35' : ''
              }`}
            >
              <span
                className={`grid size-[max(1.69em,min(4.4cqw,7.8cqh))] shrink-0 place-items-center bg-bg text-[max(var(--screen-min-body),min(2.6cqw,4.6cqh))] text-ink ${FIGURE}`}
              >
                {CHOICE_LETTERS[index]}
              </span>
              <span className="min-w-0 flex-1 text-[max(var(--screen-min-body),min(2.4cqw,4.3cqh))] leading-tight font-semibold break-words">
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
                  className={`min-w-[1.8em] shrink-0 bg-bg px-[min(0.8cqw,1.43cqh)] py-[0.4cqh] text-center text-[max(var(--screen-min-body),min(2.4cqw,4.3cqh))] leading-tight text-ink ${FIGURE}`}
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

/** The time left to answer in a buzz pill, and how many have answered (F86, F88). */
function AnsweringProgress({
  countdown,
  status,
}: {
  countdown: AnswerCountdown | null;
  status: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-[min(2cqw,3.56cqh)]">
      {countdown && (
        <p
          role="timer"
          aria-label="Time to answer"
          className={`min-w-[2.2em] bg-buzz px-[min(1.4cqw,2.49cqh)] py-[0.6cqh] text-center text-[max(var(--screen-min-name),min(3.4cqw,6cqh))] leading-tight text-buzz-ink ${FIGURE}`}
        >
          {countdown.secondsLeft}
        </p>
      )}
      <p
        role="status"
        className="text-[max(var(--screen-min-body),min(2.6cqw,4.6cqh))] font-semibold text-ink"
      >
        {status}
      </p>
    </div>
  );
}

/** A sunk paper-3 block for answers not taken: before they open, or once typed answers lock. */
function AnswersPill({ label }: { label: string }) {
  return (
    <p
      role="status"
      className="shrink-0 self-center bg-bg-deep px-[min(3cqw,5.34cqh)] py-[1.2cqh] font-display text-[max(var(--screen-min-body),min(2.2cqw,3.9cqh))] leading-none font-black text-muted uppercase font-stretch-140%"
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
        <AnswerCard answer={answer} />
        {winners.length > 0 ? (
          <ul
            aria-label="Got it"
            className="flex max-w-full flex-wrap justify-center gap-[min(1cqw,1.78cqh)] overflow-hidden"
          >
            {winners.map((player) => (
              <li
                key={player.id}
                data-scorer
                className={`${PLAYER_CHIP} bg-win px-[min(2cqw,3.56cqh)] py-[0.8cqh] text-[max(var(--screen-min-name),min(2.4cqw,4.6cqh))] text-win-ink`}
              >
                <ColourDot square color={player.color} />
                {player.name}
                <span className="sr-only"> ✓</span>
                <Icon name="check" className="size-[1em]" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[max(var(--screen-min-body),min(2.6cqw,4.6cqh))] font-semibold text-muted">
            {t('nobodyGotIt')}
          </p>
        )}
      </section>
    );
  }
  if (phase === 'ANSWERING' && typed.closed) {
    return (
      <div className="flex shrink-0 items-center justify-center gap-[min(2cqw,3.56cqh)]">
        <AnswersPill label={t('answersClosed')} />
        <p className="text-[max(var(--screen-min-body),min(2.6cqw,4.6cqh))] font-semibold text-ink">
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

/** Players judged wrong on this question, sunk to paper-3 while the others may still buzz. */
function LockedOut({ ids, players }: { ids: string[]; players: RankedPlayer[] }) {
  const out = players.filter((p) => ids.includes(p.id));
  const t = useCopy();
  if (out.length === 0) return null;
  return (
    <div className="flex max-w-full shrink-0 items-baseline justify-center gap-[min(1.2cqw,2.14cqh)]">
      <p className={`shrink-0 text-muted ${SCREEN_LABEL}`}>{t('lockedOut')}</p>
      <ul
        aria-label="Locked out"
        className="flex flex-wrap gap-[min(1cqw,1.78cqh)] overflow-hidden"
      >
        {out.map((player) => (
          <li
            key={player.id}
            className="bg-bg-deep px-[min(1.4cqw,2.49cqh)] py-[0.6cqh] text-[max(var(--screen-min-name),min(2cqw,3.6cqh))] font-semibold text-muted line-through"
          >
            {player.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Players who pressed before the buzzers opened, as chips with their colour's square and a small
 * "Too early" tag on the orange pass, warn (F72): from the press until their wait after the opening ends.
 */
function FalseStarts({ ids, players }: { ids: string[]; players: RankedPlayer[] }) {
  const early = ids.flatMap((id) => players.find((p) => p.id === id) ?? []);
  const t = useCopy();
  if (early.length === 0) return null;
  return (
    <ul
      aria-label="Too early"
      className="flex max-w-full shrink-0 flex-wrap justify-center gap-[min(1cqw,1.78cqh)] overflow-hidden"
    >
      {early.map((player) => (
        <li
          key={player.id}
          className={`${PLAYER_CHIP} py-[0.6cqh] pr-[min(0.6cqw,1.07cqh)] pl-[min(1.4cqw,2.49cqh)] text-[max(var(--screen-min-name),min(2cqw,3.6cqh))]`}
        >
          <ColourDot square color={player.color} />
          {player.name}
          <span
            className={`bg-warn px-[min(0.8cqw,1.43cqh)] py-[0.3cqh] text-card-ink ${SCREEN_LABEL}`}
          >
            {t('tooEarlyTag')}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The answer on the paper surface under the question, and the player who got it right on the teal
 * pass, win, with its check (UI spec, Screen view: Reveal). "+100" floats up beside their name when the correct judgement's `fx` arrives.
 */
function Reveal({ answer, scorer }: { answer: string | undefined; scorer?: RankedPlayer }) {
  const recent = useRecentFx();
  const scored =
    recent?.fx.kind === 'correct' && recent.fx.playerId === scorer?.id ? recent : undefined;
  return (
    <section aria-label="Answer" className="flex shrink-0 flex-col items-center gap-[2cqh]">
      <AnswerCard answer={answer} />
      {scorer && (
        <p
          data-scorer
          className={`relative ${PLAYER_CHIP} bg-win px-[min(2.4cqw,4.27cqh)] py-[1cqh] text-[max(var(--screen-min-name),min(3cqw,6cqh))] text-win-ink`}
        >
          <ColourDot square color={scorer.color} />
          {scorer.name}
          <span className="sr-only"> ✓</span>
          <Icon name="check" className="size-[1em]" />
          {scored?.fx.kind === 'correct' && (
            <span
              key={scored.seq}
              className={`absolute top-1/2 left-full ml-[min(1.5cqw,2.67cqh)] -translate-y-1/2 text-[max(var(--screen-min-name),min(3.2cqw,6cqh))] leading-none whitespace-nowrap text-ink motion-safe:animate-float-up ${FIGURE}`}
            >
              {signedPoints(scored.fx.points)}
            </span>
          )}
        </p>
      )}
    </section>
  );
}

/** The answer in wide capitals on the screen's one paper surface: paper-2 under the 4px ink bar, no lift (design.md Rules). */
function AnswerCard({ answer }: { answer: string | undefined }) {
  const t = useCopy();
  return (
    <div
      data-answer-card
      className="flex max-w-full flex-col items-center gap-[1cqh] border-t-4 border-ink bg-card px-[min(4cqw,7.12cqh)] py-[2cqh] text-card-ink shadow-card"
    >
      <p className={SCREEN_LABEL}>{t('answer')}</p>
      <p className="max-w-full text-center font-display text-[max(var(--screen-min-name),min(4.4cqw,8.8cqh))] leading-tight font-black break-words uppercase font-stretch-140%">
        {answer}
      </p>
    </div>
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
      className={`shrink-0 self-end leading-none whitespace-nowrap uppercase ${FIGURE} ${
        countdown.up
          ? 'bg-buzz-ink px-[min(1.6cqw,2.85cqh)] py-[1cqh] text-[max(var(--screen-min-body),min(2.2cqw,3.9cqh))] text-buzz'
          : 'text-[max(var(--screen-min-name),min(5.6cqw,10cqh))] text-buzz-ink'
      }`}
    >
      {countdownText(countdown, t)}
    </p>
  );
}

interface BuzzResultProps {
  winner: RankedPlayer;
  /** Judged wrong and waiting for the reopen: the banner sinks to paper-3 and reads "Wrong". */
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
  // The display face is wide: a long name steps down so more of it fits before the ellipsis.
  const t = useCopy();
  const nameSize =
    winner.name.length > 9
      ? 'text-[max(var(--screen-min-name),min(5.6cqw,10cqh))]'
      : 'text-[max(var(--screen-min-name),min(8.1cqw,14.4cqh))]';
  return (
    <section
      aria-label="Buzz result"
      data-judged={judgedWrong ? 'wrong' : undefined}
      className={`mb-[min(0.8cqw,1.43cqh)] flex shrink-0 items-center gap-[min(3cqw,5.34cqh)] px-[min(3cqw,5.34cqh)] py-[2.4cqh] transition-colors stage-portrait:flex-col stage-portrait:items-stretch ${
        judgedWrong ? 'bg-bg-deep' : 'bg-buzz'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[1cqh]">
        {/* The state's word: buzz is "First to buzz", and a wrong judgement says so (M32). */}
        <p className={`${SCREEN_LABEL} ${judgedWrong ? 'text-ink' : 'text-buzz-ink'}`}>
          {judgedWrong ? t('wrong') : t('firstToBuzz')}
        </p>
        <h2
          className={`flex min-w-0 items-center gap-[min(1.4cqw,2.49cqh)] font-display leading-none font-black uppercase font-stretch-140% ${nameSize} ${
            judgedWrong ? 'text-muted line-through' : 'text-buzz-ink'
          }`}
        >
          {/* Their palette colour, so the player can tell it is them, ringed in the panel's ink. */}
          <ColourDot
            square
            data-player-color
            color={winner.color}
            className={`size-[0.4em] ring-[0.05em] ${judgedWrong ? 'ring-ink' : 'ring-buzz-ink'}`}
          />
          <span className="min-w-0 truncate pb-[0.08em]">{winner.name}</span>
        </h2>
      </div>
      {(countdown || others.length > 0) && (
        // Portrait: under the banner, so the winner's name keeps the full width (F100).
        <div className="flex max-w-[58%] shrink-0 flex-col items-end gap-[1.2cqh] stage-portrait:max-w-full stage-portrait:items-start">
          {countdown && <Countdown countdown={countdown} />}
          {others.length > 0 && (
            <>
              <p className={`${SCREEN_LABEL} ${judgedWrong ? 'text-muted' : 'text-buzz-ink'}`}>
                {t('alsoBuzzed')}
              </p>
              <ol
                aria-label="Also buzzed"
                className="flex flex-wrap justify-end gap-[min(0.8cqw,1.43cqh)] overflow-hidden stage-portrait:justify-start"
              >
                {others.map(({ player, gapMs }) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-[min(0.5cqw,0.89cqh)] bg-buzz-ink px-[min(1cqw,1.78cqh)] py-[0.6cqh] text-[max(var(--screen-min-body),min(1.4cqw,2.5cqh))] whitespace-nowrap"
                  >
                    <ColourDot square color={player.color} />
                    <span className="font-semibold text-ink">{player.name}</span>
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
