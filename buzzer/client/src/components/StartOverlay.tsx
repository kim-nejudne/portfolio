/**
 * The Screen's first-load overlay (UI spec, Screen view). Browsers only start audio and
 * fullscreen from a user gesture, so one click (or Enter/Space) does both.
 */
export function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Click to start"
      className="fixed inset-0 z-50"
      // Keys pressed here start the Screen; they must not also reach the host shortcuts behind it.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        autoFocus
        onClick={onStart}
        className="flex size-full flex-col items-center justify-center gap-[3vh] bg-bg/90 px-4 text-center backdrop-blur-sm"
      >
        <span className="font-display text-[clamp(3rem,8vw,16vh)] leading-none text-accent">
          Click to start
        </span>
        <span className="text-[clamp(1rem,2.2vw,4.4vh)] text-muted">
          Turns on sound and fullscreen
        </span>
      </button>
    </div>
  );
}
