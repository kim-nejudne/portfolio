// The admin's emoji picker for a category (F130): a grid of quiz emoji, and a check for "Other".
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
