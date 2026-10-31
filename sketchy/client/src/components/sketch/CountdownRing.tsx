import { CHOOSE_MS, LAST_SECONDS_MS } from '../../../../shared/constants.js';

/**
 * What the ring shows: the fraction of time left, whether it is in its red last seconds, and the
 * seconds left rounded up. While choosing the total is the 12 s choice and the ring never turns
 * red (10 of its 12 s would be red otherwise).
 */
// SPEC-QUESTION: "red at ≤ 10 s, except while choosing, where the total is 12 s" read as: no red
// while choosing; see DECISIONS (F56).
export function ringState(
  remainingMs: number,
  totalMs: number,
  choosing: boolean,
): { fraction: number; low: boolean; seconds: number } {
  const total = choosing ? CHOOSE_MS : totalMs;
  const left = Math.max(0, remainingMs);
  const fraction = total > 0 ? Math.min(1, left / total) : 0;
  return {
    fraction,
    low: !choosing && left <= LAST_SECONDS_MS,
    seconds: Math.ceil(left / 1000),
  };
}

/**
 * The countdown ring (Sketchbook primitives): a `dot` track, a `pen` arc for the time left (`red`
 * in a turn's last 10 s) and the seconds in Nunito 900 in the middle, `size` across.
 */
export function CountdownRing({
  remainingMs,
  totalMs,
  choosing = false,
  size,
}: {
  remainingMs: number;
  totalMs: number;
  choosing?: boolean;
  size: string;
}) {
  const { fraction, low, seconds } = ringState(remainingMs, totalMs, choosing);
  const value = Math.round(fraction * 1000) / 10;
  return (
    <span
      data-low={low}
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" aria-hidden className="absolute inset-0 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r="16"
          pathLength={100}
          fill="none"
          strokeWidth={3.5}
          className="stroke-dot"
        />
        <circle
          cx="20"
          cy="20"
          r="16"
          pathLength={100}
          fill="none"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={`${value} 100`}
          className={`${low ? 'stroke-red' : 'stroke-pen'} motion-safe:transition-[stroke-dasharray] motion-safe:duration-1000 motion-safe:ease-linear`}
        />
      </svg>
      <span
        className={`relative font-num leading-none font-black tabular-nums ${low ? 'text-red' : 'text-ink'}`}
        style={{ fontSize: `calc(${size} * 0.36)` }}
      >
        {seconds}
      </span>
    </span>
  );
}
