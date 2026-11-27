/**
 * Where the nine years went.
 *
 * The homepage showed five side projects, a droplet and no employers, which is
 * a thin page to make a seniority claim on. `identity.ts` put "Senior" in the
 * H1 on 2026-08-07; this is the evidence for it, and without it the reading
 * available to a skimmer was "talented hobbyist with taste" rather than
 * "senior engineer" — exactly the reading the new title exists to prevent.
 *
 * ## Why it is the showcase now
 *
 * Until 2026-11-26 it was not. The reasoning then: the head is *ideas from my
 * head*, the cards were things Kim conceived and built, and employer names are
 * credentials rather than proof, so they lived in a quiet list under the index.
 *
 * Kim reversed that on 2026-11-26. The employer work is what a senior hire is
 * judged on, and each role now has a screenshot Kim is cleared to show, so a
 * card is proof of shipped work rather than a logo. The four roles are the
 * cards that come out of the head (`Showcase.tsx`), each with its bullets and
 * EARLIER as a fifth card; the side projects keep the index. The section below
 * the head (`Roles.tsx`) is the fallback for screen readers and reduced motion.
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
 * `cv/content.md` stays the authority on the *bullets*. Until 2026-11-26 this
 * was only the masthead of each role; then Kim asked for the employer work to
 * be the louder section, above the index, and a name with a date range is not
 * loud. So each role carries its CV bullets too, copied as `cv/cv.html` sets
 * them, and `identity-check.mjs` fails the build if any of them stops
 * appearing there. Change the wording in the CV first, then here.
 */

import { bindSeparators, SEP } from './typeset.ts';

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
  /** What Kim did there, verbatim from `cv/cv.html`. */
  readonly bullets: readonly string[];
  /**
   * A screenshot Kim supplied and is allowed to show, served from
   * `public/roles/<id>.{avif,png}` at 900x600. Absent means the panel is text
   * only, which is the honest state for work behind an NDA or an internal
   * system. Never sourced from a client archive.
   */
  readonly image?: { readonly alt: string };
  /**
   * The card's stack line in the showcase. Only tech the CV already names for
   * this role; `identity-check.mjs` fails the build if one is missing there.
   */
  readonly stack: readonly string[];
};

export const ROLES: readonly Role[] = [
  {
    id: 'netint',
    employer: 'NETINT Technologies',
    title: 'Contract Full Stack Engineer',
    dates: 'April – October 2026',
    bullets: [
      'Built a proof of concept for offering NETINT’s video processing units as a cloud service',
      'Built netint.com’s research page, a searchable VPU resource library, in WordPress and Elementor',
    ],
    image: { alt: 'The NETINT VPU resource library page: a search box, curated topic cards and the latest articles' },
    stack: ['WordPress', 'Elementor'],
  },
  {
    id: 'xergy',
    employer: 'Xergy',
    title: 'Full Stack Engineer',
    dates: 'June 2025 – March 2026',
    bullets: [
      'Helped build Proteus, a multi-tenant project lifecycle platform for engineering consultancies, across proposals and pricing, cost and schedule controls, resourcing and timesheets, and invoicing, in React and Laravel',
      'Built tenant-specific features and per-tenant configuration on a shared core, with each customer’s data kept isolated',
      'Onboarded new tenants and synced invoicing with their ERP and accounting systems',
    ],
    image: { alt: 'The Proteus homepage, with cost and schedule performance charts' },
    stack: ['React', 'Laravel'],
  },
  {
    id: 'fabletics',
    employer: 'Fabletics',
    title: 'Frontend Engineer',
    dates: 'June 2023 – March 2025',
    bullets: [
      'Migrated a VIP-membership storefront serving millions of members from Adobe ColdFusion and Vue.js to Next.js and NestJS, one section at a time, while still shipping new features and seasonal campaigns',
      'Released changes in stages behind A/B tests, so each one was proven on live traffic before it reached every member',
      'Built features for an international storefront, with copy pulled per language from the translation team’s tool',
    ],
    image: { alt: 'The Fabletics storefront homepage with a sale banner and product category tiles' },
    stack: ['Next.js', 'NestJS'],
  },
  {
    id: '10x-ventures',
    employer: '10x Ventures',
    title: 'Full Stack Engineer',
    dates: 'September 2021 – June 2023',
    bullets: [
      'Built the MVP for a social platform for people building in public, end to end, from schema to shipped interface',
      'Designed the database schema and the backend APIs (Node.js, Express); built the React/Redux frontend against them',
    ],
    image: { alt: 'The 10x Ventures homepage for overseas hiring, with a headline and a booking button' },
    stack: ['React', 'Redux', 'Node.js', 'Express'],
  },
];

/** "June 2025 – March 2026" -> "2025–2026"; a one-year range -> "2026". */
export const years = (dates: string) => [...new Set(dates.match(/\d{4}/g) ?? [])].join('–');

/** Where a role's screenshot is served; the same shape as `crop()` in `spokes.ts`. */
export const roleImage = (id: string) => ({
  avif: `/roles/${id}.avif`,
  png: `/roles/${id}.png`,
});

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
 * A separator starting a line reads as a bullet, which is the sort of thing
 * that looks like a rendering bug rather than a wrap. On a 390px phone in
 * production a plain join gave
 *
 *     Tawk.to · Acudeen
 *     · freelance
 *
 * and it only shows at the widths where the line is long enough to turn, which
 * is why it survived every desktop look and had to be caught in a phone
 * screenshot.
 *
 * The mechanism was written out here until 2026-08-11, when the hero gained a
 * stack line that needed the same treatment and it became the third copy. It
 * lives in `typeset.ts` now, which carries the reasoning; this is a caller.
 */
export const EARLIER_LINE = bindSeparators(EARLIER.employers.join(SEP));
