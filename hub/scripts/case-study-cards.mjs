/**
 * Generate `public/cards/<spoke>.png` — one share card per case study.
 *
 * All five pages declared the *hub's* card until now, so a link to the FORME
 * write-up and a link to the SUKI write-up previewed as the same picture of
 * Kim's head. Five different arguments, one image.
 *
 * **In the hub's frame, not the spoke's**, and that is the whole design
 * decision. The case studies are hosted here rather than on each spoke's
 * subdomain for a stated reason — `hub-brief.md`: five write-ups in five art
 * directions would read as five more spokes, where five in one paper-and-ink
 * frame reads as a curator with five subjects. A card borrowed from the spoke
 * would undo exactly that. So every card is paper, ink, Bodoni Moda and IBM
 * Plex Mono, and the only colour on it is that spoke's own crop — which is
 * precisely the exception the one colour rule already carves out.
 *
 * It also has to be same-origin. `verify.mjs` requires `og:image` to sit on the
 * canonical origin, so pointing these at `poketrack.kimnejudne.dev/og-card.png`
 * was never an option even before the argument above.
 *
 * Node rather than extending `brand.sh`, because the card varies per spoke and
 * the data is in `src/spokes.ts`. Same shape as SUKI's `brand.mjs`.
 *
 * Run by `prebuild`, and `npm run cards` runs it alone.
 *
 * Usage: node scripts/case-study-cards.mjs
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFile, statSync } from 'node:fs';
import { readFile as read, unlink, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromiumPath } from './chromium.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const { SPOKES } = await import('../src/spokes.ts').catch((err) => {
  throw new Error(
    `Could not import src/spokes.ts (node ${process.version}).\n` +
      `This script relies on Node's built-in TypeScript type stripping,\n` +
      `unflagged since 22.18. Upgrade Node.\n\n${err.message}`,
  );
});

/*
 * The rail on every one of these five cards names Kim, so it is a tenth
 * surface for the title and it drifted for exactly as long as the others did.
 * Importing beats checking: these two strings now cannot disagree with the
 * homepage, and `identity-check.mjs` only has to police the files that have no
 * way to import.
 */
const { NAME, TITLE } = await import('../src/identity.ts').catch((err) => {
  throw new Error(
    `Could not import src/identity.ts (node ${process.version}).\n` +
      `This script relies on Node's built-in TypeScript type stripping,\n` +
      `unflagged since 22.18. Upgrade Node.\n\n${err.message}`,
  );
});

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/*
 * A missing crop must stop the build rather than produce a card with a hole in
 * it. `crops.sh` writes these and `verify.mjs` checks them, but this script
 * runs before either has a say and a broken <img> renders as blank paper —
 * which looks deliberate on a page whose art direction is blank paper.
 */
for (const s of SPOKES) {
  const crop = join(ROOT, 'public/crops', `${s.id}.png`);
  if (!existsSync(crop)) {
    throw new Error(
      `no crop for "${s.id}"\n  expected at: ${crop}\n\n` +
        `Card generation needs public/crops/<id>.png. Run \`npm run crops\` first.`,
    );
  }
}

const page = (spoke) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${esc(spoke.name)} — case-study card source</title>
    <style>
      /* The page's own two faces, from src/fonts/ — the same files the site
         serves, so the card cannot drift from the type it describes. */
      @font-face {
        font-family: 'Bodoni Moda';
        font-weight: 400 900;
        src: url('/src/fonts/bodoni-moda-latin-wght-normal.woff2') format('woff2-variations');
      }
      @font-face {
        font-family: 'Bodoni Moda';
        font-weight: 400 900;
        font-style: italic;
        src: url('/src/fonts/bodoni-moda-latin-wght-italic.woff2') format('woff2-variations');
      }
      @font-face {
        font-family: 'IBM Plex Mono';
        font-weight: 400;
        src: url('/src/fonts/ibm-plex-mono-latin-400-normal.woff2') format('woff2');
      }

      :root {
        --paper: #f7f4ec;
        --ink: #16181d;
        --muted: #6d7078;
        --rule: #d9d4c8;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        width: 1200px;
        height: 630px;
        overflow: hidden;
        background: var(--paper);
        color: var(--ink);
        padding: 54px 64px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        -webkit-font-smoothing: antialiased;
      }

      .mono {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 15px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .rail {
        display: flex;
        justify-content: space-between;
        color: var(--muted);
        border-bottom: 1px solid var(--rule);
        padding-bottom: 16px;
      }
      .rail strong { color: var(--ink); font-weight: 400; }

      .body {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 516px;
        gap: 56px;
        align-items: center;
      }

      h1 {
        font-family: 'Bodoni Moda', Georgia, serif;
        font-weight: 500;
        font-size: 78px;
        line-height: 0.98;
        letter-spacing: -0.005em;
      }

      .line {
        font-family: 'Bodoni Moda', Georgia, serif;
        font-style: italic;
        font-weight: 400;
        font-size: 25px;
        line-height: 1.34;
        color: var(--muted);
        margin-top: 22px;
        max-width: 30ch;
      }

      /*
        The crop, framed exactly as .card-frame frames it on the homepage: a
        paper mount, a hairline, and one soft shadow. It is the only colour on
        the card, which is the one colour rule's own exception rather than a
        break from it.

        (No backticks anywhere below this line. This is inside a template
        literal, and one in a CSS comment closes the string — which is how the
        first run of this script failed.)
      */
      .frame {
        background: var(--paper);
        padding: 7px;
        box-shadow: 0 0 0 1px var(--rule), 0 22px 34px -26px rgb(22 24 29 / 0.6);
      }
      .frame img {
        display: block;
        width: 100%;
        aspect-ratio: 3 / 2;
        object-fit: cover;
      }

      .foot {
        display: flex;
        justify-content: space-between;
        color: var(--muted);
        border-top: 1px solid var(--rule);
        padding-top: 16px;
      }
    </style>
  </head>
  <body>
    <div class="rail mono">
      <span><strong>${esc(NAME)}</strong> &middot; ${esc(TITLE)}</span>
      <span>Case study</span>
    </div>

    <div class="body">
      <div>
        <h1>${esc(spoke.name)}</h1>
        <p class="line">${esc(spoke.line)}</p>
      </div>
      <div class="frame">
        <img src="/public/crops/${spoke.id}.png" alt="" />
      </div>
    </div>

    <div class="foot mono">
      <span>kimnejudne.dev/work/${esc(spoke.id)}</span>
      <span>How it was built, and what it cost</span>
    </div>
  </body>
</html>
`;

/* Static server rooted at the hub directory, so `/src/fonts/...` and
   `/public/crops/...` resolve exactly as they do for `brand.sh`. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.css': 'text/css',
};
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = join(ROOT, normalize(url));
  try {
    const body = await read(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// Resolved by `scripts/chromium.mjs`, which this file used to do for itself.
// The same list lived here, in `brand.sh` and in `cv/build.sh`, while
// `verify.mjs` and `axe.mjs` hardcoded `chromium` and so were the two scripts
// that could not run on a CI runner, which is the one place they most need to.
let CHROME;
try {
  CHROME = chromiumPath();
} catch (e) {
  server.close();
  throw e;
}

mkdirSync(join(ROOT, 'public/cards'), { recursive: true });

for (const spoke of SPOKES) {
  const tmp = join(ROOT, `.card-${spoke.id}.tmp.html`);
  await writeFile(tmp, page(spoke), 'utf8');

  await new Promise((res, rej) => {
    const p = spawn(
      CHROME,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-color-profile=srgb',
        `--screenshot=${join(ROOT, 'public/cards', `${spoke.id}.png`)}`,
        '--window-size=1200,630',
        `http://127.0.0.1:${PORT}/.card-${spoke.id}.tmp.html`,
      ],
      { stdio: 'ignore' },
    );
    p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`chromium exited ${code}`))));
  });

  await unlink(tmp);
  const kb = Math.round(statSync(join(ROOT, 'public/cards', `${spoke.id}.png`)).size / 1024);
  console.log(`  public/cards/${spoke.id}.png  (${kb}KB)`);
}

server.close();
console.log(`${SPOKES.length} case-study cards generated`);
