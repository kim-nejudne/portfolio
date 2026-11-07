// Photo credits (spec: Photos and credits).
import type { Photo, Place } from '#shared/types.js';

/** Lower case with accents dropped ("Kyōto" → "kyoto"). */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * The credit under a photo during GUESSING: "Photo: ‹author› · ‹licence›", unless the author text
 * contains a word of 4 or more letters from the place's name, display name or country, so the
 * credit never names the answer.
 */
export function guessingCredit(
  photo: Pick<Photo, 'author' | 'licence'>,
  place: Pick<Place, 'name' | 'displayName' | 'countryName'>,
): string {
  const author = fold(photo.author);
  const words = fold(`${place.name} ${place.displayName} ${place.countryName}`).split(/[^\p{L}]+/u);
  const names = words.some((w) => w.length >= 4 && author.includes(w));
  return `Photo: ${names ? 'Wikimedia Commons contributor' : photo.author} · ${photo.licence}`;
}
