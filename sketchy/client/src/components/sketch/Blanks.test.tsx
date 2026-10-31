// The blanks (F56): Nunito cells with an underline, spaces as gaps, hint letters in their cells and
// the letter counts after, scaled down to stay on one line.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { blankCells, blanksWidthEm, Blanks } from './Blanks.js';

const mask = (word: string) => [...word];

describe('blankCells', () => {
  it('turns each hidden letter into an empty underlined cell', () => {
    expect(blankCells(mask('____'))).toEqual([
      { kind: 'letter', ch: null },
      { kind: 'letter', ch: null },
      { kind: 'letter', ch: null },
      { kind: 'letter', ch: null },
    ]);
  });

  it('shows a revealed hint letter in its cell', () => {
    expect(blankCells(mask('_m__'))).toEqual([
      { kind: 'letter', ch: null },
      { kind: 'letter', ch: 'm' },
      { kind: 'letter', ch: null },
      { kind: 'letter', ch: null },
    ]);
  });

  it('keeps spaces as gaps and hyphens as marks without an underline', () => {
    expect(blankCells(mask('__ _-_'))).toEqual([
      { kind: 'letter', ch: null },
      { kind: 'letter', ch: null },
      { kind: 'space' },
      { kind: 'letter', ch: null },
      { kind: 'mark', ch: '-' },
      { kind: 'letter', ch: null },
    ]);
  });
});

describe('<Blanks>', () => {
  const render = (word: string) =>
    renderToStaticMarkup(<Blanks mask={mask(word)} label="8 letters to guess" />);

  it('writes the letter counts after the blanks, one per word', () => {
    expect(render('_____ ____')).toContain('(5, 4)');
    expect(render('________')).toContain('(8)');
  });

  it('draws one underlined cell per letter and one gap per space', () => {
    const html = render('__ ___');
    expect(html.match(/data-blank="letter"/g)).toHaveLength(5);
    expect(html.match(/data-blank="space"/g)).toHaveLength(1);
  });

  it('shows hint letters and never more than the mask has', () => {
    const html = render('u__r____a');
    expect(html).toContain('>u</span>');
    expect(html).toContain('>r</span>');
    expect(html).toContain('>a</span>');
    expect(html).toContain('(9)');
  });

  it('is one image for screen readers, labelled by the caller', () => {
    const html = render('____');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="8 letters to guess"');
  });

  it('shrinks the type to fit its width, never above the size asked for', () => {
    const html = renderToStaticMarkup(<Blanks mask={mask('____')} label="x" size="40px" />);
    expect(html).toContain(`font-size:min(40px, calc(100cqw / ${blanksWidthEm(mask('____'))}))`);
  });

  it('needs more width for longer words', () => {
    expect(blanksWidthEm(mask('________'))).toBeGreaterThan(blanksWidthEm(mask('____')));
    expect(blanksWidthEm(mask('____ ____'))).toBeGreaterThan(blanksWidthEm(mask('________')));
  });
});
