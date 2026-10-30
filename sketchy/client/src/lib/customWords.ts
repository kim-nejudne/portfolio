// The custom words box (spec: Words, Custom words): what the host typed, split into words before
// it is sent. The server dedupes and checks the total; this only catches what the host can fix in
// the box (a word too long, too many in one go) without a round trip.
import { CUSTOM_WORD_MAX, CUSTOM_WORDS_MAX } from '../../../shared/constants.js';

export type ParsedWords =
  | { ok: true; words: string[] }
  | { ok: false; error: 'tooLong'; word: string }
  | { ok: false; error: 'tooMany' };

/** One word or phrase per line or comma-separated; blank entries dropped. */
export function parseCustomWords(text: string): ParsedWords {
  const words = text
    .split(/[\n,]/)
    .map((w) => w.trim())
    .filter((w) => w !== '');
  const long = words.find((w) => w.length > CUSTOM_WORD_MAX);
  if (long !== undefined) return { ok: false, error: 'tooLong', word: long };
  if (words.length > CUSTOM_WORDS_MAX) return { ok: false, error: 'tooMany' };
  return { ok: true, words };
}
