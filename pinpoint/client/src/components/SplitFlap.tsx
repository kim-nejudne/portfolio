/**
 * A row of split-flap cells (DESIGN.md "SplitFlap"). Static for now: the flip animation is the
 * split-flap feature's (F53). `cellClass` sets the cell size and glyph size; spaces become blank cells.
 */
export function SplitFlap({
  text,
  cellClass,
  tone = 'amber',
  label,
}: {
  text: string;
  cellClass: string;
  tone?: 'amber' | 'text';
  /** Read by screen readers instead of the letter-by-letter cells. */
  label?: string;
}) {
  return (
    <span role="img" aria-label={label ?? text} className="board-face flex gap-[0.08em]">
      {[...text].map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`relative flex items-center justify-center leading-none bg-flap-bg ${tone === 'amber' ? 'text-amber' : 'text-text'} ${cellClass}`}
        >
          {ch}
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-flap-seam" />
        </span>
      ))}
    </span>
  );
}
