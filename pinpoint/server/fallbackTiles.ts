import { join } from 'node:path';
import type { ConfigResponse } from '#shared/types.js';

// SPEC-QUESTION: DECISIONS 19 (where the tiles live, relative to the working directory)
/** Written by `npm run tiles:fallback`; relative to the working directory (the app root). */
export const FALLBACK_TILES_DIR = 'server/assets/fallback-tiles';
export const FALLBACK_TILE_MAX_ZOOM = 6;
/** The one tile every all-water address shares. */
export const WATER_TILE = 'water.png';

const CARTO_TEMPLATE = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

// SPEC-QUESTION: DECISIONS 19 (CARTO's maxNativeZoom and attribution text)
/** `GET /api/config`: CARTO with the key filled in (null without one), and the fallback. */
export function tileConfig(cartoKey: string | null): ConfigResponse {
  return {
    tiles: cartoKey
      ? {
          url: `${CARTO_TEMPLATE}?key=${encodeURIComponent(cartoKey)}`,
          attribution: '© OpenStreetMap contributors © CARTO',
          maxNativeZoom: 20,
        }
      : null,
    fallbackTiles: {
      url: '/tiles/fallback/{z}/{x}/{y}.png',
      attribution: 'Made with Natural Earth',
      maxNativeZoom: FALLBACK_TILE_MAX_ZOOM,
    },
  };
}

/**
 * The file for a tile address, relative to the tiles directory, or null outside zoom 0–6 or the
 * zoom's grid. The caller falls back to `WATER_TILE` when the file does not exist.
 */
export function fallbackTileFile(z: string, x: string, y: string): string | null {
  if (![z, x, y].every((part) => /^\d{1,2}$/.test(part))) return null;
  const [zoom, col, row] = [Number(z), Number(x), Number(y)];
  if (zoom > FALLBACK_TILE_MAX_ZOOM || col >= 2 ** zoom || row >= 2 ** zoom) return null;
  return join(String(zoom), String(col), `${row}.png`);
}
