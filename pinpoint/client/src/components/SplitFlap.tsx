import { useEffect, useState } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery.js';

/** The glyphs a cell cycles through before it settles (spec "Look and tokens", Motion). */
export const FLAP_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·-';
export const FLAP_STEP_MS = 70;
export const FLAP_STAGGER_MS = 25;
export const FLAP_SETTLE_MS = 1600;
const MIN_GLYPHS = 6;
const MAX_GLYPHS = 14;

/** A random glyph from the set, other than `not` (so each step visibly flips). */
function randomGlyph(not: string): string {
  const pool = FLAP_GLYPHS.replace(not, '');
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * One cell: from `index × 25 ms` it cycles 6–14 random glyphs at 70 ms each (6 when `quick`), then
 * settles on `ch`, all within 1.6 s. A character outside the set holds and flips straight to itself
 * at its settle time. Only a cell whose character changed flips again.
 */
function FlapCell({
  ch,
  index,
  quick,
  reduced,
  className,
}: {
  ch: string;
  index: number;
  quick: boolean;
  reduced: boolean;
  className: string;
}) {
  // Blank until the first flip, then the glyph on show.
  const [shown, setShown] = useState(' ');
  useEffect(() => {
    if (reduced) return;
    const target = ch.toUpperCase();
    // Long rows start their last cells sooner, so even the shortest cycle lands by 1.6 s.
    const start = Math.min(index * FLAP_STAGGER_MS, FLAP_SETTLE_MS - MIN_GLYPHS * FLAP_STEP_MS);
    const most = Math.min(MAX_GLYPHS, Math.floor((FLAP_SETTLE_MS - start) / FLAP_STEP_MS));
    const count = quick
      ? MIN_GLYPHS
      : MIN_GLYPHS + Math.floor(Math.random() * (most - MIN_GLYPHS + 1));
    const inSet = FLAP_GLYPHS.includes(target);
    const timers = [setTimeout(() => setShown(ch), start + count * FLAP_STEP_MS)];
    if (inSet)
      for (let k = 0; k < count; k++)
        timers.push(setTimeout(() => setShown(randomGlyph(target)), start + k * FLAP_STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [ch, index, quick, reduced]);
  return (
    <span
      aria-hidden="true"
      className={`relative flex items-center justify-center bg-flap-bg leading-none ${className}`}
    >
      {reduced ? ch : shown}
      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-flap-seam" />
    </span>
  );
}

const TONE = { amber: 'text-amber', text: 'text-text', delayed: 'text-delayed' };

/**
 * A row of split-flap cells (DESIGN.md "SplitFlap"). `cellClass` sets the cell size, radius and
 * glyph size; spaces become blank cells. Reduced motion shows the text with a 150 ms fade.
 */
export function SplitFlap({
  text,
  cellClass,
  tone = 'amber',
  label,
  gap = 'gap-1.5',
  quick = false,
}: {
  text: string;
  cellClass: string;
  tone?: keyof typeof TONE;
  /** Read by screen readers instead of the letter-by-letter cells. */
  label?: string;
  /** The gap between cells: 6 px (DESIGN.md's prompt flaps) unless the cells are small. */
  gap?: string;
  /** The shortest cycle, for a 3-2-1 whose digits change each second. */
  quick?: boolean;
}) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <span
      role="img"
      aria-label={label ?? text}
      // Reduced motion: a new text remounts the row, replaying the fade.
      key={reduced ? text : undefined}
      className={`board-face flex ${gap} ${TONE[tone]} ${reduced ? 'flap-fade' : ''}`}
    >
      {[...text].map((ch, i) => (
        <FlapCell key={i} ch={ch} index={i} quick={quick} reduced={reduced} className={cellClass} />
      ))}
    </span>
  );
}
