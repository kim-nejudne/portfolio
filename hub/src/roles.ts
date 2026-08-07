/**
 * Where the nine years went.
 *
 * The homepage showed five side projects, a droplet and no employers, which is
 * a thin page to make a seniority claim on. `identity.ts` put "Senior" in the
 * H1 on 2026-08-07; this is the evidence for it, and without it the reading
 * available to a skimmer was "talented hobbyist with taste" rather than
 * "senior engineer" — exactly the reading the new title exists to prevent.
 *
 * ## Why it is not in the showcase
 *
 * It was very nearly. The obvious idea is to let the employers fly out of the
 * head after the five cards, which reuses a mechanism that already works.
 *
 * It breaks on the metaphor. The head is *ideas from my head*, and the five
 * cards are things Kim conceived and built. Fabletics did not come out of his
 * head. More sharply: the five cards are **proof** and employer names are
 * **credentials**, and putting credentials in the proof slot dilutes the proof.
 * Someone who has just read five products and then meets a logo drops from
 * "look at this" to "please believe me", which is the wrong direction to move a
 * reader at the end of the strongest sequence on the site.
 *
 * So it lives under the index instead: the section already built for people who
 * will not sit through the performance, already a list of rows, and free of
 * choreography. The showcase keeps its pin, its three card inequalities and its
 * one subject.
 *
 * ## Why it is a module and not markup
 *
 * Because `hub/cv/` says all of this already, and a second copy in a component
 * would be a second copy with nothing keeping the two agreed. That failure had
 * just been paid for: the site's title lived in ten places and had drifted in
 * three of them, including a live PDF. `scripts/identity-check.mjs` reads this
 * file and fails the build if `cv/cv.html` does not carry the same employers
 * and the same titles, so the page and the document cannot disagree about where
 * Kim has worked.
 *
 * `cv/content.md` stays the authority on the *bullets*. This is only the
 * masthead of each role, because that is all the homepage shows.
 */

export type Role = {
  /** Stable key. Not shown. */
  readonly id: string;
  /** The employer, as they write it themselves. */
  readonly employer: string;
  /**
   * The title as that job was actually called.
   *
   * Not normalised up to match `identity.ts`. The retitle on 2026-08-07 changed
   * what the site calls Kim; it deliberately left these alone, because a past
   * job title is a checkable fact and inflating one is the cheapest possible
   * way to lose a reference check.
   */
  readonly title: string;
  /** As printed. En dashes, which `cv/content.md:12-17` allows in date ranges
   *  and only in date ranges. */
  readonly dates: string;
};

export const ROLES: readonly Role[] = [
  {
    id: 'd-launch',
    employer: 'D-Launch',
    title: 'Software Engineer',
    dates: 'April 2026 – Present',
  },
  {
    id: 'xergy',
    employer: 'Xergy',
    title: 'Full Stack Engineer',
    dates: 'June 2025 – March 2026',
  },
  {
    id: 'fabletics',
    employer: 'Fabletics',
    title: 'Frontend Engineer',
    dates: 'June 2023 – March 2025',
  },
  {
    id: '10x-ventures',
    employer: '10x Ventures',
    title: 'Full Stack Engineer',
    dates: 'September 2021 – June 2023',
  },
];

/**
 * The three oldest roles, compressed to one row.
 *
 * The CV does the same thing under an `EARLIER` heading and for the same
 * reason: they cover 2016 to 2021 and their job on the page is to show the nine
 * years are continuous, not to be read. Four rows and a summary is a shape a
 * skimmer finishes; seven rows is a document.
 */
export const EARLIER = {
  employers: ['Tawk.to', 'Acudeen', 'freelance'],
  dates: 'June 2016 – September 2021',
} as const;

/**
 * The three names as one line, bound so a break cannot orphan a separator.
 *
 * The join is a **non-breaking space then the middot**, which is the opposite
 * of the obvious `' · '`. It means the only break opportunity in the run is the
 * ordinary space *after* each separator, so a wrap gives
 *
 *     Tawk.to · Acudeen ·
 *     freelance
 *
 * where a plain join gave, on a 390px phone in production,
 *
 *     Tawk.to · Acudeen
 *     · freelance
 *
 * A separator starting a line reads as a bullet and is the sort of thing that
 * looks like a rendering bug rather than a wrap. It only shows at the widths
 * where the line is long enough to turn, which is why it survived every desktop
 * look and had to be caught in a phone screenshot.
 */
export const EARLIER_LINE = EARLIER.employers.join(' · ');
