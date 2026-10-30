import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { GUESS_MAX } from '../../../../shared/constants.js';
import type { Ack, PlayerView } from '../../../../shared/types.js';
import type { CopyKey, Translate } from '../../lib/copy.js';
import { GUESS_NOTICE_MS, guessAnswer, type OwnGuess } from '../../lib/phone.js';
import { formatClock, wordLengths } from '../../lib/screen.js';
import { useCountdown } from '../../lib/useCountdown.js';

interface Props {
  view: PlayerView;
  receivedAt: number;
  /** This phone's own answered guesses this turn, newest last ("payong ✗", "tsinelas ko ≈"). */
  misses: OwnGuess[];
  /** Counts this phone's near misses; each new one shows "So close!" under the box. */
  nearMiss: number;
  /** Sends the guess; resolves with the server's answer, or `null` if it was lost. */
  onGuess: (text: string) => Promise<Ack | null>;
  t: Translate;
}

/**
 * A guesser's phone in CHOOSING and DRAWING (UI by role and phase, Guesser phone): the clock and
 * who is drawing, the blanks, the guess box near the top (so the keyboard never covers it) and,
 * after a correct guess, "✓ You got it! +N" without the word. No drawing here, on purpose.
 */
export function GuesserTurn({ view, receivedAt, misses, nearMiss, onGuess, t }: Props) {
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const guess = text.trim();
    if (guess)
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
    setText('');
    // Keep the keyboard up for the next guess.
    inputRef.current?.focus();
  };

  const mask = turn.mask ?? [];
  const lengths = wordLengths(mask);

  return (
    <div className="flex h-full flex-col gap-3 px-4 pt-3">
      <p className="flex items-center justify-between gap-3 text-lg">
        <span className={`tabular-nums ${left <= 10_000 ? 'text-[#FF8F5E]' : ''}`}>
          ◔ {formatClock(left)}
        </span>
        <span className="min-w-0 truncate">
          {drawing
            ? t('isDrawingShort', { name: turn.drawerName })
            : t('isChoosing', { name: turn.drawerName })}
        </span>
      </p>

      {drawing && (
        <p
          role="img"
          aria-label={t('lettersLabel', { n: mask.filter((c) => c === '_').length })}
          className="font-mono text-2xl leading-tight font-bold tracking-[0.25em] break-words"
        >
          {mask.join('')}{' '}
          {lengths.length > 1 && (
            <span className="text-base font-normal tracking-normal text-white/60">
              ({lengths.join(', ')})
            </span>
          )}
        </p>
      )}

      {drawing && guessed && (
        <p
          role="status"
          className="rounded-2xl bg-[#2DC653] px-4 py-4 text-2xl font-bold text-[#1D1B22]"
        >
          {t('youGotIt', { points: view.me.turnPoints })}
        </p>
      )}

      {drawing && !guessed && (
        // The note lives with the box, so it takes no room (and no gap) while empty; it only
        // nudges the misses below down while it shows.
        <div className="flex flex-col">
          <form onSubmit={submit} className="flex gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={GUESS_MAX}
              placeholder={t('guessPlaceholder')}
              aria-label={t('guessPlaceholder')}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="send"
              className="min-h-12 w-full min-w-0 rounded-xl bg-white px-4 text-xl text-[#1D1B22] placeholder:text-[#1D1B22]/65"
            />
            <button
              type="submit"
              aria-label={t('send')}
              // Tapping send must not take focus from the box, or the keyboard drops.
              onMouseDown={(e) => e.preventDefault()}
              className="min-h-12 min-w-12 shrink-0 rounded-xl bg-[#FF6B35] px-4 text-xl font-bold text-[#1D1B22]"
            >
              ➤
            </button>
          </form>
          <p role="status" aria-live="polite" className="text-lg font-bold text-[#FFD166]">
            {notice ? <span className="mt-2 block">{t(notice.key)}</span> : null}
          </p>
        </div>
      )}

      {drawing && misses.length > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-white/70">
          {misses.map((m, i) => (
            <span key={i} className={`max-w-full truncate ${m.close ? 'text-[#FFD166]' : ''}`}>
              {m.text} <span aria-hidden>{m.close ? '≈' : '✗'}</span>
              <span className="sr-only">{t(m.close ? 'closeGuess' : 'wrongGuess')}</span>
            </span>
          ))}
        </p>
      )}

      <p className="mt-auto pb-2 text-center text-lg text-white/80">{t('watchScreen')}</p>
      <p className="pb-3 text-center text-white/70">
        {t('turnPoints', { points: view.me.turnPoints })}
      </p>
    </div>
  );
}
