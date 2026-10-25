/**
 * Who this site says Kim is.
 *
 * One string per claim, in one place, because the claim was in nine places and
 * nothing checked that they agreed. `index.html:52-55` says so out loud about
 * the share card: "Rebuild it whenever either changes; nothing here will tell
 * you it has gone stale." That was true of the title too, and of the pitch, and
 * of both descriptions.
 *
 * Four of the surfaces are static HTML that cannot import a module: the page
 * head, the share-card template, and the two CV documents. They are held to
 * these strings by `scripts/identity-check.mjs` at `prebuild` instead, which
 * reads them as text and fails the build naming the file. The two that *can*
 * import (`components/Pitch.tsx` and `scripts/case-study-cards.mjs`) do, so
 * they cannot drift at all.
 *
 * ## On the label
 *
 * The title changed on 2026-08-07. The eyebrow named a role, directly above an
 * H1 that made the same claim in different words, so one of the two was always
 * redundant. The old label also undersold the work: it usually means frontend
 * plus taste, and four of the five spokes have a real backend. "Senior"
 * appeared on no surface at all next to nine years of production JavaScript.
 * So the title moved down into the sentence that was already carrying it, the
 * eyebrow went back to being a name, and the retired label is on the ban list
 * in `scripts/identity-policy.mjs` so it cannot creep back in through a surface
 * nobody remembered.
 *
 * ## What the fold had to do, 2026-08-11
 *
 * Kim is applying to remote US/EU startups and to agencies, and not getting
 * interviews. A recruiter-perspective read of the fold found three things, and
 * two of them were absences rather than mistakes.
 *
 * **No stack.** "JavaScript" was the only technology word above the colophon.
 * Someone filtering for React, TypeScript, Node or Postgres found none of them,
 * on a page whose entire argument is five products built with all four. That is
 * `STACK` below, and it is a separate line rather than more H1 because the H1
 * measure is about 27 characters and there was never room. See `.pitch` in
 * `index.css`, which records what the old line already cost.
 *
 * **The wrong half of the H1.** "with a designer's eye" is a true and load-
 * bearing claim, and directly under a title it reads as a qualifier on the
 * title: frontend, plus taste. Which is the exact reading the retitle four days
 * earlier existed to kill. It is not deleted, it is demoted. `Colophon.tsx`
 * carries it now, along with the editorial background and the 60fps claim,
 * where it reads as range rather than as a category. What replaced it is a
 * scope claim, which is what the H1 slot is actually for.
 *
 * **Nothing said he was available.** `AVAILABILITY` below. It was an open item
 * in `readiness-brief.md` under "The funnel", and the cheapest thing a recruiter
 * can do with a maybe is close the tab.
 */

import { SPOKES } from './spokes.ts';
import { bindSeparators } from './typeset.ts';

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
 *
 * This is also the only surface still carrying the full title after the H1
 * changed on 2026-08-11, which is deliberate. A `<title>` is read by machines
 * and shown in a tab and a search result, where a role label is exactly the
 * right thing; an H1 is read by a person who has already arrived, where a claim
 * about scope beats a claim about seniority.
 */
export const HEAD_TITLE = `${NAME} · ${TITLE}`;

/**
 * The H1, pre-broken.
 *
 * The break is authored rather than left to the browser. This is display Bodoni
 * at up to 3.1rem and the two halves are a claim and its scope, so the line
 * should turn where the sense turns. `text-wrap: balance` handles the narrow
 * widths where even half of it wraps.
 *
 * Line two was "with a designer's eye." until 2026-08-11. Both lines are inside
 * the measure with room to spare: 26 and 25 characters against a budget of
 * about 27, which is what 615px of `.pitch` holds in this face at this size.
 * That budget is not generous and is the reason the stack is a separate line;
 * `index.css` has the arithmetic and the story of the eight pixels the old copy
 * was running on.
 */
export const PITCH_LINES = ['Senior full-stack engineer', 'who ships whole products.'] as const;

/** The same sentence unbroken, for prose surfaces: both descriptions and the CV. */
export const PITCH_SENTENCE = PITCH_LINES.join(' ');

/**
 * The stack, above the fold, in the order someone scanning for it reads.
 *
 * Five names, and the constraint on the list is that every one has a shipped
 * spoke behind it rather than that it covers the most job postings.
 * TypeScript and React are both spokes; FastAPI, MongoDB and Python are
 * POKÉTRACK's backend. Next.js
 * and NestJS came off on 2026-10-25 with FORME and SUKI, and Express and
 * Postgres the same day with TALLOW, the only spokes that carried them. Nothing
 * here is a claim Kim cannot be tested on, which is the whole difference
 * between a stack line and a skills dump.
 *
 * `Vue` is deliberately absent. It is on the CV skills row with no role and no
 * project behind it (`readiness-brief.md`), and the fold is the last place a
 * claim like that belongs.
 *
 * The wider list still exists, in `Colophon.tsx`'s `Stack` row, where a reader
 * who has gone through the whole page can have GSAP, with nginx in the
 * Hosting row beside it. Two tiers, and this is the one that has six seconds.
 */
export const STACK = 'TypeScript · React · FastAPI · MongoDB · Python';

/** `STACK` typeset. It wraps at 320px, and must fold at a separator. */
export const STACK_SET = bindSeparators(STACK);

/**
 * The evidence line under the H1. Two facts, no adjectives.
 *
 * It was three until 2026-08-11 (nine years, an editorial background, motion
 * at 60fps), and the second and third moved to the colophon with the designer's
 * eye they belong to. What is here now is the two facts that support the new
 * H1's scope claim rather than the old H1's taste claim: how long, and how much
 * of it is standing up right now.
 *
 * **Digits here, words in the prose.** `DESCRIPTION` says "Nine years" and this
 * says "9 years", and that is a decision rather than drift. This line is set in
 * mono at 0.66rem and its job is to be scanned, where a numeral is found by the
 * eye in a way a spelled-out number is not. The descriptions are read as
 * sentences by people and by search engines, where a numeral opening a clause
 * reads as a spec sheet.
 *
 * The count is derived from `SPOKES`, not typed. It is the same doctrine as
 * `repoLabel` and the sitemap: the homepage already fails the build when a case
 * study goes missing, and a hero that says five while the index lists four
 * would be a worse version of the same defect, and a silent one.
 */
export const PITCH_META = `9 years in production · ${SPOKES.length} ${SPOKES.length === 1 ? 'product' : 'products'} live, front end to droplet`;

/**
 * `PITCH_META` typeset: the same line, bound so it can only break between its
 * facts.
 *
 * Left to itself it broke wherever it ran out of room, and at the desktop
 * measure that was **after "at"**, leaving `60fps` alone on line two. The line
 * is a set of claims and a reader parses it as a set; breaking inside one of
 * them, a word from its end, reads as a rendering fault rather than a fold.
 *
 * It was marginal rather than badly over: the old run measured about 620px
 * against `.pitch`'s 615px, so five pixels decided it. Shaving the tracking or
 * the size would have bought those five pixels at that width and lost them
 * again at the next font fallback or the next word added. Binding the segments
 * is true at every width instead: wide, it is one line; narrow, it folds at a
 * separator.
 *
 * The mechanism moved to `typeset.ts` on 2026-08-11, when the new stack line
 * made it the third copy. Its comments carry the reasoning; this one keeps the
 * measurement, because the measurement is about this line.
 */
export const PITCH_META_SET = bindSeparators(PITCH_META);

/**
 * That Kim is looking, what for, and from where.
 *
 * New on 2026-08-11. `readiness-brief.md` carried "Nothing anywhere says Kim is
 * available" as the one open funnel item that costs a lead directly: the
 * colophon was `STACK / HOSTING / CONTACT`, and the GitHub profile has
 * `hireable`, `location` and `company` all null. A recruiter who liked the work
 * had to guess.
 *
 * The brief recommended the colophon and Kim chose the hero, which is the more
 * exposed of the two placements and worth naming as such. This site is public,
 * it is indexed, `roles.ts` names D-Launch as the current employer four lines
 * further down the page, and this line is now above the fold rather than at the
 * bottom. That consequence is already recorded and accepted in
 * `cv/content.md`, open question 2. It is accepted here in its stronger form.
 *
 * The time zone rather than the country, because the question a remote team is
 * actually asking is about overlap. UTC+8 is Dumaguete.
 */
export const AVAILABILITY = 'Open to senior full-stack roles · Remote, UTC+8';

/** `AVAILABILITY` typeset, on the same rule as the two lines above it. */
export const AVAILABILITY_SET = bindSeparators(AVAILABILITY);

/**
 * `<meta name="description">`. The pitch plus the stack, spelled out.
 *
 * **126 characters, and there is a ceiling on this string that it does not
 * declare anywhere else.** `readiness-brief.md` made the GitHub profile bio
 * byte-identical to this value rather than a paraphrase of it, precisely so the
 * two cannot drift, and GitHub's bio field takes 160. Anything longer here
 * silently breaks that parity, and the failure appears on a server this
 * repository cannot check.
 *
 * The technology names are repeated from `STACK` rather than interpolated. A
 * meta description is a sentence read by a person in a search result, and
 * `TypeScript · React · Next.js` set inside prose reads as a broken tag. The
 * cost is that the two can disagree, which is the failure this whole module
 * exists to prevent, so the honest note is that they are the same claim in two
 * registers and both have to move together.
 */
export const DESCRIPTION = `${PITCH_SENTENCE} Nine years of production JavaScript: TypeScript, React, NestJS, Postgres.`;

/**
 * `og:description`. Deliberately not the same as `DESCRIPTION`: a search result
 * wants the credentials, and a pasted link wants to know what is behind it.
 */
export const OG_DESCRIPTION = `${PITCH_SENTENCE} Two standalone products, each with its own art direction.`;

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
