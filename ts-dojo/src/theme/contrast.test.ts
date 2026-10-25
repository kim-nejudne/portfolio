// Every scheme in both modes keeps its text readable (the restyle's quality gate, 25 October
// 2026): body text, muted text and the accent (links, the primary action) reach WCAG AA, 4.5:1,
// against the page background, and body text against the panel background too. A palette whose
// published muted tone fell short carries an adjusted value, named in its file's comment.
import { describe, expect, it } from 'vitest';
import { AA_TEXT, contrastRatio, relativeLuminance } from './contrast';
import { SCHEMES } from './schemes';

describe('contrastRatio', () => {
  it('is 21 for black on white, 1 for a colour on itself, and symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#808080', '#808080')).toBe(1);
    expect(contrastRatio('#123456', '#fedcba')).toBe(
      contrastRatio('#fedcba', '#123456'),
    );
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('every palette reaches AA for text', () => {
  for (const scheme of SCHEMES) {
    for (const palette of [scheme.light, scheme.dark]) {
      it(`${scheme.label} ${palette.name}`, () => {
        const against = (fg: string, bg: string): number =>
          Math.round(contrastRatio(fg, bg) * 100) / 100;
        expect(
          against(palette.fg, palette.bg),
          'fg on bg',
        ).toBeGreaterThanOrEqual(AA_TEXT);
        expect(
          against(palette.fg, palette.bgAlt),
          'fg on bgAlt',
        ).toBeGreaterThanOrEqual(AA_TEXT);
        expect(
          against(palette.fgMuted, palette.bg),
          'fgMuted on bg',
        ).toBeGreaterThanOrEqual(AA_TEXT);
        expect(
          against(palette.accent, palette.bg),
          'accent on bg',
        ).toBeGreaterThanOrEqual(AA_TEXT);
        // A selection is transient: body text over it keeps the 3:1 WCAG minimum for user
        // interface components. The inverted hover (bg on fg) is readable like fg on bg.
        expect(
          against(palette.fg, palette.selection),
          'fg on selection',
        ).toBeGreaterThanOrEqual(3);
        expect(
          against(palette.bg, palette.fg),
          'bg on fg',
        ).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }
});
