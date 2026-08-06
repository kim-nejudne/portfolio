/**
 * The five ideas.
 *
 * One line each, and the line has a job: a hook a recruiter finishes reading,
 * and a technical tell that says the thing behind it was engineered. The hub
 * is a tease, not a dead end — everything here points outward.
 */

export type Spoke = {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly href: string;
  /**
   * The write-up, at `/work/<id>/`.
   *
   * Each spoke's case study lives as `CASE-STUDY.md` in that spoke's own
   * repository; `scripts/case-studies.mjs` reads them across the repo boundary
   * at build time and renders them into this site, so the five are set in one
   * type and read as one voice rather than as five more art directions.
   *
   * Optional, and the card still renders the link only when it is set — a dead
   * "Case study" link on the homepage is worse than no link at all. It is not
   * optional in practice any more: `verify.mjs` fetches every one of these and
   * fails the deploy unless it comes back as that spoke's own page, and
   * `deploy.sh` refuses to ship a build that is missing any of the five.
   */
  readonly caseStudy?: string;
};

export const SPOKES: readonly Spoke[] = [
  {
    id: 'tallow',
    name: 'Tallow',
    line: 'Dry-aged, live fire, and an 86 board wired to the kitchen.',
    href: 'https://tallow.kimnejudne.dev/',
    caseStudy: '/work/tallow/',
  },
  {
    id: 'plinth',
    name: 'Plinth',
    line: 'Sixteen weeks of strength, told entirely in type. No photography anywhere.',
    href: 'https://plinth.kimnejudne.dev/',
    caseStudy: '/work/plinth/',
  },
  {
    id: 'forme',
    name: 'Forme',
    line: "A trade printer's floor. The preflight engine measures your PDF rather than trusting it.",
    href: 'https://forme.kimnejudne.dev/',
    caseStudy: '/work/forme/',
  },
  {
    id: 'poketrack',
    name: 'PokéTrack',
    line: "Project tracking that levels up. A partner's whole state is a sum of XP events.",
    href: 'https://poketrack.kimnejudne.dev/',
    caseStudy: '/work/poketrack/',
  },
  {
    id: 'suki',
    name: 'Suki',
    line: "A neighbourhood shop's ledger. Works with no signal, and the sums cannot disagree.",
    href: 'https://suki.kimnejudne.dev/',
    caseStudy: '/work/suki/',
  },
];

/**
 * Crops are placeholders: a headless screenshot of each live spoke, taken
 * under forced reduced motion so the page is complete and static rather than
 * mid-animation. The real crop is a curatorial choice — chosen for silhouette
 * and colour, not legibility — and it is Kim's to make. See `scripts/crops.sh`.
 */
export const crop = (id: string) => ({
  avif: `/crops/${id}.avif`,
  png: `/crops/${id}.png`,
});
