/**
 * The rule that keeps every surface saying the same thing about who Kim is.
 *
 * `src/identity.ts` holds the words. This file holds the two questions worth
 * asking about them: is the current copy actually present, and is any retired
 * copy still hanging around. It is imported by `identity-check.mjs`, which asks
 * those questions of four static files at `prebuild`, and by `verify.mjs`,
 * which asks them of what nginx actually serves. Both import it so they cannot
 * drift into disagreeing about what the rule is, which is the same shape as
 * `case-study/policy.mjs`.
 *
 * Why this is a separate file from `identity.ts`: that module is imported by
 * `Pitch.tsx` and so is a candidate for the client bundle, and a list of
 * retired labels is the one thing that must not ship. Putting `BANNED` there
 * would publish the string this whole exercise removed.
 *
 * ## Why the copy was in nine places to begin with
 *
 * Because there was no reason for it not to be. A `<title>`, an `og:title`, a
 * React component, a card template, a card generator and two CV documents are
 * six different technologies, and each one was correct when it was written. The
 * failure mode is not that someone typed the wrong thing; it is that the tenth
 * edit updates eight of them. `index.html` said as much in a comment for weeks:
 * "nothing here will tell you it has gone stale."
 */

/**
 * Copy that must not appear on any surface, matched case-insensitively against
 * flattened text.
 *
 * `design engineer` was the site's title until 2026-08-07 and is retired: Kim
 * does not identify with it, and it undersold a portfolio in which four of the
 * five spokes have a real backend. It is banned rather than merely replaced
 * because a retitling across nine surfaces is only finished if the old title
 * cannot come back through a tenth that nobody remembered.
 *
 * Substrings, deliberately. `design engineer` catches `Design Engineer`,
 * `design engineering` and `design-engineer` once punctuation is flattened, so
 * one entry covers every form the label took across the repository.
 */
export const BANNED = ['design engineer'];

/**
 * Reduce copy to its words, so the checks compare what a reader sees rather
 * than how a given file happens to encode it.
 *
 * The same apostrophe is three characters across these surfaces: `’` in
 * `identity.ts` and the typeset CV, `&rsquo;` in the card templates, and a
 * plain `'` in the meta tags, where ASCII travels furthest through the scrapers
 * that read them. All three are correct where they are, so this normalises
 * instead of forcing one mark everywhere and calling the rest a failure.
 *
 * Hyphens fold to spaces for the same reason: `design-engineer` and `design
 * engineer` are one label, and a ban list that only catches the spaced form is
 * a ban list with a hole in it.
 *
 * So does the middot, which is a separator rather than a word. The same three
 * facts are one middot-joined line under the H1 and three `<br />`-separated
 * lines on the share card, and those are the same copy set two ways. The cost
 * is that a surface which drops the separator entirely still passes; that is a
 * typesetting bug, and this file is about words.
 */
export function flatten(s) {
  return String(s)
    .replace(/&rsquo;|&#8217;|&#x2019;|[’‘]/g, "'")
    .replace(/&middot;|&#183;/g, '·')
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/[-‐‑·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Strip markup, leaving a space behind.
 *
 * The pitch is one sentence broken over two lines by a `<br />` on three of the
 * four static surfaces, and the case-study rail wraps the name in `<strong>`.
 * Deleting the tag outright would weld `engineer` to `with`; replacing it with
 * a space and letting `flatten` collapse the run gets the sentence back.
 */
export function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, ' ');
}

/** Is this piece of copy present in that text, ignoring encoding? */
export function containsCopy(haystack, needle) {
  return flatten(haystack).includes(flatten(needle));
}

/** Is this copy exactly what that markup says, ignoring tags and encoding? */
export function isCopy(html, wanted) {
  return flatten(stripTags(html)) === flatten(wanted);
}

/** Does this markup open with that copy? For paragraphs that carry the pitch
 *  and then keep going. */
export function opensWithCopy(html, wanted) {
  return flatten(stripTags(html)).startsWith(flatten(wanted));
}

/** Every banned phrase present in the text. Empty when the text is clean. */
export function findBanned(text) {
  const flat = flatten(text);
  return BANNED.filter((phrase) => flat.includes(flatten(phrase)));
}
