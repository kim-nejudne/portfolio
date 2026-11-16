import { describe, expect, it } from 'vitest';
import { contrast, tokenHex } from './test/oklch.js';

describe('Squeeze tokens (design.md)', () => {
  it.each([
    ['ink', 'paper', 4.5],
    ['muted', 'paper-2', 4.5],
    ['accent-ink', 'accent', 4.5],
    ['buzz-ink', 'buzz', 4.5],
    ['win-ink', 'win', 4.5],
    ['buzz', 'paper', 3],
  ])('%s on %s clears %s:1', (fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('converts oklch to the hex a browser paints (warm white ink, green paper, peach)', () => {
    expect(tokenHex('ink')).toBe('#fdfcf8');
    expect(tokenHex('paper')).toBe('#075930');
    expect(tokenHex('accent')).toBe('#ffb37c');
  });
});
