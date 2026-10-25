/**
 * Run axe-core over every page in the portfolio, including the five spokes.
 *
 * ## Why this exists, and why it is not part of `verify.mjs`
 *
 * `verify.mjs` is the hub's deploy gate. It knows the hub's DOM intimately and
 * asserts things no generic tool could: that the head is hidden from assistive
 * technology, that the cards never land on the same coordinate, that every
 * painted colour is a blend of paper and ink. It is a hundred and nineteen
 * claims about *this* page.
 *
 * This is the opposite: one generic rule set, over six origins this repository
 * does not otherwise test together. The spokes have their own frameworks, their
 * own palettes and their own build systems, and adding six unrelated apps to the
 * hub's deploy gate would couple a deploy to five servers being up.
 *
 * So it is a **report, not a gate**. It exits 0 whatever it finds. The thing it
 * replaces is a line in `positioning-brief.md` that said "axe sweep" and stayed
 * open for weeks because running one meant remembering how.
 *
 * ## The finding that prompted it
 *
 * The hub failed. `--color-muted` was `#6f727a` = 4.37:1 on paper, against AA's
 * 4.5, in 33 places on the homepage and 12 on every case study. It had been
 * wrong since the palette was written, on a site whose craft bar says accessible,
 * and the one-colour rule assertion passed it green every time because that rule
 * is about hue and has nothing to say about legibility.
 *
 * The lesson generalises past the colour: a machine-checked *design* rule is not
 * a machine-checked *accessibility* rule, and this repository had the first and
 * assumed it covered the second.
 *
 * ## What it cannot see
 *
 * Automated rules catch something like a third of real accessibility defects.
 * A clean run here is not an accessible site; it is a site with no *automatable*
 * violations. Keyboard order, focus management, whether an alt text is
 * *accurate* rather than merely present, and whether a screen reader can
 * actually complete a task all remain hand work, and are still open on all six.
 *
 * It also only reaches what a cold visitor reaches. Three spokes put their real
 * application behind a sign-in or a PIN, and those pages are listed as UNSWEPT
 * at the end rather than quietly omitted, because "no violations found" over
 * half a product is the kind of green that is worse than a red.
 *
 * Usage:
 *   node scripts/axe.mjs               # the hub, its work pages, and five spokes
 *   node scripts/axe.mjs <url> [...]   # specific pages
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { SPOKES } from '../src/spokes.ts';
import { chromiumPath } from './chromium.mjs';

const require = createRequire(import.meta.url);
/* Read off disk rather than fetched from a CDN. A sweep whose rule set changes
   silently between runs cannot be compared with the last one, and this is
   pinned in package.json like everything else. */
const AXE_SOURCE = require('node:fs').readFileSync(require.resolve('axe-core'), 'utf8');
const AXE_VERSION = require('axe-core/package.json').version;

const ORIGIN = 'https://kimnejudne.dev';
const PORT = 9337;

/* The hub's own pages, then one landing page per spoke. Derived from `SPOKES`
   so a sixth spoke joins the sweep without anybody remembering. */
const TARGETS =
  process.argv.length > 2
    ? process.argv.slice(2)
    : [
        ORIGIN + '/',
        ORIGIN + '/work/',
        ...SPOKES.map((s) => `${ORIGIN}/work/${s.id}/`),
        ...SPOKES.map((s) => s.href),
      ];

/* Pages a cold visitor cannot reach, named so the report cannot imply it swept
   a whole product when it swept a front door. */
const UNSWEPT = [
  'forme: the portal, prepress queue and press board (sign-in)',
  'poketrack: every team view (sign-in)',
  'suki: the till, lista and stock (PIN)',
  'tallow: the admin, inventory and 86 board (sign-in)',
];

let nextId = 1;
const rpc = (ws, method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    const onMessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });

const chrome = spawn(
  chromiumPath(),
  [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/hub-axe-profile',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let failures = 0;

try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      if (targets.some((t) => t.type === 'page')) break;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  await rpc(ws, 'Page.enable');
  await rpc(ws, 'Runtime.enable');
  /* The same reason `verify.mjs` gives: a headless tab reports
     `document.hasFocus() === false`, so CSS `:focus` never matches and every
     focus-visible style is invisible to any rule that looks for one. */
  await rpc(ws, 'Emulation.setFocusEmulationEnabled', { enabled: true });

  console.log(`axe-core ${AXE_VERSION}, ${TARGETS.length} pages\n`);

  for (const url of TARGETS) {
    await rpc(ws, 'Page.navigate', { url });
    /* Generous, and deliberately so. Four of the five spokes are client-rendered
       and one of them animates its way in; auditing a page mid-mount reports
       violations that do not exist and misses the ones that do. */
    await sleep(3500);

    const { result, exceptionDetails } = await rpc(ws, 'Runtime.evaluate', {
      expression: `(async () => {
        ${AXE_SOURCE}
        const r = await axe.run(document, { resultTypes: ['violations'] });
        return JSON.stringify({
          title: document.title,
          passes: r.passes.length,
          incomplete: r.incomplete.length,
          violations: r.violations.map(v => ({
            id: v.id, impact: v.impact, help: v.help, n: v.nodes.length,
            where: v.nodes.slice(0, ${Number(process.env.AXE_NODES) || 4}).map(n => ({
              target: n.target.join(' '),
              why: (n.failureSummary || '').split('\\n').filter(Boolean).slice(1).join(' '),
            })),
          })),
        });
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    if (exceptionDetails) {
      console.log(`??  ${url}\n    could not audit: ${exceptionDetails.text}\n`);
      continue;
    }
    const r = JSON.parse(result.value);
    const total = r.violations.reduce((a, v) => a + v.n, 0);
    failures += total;

    const mark = total === 0 ? 'ok  ' : 'FAIL';
    console.log(`${mark} ${url}`);
    console.log(
      `     ${r.passes} rules pass, ${r.incomplete} need review, ${total} violations in ${r.violations.length} rules`,
    );
    for (const v of r.violations) {
      console.log(`     [${v.impact}] ${v.id} x${v.n} — ${v.help}`);
      for (const w of v.where) console.log(`         ${w.target}\n           ${w.why}`);
    }
    console.log('');
  }

  console.log(
    failures === 0
      ? `No automatable violations on ${TARGETS.length} pages.`
      : `${failures} violations across ${TARGETS.length} pages.`,
  );
  console.log('\nNot swept, because a cold visitor cannot reach them:');
  for (const u of UNSWEPT) console.log(`  - ${u}`);
  console.log(
    '\nAnd not answered by any of this: keyboard order, focus management,\n' +
      'whether an alt text is accurate rather than present, and whether a screen\n' +
      'reader can complete a task. Automated rules catch about a third of real\n' +
      'defects. A clean run is a floor, not a result.',
  );
} finally {
  chrome.kill();
}
