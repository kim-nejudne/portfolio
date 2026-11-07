import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { Box, Category } from '#shared/types.js';
import { LEVEL_LABELS } from '../lib/adminCategories.js';
import {
  CORNERS,
  boxError,
  boxPlaces,
  cornerAt,
  draftMeta,
  dragCorner,
  saveMeta,
  scaleReadout,
} from '../lib/adminCategory.js';
import { BUTTON_PRIMARY, CARD, INPUT, message } from '../lib/adminUi.js';
import { useLeafletMap } from '../lib/useLeafletMap.js';

const EDGES = [
  ['south', 'South'],
  ['west', 'West'],
  ['north', 'North'],
  ['east', 'East'],
] as const;
type Fields = Record<keyof Box, string>;

const toFields = (b: Box): Fields => ({
  south: b.south.toFixed(2),
  west: b.west.toFixed(2),
  north: b.north.toFixed(2),
  east: b.east.toFixed(2),
});
// An empty field is NaN, which `boxError` refuses.
const toBox = (f: Fields): Box => ({
  south: f.south.trim() === '' ? NaN : Number(f.south),
  west: f.west.trim() === '' ? NaN : Number(f.west),
  north: f.north.trim() === '' ? NaN : Number(f.north),
  east: f.east.trim() === '' ? NaN : Number(f.east),
});
const sameBox = (a: Box, b: Box) =>
  a.south === b.south && a.west === b.west && a.north === b.north && a.east === b.east;

function divIcon(className: string, size: number) {
  const html = document.createElement('span');
  html.className = className;
  return L.divIcon({ className: '', iconSize: [size, size], html });
}

/**
 * The category's region box (spec: Category page, Box editor): a map with the box and draggable
 * corner handles, the numeric fields (2 decimals), every place as a dot, the scale readout, places
 * outside the box, and **Save box**, refused below 150 km. On a live category it saves into the draft.
 */
export function BoxEditor({
  category,
  onSaved,
}: {
  category: Category;
  onSaved: (c: Category) => void;
}) {
  const saved = draftMeta(category).box;
  const [fields, setFields] = useState(() => toFields(saved));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const box = toBox(fields);
  const error = boxError(box);
  const places = boxPlaces(category, error ? saved : box);
  const outside = places.filter((p) => p.outside);
  const live = Object.keys(category.live).length > 0;

  const { ref, map, layer } = useLeafletMap({ box: saved });
  const current = useRef(box);
  useEffect(() => {
    current.current = box;
  });
  const shapes = useRef<{ rect: L.Rectangle; handles: Map<string, L.Marker> } | null>(null);

  // The box and its handles, built once; dragging a handle moves its two edges.
  useEffect(() => {
    if (!map) return;
    const b = current.current;
    const rect = L.rectangle(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { className: 'admin-box', weight: 2, fillOpacity: 0.08, interactive: false },
    ).addTo(map);
    const handles = new Map<string, L.Marker>();
    for (const corner of CORNERS) {
      const at = cornerAt(b, corner);
      const handle = L.marker([at.lat, at.lng], {
        icon: divIcon('admin-handle', 48),
        draggable: true,
        keyboard: false, // the fields are the keyboard way
        title: `Drag the ${corner.toUpperCase()} corner`,
        zIndexOffset: 1000,
      }).addTo(map);
      handle.on('drag', () => {
        const { lat, lng } = handle.getLatLng();
        setFields(toFields(dragCorner(current.current, corner, { lat, lng })));
      });
      handles.set(corner, handle);
    }
    shapes.current = { rect, handles };
    return () => {
      rect.remove();
      for (const h of handles.values()) h.remove();
      shapes.current = null;
    };
  }, [map]);

  // Field edits and drags redraw the box; a half-typed box leaves it where it was.
  const boxKey = error ? null : JSON.stringify(box);
  useEffect(() => {
    if (!shapes.current || !boxKey) return;
    const b = JSON.parse(boxKey) as Box;
    shapes.current.rect.setBounds([
      [b.south, b.west],
      [b.north, b.east],
    ]);
    for (const [corner, handle] of shapes.current.handles) {
      const at = cornerAt(b, corner as (typeof CORNERS)[number]);
      handle.setLatLng([at.lat, at.lng]);
    }
  }, [boxKey, map]);

  // The places as dots, red when outside; across the antimeridian they sit on the box's side.
  const dotsKey = JSON.stringify(places.map((p) => [p.place.id, p.outside]));
  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const { west, east } = current.current;
    for (const { place, outside } of places) {
      const wrap = place.lng < west && place.lng + 360 <= east;
      L.marker([place.lat, wrap ? place.lng + 360 : place.lng], {
        icon: divIcon(
          `admin-dot admin-dot-${place.kind}${outside ? ' admin-dot-outside' : ''}`,
          outside ? 16 : 12,
        ),
        title: place.name,
        keyboard: false,
      }).addTo(group);
    }
    return () => void group.remove();
    // `places` is rebuilt every render; `dotsKey` carries its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dotsKey, category]);

  async function save() {
    if (error) return;
    setSaving(true);
    setStatus(null);
    try {
      const next = await saveMeta(category.id, { box });
      onSaved(next);
      setStatus({
        error: false,
        text: live ? 'Box saved into the draft.' : 'Box saved.',
      });
    } catch (err) {
      setStatus({ error: true, text: message(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="box-heading" className={CARD}>
      <h2 id="box-heading" className="text-xl font-bold">
        Region box
      </h2>
      <div className="relative h-72 overflow-hidden rounded-button border border-line lg:h-96">
        <div
          ref={ref}
          role="application"
          aria-label="Box map. Drag a corner to move two edges, or type them below. Places outside the box are listed below."
          className="absolute inset-0"
          // Inline: leaflet.css is unlayered and would beat a Tailwind utility.
          style={{ background: 'var(--board-bg)' }}
        />
        {layer && (
          <p className="pointer-events-none absolute right-0 bottom-0 z-[500] rounded-tl-button bg-board-bg/80 px-2 py-0.5 text-xs text-text-dim">
            {layer.attribution}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EDGES.map(([edge, label]) => (
          <label key={edge} className="flex flex-col gap-1 font-semibold">
            {label}
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={fields[edge]}
              onChange={(e) => {
                setFields({ ...fields, [edge]: e.target.value });
                setStatus(null);
              }}
              onBlur={() => {
                const n = Number(fields[edge]);
                if (fields[edge].trim() !== '' && Number.isFinite(n)) {
                  setFields({ ...fields, [edge]: n.toFixed(2) });
                }
              }}
              className={`${INPUT} board-face tabular-nums`}
            />
          </label>
        ))}
      </div>
      <p data-testid="scale-readout" aria-live="polite" className="board-face text-lg">
        {error ? 'Scale –' : scaleReadout(box)}
      </p>
      {/* A fixed slot, so the page doesn't jump as the box turns valid and back. */}
      <p role="alert" className="min-h-7 text-delayed">
        {error}
      </p>
      {outside.length === 0 ? (
        <p className="text-text-dim">Every place is inside the box.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-delayed">
            {outside.length === 1 ? '1 place' : `${outside.length} places`} outside the box
          </h3>
          <ul aria-label="Places outside the box" className="flex flex-col gap-1">
            {outside.map(({ place, level }) => (
              <li key={`${level}-${place.id}`} className="text-delayed">
                <span aria-hidden>⚠ </span>
                {place.name}{' '}
                <span className="text-text-dim">
                  · {LEVEL_LABELS[level]} · {place.kind === 'city' ? 'City' : 'Landmark'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || error !== null || sameBox(box, saved)}
          className={BUTTON_PRIMARY}
        >
          {saving ? 'Saving…' : 'Save box'}
        </button>
        {live && <p className="text-text-dim">On a live category the box goes live on Publish.</p>}
      </div>
      {status && (
        <p role={status.error ? 'alert' : 'status'} className={status.error ? 'text-delayed' : ''}>
          {status.text}
        </p>
      )}
    </section>
  );
}
