// Distances, region scale and box helpers (spec: Distance and region scale; Map tiles; Edge cases).
// Pure maths, no I/O: imported by the server's scoring and the client's maps alike.

import { MAX_LAT } from './constants.js';
import type { Box, LatLng } from './types.js';

export const EARTH_RADIUS_KM = 6371.0088;
/** Kilometres per degree of arc, as the spec's scale formula writes it. */
export const KM_PER_DEGREE = 111.195;
export const MAX_SCALE_KM = 20000;
export const CLAMP_PADDING = 0.25;
export const GEODESIC_SEGMENTS = 64;

const RAD = Math.PI / 180;

/** Wraps any finite longitude into [−180, 180). */
export function normalizeLng(lng: number): number {
  if (lng >= -180 && lng < 180) return lng === 0 ? 0 : lng; // in range: exact, no float drift
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return wrapped === 0 ? 0 : wrapped; // no −0
}

/** Great-circle distance in km; correct across the antimeridian and for any longitude form. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The region scale `S` in km: √(h × w), capped at 20,000. */
export function regionScale(box: Box): number {
  const h = (box.north - box.south) * KM_PER_DEGREE;
  const w = (box.east - box.west) * KM_PER_DEGREE * Math.cos(((box.north + box.south) / 2) * RAD);
  return Math.min(MAX_SCALE_KM, Math.sqrt(h * w));
}

/** The bullseye radius `b` in km. */
export function bullseyeRadius(scale: number): number {
  return 0.01 * scale;
}

/** Edges included; with `east > 180` a point counts when `lng` or `lng + 360` lies in [west, east]. */
export function boxContains(box: Box, p: LatLng): boolean {
  if (p.lat < box.south || p.lat > box.north) return false;
  const inLng = (lng: number) => lng >= box.west && lng <= box.east;
  return inLng(p.lng) || inLng(p.lng + 360);
}

/** The centre of the box as Web Mercator draws it: half way in x and in y. Longitude in [−180, 180). */
export function mercatorCentre(box: Box): LatLng {
  const y = (lat: number) => Math.asinh(Math.tan(lat * RAD));
  const midY = (y(box.south) + y(box.north)) / 2;
  return { lat: Math.atan(Math.sinh(midY)) / RAD, lng: normalizeLng((box.west + box.east) / 2) };
}

/**
 * The round map's `maxBounds`: the box padded by 25% of its width and height on each side,
 * latitude clamped to the Mercator limit. Longitudes stay continuous (`east` may pass 180).
 * The World category uses only the latitudes: it has no horizontal clamp (`worldCopyJump`).
 */
export function clampBounds(box: Box): Box {
  const padLat = (box.north - box.south) * CLAMP_PADDING;
  const padLng = (box.east - box.west) * CLAMP_PADDING;
  return {
    south: Math.max(-MAX_LAT, box.south - padLat),
    west: box.west - padLng,
    north: Math.min(MAX_LAT, box.north + padLat),
    east: box.east + padLng,
  };
}

type Vec = [number, number, number];

const toVec = (p: LatLng): Vec => [
  Math.cos(p.lat * RAD) * Math.cos(p.lng * RAD),
  Math.cos(p.lat * RAD) * Math.sin(p.lng * RAD),
  Math.sin(p.lat * RAD),
];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (v: Vec) => Math.hypot(v[0], v[1], v[2]);

/**
 * The great circle from `a` to `b` as `segments + 1` points, `a` and `b` included. Longitudes are
 * continuous from `a.lng` (they may leave [−180, 180)) so a polyline never jumps across the map.
 */
export function geodesic(a: LatLng, b: LatLng, segments = GEODESIC_SEGMENTS): LatLng[] {
  const va = toVec(a);
  const vb = toVec(b);
  const sinD = norm(cross(va, vb));
  const d = Math.atan2(sinD, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]);
  if (d < 1e-12) return Array.from({ length: segments + 1 }, () => ({ ...a }));

  // Antipodal ends have no unique great circle: take any one through `a`.
  let u: Vec | null = null;
  if (sinD < 1e-9) {
    const c = cross(va, Math.abs(va[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
    u = c.map((x) => x / norm(c)) as Vec;
  }

  const points: LatLng[] = [{ ...a }];
  let prevLng = a.lng;
  const unwrap = (lng: number) => (prevLng = lng + 360 * Math.round((prevLng - lng) / 360));
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const ka = u ? Math.cos(t * d) : Math.sin((1 - t) * d) / sinD;
    const kb = u ? Math.sin(t * d) : Math.sin(t * d) / sinD;
    const other = u ?? vb;
    const v = [0, 1, 2].map((k) => ka * va[k]! + kb * other[k]!) as Vec;
    const lat = Math.atan2(v[2], Math.hypot(v[0], v[1])) / RAD;
    points.push({ lat, lng: unwrap(Math.atan2(v[1], v[0]) / RAD) });
  }
  points.push({ lat: b.lat, lng: unwrap(b.lng) });
  return points;
}
