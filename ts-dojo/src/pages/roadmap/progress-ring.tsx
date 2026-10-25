// A module card's progress ring (§6 Roadmap: "States: not started (muted), in progress (accent
// ring), complete (filled)"): the fraction of lessons complete as an arc on a muted track; a
// complete module is a filled disc with a check. Decorative: the card's text says the same.
import type { LessonState } from '@/store/db';

const R = 15;

export function ProgressRing({
  progress,
  state,
}: {
  /** 0 to 1. */
  progress: number;
  state: LessonState;
}) {
  const percent = Math.round(progress * 100);
  return (
    <svg
      viewBox="0 0 36 36"
      className="size-9 shrink-0"
      aria-hidden="true"
      data-ring=""
      data-progress={progress}
      data-state={state}
    >
      {state === 'complete' ? (
        <>
          <circle cx="18" cy="18" r={R + 2} className="fill-(--progress)" />
          <path
            d="M11.5 18.5l4.5 4.5 8.5-9"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-background"
          />
        </>
      ) : (
        <>
          <circle
            cx="18"
            cy="18"
            r={R}
            fill="none"
            strokeWidth="4"
            className="stroke-(--progress-track)"
          />
          {state === 'in-progress' && (
            <circle
              cx="18"
              cy="18"
              r={R}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              pathLength={100}
              // A sliver even at 0 lessons complete, so "in progress" always shows the accent.
              strokeDasharray={`${String(Math.max(percent, 4))} 100`}
              transform="rotate(-90 18 18)"
              className="stroke-(--progress)"
            />
          )}
        </>
      )}
    </svg>
  );
}
