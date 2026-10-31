import { RESUME_COUNTDOWN_MS } from '../../../shared/constants.js';
import type { View } from '../../../shared/types.js';
import type { Translate } from '../lib/copy.js';
import { countdownDigit, pauseLine } from '../lib/pause.js';
import { useCountdown } from '../lib/useCountdown.js';

interface Props {
  view: View;
  /** `performance.now()` when `view` arrived, for the local 3-2-1. */
  receivedAt: number;
  /** The Screen dims the drawing and keeps it visible; the phone covers its view. */
  variant: 'screen' | 'phone';
  t: Translate;
}

/**
 * "Paused" and why, then a big 3-2-1 once nothing holds the game (Pausing). The host's bar (Screen)
 * and Host top bar (phone) sit above it, so Resume stays in reach. On the Screen it lets the
 * pointer through; on the phone it blocks the guess box and pad under it.
 */
export function PausedOverlay({ view, receivedAt, variant, t }: Props) {
  const paused = view.paused!;
  const countdown = paused.resumeInMs;
  const left = useCountdown(
    countdown === null
      ? null
      : { remainingMs: countdown, totalMs: RESUME_COUNTDOWN_MS, running: true },
    receivedAt,
  );
  const line = pauseLine(paused, view.turn?.drawerName ?? null, t);
  const screen = variant === 'screen';
  return (
    <div
      role="status"
      aria-live="polite"
      // A paper veil, never dark (Sketchbook Results: overlays); the Screen's lets the drawing show.
      className={`absolute inset-0 grid place-items-center p-6 text-center font-hand text-ink ${
        screen ? 'pointer-events-none z-10 bg-paper/80' : 'z-20 bg-paper/95'
      }`}
    >
      {countdown === null ? (
        <div className="flex flex-col items-center gap-[2vmin]">
          <p className={screen ? 'text-[max(10vmin,40px)]' : 'text-[44px] leading-tight'}>
            {t('paused')}
          </p>
          {line && (
            <p className={`text-soft ${screen ? 'text-[max(4.5vmin,22px)]' : 'text-2xl'}`}>
              {line}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-[1vmin]">
          <p className={screen ? 'text-[max(4.5vmin,22px)]' : 'text-2xl'}>{t('resuming')}</p>
          {/* Read out once as "Back in"; a digit a second would be noise. */}
          <p
            aria-hidden="true"
            className={`font-num leading-none font-black text-pen tabular-nums ${
              screen ? 'text-[max(30vmin,120px)]' : 'text-[min(8rem,28dvh)]'
            }`}
          >
            {countdownDigit(left)}
          </p>
        </div>
      )}
    </div>
  );
}
