// The level review page (spec: Level review `/admin/categories/:id/:level`): its writes, the
// non-blocking warnings and the review keys (copied from Buzzr's `reviewKeys`, trimmed to F34's).

import { authorNamesPlace } from '#shared/credits.js';
import { bullseyeRadius, formatKm, haversineKm, regionScale } from '#shared/geo.js';
import { draftBoxAndStyle } from '#shared/publish.js';
import type {
  AdminCategoryResponse,
  AdminWikidataSearchResponse,
  Category,
  Difficulty,
  LatLng,
  Place,
  PlaceKind,
  WikidataCandidate,
} from '#shared/types.js';
import { LEVELS, LEVEL_LABELS } from './adminCategories.js';
import { UNREACHABLE, adminSessionEnded, adminWrite, errorFrom } from './adminSession.js';

const levelPath = (id: string, level: Difficulty) =>
  `/categories/${encodeURIComponent(id)}/levels/${level}`;

async function categoryFrom(response: Response, fallback: string): Promise<Category> {
  if (response.status === 401) adminSessionEnded();
  if (!response.ok) throw await errorFrom(response, fallback);
  return ((await response.json()) as AdminCategoryResponse).category;
}

export interface PlaceChanges {
  name?: string;
  displayName?: string;
  fact?: string;
  lat?: number;
  lng?: number;
}

/** `PUT …/levels/:level/places/:placeId`. */
export async function savePlace(
  id: string,
  level: Difficulty,
  placeId: string,
  changes: PlaceChanges,
): Promise<Category> {
  const path = `${levelPath(id, level)}/places/${encodeURIComponent(placeId)}`;
  return categoryFrom(await adminWrite('PUT', path, changes), 'Could not save');
}

/** `PUT …/places/:placeId` with `photoCandidate`: Swap photo. The server downloads and stores it. */
export async function swapPhoto(
  id: string,
  level: Difficulty,
  placeId: string,
  commonsFile: string,
): Promise<Category> {
  const path = `${levelPath(id, level)}/places/${encodeURIComponent(placeId)}`;
  return categoryFrom(
    await adminWrite('PUT', path, { photoCandidate: commonsFile }),
    'Could not swap the photo',
  );
}

/** `DELETE …/levels/:level/places/:placeId`. */
export async function removePlace(id: string, level: Difficulty, placeId: string) {
  const path = `${levelPath(id, level)}/places/${encodeURIComponent(placeId)}`;
  return categoryFrom(await adminWrite('DELETE', path, {}), 'Could not remove');
}

/** `POST …/levels/:level/reviewed`. */
export async function setLevelReviewed(id: string, level: Difficulty, reviewed: boolean) {
  const path = `${levelPath(id, level)}/reviewed`;
  return categoryFrom(await adminWrite('POST', path, { reviewed }), 'Could not save');
}

/** `GET /api/admin/wikidata/search`: Add by name's candidates. */
export async function searchWikidata(q: string, categoryId: string): Promise<WikidataCandidate[]> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/wikidata/search?${new URLSearchParams({ q, categoryId })}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (response.status === 401) adminSessionEnded();
  if (!response.ok) throw await errorFrom(response, 'Could not search Wikidata');
  return ((await response.json()) as AdminWikidataSearchResponse).candidates;
}

/** `POST …/levels/:level/places/add-by-id`: a refusal throws Locate's reason. */
export async function addPlaceById(
  id: string,
  level: Difficulty,
  body: { kind: PlaceKind; wikidataId: string; fact: string },
): Promise<Category> {
  const path = `${levelPath(id, level)}/places/add-by-id`;
  return categoryFrom(await adminWrite('POST', path, body), 'Could not add');
}

/** What the page reviews: the level's draft, else its live content, else nothing. */
export function reviewedContent(c: Category, level: Difficulty) {
  return c.draft[level] ?? c.live[level] ?? null;
}

/** Only the fields that differ from the place (a sent `displayName` stops the automatic name). */
export function placeChanges(place: Place, edit: Required<PlaceChanges>): PlaceChanges {
  const changes: PlaceChanges = {};
  if (edit.name.trim() !== place.name) changes.name = edit.name.trim();
  if (place.kind === 'city' && edit.displayName.trim() !== place.displayName) {
    changes.displayName = edit.displayName.trim();
  }
  if (edit.fact.trim() !== place.fact) changes.fact = edit.fact.trim();
  if (edit.lat !== place.lat || edit.lng !== place.lng) {
    changes.lat = edit.lat;
    changes.lng = edit.lng;
  }
  return changes;
}

/** A stored photo whose longer side is under this is warned about (spec: Level review). */
export const PHOTO_SMALL_PX = 1000;

/** A dragged or typed coordinate at 5 decimals (about a metre). */
export const roundCoord = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * The card's non-blocking warnings (spec: Level review). Other places are those of the same kind
 * in every level as it would be after Publish, since a game's mode is one kind and Mixed draws
 * from every level. `origin` is where Wikidata put the place, when the page knows it.
 */
// SPEC-QUESTION: DECISIONS 42 (which places count as "other", and where "from Wikidata" is)
export function placeWarnings(
  c: Category,
  level: Difficulty,
  place: Place,
  origin: LatLng | undefined,
): string[] {
  const radius = bullseyeRadius(regionScale(draftBoxAndStyle(c).box));
  const others = LEVELS.flatMap((l) =>
    (reviewedContent(c, l)?.places ?? [])
      .filter((p) => p.kind === place.kind && !(l === level && p.id === place.id))
      .map((p) => ({ p, label: l === level ? p.name : `${p.name} (${LEVEL_LABELS[l]})` })),
  );
  const warnings: string[] = [];
  const near = others.find(({ p }) => haversineKm(p, place) <= radius);
  if (near) warnings.push(`Within the bullseye radius of ${near.label}`);
  if (origin && (origin.lat !== place.lat || origin.lng !== place.lng)) {
    warnings.push(`Moved ${formatKm(haversineKm(origin, place))} from Wikidata`);
  }
  const fold = (s: string) => s.trim().toLocaleLowerCase();
  const twin = others.find(({ p }) => fold(p.displayName) === fold(place.displayName));
  if (twin) warnings.push(`Same display name as ${twin.label}`);
  const { photo } = place;
  if (place.kind === 'landmark' && photo) {
    if (Math.max(photo.width, photo.height) < PHOTO_SMALL_PX) warnings.push('Photo under 1000 px');
    if (authorNamesPlace(photo, place)) {
      warnings.push('Author credit will be hidden while guessing');
    }
    // SPEC-QUESTION: DECISIONS 59 (shown until the sign check has cleared the photo)
    if (photo.signCheck !== 'passed') warnings.push('Check for signs naming the place');
  }
  return warnings;
}

/** A shortcut on the review page, acting on the focused card. */
export type ReviewAction = 'next' | 'prev' | 'edit' | 'replace' | 'remove';

const REVIEW_KEYS: Record<ReviewAction, readonly string[]> = {
  next: ['j', 'ArrowDown'],
  prev: ['k', 'ArrowUp'],
  edit: ['e'],
  replace: ['r'],
  remove: ['Delete'],
};

/** The shortcut a key press means, or null. Modifier keys leave the browser's own keys alone. */
export function reviewAction(event: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat?: boolean;
}): ReviewAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const action = (Object.keys(REVIEW_KEYS) as ReviewAction[]).find((a) =>
    REVIEW_KEYS[a].includes(key),
  );
  if (!action || (event.repeat && action !== 'next' && action !== 'prev')) return null;
  return action;
}

/** Focus is in a text box or a select: letters there are typing, not shortcuts. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** The card after next (+1) or previous (-1) from `current` (-1: none); it stops at either end. */
export function stepCard(current: number, count: number, direction: 1 | -1): number | null {
  if (count <= 0) return null;
  if (current < 0 || current >= count) return direction === 1 ? 0 : count - 1;
  return Math.min(count - 1, Math.max(0, current + direction));
}
