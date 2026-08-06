/**
 * The one thing every case study on this site must do.
 *
 * `positioning-brief.md` and `CLAUDE.md` both carry the same rule: every spoke
 * starts as an AI-generated scaffold, and every case study states that plainly
 * rather than leaving it to be discovered. The argument the portfolio makes
 * depends on it — the claim is not "I hand-built five apps", it is "I know
 * what is wrong with a generated app and I fixed it to a standard". Concealing
 * the origin would make the second claim unbelievable along with the first.
 *
 * So it is checked by a machine, twice: once by the generator, which refuses
 * to build a page that does not make the disclosure, and once by `verify.mjs`,
 * which refuses to ship one. Both import this file, so they cannot drift into
 * disagreeing about what the rule is.
 *
 * It is deliberately *not* a string match on a heading. Four of the five spokes
 * write `## Where this started, plainly`; PLINTH writes `## Where this page
 * came from, plainly`, because it is a marketing page rather than an app. A
 * literal comparison would have failed the one spoke whose disclosure is the
 * longest, which is the wrong answer loudly.
 */

/** The heading that opens the disclosure. Anchored, so it matches a heading
 *  rather than a sentence that happens to contain the word. */
export const DISCLOSURE_HEADING = /^where\b.*\bplainly$/i;

/** Words the disclosure itself has to contain. A heading is a title; the rule
 *  is about the statement underneath it. */
export const DISCLOSURE_BODY = /\b(AI|scaffold|scaffolded|generated|app builder)\b/i;

/** How near the top it has to be. Second section in all five today; allowing
 *  the first two means a spoke may open with its own framing, but nobody can
 *  bury the disclosure at the bottom and still pass. */
export const DISCLOSURE_MAX_INDEX = 1;

/** How much prose it takes before a disclosure counts as plain rather than a
 *  line of throat-clearing. The shortest of the five today is ~700 characters. */
export const DISCLOSURE_MIN_CHARS = 400;

/**
 * Check a case study's *source markdown*. Returns null when the rule holds, or
 * a sentence naming what is wrong when it does not.
 *
 * Works on markdown rather than rendered HTML so the generator can refuse
 * before writing anything. `verify.mjs` runs the same rule over the real DOM,
 * which is the check that matters — this one only makes the failure earlier
 * and cheaper.
 */
export function checkDisclosure(markdown) {
  // Sections are h2s. Split on them and keep the headings alongside their prose.
  const parts = markdown.split(/^## +(.+?) *$/m);
  // parts[0] is everything before the first h2; then [heading, body] pairs.
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ heading: parts[i].trim(), body: parts[i + 1] ?? '' });
  }
  if (!sections.length) return 'no `## ` sections at all';

  const at = sections.findIndex((s) => DISCLOSURE_HEADING.test(s.heading));
  if (at === -1) {
    return `no section heading matches ${DISCLOSURE_HEADING} — the AI-scaffold origin must be disclosed`;
  }
  if (at > DISCLOSURE_MAX_INDEX) {
    return `the disclosure is section ${at + 1} ("${sections[at].heading}"); it must be within the first ${DISCLOSURE_MAX_INDEX + 1}`;
  }

  const body = sections[at].body.trim();
  if (body.length < DISCLOSURE_MIN_CHARS) {
    return `the disclosure under "${sections[at].heading}" is only ${body.length} characters; ${DISCLOSURE_MIN_CHARS} is the floor for "plainly"`;
  }
  if (!DISCLOSURE_BODY.test(body)) {
    return `the disclosure under "${sections[at].heading}" never mentions the scaffold — it must name where the code came from`;
  }
  return null;
}
