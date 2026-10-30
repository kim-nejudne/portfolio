import type { Translate } from '../../lib/copy.js';

/**
 * The Screen's first overlay (Creating and joining a room, step 2). Ported from Buzzr
 * (buzzer/client/src/components/StartOverlay.tsx). Browsers only start audio, fullscreen and
 * (on some) a wake lock from a user gesture, so one tap, click, Enter or Space does them all.
 * The Screen joins and renders underneath meanwhile.
 */
export function StartOverlay({
  coarse,
  onStart,
  t,
}: {
  /** A tablet or phone used as the Screen taps; a laptop on a TV clicks. */
  coarse: boolean;
  onStart: () => void;
  t: Translate;
}) {
  const label = t(coarse ? 'tapToStart' : 'clickToStart');
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50"
      // Keys pressed here start the Screen; they must not also reach the host shortcuts behind it,
      // and Tab stays on the one button (the Screen behind waits for the tap).
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Tab') e.preventDefault();
      }}
    >
      <button
        type="button"
        autoFocus
        onClick={onStart}
        className="flex size-full flex-col items-center justify-center gap-[3vmin] bg-[#1D1B22]/95 px-[5vmin] text-center text-white"
      >
        <span className="font-display text-[max(10vmin,40px)] leading-none font-bold text-[#FF6B35]">
          {label}
        </span>
        <span className="text-[max(3.5vmin,18px)] text-white/70">{t('startHint')}</span>
      </button>
    </div>
  );
}
