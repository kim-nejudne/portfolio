import { APP_NAME } from '../../../shared/constants.js';
import { displayUrl } from '../lib/joinUrl.js';
import { PILL } from '../lib/ui.js';
import { BulbRail } from './BulbRail.js';

/** Bulbs on each Screen rail, and their size and padding: 12px bulbs and 14px padding at 1280 wide. */
const SCREEN_BULBS = 40;
const SCREEN_RAIL = 'px-[3.75vw] py-[min(1.1vw,1.94vh)] [--bulb:min(0.94vw,1.67vh)]';

/** The marquee rail along the top and bottom edge of every Screen state. */
export function ScreenRail() {
  return <BulbRail count={SCREEN_BULBS} size={SCREEN_RAIL} />;
}

interface ScreenHeaderProps {
  code: string;
  questionIndex: number;
  questionCount: number;
  /** "Question 3 / 10" in the centre pill; off in the lobby and on the Final screen. */
  numbered: boolean;
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
  gameNumber,
  url,
}: ScreenHeaderProps) {
  const pill = `${PILL} px-[1.6vw] py-[min(0.5vw,0.9vh)] font-display text-[min(1.56vw,2.8vh)] whitespace-nowrap tabular-nums`;
  return (
    <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-[2vw] px-[3.75vw] py-[min(1.72vw,3vh)]">
      <p className="font-display text-[min(3.125vw,5.6vh)] leading-none text-accent">{APP_NAME}</p>
      {numbered ? (
        <p className={pill}>
          Question {questionIndex + 1} / {questionCount}
        </p>
      ) : gameNumber !== undefined && gameNumber >= 2 ? (
        <p className={pill}>Game {gameNumber}</p>
      ) : (
        <span />
      )}
      {url !== undefined ? (
        <div
          role="group"
          aria-label="How to join"
          className="min-w-0 justify-self-end text-right text-[min(1.4vw,2.5vh)] leading-snug text-muted"
        >
          <p className="break-all">
            Join at <span className="font-bold text-ink">{displayUrl(url)}</span>
          </p>
          <p>
            Room <span className="font-display tracking-[0.1em] text-accent">{code}</span>
          </p>
        </div>
      ) : (
        <span />
      )}
    </header>
  );
}
