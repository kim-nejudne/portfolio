/**
 * Hold the static surfaces to `src/identity.ts`, and fail the build naming the
 * file when one has drifted.
 *
 * Six surfaces carry Kim's name, title or pitch. Two of them can import the
 * module that defines those strings and do: `src/components/Pitch.tsx` and
 * `scripts/case-study-cards.mjs`. The other four are static HTML with no module
 * system anywhere near them, so they are checked as text instead:
 *
 *   index.html                  the page head, and what every scraper reads
 *   scripts/brand/og-card.html  the 1200x630 share card, rendered by brand.sh
 *   cv/cv.html                  the typeset CV
 *   cv/placeholder.html         the CV placeholder, still what /cv.pdf renders
 *
 * A text check is weaker than an import and that is the honest trade: it can
 * tell you the words are missing, not that the layout still works. What it buys
 * is that the failure lands at `prebuild` with a filename and a diff, rather
 * than on a share card that somebody notices three weeks after it was scraped.
 *
 * ## Why this runs at prebuild rather than in verify.mjs
 *
 * `verify.mjs` drives a real browser against a served page, so it sees the two
 * HTML surfaces that get served and neither of the other two: the card template
 * is compiled to a PNG, and the CV documents are a separate build. Nothing that
 * reads pixels can read type off an image. So the words on the card are only
 * ever checkable here, before it is rendered.
 *
 * ## The sabotage trap
 *
 * `CLAUDE.md` records it: `prebuild` regenerates `public/`, so a generated
 * asset can only be sabotaged in `dist/`. It does not apply to the four files
 * here, because none of them is generated. Edit any one of them and this check
 * fails. That is the whole point, and it is worth confirming by hand rather
 * than assuming.
 */

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findBanned, flatten, isCopy, opensWithCopy } from './identity-policy.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const IDENTITY = await import('../src/identity.ts').catch((err) => {
  throw new Error(
    `Could not import src/identity.ts (node ${process.version}).\n` +
      `This script relies on Node's built-in TypeScript type stripping,\n` +
      `unflagged since 22.18. Upgrade Node.\n\n${err.message}`,
  );
});

const { NAME, TITLE, HEAD_TITLE, PITCH_LINES, PITCH_SENTENCE, PITCH_META, DESCRIPTION, OG_DESCRIPTION, OG_IMAGE_ALT } =
  IDENTITY;

/*
 * What each file has to say, where it has to say it, and nothing about how.
 *
 * Every requirement names the element it lives in and is compared *exactly*
 * against what that element contains, tags and entities normalised away.
 *
 * The first version searched each whole file for each string instead, and a
 * sabotage proved it useless: replacing the `<title>` outright passed, because
 * `og:title` a few lines down still carried the same words. A surface that
 * states the same copy twice will always hide the loss of one of them from a
 * substring search. So each one is picked out and compared on its own.
 *
 * A `pick` that matches nothing is itself a failure. If the markup is
 * restructured out from under this table, the right outcome is a build that
 * stops and names the file, not a check that quietly has nothing to compare.
 */
const SURFACES = [
  {
    file: 'index.html',
    why: 'the page head: what every search engine and link scraper reads',
    require: [
      ['<title>', /<title>([\s\S]*?)<\/title>/, HEAD_TITLE],
      ['og:title', /<meta\s+property="og:title"\s+content="([^"]*)"/, HEAD_TITLE],
      ['the description', /<meta\s+name="description"\s+content="([^"]*)"/, DESCRIPTION],
      ['og:description', /<meta\s+property="og:description"\s+content="([^"]*)"/, OG_DESCRIPTION],
      ['og:image:alt', /<meta\s+property="og:image:alt"\s+content="([^"]*)"/, OG_IMAGE_ALT],
    ],
  },
  {
    file: 'scripts/brand/og-card.html',
    why: 'the share card. Its words become pixels, so this is the only place they can be checked',
    require: [
      ['the eyebrow', /<p class="name mono">([\s\S]*?)<\/p>/, NAME],
      ['the H1', /<h1 class="line">([\s\S]*?)<\/h1>/, PITCH_SENTENCE],
      ['the evidence line', /<p class="meta mono">([\s\S]*?)<\/p>/, PITCH_META],
    ],
  },
  {
    file: 'cv/cv.html',
    why: 'the typeset CV',
    require: [
      ['the masthead name', /<h1 class="name">([\s\S]*?)<\/h1>/, NAME],
      ['the role title', /<p class="role-title">([\s\S]*?)<\/p>/, TITLE],
      /* The pitch paragraph opens with the sentence and then keeps going. */
      ['the pitch', /<p class="pitch">([\s\S]*?)<\/p>/, PITCH_SENTENCE, 'opens'],
    ],
  },
  {
    file: 'cv/placeholder.html',
    why: 'the CV placeholder, which is still what /cv.pdf renders',
    require: [
      ['the eyebrow', /<p class="name mono">([\s\S]*?)<\/p>/, `${NAME} · ${TITLE}`],
      ['the H1', /<h1 class="line">([\s\S]*?)<\/h1>/, PITCH_SENTENCE],
    ],
  },
];

const problems = [];

for (const surface of SURFACES) {
  const path = resolve(ROOT, surface.file);
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    problems.push(`${surface.file}: could not be read (${err.code ?? err.message}).\n    ${surface.why}`);
    continue;
  }

  for (const [where, pick, copy, mode] of surface.require) {
    const found = text.match(pick);
    if (!found) {
      problems.push(
        `${surface.file}: ${where} is not there at all.\n` +
          `    looked for: ${pick}\n` +
          `    ${surface.why}`,
      );
      continue;
    }
    const ok = mode === 'opens' ? opensWithCopy(found[1], copy) : isCopy(found[1], copy);
    if (!ok) {
      problems.push(
        `${surface.file}: ${where} does not match src/identity.ts.\n` +
          `    wanted: ${copy}\n` +
          `    found:  ${found[1].replace(/\s+/g, ' ').trim()}\n` +
          `    ${surface.why}`,
      );
    }
  }

  /*
   * The ban list runs over the whole file, comments included. A retired label
   * left in a comment is not shipped, but it is the thing the next person
   * copies, so it is a failure here rather than a warning.
   */
  for (const phrase of findBanned(text)) {
    problems.push(
      `${surface.file}: still contains the retired copy "${phrase}".\n` +
        `    See BANNED in scripts/identity-policy.mjs for why it is retired.`,
    );
  }
}

/*
 * `public/cv.pdf`, which is the surface this whole exercise nearly missed.
 *
 * It is a *rendered* artefact of `cv/cv.html`, not a copy of it, so bringing
 * the HTML to the new title left the shipped PDF saying the old one. It was
 * live at kimnejudne.dev/cv.pdf, linked from two buttons on the homepage,
 * and every text check in this repository looked straight past it: chromium
 * writes page text into a compressed stream, so grepping the file finds
 * nothing and passes. `cv/build.sh` already knows this and greps the *source*
 * for em dashes for exactly that reason.
 *
 * So the bytes are decoded rather than searched. `pdftotext` is poppler, which
 * FORME already shells out to, but it is not a dependency of this repository
 * and the build must not fail on a machine that lacks it. When it is missing
 * this reports SKIPPED with the reason, which is the same doctrine FORME's
 * preflight engine uses for the three checks it cannot really perform: a
 * stated skip is honest, a silent pass is not.
 *
 * ## Two things this got wrong before it worked
 *
 * **`-layout` is not optional.** Default `pdftotext` reflows into reading
 * order, and the masthead is two columns with a heavily letter-spaced title:
 * `DESIGN ENGINEER` came out as the word `DESIGN` on one line and `ENGINEER`
 * eleven lines later with four contact details in between, so the ban list
 * could never see the phrase. Sabotage caught it. `-layout` keeps the visual
 * rows and the two words land adjacent.
 *
 * **The title check has to outrank the pitch.** `Senior full-stack engineer` is
 * also the first four words of the pitch paragraph, so a bare substring search
 * for the title passes on a document whose masthead has been deleted outright.
 * The masthead precedes the pitch, so the title is required to appear *before*
 * it. That is the difference between checking the title is on the page and
 * checking the page still has a title.
 */
let pdfNote = null;
{
  const pdf = resolve(ROOT, 'public/cv.pdf');
  let text = null;
  try {
    text = execFileSync('pdftotext', ['-layout', '-f', '1', '-l', '1', pdf, '-'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    pdfNote =
      err.code === 'ENOENT'
        ? 'public/cv.pdf SKIPPED: pdftotext (poppler-utils) is not installed'
        : `public/cv.pdf SKIPPED: could not be read (${err.code ?? err.message})`;
  }
  if (text !== null) {
    const flat = flatten(text);
    const banned = findBanned(text);
    const titleAt = flat.indexOf(flatten(TITLE));
    const pitchAt = flat.indexOf(flatten(PITCH_SENTENCE));
    if (banned.length) {
      problems.push(
        `public/cv.pdf: still contains the retired copy "${banned.join('", "')}".\n` +
          `    The PDF is rendered from cv/cv.html and does not update with it.\n` +
          `    Rebuild it:  bash cv/build.sh`,
      );
    } else if (titleAt === -1 || (pitchAt !== -1 && titleAt >= pitchAt)) {
      problems.push(
        `public/cv.pdf: the masthead does not carry the title "${TITLE}".\n` +
          `    ${titleAt === -1 ? 'It is not in the page 1 text at all.' : 'It appears only inside the pitch paragraph.'}\n` +
          `    The PDF is rendered from cv/cv.html and does not update with it.\n` +
          `    Rebuild it:  bash cv/build.sh`,
      );
    } else {
      pdfNote = 'public/cv.pdf carries the current title in its masthead';
    }
  }
}

/*
 * The identity module is checked against itself, last. `HEAD_TITLE` is what
 * goes in a `<title>` and an `og:title`, and `hub/cv/content.md:12-17` bans em
 * dashes across the CV with a grep that never reached the page head — which is
 * exactly where two of them were living. This closes that gap at the source
 * rather than by grepping `index.html`, whose prose comments legitimately use
 * the mark.
 */
for (const [name, value] of Object.entries(IDENTITY)) {
  if (typeof value !== 'string') continue;
  if (value.includes('—')) {
    problems.push(
      `src/identity.ts: ${name} contains an em dash.\n` +
        `    Kim's rule, and cv/content.md:12-17 already enforces it on the CV.\n` +
        `    The separator on this site is a middot.`,
    );
  }
}

if (problems.length) {
  console.error(
    `\nidentity-check: ${problems.length} problem${problems.length === 1 ? '' : 's'}.\n\n` +
      problems.map((p) => `  ${p}`).join('\n\n') +
      `\n\nsrc/identity.ts is the source. Edit it, then bring these files to match.\n` +
      `The share card and the case-study cards must be re-rendered afterwards:\n` +
      `  bash scripts/brand.sh && npm run cards\n`,
  );
  process.exit(1);
}

console.log(
  `identity-check: ${SURFACES.length} static surfaces agree with src/identity.ts` +
    (pdfNote ? `\nidentity-check: ${pdfNote}` : ''),
);
