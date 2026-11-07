/**
 * Renders the fallback map tiles (spec: Map tiles, Fallback): zoom 0–6 from Natural Earth 1:10m
 * (`world-atlas`), land, coastlines and country borders, into server/assets/fallback-tiles/
 * (gitignored). Every all-water address shares one `water.png`. Run with `npm run tiles:fallback`.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { geoArea, geoBounds, geoMercator, geoPath, type GeoStream } from 'd3-geo';
import type { Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { FALLBACK_TILES_DIR, FALLBACK_TILE_MAX_ZOOM, WATER_TILE } from '../server/fallbackTiles.js';

export const TILE_SIZE = 256;
const COLOURS = { water: '#0A0B0D', land: '#17181B', coastline: '#3A3D44', border: '#4A4E57' };

interface Shape<G extends Geometry> {
  geometry: G;
  /** geoBounds: [[west, south], [east, north]]; west > east when it crosses the antimeridian. */
  bounds: [[number, number], [number, number]];
}

export interface WorldGeometry {
  land: Shape<Polygon>[];
  coastlines: Shape<LineString>[];
  borders: Shape<LineString>[];
}

function shapes<G extends Geometry>(geometries: G[]): Shape<G>[] {
  return geometries.map((geometry) => ({
    geometry,
    bounds: geoBounds({ type: 'Feature', geometry, properties: null }),
  }));
}

function lines(multi: MultiLineString): LineString[] {
  return multi.coordinates.map((coordinates) => ({ type: 'LineString', coordinates }));
}

/**
 * A few specks (Maldives islets) come out of the 10m TopoJSON wound the wrong way, which d3 reads
 * as "the whole globe except this speck". Reversing the rings restores the island.
 */
function fixWinding(polygon: Polygon): Polygon {
  if (geoArea(polygon) <= 2 * Math.PI) return polygon;
  return { type: 'Polygon', coordinates: polygon.coordinates.map((ring) => [...ring].reverse()) };
}

/** Drops projected points within half a pixel of the last one: 10m data at zoom 0 is mostly that. */
function thin(out: GeoStream): GeoStream {
  let last: [number, number] | null = null;
  return {
    point(x, y) {
      if (last && Math.abs(x - last[0]) < 0.5 && Math.abs(y - last[1]) < 0.5) return;
      last = [x, y];
      out.point(x, y);
    },
    lineStart() {
      last = null;
      out.lineStart();
    },
    lineEnd: () => out.lineEnd(),
    polygonStart: () => out.polygonStart(),
    polygonEnd: () => out.polygonEnd(),
    sphere: () => out.sphere?.(),
  };
}

/** Splits land and the meshes into parts with their bounds, so a tile projects only what it shows. */
export function loadWorld(): WorldGeometry {
  const topo = createRequire(import.meta.url)('world-atlas/countries-10m.json') as Topology<{
    countries: GeometryCollection;
    land: GeometryCollection;
  }>;
  const landPolygons = feature(topo, topo.objects.land).features.flatMap(({ geometry }) => {
    const g = geometry as Polygon | MultiPolygon;
    const polygons: Polygon[] =
      g.type === 'Polygon'
        ? [g]
        : g.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
    return polygons.map(fixWinding);
  });
  return {
    land: shapes(landPolygons),
    coastlines: shapes(lines(mesh(topo, topo.objects.land))),
    borders: shapes(lines(mesh(topo, topo.objects.countries, (a, b) => a !== b))),
  };
}

/** Web Mercator latitude of a tile edge (row `y` of `2^z`). */
function tileLat(y: number, z: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
}

function overlaps<G extends Geometry>(shape: Shape<G>, z: number, x: number, y: number): boolean {
  const [[west, south], [east, north]] = shape.bounds;
  if (west > east) return true; // crosses the antimeridian: let the projection clip it
  const pad = 360 / 2 ** z / TILE_SIZE; // about one pixel, for strokes on the edge
  const tileWest = (x / 2 ** z) * 360 - 180;
  const tileEast = ((x + 1) / 2 ** z) * 360 - 180;
  return (
    east >= tileWest - pad &&
    west <= tileEast + pad &&
    north >= tileLat(y + 1, z) - pad &&
    south <= tileLat(y, z) + pad
  );
}

/**
 * One tile as a PNG, or null when it shows only water (the caller writes the shared water tile).
 */
export function renderTile(world: WorldGeometry, z: number, x: number, y: number): Buffer | null {
  const worldSize = TILE_SIZE * 2 ** z;
  const projection = geoMercator()
    .scale(worldSize / (2 * Math.PI))
    .translate([worldSize / 2 - x * TILE_SIZE, worldSize / 2 - y * TILE_SIZE])
    .precision(0) // no resampling: it runs before the clip, over every off-tile segment too
    .clipExtent([
      [-2, -2],
      [TILE_SIZE + 2, TILE_SIZE + 2],
    ]);
  const path = geoPath({ stream: (out) => projection.stream(thin(out)) }).digits(1);
  const draw = (list: Shape<Geometry>[]) =>
    list
      .filter((s) => overlaps(s, z, x, y))
      .map((s) => path(s.geometry) ?? '')
      .join('');

  const land = draw(world.land);
  const coast = draw(world.coastlines);
  const borders = draw(world.borders);
  if (!land && !coast && !borders) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}">
<rect width="100%" height="100%" fill="${COLOURS.water}"/>
<path d="${land}" fill="${COLOURS.land}"/>
<path d="${coast}" fill="none" stroke="${COLOURS.coastline}" stroke-width="1" stroke-linejoin="round"/>
<path d="${borders}" fill="none" stroke="${COLOURS.border}" stroke-width="0.75" stroke-linejoin="round"/>
</svg>`;
  return renderSvg(svg);
}

function renderSvg(svg: string): Buffer {
  // No text on tiles; loading system fonts would cost seconds per tile.
  return Buffer.from(new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng());
}

export function renderWaterTile(): Buffer {
  return renderSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}"><rect width="100%" height="100%" fill="${COLOURS.water}"/></svg>`,
  );
}

async function main(outDir: string): Promise<void> {
  const started = performance.now();
  const world = loadWorld();
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, WATER_TILE), renderWaterTile());
  let written = 0;
  let water = 0;
  for (let z = 0; z <= FALLBACK_TILE_MAX_ZOOM; z++) {
    for (let x = 0; x < 2 ** z; x++) {
      for (let y = 0; y < 2 ** z; y++) {
        const png = renderTile(world, z, x, y);
        if (!png) {
          water++;
          continue;
        }
        const file = join(outDir, String(z), String(x), `${y}.png`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, png);
        written++;
      }
    }
    console.log(`zoom ${z} done`);
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`${written} tiles and ${water} all-water addresses into ${outDir} in ${seconds}s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(resolve(FALLBACK_TILES_DIR));
}
