import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { boxContains } from '#shared/geo.js';
import type { Box, LatLng } from '#shared/types.js';
import { roundCoord } from '../lib/adminLevel.js';
import { useLeafletMap } from '../lib/useLeafletMap.js';

/**
 * A place card's 200 px map (spec: Level review): the box outline and the place's pin. The map
 * itself stays still, so a page of cards scrolls past it; while `onMove` is set the pin drags; a drop outside the box snaps back and calls `onRefused`.
 */
export function PlaceMiniMap({
  name,
  box,
  at,
  onMove,
  onRefused,
}: {
  name: string;
  box: Box;
  at: LatLng;
  onMove?: (to: LatLng) => void;
  onRefused?: () => void;
}) {
  const { ref, map, layer } = useLeafletMap({ box, interactive: false });
  const pin = useRef<L.Marker | null>(null);
  const latest = useRef({ at, onMove, onRefused });
  useEffect(() => {
    latest.current = { at, onMove, onRefused };
  });

  // The box and the pin, built once per map; across the antimeridian the pin sits on the box's side.
  useEffect(() => {
    if (!map) return;
    const rect = L.rectangle(
      [
        [box.south, box.west],
        [box.north, box.east],
      ],
      { className: 'admin-box', weight: 2, fillOpacity: 0.08, interactive: false },
    ).addTo(map);
    const html = document.createElement('span');
    html.className = 'admin-handle admin-pin';
    const marker = L.marker([0, 0], {
      icon: L.divIcon({ className: '', iconSize: [48, 48], html }),
      keyboard: false, // the Latitude and Longitude fields are the keyboard way
      title: name,
    }).addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng().wrap();
      const to = { lat: roundCoord(lat), lng: roundCoord(lng) };
      if (boxContains(box, to)) return latest.current.onMove?.(to);
      latest.current.onRefused?.();
      marker.setLatLng(shown(box, latest.current.at));
    });
    pin.current = marker;
    return () => {
      rect.remove();
      marker.remove();
      pin.current = null;
    };
    // A new box or name comes with a new card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    pin.current?.setLatLng(shown(box, at));
  }, [box, at, map]);

  const draggable = onMove !== undefined;
  useEffect(() => {
    const drag = pin.current?.dragging;
    if (draggable) drag?.enable();
    else drag?.disable();
  }, [draggable, map]);

  return (
    <div className="relative h-[200px] overflow-hidden rounded-button border border-line">
      <div
        ref={ref}
        role="img"
        aria-label={`Map of ${name} in the box`}
        className="absolute inset-0"
        // Inline: leaflet.css is unlayered and would beat a Tailwind utility.
        style={{ background: 'var(--board-bg)' }}
      />
      {layer && (
        <p className="pointer-events-none absolute right-0 bottom-0 z-[500] rounded-tl-button bg-board-bg/80 px-2 py-0.5 text-[11px] text-text-dim md:text-xs">
          {layer.attribution}
        </p>
      )}
    </div>
  );
}

/** Where to draw a point: east of the antimeridian when the box crosses it. */
function shown(box: Box, p: LatLng): [number, number] {
  const wrap = p.lng < box.west && p.lng + 360 <= box.east;
  return [p.lat, wrap ? p.lng + 360 : p.lng];
}
