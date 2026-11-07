import { useServerNow } from '../lib/useServerNow.js';
import { SplitFlap } from './SplitFlap.js';

/** A 3-2-1 to `resumeAt` on the server clock, held at 1 until its timer lands. */
export function resumeCount(resumeAt: number, now: number): number {
  return Math.min(3, Math.max(1, Math.ceil((resumeAt - now) / 1000)));
}

/**
 * The paused overlay (DESIGN.md "Overlay"): `--board-bg` at 85% over its positioned parent, with
 * `message` while paused and the 3-2-1 to `countdownAt` in 200 px flaps (the resume's, once the
 * last reason has cleared, or the rematch's). Above Leaflet's panes and controls (z 400–1000).
 */
export function PausedOverlay({
  countdownAt,
  message,
  label = 'Resuming in',
  cellClass,
}: {
  countdownAt: number | null;
  message: string | null;
  /** Announced before the count: "Resuming in 3". */
  label?: string;
  cellClass: string;
}) {
  const now = useServerNow();
  if (countdownAt === null && message === null) return null;
  return (
    <div
      role="status"
      className="absolute inset-0 z-[1100] flex flex-col items-center justify-center bg-board-bg/85 px-4 text-center"
    >
      {countdownAt === null ? (
        <p className="board-face text-2xl text-delayed">{message}</p>
      ) : (
        <SplitFlap
          text={String(resumeCount(countdownAt, now))}
          cellClass={cellClass}
          label={`${label} ${resumeCount(countdownAt, now)}`}
        />
      )}
    </div>
  );
}
