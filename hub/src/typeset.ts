/**
 * Typesetting rules that are about the shape of a line rather than its words.
 *
 * One function, extracted on 2026-08-11 because it was about to exist in three
 * places. `identity.ts` had it for the evidence line under the H1, `roles.ts`
 * had it for the `EARLIER` employers, and the new stack line in the hero needs
 * exactly the same treatment for exactly the same reason. Two copies is a
 * coincidence; three is a rule that should be written down once.
 *
 * The trick is invisible in a diff, which is the other argument for naming it:
 * both previous copies were a literal U+00A0 typed into a string, and a
 * reviewer reading the source sees an ordinary space. Constructed rather than
 * typed here, so the source says what it means.
 */

/** U+00A0. Built from its codepoint rather than typed, because typed literally
 *  it is indistinguishable from a space in every editor, diff and review, and
 *  the whole mechanism depends on it being exactly this character. */
const NBSP = String.fromCharCode(0xa0);

/** The separator this site uses everywhere: middot, spaced. */
export const SEP = ' · ';

/**
 * Bind a middot-separated run so a wrap can only ever happen *after* a
 * separator, never before one.
 *
 * Left to itself a run like
 *
 *     Nine years of production JavaScript · An editorial background
 *
 * breaks wherever it runs out of room, and two of the available breaks are bad
 * in different ways. Breaking *inside* a fact reads as a rendering fault,
 * because a reader parses the run as N claims and expects the fold to be
 * between them. Breaking *before* a middot leaves the separator starting a
 * line, where it reads as a bullet:
 *
 *     Tawk.to · Acudeen
 *     · freelance
 *
 * That is the one that looks like a bug rather than a wrap, and it was caught
 * on a 390px phone in production after surviving every desktop look.
 *
 * So: every space *inside* a segment becomes non-breaking, and so does the
 * space *before* each separator. The ordinary space after each separator is
 * left alone and is the only break opportunity in the whole run. Wide, it is
 * one line; narrow, it folds at a separator with the middot ending the line
 * above.
 *
 * Nothing downstream has to know. Both `identity-policy.mjs`'s `flatten` and
 * `verify.mjs`'s comparison collapse on `\s+`, and JavaScript's `\s` matches
 * U+00A0, so every check sees the plain sentence. That was confirmed rather
 * than assumed, because it is luck rather than design.
 */
export function bindSeparators(run: string): string {
  return run
    .split(SEP)
    .map((segment) => segment.replace(/ /g, NBSP))
    .join(`${NBSP}· `);
}
