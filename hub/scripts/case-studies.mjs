/**
 * Generate the five case-study pages.
 *
 * Each spoke's write-up lives at `../<spoke>/CASE-STUDY.md`, in that spoke's
 * own directory beside this one. This script reads them at build time and
 * emits `work/<spoke>/index.html`, which Vite then treats as an ordinary
 * multi-page entry — so the pages share the homepage's stylesheet pipeline,
 * its content-hashed fonts and its deploy.
 *
 * That read crossed a *repository* boundary until the six spokes were merged
 * into one repo, and this file used to say so at length. The path resolution
 * below did not change by a character, because the invariant it rests on was
 * never "hub is a repository root" — it is "hub/ sits beside the five", which
 * is why the flat top-level layout was chosen over an `apps/` prefix.
 *
 * Why a script and not a Vite plugin. `transformIndexHtml` cannot *create* the
 * five entries; it only transforms HTML that already exists, so a plugin would
 * still need five files on disk and a way to keep their metadata in step. More
 * to the point, `../tallow/CASE-STUDY.md` is outside the project root, outside
 * the module graph, unwatched and not part of any invalidation — doing that
 * read inside a bundler hook would smuggle a dependency Vite cannot see into a
 * place that looks like it understands dependencies. A script is honest about
 * being five `readFileSync` calls on paths that may not exist, and it fails
 * before Vite starts rather than inside a rollup stack trace.
 *
 * It follows the shape `scripts/brand.sh` and `scripts/brand/*.html` already
 * established here: authored HTML in `scripts/`, a runnable step that turns it
 * into build output.
 *
 * Run by `prebuild` and `predev`, so neither entry point depends on anybody
 * remembering. `npm run cases` runs it alone.
 *
 * Usage: node scripts/case-studies.mjs
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderCaseStudy } from './case-study/render.mjs';
import { checkDisclosure } from './case-study/policy.mjs';

/*
 * The spoke list comes from the same file the homepage renders from, so the
 * index and the case studies cannot disagree about what the work is, and
 * adding a sixth spoke is one edit rather than three.
 *
 * Node has stripped types since 22.18, so a `.mjs` can import a `.ts` directly
 * — no regex-parsing, no duplicate JSON, no build step of its own. This is
 * strictly better than the `choreography.ts` read in `verify.mjs`, which pulls
 * two scalars out with a regex: that is defensible for a number, and would not
 * be for an array of objects whose strings contain apostrophes.
 */
const { SPOKES, repoLabel } = await import('../src/spokes.ts').catch((err) => {
  throw new Error(
    `Could not import src/spokes.ts (node ${process.version}).\n` +
      `This script relies on Node's built-in TypeScript type stripping,\n` +
      `unflagged since 22.18. Upgrade Node.\n\n${err.message}`,
  );
});

const root = (p) => fileURLToPath(new URL(p, import.meta.url));
const TEMPLATE = readFileSync(root('./case-study/page.html'), 'utf8');
const OUT = root('../work');

/** HTML-escape a value going into an attribute. */
const attr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escape for a text node. Same minus the quote. */
const text = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Read one spoke's case study, or fail with something a person can act on.
 *
 * This is the failure the whole design has to get right. Publishing four pages
 * of five and saying nothing would be the worst available outcome — the
 * homepage would link to a URL that does not exist, and the deploy would be
 * green.
 *
 * It used to be likelier than it is now: the six were separate repositories,
 * so a fresh checkout of the hub alone had none of the five beside it and this
 * error was the only thing standing between that and a half-published site.
 * One repository makes the files arrive together, so the remaining ways to
 * reach here are a build run from the wrong directory or a spoke added to
 * `spokes.ts` before its write-up exists. Both still deserve a name and a path.
 */
function readSource(spoke) {
  const url = new URL(`../../${spoke.id}/CASE-STUDY.md`, import.meta.url);
  let markdown;
  try {
    markdown = readFileSync(url, 'utf8');
  } catch {
    throw new Error(
      `no CASE-STUDY.md for "${spoke.id}"\n` +
        `  expected at: ${fileURLToPath(url)}\n\n` +
        `The hub reads each spoke's case study from a sibling directory at build\n` +
        `time — ${spoke.id}/ must sit beside hub/. Check you are building from\n` +
        `hub/ inside the monorepo, and that ${spoke.id}/CASE-STUDY.md exists.`,
    );
  }

  // Two cheap shape checks, because a truncated or half-written file would
  // otherwise render as a short, tidy, entirely wrong page.
  if (!markdown.trimStart().startsWith('# ')) {
    throw new Error(`${spoke.id}: CASE-STUDY.md does not open with an H1`);
  }
  if (markdown.length < 2000) {
    throw new Error(`${spoke.id}: CASE-STUDY.md is only ${markdown.length} bytes — truncated?`);
  }

  // The disclosure rule, enforced before anything is written. `verify.mjs`
  // checks the same thing against the real DOM at deploy time; this one just
  // makes the failure earlier and cheaper. Both import `policy.mjs`, so they
  // cannot drift into disagreeing about what the rule is.
  const wrong = checkDisclosure(markdown);
  if (wrong) {
    throw new Error(
      `${spoke.id}: the AI-scaffold disclosure is missing or too thin.\n` +
        `  ${wrong}\n\n` +
        `Every case study states plainly that the spoke began as a generated\n` +
        `scaffold — see positioning-brief.md. The argument the portfolio makes\n` +
        `depends on it. scripts/case-study/policy.mjs is the rule.`,
    );
  }

  return markdown;
}

/** The "other four" list at the foot of each page. */
function others(self) {
  return SPOKES.filter((s) => s.id !== self.id)
    .map(
      (s) =>
        `          <li class="cs-others-row">\n` +
        `            <a class="cs-others-link" href="/work/${s.id}/">\n` +
        `              <span class="cs-others-name">${text(s.name)}</span>\n` +
        `              <span class="cs-others-line mono">${text(s.line)}</span>\n` +
        `            </a>\n` +
        `          </li>`,
    )
    .join('\n');
}

/*
 * Clear first, the same discipline `deploy.sh`'s `rsync --delete` applies
 * remotely. Without it a renamed spoke leaves its old page behind in `work/`,
 * where it is invisible — not an entry, so never built, so never noticed.
 */
rmSync(OUT, { recursive: true, force: true });

for (const spoke of SPOKES) {
  const markdown = readSource(spoke);
  const canonical = `https://kimnejudne.dev/work/${spoke.id}/`;

  /*
   * Everything on the page that is not prose comes from `spokes.ts`, never
   * from the markdown. That is not tidiness — nothing is reliably derivable
   * from the source. The five H1s disagree about case (`PLINTH — case study`
   * is lowercase where the others are not), only three of the five carry a
   * "Live at" line and all three shape it differently, and TALLOW has none at
   * all. `spokes.ts` carries the canonical display names and the canonical
   * URLs; the prose carries the argument.
   *
   * `s.line` doubles as the meta description deliberately: it is already the
   * line the homepage index shows for this same link, so the search result and
   * the page that links to it agree by construction rather than by memory.
   */
  const html = TEMPLATE.replaceAll('{{ID}}', attr(spoke.id))
    /*
     * The card's alt text is built from the same `s.line` the card is *set*
     * with, so the picture and its description cannot drift. Written as a
     * sentence rather than a label because a screen reader reads it aloud and
     * a scraper shows it when the image fails to load.
     */
    .replaceAll(
      '{{CARD_ALT}}',
      attr(
        `A case-study card on cream paper: the name ${spoke.name} set in a Didone serif, ` +
          `the line "${spoke.line}" beneath it, and a screenshot of the ${spoke.name} site framed beside it.`,
      ),
    )
    .replaceAll('{{TITLE}}', attr(`${spoke.name} — Case Study · Kim Nejudne`))
    .replaceAll('{{DESCRIPTION}}', attr(spoke.line))
    .replaceAll('{{CANONICAL}}', attr(canonical))
    .replaceAll('{{HREF}}', attr(spoke.href))
    .replaceAll('{{HOST}}', text(new URL(spoke.href).host))
    .replaceAll('{{REPO}}', attr(spoke.repo))
    /*
     * `portfolio/forme` — the repository name and the directory inside it,
     * rather than the whole pathname.
     *
     * This used to be the full pathname, which was fine while that meant the
     * `kim-nejudne/forme` shorthand and each spoke was its own repository. The
     * six are one repository now and the pathname is
     * `kim-nejudne/portfolio/tree/main/poketrack` — 41 characters. This row is
     * mono inside a 350px column at 390px wide, and the *old* full URL was
     * measured at about 339px of that 350, fitting by nine pixels; the new
     * pathname is longer again, so equality with the pathname is no longer
     * available at any width.
     *
     * The label is therefore no longer the pathname, but it is still derived
     * from the href rather than written by hand, which is the property that
     * was ever worth having: the label cannot advertise one destination while
     * the href points at another. `verify.mjs` asserts that derivation instead
     * of string equality.
     */
    .replaceAll('{{REPO_LABEL}}', text(repoLabel(spoke.repo)))
    .replaceAll('{{OTHERS}}', others(spoke))
    .replaceAll('{{BODY}}', renderCaseStudy(markdown));

  /*
   * A provenance line, because the hub's build now depends on five sibling
   * working trees at commits nothing records. When a published page looks
   * stale, this turns "which version shipped?" into a question view-source can
   * answer.
   */
  const stamp =
    `<!-- generated by scripts/case-studies.mjs from ${spoke.id}/CASE-STUDY.md` +
    ` — ${markdown.length} bytes, sha256 ${createHash('sha256').update(markdown).digest('hex').slice(0, 12)} -->\n`;

  mkdirSync(new URL(`../work/${spoke.id}/`, import.meta.url), { recursive: true });
  writeFileSync(root(`../work/${spoke.id}/index.html`), stamp + html, 'utf8');
  console.log(`  work/${spoke.id}/index.html  ← ${spoke.id}/CASE-STUDY.md (${markdown.length} bytes)`);
}

console.log(`${SPOKES.length} case studies generated`);
