// The other Sketchbook primitives (F56): markup only, since they are decoration; the look is
// checked by the /dev/sketch playtest against the mockup.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Highlight } from './Highlight.js';
import { Paper } from './Paper.js';
import { SketchButton } from './SketchButton.js';
import { SpiralRings } from './SpiralRings.js';
import { Tape } from './Tape.js';

describe('the sketchbook primitives', () => {
  it('Paper is dot-grid or ruled paper', () => {
    expect(renderToStaticMarkup(<Paper variant="dots" />)).toContain('paper-dots');
    expect(renderToStaticMarkup(<Paper variant="ruled" />)).toContain('paper-ruled');
    expect(renderToStaticMarkup(<Paper variant="dots" />)).toContain('bg-paper');
  });

  it('SpiralRings draws the loops in a row or a column, hidden from screen readers', () => {
    const row = renderToStaticMarkup(<SpiralRings count={7} />);
    expect(row.match(/<i /g)).toHaveLength(7);
    expect(row).toContain('aria-hidden');
    expect(row).toContain('data-rings="row"');
    expect(renderToStaticMarkup(<SpiralRings direction="column" />)).toContain('flex-col');
  });

  it('Tape is hidden decoration, rotated by its place', () => {
    const corner = renderToStaticMarkup(<Tape place="tl" />);
    expect(corner).toContain('aria-hidden');
    expect(corner).toContain('-rotate-[38deg]');
    expect(renderToStaticMarkup(<Tape place="top" />)).toContain('-rotate-3');
    expect(corner).toContain('w-[74px]');
  });

  it('wide tape covers its whole strip instead of being a 74 px piece', () => {
    const wide = renderToStaticMarkup(<Tape place="wide" />);
    expect(wide).toContain('inset-0');
    expect(wide).not.toMatch(/\b[wh]-\[/);
  });

  it('Highlight keeps its words as plain text', () => {
    expect(renderToStaticMarkup(<Highlight>Laugh.</Highlight>)).toBe(
      '<span class="highlight">Laugh.</span>',
    );
  });

  it('SketchButton is a highlighter or paper button with a hand-drawn border and a press', () => {
    const primary = renderToStaticMarkup(<SketchButton>Join</SketchButton>);
    expect(primary).toContain('type="button"');
    expect(primary).toContain('bg-hl');
    expect(primary).toContain('sketch-border');
    expect(primary).toContain('active:shadow-none');
    expect(primary).toContain('min-h-12');
    expect(primary).toContain('focus-visible:outline-pen');
    expect(primary).toContain('hover:bg-none');
    const ghost = renderToStaticMarkup(
      <SketchButton variant="ghost" full type="submit">
        Start
      </SketchButton>,
    );
    expect(ghost).toContain('bg-paper');
    expect(ghost).toContain('min-h-[60px] w-full');
    expect(ghost).toContain('type="submit"');
  });
});
