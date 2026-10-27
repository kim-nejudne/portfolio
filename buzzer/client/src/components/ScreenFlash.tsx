import { useRecentFx } from '../lib/useRecentFx.js';

/**
 * The whole Screen flashes green on a correct answer and red on a wrong one (UI spec, Screen view:
 * Judged). With reduced motion it is a faint tint that does not fade, removed with the event.
 */
export function ScreenFlash() {
  const recent = useRecentFx();
  if (!recent || (recent.fx.kind !== 'correct' && recent.fx.kind !== 'wrong')) return null;
  const color = recent.fx.kind === 'correct' ? 'bg-win' : 'bg-buzz';
  return (
    <div
      key={recent.seq}
      aria-hidden
      data-flash={recent.fx.kind}
      className={`pointer-events-none absolute inset-0 ${color} motion-safe:animate-flash motion-reduce:opacity-20`}
    />
  );
}
