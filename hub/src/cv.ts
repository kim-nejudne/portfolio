/**
 * The CV, in one place.
 *
 * Written here rather than inline in the component for the same reason
 * `spokes.ts` exists: this is read by more than the page. `scripts/verify.mjs`
 * imports it — Node has stripped types since 22.18 — and asserts the rendered
 * anchors against these exact strings, so the href on the page and the href the
 * suite fetches cannot drift into agreement-by-coincidence.
 *
 * `positioning-brief.md` listed "no CV or résumé anywhere" under open items. It
 * is a gap in the front door rather than in the work: someone who reads the
 * whole page has nothing to take away from it but an email address.
 *
 * **The file at `href` is a placeholder** until `cv/PLACEHOLDER` is deleted.
 * `deploy/deploy.sh` refuses to ship while it exists — see `cv/README.md`.
 */
export const CV = {
  /**
   * Root-absolute, like every other public asset here (`/head/…`, `/crops/…`).
   * Deliberately *not* in `sitemap.xml`: `verify.mjs` enforces set equality on
   * that file in both directions, so an extra entry fails as "unknown", and a
   * PDF has no business in a sitemap anyway.
   */
  href: '/cv.pdf',
  /**
   * What the browser saves it as. The URL is `cv.pdf` because that is a decent
   * URL; a file called `cv.pdf` in a recruiter's downloads folder next to nine
   * other files called `cv.pdf` is not.
   */
  filename: 'Kim-Nejudne-CV.pdf',
  label: 'Download my CV',
} as const;
