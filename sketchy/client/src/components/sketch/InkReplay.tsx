import { DRAW_COLORS } from '../../../../shared/constants.js';

/** Stroke widths on the 1000-unit grid (the mockup's S, M, L). */
const WIDTHS = [9, 18, 34] as const;

/** The mockup's umbrella (`docs/design/sketchbook.html`): [draw colour, width, path]. */
const UMBRELLA: readonly (readonly [number, 0 | 1 | 2, string])[] = [
  [1, 1, 'M150 520 Q170 230 500 200 Q830 230 850 520'],
  [
    1,
    1,
    'M150 520 Q220 470 290 520 Q360 470 430 520 Q500 470 570 520 Q640 470 710 520 Q780 470 850 520',
  ],
  [1, 0, 'M500 200 L500 520 M500 200 Q370 300 290 520 M500 200 Q630 300 710 520'],
  [0, 0, 'M500 200 L500 150'],
  [7, 2, 'M500 520 L500 800 Q500 875 440 875 Q385 875 385 815'],
  [
    5,
    1,
    'M245 640 L228 692 M735 615 L718 667 M650 760 L633 812 M300 790 L283 842 M820 770 L803 822',
  ],
];

/** Seconds between one stroke starting and the next. */
const STAGGER_S = 0.55;

/**
 * The laptop landing's decoration (Sketchbook surfaces: Landing): a drawing in the game's own
 * colours that draws itself on, stroke after stroke, once. Hidden from screen readers; under
 * reduced motion it is the finished drawing, still. Fills its box, so give the box a size.
 */
export function InkReplay({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      data-ink-replay
      viewBox="0 0 1000 1000"
      className={`block ${className}`.trim()}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {UMBRELLA.map(([color, width, d], i) => (
        <path
          key={i}
          d={d}
          stroke={DRAW_COLORS[color]}
          strokeWidth={WIDTHS[width]}
          pathLength={1}
          className="motion-safe:animate-ink-draw motion-safe:[stroke-dasharray:1_2]"
          style={{ animationDelay: `${(i * STAGGER_S).toFixed(2)}s` }}
        />
      ))}
    </svg>
  );
}
