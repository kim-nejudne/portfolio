import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, type ReactNode } from 'react';
import { AIM_THROTTLE_MS } from '#shared/constants.js';
import type { Box, LatLng } from '#shared/types.js';
import { useLeafletMap } from '../lib/useLeafletMap.js';
import { Crosshair } from './Crosshair.js';

const ZOOM_BUTTON =
  'flex size-12 items-center justify-center rounded-button border border-line bg-board-panel board-face text-2xl text-text [@media(hover:hover)]:hover:brightness-125 active:scale-[0.96]';

/**
 * The phone's aiming map (DESIGN.md "MapView"): Leaflet fitted to `box`, the crosshair at the
 * centre, + and − at the right edge, the attribution always visible, the "Simplified map" badge on
 * the fallback tiles, and Lock in under it, which sends the crosshair's position and zoom.
 * `result`, when set, takes Lock in's place. `onAim` gets the crosshair's position on `move`, at
 * most once per 250 ms, and on every `moveend`; `initialCentre` moves the crosshair once, at start.
 */
export function MapView({
  box,
  worldCopyJump,
  maxBounds,
  initialCentre,
  onAim,
  onLockIn,
  lockDisabled = false,
  result,
}: {
  box: Box;
  worldCopyJump?: boolean;
  maxBounds?: Box;
  initialCentre?: LatLng | null;
  onAim?: (centre: LatLng) => void;
  onLockIn: (centre: LatLng, zoom: number) => void;
  lockDisabled?: boolean;
  result?: ReactNode;
}) {
  const { ref, map, layer, fallback } = useLeafletMap({ box, worldCopyJump, maxBounds });
  const aim = useRef(onAim);
  useEffect(() => {
    aim.current = onAim;
  });
  const startAt = useRef(initialCentre);

  useEffect(() => {
    if (!map) return;
    if (startAt.current) map.panTo(startAt.current, { animate: false });
    let last = -Infinity;
    const send = () => {
      last = Date.now();
      const { lat, lng } = map.getCenter().wrap();
      aim.current?.({ lat, lng });
    };
    const move = () => Date.now() - last >= AIM_THROTTLE_MS && send();
    map.on('move', move);
    map.on('moveend', send);
    return () => void map.off('move', move).off('moveend', send);
  }, [map]);

  function lockIn() {
    if (!map || lockDisabled || result) return;
    const { lat, lng } = map.getCenter().wrap();
    navigator.vibrate?.(30); // spec: Sound and haptics (absent on iOS Safari)
    onLockIn({ lat, lng }, map.getZoom());
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-72 flex-1 touch-none overflow-hidden select-none [-webkit-touch-callout:none]">
        <div
          ref={ref}
          role="application"
          aria-label="Map. Pan to aim the crosshair."
          onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && lockIn()}
          className="absolute inset-0"
          // Inline: leaflet.css is unlayered and would beat a Tailwind utility.
          style={{ background: 'var(--board-bg)' }}
        />
        <Crosshair />
        <div className="absolute top-1/2 right-2 z-[500] flex -translate-y-1/2 flex-col gap-2">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => map?.zoomIn()}
            className={ZOOM_BUTTON}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => map?.zoomOut()}
            className={ZOOM_BUTTON}
          >
            −
          </button>
        </div>
        {fallback && (
          <p className="board-face pointer-events-none absolute top-2 left-2 z-[500] rounded-button bg-board-panel px-2 py-1 text-xs text-text-dim">
            Simplified map
          </p>
        )}
        {layer && (
          <p className="pointer-events-none absolute right-0 bottom-0 z-[500] rounded-tl-button bg-board-bg/80 px-2 py-0.5 text-[11px] text-text-dim">
            {layer.attribution}
          </p>
        )}
      </div>
      <div className="flex min-h-24 items-center px-4 py-4">
        {result ?? (
          <button
            type="button"
            onClick={lockIn}
            disabled={!map || lockDisabled}
            className="board-face h-16 w-full rounded-button bg-amber text-2xl text-board-bg [@media(hover:hover)]:hover:brightness-110 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
          >
            Lock in
          </button>
        )}
      </div>
    </div>
  );
}
