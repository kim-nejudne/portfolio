/**
 * Photograph the six beats at real scroll positions.
 *
 * Why this exists rather than a browser extension driving a visible window:
 * a backgrounded tab throttles `requestAnimationFrame` to nothing, and GSAP's
 * ticker rides on it. Screenshots of a throttled tab show a timeline frozen
 * partway through catching up, which looks exactly like a choreography bug and
 * is not one. Twenty minutes went into that mistake. Headless Chrome driven
 * over the DevTools Protocol runs its ticker at full speed and takes the same
 * scroll positions every time, so a diff between two runs means the animation
 * changed rather than the weather.
 *
 * Usage: node scripts/shoot-beats.mjs <url> [outDir]
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_ARG = process.argv[2] ?? 'http://localhost:4501/';
const OUT = process.argv[3] ?? '/tmp/hub-beats';
const PORT = 9333;

/**
 * The beats, as fractions of the pinned scroll. Mirrors BEATS in src — the
 * timeline is `TOTAL` units long and scrubbed across the whole pin, so a beat
 * at unit *n* is at fraction *n*/100 and these can be read straight off
 * `choreography.ts` rather than hunted for.
 *
 * `2-look` and `3-beat` used to sit between the lid and the first card. The
 * first went with the eye layers and the second went with the pause it was
 * named after.
 */
const SHOTS = [
  ['0-rest', 0],
  ['1-card1-emerges', 0.05],
  /* The constraint the sequence was re-timed around: the first card is already
     visible when the lid passes vertical. */
  ['1-lid-90', 0.08],
  ['1-card1-flies', 0.16],
  /* The lid finishes *after* the first card has arrived, which is new. */
  ['1-lid-open', 0.22],
  /* The steady state, and the point of the whole arrangement: one card on
     stage, the next already waiting in the opening. */
  ['4-card1-hold-card2-queued', 0.28],
  ['4-crossover', 0.33],
  ['4-card2-hold', 0.43],
  ['4-card3-hold', 0.58],
  ['4-card4-hold', 0.73],
  ['4-card5-hold', 0.88],
  ['5-end', 1.0],
];

const VIEWPORTS = [
  ['desktop', 1440, 900],
  ['phone', 390, 844],
];

let nextId = 1;

function rpc(ws, method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const chrome = spawn(
    'chromium',
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${PORT}`,
      '--user-data-dir=/tmp/hub-shoot-profile',
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
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    await rpc(ws, 'Page.enable');
    await rpc(ws, 'Runtime.enable');

    for (const [device, width, height] of VIEWPORTS) {
      await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: device === 'phone',
      });

      await rpc(ws, 'Page.navigate', { url: URL_ARG });
      await sleep(2500); // load, fonts, first paint, ScrollTrigger's first refresh

      const { result } = await rpc(ws, 'Runtime.evaluate', {
        expression: `(() => {
          const s = document.querySelector('.pin-spacer');
          const stage = document.querySelector('.stage');
          return JSON.stringify({
            pin: s ? s.getBoundingClientRect().height - stage.getBoundingClientRect().height : 0,
            ready: stage.hasAttribute('data-ready'),
          });
        })()`,
        returnByValue: true,
      });
      const { pin, ready } = JSON.parse(result.value);
      if (!ready || pin <= 0) throw new Error(`${device}: timeline never built (pin=${pin})`);
      console.log(`${device}: pinned scroll ${Math.round(pin)}px`);

      for (const [name, at] of SHOTS) {
        await rpc(ws, 'Runtime.evaluate', {
          expression: `window.scrollTo(0, ${Math.round(at * pin)})`,
        });
        /* Long enough for a 0.4s scrub to land, and then some. */
        await sleep(1200);
        const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
        writeFileSync(`${OUT}/${device}-${name}.png`, Buffer.from(shot.data, 'base64'));
      }
      console.log(`${device}: ${SHOTS.length} frames -> ${OUT}`);
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
