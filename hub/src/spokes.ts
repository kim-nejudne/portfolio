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
   * The case studies are written and live in each spoke's repository, but none
   * of them is published to a URL yet. The card renders this link only when it
   * exists, because a dead "Case study" link on the homepage is worse than no
   * link at all.
   */
  readonly caseStudy?: string;
};

export const SPOKES: readonly Spoke[] = [
  {
    id: 'tallow',
    name: 'Tallow',
    line: 'Dry-aged, live fire, and an 86 board wired to the kitchen.',
    href: 'https://tallow.kimnejudne.dev/',
  },
  {
    id: 'plinth',
    name: 'Plinth',
    line: 'Sixteen weeks of strength, told entirely in type. No photography anywhere.',
    href: 'https://plinth.kimnejudne.dev/',
  },
  {
    id: 'forme',
    name: 'Forme',
    line: "A trade printer's floor. The preflight engine measures your PDF rather than trusting it.",
    href: 'https://forme.kimnejudne.dev/',
  },
  {
    id: 'poketrack',
    name: 'PokéTrack',
    line: "Project tracking that levels up. A partner's whole state is a sum of XP events.",
    href: 'https://poketrack.kimnejudne.dev/',
  },
  {
    id: 'suki',
    name: 'Suki',
    line: "A neighbourhood shop's ledger. Works with no signal, and the sums cannot disagree.",
    href: 'https://suki.kimnejudne.dev/',
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
