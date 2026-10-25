/**
 * The three ideas.
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
   * directory; `scripts/case-studies.mjs` reads them from the siblings at
   * build time and renders them into this site, so the three are set in one
   * type and read as one voice rather than as three more art directions.
   *
   * Those five were separate repositories until the six were merged, and that
   * read genuinely crossed a repo boundary. It is an ordinary sibling read
   * now, which is exactly why `case-studies.mjs` needed no change: the
   * invariant it rests on was never "hub is a repository root", it was
   * "hub/ sits beside the five", and that is still true.
   *
   * Optional, and the card still renders the link only when it is set — a dead
   * "Case study" link on the homepage is worse than no link at all. It is not
   * optional in practice any more: `verify.mjs` fetches every one of these and
   * fails the deploy unless it comes back as that spoke's own page, and
   * `deploy.sh` refuses to ship a build that is missing any of them.
   */
  readonly caseStudy?: string;
  /**
   * The public source, on GitHub.
   *
   * All six repositories were private until 2026-08-06, which made the one
   * GitHub link on this site — in `Colophon.tsx` — an argument against the
   * page carrying it: it pointed at a profile whose visible work was four
   * React concept projects from 2025. `positioning-brief.md` rests its first
   * differentiator on "real engineering depth", and the only evidence offered
   * for it showed the opposite.
   *
   * Linking the source from the case study rather than only from the profile
   * is the stronger placement. Someone who has just read why the preflight
   * engine measures a PDF instead of trusting it is one click from the code
   * that measures it; a profile link asks them to go and find it.
   *
   * These were six repository roots until the merge and are now directories
   * inside one, so each is a `/tree/main/<id>` deep link. The label rendered
   * from it is NOT the URL pathname any more — see the note in
   * `scripts/case-studies.mjs`, where the width is measured. GitHub answers an
   * anonymous request for a private repository with 404 rather than 403, and a
   * `/tree/` path on a public repository answers 200, so the assertion still
   * catches the repository going dark.
   *
   * Required, unlike `caseStudy`. A spoke with no public source has nothing to
   * say here, and `verify.mjs` fetches every one of these.
   */
  readonly repo: string;
};

/**
 * The order here is the running order everywhere.
 *
 * Nothing reads a spoke by position: `Showcase` numbers the cards off the
 * index, `Index` and the `/work/` table render rows in sequence, and the
 * sitemap, the case-study pages and their asides all derive from this
 * array. So this list is the only place the sequence is stated, and moving a
 * row here moves the showcase, the index, the roster and the sitemap together.
 *
 * Kim's ordering, 2026-08-08, less FORME and SUKI, which were taken down on
 * 2026-10-25. SUKI led until then; PokéTrack inherits the first card.
 */
export const SPOKES: readonly Spoke[] = [
  {
    id: 'poketrack',
    name: 'PokéTrack',
    line: "Project tracking that levels up. A partner's whole state is a sum of XP events.",
    href: 'https://poketrack.kimnejudne.dev/',
    caseStudy: '/work/poketrack/',
    repo: 'https://github.com/kim-nejudne/portfolio/tree/main/poketrack',
  },
  {
    id: 'tallow',
    name: 'Tallow',
    line: 'Dry-aged, live fire, and an 86 board wired to the kitchen.',
    href: 'https://tallow.kimnejudne.dev/',
    caseStudy: '/work/tallow/',
    repo: 'https://github.com/kim-nejudne/portfolio/tree/main/tallow',
  },
  {
    id: 'plinth',
    name: 'Plinth',
    line: 'Sixteen weeks of strength, told entirely in type. No photography anywhere.',
    href: 'https://plinth.kimnejudne.dev/',
    caseStudy: '/work/plinth/',
    repo: 'https://github.com/kim-nejudne/portfolio/tree/main/plinth',
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

/**
 * The visible text for a `repo` link: the repository name and the directory
 * inside it, `portfolio/tallow`.
 *
 * It lives here, beside the URLs it reads, because two places need it and they
 * must not disagree: `scripts/case-studies.mjs` renders it, and `verify.mjs`
 * asserts the rendered label against it. That is the shape
 * `scripts/case-study/policy.mjs` already uses for the disclosure rule — one
 * function, imported by the generator that writes and the check that refuses
 * to ship.
 *
 * It was `new URL(repo).pathname` inline in the generator until the six
 * repositories became one. A `/tree/main/<id>` pathname is 41 characters and
 * the row it sits in is mono in a 350px column; see the measurement in
 * `case-studies.mjs`. What survives the change is the part worth keeping — the
 * label is computed from the href, so it cannot advertise a destination the
 * link does not go to.
 *
 * Falls back to the bare repository name when the URL is not a deep link, so a
 * spoke that ever goes back to having its own repository still reads sensibly
 * rather than as `tallow/tallow`.
 */
export const repoLabel = (repo: string): string => {
  const segments = new URL(repo).pathname.split('/').filter(Boolean);
  const [, name, ...rest] = segments;
  const leaf = rest[rest.length - 1];
  return leaf && leaf !== name ? `${name}/${leaf}` : name;
};
