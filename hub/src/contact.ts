/**
 * How to reach him, in one place.
 *
 * Written here rather than inline in `Colophon.tsx` for the same reason
 * `spokes.ts` and `cv.ts` exist: this is read by more than the page.
 * `scripts/verify.mjs` imports it, so the address the footer renders and the
 * address the suite asserts cannot drift into agreement-by-coincidence.
 *
 * It was inline until 2026-08-07, as two hand-typed copies: once in the
 * `mailto:` and once as the link text. That is the shape the failure takes,
 * and nothing checked it. Every other outbound link on this site is fetched
 * and verified (five repositories, five case studies, the CV), while the one
 * address the whole page exists to produce was unguarded, and a footer whose
 * visible text and href disagree is a dead end that looks fine.
 *
 * The address changed that day too: `august.nejudne@gmail.com` became
 * `work.august.nejudne@gmail.com`, which is also what the CV carries.
 */
export const CONTACT = {
  /**
   * The visible text and the `mailto:` target, from one string. A link whose
   * label is not its destination is the specific defect this file prevents,
   * so the label is not a separate field.
   */
  email: 'work.august.nejudne@gmail.com',
  github: 'https://github.com/kim-nejudne',
  githubLabel: 'github.com/kim-nejudne',
} as const;
