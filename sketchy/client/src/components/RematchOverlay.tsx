import { REMATCH_COUNTDOWN_MS } from '../../../shared/constants.js';
import type { View } from '../../../shared/types.js';
import type { Translate } from '../lib/copy.js';
import { countdownDigit } from '../lib/pause.js';
import { useCountdown } from '../lib/useCountdown.js';

interface Props {
  view: View;
  /** `performance.now()` when `view` arrived, for the local 3-2-1. */
  receivedAt: number;
  /** The Screen keeps the final scores visible and usable under it; the phone covers its view. */
  variant: 'screen' | 'phone';
  t: Translate;
}

/**
 * The rematch countdown (UI by role and phase, Final): "Game 2 starts in" and a big 3-2-1, with
 * "Jun draws first" under it, on the Screen and every phone. The host's bar (Screen) and Host
 * button (phone) sit above it, so Cancel stays in reach.
 */
export function RematchOverlay({ view, receivedAt, variant, t }: Props) {
  const left = useCountdown(
    { remainingMs: view.rematchInMs ?? 0, totalMs: REMATCH_COUNTDOWN_MS, running: true },
    receivedAt,
  );
  const first = view.rematchFirst;
  const screen = variant === 'screen';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute inset-0 grid place-items-center p-6 text-center [text-shadow:0_0_2vmin_#1D1B22] ${
        screen ? 'pointer-events-none z-10 bg-[#1D1B22]/95' : 'z-20 bg-[#1D1B22]/95'
      }`}
    >
      <div className="flex flex-col items-center gap-[1vmin]">
        <p className={`font-bold ${screen ? 'text-[max(6vmin,28px)]' : 'text-2xl'}`}>
          {t('gameStartsIn', { n: view.gameNumber + 1 })}
          {/* The seconds as the countdown came in, read once with the line. */}
          <span className="sr-only">
            {' '}
            {t('inSeconds', { n: countdownDigit(view.rematchInMs ?? 0) })}
          </span>
        </p>
        {/* Read out once with the line above; a digit a second would be noise. */}
        <p
          aria-hidden="true"
          className={`font-display leading-none font-bold text-[#FFD166] ${
            screen ? 'text-[max(30vmin,120px)]' : 'text-[min(8rem,28dvh)]'
          }`}
        >
          {countdownDigit(left)}
        </p>
        {first && (
          <p className={screen ? 'text-[max(4.5vmin,22px)]' : 'text-xl'}>
            <span className="font-bold" style={{ color: first.color }}>
              {t('drawsFirst', { name: first.name })}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
