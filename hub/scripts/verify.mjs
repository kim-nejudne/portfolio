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
 * The spoke list and the disclosure rule, both read from the source rather
 * than restated — same doctrine as the `choreography.ts` read below. Node has
 * stripped types since 22.18, so the `.ts` import needs no build step.
 *
 * `policy.mjs` is shared with `scripts/case-studies.mjs`, which enforces the
 * same rule at build time. Two copies of a policy agree right up until someone
 * edits one of them.
 */
import { SPOKES } from '../src/spokes.ts';
import { checkDisclosure } from './case-study/policy.mjs';

/*
 * Read from the source rather than restated here. A second copy of the angle
 * would agree with the first right up until someone changed one of them, and
 * then the check would be asserting history.
 */
const CHOREOGRAPHY = readFileSync(new URL('../src/choreography.ts', import.meta.url), 'utf8');
const num = (re, what) => {
  const v = Number(re.exec(CHOREOGRAPHY)?.[1]);
  if (!Number.isFinite(v)) throw new Error(`could not read ${what} from src/choreography.ts`);
  return v;
};
const LID_ANGLE = num(/export const LID_ANGLE = (-?[\d.]+)/, 'LID_ANGLE');
const SHOWCASE_START = num(/showcaseStart: (-?[\d.]+)/, 'BEATS.showcaseStart');

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

/*
 * The one colour rule, as an expression, hoisted so the homepage and the five
 * case studies are judged by the same arithmetic rather than by two copies of
 * it that agree until someone edits one.
 *
 * Nothing painted may be colour: only the sky and the five crops, and both of
 * those are images. The first version of this test asked whether each computed
 * colour was a *grey* — r, g and b within a hair of each other — and it failed
 * the hairline above the colophon, which is `#d9d4c8`. That was the test being
 * wrong, not the design: the palette is deliberately a warm paper and a cool
 * ink, so channel spread says nothing useful.
 *
 * What the rule actually claims is that every painted colour is a blend of
 * those two. So project each colour onto the paper-to-ink line and measure how
 * far off it lands. A tint of paper sits on the line; vermilion does not, and
 * misses by 178.
 *
 * Two things it cannot see, both worth knowing before trusting it. It reads
 * `getComputedStyle` rather than pixels, so an untreated full-colour image in
 * a layer passes in silence — and one does. And the regex matches only `rgb()`
 * and `rgba()`: Chrome serialises `color-mix()` as `color(srgb …)` and
 * `oklch()` as itself, so a colour written either way is skipped rather than
 * judged. `src/tokens.css` carries that warning where the tones are chosen.
 */
const COLOUR_RULE = `(() => {
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
})()`;

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

    /*
     * Make the page believe it is focused.
     *
     * A headless tab reports `document.hasFocus() === false`, and CSS `:focus`
     * does not match in an unfocused document — so *every* focus style in this
     * project was untestable here, silently. Calling `.focus()` moved
     * `document.activeElement` and changed nothing about what painted, which
     * means an assertion written the obvious way fails against correct CSS and
     * would be "fixed" by weakening it.
     *
     * Found while adding the skip-link check for the case studies. It is worth
     * knowing that the older assertion above — that the skip link's *target*
     * exists and is visible — never exercised `:focus` at all, so the reveal
     * itself had never been verified on any page here.
     */
    await rpc(ws, 'Emulation.setFocusEmulationEnabled', { enabled: true });

    /*
     * Every navigation is a cold load.
     *
     * `--user-data-dir=/tmp/hub-verify-profile` persists between runs, so the
     * second run of the day fetches almost nothing and `transferSize` reports
     * near zero. That was caught in the deploy output: a case study weighing
     * 8KB on a cold load printed **1KB**, and the budget assertion passed on a
     * number that described the cache rather than the page. It could never
     * fail wrongly — only pass when it should not, which is this file's
     * definition of decoration.
     *
     * It also sharpens the font check below: with the cache off, every face a
     * page actually uses is fetched on every page, so "emitted once and shared
     * by all six" is measured rather than inferred from one warm visit.
     */
    await rpc(ws, 'Network.enable');
    await rpc(ws, 'Network.setCacheDisabled', { cacheDisabled: true });

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

    /*
     * `url` and `settle` are for the case-study pages at the end of this file.
     * Both existing call sites pass neither and behave exactly as they did:
     * the homepage, and 2200ms for the timeline to build and settle. The
     * reading pages have no timeline — no script at all — so they are given
     * 400ms, which keeps ten extra navigations from adding twenty seconds to
     * a gate that runs on every deploy.
     */
    const load = async ({ reduce, width = 1440, height = 900, url = URL_ARG, settle = 2200 }) => {
      await rpc(ws, 'Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
      });
      await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 500,
      });
      await rpc(ws, 'Page.navigate', { url });
      await sleep(settle);
    };

    /* ---- semantics -------------------------------------------------- */

    await load({ reduce: false });

    /*
     * Effectively hidden, rather than hidden by an attribute in one named
     * place. The drawing became three elements when the sky came back, and the
     * `aria-hidden` moved up to the plate that wraps them — correct, and it
     * failed a check that was looking at `.head` itself. What matters is that
     * nothing in the drawing reaches the accessibility tree, and `closest`
     * asks that directly.
     */
    check(
      'the head is hidden from assistive technology',
      await ev(`['.head', '.head-sky', '.head-plate']
        .every(s => document.querySelector(s)?.closest('[aria-hidden="true"]'))`),
    );

    check(
      'every head layer image has an empty alt',
      await ev(`[...document.querySelectorAll('.layer')].every(i => i.getAttribute('alt') === '')`),
    );

    /*
     * Every preload resolves.
     *
     * A `<link rel=preload>` that 404s is silent in every direction that
     * matters: the console warns and nothing else changes, the page renders
     * correctly, and no assertion about the rendered result can see it. This
     * file shipped `head-back.avif` in that list for weeks after the layer was
     * deleted — first in the list, so it spent a connection on the critical path
     * fetching nothing, on the one page whose whole job is to load fast.
     *
     * Fetched rather than inspected, because the failure is entirely about
     * whether the bytes are there.
     *
     * **A 200 is not enough, and the first version of this check was decoration
     * because of it.** `vite preview` answers an unknown path with `index.html`
     * and status 200, so pointing a preload at a deleted layer sabotaged
     * nothing — the check passed on exactly the bug it was written for. nginx
     * is configured `try_files $uri =404` and would have 404'd, but a check that
     * only works against production is not a check. So the content type has to
     * agree with what was asked for: a preload declaring `as="image"` that comes
     * back as HTML is the fallback answering, whatever the status says.
     */
    const preloads = JSON.parse(await ev(`(async () => {
      const links = [...document.querySelectorAll('link[rel="preload"]')];
      const bad = [];
      for (const l of links) {
        const r = await fetch(l.href, { method: 'GET' }).catch(() => null);
        if (!r || !r.ok) { bad.push(l.getAttribute('href') + ' -> ' + (r ? r.status : 'failed')); continue; }
        const got = r.headers.get('content-type') || '';
        const want = l.getAttribute('as');
        if (want && !got.startsWith(want + '/')) {
          bad.push(l.getAttribute('href') + ' -> ' + got + ', wanted ' + want);
        }
      }
      return JSON.stringify({ n: links.length, bad });
    })()`));
    check(
      'every preloaded asset actually exists',
      preloads.n > 0 && preloads.bad.length === 0,
      preloads.bad.length ? preloads.bad.join(', ') : `${preloads.n} preloads, all 200`,
    );

    /*
     * The share card and the icons, checked the same way and for the same
     * reason: nothing on the page renders them, so nothing on the page can fail
     * when they are missing. An og:image that 404s costs every share the site
     * will ever get, and the only symptom is a card that quietly does not
     * appear on somebody else's timeline.
     *
     * The declared dimensions are checked against the real ones rather than
     * trusted. og:image:width is a promise to the scraper about how to lay the
     * card out before it has finished downloading it, and a card that disagrees
     * with its own metadata gets cropped or letterboxed by whoever believed it.
     *
     * The icon href set is read off the document, not hardcoded here, so adding
     * a `rel="icon"` and forgetting to generate it fails rather than passes.
     */
    const brand = JSON.parse(await ev(`(async () => {
      const want = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')]
        .map(l => ({ href: l.getAttribute('href'), type: l.getAttribute('type') || 'image/' }));
      /*
       * og:image is absolute on purpose — several scrapers drop a relative one.
       * But this suite runs against a local build, so fetching that URL would
       * check production and pass while the thing about to be shipped is
       * broken. Take the path and resolve it against the site under test, and
       * assert the absolute form separately.
       */
      const og = document.querySelector('meta[property="og:image"]');
      if (og) {
        const raw = og.getAttribute('content') || '';
        let path = null;
        try { path = new URL(raw).pathname; } catch { path = null; }
        const canonical = document.querySelector('link[rel="canonical"]');
        const sameOrigin = canonical && raw.startsWith(new URL(canonical.href).origin + '/');
        want.push({ href: path, absolute: raw, sameOrigin, type: 'image/', og: true });
      }

      const bad = [];
      for (const w of want) {
        if (w.og) {
          if (!w.href) { bad.push('og:image is not an absolute URL: ' + w.absolute); continue; }
          if (!w.sameOrigin) { bad.push('og:image is not on the canonical origin: ' + w.absolute); continue; }
        }
        const r = await fetch(w.href, { method: 'GET' }).catch(() => null);
        if (!r || !r.ok) { bad.push(w.href + ' -> ' + (r ? r.status : 'failed')); continue; }
        const got = r.headers.get('content-type') || '';
        if (!got.startsWith(w.type)) { bad.push(w.href + ' -> ' + got + ', wanted ' + w.type); continue; }

        if (w.og) {
          /* Decode it and compare against what the tags promise. */
          const bmp = await createImageBitmap(await r.blob()).catch(() => null);
          if (!bmp) { bad.push(w.href + ' -> did not decode'); continue; }
          const dw = document.querySelector('meta[property="og:image:width"]');
          const dh = document.querySelector('meta[property="og:image:height"]');
          if (!dw || !dh) { bad.push('og:image has no declared dimensions'); continue; }
          if (+dw.content !== bmp.width || +dh.content !== bmp.height) {
            bad.push('og:image is ' + bmp.width + 'x' + bmp.height + ' but declares ' + dw.content + 'x' + dh.content);
          }
          /* Under 5MB, which is the tightest of the common scraper limits. */
          const bytes = +r.headers.get('content-length') || 0;
          if (bytes > 5 * 1024 * 1024) bad.push('og:image is ' + Math.round(bytes/1024) + 'KB, over the 5MB limit');
        }
      }
      return JSON.stringify({ n: want.length, bad });
    })()`));
    check(
      'the icons and the share card all exist and are what they claim',
      brand.n >= 4 && brand.bad.length === 0,
      brand.bad.length ? brand.bad.join('; ') : `${brand.n} assets, all 200 and correctly typed`,
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

    /*
     * The case-study links resolve.
     *
     * This check existed before the pages did and passed for months without
     * ever running: `.every()` over an empty NodeList is `true`, and no
     * `.index-aside` was rendered because `caseStudy` was unset on all five
     * spokes. It was decoration by this file's own standard. Wiring the field
     * is what gives it something to judge, so it is worth making it judge
     * properly.
     *
     * Fetched from node rather than the page, and **a 200 is not the
     * assertion**. `vite preview` answers an unknown path with `index.html` at
     * status 200, which is the same trap that made the preload check
     * decoration further up this file. So the discriminator is content: the
     * page that comes back must carry the canonical URL of the spoke that was
     * asked for. A fallback cannot fake that.
     */
    const asideHrefs = JSON.parse(
      await ev(
        `JSON.stringify([...document.querySelectorAll('.index-aside')].map(a => a.href))`,
      ),
    );
    const asideFails = [];
    for (const s of SPOKES) {
      const want = new URL(`/work/${s.id}/`, URL_ARG).href;
      const linked = asideHrefs.find((h) => new URL(h).pathname === `/work/${s.id}/`);
      if (!linked) {
        asideFails.push(`${s.id}: no case-study link in the index`);
        continue;
      }
      const res = await fetch(want).catch((e) => ({ status: `fetch failed: ${e.message}` }));
      const body = res.text ? await res.text() : '';
      if (res.status !== 200) asideFails.push(`${s.id}: ${res.status}`);
      else if (!body.includes(`href="https://kimnejudne.dev/work/${s.id}/"`)) {
        asideFails.push(`${s.id}: 200 but not the case study — the SPA fallback answered`);
      }
    }
    check(
      'every case-study link in the index resolves to that spoke’s own page',
      asideFails.length === 0 && asideHrefs.length === SPOKES.length,
      asideFails.join(' | ') || `${asideHrefs.length} links`,
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
     * rather than spot-checked.
     *
     * What "one" counts changed, and the change is worth reading before
     * trusting this. It used to count cards that were merely *opaque*, which
     * was a fair proxy while a card faded in only after the previous one had
     * gone. It stopped being fair the moment the next card was made to appear
     * early and climb in view: the incoming card is fully opaque for most of
     * its rise, so the old check would have failed a sequence that was doing
     * exactly what it was asked to do.
     *
     * So the claim is stated properly instead. Two cards may share the screen —
     * that is the design — but only one may be *settled*: opaque, at full size,
     * and at its layout position. Every card shares one coordinate in the
     * stack, so two settled at once is two cards printed on top of each other,
     * and that is the failure this has to catch. Read off the transform, which
     * is the only thing that can tell a card at rest from one that is on its
     * way.
     */
    const stage = await ev(`(() => {
      const s = document.querySelector('.pin-spacer'), st = document.querySelector('.stage');
      return String(s.getBoundingClientRect().height - st.getBoundingClientRect().height);
    })()`);
    const pin = Number(stage);

    /*
     * The first card is born at the mouth of the opening — *where the opening
     * is at that instant*, not where it will end up.
     *
     * This exists because the launch measurement used to add the whole descent
     * to every card, on the reasoning that the head had finished sinking before
     * any card emerged. True until the first card moved to unit 3 to meet the
     * "visible at 90 degrees" constraint, and then false by the entire descent
     * — a card launching out of his jaw instead of out of the tear.
     *
     * Nothing else here could have caught it. Cards two to five are born after
     * the descent ends and stay correct, the sequence still runs, and a card
     * that is 10% of full size and 12vh low simply reads as "a bit off". The
     * cavity marker is the only thing on the page that knows where the opening
     * actually is, so ask it, on the frame the card is created.
     */
    const birth = SHOWCASE_START / 100;
    await ev(`window.scrollTo(0, ${Math.round(birth * pin)})`);
    await sleep(900);
    const bornAt = JSON.parse(await ev(`(() => {
      const c = document.querySelector('[data-cavity]').getBoundingClientRect();
      /* The card is autoAlpha 0 on this frame, but visibility:hidden elements
         still have a box — which is exactly the box being asserted about. */
      const r = document.querySelector('.card').getBoundingClientRect();
      return JSON.stringify({
        dx: (r.left + r.width / 2) - (c.left + c.width / 2),
        dy: (r.top + r.height / 2) - (c.top + c.height / 2),
      });
    })()`));
    const bornOff = Math.hypot(bornAt.dx, bornAt.dy);
    check(
      'the first card is born at the opening, not where the opening will be',
      bornOff < 30,
      `${bornOff.toFixed(0)}px from the cavity marker at unit ${SHOWCASE_START}`,
    );

    /*
     * Kim's constraint, stated as he stated it: **the first card is already
     * visible when the head is at 90 degrees.**
     *
     * Deliberately not expressed as "unit 7", which is where the arithmetic
     * says the lid passes vertical. That figure depends on the lid's duration
     * *and* on its easing — `power1.out` puts 90 degrees a third of the way
     * through the swing rather than halfway, which is not obvious and is the
     * sort of thing a later re-tune would quietly move. So find the scroll
     * position where the lid is actually at 90 by walking it and reading the
     * matrix, then ask what the card is doing there.
     */
    const lidRotation = () =>
      ev(`(() => {
        const m = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.lid-hinge')).transform);
        return (Math.atan2(m.b, m.a) * 180) / Math.PI;
      })()`);
    let ninetyAt = null;
    for (let f = 0; f <= 0.4; f += 0.01) {
      await ev(`window.scrollTo(0, ${Math.round(f * pin)})`);
      await sleep(320);
      if (Number(await lidRotation()) >= 90) {
        ninetyAt = f;
        break;
      }
    }
    if (ninetyAt === null) {
      check('the first card is visible by the time the lid reaches 90 degrees', false,
        'the lid never reached 90 degrees in the first 40% of the pin');
    } else {
      await ev(`window.scrollTo(0, ${Math.round(ninetyAt * pin)})`);
      await sleep(900);
      const at90 = JSON.parse(await ev(`(() => {
        const c = document.querySelector('.card');
        const cs = getComputedStyle(c);
        return JSON.stringify({
          opacity: Number(cs.opacity),
          shown: cs.visibility === 'visible',
          onScreen: c.getBoundingClientRect().top < window.innerHeight,
        });
      })()`));
      check(
        'the first card is visible by the time the lid reaches 90 degrees',
        at90.shown && at90.opacity > 0.5 && at90.onScreen,
        `lid 90deg at ${(ninetyAt * 100).toFixed(0)}% of the pin, card at opacity ${at90.opacity.toFixed(2)}` +
          ` (unit ${SHOWCASE_START} birth, ${(Number(await lidRotation())).toFixed(0)}deg measured)`,
      );
    }

    /*
     * The head is in front of the cards, and that has to be proven in pixels.
     *
     * A z-index is trivially readable from the computed styles and says almost
     * nothing — stacking contexts, `will-change` and transforms all rearrange
     * what it means, and this project has already shipped one bug where a
     * `will-change` quietly changed what a rendering property did. So this does
     * not read CSS. It photographs the frame four times — both, head alone,
     * cards alone, neither — and asks, over the pixels where the two would
     * *both* paint, which of the two candidates the real frame agrees with.
     * Where they contend the composite matches one almost exactly and the other
     * hardly at all, and which is which *is* the stacking order. No threshold
     * has to be guessed.
     *
     * Two earlier versions measured the wrong thing, and the second failure is
     * the instructive one. Taking the head's topmost row as a horizon and
     * calling everything below it "head" ignored that his tear is a hand-drawn
     * wave: most of that band is bare paper a card may perfectly well paint on,
     * so it failed a correct page. Replacing the horizon with a real silhouette
     * fixed that but still measured *how much ink changed*, and putting the head
     * back behind the cards moved the number only from 0.00% to 0.25% — under
     * the threshold, passing the exact regression it existed to catch. A card's
     * body and his paper are both pale, so an occlusion that is glaring to the
     * eye is nearly invisible as a difference in ink.
     *
     * **The overlap is manufactured, and that is what the second cut forced.**
     * This used to hunt the queue frames for whichever had the most natural
     * contention. The first cut put the tear on the mid-forehead, so a card
     * climbing out was sliced by his scalp and there were always thousands of
     * contended pixels to judge. The second cut moved the tear down to the brow;
     * the opening became far bigger than a card, and the cards now sit entirely
     * inside it. A sweep of the whole pin at 2% steps finds 86 contended pixels
     * at a single frame and zero at every other one. The stacking order stopped
     * being observable, and the check went from proving something to reporting
     * "nothing to judge" — which is a FAIL, and correctly so.
     *
     * Hunting harder would not have helped, because the evidence is genuinely
     * gone. So a card is *moved onto the drawing* for the length of one
     * measurement. That is a stronger test than the one it replaces, not a
     * weaker one: the claim was always about the stylesheet — that `.head`
     * paints above `.card` — and it now rests on the stylesheet alone instead
     * of on the artwork happening to produce an overlap. Re-cut the head again
     * and this still works.
     *
     * `translate` and not `transform`, because GSAP owns the transform matrix
     * and would overwrite anything written there on the next tick. The
     * independent `translate` property composes with it and is ours alone.
     */
    const shot = async (file) => {
      const s = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(s.data, 'base64'));
    };
    const hide = (sel, on) =>
      ev(`document.querySelector('${sel}').style.visibility = '${on ? 'hidden' : ''}'`);

    /* A hold: one card settled and being read, one queued in the opening. */
    const Z_FRAME = 0.28;
    await ev(`window.scrollTo(0, ${Math.round(Z_FRAME * pin)})`);
    await sleep(900);

    const settled = JSON.parse(await ev(`(() => {
      const c = [...document.querySelectorAll('.card')].find(x => {
        const cs = getComputedStyle(x);
        if (cs.visibility !== 'visible' || Number(cs.opacity) <= 0.9) return false;
        const m = new DOMMatrixReadOnly(cs.transform);
        return Math.abs(m.a - 1) < 0.04 && Math.abs(m.e) < 24 && Math.abs(m.f) < 24;
      });
      if (!c) return 'null';
      c.dataset.zProbe = '1';
      const r = c.getBoundingClientRect();
      const left = Math.max(0, Math.round(r.left));
      return JSON.stringify({
        left, width: Math.min(window.innerWidth - left, Math.round(r.width)),
        top: Math.round(r.top), height: Math.round(r.height),
        bottom: Math.round(r.bottom), viewport: window.innerHeight,
      });
    })()`));

    /*
     * How far to push it: until a third of the card's height is past the top of
     * his drawing in the card's own columns. Measured rather than assumed, so
     * the probe lands on ink whatever the art is. The sky is hidden for the
     * measurement — it is the hole, it belongs behind the cards, and including
     * it would find the top of the colour instead of the top of the drawing.
     */
    if (!settled) {
      check('the head paints in front of the cards', false, `no settled card at ${Z_FRAME * 100}% of the pin`);
    } else {
      await ev(`document.querySelector('.showcase').style.visibility = 'hidden';
                document.querySelector('.head-sky').style.visibility = 'hidden';`);
      await sleep(150);
      await shot('/tmp/hub-z-inkonly.png');
      await ev(`document.querySelector('.showcase').style.visibility = '';
                document.querySelector('.head-sky').style.visibility = '';`);
      const inkTop = Number(execFileSync('magick', [
        '/tmp/hub-z-inkonly.png',
        '-crop', `${settled.width}x${settled.viewport}+${settled.left}+0`, '+repage',
        '-fuzz', '4%', '-trim', '-format', '%[fx:page.y]', 'info:',
      ]).toString().trim());
      const push = Math.round(inkTop - settled.bottom + settled.height / 3);
      await ev(`document.querySelector('[data-z-probe]').style.translate = '0px ${push}px'`);
      await sleep(250);

      /* Four frames: both, head alone, cards alone, neither. */
      await shot('/tmp/hub-z-all.png');
      await hide('.showcase', true);
      await sleep(150);
      await shot('/tmp/hub-z-head.png');
      await hide('.head', true);
      await sleep(150);
      await shot('/tmp/hub-z-bare.png');
      await hide('.showcase', false);
      await sleep(150);
      await shot('/tmp/hub-z-cards.png');
      await hide('.head', false);

      const binaryDiff = (a, b, out, pct) =>
        execFileSync('magick', [a, b, '-compose', 'difference', '-composite',
          '-colorspace', 'Gray', '-threshold', pct, out]);
      binaryDiff('/tmp/hub-z-head.png', '/tmp/hub-z-bare.png', '/tmp/hub-z-m1.png', '2%');
      binaryDiff('/tmp/hub-z-cards.png', '/tmp/hub-z-bare.png', '/tmp/hub-z-m2.png', '2%');
      /* Contention: both would paint here. */
      execFileSync('magick', ['/tmp/hub-z-m1.png', '/tmp/hub-z-m2.png',
        '-compose', 'multiply', '-composite', '/tmp/hub-z-contended.png']);

      const box = `${settled.width}x${settled.height}+${settled.left}+${settled.top + push}`;
      const meanIn = (img) => Number(
        execFileSync('magick', [img, '-crop', box, '+repage',
          '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:']).toString().trim(),
      );
      const contendedArea = meanIn('/tmp/hub-z-contended.png');
      /* Mean disagreement with each candidate, over the contended pixels only. */
      const agreementWith = (frame) => {
        execFileSync('magick', ['/tmp/hub-z-all.png', frame,
          '-compose', 'difference', '-composite', '-colorspace', 'Gray',
          '/tmp/hub-z-d.png']);
        execFileSync('magick', ['/tmp/hub-z-d.png', '/tmp/hub-z-contended.png',
          '-compose', 'multiply', '-composite', '/tmp/hub-z-dm.png']);
        return meanIn('/tmp/hub-z-dm.png') / (contendedArea || 1);
      };
      const offHead = agreementWith('/tmp/hub-z-head.png');
      const offCards = agreementWith('/tmp/hub-z-cards.png');
      /*
       * In pixels, not as a fraction of the card's box — a guard expressed as a
       * fraction once called an unambiguous overlap "nothing to judge", because
       * most of the box is caption and transparent between the glyphs. This
       * number is now also the proof that the *probe itself* worked: if the
       * push failed to land the card on him there is nothing to judge and the
       * check must fail rather than pass vacuously.
       */
      const contendedPx = Math.round(contendedArea * settled.width * settled.height);

      check(
        'the head paints in front of the cards',
        contendedPx > 150 && offHead < offCards * 0.25,
        contendedPx <= 150
          ? `pushing the card ${push}px onto him produced only ${contendedPx}px of contention — the probe missed`
          : `card pushed ${push}px onto the drawing; over the ${contendedPx}px where they contend the frame ` +
            `is ${offHead < offCards ? 'the head' : 'the card'}: ` +
            `off-head ${offHead.toFixed(4)} vs off-card ${offCards.toFixed(4)}`,
      );

      /*
       * And the card on stage is still clickable.
       *
       * The head's element is the whole 1200x1600 artboard and most of that box
       * is transparent, so raising it above the cards hands it a screen-sized
       * invisible shield over them. It paints nothing there and would swallow
       * every click. `pointer-events: none` on `.head` is what stops that, and
       * this is the assertion that would notice if it were ever removed — the
       * pixels would be identical and the links would simply stop working.
       *
       * Asked **while the card is still pushed onto him**, which is the whole
       * reason the push is not undone until after this. Left where the design
       * puts it, the settled card sits above the top edge of the head's element
       * box, so its centre is not under the head at all and the hit test cannot
       * see the guard: removing `pointer-events: none` altogether left this
       * passing. The push that manufactures the paint overlap manufactures the
       * hit-testing overlap too, and one probe now covers both.
       */
      const hit = JSON.parse(await ev(`(() => {
        const c = document.querySelector('[data-z-probe]');
        if (!c) return 'null';
        /*
         * Every other card is hidden for the duration. Pushed down into the
         * opening, the probe lands on top of the card queued there — a sibling
         * at the same z-index, so the hit test found *that* and reported a
         * failure the page had not committed. Only the probe and the drawing
         * may be candidates, or the answer is about the wrong pair.
         */
        const others = [...document.querySelectorAll('.card')].filter(x => x !== c);
        /* Put back the exact inline value, not the empty string: GSAP's
           autoAlpha writes visibility inline, so clearing it would un-hide
           every card it had legitimately hidden — which is what happened, and
           the next check then found four queued cards instead of one. */
        const was = others.map(x => x.style.visibility);
        others.forEach(x => { x.style.visibility = 'hidden'; });
        const r = c.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        others.forEach((x, i) => { x.style.visibility = was[i]; });
        return JSON.stringify({
          ok: !!el && c.contains(el),
          got: el ? (el.getAttribute('class') || el.tagName) : 'nothing',
        });
      })()`));
      check(
        'the card on stage is still what a click lands on',
        hit && hit.ok,
        hit ? `hit test found "${hit.got}" under the head's box` : 'no settled card to test',
      );
      await ev(`document.querySelector('[data-z-probe]').style.translate = ''`);
      await sleep(200);
      /*
       * And the head has not swallowed a card that is where it belongs.
       *
       * The mirror of the check above, and the reason both are needed: a head
       * in front of the cards can hide one completely, and "the next card is
       * already visible" would be a lie told by a correct stacking order. So
       * with the probe undone, ask what the queued card actually contributes to
       * the real frame — not what it would contribute on bare paper.
       */
      const queued = JSON.parse(await ev(`(() => {
        const q = [...document.querySelectorAll('.card')].filter(c => {
          const cs = getComputedStyle(c);
          if (cs.visibility !== 'visible' || Number(cs.opacity) < 0.5) return false;
          const m = new DOMMatrixReadOnly(cs.transform);
          return !(Math.abs(m.a - 1) < 0.04 && Math.abs(m.e) < 24 && Math.abs(m.f) < 24);
        });
        if (q.length !== 1) return 'null';
        const r = q[0].getBoundingClientRect();
        const left = Math.max(0, Math.round(r.left));
        return JSON.stringify({
          left, width: Math.min(window.innerWidth - left, Math.round(r.width)),
          top: Math.round(r.top), height: Math.round(r.height),
        });
      })()`));
      if (!queued) {
        check('and the queued card is still visible beside it', false, 'no queued card to measure');
      } else {
        await shot('/tmp/hub-z-all.png');
        await hide('.showcase', true);
        await sleep(150);
        await shot('/tmp/hub-z-head.png');
        await hide('.showcase', false);
        binaryDiff('/tmp/hub-z-all.png', '/tmp/hub-z-head.png', '/tmp/hub-z-vis.png', '2%');
        const qbox = `${queued.width}x${queued.height}+${queued.left}+${queued.top}`;
        const visible = Number(
          execFileSync('magick', ['/tmp/hub-z-vis.png', '-crop', qbox, '+repage',
            '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:']).toString().trim(),
        );
        check(
          'and the queued card is still visible beside it',
          visible > 0.05,
          `${(visible * 100).toFixed(0)}% of its box is ink the card put on the real frame`,
        );
      }

    }

    /* ---- the sky ----------------------------------------------------- */

    /*
     * The sky is the one colour on the page that is not a project, and the one
     * sanctioned exception to the colour rule. Two things have to be true of it
     * and neither is observable from CSS.
     *
     * **It arrives when the head opens.** That is the entire reason the layer
     * exists — the brief's reveal, absent from the page for as long as it was
     * deleted. A sky that is simply always there is a blue shape behind a
     * portrait, and it would look completely correct in a screenshot.
     *
     * **It is behind the cards**, because a card comes *out of* it. This is the
     * mirror of the check that the rest of the head is in front, and it is why
     * the head is two elements: the two halves sit on opposite sides of the
     * showcase and cannot share a stacking context.
     */
    const skyInk = async (at) => {
      await ev(`window.scrollTo(0, ${Math.round(at * pin)})`);
      await sleep(900);
      const a = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync('/tmp/hub-sky-on.png', Buffer.from(a.data, 'base64'));
      await ev(`document.querySelector('.head-sky').style.visibility = 'hidden'`);
      await sleep(150);
      const b = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync('/tmp/hub-sky-off.png', Buffer.from(b.data, 'base64'));
      await ev(`document.querySelector('.head-sky').style.visibility = ''`);
      return Number(
        execFileSync('magick', ['/tmp/hub-sky-on.png', '/tmp/hub-sky-off.png',
          '-compose', 'difference', '-composite', '-colorspace', 'Gray',
          '-format', '%[fx:mean]', 'info:']).toString().trim(),
      );
    };

    const skyAtRest = await skyInk(0);
    const skyWhenOpen = await skyInk(0.2);
    check(
      'the colour arrives when the head opens',
      skyAtRest < 0.002 && skyWhenOpen > skyAtRest * 10,
      `the sky contributes ${(skyAtRest * 100).toFixed(2)}% of the frame's ink at rest` +
        ` and ${(skyWhenOpen * 100).toFixed(2)}% once it is open`,
    );

    /*
     * And the cards are in front of it. Two halves again, because either alone
     * passes on a broken page: inside the queued card's own image the sky must
     * be invisible, and immediately around that image it must not be — the
     * first says the card wins, the second says there was a sky there to win
     * against.
     *
     * At a *queue* frame, not the one the reveal was measured at. The first
     * version reused the 0.2 frames and reported 0.00% and 0.0% — a pass on the
     * first half and a fail on the second, which was the check correctly
     * refusing to draw a conclusion: at 0.2 the only unsettled card is the
     * first one in mid-flight, well clear of the sky, so there was no
     * contention to judge either way.
     */
    await skyInk(0.28);
    const overCard = JSON.parse(await ev(`(() => {
      const q = [...document.querySelectorAll('.card')].filter(c => {
        const cs = getComputedStyle(c);
        if (cs.visibility !== 'visible' || Number(cs.opacity) < 0.5) return false;
        const m = new DOMMatrixReadOnly(cs.transform);
        return !(Math.abs(m.a - 1) < 0.04 && Math.abs(m.e) < 24 && Math.abs(m.f) < 24);
      });
      const img = q[0] && q[0].querySelector('img');
      if (!img) return 'null';
      const r = img.getBoundingClientRect();
      /*
       * A fifth of the image, not 26px. The queued card is a fraction of the
       * settled one, and the settled one is now sized off the viewport — so on a
       * short window the queued crop is only ~64px tall and a fixed 26px inset
       * from every edge leaves a 12px strip, below the 40px floor below. The
       * check then reported "no queued card image to test against" on a page
       * where the cards were in front of the sky exactly as they should be:
       * a measurement failing because the ruler stopped fitting.
       */
      const pad = Math.max(8, Math.round(Math.min(r.width, r.height) * 0.2));
      return JSON.stringify({
        inner: [Math.round(r.width - pad * 2), Math.round(r.height - pad * 2),
                Math.round(r.left + pad), Math.round(r.top + pad)],
        outer: [Math.round(r.width + pad * 2), Math.round(r.height + pad * 2),
                Math.round(r.left - pad), Math.round(r.top - pad)],
      });
    })()`));
    if (!overCard || overCard.inner[0] < 40 || overCard.inner[1] < 40) {
      check('the cards are in front of the sky', false, 'no queued card image to test against');
    } else {
      /* Frames from the 0.28 pass above, still on disk and still current. */
      const meanOver = (box) => Number(
        execFileSync('magick', ['/tmp/hub-sky-on.png', '/tmp/hub-sky-off.png',
          '-compose', 'difference', '-composite', '-colorspace', 'Gray',
          '-crop', `${box[0]}x${box[1]}+${box[2]}+${box[3]}`, '+repage',
          '-format', '%[fx:mean]', 'info:']).toString().trim(),
      );
      const inside = meanOver(overCard.inner);
      const around = meanOver(overCard.outer);
      check(
        'the cards are in front of the sky',
        inside < 0.002 && around > 0.02,
        `hiding the sky changes ${(inside * 100).toFixed(2)}% inside the queued card's image` +
          ` and ${(around * 100).toFixed(1)}% around it`,
      );
    }

    let maxSettled = 0;
    let holdsSeen = 0;
    let emptyFrames = 0;
    let crossovers = 0;
    const lonelyHolds = [];
    const SAMPLES = 32;
    for (let i = 0; i <= SAMPLES; i++) {
      /*
       * From just after the first card's birth to just before the head starts
       * leaving. *Just* after: sampling the birth frame itself catches the
       * first frame of a fade-in, where opacity is 0 by definition, and reports
       * an empty stage that says nothing about the sequence. It did, the first
       * time this ran.
       */
      const at = 0.05 + (i / SAMPLES) * 0.85;
      await ev(`window.scrollTo(0, ${Math.round(at * pin)})`);
      await sleep(280);
      const s = JSON.parse(await ev(`(() => {
        const all = [...document.querySelectorAll('.card')];
        let settled = 0, visible = 0, settledIndex = -1;
        all.forEach((c, i) => {
          const cs = getComputedStyle(c);
          if (cs.visibility !== 'visible' || Number(cs.opacity) < 0.05) return;
          visible++;
          const m = new DOMMatrixReadOnly(cs.transform);
          /* At rest: no scale, no rotation, no offset. m.a is scale*cos(rot). */
          if (Number(cs.opacity) > 0.9 && Math.abs(m.a - 1) < 0.04 &&
              Math.abs(m.e) < 24 && Math.abs(m.f) < 24) { settled++; settledIndex = i; }
        });
        return JSON.stringify({ settled, visible, settledIndex, total: all.length });
      })()`));
      maxSettled = Math.max(maxSettled, s.settled);
      if (s.settled === 1) holdsSeen++;
      if (s.visible === 0) emptyFrames++;
      if (s.settled === 1 && s.visible > 1) crossovers++;
      /*
       * The requirement, stated exactly: whenever a card is on stage, the next
       * one is already visible. Excludes the last card, which has no next.
       */
      if (s.settled === 1 && s.settledIndex < s.total - 1 && s.visible < 2) {
        lonelyHolds.push(`${(at * 100).toFixed(0)}%`);
      }
    }
    check(
      'never more than one card is settled on stage',
      maxSettled <= 1,
      `peak ${maxSettled} across ${SAMPLES + 1} samples`,
    );
    check(
      'and there is a card on stage for most of the sequence',
      holdsSeen >= 16,
      `${holdsSeen}/${SAMPLES + 1} samples`,
    );
    /*
     * The two halves of the overlap, asserted separately because they fail for
     * opposite reasons. An empty frame means the stride outran the slot and the
     * screen goes blank mid-scroll; no crossover means the stride is so long
     * that each card lives and dies alone, which is the sequence this replaced.
     */
    check(
      'the stage is never empty mid-sequence',
      emptyFrames === 0,
      `${emptyFrames} blank samples`,
    );
    check(
      'the next card is already climbing while the current one is read',
      crossovers >= 3,
      `${crossovers} samples with one card settled and another in flight`,
    );
    /*
     * The strong form, and the one Kim actually asked for — twice. The count
     * above only says the overlap happens *somewhere*; a sequence can satisfy it
     * and still leave you scrolling through most of a hold looking at one card
     * on an empty page, which is exactly what the first two attempts did. This
     * says it happens **every time**: no sample may find a card on stage with
     * nothing behind it, unless it is the last card, which has no next.
     */
    check(
      'a card is never alone on stage while another is still to come',
      lonelyHolds.length === 0,
      lonelyHolds.length
        ? `alone at ${lonelyHolds.join(', ')} of the pin`
        : `${holdsSeen} holds sampled, every one with the next card already showing`,
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
     *
     * **It is cropped to the card's own columns first**, and that is not a
     * refinement — the uncropped version is wrong now. It compared the head's
     * topmost pixel *anywhere in the frame* against the card's bottom, which
     * only holds while the tallest thing on the artboard is directly behind the
     * card. That was true when this only ran at the settled poses. Extending it
     * into the swing broke it immediately: mid-flip the highest ink is the hair
     * sweeping out to the right, several hundred pixels clear of the card in x,
     * and the check reported a 254px collision between two things that never
     * touch. Cropping to the card's span asks the question the design actually
     * cares about — is there head *underneath this card*.
     */
    const headTopUnderCard = async (holdAt) => {
      await ev(`window.scrollTo(0, ${Math.round(holdAt * pin)})`);
      await sleep(900);
      /*
       * The **settled** card, and the columns it occupies — not the lowest
       * visible one, which is a different and much dumber question now that
       * cards overlap. A card in flight is *born inside his head*: it starts at
       * the mouth of the opening and climbs out. Asking whether it overlaps the
       * head is asking whether it came out of the head, and the answer had
       * better be yes. Only a card that has arrived owes the head clearance.
       */
      const card = JSON.parse(await ev(`(() => {
        const c = [...document.querySelectorAll('.card')].find(x => {
          const cs = getComputedStyle(x);
          if (cs.visibility !== 'visible' || Number(cs.opacity) <= 0.9) return false;
          const m = new DOMMatrixReadOnly(cs.transform);
          return Math.abs(m.a - 1) < 0.04 && Math.abs(m.e) < 24 && Math.abs(m.f) < 24;
        });
        if (!c) return 'null';
        const r = c.getBoundingClientRect();
        const sky = document.querySelector('.showcase').getBoundingClientRect();
        const left = Math.max(0, Math.round(r.left));
        return JSON.stringify({
          top: r.top,
          bottom: r.bottom,
          skyTop: sky.top,
          skyBottom: sky.bottom,
          left,
          width: Math.min(window.innerWidth - left, Math.round(r.width)),
          h: window.innerHeight,
        });
      })()`));
      if (!card) return null;
      /*
       * The sky is hidden for this measurement, and that is a claim rather than
       * a convenience. What the card must not cover is the *drawing* — his
       * forehead and the swung cap, the failure this check was written for
       * twice. The sky is the hole, it sits behind the cards by design, and a
       * card in front of the colour it came out of is the arrangement working.
       * Leaving it in made the check report a 0px clearance against a layer the
       * card is supposed to overlap.
       */
      await ev(`document.querySelector('.showcase').style.visibility = 'hidden';
                document.querySelector('.head-sky').style.visibility = 'hidden';`);
      await sleep(120);
      const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync('/tmp/hub-headtop.png', Buffer.from(shot.data, 'base64'));
      await ev(`document.querySelector('.showcase').style.visibility = '';
                document.querySelector('.head-sky').style.visibility = '';`);
      await sleep(120);
      const out = execFileSync('magick', [
        '/tmp/hub-headtop.png',
        '-crop', `${card.width}x${card.h}+${card.left}+0`, '+repage',
        '-fuzz', '4%', '-trim',
        '-format', '%[fx:page.y]', 'info:',
      ]).toString().trim();
      /* An all-paper column trims to nothing; magick reports 0. Treat it as
         "no head in this column", which is the roomiest possible answer. */
      const top = Number(out);
      return {
        top: Number.isFinite(top) && top > 0 ? top : card.h,
        bottom: card.bottom,
        cardTop: card.top,
        skyTop: card.skyTop,
        skyBottom: card.skyBottom,
      };
    };

    let worstGap = Infinity;
    let tightest = null;
    let worstFit = Infinity;
    let tightestFit = null;
    /*
     * Mid-hold for every card — see the slot arithmetic in `choreography.ts`.
     * These move whenever the stride does, and a sample that lands outside a
     * hold is skipped rather than silently measuring a card in flight.
     *
     * Card one's hold is the one that matters most now and is new: it settles
     * at unit 15, while the lid is still swinging and the head still sinking.
     * Every earlier version of this sequence had the mechanism finished before
     * a card arrived, so the tightest clearance was always the same static
     * pose. It is a moving target now.
     */
    let sampled = 0;
    for (const hold of [0.28, 0.43, 0.58, 0.73, 0.88]) {
      const m = await headTopUnderCard(hold);
      if (!m) continue;
      sampled++;
      if (m.top - m.bottom < worstGap) {
        worstGap = m.top - m.bottom;
        tightest = m;
      }
      const fit = Math.min(m.cardTop - m.skyTop, m.skyBottom - m.bottom);
      if (fit < worstFit) {
        worstFit = fit;
        tightestFit = m;
      }
    }
    if (sampled < 4) check('the clearance samples land on holds', false, `only ${sampled}/5 found a settled card`);
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
     * And the card still fits the sky it is centred in.
     *
     * This is new because the card is new. For most of this build it was a flat
     * `30rem` and only its bottom edge could move, so its bottom edge was the
     * only thing ever asked about. It is sized off the viewport now —
     * `min(max(46vw, 23rem), 62vh)` — so it grows until something stops it, and
     * the `62vh` ceiling is *arithmetic*: it assumes a caption of about 116px
     * that no viewport unit knows the height of. If that assumption is wrong the
     * card is simply too tall for the reservation, and this is what says so.
     *
     * The obvious version of this check was wrong and the sabotage caught it. It
     * asked whether the card's top had gone above the stage, and the answer is
     * that it never can: grid clamps an overflowing centred item to the start
     * edge rather than letting it hang off both ends, so `top` sticks at the
     * 1rem padding no matter how big the card gets. The check passed on a card
     * more than 100px too tall — decoration, by this file's own standard.
     *
     * So it asks about the reservation instead, which is the thing the size was
     * derived from: both edges of the card inside `.showcase`, whose height is
     * `LIP_END_VH - HEAD_OPEN_RISE * canvas-h`. An oversized card breaks it at
     * the bottom, where the consequence lives, and it breaks it long before the
     * head-clearance check above notices — that one still read a passing 12px on
     * a card this one failed by 113px, because the head's real ink sits well
     * inside the sky the layout reserves for it.
     */
    check(
      'the card on stage fits the sky reserved for it',
      worstFit >= 0,
      tightestFit
        ? `tightest edge ${Math.round(worstFit)}px inside the reservation ` +
          `(card ${Math.round(tightestFit.cardTop)}–${Math.round(tightestFit.bottom)}, ` +
          `sky ${Math.round(tightestFit.skyTop)}–${Math.round(tightestFit.skyBottom)})`
        : 'no settled card to measure',
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
    const offenders = await ev(COLOUR_RULE);
    check(
      'nothing painted on the page is off the paper-to-ink line',
      JSON.parse(offenders).length === 0,
      JSON.parse(offenders).join(' | '),
    );

    /*
     * The mono face actually resolves.
     *
     * `--font-mono` is a name Tailwind also defines. While the tokens lived in
     * an `@theme` block they replaced its default inside the theme layer; as
     * plain `:root` in `tokens.css` they win on source order instead, which
     * holds only while that `@import` stays after Tailwind's. Swap the two and
     * every `.mono` element falls back to the system monospace — a change
     * nothing else here would notice, because a system mono still passes every
     * other assertion in this file and still looks like a monospace.
     */
    check(
      'the mono face is IBM Plex Mono, not the system fallback',
      await ev(`getComputedStyle(document.querySelector('.mono')).fontFamily.includes('IBM Plex Mono')`),
      await ev(`getComputedStyle(document.querySelector('.mono')).fontFamily`),
    );

    /* ---- the crops --------------------------------------------------- */

    /*
     * The five crops are the only colour on the page, and until now nothing
     * here looked at them.
     *
     * That was a real hole rather than a theoretical one. `.card-frame img`
     * sets `object-fit: cover` under `aspect-ratio: 3/2`, which is a pair
     * chosen to make the frame identical whatever it is handed — so a 4:3
     * capture, a portrait phone screenshot and a 404 all render as a
     * confidently-framed card, and the geometry assertions above keep passing
     * because they measure the frame rather than what is in it.
     *
     * The file list is read off the document, not restated here: a spoke added
     * to `spokes.ts` without a crop fails rather than goes unchecked.
     */
    const crops = JSON.parse(await ev(`(async () => {
      const pictures = [...document.querySelectorAll('.card-frame picture')];
      const bad = [];

      /* Mean RGB of a decoded image, on a small fixed grid so the two formats
         are compared at the same resolution and the cost is trivial. */
      const signature = async (blob) => {
        const bmp = await createImageBitmap(blob).catch(() => null);
        if (!bmp) return null;
        const N = 32;
        const c = new OffscreenCanvas(N, N);
        const ctx = c.getContext('2d');
        ctx.drawImage(bmp, 0, 0, N, N);
        return { w: bmp.width, h: bmp.height, px: [...ctx.getImageData(0, 0, N, N).data] };
      };

      for (const pic of pictures) {
        const png = pic.querySelector('img')?.getAttribute('src');
        const avif = pic.querySelector('source[type="image/avif"]')?.getAttribute('srcset');
        if (!png || !avif) { bad.push('a card is missing one of its two formats'); continue; }

        const sigs = {};
        for (const [fmt, href] of [['png', png], ['avif', avif]]) {
          const r = await fetch(href).catch(() => null);
          if (!r || !r.ok) { bad.push(href + ' -> ' + (r ? r.status : 'failed')); continue; }
          const type = r.headers.get('content-type') || '';
          if (!type.includes(fmt)) { bad.push(href + ' -> ' + type + ', wanted image/' + fmt); continue; }
          const s = await signature(await r.blob());
          if (!s) { bad.push(href + ' -> did not decode'); continue; }
          /* 900x600 is the contract crops.sh writes and the width/height the
             <img> declares; anything else reflows the card or gets silently
             absorbed by object-fit. */
          if (s.w !== 900 || s.h !== 600) {
            bad.push(href + ' is ' + s.w + 'x' + s.h + ', wanted 900x600');
            continue;
          }
          sigs[fmt] = s;
        }

        /*
         * And the two formats have to be the same picture.
         *
         * This is the failure crops.sh warns about in prose and nothing has
         * ever checked: <source> offers AVIF first, so re-deriving the PNG and
         * forgetting the AVIF ships the *old* image to every browser while the
         * file you just looked at sits there unused. Dimensions cannot see it —
         * both are 900x600 — so compare the pixels. AVIF at q62 is lossy, so
         * the threshold is generous; two different screenshots of the same site
         * land far above it.
         */
        if (sigs.png && sigs.avif) {
          let sum = 0;
          for (let i = 0; i < sigs.png.px.length; i += 4) {
            sum += Math.abs(sigs.png.px[i] - sigs.avif.px[i])
                 + Math.abs(sigs.png.px[i + 1] - sigs.avif.px[i + 1])
                 + Math.abs(sigs.png.px[i + 2] - sigs.avif.px[i + 2]);
          }
          const mad = sum / (32 * 32 * 3);
          if (mad > 6) bad.push(png + ' and its AVIF differ by ' + mad.toFixed(1) + ' per channel — one is stale');
        }
      }
      return JSON.stringify({ n: pictures.length, bad });
    })()`));
    check(
      'every crop is 900x600 in both formats, and the two are the same picture',
      crops.n === SPOKES.length && crops.bad.length === 0,
      crops.bad.length ? crops.bad.join('; ') : `${crops.n} crops, both formats, PNG and AVIF agree`,
    );

    /* ---- the case studies ------------------------------------------- */

    /*
     * Five reading pages at `/work/<spoke>/`, generated from each spoke's own
     * CASE-STUDY.md. They are the portfolio's argument in prose, and they are
     * the only pages here that carry no JavaScript at all — so most of what
     * follows is asserting an absence.
     *
     * Fonts are accumulated across all six pages and judged once, after the
     * loop.
     *
     * The first version of this compared each case study's fonts against the
     * homepage's and demanded a subset — which failed immediately and
     * correctly: the reading pages fetch the italic and the homepage has no
     * italics to fetch. That was the wrong instrument. *Which* faces a page
     * downloads depends on the glyphs it sets; the claim worth checking is
     * that the whole site emits **one hashed copy per face**, which is the
     * entire reason `tokens.css` was extracted rather than duplicated. A
     * second `@font-face` in a second stylesheet would emit the same bytes
     * under a second hash, double the download for anyone reading both, and
     * look identical on every page.
     */
    const allFonts = new Set(
      JSON.parse(
        await ev(`JSON.stringify(performance.getEntriesByType('resource')
          .map(r => new URL(r.name).pathname).filter(p => p.endsWith('.woff2')))`),
      ),
    );

    for (const s of SPOKES) {
      const url = new URL(`/work/${s.id}/`, URL_ARG).href;
      await load({ reduce: false, url, settle: 400 });

      check(
        `${s.id}: serves its own page, in UTF-8`,
        await ev(`(() => {
          const c = document.querySelector('link[rel="canonical"]')?.href;
          return c === ${JSON.stringify(`https://kimnejudne.dev/work/${s.id}/`)}
            && document.title.includes(${JSON.stringify(s.name)})
            && document.characterSet === 'UTF-8';
        })()`),
        await ev(`document.title`),
      );

      /*
       * The charset half of that matters more than it looks. `hub.conf` sets
       * no `charset` directive, so these documents arrive as `text/html` with
       * no charset parameter and the browser has only the meta tag to go on.
       * Every one of these files is full of em dashes, `·`, `Σ`, `×` and the
       * `é` in PokéTrack. This catches the other end of the same pipe: a
       * `readFileSync` without `'utf8'`, or a write in latin1.
       */
      check(
        `${s.id}: no mojibake survived the pipeline`,
        await ev(`!/\\uFFFD|Ã.|â€/.test(document.body.textContent)`),
      );

      /*
       * The markdown was parsed rather than pasted. A substitution bug that
       * dropped the rendered HTML in as text would still produce a page with a
       * title, a stylesheet and roughly the right length — and it would be
       * obvious to a human and invisible to every other check here.
       */
      check(
        `${s.id}: the case study rendered as markup, not as source`,
        await ev(`(() => {
          const b = document.querySelector('.cs-body');
          if (!b) return false;
          const t = b.textContent;
          return t.length > 4000 && !t.includes('\\u0060\\u0060\\u0060') && !t.includes('](http')
            && b.querySelectorAll('h2').length >= 3 && !!b.querySelector('.cs-lede');
        })()`),
        `${await ev(`document.querySelector('.cs-body').textContent.length`)} chars`,
      );

      /*
       * The disclosure, checked against the rendered DOM.
       *
       * `scripts/case-studies.mjs` runs the same rule over the source markdown
       * and refuses to build without it, but that is the cheap half. This is
       * the half that matters: what a reader is actually served. Both import
       * `case-study/policy.mjs`, so there is one rule rather than two.
       *
       * Reconstructing markdown from the DOM would be silly, so the sections
       * are read back out of the page and handed to the same function in the
       * shape it expects.
       */
      const sections = JSON.parse(
        await ev(`JSON.stringify([...document.querySelectorAll('.cs-body h2')].map(h => {
          let t = '', n = h.nextElementSibling;
          while (n && n.tagName !== 'H2') { t += ' ' + n.textContent; n = n.nextElementSibling; }
          return { heading: h.textContent.trim(), body: t.trim() };
        }))`),
      );
      const asMarkdown = sections.map((x) => `## ${x.heading}\n\n${x.body}`).join('\n\n');
      const wrong = checkDisclosure(asMarkdown);
      check(`${s.id}: the AI-scaffold origin is disclosed plainly`, wrong === null, wrong ?? '');

      /*
       * Nothing runs, and none of the 7MB of head art is fetched. These pages
       * are HTML and one stylesheet; the whole argument for hosting them here
       * rather than inside the SPA is that they cost nothing to read.
       */
      const runtime = JSON.parse(
        await ev(`JSON.stringify({
          scripts: document.querySelectorAll('script').length,
          gsap: typeof window.gsap,
          scripted: performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script').length,
          head: performance.getEntriesByType('resource').filter(r => new URL(r.name).pathname.startsWith('/head/')).length,
        })`),
      );
      check(
        `${s.id}: nothing runs and no head art loads`,
        runtime.scripts === 0 &&
          runtime.gsap === 'undefined' &&
          runtime.scripted === 0 &&
          runtime.head === 0,
        JSON.stringify(runtime),
      );

      const weight = await ev(`(() => {
        const rs = performance.getEntriesByType('resource').reduce((n, r) => n + (r.transferSize || 0), 0);
        const doc = performance.getEntriesByType('navigation')[0]?.transferSize || 0;
        return Math.round((rs + doc) / 1024);
      })()`);
      check(`${s.id}: the page is under 250KB over the wire`, weight < 250, `${weight}KB`);

      const pageFonts = JSON.parse(
        await ev(`JSON.stringify(performance.getEntriesByType('resource')
          .map(r => new URL(r.name).pathname).filter(p => p.endsWith('.woff2')))`),
      );
      pageFonts.forEach((f) => allFonts.add(f));
      check(
        `${s.id}: its faces are hashed build assets`,
        pageFonts.length > 0 && pageFonts.every((f) => f.startsWith('/assets/')),
        pageFonts.map((f) => f.replace('/assets/', '')).join(', ') || 'no faces fetched',
      );

      const csOffenders = await ev(COLOUR_RULE);
      check(
        `${s.id}: nothing painted is off the paper-to-ink line`,
        JSON.parse(csOffenders).length === 0,
        JSON.parse(csOffenders).join(' | '),
      );

      /*
       * A way back and a way out. These are the deepest pages on the site and
       * the likeliest to be opened cold from a link somebody was sent, with no
       * history to go back through.
       */
      /*
       * The skip link reveals itself on focus.
       *
       * Worth its own assertion because it is unfalsifiable by eye: the link
       * is parked off-screen at `left: -9999px` and only `:focus` brings it
       * back, and `:focus` does not match unless the *document* has focus — so
       * clicking around a page in a background window shows nothing wrong
       * whether the rule works or not. A headless run is focused, which makes
       * this one of the few places the question can actually be asked.
       */
      check(
        `${s.id}: the skip link reveals itself on focus and points at the prose`,
        await ev(`(() => {
          const skip = document.querySelector('.skip');
          if (!skip) return false;
          const target = document.querySelector(skip.getAttribute('href'));
          if (!target || target.getBoundingClientRect().height <= 0) return false;
          const hidden = skip.getBoundingClientRect();
          skip.focus();
          const shown = skip.getBoundingClientRect();
          skip.blur();
          return hidden.right <= 0 && shown.left >= 0 && shown.width > 0;
        })()`),
      );

      const otherIds = SPOKES.filter((o) => o.id !== s.id).map((o) => `/work/${o.id}/`);
      check(
        `${s.id}: links home, to its spoke, and to the other four`,
        await ev(`(() => {
          const back = !!document.querySelector('a[href="/#work"]');
          const live = [...document.querySelectorAll('a')].some(a => a.href === ${JSON.stringify(s.href)});
          const others = [...document.querySelectorAll('.cs-others-link')].map(a => new URL(a.href).pathname).sort();
          const want = ${JSON.stringify(otherIds.slice().sort())};
          return back && live && others.length === 4 && others.every((p, i) => p === want[i]);
        })()`),
      );

      /*
       * No horizontal overflow on a phone.
       *
       * PLINTH's own case study — one of the five documents this renders — is
       * partly about shipping a page with two horizontal scrollbars and a
       * 4,320px document, so this is that lesson turned into a gate. It is the
       * assertion most likely to fire while editing: the longest inline code
       * span in the corpus is 69 characters and the longest fenced line is 84,
       * and either will widen a 390px page if the stylesheet stops handling
       * them.
       *
       * The second half is what stops it being satisfiable the wrong way.
       * `overflow-x: hidden` on `body` would silence the first half while
       * leaving the content just as unreachable, so anything genuinely wider
       * than the viewport has to be a `pre` or a `.cs-scroll` — an element that
       * scrolls on purpose, and that a keyboard can reach.
       */
      await load({ reduce: false, url, width: 390, height: 780, settle: 400 });
      const narrow = JSON.parse(
        await ev(`JSON.stringify((() => {
          const d = document.documentElement;
          const wide = [...document.querySelectorAll('body *')]
            .filter(e => e.getBoundingClientRect().width > d.clientWidth + 1)
            .filter(e => !(e.tagName === 'PRE' || e.classList.contains('cs-scroll')))
            .map(e => e.tagName + '.' + e.className);
          return { scrollW: d.scrollWidth, clientW: d.clientWidth, wide: [...new Set(wide)].slice(0, 5) };
        })())`),
      );
      check(
        `${s.id}: no horizontal overflow at 390px`,
        narrow.scrollW <= narrow.clientW + 1 && narrow.wide.length === 0,
        narrow.wide.length ? narrow.wide.join(' | ') : `${narrow.scrollW}px in ${narrow.clientW}px`,
      );
    }

    /*
     * One hashed copy per face across the whole site.
     *
     * Vite appends an 8-character hash before the extension, so stripping it
     * leaves the face's own name. Two hashes under one name means the same
     * bytes were emitted twice — which is exactly what happens if a stylesheet
     * declares its own `@font-face` instead of importing `src/tokens.css`.
     */
    const byFace = new Map();
    for (const f of allFonts) {
      const face = f.replace(/^\/assets\//, '').replace(/-[A-Za-z0-9_-]{8}\.woff2$/, '');
      byFace.set(face, [...(byFace.get(face) ?? []), f]);
    }
    const duplicated = [...byFace].filter(([, urls]) => urls.length > 1);
    check(
      'every face is emitted once and shared by all six pages',
      duplicated.length === 0 && byFace.size > 0,
      duplicated.length
        ? duplicated.map(([face, urls]) => `${face} x${urls.length}`).join(' | ')
        : `${byFace.size} faces: ${[...byFace.keys()].join(', ')}`,
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
