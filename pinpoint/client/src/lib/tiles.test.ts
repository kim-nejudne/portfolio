import { describe, expect, it } from 'vitest';
import { createTileWatch, shouldUseFallback } from './tiles.js';

describe('the CARTO error-window switch', () => {
  it('switches on the 4th error within 10 s when no CARTO tile loaded', () => {
    expect(shouldUseFallback([0, 1000, 2000], null, 2000)).toBe(false);
    expect(shouldUseFallback([0, 1000, 2000, 9999], null, 9999)).toBe(true);
  });

  it('does not count errors older than 10 s', () => {
    expect(shouldUseFallback([0, 1000, 2000, 10_500], null, 10_500)).toBe(false);
  });

  it('does not switch while a CARTO tile loaded inside the window', () => {
    expect(shouldUseFallback([1000, 2000, 3000, 4000], 500, 4000)).toBe(false);
    // A load more than 10 s ago no longer counts.
    expect(shouldUseFallback([11_000, 12_000, 13_000, 14_000], 500, 14_000)).toBe(true);
  });

  it('a watch reports the switch once and stays switched', () => {
    const watch = createTileWatch();
    watch.load(0);
    expect([1, 2, 3].map((t) => watch.error(t * 1000))).toEqual([false, false, false]);
    expect(watch.error(4000)).toBe(false); // the load at 0 is inside the window
    expect(watch.error(10_001)).toBe(true);
    expect(watch.error(10_002)).toBe(false);
  });
});
