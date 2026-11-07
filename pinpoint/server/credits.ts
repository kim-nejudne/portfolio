// Photo credits for `/credits/:code` (spec: Photos and credits).
import type { PhotoCredit, Place, Room } from '#shared/types.js';
import type { CategoryStore } from './categoryStore.js';

/** The room's revealed photo ids: its previous games' in order, then the current game's. */
export function revealedPhotoIds(room: Room): string[] {
  const current = Object.values(room.game?.photoTokens ?? {})
    .filter((t) => t.revealed)
    .map((t) => t.photoId);
  return [...room.previousGames.flatMap((g) => g.revealedPhotoIds), ...current];
}

/**
 * The credits of every revealed photo, never an unrevealed one. A photo is looked up in the
 * current game's pool, then in any category (live or draft); one no longer found is left out.
 * SPEC-QUESTION: DECISIONS 58 (thumbnails by position, an edited-away photo left out)
 */
export function roomCredits(room: Room, categories: CategoryStore): PhotoCredit[] {
  const places: Place[] = [
    ...Object.values(room.game?.pool ?? {}).flat(),
    ...categories
      .list()
      .flatMap((c) => [...Object.values(c.live), ...Object.values(c.draft)])
      .flatMap((level) => level?.places ?? []),
  ];
  return revealedPhotoIds(room).flatMap((id, n) => {
    const place = places.find((p) => p.photo?.id === id);
    if (!place?.photo) return [];
    const { author, licence, licenceUrl, commonsFile, sourceUrl } = place.photo;
    return [
      {
        name: place.name,
        author,
        licence,
        licenceUrl,
        commonsFile,
        sourceUrl,
        thumbUrl: `/api/credits/${room.code}/${n}/thumb`,
      },
    ];
  });
}
