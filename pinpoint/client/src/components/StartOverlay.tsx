/**
 * The Screen's first-load overlay (spec "Creating and joining a room" step 2). Browsers only start
 * audio, fullscreen and a wake lock from a user gesture, so one click (or Enter/Space) does all three.
 * It sits inside the Screen's 1920 × 1080 stage, so its sizes are design pixels.
 */
export function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Click to start"
      className="absolute inset-0 z-50"
    >
      <button
        type="button"
        autoFocus
        onClick={onStart}
        className="flex size-full flex-col items-center justify-center gap-6 bg-board-bg/85 px-4 text-center"
      >
        <span className="board-face text-[160px] text-amber">Click to start</span>
        <span className="text-[40px] text-text-dim">
          Turns on sound, fullscreen and keeps this screen awake
        </span>
      </button>
    </div>
  );
}
