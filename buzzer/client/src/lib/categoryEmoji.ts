// Category emoji: the admin's picker grid and its "Other" check (F130), and the pickers' keyword map (F131).
import { emojiSchema } from '../../../shared/schemas.js';

/** The picker's grid: 48 emoji for quiz categories, each one that `emojiSchema` takes. */
export const QUIZ_EMOJI = [
  '🧠', '🎯', '🎲', '🧮', '🔬', '🧪', '🧬', '🔭',
  '🌍', '🗺️', '🏛️', '📜', '👑', '⚔️', '🏰', '📚',
  '✍️', '🗣️', '🎬', '📺', '🎭', '🎵', '🎸', '🎨',
  '📷', '🎮', '⚽', '🏀', '🏆', '🍔', '🍜', '🍷',
  '🐾', '🦁', '🌿', '🌋', '🌊', '☀️', '🚀', '✈️',
  '🚗', '💻', '🤖', '💰', '⚖️', '❤️', '🎉', '🇵🇭',
] as const; // prettier-ignore

/** The "Other" field's value as the emoji to save, or the error to show under it. */
export function parseOtherEmoji(text: string): { emoji: string } | { error: string } {
  const parsed = emojiSchema.safeParse(text);
  return parsed.success ? { emoji: parsed.data } : { error: 'Type one emoji, such as 🦉.' };
}

/**
 * The pickers' guess at an emoji from a category or title (F131), for a built-in category the admin
 * gave none and for this browser's sets. First match wins, so the specific subjects come before the
 * broad ones and the Philippines comes last ("Philippine History" is history). Each pattern starts
 * at a word, so "math" finds "Mathematics" but not "aftermath"; short words that start longer
 * ones ("sing" in "Singapore", "star" in "Starter") must end there too.
 */
const KEYWORD_EMOJI: readonly (readonly [string, RegExp])[] = [
  ['🧮', /\b(math|algebra|arithmetic|geometry|number)/],
  ['🧠', /\b(general knowledge|trivia|quiz|brain)/],
  // Before 🎬, so "Philippine TV & Pop Culture" and "Movies" differ.
  ['📺', /\b(tv|television|teleserye|cartoon)\b/],
  ['🎬', /\b(showbiz|movie|film|cinema|hollywood|pop culture|celebrit)/],
  ['🍥', /\b(anime|manga)/],
  ['🦸', /\b(comic|superhero|marvel)/],
  ['🎮', /\b(video game|gaming|game)/],
  ['🍔', /\b(food|drink|cook|cuisine|kitchen|dessert)/],
  ['🩺', /\b(health|body|medic|anatomy|doctor)/],
  ['🔤', /\b(word|language|spelling|grammar|vocab|tagalog|english)/],
  ['🎵', /\b(music|songs?\b|sing(ers?|ing)?\b|bands?\b|opm\b|karaoke)/],
  ['🐉', /\b(myth|folklore|legend)/],
  ['🙏', /\b(relig|bible|faith|church|saint)/],
  ['🚀', /\b(space|astronom|planets?\b|galax|stars?\b)/],
  ['🔬', /\b(science|chemi|physic|biolog)/],
  ['🏅', /\b(sport|basketball|football|soccer|boxing|olympic)/],
  ['💻', /\b(computer|tech\b|technolog|internet|coding|programming)/],
  ['🏛️', /\b(world history|ancient|empire)/],
  ['🌍', /\b(world|global|continent)/],
  ['🗺️', /\b(geograph|countr|capital|maps?\b|flags?\b|travel)/],
  ['📜', /\b(histor|wars?\b)/],
  ['🐾', /\b(animal|wildlife|zoo|dog|cat)s?\b/],
  ['🌿', /\b(nature|plant|environment)/],
  ['🎨', /\b(art|paint|design)s?\b/],
  ['💰', /\b(money|business|econom)/],
  ['🎄', /\b(christmas|holiday|pasko)/],
  ['🎉', /\b(birthday|party|celebrat)/],
  ['🇵🇭', /\b(philippin|filipino|pinoy|pilipinas)/],
];

/** Lower case without accents, so "Matemáticas" reads like "matematicas". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** The keyword map's emoji for `text`, or undefined when no keyword is in it. */
export function keywordEmoji(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const folded = fold(text);
  return KEYWORD_EMOJI.find(([, pattern]) => pattern.test(folded))?.[0];
}
