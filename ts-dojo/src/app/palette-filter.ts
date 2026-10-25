// The palette's filter (spec §6 Command palette: "lessons by title and tags, exercises by title,
// ex commands by name", fuzzy-matched), as cmdk's `filter(value, search, keywords)`. cmdk's own
// scorer reads the value and the keywords as one string, so a command whose description says
// "next" could outrank `:next` itself; here the name counts most, then a title or tag, then a
// word anywhere, then any subsequence. Pure; the palette passes it to `<Command filter>`.

const NAME_EXACT = 1;
const NAME_PREFIX = 0.9;
const NAME_WORD = 0.8;
const ALIAS = 0.75;
const KEYWORD_PREFIX = 0.6;
const KEYWORD_WORD = 0.5;
const ANYWHERE = 0.3;
const SUBSEQUENCE = 0.05;

const words = (text: string): string[] =>
  text.split(/[\s/:._-]+/).filter((word) => word !== '');

function isSubsequence(needle: string, haystack: string): boolean {
  let at = 0;
  for (const char of haystack) {
    if (char === needle[at]) at++;
    if (at === needle.length) return true;
  }
  return needle.length === 0;
}

/**
 * How well `search` matches an item: its `value` (a command's `:label`, or `lesson <id>`) and its
 * keywords (a command's aliases and description, a lesson's title and tags, an exercise's
 * title). 0 hides the item; the highest is selected first.
 */
export function paletteScore(
  value: string,
  search: string,
  keywords: readonly string[] = [],
): number {
  const query = search.trim().toLowerCase().replace(/^:/, '');
  if (query === '') return 1;
  const name = value.toLowerCase().replace(/^:/, '');
  if (value.startsWith(':')) {
    if (name === query) return NAME_EXACT;
    if (name.startsWith(query)) return NAME_PREFIX;
    if (words(name).some((word) => word.startsWith(query))) return NAME_WORD;
  }
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  if (
    lowered.some(
      (keyword) => keyword.startsWith(':') && keyword.slice(1) === query,
    )
  ) {
    return ALIAS;
  }
  if (lowered.some((keyword) => keyword.startsWith(query))) {
    return KEYWORD_PREFIX;
  }
  if (
    lowered.some((keyword) => words(keyword).some((w) => w.startsWith(query)))
  ) {
    return KEYWORD_WORD;
  }
  const all = [name, ...lowered].join(' ');
  if (all.includes(query)) return ANYWHERE;
  return isSubsequence(query.replace(/\s+/g, ''), all.replace(/\s+/g, ''))
    ? SUBSEQUENCE
    : 0;
}
