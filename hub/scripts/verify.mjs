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
     * The head is in front of the cards, and both halves of that need proving
     * in pixels because both halves can fail silently.
     *
     * A z-index is trivially readable from the computed styles and says almost
     * nothing — stacking contexts, `will-change` and transforms all rearrange
     * what it means, and this project has already shipped one bug where a
     * `will-change` quietly changed what a rendering property did. So neither
     * of these looks at CSS. They photograph the frame twice, once with the
     * showcase hidden, and ask what the *cards* actually contributed where.
     *
     *   below the crown — nothing, or the card is printed on his face
     *   above the crown — something, or the drawing has swallowed the card and
     *                     "the next card is already visible" is a lie
     *
     * Run at whichever queue frame has the most at stake, **found rather than
     * chosen**. A hand-picked scroll position has drifted three times in a
     * single afternoon of re-timing, and the failure mode is silent: the
     * constant still names a legal frame, the check still passes, and it is no
     * longer looking at the pose it was written for. So probe the stretch where
     * a card is waiting in the opening and keep the frame where the card and
     * the drawing actually fight over the most pixels.
     */
    const probeFrames = [0.06, 0.1, 0.14, 0.22, 0.26, 0.3];
    const readQueued = async () => JSON.parse(await ev(`(() => {
      const q = [...document.querySelectorAll('.card')].filter(c => {
        const cs = getComputedStyle(c);
        if (cs.visibility !== 'visible' || Number(cs.opacity) < 0.5) return false;
        const m = new DOMMatrixReadOnly(cs.transform);
        return !(Math.abs(m.a - 1) < 0.04 && Math.abs(m.e) < 24 && Math.abs(m.f) < 24);
      });
      if (q.length !== 1) return 'null';
      const r = q[0].getBoundingClientRect();
      const h = document.querySelector('.head').getBoundingClientRect();
      const left = Math.max(0, Math.round(r.left));
      return JSON.stringify({
        left, width: Math.min(window.innerWidth - left, Math.round(r.width)),
        top: Math.round(r.top), bottom: Math.round(r.bottom), headTop: Math.round(h.top),
      });
    })()`));
    const shot = async (file) => {
      const s = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(s.data, 'base64'));
    };
    const hide = (sel, on) =>
      ev(`document.querySelector('${sel}').style.visibility = '${on ? 'hidden' : ''}'`);

    let best = null;
    for (const frameAt of probeFrames) {
      await ev(`window.scrollTo(0, ${Math.round(frameAt * pin)})`);
      await sleep(700);
      const queued = await readQueued();
      if (!queued) continue;

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

      /*
       * Judge the **contended pixels** — the ones where the head and a card
       * would both paint — and ask which of them the real frame agrees with.
       *
       * Two earlier versions of this measured the wrong thing, and the second
       * failure is the instructive one. Taking the head's topmost row as a
       * horizon and calling everything below it "head" ignored that his tear is
       * a hand-drawn wave: most of that band is bare paper the card may
       * perfectly well paint on, so it failed a correct page. Replacing the
       * horizon with a real silhouette fixed that but still measured *how much
       * ink changed*, and putting the head back behind the cards moved the
       * number only from 0.00% to 0.25% — under the threshold, passing the
       * exact regression it existed to catch. The reason is that a card's body
       * and his paper are both pale, so an occlusion that is glaring to the eye
       * is nearly invisible as a difference in ink.
       *
       * Comparing against both candidate frames removes the judgement call.
       * Where the two contend, the composite matches one of them almost
       * exactly and the other hardly at all, and which is which *is* the
       * stacking order. No threshold has to be guessed.
       */
      const binaryDiff = (a, b, out, pct) =>
        execFileSync('magick', [a, b, '-compose', 'difference', '-composite',
          '-colorspace', 'Gray', '-threshold', pct, out]);
      binaryDiff('/tmp/hub-z-head.png', '/tmp/hub-z-bare.png', '/tmp/hub-z-m1.png', '2%');
      binaryDiff('/tmp/hub-z-cards.png', '/tmp/hub-z-bare.png', '/tmp/hub-z-m2.png', '2%');
      /* Contention: both would paint here. */
      execFileSync('magick', ['/tmp/hub-z-m1.png', '/tmp/hub-z-m2.png',
        '-compose', 'multiply', '-composite', '/tmp/hub-z-contended.png']);

      const box = `${queued.width}x${queued.bottom - queued.top}+${queued.left}+${queued.top}`;
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
       * In pixels, not as a fraction of the card's box. The box is mostly the
       * caption, which is transparent between the glyphs, and the card's solid
       * image body clears his crown entirely — so what actually contends is the
       * lettering crossing his scalp, and that is under 1% of the box however
       * unambiguous it looks on screen. A fraction-of-the-box guard called it
       * "nothing to judge" and refused to judge the very thing it was built for.
       */
      const contendedPx = Math.round(contendedArea * queued.width * (queued.bottom - queued.top));
      const clear = meanIn('/tmp/hub-z-m2.png') - contendedArea;
      if (!best || contendedPx > best.contendedPx) {
        best = { frameAt, contendedPx, offHead, offCards, clear };
      }
    }

    if (!best) {
      check('the head paints in front of the cards', false, 'no queued card found at any probe frame');
    } else {
      check(
        'the head paints in front of the cards',
        best.contendedPx > 150 && best.offHead < best.offCards * 0.25,
        best.contendedPx <= 150
          ? `only ${best.contendedPx}px of the card ever falls on him — nothing to judge`
          : `at ${(best.frameAt * 100).toFixed(0)}% of the pin, over the ${best.contendedPx}px where they ` +
            `contend the frame is ${best.offHead < best.offCards ? 'the head' : 'the card'}: ` +
            `off-head ${best.offHead.toFixed(4)} vs off-card ${best.offCards.toFixed(4)}`,
      );
      check(
        'and the queued card is still visible beside it',
        best.clear > 0.05,
        `${(best.clear * 100).toFixed(0)}% of its box is card ink clear of him`,
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
       * Needs its own scroll position rather than reusing the probe's. The
       * probe lands on maximum contention, which turns out to be the *first*
       * card emerging — and at that point nothing is on stage yet, so the test
       * had nothing to click and said so. "A queued card implies a settled one"
       * is true for cards two to five and false for the one the probe picks.
       */
      await ev(`window.scrollTo(0, ${Math.round(0.28 * pin)})`);
      await sleep(900);
      const hit = JSON.parse(await ev(`(() => {
        const c = [...document.querySelectorAll('.card')].find(x => {
          const cs = getComputedStyle(x);
          if (cs.visibility !== 'visible' || Number(cs.opacity) <= 0.9) return false;
          const m = new DOMMatrixReadOnly(cs.transform);
          return Math.abs(m.a - 1) < 0.04 && Math.abs(m.e) < 24 && Math.abs(m.f) < 24;
        });
        if (!c) return 'null';
        const r = c.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return JSON.stringify({
          ok: !!el && c.contains(el),
          got: el ? (el.getAttribute('class') || el.tagName) : 'nothing',
        });
      })()`));
      check(
        'the card on stage is still what a click lands on',
        hit && hit.ok,
        hit ? `hit test found "${hit.got}"` : 'no settled card to test',
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
        const left = Math.max(0, Math.round(r.left));
        return JSON.stringify({
          bottom: r.bottom,
          left,
          width: Math.min(window.innerWidth - left, Math.round(r.width)),
          h: window.innerHeight,
        });
      })()`));
      if (!card) return null;
      await ev(`document.querySelector('.showcase').style.visibility = 'hidden'`);
      await sleep(120);
      const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
      writeFileSync('/tmp/hub-headtop.png', Buffer.from(shot.data, 'base64'));
      await ev(`document.querySelector('.showcase').style.visibility = ''`);
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
      return { top: Number.isFinite(top) && top > 0 ? top : card.h, bottom: card.bottom };
    };

    let worstGap = Infinity;
    let tightest = null;
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
