// The admin category page (spec: Category page `/admin/categories/:id`): loading and saving it, and
// the box editor's pure rules (corner drags, rounding, the readout and places outside the box).

import { boxSchema } from '#shared/schemas.js';
import { boxContains, boxTooSmall, bullseyeRadius, formatKm, regionScale } from '#shared/geo.js';
import type {
  AdminCategoryResponse,
  Box,
  Category,
  Difficulty,
  LabelStyle,
  LatLng,
  Place,
} from '#shared/types.js';
import { LEVELS } from './adminCategories.js';
import { UNREACHABLE, adminSessionEnded, adminWrite, errorFrom } from './adminSession.js';

/** A 401 signs the page out; any other failure throws the server's message. */
async function categoryFrom(response: Response, fallback: string): Promise<Category> {
  if (response.status === 401) adminSessionEnded();
  if (!response.ok) throw await errorFrom(response, fallback);
  return ((await response.json()) as AdminCategoryResponse).category;
}

/** `GET /api/admin/categories/:id`. */
export async function loadCategory(id: string): Promise<Category> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return categoryFrom(response, 'Could not load the category');
}

/** `PUT /api/admin/categories/:id/meta`: into the draft meta on a live category. */
export async function saveMeta(
  id: string,
  meta: { box?: Box; labelStyle?: LabelStyle },
): Promise<Category> {
  const response = await adminWrite('PUT', `/categories/${encodeURIComponent(id)}/meta`, meta);
  return categoryFrom(response, 'Could not save');
}

/** The box and label style the draft uses (the server's `draftBoxAndStyle`). */
export const draftMeta = (c: Category) => c.draftMeta ?? { box: c.box, labelStyle: c.labelStyle };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The box at the 2 decimals the fields show. */
export const roundBox = (b: Box): Box => ({
  south: round2(b.south),
  west: round2(b.west),
  north: round2(b.north),
  east: round2(b.east),
});

export type Corner = 'sw' | 'nw' | 'ne' | 'se';
export const CORNERS: readonly Corner[] = ['sw', 'nw', 'ne', 'se'];

/** Where a corner handle sits. */
export function cornerAt(b: Box, corner: Corner): LatLng {
  return {
    lat: corner[0] === 's' ? b.south : b.north,
    lng: corner[1] === 'w' ? b.west : b.east,
  };
}

/** The box after dragging one corner to `to`: its two edges move, rounded to 2 decimals. */
export function dragCorner(b: Box, corner: Corner, to: LatLng): Box {
  return roundBox({
    ...b,
    [corner[0] === 's' ? 'south' : 'north']: to.lat,
    [corner[1] === 'w' ? 'west' : 'east']: to.lng,
  });
}

/** Why Save box is refused (a malformed box, or `S < 150` km), or null. */
export function boxError(b: Box): string | null {
  if (!Object.values(b).every(Number.isFinite)) return 'Enter all four edges in degrees';
  const parsed = boxSchema.safeParse(b);
  if (!parsed.success) return parsed.error.issues[0]!.message;
  return boxTooSmall(b);
}

/** "Scale 1,605 km · Bullseye 16 km". */
export function scaleReadout(b: Box): string {
  const scale = regionScale(b);
  return `Scale ${formatKm(scale)} · Bullseye ${formatKm(bullseyeRadius(scale))}`;
}

export interface BoxPlace {
  place: Place;
  level: Difficulty;
  outside: boolean;
}

/** Every place that would be live after Publish (each level's draft, else its live one), and whether it lies outside `b`. */
export function boxPlaces(c: Category, b: Box): BoxPlace[] {
  return LEVELS.flatMap(
    (level) =>
      (c.draft[level] ?? c.live[level])?.places.map((place) => ({
        place,
        level,
        outside: !boxContains(b, place),
      })) ?? [],
  );
}
