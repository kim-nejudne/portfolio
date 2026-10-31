import { describe, expect, it } from 'vitest';
import { FIT_MIN, fitScale } from './fit.js';
import { wordSize } from '../components/screen/ScreenTurn.js';

describe('fitScale (F65)', () => {
  it('keeps full size when nothing overflows', () => {
    expect(fitScale(() => false)).toBe(1);
  });

  it('steps down until the content fits', () => {
    // Content 130 px tall at full size in a 100 px box.
    const scale = fitScale((s) => 130 * s > 100);
    expect(130 * scale).toBeLessThanOrEqual(100);
    expect(130 * (scale / 0.92)).toBeGreaterThan(100);
  });

  it('never goes below FIT_MIN', () => {
    expect(fitScale(() => true)).toBe(FIT_MIN);
  });
});

describe('wordSize (F65)', () => {
  it('sizes from the measured width once the font is in', () => {
    // SANDWICH measures about 5.84 em: 0.73 a letter, not the 0.82 guess.
    expect(wordSize(8, 5.84)).toBe('min(12vh, calc(100cqw / 6.59))');
    expect(wordSize(8)).toBe('min(12vh, calc(100cqw / 7.35))');
  });

  // The px the word gets on a page `width` px wide in a `height` px tall viewport.
  const px = (size: string, width: number, height: number) => {
    const divisor = Number(/\/ ([\d.]+)\)\)$/.exec(size)![1]);
    return Math.min(0.12 * height, width / divisor);
  };

  it('reaches 12 vh for a short word on the landscape right page and the portrait top bar', () => {
    // "PAA" measures about 2.2 em in Nunito 900.
    expect(px(wordSize(3, 2.2), 492, 1080)).toBeCloseTo(0.12 * 1080);
    expect(px(wordSize(3, 2.2), 676, 1024)).toBeCloseTo(0.12 * 1024);
    // SANDWICH in portrait at 768×1024 is under it, but more than the old guess gave.
    expect(px(wordSize(8, 5.84), 676, 1024)).toBeGreaterThan(px(wordSize(8), 676, 1024));
  });
});
