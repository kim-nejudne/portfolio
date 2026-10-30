// Custom words (spec: Words, Custom words). Pure: the reducer turns the host's typed words into
// deck entries here. Server state only: the words never reach a view (only their count) and are
// never logged.
import { CUSTOM_WORDS_MAX } from '../shared/constants.js';
import type { WordEntry } from '../shared/types.js';
import { normalize } from './match.js';

/**
 * The list with `words` added: each one trimmed (the schema did) with its runs of spaces collapsed,
 * difficulty 2, no alternates, `lang: 'custom'`. A word whose normalised form is already in the
 * list, or earlier in the batch, is left out, as is one that normalises to nothing ("the", "!!!"),
 * which nobody could guess. The id is the normalised form, so a word cleared and typed again keeps
 * its id, and `usedIds` still knows it was drawn. Over `CUSTOM_WORDS_MAX`, nothing is added.
 * `clear` starts from an empty list.
 */
// SPEC-QUESTION: the spec doesn't say whether a new batch replaces the list or adds to it. It adds;
// Clear all sends `clear` (DECISIONS 70).
export function addCustomWords(
  list: readonly WordEntry[],
  words: readonly string[],
  clear = false,
): WordEntry[] | 'tooManyWords' {
  const next = clear ? [] : [...list];
  const seen = new Set(next.map((w) => w.id));
  for (const raw of words) {
    const form = normalize(raw);
    const id = `custom/${form}`;
    if (form === '' || seen.has(id)) continue;
    seen.add(id);
    next.push({
      id,
      word: raw.trim().replace(/\s+/g, ' '),
      alt: [],
      difficulty: 2,
      lang: 'custom',
    });
  }
  return next.length > CUSTOM_WORDS_MAX ? 'tooManyWords' : next;
}
