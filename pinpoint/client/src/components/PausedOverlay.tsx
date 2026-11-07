import type { PausedView } from '#shared/types.js';
import { useServerNow } from '../lib/useServerNow.js';
import { SplitFlap } from './SplitFlap.js';

/** The resume 3-2-1 from `resumeAt` on the server clock, held at 1 until `resumeGo` lands. */
export function resumeCount(resumeAt: number, now: number): number {
  return Math.min(3, Math.max(1, Math.ceil((resumeAt - now) / 1000)));
}

/**
 * The paused overlay (DESIGN.md "Overlay"): `--board-bg` at 85% over its positioned parent, with
 * `message` while paused and the 3-2-1 in 200 px flaps once the last reason has cleared. Above
 * Leaflet's panes and controls (z 400–1000).
 */
export function PausedOverlay({
  paused,
  message,
  cellClass,
}: {
  paused: PausedView;
  message: string | null;
  cellClass: string;
}) {
  const now = useServerNow();
  if (paused.resumeAt === null && message === null) return null;
  return (
    <div
      role="status"
      className="absolute inset-0 z-[1100] flex flex-col items-center justify-center bg-board-bg/85 px-4 text-center"
    >
      {paused.resumeAt === null ? (
        <p className="board-face text-2xl text-delayed">{message}</p>
      ) : (
        <SplitFlap
          text={String(resumeCount(paused.resumeAt, now))}
          cellClass={cellClass}
          label={`Resuming in ${resumeCount(paused.resumeAt, now)}`}
        />
      )}
    </div>
  );
}
