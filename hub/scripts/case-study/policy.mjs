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

/*
 * The second rule: every case study opens with a way in.
 *
 * `readiness-brief.md` carried this as an open item. The five run 1,480 to
 * 4,479 words and every one of them opened at full speed, so a reader with
 * thirty seconds got a lede sentence and then a wall. They are the best
 * writing in the portfolio, and the person most likely to bounce off them is
 * exactly the person they were written for.
 *
 * ## Why this rule demands exact labels when the one above refuses to
 *
 * The disclosure rule is deliberately loose, and its comment explains why: a
 * literal match would fail PLINTH, whose disclosure is the longest of the five
 * and whose heading is its own. This rule is the opposite on purpose, and the
 * difference is worth stating so it does not read as an inconsistency.
 *
 * A disclosure is a *statement*, and a statement can be made in whatever words
 * suit the spoke. This block is a *table of contents*, and its entire value is
 * that it is the same four beats in the same order in all five documents: a
 * reader who has skimmed one knows where to look in the next, and the five
 * read as one curator's work rather than as five write-ups. Here variation is
 * the defect rather than the thing to accommodate.
 *
 * ## Why there is a ceiling as well as a floor
 *
 * A summary that grows has failed at the only job it has. The floor stops it
 * being four labels with a clause each; the ceiling stops it quietly becoming
 * a sixth section of the case study, which is the direction this kind of block
 * always drifts.
 */

/** The heading that opens the block. It has to be the *first* section. */
export const SHORT_HEADING = /^(the )?short version$/i;

/** The four beats, in order. Matched as bold lead-ins, which is how they are
 *  written: `**What it is.** ...` */
export const SHORT_ROWS = [
  { name: 'What it is', test: /\*\*What it is\b/i },
  { name: 'The hardest problem', test: /\*\*The hardest problem\b/i },
  { name: 'What the scaffold missed', test: /\*\*What the scaffold missed\b/i },
  { name: 'How it was proven', test: /\*\*How it was proven\b/i },
];

/** Enough that each beat says something. Four labels and four clauses is not a
 *  way in. */
export const SHORT_MIN_CHARS = 600;

/** And little enough that it is still a summary. The longest of the five today
 *  is about 1,350. */
export const SHORT_MAX_CHARS = 2000;

/**
 * Check a case study's *source markdown* for its opening summary. Returns null
 * when the rule holds, or a sentence naming what is wrong.
 */
export function checkShortVersion(markdown) {
  const parts = markdown.split(/^## +(.+?) *$/m);
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ heading: parts[i].trim(), body: parts[i + 1] ?? '' });
  }
  if (!sections.length) return 'no `## ` sections at all';

  const at = sections.findIndex((s) => SHORT_HEADING.test(s.heading));
  if (at === -1) {
    return `no section heading matches ${SHORT_HEADING} — every case study opens with one`;
  }
  if (at !== 0) {
    return `"${sections[at].heading}" is section ${at + 1}; it has to be the first, or it is not a way in`;
  }

  const body = sections[at].body.trim();
  if (body.length < SHORT_MIN_CHARS) {
    return `the short version is only ${body.length} characters; ${SHORT_MIN_CHARS} is the floor`;
  }
  if (body.length > SHORT_MAX_CHARS) {
    return `the short version is ${body.length} characters; ${SHORT_MAX_CHARS} is the ceiling, and a summary that grows is not one`;
  }

  const missing = SHORT_ROWS.filter((row) => !row.test.test(body)).map((row) => row.name);
  if (missing.length) {
    return `the short version is missing ${missing.length} of its four beats: ${missing.join(', ')}`;
  }
  return null;
}
