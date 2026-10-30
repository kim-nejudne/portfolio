import { useRef, useState, type FormEvent } from 'react';
import { GUESS_MAX } from '../../../../shared/constants.js';
import type { PlayerView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { formatClock, wordLengths } from '../../lib/screen.js';
import { useCountdown } from '../../lib/useCountdown.js';

interface Props {
  view: PlayerView;
  receivedAt: number;
  /** This phone's own wrong guesses this turn, newest last (shown "payong ✗"). */
  misses: string[];
  onGuess: (text: string) => void;
  t: Translate;
}

/**
 * A guesser's phone in CHOOSING and DRAWING (UI by role and phase, Guesser phone): the clock and
 * who is drawing, the blanks, the guess box near the top (so the keyboard never covers it) and,
 * after a correct guess, "✓ You got it! +N" without the word. No drawing here, on purpose.
 */
export function GuesserTurn({ view, receivedAt, misses, onGuess, t }: Props) {
  const turn = view.turn!;
  const left = useCountdown(turn.timer, receivedAt);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const me = view.players.find((p) => p.pid === view.me.pid);
  const guessed = me?.guessed ?? false;
  const drawing = view.phase === 'DRAWING';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const guess = text.trim();
    if (guess) onGuess(guess);
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
      )}

      {drawing && misses.length > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-white/70">
          {misses.map((m, i) => (
            <span key={i} className="max-w-full truncate">
              {m} ✗
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
