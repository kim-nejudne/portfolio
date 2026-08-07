/**
 * Who this site says Kim is.
 *
 * One string per claim, in one place, because the claim was in nine places and
 * nothing checked that they agreed. `index.html:52-55` says so out loud about
 * the share card: "Rebuild it whenever either changes; nothing here will tell
 * you it has gone stale." That was true of the title too, and of the pitch, and
 * of both descriptions.
 *
 * Four of the nine surfaces are static HTML that cannot import a module: the
 * page head, the share-card template, and the two CV documents. They are held
 * to these strings by `scripts/identity-check.mjs` at `prebuild` instead, which
 * reads them as text and fails the build naming the file. The two that *can*
 * import (`components/Pitch.tsx` and `scripts/case-study-cards.mjs`) do, so
 * they cannot drift at all.
 *
 * ## On the label
 *
 * The title changed on 2026-08-07. The eyebrow named a role, directly above an
 * H1 that made the same claim in different words, so one of the two was always
 * redundant. The old label also undersold the work: it usually means frontend
 * plus taste, and four of the five spokes have a real backend behind them.
 * "Senior" appeared on no surface at all next to nine years of production
 * JavaScript. So the title moved down into the sentence that was already
 * carrying it, the eyebrow went back to being a name, and the retired label is
 * on the ban list in `scripts/identity-policy.mjs` so it cannot creep back in
 * through a surface nobody remembered.
 */

/** The eyebrow above the H1, and the masthead on every case study. */
export const NAME = 'Kim Nejudne';

/**
 * Title case, because here it is a label rather than a sentence: the page
 * title, the OG title, the line under the name on the CV. The H1 sets the same
 * words in sentence case, which is what `PITCH_LINES` is for.
 */
export const TITLE = 'Senior Full-Stack Engineer';

/**
 * Name and title joined for `<title>` and `og:title`.
 *
 * The middot is not decoration. Both of those carried an em dash until
 * 2026-08-07, in a repository whose CV documents ban the mark outright and
 * check for it (`cv/content.md:12-17`, `grep -rP '\x{2014}' hub/cv/`). The rule
 * never reached the page head because the head was outside the grep. The
 * middot is the site's own separator anyway: it is what `PITCH_META` and the CV
 * contact stack already use.
 */
export const HEAD_TITLE = `${NAME} · ${TITLE}`;

/**
 * The H1, pre-broken.
 *
 * The break is authored rather than left to the browser. This is display Bodoni
 * at up to 3.1rem and the two halves are a claim and its qualifier, so the line
 * should turn where the sense turns. `text-wrap: balance` handles the narrow
 * widths where even half of it wraps.
 */
export const PITCH_LINES = ['Senior full-stack engineer', 'with a designer’s eye.'] as const;

/** The same sentence unbroken, for prose surfaces: both descriptions and the CV. */
export const PITCH_SENTENCE = PITCH_LINES.join(' ');

/** The evidence line under the H1. Three facts, no adjectives. */
export const PITCH_META =
  'Nine years of production JavaScript · An editorial background · Motion that ships at 60fps';

/** `<meta name="description">`. The pitch plus the evidence, spelled out. */
export const DESCRIPTION = `${PITCH_SENTENCE} Nine years of production JavaScript, an editorial background, and motion that ships at 60fps.`;

/**
 * `og:description`. Deliberately not the same as `DESCRIPTION`: a search result
 * wants the credentials, and a pasted link wants to know what is behind it.
 */
export const OG_DESCRIPTION = `${PITCH_SENTENCE} Five standalone products, each with its own art direction.`;

/** `og:image:alt`. Describes the card, then quotes what is printed on it. */
export const OG_IMAGE_ALT = `A pen-and-ink portrait of Kim, the top of his head hinged open onto a circle of sky. Beside it: ${PITCH_SENTENCE.toLowerCase()}`;

/*
 * The rule that polices all of the above lives in `scripts/identity-policy.mjs`
 * and deliberately not here.
 *
 * This module is imported by `Pitch.tsx`, so every string in it is a candidate
 * for the client bundle. A list of banned phrases is the one thing that must
 * never ship: it would put the retired label back into the served JavaScript,
 * which is the exact outcome the list exists to prevent. Tree-shaking would
 * probably drop it, and "probably" is not a basis for shipping a string you
 * have just spent nine edits removing.
 *
 * It also matches `scripts/case-study/policy.mjs`, which is the shape this
 * repository already uses for a rule that both a generator and a verifier have
 * to agree on.
 */
