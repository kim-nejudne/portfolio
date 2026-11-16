import { APP_NAME } from '../../../shared/constants.js';
import { useCopy } from '../lib/copy.js';
import { displayUrl } from '../lib/joinUrl.js';
import { PILL } from '../lib/ui.js';

interface ScreenHeaderProps {
  code: string;
  questionIndex: number;
  questionCount: number;
  /** "Question 3 / 10" in the centre pill; off in the lobby and on the Final screen. */
  numbered: boolean;
  /** On a board set, "Animals · 200" in place of the question number (F90). */
  tileLabel?: string;
  /** From game 2, "Game 2" in the centre pill whenever it shows no question number (F77). */
  gameNumber?: number;
  /** The join URL, for the "Join at" and room lines. The set editor's preview has none. */
  url?: string;
}

/**
 * The Screen's header row: the logo, the question number, and how to join. It is always on
 * screen, so late joiners can get in (UI spec, Screen view).
 */
export function ScreenHeader({
  code,
  questionIndex,
  questionCount,
  numbered,
  tileLabel,
  gameNumber,
  url,
}: ScreenHeaderProps) {
  const t = useCopy();
  // Every size has a floor for small displays (F100); the editor's preview turns the floors off.
  const pill = `${PILL} px-[min(1.6cqw,2.85cqh)] py-[min(0.5cqw,0.9cqh)] font-display font-extrabold text-[max(var(--screen-min-label),min(1.56cqw,2.8cqh))] whitespace-nowrap tabular-nums`;
  return (
    <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-[min(2cqw,3.56cqh)] px-[min(3.75cqw,6.67cqh)] py-[min(1.72cqw,3cqh)]">
      <p className="font-display text-[max(var(--screen-min-body),min(3.125cqw,5.6cqh))] leading-none font-extrabold text-ink">
        {APP_NAME}
      </p>
      {numbered && tileLabel ? (
        <p className={pill}>{tileLabel}</p>
      ) : numbered ? (
        <p className={pill}>{t('questionSlash', { n: questionIndex + 1, count: questionCount })}</p>
      ) : gameNumber !== undefined && gameNumber >= 2 ? (
        <p className={pill}>{t('gameNumber', { n: gameNumber })}</p>
      ) : (
        <span />
      )}
      {url !== undefined ? (
        <div
          role="group"
          aria-label="How to join"
          className="min-w-0 justify-self-end text-right text-[max(var(--screen-min-label),min(1.4cqw,2.5cqh))] leading-snug text-muted"
        >
          <p className="break-all">
            {t('joinAt')} <span className="font-bold text-ink">{displayUrl(url)}</span>
          </p>
          <p>
            {t('roomLabel')}{' '}
            <span className="font-display font-extrabold tracking-[0.1em] text-ink tabular-nums">
              {code}
            </span>
          </p>
        </div>
      ) : (
        <span />
      )}
    </header>
  );
}
