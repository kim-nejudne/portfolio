import { describe, expect, it } from 'vitest';
import { loadWorld, renderTile, renderWaterTile, TILE_SIZE } from './render-fallback-tiles.js';

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Buffer): [number, number] {
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe('render-fallback-tiles', () => {
  const world = loadWorld();

  it('renders the zoom 0 world as a 256 × 256 PNG', () => {
    const png = renderTile(world, 0, 0, 0);
    expect(png).not.toBeNull();
    expect(pngSize(png!)).toEqual([TILE_SIZE, TILE_SIZE]);
    expect(png!.length).toBeGreaterThan(renderWaterTile().length);
  });

  it('returns null for open sea and draws the water tile at 256 × 256', () => {
    // Zoom 6, mid South Pacific (about 150° W, 35° S).
    expect(renderTile(world, 6, 5, 39)).toBeNull();
    expect(pngSize(renderWaterTile())).toEqual([TILE_SIZE, TILE_SIZE]);
  });
});
