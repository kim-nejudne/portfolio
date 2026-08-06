/**
 * Regenerates `public/og-card.png` — the image every scrape of
 * suki.kimnejudne.dev shows.
 *
 * Until this existed the page declared `twitter:card: summary_large_image` and
 * supplied no image at all, which is worse than declaring nothing: a card with
 * a named large-image layout and an empty slot renders as a broken box rather
 * than as a plain link.
 *
 * Node rather than the `brand.sh` shape PLINTH and the hub use, for one reason
 * that matters: **the figures on the card come out of `@suki/domain`**. The
 * landing page's own comment sets that rule — "every figure on this page comes
 * out of @suki/domain ... if the tingi arithmetic ever changed, this page would
 * change with it" — and a share card carrying a hand-typed ₱332 would be the
 * one surface in the spoke allowed to disagree with the ledger. It is also the
 * surface seen by the most people and the last one anybody would think to
 * check. So the balance is derived here by the same `withRunningBalance` the
 * till and the server run, and a change to the arithmetic moves the card.
 *
 * Rendered by a real browser off the real webfonts, for the same reason PLINTH
 * does it: the card is set in Instrument Sans and Martian Mono because those
 * are the app's faces, and an image library would only approximate them.
 *
 * Run from frontend/:  node scripts/brand.mjs
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = resolve(import.meta.dirname, '..');

/*
 * The CJS build, loaded through `createRequire`, not `import`.
 *
 * `@suki/domain` ships both, and its ESM output uses extensionless relative
 * specifiers — `./types` rather than `./types.js`. Vite resolves those; Node
 * does not, and `import ... from '@suki/domain'` here dies on
 * ERR_MODULE_NOT_FOUND pointing at a file that exists. The CJS entry has the
 * same functions and no such problem. Nothing about the arithmetic differs
 * between the two builds — they are the same TypeScript compiled twice.
 */
const { formatPeso, shortDate, withRunningBalance } = require('@suki/domain');

/*
 * The same specimen the landing page prints, copied from the demo shop so the
 * card, the front door and the shop all show one customer's real book. Only
 * the last four rows are shown — the balance is derived across all nine, and
 * the rest is carried forward, which is what a notebook page does.
 */
const SPECIMEN_LEDGER = [
  { id: 'l001', customerId: 'c01', kind: 'purchase', amount: 94, createdAt: '2025-07-02T10:15:00.000Z' },
  { id: 'l002', customerId: 'c01', kind: 'purchase', amount: 65, createdAt: '2025-07-05T17:20:00.000Z' },
  { id: 'l003', customerId: 'c01', kind: 'payment', amount: 159, createdAt: '2025-07-15T08:00:00.000Z', note: 'Kinsenas' },
  { id: 'l010', customerId: 'c01', kind: 'purchase', amount: 100, createdAt: '2025-08-02T09:20:00.000Z' },
  { id: 'l011', customerId: 'c01', kind: 'purchase', amount: 91, createdAt: '2025-08-09T16:00:00.000Z' },
  { id: 'l012', customerId: 'c01', kind: 'payment', amount: 100, createdAt: '2025-08-15T08:15:00.000Z', note: 'Kinsenas' },
  { id: 'l021', customerId: 'c01', kind: 'purchase', amount: 120, createdAt: '2025-09-02T08:45:00.000Z' },
  { id: 'l022', customerId: 'c01', kind: 'purchase', amount: 79, createdAt: '2025-09-05T17:10:00.000Z' },
  { id: 'l023', customerId: 'c01', kind: 'purchase', amount: 42, createdAt: '2025-09-09T18:30:00.000Z' },
];

const ROWS_SHOWN = 4;

const rows = withRunningBalance(SPECIMEN_LEDGER);
const shown = rows.slice(-ROWS_SHOWN);
const balance = rows[rows.length - 1].runningBalance;

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Resolve the two faces out of node_modules so the URLs work under the server
   below exactly as they do in the app. */
const fontUrl = (spec) => '/@fs' + require.resolve(spec).replace(/\\/g, '/');
const SANS = fontUrl('@fontsource-variable/instrument-sans/files/instrument-sans-latin-standard-normal.woff2');
const MONO = fontUrl('@fontsource/martian-mono/files/martian-mono-latin-400-normal.woff2');

const html = `<!doctype html>
<html lang="en-PH">
  <head>
    <meta charset="utf-8" />
    <title>SUKI — share card source</title>
    <style>
      @font-face {
        font-family: 'Instrument Sans Variable';
        src: url('${SANS}') format('woff2-variations');
        font-weight: 400 700;
      }
      @font-face {
        font-family: 'Martian Mono';
        src: url('${MONO}') format('woff2');
        font-weight: 400;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; }

      /* The five colours, verbatim from src/index.css. */
      body {
        background: #FBF8F0;
        color: #1C2A3A;
        font-family: 'Instrument Sans Variable', sans-serif;
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 56px;
        align-content: space-between;
        padding: 54px 64px;
      }

      .head { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: baseline; }
      .wordmark { font-size: 40px; font-weight: 700; letter-spacing: 0.18em; }
      .locale {
        font-family: 'Martian Mono', monospace;
        font-size: 15px; letter-spacing: 0.12em; text-transform: uppercase; color: #6E6A60;
      }

      .lede { font-size: 40px; line-height: 1.16; font-weight: 400; align-self: center; }
      .lede b { font-weight: 700; }
      .lede .sig { display: block; margin-top: 20px; font-size: 21px; color: #6E6A60; line-height: 1.4; }

      /* A notebook page: ruled rows, hairlines, no cards and no shadows. */
      .book { align-self: center; border-top: 2px solid #1C2A3A; }
      .cap {
        font-family: 'Martian Mono', monospace;
        font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase;
        color: #6E6A60; padding: 10px 0 12px;
      }
      .row {
        display: grid; grid-template-columns: 74px 1fr auto;
        align-items: baseline; gap: 14px;
        padding: 11px 0; border-top: 1px solid #C9C2B2;
        font-family: 'Martian Mono', monospace; font-size: 16px;
        font-variant-numeric: tabular-nums;
      }
      .date { color: #6E6A60; font-size: 13px; }
      .amt { font-size: 15px; }
      .utang { color: #A32C2C; }
      .bayad { color: #2F6B4F; }
      .bal { text-align: right; font-weight: 500; }

      .total {
        display: flex; justify-content: space-between; align-items: baseline;
        border-top: 2px solid #1C2A3A; margin-top: 4px; padding-top: 14px;
        font-family: 'Martian Mono', monospace; font-variant-numeric: tabular-nums;
      }
      .total-label { font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #6E6A60; }
      .total-amt { font-size: 30px; color: #A32C2C; }

      .foot {
        grid-column: 1 / -1; border-top: 1px solid #C9C2B2; padding-top: 16px;
        display: flex; justify-content: space-between;
        font-family: 'Martian Mono', monospace;
        font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #6E6A60;
      }
    </style>
  </head>
  <body>
    <div class="head">
      <div class="wordmark">SUKI</div>
      <div class="locale">Dumaguete · Negros Oriental</div>
    </div>

    <div class="lede">
      The <b>lista</b>, the <b>tingi</b> and the day&rsquo;s takings &mdash; for a sari-sari store.
      <span class="sig">Works with no signal. The book is the record, and it cannot be rewritten.</span>
    </div>

    <div class="book">
      <div class="cap">Aling Bebang Ramirez &mdash; Purok Mabini</div>
      ${shown
        .map(
          (r) => `<div class="row">
        <span class="date">${esc(shortDate(r.createdAt))}</span>
        <span class="amt ${r.kind === 'payment' ? 'bayad' : 'utang'}">${
          r.kind === 'payment' ? 'Bayad' : 'Utang'
        } ${esc(formatPeso(r.amount))}</span>
        <span class="bal">${esc(formatPeso(r.runningBalance))}</span>
      </div>`,
        )
        .join('\n      ')}
      <div class="total">
        <span class="total-label">Balance</span>
        <span class="total-amt">${esc(formatPeso(balance))}</span>
      </div>
    </div>

    <div class="foot">
      <span>suki.kimnejudne.dev</span>
      <span>Offline-first &middot; React &middot; NestJS</span>
    </div>
  </body>
</html>
`;

const TMP = join(ROOT, '.og-card.tmp.html');
await writeFile(TMP, html, 'utf8');

/* A static server rooted at frontend/, plus the `/@fs/<abs>` escape Vite uses,
   so the two font files resolve out of the workspace root's node_modules. */
const TYPES = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = url.startsWith('/@fs/') ? '/' + url.slice(5) : join(ROOT, normalize(url));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const CHROME = ['chromium', 'chromium-browser', 'google-chrome-stable'].find((c) => {
  try {
    return require('node:child_process').execSync(`command -v ${c}`, { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return false;
  }
});
if (!CHROME) {
  await unlink(TMP);
  server.close();
  throw new Error('no chromium on PATH');
}

await new Promise((res, rej) => {
  const p = spawn(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--screenshot=' + join(ROOT, 'public/og-card.png'),
      '--window-size=1200,630',
      `http://127.0.0.1:${PORT}/.og-card.tmp.html`,
    ],
    { stdio: 'ignore' },
  );
  p.on('exit', (code) => (code === 0 ? res() : rej(new Error('chromium exited ' + code))));
});

await unlink(TMP);
server.close();

console.log(`  public/og-card.png  — Aling Bebang at ${formatPeso(balance)}, derived from @suki/domain`);
