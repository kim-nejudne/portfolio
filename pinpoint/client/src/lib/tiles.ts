import { create } from 'zustand';
import { TILE_ERROR_LIMIT, TILE_ERROR_WINDOW_MS } from '#shared/constants.js';
import type { ConfigResponse, TileLayerConfig } from '#shared/types.js';

/**
 * The spec's switch rule (Map tiles): 4 or more CARTO tile errors within the last 10 s, with no
 * CARTO tile loaded in that window. Times are ms on one clock.
 */
export function shouldUseFallback(errors: number[], lastLoadAt: number | null, now: number) {
  const inWindow = (t: number) => now - t < TILE_ERROR_WINDOW_MS;
  if (lastLoadAt !== null && inWindow(lastLoadAt)) return false;
  return errors.filter(inWindow).length >= TILE_ERROR_LIMIT;
}

/** Collects CARTO tile events; `error` returns true exactly once, when the page must switch. */
export function createTileWatch() {
  let errors: number[] = [];
  let lastLoadAt: number | null = null;
  let switched = false;
  return {
    load(now: number) {
      lastLoadAt = now;
    },
    error(now: number): boolean {
      if (switched) return false;
      errors = [...errors.filter((t) => now - t < TILE_ERROR_WINDOW_MS), now];
      switched = shouldUseFallback(errors, lastLoadAt, now);
      return switched;
    },
  };
}

interface TilesState {
  config: ConfigResponse | null;
  /** Every map on the page uses the fallback tiles until the page reloads. */
  fallback: boolean;
}

export const useTiles = create<TilesState>()(() => ({ config: null, fallback: false }));

let configRequest: Promise<void> | null = null;

/** Fetches `/api/config` once per page; a failure leaves `config` null and allows a retry. */
export function loadTileConfig(): Promise<void> {
  configRequest ??= fetch('/api/config')
    .then((res) => (res.ok ? (res.json() as Promise<ConfigResponse>) : Promise.reject()))
    .then((config) => useTiles.setState({ config }))
    .catch(() => {
      configRequest = null;
    });
  return configRequest;
}

// One watch for the whole page: errors from every map count toward the one switch.
let watch = createTileWatch();
export const reportTileLoad = () => watch.load(performance.now());
export function reportTileError(): void {
  if (watch.error(performance.now())) useTiles.setState({ fallback: true });
}

/** The layer every map should show: CARTO, or the fallback when switched or without a key. */
export function currentLayer(config: ConfigResponse, switched: boolean): TileLayerConfig {
  return switched || !config.tiles ? config.fallbackTiles : config.tiles;
}

/** Tests only: forget the config and the switch. */
export function resetTiles(): void {
  configRequest = null;
  watch = createTileWatch();
  useTiles.setState({ config: null, fallback: false });
}
