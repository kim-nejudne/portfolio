import { useRecentFx } from '../lib/useRecentFx.js';

/**
 * The whole Screen flashes green on a correct answer, and red on a wrong one or when the answer
 * time runs out (UI spec, Screen view: Judged, Buzzed). With reduced motion it is a faint tint that
 * does not fade, removed with the event.
 */
export function ScreenFlash() {
  const recent = useRecentFx();
  if (!recent) return null;
  const { kind } = recent.fx;
  if (kind !== 'correct' && kind !== 'wrong' && kind !== 'timeUp') return null;
  const color = kind === 'correct' ? 'bg-win' : 'bg-buzz';
  return (
    <div
      key={recent.seq}
      aria-hidden
      data-flash={kind}
      className={`pointer-events-none absolute inset-0 ${color} motion-safe:animate-flash motion-reduce:opacity-20`}
    />
  );
}
