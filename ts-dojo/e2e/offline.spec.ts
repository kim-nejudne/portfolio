// §12 F15: "After one online load, with the network off: the app opens, a lesson loads,
// diagnostics and a run work (Playwright with `offline: true`)." And §9 Offline's update rule:
// "the service worker fetches new assets in the background and the app shows 'Reload for the
// new version'. It never reloads by itself mid-exercise."
//
// The offline test uses a real Chrome profile on disk (launchPersistentContext) so the second
// launch is a cold start with only what the first left behind: the service worker and its
// precache, localStorage and IndexedDB. Between the launches the private server is stopped.
// Playwright's `offline: true` does not reach a dedicated worker's requests, and the server
// sends every file `no-cache`, so with the server gone nothing but the precache can answer: the
// ts-ls worker's lib fetches included. The responses are also checked `fromServiceWorker()`.
//
// What the offline launch does, none of it seen online except the first lesson's page: the app
// opens at `/`; another lesson loads by its direct URL; an exercise shows the squiggle for an
// error typed into it, runs with `:run` and gets a verdict from `:test`; `/repl` with compiler
// defaults that add `dom` (stored online in localStorage) reads lib.dom.d.ts, which only the
// precache has, and lists its diagnostic.
import { appendFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Response,
} from '@playwright/test';
import { codeBlocks, gotoLesson } from './helpers/content';
import {
  consoleEntries,
  ex,
  gotoRepl,
  press,
  problems,
  runStatus,
  setDoc,
  SETTINGS_KEY,
  snapshot,
  type,
  waitForCompilerReady,
} from './helpers/editor';
import { expectRoadmap, tabTo } from './helpers/progress';
import {
  copyDist,
  DIST,
  startDistServer,
  tempProfile,
  type DistServer,
} from './helpers/preview-server';
import { expectNoReload, markNoReload } from './helpers/settings';
import { gotoExercise, runTest } from './helpers/verify';

test.use({ serviceWorkers: 'allow' });

const LIB_COUNT = 107;
const WORKER_CHUNK = /\/assets\/worker-[^/]+\.js$/;

/** Resolves once a service worker is active and controls the page. */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active === null) throw new Error('no active worker');
    if (navigator.serviceWorker.controller === null) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        });
      });
    }
  });
}

function launch(
  profile: string,
  baseURL: string,
  offline: boolean,
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: true,
    baseURL,
    offline,
    serviceWorkers: 'allow',
    viewport: { width: 1280, height: 800 },
  });
}

test('§12 F15: after one online load, with the network off, the app opens, a lesson loads, diagnostics and a run work', async () => {
  test.setTimeout(120_000);
  const profile = await tempProfile();
  let server: DistServer | null = await startDistServer();
  const baseURL = server.url;
  let context: BrowserContext | null = null;
  try {
    // One online load: a lesson page, the compiler ready, the service worker installed.
    context = await launch(profile.dir, baseURL, false);
    let page = context.pages()[0] ?? (await context.newPage());
    await gotoLesson(page, '01-fix');
    await waitForCompilerReady(page);
    await waitForServiceWorker(page);
    await page.evaluate((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({ compilerDefaults: { lib: ['es2025', 'dom'] } }),
      );
    }, SETTINGS_KEY);
    await context.close();
    context = null;
    await server.close();
    server = null;

    // The network off, the server gone, the browser started again.
    context = await launch(profile.dir, baseURL, true);
    page = context.pages()[0] ?? (await context.newPage());
    const responses: Response[] = [];
    page.on('response', (response) => responses.push(response));

    // The app opens.
    const opened = await page.goto('/');
    expect(opened?.fromServiceWorker(), 'the document').toBe(true);
    await expectRoadmap(page);
    await waitForCompilerReady(page);
    const chunk = responses.find((r) => WORKER_CHUNK.test(r.url()));
    expect(chunk?.fromServiceWorker(), 'the ts-ls worker chunk').toBe(true);
    const lib = responses.find((r) => r.url().endsWith('/lib.es2025.d.ts'));
    expect(lib?.fromServiceWorker(), 'lib.es2025.d.ts').toBe(true);

    // A lesson never opened online, by its direct URL: theory, twoslash, theory Run.
    await gotoLesson(page, '02-implement');
    await expect(codeBlocks(page, 'twoslash').first()).toBeVisible();
    const block = codeBlocks(page, 'run').first();
    await block.getByRole('button', { name: 'Run', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(
      block.getByRole('region', { name: 'Output' }).getByRole('status'),
    ).toHaveText(/^done in \d+ ms$/);

    // Its exercise: diagnostics for an error typed in, then :run and :test.
    await gotoExercise(page, '02-implement', '01-largest-shape');
    const original = (await snapshot(page)).doc;
    await setDoc(page, `${original}\nconst offline: number = 'x';\n`, {
      line: 1,
      col: 0,
    });
    await expect(page.locator('.cm-lintRange-error').last()).toHaveText(
      'offline',
    );
    await expect(page.locator('.cm-lint-marker').first()).toBeVisible();
    await setDoc(page, original, { line: 1, col: 0 });
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
    await ex(page, 'run');
    await expect(runStatus(page)).toHaveText(/^(done in|failed:)/);
    await page.locator('.cm-content').focus();
    const verdicts = await runTest(page);
    expect(verdicts.at(-1)?.verdict).toMatch(/pass|fail/);

    // /repl with `dom` in the compiler defaults: lib.dom.d.ts comes from the precache.
    await gotoRepl(page);
    await waitForCompilerReady(page);
    await setDoc(page, "const el: HTMLElement = 1;\nconsole.log('off');\n", {
      line: 1,
      col: 0,
    });
    await expect(problems(page).first()).toContainText(
      "Type 'number' is not assignable to type 'HTMLElement'.",
    );
    const dom = responses.find((r) => r.url().endsWith('/lib.dom.d.ts'));
    expect(dom?.fromServiceWorker(), 'lib.dom.d.ts').toBe(true);
    await ex(page, 'w');
    await expect(runStatus(page)).toContainText('done in');
    await expect(consoleEntries(page)).toHaveText([/^off/]);
  } finally {
    await context?.close();
    await server?.close();
    await profile.remove();
  }
});

test('the precache lists the app, both worker chunks and all 107 lib files', async () => {
  const sw = await readFile(path.join(DIST, 'sw.js'), 'utf8');
  const precached = new Set(
    [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1] as string),
  );
  const assets = await readdir(path.join(DIST, 'assets'));
  const libs = await readdir(path.join(DIST, 'ts', '6.0.3'));
  expect(libs).toHaveLength(LIB_COUNT);
  const expected = [
    'index.html',
    'favicon.svg',
    'manifest.webmanifest',
    ...assets.map((name) => `assets/${name}`),
    ...libs.map((name) => `ts/6.0.3/${name}`),
  ];
  expect([...precached].sort()).toEqual(expected.sort());
  expect(
    [...precached].filter((url) => WORKER_CHUNK.test(`/${url}`)),
    'the ts-ls and sandbox worker chunks',
  ).toHaveLength(2);
});

test('a new version shows "Reload for the new version", never reloads by itself, and Reload takes it', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const copy = await copyDist();
  const server = await startDistServer({ dir: copy.dir });
  const context = await browser.newContext({
    baseURL: server.url,
    serviceWorkers: 'allow',
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await waitForCompilerReady(page);
    await waitForServiceWorker(page);
    await page.reload();
    await waitForCompilerReady(page);
    const update = page.getByRole('status', { name: 'update' });
    await expect(update).toHaveCount(0);

    // A deploy: sw.js changes. The browser finds it on its next check.
    await appendFile(path.join(copy.dir, 'sw.js'), '\n// the next version\n');
    await markNoReload(page);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    await expect(update).toHaveText('Reload for the new version');
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.waiting !== null;
        }),
      )
      .toBe(true);
    // Still the same page: the new version waits for Kim.
    await waitForCompilerReady(page);
    await expectNoReload(page);

    // Reload, from the keyboard.
    const reload = page.getByRole('button', { name: 'Reload' });
    await tabTo(page, reload);
    const reloaded = page.waitForEvent('load');
    await page.keyboard.press('Enter');
    await reloaded;
    await waitForCompilerReady(page);
    await expect(update).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __noReload?: boolean }).__noReload,
      ),
      'the page reloaded',
    ).toBeUndefined();
    expect(
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.waiting === null;
      }),
      'the new worker took over',
    ).toBe(true);
  } finally {
    await context.close();
    await server.close();
    await copy.remove();
  }
});

test('Reload pressed in another tab never reloads a tab mid-exercise; that tab reloads only on its own Reload', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const copy = await copyDist();
  const server = await startDistServer({ dir: copy.dir });
  const context = await browser.newContext({
    baseURL: server.url,
    serviceWorkers: 'allow',
  });
  const marked = (page: Page) =>
    page.evaluate(
      () => (window as unknown as { __noReload?: boolean }).__noReload === true,
    );
  try {
    // Tab A on the roadmap, controlled by the installed worker.
    const a = await context.newPage();
    await a.goto('/');
    await waitForCompilerReady(a);
    await waitForServiceWorker(a);
    await a.reload();
    await waitForCompilerReady(a);

    // Tab B in the middle of an exercise: an edit typed and not yet run.
    const b = await context.newPage();
    await gotoExercise(b, '01-fix', '01-handle-the-new-shape');
    await press(b, 'Go');
    await type(b, '// halfway through');
    await press(b, '<Esc>');
    await markNoReload(b);
    await markNoReload(a);

    // A deploy; both tabs offer the new version.
    await appendFile(path.join(copy.dir, 'sw.js'), '\n// the next version\n');
    await a.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    const lineA = a.getByRole('status', { name: 'update' });
    const lineB = b.getByRole('status', { name: 'update' });
    await expect(lineA).toHaveText('Reload for the new version');
    await expect(lineB).toHaveText('Reload for the new version');

    // Reload in A: A reloads into the new version.
    await tabTo(a, a.getByRole('button', { name: 'Reload' }));
    const reloadedA = a.waitForEvent('load');
    await a.keyboard.press('Enter');
    await reloadedA;
    await waitForCompilerReady(a);
    expect(await marked(a), 'A reloaded').toBe(false);

    // B is now controlled by the new worker too, and was not reloaded: the marker, the edit and
    // the line are all still there.
    await expect
      .poll(() =>
        b.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.waiting === null;
        }),
      )
      .toBe(true);
    await expect(lineB).toHaveText('Reload for the new version');
    expect(await marked(b), 'B was not reloaded').toBe(true);
    expect((await snapshot(b)).doc).toContain('// halfway through');

    // B's own Reload reloads it at once (nothing is waiting any more).
    const reloadB = b.getByRole('button', { name: 'Reload' });
    await reloadB.focus();
    await expect(reloadB).toBeFocused();
    const reloadedB = b.waitForEvent('load');
    await b.keyboard.press('Enter');
    await reloadedB;
    await waitForCompilerReady(b);
    expect(await marked(b), 'B reloaded on its own Reload').toBe(false);
    await expect(lineB).toHaveCount(0);
  } finally {
    await context.close();
    await server.close();
    await copy.remove();
  }
});
