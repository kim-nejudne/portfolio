import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { WORLD_BOX } from '#shared/constants.js';
import { geodesic } from '#shared/geo.js';
import type { LatLng, PublicPlayer, RevealStage, RoundResult } from '#shared/types.js';
import { useLeafletMap } from '../lib/useLeafletMap.js';
import { pinIcon, targetIcon } from './PinMarker.js';

const FIT_PADDING = 80;
const FIT_MAX_ZOOM = 11;
const PIN_STAGGER_MS = 60;
const PIN_DROP_MS = 450;
const LINE_DRAW_MS = 400;

/** A pin's longitude moved to the target's side of the antimeridian, so the fit and line stay short. */
function near(p: LatLng, target: LatLng): LatLng {
  return { lat: p.lat, lng: p.lng + 360 * Math.round((target.lng - p.lng) / 360) };
}

/**
 * The Screen's reveal map (spec: Screen view, Reveal timeline): non-interactive, fitted to the target
 * and every pin with 80 px padding, never past zoom 11. Every pin from the start, the target from
 * `target`, and a geodesic line for each of the first `revealedCount` rows. Pins drop and lines draw
 * once each (spec Motion): a rebuild mid-animation resumes it, and a later one leaves it still.
 */
export function RevealMap({
  target,
  results,
  players,
  revealStage,
  revealedCount,
}: {
  target: LatLng;
  results: RoundResult[];
  players: PublicPlayer[];
  revealStage: RevealStage;
  revealedCount: number;
}) {
  const { ref, map, layer, fallback } = useLeafletMap({ box: WORLD_BOX, interactive: false });
  const byId = new Map(players.map((p) => [p.id, p]));
  const pins = results.flatMap((r, i) => {
    const player = byId.get(r.playerId);
    return r.position && player ? [{ at: near(r.position, target), player, index: i }] : [];
  });
  // The target is in the fit from the start, as the spec says, so the map never jumps (DECISIONS 26).
  const fitKey = JSON.stringify([target, ...pins.map((p) => p.at)]);
  const showTarget = revealStage !== 'pins';
  // When each pin's drop or line's draw started (its own delay included), by round (the fit) and player.
  const started = useRef(new Map<string, number>());

  useEffect(() => {
    if (!map) return;
    const points = JSON.parse(fitKey) as LatLng[];
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), {
      padding: [FIT_PADDING, FIT_PADDING],
      maxZoom: FIT_MAX_ZOOM,
      animate: false,
    });
  }, [map, fitKey]);

  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const now = performance.now();
    const seen = started.current;
    /** The delay that resumes an animation started at `startAt`; undefined once it has ended. */
    const resume = (startAt: number, ms: number) =>
      now - startAt < ms ? startAt - now : undefined;
    // New pins drop in a random order, 60 ms apart (presentation only, not game state).
    const fresh = pins
      .filter((p) => !seen.has(`pin ${fitKey} ${p.player.id}`))
      .map((p) => ({ id: p.player.id, k: Math.random() }))
      .sort((a, b) => a.k - b.k);
    fresh.forEach((p, i) => seen.set(`pin ${fitKey} ${p.id}`, now + i * PIN_STAGGER_MS));
    for (const pin of pins) {
      const lineKey = `line ${fitKey} ${pin.player.id}`;
      if (showTarget && pin.index < revealedCount) {
        const line = L.polyline(
          geodesic(pin.at, target).map((p) => [p.lat, p.lng] as [number, number]),
          { color: pin.player.color, weight: 3, interactive: false },
        ).addTo(group);
        if (!seen.has(lineKey)) seen.set(lineKey, now);
        const drawDelay = resume(seen.get(lineKey)!, LINE_DRAW_MS);
        const path = line.getElement() as SVGPathElement | undefined;
        if (path && drawDelay !== undefined) {
          // A dash the length of the path, offset from 1 to 0, draws it from the pin to the target.
          path.setAttribute('pathLength', '1');
          path.classList.add('reveal-line-draw');
          path.style.animationDelay = `${drawDelay}ms`;
        }
      }
      const dropDelayMs = resume(seen.get(`pin ${fitKey} ${pin.player.id}`)!, PIN_DROP_MS);
      L.marker([pin.at.lat, pin.at.lng], {
        icon: pinIcon(pin.player, { dropDelayMs }),
        interactive: false,
        keyboard: false,
      }).addTo(group);
    }
    if (showTarget) {
      L.marker([target.lat, target.lng], {
        icon: targetIcon(),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(group);
    }
    return () => void group.remove();
    // `pins` is rebuilt every render; `fitKey` and the players carry its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey, players, showTarget, revealedCount]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={ref}
        role="img"
        aria-label="Map of the guesses"
        data-lines={showTarget ? Math.min(revealedCount, pins.length) : 0}
        data-target={showTarget || undefined}
        className="absolute inset-0"
        // Inline: leaflet.css is unlayered and would beat a Tailwind utility.
        style={{ background: 'var(--board-bg)' }}
      />
      {fallback && (
        <p className="board-face pointer-events-none absolute top-4 left-4 z-[500] rounded-button bg-board-panel px-3 py-1 text-[22px] text-text-dim">
          Simplified map
        </p>
      )}
      {layer && (
        <p className="pointer-events-none absolute right-0 bottom-0 z-[500] rounded-tl-button bg-board-bg/80 px-3 py-1 text-[16px] text-text-dim">
          {layer.attribution}
        </p>
      )}
    </div>
  );
}
