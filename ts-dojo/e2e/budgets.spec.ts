// §12 F15: "Every budget in §9 is measured and recorded in `docs/progress.md`; any miss has a
// note." The `budgets` project (playwright.config.ts) runs this file alone, on demand:
//
//   pnpm test:e2e --project budgets
//   BUDGETS_URL=https://dojo.kimnejudne.dev pnpm test:e2e --project budgets   # the deployed site
//
// Locally the app is served by e2e/helpers/link-server.ts: nginx's headers and precompressed
// files over an emulated broadband link (50 Mbit/s shared, 30 ms per response). Every number is
// taken inside the page: User Timing marks for the loads (src/app/marks.ts: navigation start to
// the shell's global keys listening, and to the compiler's first `ready`), and for the
// interactions `performance.now()` in a key listener to `performance.now()` in a
// MutationObserver, never around Playwright's polling. The diagnostics clock starts at the last
// keyup (the `<Esc>` that ends the typed line). Where §9 says p95 (diagnostics) the p95 is
// asserted; elsewhere the worst run or sample.
// Each budget is a soft assertion, so one miss still lets every other number be measured; the
// summary is printed at the end and attached to each test.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Worker } from '@playwright/test';
import {
  ex,
  focusEditor,
  press,
  setDoc,
  type,
  waitForCompilerReady,
} from './helpers/editor';
import {
  LATENCY_MS,
  LINK_BITS_PER_SECOND,
  startLinkServer,
  type LinkServer,
} from './helpers/link-server';
import { DIST } from './helpers/preview-server';

/** §9 Budgets. MB are decimal, the stricter reading. */
const BUDGET = {
  coldShellMs: 2000,
  coldReadyMs: 5000,
  warmReadyMs: 1500,
  diagnosticsP95Ms: 300,
  quickInfoMs: 100,
  runMs: 150,
  workerHeapBytes: 250_000_000,
  // §9 says 15 MB. F14 (Kim's decision with the F14 plan, 23 October 2026; under Deviations in
  // docs/progress.md): Tier 4 and the pre-bundled packages measured 17,439,897 bytes, a noted
  // miss, and the threshold is that figure plus a margin for small content edits.
  precacheBytes: 18_000_000,
};
const COLD_RUNS = 5;
const WARM_RUNS = 5;
const DIAGNOSTIC_SAMPLES = 30;
const QUICK_INFO_SAMPLES = 20;
const RUN_SAMPLES = 20;
const WORKER_CHUNK = /\/assets\/worker-[^/]+\.js$/;
const FIXTURE = fileURLToPath(
  new URL(
    '../src/workers/ts-ls/fixtures/two-hundred-lines.ts.txt',
    import.meta.url,
  ),
);

const external = process.env['BUDGETS_URL'];
const results: Record<string, unknown> = {
  target:
    external ??
    `local dist/ over ${String(LINK_BITS_PER_SECOND / 1e6)} Mbit/s, ${String(LATENCY_MS)} ms per response`,
};

test.describe.configure({ mode: 'serial' });

let server: LinkServer | null = null;
let baseURL = external ?? '';
test.beforeAll(async () => {
  if (external === undefined) {
    server = await startLinkServer();
    baseURL = server.url;
  }
});
test.afterAll(async () => {
  await server?.close();
  console.log(`§9 budgets:\n${JSON.stringify(results, null, 2)}`);
});

function summary(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)] as number;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    n: sorted.length,
    median: round(at(0.5)),
    p95: round(at(0.95)),
    max: round(sorted.at(-1) as number),
    min: round(sorted[0] as number),
  };
}

async function attach(name: string): Promise<void> {
  await test.info().attach(`${name}.json`, {
    body: JSON.stringify(results[name], null, 2),
    contentType: 'application/json',
  });
}

/** The two load marks, once both are set (ms from navigation start). */
async function loadMarks(
  page: Page,
): Promise<{ shell: number; ready: number }> {
  const handle = await page.waitForFunction(
    () => {
      const at = (name: string) =>
        performance.getEntriesByName(name, 'mark')[0]?.startTime;
      const shell = at('ts-dojo:shell-interactive');
      const ready = at('ts-dojo:compiler-ready');
      return shell !== undefined && ready !== undefined
        ? { shell, ready }
        : null;
    },
    null,
    { timeout: 30_000 },
  );
  return (await handle.jsonValue()) as { shell: number; ready: number };
}

test('cold load: shell interactive under 2 s, compiler ready under 5 s', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const shell: number[] = [];
  const ready: number[] = [];
  for (let i = 0; i < COLD_RUNS; i += 1) {
    // A fresh context: no HTTP cache, no service worker, no storage.
    const context = await browser.newContext({
      baseURL,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto('/');
    const marks = await loadMarks(page);
    shell.push(marks.shell);
    ready.push(marks.ready);
    await context.close();
  }
  results['coldShellInteractiveMs'] = summary(shell);
  results['coldCompilerReadyMs'] = summary(ready);
  await attach('coldShellInteractiveMs');
  await attach('coldCompilerReadyMs');
  expect
    .soft(Math.max(...shell), 'cold shell interactive, worst run')
    .toBeLessThan(BUDGET.coldShellMs);
  expect
    .soft(Math.max(...ready), 'cold compiler ready, worst run')
    .toBeLessThan(BUDGET.coldReadyMs);
});

test('warm load from the service worker: compiler ready under 1.5 s; total precache under 15 MB', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    baseURL,
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  await page.goto('/');
  await waitForCompilerReady(page);
  // Registered once the compiler is ready; active once the whole precache is in.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active === null) throw new Error('no active worker');
  });

  const precache = await page.evaluate(async () => {
    let bytes = 0;
    let entries = 0;
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (response !== undefined) bytes += (await response.blob()).size;
        entries += 1;
      }
    }
    return { bytes, entries };
  });
  // Cross-check against the build: the files dist/sw.js lists, by size on disk.
  let built: { bytes: number; entries: number } | null = null;
  if (external === undefined) {
    const sw = await readFile(path.join(DIST, 'sw.js'), 'utf8');
    const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1] as string);
    let bytes = 0;
    for (const url of urls) bytes += (await stat(path.join(DIST, url))).size;
    built = { bytes, entries: urls.length };
    expect(precache).toEqual(built);
  }
  results['precache'] = { ...precache, built };
  await attach('precache');
  expect
    .soft(precache.bytes, 'total precache, raw bytes')
    .toBeLessThan(BUDGET.precacheBytes);

  const ready: number[] = [];
  for (let i = 0; i < WARM_RUNS; i += 1) {
    const fromWorker: { url: string; sw: boolean }[] = [];
    const record = (response: {
      url(): string;
      fromServiceWorker(): boolean;
    }) => {
      fromWorker.push({
        url: response.url(),
        sw: response.fromServiceWorker(),
      });
    };
    page.on('response', record);
    await page.reload();
    ready.push((await loadMarks(page)).ready);
    page.off('response', record);
    const document = fromWorker.find((r) => new URL(r.url).pathname === '/');
    const chunk = fromWorker.find((r) => WORKER_CHUNK.test(r.url));
    expect(document?.sw, 'the document came from the service worker').toBe(
      true,
    );
    expect(chunk?.sw, 'the worker chunk came from the service worker').toBe(
      true,
    );
  }
  results['warmCompilerReadyMs'] = summary(ready);
  await attach('warmCompilerReadyMs');
  expect
    .soft(Math.max(...ready), 'warm compiler ready, worst run')
    .toBeLessThan(BUDGET.warmReadyMs);
  await context.close();
});

interface Timing {
  start: number;
  end: number | null;
}

declare global {
  interface Window {
    __budgetTiming?: Timing;
  }
}

/** Arms the in-page clock: `start` at the matching key event, `end` when `done()` first holds. */
async function arm(
  page: Page,
  kind: 'diagnostic' | 'quickInfo' | 'run',
): Promise<void> {
  await page.evaluate((kind) => {
    const timing: Timing = { start: 0, end: null };
    window.__budgetTiming = timing;
    const root =
      document.querySelector('.cm-editor')?.closest('main') ?? document.body;
    let sawRunning = false;
    const done = (): boolean => {
      if (kind === 'diagnostic')
        return document.querySelector('.cm-lintRange-error') !== null;
      if (kind === 'quickInfo')
        return document.querySelector('.cm-tooltip.cm-dojo-info') !== null;
      const status =
        document.querySelector('[role="status"][aria-label="run status"]')
          ?.textContent ?? '';
      if (status === 'running') sawRunning = true;
      return sawRunning && status.startsWith('done in');
    };
    const observer = new MutationObserver(() => {
      if (timing.start !== 0 && timing.end === null && done()) {
        timing.end = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    // Diagnostics: the last keyup, so the clock starts when typing stops. Quick info: `K`'s
    // keydown. A run: the Enter that submits `:w`.
    const type = kind === 'diagnostic' ? 'keyup' : 'keydown';
    document.addEventListener(
      type,
      (event) => {
        if (kind === 'quickInfo' && event.key !== 'K') return;
        if (kind === 'run' && event.key !== 'Enter') return;
        timing.start = performance.now();
      },
      { capture: true },
    );
  }, kind);
}

async function elapsed(page: Page): Promise<number> {
  await page.waitForFunction(() => window.__budgetTiming?.end !== null, null, {
    timeout: 10_000,
  });
  const timing = (await page.evaluate(() => window.__budgetTiming)) as Timing;
  return (timing.end as number) - timing.start;
}

/**
 * A dedicated worker's JS heap through the DevTools protocol. `performance.memory` is not exposed
 * in workers, and a Playwright CDP session reaches only pages, so the page's session auto-attaches
 * to its workers without flattening (`waitForDebuggerOnStart: false`, or every new sandbox worker
 * would pause) and talks to the one at `url` through `Target.sendMessageToTarget`.
 */
async function workerHeap(
  page: Page,
  url: string,
): Promise<{ used: number; total: number }> {
  const cdp = await page.context().newCDPSession(page);
  const sessionId = await new Promise<string>((resolve) => {
    cdp.on('Target.attachedToTarget', (event) => {
      if (event.targetInfo.url === url) resolve(event.sessionId);
    });
    void cdp.send('Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: false,
    });
  });
  let lastId = 0;
  const call = <T>(method: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      lastId += 1;
      const id = lastId;
      const listener = (event: { sessionId: string; message: string }) => {
        if (event.sessionId !== sessionId) return;
        const reply = JSON.parse(event.message) as {
          id?: number;
          result?: T;
          error?: { message: string };
        };
        if (reply.id !== id) return;
        cdp.off('Target.receivedMessageFromTarget', listener);
        if (reply.error !== undefined) reject(new Error(reply.error.message));
        else resolve(reply.result as T);
      };
      cdp.on('Target.receivedMessageFromTarget', listener);
      void cdp.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({ id, method, params: {} }),
      });
    });
  await call('HeapProfiler.collectGarbage');
  const usage = await call<{ usedSize: number; totalSize: number }>(
    'Runtime.getHeapUsage',
  );
  await cdp.detach();
  return { used: usage.usedSize, total: usage.totalSize };
}

test('in /repl: diagnostics for a 200-line file, quick info, a trivial run, and the worker heap', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const workers: Worker[] = [];
  page.on('worker', (worker) => workers.push(worker));
  await page.goto('/repl');
  await focusEditor(page);
  await waitForCompilerReady(page);
  // The ts-ls worker is the only one before any run.
  const tsLs = workers.find((w) => WORKER_CHUNK.test(w.url()));
  if (tsLs === undefined) throw new Error('no ts-ls worker');

  // Diagnostics: a new error typed at the end of the 200-line fixture, from the last keyup to
  // its squiggle; the line is deleted again and the next sample waits for no squiggles.
  const fixture = await readFile(FIXTURE, 'utf8');
  await setDoc(page, fixture, { line: 1, col: 0 });
  const diagnostics: number[] = [];
  let dropped = 0;
  for (let i = -3; i < DIAGNOSTIC_SAMPLES; i += 1) {
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
    await arm(page, 'diagnostic');
    await press(page, 'Go');
    await type(page, `const e${String(i + 3)}: number = 'x';`);
    await press(page, '<Esc>');
    const ms = await elapsed(page);
    await press(page, 'dd');
    if (i < 0) continue; // warm-up
    if (ms < 0) dropped += 1;
    else diagnostics.push(ms);
  }
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
  results['diagnostics200LinesMs'] = { ...summary(diagnostics), dropped };
  await attach('diagnostics200LinesMs');
  expect
    .soft(summary(diagnostics).p95, 'diagnostics p95 after typing stops')
    .toBeLessThan(BUDGET.diagnosticsP95Ms);

  // Quick info: `K` on `TierId` (line 3), to the tooltip; `j` `k` close it between samples.
  await press(page, '3G0fT');
  const quickInfo: number[] = [];
  const info = page.locator('.cm-tooltip.cm-dojo-info');
  for (let i = -2; i < QUICK_INFO_SAMPLES; i += 1) {
    await expect(info).toHaveCount(0);
    await arm(page, 'quickInfo');
    await press(page, 'K');
    const ms = await elapsed(page);
    await expect(info).toContainText('TierId');
    await press(page, 'jk');
    if (i >= 0) quickInfo.push(ms);
  }
  results['quickInfoMs'] = summary(quickInfo);
  await attach('quickInfoMs');
  expect
    .soft(
      summary(quickInfo).max,
      'quick info, worst sample (§9 names no percentile)',
    )
    .toBeLessThan(BUDGET.quickInfoMs);

  // A trivial run: `:w` Enter to "done in", the emit and a fresh sandbox worker included.
  await setDoc(page, 'console.log(1);\n', { line: 1, col: 0 });
  const runs: number[] = [];
  for (let i = -2; i < RUN_SAMPLES; i += 1) {
    await arm(page, 'run');
    await ex(page, 'w');
    const ms = await elapsed(page);
    if (i >= 0) runs.push(ms);
  }
  results['trivialRunMs'] = summary(runs);
  await attach('trivialRunMs');
  expect
    .soft(summary(runs).max, 'trivial run, spawn included, worst sample')
    .toBeLessThan(BUDGET.runMs);

  // The ts-ls worker's heap, steady: after the cycles above, garbage collected first.
  const heap = await workerHeap(page, tsLs.url());
  results['tsLsWorkerHeapBytes'] = heap;
  await attach('tsLsWorkerHeapBytes');
  expect
    .soft(heap.total, 'ts-ls worker JS heap (total), steady')
    .toBeLessThan(BUDGET.workerHeapBytes);
  await context.close();
});
