import L from 'leaflet';
import { useCallback, useEffect, useState } from 'react';
import { MAP_MAX_ZOOM } from '#shared/constants.js';
import type { Box } from '#shared/types.js';
import {
  currentLayer,
  loadTileConfig,
  reportTileError,
  reportTileLoad,
  useTiles,
} from './tiles.js';

export interface LeafletMapOptions {
  /** The map opens fitted to this box. */
  box: Box;
  /** The World box has no horizontal clamp (spec: Map tiles). */
  worldCopyJump?: boolean;
  /** False for the Screen's reveal map: no drag, zoom or keyboard (spec: Screen view). */
  interactive?: boolean;
}

/**
 * A Leaflet map (no react-leaflet) in the element given the returned `ref`, fitted to `box`, with
 * the page's current tile layer from `/api/config`. CARTO tile events feed the page-wide fallback
 * switch; on a switch the layer is replaced by the fallback. Returns the map once it exists, the
 * layer (for its attribution, which the caller shows) and whether it is the fallback.
 */
export function useLeafletMap({
  box,
  worldCopyJump = false,
  interactive = true,
}: LeafletMapOptions) {
  const [map, setMap] = useState<L.Map | null>(null);
  const config = useTiles((s) => s.config);
  const switched = useTiles((s) => s.fallback);

  // A callback ref (React 19 cleanup): the map is built once per element.
  const ref = useCallback((el: HTMLDivElement) => {
    void loadTileConfig();
    const m = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      maxZoom: MAP_MAX_ZOOM,
      worldCopyJump,
      ...(!interactive && {
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      }),
    });
    m.fitBounds([
      [box.south, box.west],
      [box.north, box.east],
    ]);
    setMap(m);
    return () => {
      m.remove();
      setMap(null);
    };
    // A new box comes with a new MapView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layerConfig = config && currentLayer(config, switched);
  useEffect(() => {
    if (!map || !layerConfig) return;
    const layer = L.tileLayer(layerConfig.url, {
      maxNativeZoom: layerConfig.maxNativeZoom,
      maxZoom: MAP_MAX_ZOOM,
      keepBuffer: 1, // fewer tile requests (spec: Map tiles, budget)
      updateWhenZooming: false,
    });
    if (layerConfig === config?.tiles) {
      layer.on('tileload', reportTileLoad);
      layer.on('tileerror', reportTileError);
    }
    layer.addTo(map);
    return () => void layer.remove();
  }, [map, layerConfig, config]);

  return {
    ref,
    map,
    layer: layerConfig,
    fallback: layerConfig !== null && layerConfig !== config?.tiles,
  };
}
