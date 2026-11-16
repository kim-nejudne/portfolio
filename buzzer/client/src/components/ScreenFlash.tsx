import { useRecentFx } from '../lib/useRecentFx.js';

/** The flash's length, as `--animate-flash` in index.css sets it. */
export const FLASH_MS = 900;

/**
 * The whole Screen flashes the teal pass (win) on a correct answer, and the buzz red on a wrong one or when the answer
 * or buzz time runs out (UI spec, Screen view: Judged, Buzzed; DECISIONS, F64). With reduced
 * motion there is no flash: the banner, the answer and the sound carry the judgement (F137).
 */
export function ScreenFlash() {
  const recent = useRecentFx();
  if (!recent) return null;
  const { kind } = recent.fx;
  if (kind !== 'correct' && kind !== 'wrong' && kind !== 'timeUp' && kind !== 'buzzTimeUp') {
    return null;
  }
  // The teal multiplies, so ink stays ink under it and "+100" reads through the flash (F154).
  const color = kind === 'correct' ? 'bg-win mix-blend-multiply' : 'bg-buzz';
  return (
    <div
      key={recent.seq}
      aria-hidden
      data-flash={kind}
      className={`pointer-events-none absolute inset-0 ${color} motion-safe:animate-flash motion-reduce:hidden`}
    />
  );
}
