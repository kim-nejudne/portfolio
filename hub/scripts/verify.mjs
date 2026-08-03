/**
 * Assertions about the built page, run in a real browser.
 *
 * These are the claims the brief makes that a stylesheet cannot demonstrate:
 * that reduced motion builds no timeline at all rather than a quieter one,
 * that the work is reachable without the performance running, that the head
 * and the showcase are both invisible to a screen reader while the index is a
 * real list of real links, that nothing tabbable is buried inside an
 * `aria-hidden` subtree, and that layer promotion is released when the section
 * is not pinned.
 *
 * Each one is written to fail loudly. A check that cannot fail is decoration.
 *
 * Usage: node scripts/verify.mjs [url]
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_ARG = process.argv[2] ?? 'http://localhost:4501/';
const PORT = 9336;

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

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function main() {
  const chrome = spawn(
    'chromium',
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${PORT}`,
      '--user-data-dir=/tmp/hub-verify-profile',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

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

    const ev = async (expression) => {
      const { result, exceptionDetails } = await rpc(ws, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (exceptionDetails) {
        throw new Error(
          `${exceptionDetails.text} ${exceptionDetails.exception?.description ?? ''}`.trim(),
        );
      }
      return result.value;
    };

    const load = async ({ reduce, width = 1440, height = 900 }) => {
      await rpc(ws, 'Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
      });
      await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 500,
      });
      await rpc(ws, 'Page.navigate', { url: URL_ARG });
      await sleep(2200);
    };

    /* ---- semantics -------------------------------------------------- */

    await load({ reduce: false });

    check(
      'the head is hidden from assistive technology',
      await ev(`document.querySelector('.head').getAttribute('aria-hidden') === 'true'`),
    );

    check(
      'every head layer image has an empty alt',
      await ev(`[...document.querySelectorAll('.layer')].every(i => i.getAttribute('alt') === '')`),
    );

    const links = await ev(
      `JSON.stringify([...document.querySelectorAll('.index-list > li > a.index-link')]
         .map(a => ({ name: a.textContent.replace(/\\s+/g,' ').trim().slice(0, 24), href: a.getAttribute('href') })))`,
    );
    const parsed = JSON.parse(links);
    check(
      'the index is a list of five links with real names',
      parsed.length === 5 && parsed.every((l) => l.name.length > 3 && /^https:\/\//.test(l.href)),
      `${parsed.length} links`,
    );

    check(
      'no dead case-study links are rendered',
      await ev(
        `[...document.querySelectorAll('.index-aside')].every(a => (a.getAttribute('href')||'').length > 0)`,
      ),
    );

    /*
     * The showcase duplicates those five links as a visual performance, so it
     * is hidden from assistive technology — which is only legitimate if
     * nothing inside it is in the tab order. That is axe's `aria-hidden-focus`
     * rule, and it is the exact trade being made here, so it gets asserted
     * rather than assumed.
     */
    check(
      'the showcase is hidden from assistive technology',
      await ev(`document.querySelector('.showcase').getAttribute('aria-hidden') === 'true'`),
    );

    check(
      'nothing tabbable is buried inside an aria-hidden subtree',
      await ev(`(() => {
        const sel = 'a[href], button, input, select, textarea, [tabindex]';
        for (const el of document.querySelectorAll('[aria-hidden="true"]')) {
          for (const f of el.querySelectorAll(sel)) {
            if ((f.getAttribute('tabindex') ?? '0') !== '-1') return false;
          }
        }
        return true;
      })()`),
    );

    /* ---- the animated branch ---------------------------------------- */

    check('the section pins', await ev(`!!document.querySelector('.pin-spacer')`));
    check(
      'the showcase renders only once the timeline claims the stage',
      await ev(`(() => {
        const stage = document.querySelector('.stage');
        const showcase = document.querySelector('.showcase');
        const shown = getComputedStyle(showcase).display !== 'none';
        stage.removeAttribute('data-ready');
        const hidden = getComputedStyle(showcase).display === 'none';
        stage.setAttribute('data-ready', '');
        return shown && hidden;
      })()`),
    );
    /*
     * "One at a time" is the whole point of the sequence, so it gets walked
     * rather than spot-checked. Sample the showcase range and count the cards
     * that are actually *readable* — fully opaque and visible. Two may share
     * the screen at a crossover, but only ever one of them is finished
     * arriving; the other is on its way out and fading.
     */
    const stage = await ev(`(() => {
      const s = document.querySelector('.pin-spacer'), st = document.querySelector('.stage');
      return String(s.getBoundingClientRect().height - st.getBoundingClientRect().height);
    })()`);
    const pin = Number(stage);
    let maxOpaque = 0;
    let holdsSeen = 0;
    for (let i = 0; i <= 28; i++) {
      const at = 0.34 + (i / 28) * 0.62;
      await ev(`window.scrollTo(0, ${Math.round(at * pin)})`);
      await sleep(280);
      const n = await ev(`[...document.querySelectorAll('.card')].filter(c => {
        const cs = getComputedStyle(c);
        return cs.visibility === 'visible' && Number(cs.opacity) > 0.9;
      }).length`);
      maxOpaque = Math.max(maxOpaque, n);
      if (n === 1) holdsSeen++;
    }
    check(
      'never more than one card is fully on stage',
      maxOpaque <= 1,
      `peak ${maxOpaque} across 29 samples`,
    );
    check(
      'and there is a card on stage for most of the sequence',
      holdsSeen >= 18,
      `${holdsSeen}/29 samples`,
    );

    /* ---- reaching the work without the performance ------------------- */

    /*
     * The whole keyboard story, and it is deliberately dull. The skip link is
     * an ordinary anchor to an ordinary list below the pinned section. An
     * earlier version hid the only copy of the work inside the pin and needed
     * a scripted scroll jump to reach it; this needs nothing.
     */
    check(
      'the skip link points at something that exists and is visible',
      await ev(`(() => {
        const href = document.querySelector('.skip').getAttribute('href');
        const target = document.querySelector(href);
        if (!target) return false;
        const cs = getComputedStyle(target);
        return cs.display !== 'none' && cs.visibility === 'visible' &&
               target.getBoundingClientRect().height > 0;
      })()`),
    );

    check(
      'the index sits outside the pinned section',
      await ev(`!document.querySelector('#work').closest('.pin-spacer')`),
    );

    /* ---- layer promotion is released -------------------------------- */

    check(
      'will-change is dropped when the section is not pinned',
      await ev(`(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        return new Promise(r => setTimeout(() => {
          const stage = document.querySelector('.stage');
          r(!stage.classList.contains('is-pinned') &&
            getComputedStyle(document.querySelector('.head')).willChange === 'auto');
        }, 300));
      })()`),
    );

    /* ---- reduced motion --------------------------------------------- */

    await load({ reduce: true });

    check('reduced motion builds no pin', await ev(`!document.querySelector('.pin-spacer')`));
    check(
      'reduced motion never marks the stage ready',
      await ev(`!document.querySelector('.stage').hasAttribute('data-ready')`),
    );
    check(
      'reduced motion never renders the showcase at all',
      await ev(`getComputedStyle(document.querySelector('.showcase')).display === 'none'`),
    );
    check(
      'reduced motion still shows all five links in the index',
      await ev(`(() => {
        const rows = [...document.querySelectorAll('.index-link')];
        return rows.length === 5 && rows.every(a => a.getBoundingClientRect().height > 0);
      })()`),
    );
    check(
      'reduced motion shows the head already open and looking up',
      await ev(`(() => {
        const up = document.querySelector('[data-layer="eyes-up"]');
        const fwd = document.querySelector('[data-layer="eyes-forward"]');
        const lid = getComputedStyle(document.querySelector('.lid-hinge')).transform;
        return getComputedStyle(up).opacity === '1'
            && getComputedStyle(fwd).opacity === '0'
            && lid !== 'none' && lid !== 'matrix(1, 0, 0, 1, 0, 0)';
      })()`),
    );
    check(
      'reduced motion sizes the head off the viewport width, not the document',
      await ev(`(() => {
        const h = document.querySelector('.head').getBoundingClientRect();
        return h.width <= window.innerWidth && h.height < document.documentElement.scrollHeight;
      })()`),
    );

    /* ---- the one colour rule ---------------------------------------- */

    /*
     * The one colour rule, as an assertion.
     *
     * Nothing painted may be colour: only the sky and the five crops, and both
     * of those are images. The first version of this test asked whether each
     * computed colour was a *grey* — r, g and b within a hair of each other —
     * and it failed the hairline above the colophon, which is `#d9d4c8`. That
     * was the test being wrong, not the design: the palette is deliberately a
     * warm paper and a cool ink, so channel spread says nothing useful.
     *
     * What the rule actually claims is that every painted colour is a blend of
     * those two. So project each colour onto the paper-to-ink line and measure
     * how far off it lands. A tint of paper sits on the line; vermilion does
     * not, and misses by 178.
     */
    const offenders = await ev(`(() => {
      const P = [247, 244, 236], K = [22, 24, 29];
      const D = K.map((k, i) => k - P[i]);
      const len2 = D.reduce((s, d) => s + d * d, 0);
      const residual = (c) => {
        const v = c.map((x, i) => x - P[i]);
        const t = Math.min(1, Math.max(0, v.reduce((s, x, i) => s + x * D[i], 0) / len2));
        return Math.hypot(...v.map((x, i) => x - t * D[i]));
      };
      const bad = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'outlineColor']) {
          if (prop === 'outlineColor' && cs.outlineStyle === 'none') continue;
          const m = cs[prop].match(/rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?\\)/);
          if (!m) continue;
          if (m[4] !== undefined && +m[4] === 0) continue;
          const c = [+m[1], +m[2], +m[3]];
          const d = residual(c);
          if (d > 12) bad.push(el.tagName + '.' + el.className + ' ' + prop + '=' + cs[prop] + ' off by ' + d.toFixed(0));
        }
      }
      return JSON.stringify([...new Set(bad)].slice(0, 6));
    })()`);
    check(
      'nothing painted on the page is off the paper-to-ink line',
      JSON.parse(offenders).length === 0,
      JSON.parse(offenders).join(' | '),
    );

    ws.close();
  } finally {
    chrome.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
