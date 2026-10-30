import { create } from 'qrcode';
import { describe, expect, it } from 'vitest';
import { QR_QUIET_ZONE, joinUrl, qrPath } from './qr.js';

/** The dark modules a path draws, as "col,row" without the quiet zone. */
function darkCells(d: string): Set<string> {
  const cells = new Set<string>();
  for (const m of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    cells.add(`${Number(m[1]) - QR_QUIET_ZONE},${Number(m[2]) - QR_QUIET_ZONE}`);
  }
  return cells;
}

describe('qrPath', () => {
  const url = joinUrl('https://sketchy.kimnejudne.dev', 'KPRW');

  it('builds the join URL from the origin and code', () => {
    expect(url).toBe('https://sketchy.kimnejudne.dev/play/KPRW');
  });

  it('draws exactly the dark modules of the code, inside a 4-module quiet zone', () => {
    const { modules } = create(url, { errorCorrectionLevel: 'M' });
    const { size, d } = qrPath(url);
    expect(size).toBe(modules.size + 2 * QR_QUIET_ZONE);
    const cells = darkCells(d);
    let dark = 0;
    for (let row = 0; row < modules.size; row++)
      for (let col = 0; col < modules.size; col++)
        if (modules.get(row, col)) {
          dark++;
          expect(cells.has(`${col},${row}`)).toBe(true);
        }
    expect(cells.size).toBe(dark);
    // Nothing is drawn in the quiet zone.
    for (const cell of cells) {
      const [col, row] = cell.split(',').map(Number) as [number, number];
      expect(col).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(modules.size);
    }
  });

  it('keeps a join URL at version 3 (29 modules) with the three finder patterns', () => {
    const { size, d } = qrPath(url);
    expect(size - 2 * QR_QUIET_ZONE).toBe(29);
    const cells = darkCells(d);
    const n = 29;
    // Each finder's outer ring corners and centre are dark.
    for (const [c, r] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ] as const) {
      for (const [dc, dr] of [
        [0, 0],
        [6, 0],
        [0, 6],
        [6, 6],
        [3, 3],
      ] as const)
        expect(cells.has(`${c + dc},${r + dr}`)).toBe(true);
      // The light ring between the outer ring and the centre.
      expect(cells.has(`${c + 1},${r + 1}`)).toBe(false);
    }
  });

  it('is the same path for the same text', () => {
    expect(qrPath(url)).toEqual(qrPath(url));
    expect(qrPath(url).d).not.toBe(qrPath(joinUrl('https://sketchy.kimnejudne.dev', 'ABCD')).d);
  });
});
