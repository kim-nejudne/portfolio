// Photo credits (spec: Photos and credits).
import type { Photo, Place } from '#shared/types.js';

/** Lower case with accents dropped ("Kyōto" → "kyoto"). */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Whether the author text contains a word of 4+ letters from the name, display name or country. */
export function authorNamesPlace(
  photo: Pick<Photo, 'author'>,
  place: Pick<Place, 'name' | 'displayName' | 'countryName'>,
): boolean {
  const author = fold(photo.author);
  const words = fold(`${place.name} ${place.displayName} ${place.countryName}`).split(/[^\p{L}]+/u);
  return words.some((w) => w.length >= 4 && author.includes(w));
}

/**
 * The credit under a photo during GUESSING: "Photo: ‹author› · ‹licence›", unless the author text
 * contains a word of 4 or more letters from the place's name, display name or country, so the
 * credit never names the answer.
 */
export function guessingCredit(
  photo: Pick<Photo, 'author' | 'licence'>,
  place: Pick<Place, 'name' | 'displayName' | 'countryName'>,
): string {
  const hidden = authorNamesPlace(photo, place);
  return `Photo: ${hidden ? 'Wikimedia Commons contributor' : photo.author} · ${photo.licence}`;
}
