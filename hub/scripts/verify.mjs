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

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

/*
 * Read from the source rather than restated here. A second copy of the angle
 * would agree with the first right up until someone changed one of them, and
 * then the check would be asserting history.
 */
const LID_ANGLE = Number(
  /export const LID_ANGLE = (-?[\d.]+)/.exec(
    readFileSync(new URL('../src/choreography.ts', import.meta.url), 'utf8'),
  )?.[1],
);
if (!Number.isFinite(LID_ANGLE)) throw new Error('could not read LID_ANGLE from src/choreography.ts');

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

    /*
     * The card must not land on his forehead.
     *
     * This has been wrong twice, both times because the constant that reserves
     * sky for the cards was derived from something other than where the head
     * actually ends — first the cut line, then a rise measured before the lid
     * started lifting clear. So it is measured rather than reasoned about:
     * hide the showcase, photograph the open head, and find its real topmost
     * pixel by trimming away the uniform paper. Then compare with where CSS
     * puts the card.
     *
     * `-trim` reports the offset of the first row that is not the background
     * colour, which after the pitch has faded out is the head and nothing else.
     */
    const headTopWhenOpen = async (holdAt) => {
      await ev(`window.scrollTo(0, ${Math.round(holdAt * pin)})`);
      await sleep(900);
      await ev(`document.querySelector('.showcase').style.visibility = 'hidden'`);
      await sleep(120);
      const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync('/tmp/hub-headtop.png', Buffer.from(shot.data, 'base64'));
      await ev(`document.querySelector('.showcase').style.visibility = ''`);
      await sleep(120);
      const out = execFileSync('magick', [
        '/tmp/hub-headtop.png', '-fuzz', '4%', '-trim',
        '-format', '%[fx:page.y]', 'info:',
      ]).toString().trim();
      return Number(out);
    };

    let worstGap = Infinity;
    let tightest = null;
    for (const hold of [0.42, 0.63, 0.84]) {
      const top = await headTopWhenOpen(hold);
      const bottom = await ev(`(() => {
        const c = [...document.querySelectorAll('.card')]
          .filter(x => getComputedStyle(x).visibility === 'visible')
          .map(x => x.getBoundingClientRect().bottom);
        return c.length ? Math.max(...c) : -1;
      })()`);
      if (bottom > 0 && top - bottom < worstGap) {
        worstGap = top - bottom;
        tightest = { top, bottom };
      }
    }
    /*
     * The detail line is the point as much as the pass/fail. HEAD_OPEN_RISE is
     * how much sky the layout reserves above the head, and it is only ever
     * correct by measurement — so the numbers it should be derived from get
     * printed rather than left to be guessed at again.
     */
    const geom = await ev(`(() => {
      const st = getComputedStyle(document.querySelector('.stage'));
      const h = document.querySelector('.head');
      return JSON.stringify({ canvasH: h.offsetHeight });
    })()`);
    const { canvasH } = JSON.parse(geom);
    check(
      'the card on stage never overlaps the open head',
      worstGap > 0,
      `closest approach ${Math.round(worstGap)}px` +
        (tightest
          ? ` (head top ${Math.round(tightest.top)}, card bottom ${Math.round(tightest.bottom)}, ` +
            `artboard ${canvasH}px — slack is ${(worstGap / canvasH).toFixed(3)} of HEAD_OPEN_RISE)`
          : ''),
    );

    /*
     * Remember how far open the lid actually ends up, so the reduced-motion
     * branch can be compared against it rather than merely checked for "not
     * identity". CSS and GSAP express this transform in two different places
     * and they have already drifted once.
     */
    await ev(`window.scrollTo(0, ${Math.round(0.3 * pin)})`);
    await sleep(900);
    const openLid = JSON.parse(await ev(`(() => {
      const l = document.querySelector('.lid-hinge');
      return JSON.stringify({
        m: getComputedStyle(l).transform,
        h: l.offsetHeight, // layout height: getBoundingClientRect is the *projected* box of a rotated element
      });
    })()`));

    /*
     * The lid must actually swing, and it must end up clear of the opening.
     *
     * This replaced a backface test. The old hinge turned the cap out of the
     * picture plane and the claim worth checking was which of its two faces
     * you were looking at — a claim nothing in the computed styles could
     * answer, because `will-change: opacity` was silently flattening the 3D
     * context and disabling culling. The hinge is an in-plane rotation now:
     * there is no backface, and the claim that matters is the one this piece
     * has got wrong twice. *You cannot open something that stays shut.*
     *
     * Both halves are measured in pixels and neither knows anything about the
     * artwork. The lid's own pixels are isolated by differencing a frame
     * against the same frame with the lid hidden — so "did it move" is the
     * distance that region travels, and "is the opening clear" is whether
     * hiding the lid changes anything over the mouth of the cavity.
     */
    const lidFrames = async (at) => {
      await ev(`window.scrollTo(0, ${Math.round(at * pin)})`);
      await sleep(900);
      await ev(`document.querySelector('.showcase').style.visibility = 'hidden'`);
      await sleep(120);
      const withLid = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync('/tmp/hub-lid-a.png', Buffer.from(withLid.data, 'base64'));
      await ev(`document.querySelector('.lid-hinge').style.visibility = 'hidden'`);
      await sleep(120);
      const without = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync('/tmp/hub-lid-b.png', Buffer.from(without.data, 'base64'));
      const cavity = JSON.parse(await ev(`(() => {
        const r = document.querySelector('[data-cavity]').getBoundingClientRect();
        return JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) });
      })()`));
      await ev(`document.querySelector('.lid-hinge').style.visibility = '';
                document.querySelector('.showcase').style.visibility = '';`);

      /*
       * How much ink the lid contributes, not how far apart its extremes are.
       *
       * The first version trimmed the thresholded difference and used the
       * bounding box. That measures extent, and extent lies: a rotated element
       * with no image in it still paints a one-pixel outline of its own box,
       * so deleting `lid.png` outright produced a *larger* box than the real
       * lid did and the check passed. Mean difference over the whole frame
       * cannot be fooled that way — a hairline is nearly nothing however wide
       * it is spread.
       */
      const energy = Number(
        execFileSync('magick', [
          '/tmp/hub-lid-a.png', '/tmp/hub-lid-b.png', '-compose', 'difference', '-composite',
          '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:',
        ]).toString().trim(),
      );
      return { energy, cavity };
    };

    const shut = await lidFrames(0);
    const open = await lidFrames(0.3);

    /*
     * The lid has to be a layer that actually paints. Without this, a missing
     * or empty `lid.png` would sail through the covering check below — nothing
     * cannot cover anything.
     */
    check(
      'the lid is a layer that actually paints',
      shut.energy > 0.005,
      `hiding it at rest changes ${(shut.energy * 100).toFixed(2)}% of the frame's ink`,
    );

    /*
     * And it has to reach its full swing.
     *
     * Read off the matrix rather than by comparing where the lid's pixels are
     * between two poses, which is what the first version of this did. That
     * measured the wrong thing: the head *descends* over the same stretch of
     * scroll, so the lid's pixels move hundreds of pixels whether or not it
     * rotates at all — an 8-degree lid passed it comfortably. atan2 on the
     * first column is the rotation and nothing else.
     */
    const lidAngle = Number(await ev(`(() => {
      const m = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.lid-hinge')).transform);
      return (Math.atan2(m.b, m.a) * 180) / Math.PI;
    })()`));
    check(
      'the lid reaches its full swing',
      Math.abs(lidAngle - LID_ANGLE) < 1.5,
      `${lidAngle.toFixed(1)}deg against LID_ANGLE ${LID_ANGLE}`,
    );

    /*
     * The mouth of the opening, at the open pose. A patch rather than a pixel:
     * one sample would be at the mercy of a single halftone dot once the
     * treatment lands.
     */
    const PATCH = 48;
    const openingMean = (file) => Number(
      execFileSync('magick', [
        file,
        '-crop', `${PATCH}x${PATCH}+${Math.round(open.cavity.x - PATCH / 2)}+${Math.round(open.cavity.y - PATCH / 2)}`,
        '+repage', '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:',
      ]).toString().trim(),
    );
    const overOpening = Math.abs(openingMean('/tmp/hub-lid-a.png') - openingMean('/tmp/hub-lid-b.png'));
    check(
      'the open lid is not covering the opening',
      overOpening < 0.02,
      `hiding the open lid changes the mouth of the cavity by ${overOpening.toFixed(4)} (0 means it was already clear)`,
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
    const staticLid = JSON.parse(await ev(`(() => {
      const l = document.querySelector('.lid-hinge');
      return JSON.stringify({
        m: getComputedStyle(l).transform,
        h: l.offsetHeight,
      });
    })()`));

    /*
     * Compared as rotation plus a *proportional* lift, not as raw matrices.
     * The lift is a percentage of the artboard and the head is deliberately a
     * different size in flow than it is on the pinned stage, so the pixel
     * translations differ by design — the first version of this check flagged
     * that as a failure, which was the check being wrong, not the CSS.
     */
    /* Parse inside the parentheses — matching digits across the whole string
       picks up the "3" in `matrix3d` and yields seventeen components. */
    const nums = (m) =>
      m.includes('(')
        ? m.slice(m.indexOf('(') + 1, m.lastIndexOf(')')).split(',').map((x) => Number(x.trim()))
        : [];
    const a = nums(openLid.m);
    const b = nums(staticLid.m);

    /*
     * `matrix(a,b,c,d,e,f)` now, not `matrix3d` — the hinge is a plain z
     * rotation, so the browser serialises six components rather than sixteen.
     * The previous version indexed 0..11 and 13 unconditionally and reported
     * `NaN% vs NaN%`, which the comparison then read as "not different" — a
     * check that would have passed anything. It failed loudly here only
     * because `NaN < 0.005` is false. Assert the shape first.
     */
    const twoD = a.length === 6 && b.length === 6;
    const rotationMatches =
      twoD && a.slice(0, 4).every((v, i) => Math.abs(v - b[i]) < 0.01);
    /* Translation as a proportion of the artboard: the head is deliberately a
       different size in flow than on the pinned stage, so raw pixels differ by
       design. A pure rotation about an origin still produces one. */
    const liftA = twoD ? a[5] / openLid.h : NaN;
    const liftB = twoD ? b[5] / staticLid.h : NaN;
    check(
      'reduced motion opens the lid exactly as far as the timeline does',
      twoD && rotationMatches && Math.abs(liftA - liftB) < 0.005,
      twoD
        ? `rotation matches, lift ${(liftA * 100).toFixed(1)}% vs ${(liftB * 100).toFixed(1)}% of the artboard`
        : `expected a 2D matrix, got ${a.length} and ${b.length} components`,
    );

    /*
     * The "and looking up" half of this check is gone with the eye layers —
     * the eyes are drawn into `face` now and cannot change. What is left is the
     * half that still has a claim behind it: under reduced motion the head must
     * render *already open*, not closed and waiting for a scroll that will
     * never drive anything.
     */
    check(
      'reduced motion shows the head already open',
      await ev(`(() => {
        const lid = getComputedStyle(document.querySelector('.lid-hinge')).transform;
        return lid !== 'none' && lid !== 'matrix(1, 0, 0, 1, 0, 0)';
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
