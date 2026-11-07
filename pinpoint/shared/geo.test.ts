import { describe, expect, it } from 'vitest';
import { MAX_LAT } from '#shared/constants.js';
import {
  boxContains,
  bullseyeRadius,
  clampBounds,
  GEODESIC_SEGMENTS,
  geodesic,
  haversineKm,
  mercatorCentre,
  normalizeLng,
  regionScale,
} from '#shared/geo.js';
import type { Box } from '#shared/types.js';

const london = { lat: 51.5074, lng: -0.1278 };
const paris = { lat: 48.8566, lng: 2.3522 };
const sydney = { lat: -33.8688, lng: 151.2093 };
const auckland = { lat: -36.8485, lng: 174.7633 };

// The worked table's boxes (spec: Worked table).
const world: Box = { south: -58, west: -180, north: 78, east: 180 };
const europe: Box = { south: 34, west: -25, north: 72, east: 45 };
const japan: Box = { south: 30, west: 129, north: 45.5, east: 146 };
const tuscany: Box = { south: 42.2, west: 9.7, north: 44.5, east: 12.4 };
const pacific: Box = { south: -50, west: 170, north: -10, east: 200 }; // crosses the antimeridian

describe('normalizeLng', () => {
  it('wraps longitudes into [−180, 180) and leaves in-range ones exact', () => {
    expect(normalizeLng(180)).toBe(-180);
    expect(normalizeLng(-181)).toBe(179);
    expect(normalizeLng(540)).toBe(-180);
    expect(normalizeLng(-0)).toBe(0);
    expect(normalizeLng(12.3456)).toBe(12.3456);
  });
});

describe('haversineKm', () => {
  it('measures London to Paris as about 343.5 km', () => {
    expect(haversineKm(london, paris)).toBeCloseTo(343.5, 0);
  });

  it('measures Sydney to Auckland as about 2,156 km, the same with either longitude form', () => {
    const d = haversineKm(sydney, auckland);
    expect(Math.round(d)).toBe(2156);
    expect(haversineKm(sydney, { ...auckland, lng: auckland.lng - 360 })).toBeCloseTo(d, 6);
  });

  it('measures a short hop across the antimeridian as short', () => {
    // 179.5°E to 179.5°W on the equator: 1° of arc.
    expect(haversineKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 })).toBeCloseTo(111.195, 2);
  });

  it('gives 0 for the same point', () => {
    expect(haversineKm(paris, paris)).toBe(0);
  });
});

describe('regionScale and bullseyeRadius', () => {
  it.each([
    ['World', world, 20000, 200],
    ['Europe', europe, 4449, 44.5],
    ['Japan', japan, 1605, 16.1],
    ['Tuscany', tuscany, 236, 2.4],
  ])('%s matches the worked table', (_name, box, s, b) => {
    expect(Math.round(regionScale(box))).toBe(s);
    expect(bullseyeRadius(regionScale(box))).toBeCloseTo(b, 1);
  });

  it('caps the World box at exactly 20,000 km', () => {
    expect(regionScale(world)).toBe(20000);
  });

  it('measures a box across the antimeridian by its east − west span', () => {
    const shifted: Box = { south: -50, west: 170 - 360, north: -10, east: 200 - 360 };
    expect(regionScale(pacific)).toBeCloseTo(regionScale(shifted), 9);
  });
});

describe('boxContains', () => {
  it('contains points inside and on the edges, not outside', () => {
    expect(boxContains(japan, { lat: 35.68, lng: 139.69 })).toBe(true); // Tokyo
    expect(boxContains(japan, { lat: 30, lng: 146 })).toBe(true);
    expect(boxContains(japan, { lat: 29.99, lng: 139 })).toBe(false);
    expect(boxContains(japan, paris)).toBe(false);
  });

  it('contains a point across the antimeridian when lng + 360 lies in [west, east]', () => {
    expect(boxContains(pacific, auckland)).toBe(true); // 174.8, east of the line
    expect(boxContains(pacific, { lat: -14, lng: -171.8 })).toBe(true); // Apia: −171.8 + 360 = 188.2
    expect(boxContains(pacific, { lat: -14, lng: -150 })).toBe(false); // 210
    expect(boxContains(pacific, sydney)).toBe(false); // 151.2
  });

  it('contains every longitude for the World box', () => {
    expect(boxContains(world, { lat: 0, lng: -180 })).toBe(true);
    expect(boxContains(world, { lat: 0, lng: 179.99 })).toBe(true);
    expect(boxContains(world, { lat: 80, lng: 0 })).toBe(false);
  });
});

describe('mercatorCentre', () => {
  it('is the box centre for a box symmetric about the equator', () => {
    expect(mercatorCentre({ south: -60, west: -10, north: 60, east: 10 })).toEqual({
      lat: 0,
      lng: 0,
    });
  });

  it('takes the latitude half way in Mercator y, not in degrees', () => {
    // y(0) = 0, y(60) = ln tan 75° = 1.31696; half is 0.65848 → 35.26°.
    const c = mercatorCentre({ south: 0, west: 0, north: 60, east: 10 });
    expect(c.lat).toBeCloseTo(35.26, 2);
    expect(c.lng).toBe(5);
  });

  it('wraps a centre past 180 back into [−180, 180)', () => {
    expect(mercatorCentre(pacific).lng).toBe(-175);
  });
});

describe('clampBounds', () => {
  it('pads the box by 25% of its width and height on each side', () => {
    expect(clampBounds(japan)).toEqual({
      south: 30 - 3.875,
      north: 45.5 + 3.875,
      west: 129 - 4.25,
      east: 146 + 4.25,
    });
  });

  it('clamps latitude to the Mercator limit', () => {
    const b = clampBounds(world);
    expect(b.north).toBe(MAX_LAT);
    expect(b.south).toBe(-MAX_LAT);
  });

  it('keeps an antimeridian box continuous (east past 180)', () => {
    const b = clampBounds(pacific);
    expect(b.west).toBe(162.5);
    expect(b.east).toBe(207.5);
  });
});

describe('geodesic', () => {
  it('has 64 segments, starting and ending on the two points', () => {
    const line = geodesic(london, sydney);
    expect(GEODESIC_SEGMENTS).toBe(64);
    expect(line).toHaveLength(65);
    expect(line[0]).toEqual(london);
    expect(line[64]!.lat).toBeCloseTo(sydney.lat, 9);
    expect(line[64]!.lng).toBeCloseTo(sydney.lng, 9);
  });

  it('puts the midpoint half way along the great circle', () => {
    const mid = geodesic({ lat: 0, lng: 0 }, { lat: 0, lng: 90 })[32]!;
    expect(mid.lat).toBeCloseTo(0, 9);
    expect(mid.lng).toBeCloseTo(45, 9);
    // 60°N 0° to 60°N 180° goes over the pole, not along the parallel.
    expect(geodesic({ lat: 60, lng: 0 }, { lat: 60, lng: 180 })[32]!.lat).toBeCloseTo(90, 6);
    // Every point is equally far from both ends at the midpoint.
    const m = geodesic(london, sydney)[32]!;
    expect(haversineKm(london, m)).toBeCloseTo(haversineKm(m, sydney), 6);
  });

  it('keeps longitudes continuous across the antimeridian', () => {
    const line = geodesic({ lat: 0, lng: 170 }, { lat: 0, lng: -170 });
    expect(line[32]!.lng).toBeCloseTo(180, 9);
    expect(line[64]!.lng).toBeCloseTo(190, 9); // −170 + 360
    for (let i = 1; i < line.length; i++) {
      expect(Math.abs(line[i]!.lng - line[i - 1]!.lng)).toBeLessThan(1);
    }
  });

  it('handles identical and antipodal points', () => {
    expect(geodesic(paris, paris).every((p) => p.lat === paris.lat && p.lng === paris.lng)).toBe(
      true,
    );
    const line = geodesic({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(line.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true);
    // Half way between antipodes is a quarter of the circumference from each end.
    const quarter = (Math.PI / 2) * 6371.0088;
    expect(haversineKm({ lat: 0, lng: 0 }, line[32]!)).toBeCloseTo(quarter, 6);
    expect(haversineKm(line[32]!, { lat: 0, lng: 180 })).toBeCloseTo(quarter, 6);
    expect(haversineKm({ lat: 0, lng: 0 }, line[16]!)).toBeCloseTo(quarter / 2, 6);
    expect(line[64]).toEqual({ lat: 0, lng: -180 }); // continuous: this circle runs via 90°W
  });
});
