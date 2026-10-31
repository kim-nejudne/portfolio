import { wordLengths } from '../../lib/screen.js';

/** One cell of the blanks: a letter slot (hidden or a hint), a gap between words, or a hyphen. */
export type BlankCell =
  { kind: 'letter'; ch: string | null } | { kind: 'space' } | { kind: 'mark'; ch: string };

const LETTER = /[\p{L}\p{N}]/u;
/** Widths in em, to size the type so the row stays on one line. */
const GAP_EM = 0.2;
const CELL_EM: Record<BlankCell['kind'], number> = { letter: 1, space: 0.6, mark: 0.6 };
const COUNT_EM = 0.55;
/** Nunito's digits and punctuation are about this wide, in em of their own size. */
const COUNT_CHAR_EM = 0.62;

/** The cells of a mask (`_` hidden, a hint letter as itself, spaces and hyphens as themselves). */
export function blankCells(mask: readonly string[]): BlankCell[] {
  return mask.map((ch) => {
    if (ch === '_') return { kind: 'letter', ch: null };
    if (ch === ' ') return { kind: 'space' };
    if (LETTER.test(ch)) return { kind: 'letter', ch };
    return { kind: 'mark', ch };
  });
}

const countsLabel = (mask: readonly string[]) => `(${wordLengths(mask).join(', ')})`;

/** How wide the row is, in em of the blanks' type, counts included. */
export function blanksWidthEm(mask: readonly string[]): number {
  return round2(cellsWidthEm(mask) + COUNT_EM * COUNT_CHAR_EM * countsLabel(mask).length);
}

/** How wide the cells are, gaps included (everything but the counts), in em of the blanks' type. */
function cellsWidthEm(mask: readonly string[]): number {
  const cells = blankCells(mask);
  return cells.reduce((sum, c) => sum + CELL_EM[c.kind], 0) + cells.length * GAP_EM;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The row's type size: `size`, or smaller so the row fits its container on one line. With a
 * `countMin`, the counts never go below it and the cells give up the room they take.
 */
export function blanksFontSize(mask: readonly string[], size: string, countMin?: string): string {
  const fit = `calc(100cqw / ${blanksWidthEm(mask)})`;
  if (!countMin) return `min(${size}, ${fit})`;
  const countChars = round2(COUNT_CHAR_EM * countsLabel(mask).length);
  // The counts' 0.1 em margin is in the row's type, so it counts with the cells.
  const cellsFit = `calc((100cqw - ${countChars} * ${countMin}) / ${round2(cellsWidthEm(mask) + 0.1)})`;
  return `min(${size}, ${fit}, ${cellsFit})`;
}

/**
 * The word's blanks (Sketchbook primitives): Nunito 900 cells 1 em wide on a 0.14 em underline,
 * 0.6 em gaps between words and the letter counts `(5, 4)` after in `soft`. The type is `size` or
 * smaller, so the row stays on one line in its container. One image for screen readers, with the
 * caller's `label` ("6 letters to guess", plus any hint letters). With `pop` (the Screen), a hint
 * letter pops into its cell when it arrives; with `countMin` (the Screen), the counts stay at least
 * that size, so a long phrase on a narrow page still shows them legibly.
 */
export function Blanks({
  mask,
  label,
  size = '1em',
  pop = false,
  countMin,
  className = '',
}: {
  mask: readonly string[];
  label: string;
  size?: string;
  pop?: boolean;
  countMin?: string;
  className?: string;
}) {
  return (
    <div className={`@container w-full ${className}`}>
      <p
        role="img"
        aria-label={label}
        className="inline-flex items-end font-num leading-none font-black whitespace-nowrap"
        style={{
          gap: `${GAP_EM}em`,
          fontSize: blanksFontSize(mask, size, countMin),
        }}
      >
        {blankCells(mask).map((cell, i) =>
          cell.kind === 'letter' ? (
            <span
              key={i}
              data-blank="letter"
              className="h-[1.1em] w-[1em] border-b-[0.14em] border-current text-center"
            >
              {pop && cell.ch ? (
                // Keyed by the letter, so it mounts, and pops, when the hint comes in.
                <span key={cell.ch} className="inline-block motion-safe:animate-pop">
                  {cell.ch}
                </span>
              ) : (
                cell.ch
              )}
            </span>
          ) : (
            <span key={i} data-blank={cell.kind} className="w-[0.6em] text-center">
              {cell.kind === 'mark' ? cell.ch : null}
            </span>
          ),
        )}
        <span
          className="ml-[0.1em] self-center font-extrabold text-soft"
          style={{ fontSize: countMin ? `max(0.55em, ${countMin})` : '0.55em' }}
        >
          {countsLabel(mask)}
        </span>
      </p>
    </div>
  );
}
