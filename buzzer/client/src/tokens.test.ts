import { describe, expect, it } from 'vitest';
import tokensCss from './tokens.css?raw';
import { contrast, tokenHex } from './test/oklch.js';

describe('Overprint tokens (design.md)', () => {
  it.each([
    ['ink', 'paper', 4.5],
    ['ink', 'paper-3', 4.5],
    ['muted', 'paper-2', 4.5],
    // A primary: paper type on the ink block, ink type through either pass on hover.
    ['paper', 'ink', 4.5],
    ['paper', 'ink-2', 4.5],
    ['accent-ink', 'accent', 4.5],
    ['accent-2-ink', 'accent-2', 4.5],
    ['ink-2', 'paper', 4.5],
    ['buzz-ink', 'buzz', 4.5],
    ['win-ink', 'win', 4.5],
    ['card-ink', 'card', 4.5],
    ['buzz', 'paper', 3],
    ['focus', 'paper', 3],
  ])('%s on %s clears %s:1', (fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('converts oklch to the hex a browser paints (near-black ink, newsprint, teal pass)', () => {
    expect(tokenHex('ink')).toBe('#120f0c');
    expect(tokenHex('paper')).toBe('#e6e3d9');
    expect(tokenHex('accent')).toBe('#00a2b9');
    expect(tokenHex('accent-2')).toBe('#fb7500');
    expect(tokenHex('buzz')).toBe('#d61d22');
  });

  it('prints the game states on the passes: win is the teal pass, warn the orange', () => {
    expect(tokenHex('win')).toBe(tokenHex('accent'));
    expect(tokenHex('warn')).toBe(tokenHex('accent-2'));
  });

  it('carries the moss, the buzzer reds and the multiply blend', () => {
    for (const name of ['mix', 'buzz-hi', 'buzz-deep', 'buzz-wall'])
      expect(() => tokenHex(name)).not.toThrow();
    expect(tokensCss).toContain('--blend: multiply;');
  });

  it('is square, flat and light', () => {
    for (const radius of ['card', 'control', 'pill'])
      expect(tokensCss).toContain(`--radius-${radius}: 0;`);
    expect(tokensCss).toContain('--shadow-card: none;');
    expect(tokensCss).toContain('color-scheme: light;');
  });
});
