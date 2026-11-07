// The admin category page (spec: Category page `/admin/categories/:id`): loading and saving it, and
// the box editor's pure rules (corner drags, rounding, the readout and places outside the box).

import { boxSchema, categoryEmojiSchema } from '#shared/schemas.js';
import { shortText } from '#shared/placeCheck.js';
import { boxContains, boxTooSmall, bullseyeRadius, formatKm, regionScale } from '#shared/geo.js';
import type {
  AdminCategoryResponse,
  AdminPublishResponse,
  Box,
  Category,
  CategoryLevelCounts,
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

/** The box and label style the draft uses. */
export { draftBoxAndStyle as draftMeta } from '#shared/publish.js';

const path = (id: string) => `/categories/${encodeURIComponent(id)}`;

/** `POST …/publish`: every draft level goes live at once, or the store's problems come back. */
export async function publishCategory(id: string): Promise<AdminPublishResponse> {
  const response = await adminWrite('POST', `${path(id)}/publish`, {});
  if (response.status === 401) adminSessionEnded();
  if (!response.ok) throw await errorFrom(response, 'Could not publish');
  return (await response.json()) as AdminPublishResponse;
}

/** `PUT …/hidden`. */
export async function setCategoryHidden(id: string, hidden: boolean): Promise<Category> {
  return categoryFrom(await adminWrite('PUT', `${path(id)}/hidden`, { hidden }), 'Could not save');
}

/** `PUT …/emoji`; null removes it. */
export async function setCategoryEmoji(id: string, emoji: string | null): Promise<Category> {
  return categoryFrom(await adminWrite('PUT', `${path(id)}/emoji`, { emoji }), 'Could not save');
}

/** `DELETE /api/admin/categories/:id`. */
export async function deleteCategory(id: string): Promise<void> {
  const response = await adminWrite('DELETE', path(id), {});
  if (response.status === 401) adminSessionEnded();
  if (!response.ok) throw await errorFrom(response, 'Could not delete');
}

/** What `/admin` says after Publish: "Japan is live: 3 levels published." */
export function publishedText(name: string, levels: number): string {
  // SPEC-QUESTION: DECISIONS 41 (a Publish of only the box and label style names no levels)
  if (levels === 0) return `${name} is live: its box and label style published.`;
  return `${name} is live: ${levels} ${levels === 1 ? 'level' : 'levels'} published.`;
}

export interface LevelRow {
  level: Difficulty;
  /** Draft whenever the level has one, over a live level or not. */
  state: 'live' | 'draft' | 'missing';
  live: CategoryLevelCounts | null;
  draft: CategoryLevelCounts | null;
  /** The draft's review mark; null without a draft. */
  reviewed: boolean | null;
  /** The draft saved short: "12 of 15 landmarks". */
  short: string[];
}

const counts = (places: readonly Place[]): CategoryLevelCounts => ({
  city: places.filter((p) => p.kind === 'city').length,
  landmark: places.filter((p) => p.kind === 'landmark').length,
});

/** The Levels list of the category page: Easy, Medium and Hard, always all three. */
export function levelRows(c: Category): LevelRow[] {
  return LEVELS.map((level) => {
    const live = c.live[level];
    const draft = c.draft[level];
    return {
      level,
      state: draft ? 'draft' : live ? 'live' : 'missing',
      live: live ? counts(live.places) : null,
      draft: draft ? counts(draft.places) : null,
      reviewed: draft ? draft.reviewed : null,
      short: draft ? shortText(draft) : [],
    };
  });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "15 cities · 1 landmark". */
export const countsLine = (c: CategoryLevelCounts) =>
  `${plural(c.city, 'city', 'cities')} · ${plural(c.landmark, 'landmark', 'landmarks')}`;

/** The emoji picker's grid (24 places and travel; each one `categoryEmojiSchema` takes). */
export const CATEGORY_EMOJI = [
  '🌍', '🌎', '🌏', '🗺️', '🧭', '🏔️',
  '🏝️', '🏜️', '🌋', '🏛️', '🏰', '🗼',
  '🗽', '🕌', '⛩️', '🏙️', '🌉', '✈️',
  '🚂', '⛵', '🌊', '🌲', '🦁', '🍜',
] as const; // prettier-ignore

/** The "Other" field's value as the emoji to save, or the error to show under it. */
export function parseOtherEmoji(text: string): { emoji: string } | { error: string } {
  const parsed = categoryEmojiSchema.safeParse(text);
  return parsed.success ? { emoji: parsed.data } : { error: 'Type one emoji, such as 🦉.' };
}

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
