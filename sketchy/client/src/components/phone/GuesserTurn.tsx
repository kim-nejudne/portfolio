import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  GUESS_MAX,
  LAST_SECONDS_MS,
  REACTION_INTERVAL_MS,
  REACTIONS,
} from '../../../../shared/constants.js';
import type { Ack, PlayerView, Reaction } from '../../../../shared/types.js';
import type { CopyKey, Translate } from '../../lib/copy.js';
import { GUESS_NOTICE_MS, guessAnswer, type OwnGuess } from '../../lib/phone.js';
import { formatClock, hintLetters } from '../../lib/screen.js';
import { useCountdown } from '../../lib/useCountdown.js';
import { Avatar } from '../Avatar.js';
import { Blanks } from '../sketch/Blanks.js';
import { CountdownRing } from '../sketch/CountdownRing.js';
import { Highlight } from '../sketch/Highlight.js';
import { Stamp } from '../sketch/Stamp.js';
import { copyAround, NameInColour } from './NameInColour.js';

interface Props {
  view: PlayerView;
  receivedAt: number;
  /** This phone's own answered guesses this turn, newest last ("pillow ✗", "slipper ≈"). */
  misses: OwnGuess[];
  /** Counts this phone's near misses; each new one shows "So close!" under the box. */
  nearMiss: number;
  /** Sends the guess; resolves with the server's answer, or `null` if it was lost. */
  onGuess: (text: string) => Promise<Ack | null>;
  /** Sends a reaction to the Screens (after a correct guess). */
  onReact?: (emoji: Reaction) => void;
  /** Joined during this turn: "You're in! Mika is drawing. Type your guess." until their first guess. */
  welcome?: boolean;
  t: Translate;
}

/**
 * A guesser's phone in CHOOSING and DRAWING (UI by role and phase, Guesser phone; Sketchbook
 * Guesser), a ruled page with a red margin: the Nunito clock and "✏️ Mika drawing", the blanks,
 * the guess line near the top (so the keyboard never covers it), "So close!" on the highlighter,
 * then this phone's tries on the lines. After a correct guess: a big ✓, "Got it!" and a +points
 * stamp, never the word, then the reactions. This turn's points sit in the margin. While the
 * drawer chooses: their avatar, "Mika is choosing a word…" and the ring. No drawing here, on
 * purpose.
 */
export function GuesserTurn({
  view,
  receivedAt,
  misses,
  nearMiss,
  onGuess,
  onReact,
  welcome,
  t,
}: Props) {
  const turn = view.turn!;
  const left = useCountdown(turn.timer, receivedAt);
  const [text, setText] = useState('');
  // `n` restarts the timer when the same note comes again.
  const [notice, setNotice] = useState<{ key: CopyKey; n: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), GUESS_NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  // Cleared for a moment first, so a screen reader announces a repeat as well.
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showNotice = useCallback((key: CopyKey) => {
    setNotice(null);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice((cur) => ({ key, n: (cur?.n ?? 0) + 1 })), 50);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // Only near misses after this box appeared: the count outlives the turn.
  const seenNearMiss = useRef(nearMiss);
  useEffect(() => {
    if (nearMiss === seenNearMiss.current) return;
    seenNearMiss.current = nearMiss;
    showNotice('soClose');
  }, [nearMiss, showNotice]);
  const me = view.players.find((p) => p.pid === view.me.pid);
  const guessed = me?.guessed ?? false;
  const drawing = view.phase === 'DRAWING';
  const [sentOne, setSentOne] = useState(false);
  const showWelcome = welcome === true && drawing && !guessed && !sentOne;

  // A mid-game joiner lands on the guess box (F23).
  useEffect(() => {
    if (showWelcome) inputRef.current?.focus();
  }, [showWelcome]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const guess = text.trim();
    if (guess) {
      setSentOne(true);
      void onGuess(guess).then((res) => {
        const answer = guessAnswer(res);
        if (answer.notice) showNotice(answer.notice);
        if (answer.restore) {
          // Unless they have started typing the next one ("Slow down" still says the last one
          // didn't go).
          setText((cur) => (cur === '' ? guess : cur));
          inputRef.current?.focus();
        }
      });
    }
    setText('');
    // Keep the keyboard up for the next guess.
    inputRef.current?.focus();
  };

  const mask = turn.mask ?? [];
  // A drawer missing from the list (never expected) still gets the line, without an avatar.
  const drawer = view.players.find((p) => p.pid === turn.drawerPid) ?? {
    name: turn.drawerName,
    color: 'currentColor',
    avatar: '',
  };
  const points = view.me.turnPoints;

  return (
    // A ruled page (the page's `paper-ruled`): everything sits right of the red margin, where only
    // this turn's points are written.
    <div className="relative flex h-full flex-col pt-1 pr-[22px] pb-3 pl-[62px]">
      {drawing ? (
        <>
          <p className="flex min-h-[34px] items-center gap-3 text-lg leading-tight">
            <span
              role="timer"
              className={`shrink-0 font-num text-2xl font-black tabular-nums ${
                left <= LAST_SECONDS_MS ? 'text-red' : 'text-ink'
              }`}
            >
              {formatClock(left)}
            </span>
            <span className="min-w-0 truncate">
              <NameInColour say={(name) => t('isDrawingShort', { name })} player={drawer} />
            </span>
          </p>

          {guessed ? (
            <>
              <GotIt points={points} t={t} />
              {onReact && <ReactionRow onReact={onReact} t={t} />}
            </>
          ) : (
            <>
              <Blanks mask={mask} label={blanksLabel(mask, t)} size="25px" className="mt-1" />
              {/* The note lives with the box, so it takes no room while empty. */}
              <div className="mt-1 flex shrink-0 flex-col">
                <form
                  onSubmit={submit}
                  // The pen underline is the box; focused, it thickens (a shadow, so nothing moves).
                  className="flex h-14 items-center gap-2 border-b-[3px] border-pen focus-within:shadow-[0_2px_0_var(--color-pen)]"
                >
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={GUESS_MAX}
                    placeholder={t('guessPlaceholder')}
                    aria-label={t('guessPlaceholder')}
                    aria-describedby={showWelcome ? 'joined-mid-game' : undefined}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="send"
                    className="h-full w-full min-w-0 bg-transparent text-[26px] text-ink caret-pen outline-none placeholder:text-soft"
                  />
                  <button
                    type="submit"
                    aria-label={t('send')}
                    // Tapping send must not take focus from the box, or the keyboard drops.
                    onMouseDown={(e) => e.preventDefault()}
                    className="wobbly grid size-12 shrink-0 place-items-center bg-pen text-paper focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-95"
                  >
                    <SendIcon />
                  </button>
                </form>
                <p role="status" aria-live="polite" className="text-[22px] leading-tight">
                  {notice ? (
                    // Only as wide as its words, so the pop's overshoot stays on the page.
                    <span
                      key={notice.n}
                      className="mt-2 inline-block origin-left motion-safe:animate-pop"
                    >
                      {notice.key === 'soClose' ? (
                        <Highlight>{t(notice.key)}</Highlight>
                      ) : (
                        t(notice.key)
                      )}
                    </span>
                  ) : null}
                </p>
                {showWelcome && (
                  <p id="joined-mid-game" className="mt-2 text-lg leading-snug break-words">
                    {t('joinedMidGame', { name: turn.drawerName })}
                  </p>
                )}
              </div>
              <Tries misses={misses} t={t} />
            </>
          )}
        </>
      ) : (
        <div className="mt-6 grid justify-items-center gap-4 text-center">
          {drawer.avatar && <Avatar player={drawer} size="64px" />}
          <p className="text-[30px] leading-tight break-words">
            <NameInColour say={(name) => t('isChoosing', { name })} player={drawer} />
          </p>
          {turn.timer && (
            <span role="timer" aria-label={t('seconds', { n: Math.ceil(left / 1000) })}>
              <CountdownRing remainingMs={left} totalMs={turn.timer.totalMs} choosing size="96px" />
            </span>
          )}
        </div>
      )}

      <p className="mt-auto pt-2 text-lg leading-tight text-soft">{t('watchScreen')}</p>
      {/* SPEC-QUESTION: the spec's sketch has "+0 this turn"; F60's Done-when says never "+0" (DECISIONS 83). */}
      {points > 0 && <MarginPoints points={points} t={t} />}
    </div>
  );
}

/**
 * This phone's own wrong and close tries (the last `OWN_GUESSES_SHOWN`), one to a ruled line,
 * newest first, so the latest sits by the "So close!" note: a wrong one struck through in red pen
 * with ✗, a close one circled "close!". On a page too short for all of them, the oldest drop off
 * the bottom.
 */
function Tries({ misses, t }: { misses: OwnGuess[]; t: Translate }) {
  if (misses.length === 0) return null;
  return (
    // A column that wraps: a row that doesn't fit whole moves to a second column, off to the
    // right where the list clips it, so no try is ever cut in half.
    <ul className="mt-1 flex min-h-0 flex-1 flex-col flex-wrap content-start overflow-hidden">
      {misses
        .map((m, i) => ({ ...m, i }))
        .reverse()
        .map((m) => (
          <li
            key={m.i}
            data-try={m.close ? 'close' : 'wrong'}
            className="flex h-[34px] w-full shrink-0 items-center gap-2.5 text-[22px] leading-none"
          >
            {m.close ? (
              <>
                <span className="min-w-0 truncate py-1">{m.text}</span>
                <span
                  aria-hidden
                  className="shrink-0 rounded-[50%] border-2 border-red px-2 py-0.5 text-base leading-none text-red"
                >
                  {t('closeNote')}
                </span>
              </>
            ) : (
              <>
                {/* The strike is decoration, so only the line tilts; the word stays level. */}
                <span className="relative min-w-0 truncate py-1 text-soft after:absolute after:inset-x-0 after:top-[52%] after:h-[2.5px] after:-rotate-[4deg] after:bg-red">
                  {m.text}
                </span>
                <span aria-hidden className="shrink-0 text-red">
                  ✗
                </span>
              </>
            )}
            <span className="sr-only">{t(m.close ? 'closeGuess' : 'wrongGuess')}</span>
          </li>
        ))}
    </ul>
  );
}

/**
 * After a correct guess: a big ✓ in the success colour, "Got it!" and the points on a red stamp,
 * never the word. Screen readers hear "✓ You got it! +270" in one piece.
 */
function GotIt({ points, t }: { points: number; t: Translate }) {
  return (
    <div
      role="status"
      data-gotit
      className="mx-auto mt-2 grid w-fit max-w-full shrink-0 justify-items-center gap-1 text-center motion-safe:animate-pop"
    >
      <span className="sr-only">{t('youGotIt', { points })}</span>
      <span aria-hidden className="text-[clamp(3.5rem,12dvh,5.625rem)] leading-none text-success">
        ✓
      </span>
      <span aria-hidden className="text-[44px] leading-none">
        {t('gotItHeading')}
      </span>
      <span aria-hidden>
        <Stamp value={`+${points}`} />
      </span>
    </div>
  );
}

/**
 * This turn's points, written in red pen in the left margin: "+270" in Nunito over "this turn".
 * Never "+0" (the caller leaves it out) and never a rank.
 */
function MarginPoints({ points, t }: { points: number; t: Translate }) {
  const around = copyAround((marker) => t('turnPoints', { points: marker }));
  return (
    <p
      data-margin-points
      className="absolute bottom-[26px] left-0 w-[46px] text-center leading-tight text-red"
    >
      <span className="sr-only">{t('turnPoints', { points })}</span>
      <span aria-hidden className="block font-num text-sm font-black tabular-nums">
        {around ? `${around[0]}${points}` : `+${points}`}
      </span>
      {around && (
        <span aria-hidden className="block text-[13px] break-words">
          {around[1].trim()}
        </span>
      )}
    </p>
  );
}

/** The send button's pen arrow (the mockup's `icon.send`). */
function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-6 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.4]"
    >
      <path d="M3 12 L20 12 M13 5 L20 12 L13 19" />
    </svg>
  );
}

/** "6 letters to guess", plus the hint letters once there are any: `role="img"` hides the text. */
function blanksLabel(mask: readonly string[], t: Translate): string {
  const label = t('lettersLabel', { n: mask.filter((c) => c === '_').length });
  const hints = hintLetters(mask);
  return hints.length ? t('hintsLabel', { label, letters: hints.join(', ') }) : label;
}

/**
 * The reactions that replace the guess box once a guesser has the word: emoji only, no free text,
 * so nobody can hint it. The server takes one a second; the row rests for that long after a tap.
 */
export function ReactionRow({ onReact, t }: { onReact: (emoji: Reaction) => void; t: Translate }) {
  // The one just sent, lit while the row rests, so the guesser sees it went.
  const [sent, setSent] = useState<Reaction | null>(null);
  const resting = sent !== null;
  useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => setSent(null), REACTION_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [sent]);
  return (
    <div className="mt-3 flex shrink-0 flex-col items-center gap-2">
      {/* The group's name, written; screen readers get it from the group. */}
      <p aria-hidden className="text-lg leading-tight text-soft">
        {t('reactions')}
      </p>
      <div
        role="group"
        aria-label={t('reactions')}
        className="grid grid-cols-3 justify-items-center gap-x-3 gap-y-2.5"
      >
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={t('sendReaction', { emoji })}
            aria-disabled={resting}
            onClick={() => {
              if (resting) return;
              setSent(emoji);
              onReact(emoji);
            }}
            className={`wobbly grid size-14 place-items-center border-[2.5px] border-ink text-[28px] leading-none shadow-[2px_3px_0_var(--color-ink)] transition-opacity active:translate-x-px active:translate-y-0.5 active:shadow-none ${
              sent === emoji ? 'bg-hl' : `bg-paper ${resting ? 'opacity-50' : ''}`
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
