import 'leaflet/dist/leaflet.css';
import type { ReactNode } from 'react';
import type { Box, LatLng } from '#shared/types.js';
import { useLeafletMap } from '../lib/useLeafletMap.js';
import { Crosshair } from './Crosshair.js';

const ZOOM_BUTTON =
  'flex size-12 items-center justify-center rounded-button border border-line bg-board-panel board-face text-2xl text-text [@media(hover:hover)]:hover:brightness-125 active:scale-[0.96]';

/**
 * The phone's aiming map (DESIGN.md "MapView"): Leaflet fitted to `box`, the crosshair at the
 * centre, + and − at the right edge, the attribution always visible, the "Simplified map" badge on
 * the fallback tiles, and Lock in under it, which sends the crosshair's position. `result`, when
 * set, takes Lock in's place.
 */
export function MapView({
  box,
  worldCopyJump,
  onLockIn,
  lockDisabled = false,
  result,
}: {
  box: Box;
  worldCopyJump?: boolean;
  onLockIn: (centre: LatLng) => void;
  lockDisabled?: boolean;
  result?: ReactNode;
}) {
  const { ref, map, layer, fallback } = useLeafletMap({ box, worldCopyJump });

  function lockIn() {
    if (!map || lockDisabled || result) return;
    const { lat, lng } = map.getCenter().wrap();
    onLockIn({ lat, lng });
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
