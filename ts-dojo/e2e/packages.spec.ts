// §12 F14: "Zod and React's types pre-bundled for 17.2 and 17.4" (§8 17.2 "Zod pre-bundled",
// 17.4 "React's types pre-bundled"; src/protocol/packages.ts). Every test runs on /repl against
// the fixture build, from the keyboard:
//   - the ts-ls worker fetches /packages/types.json before it answers `ready` and mounts zod's, React's and
//     csstype's declarations under /node_modules/, so `import { z } from 'zod'` and React's
//     types resolve in every project, /repl included;
//   - the sandbox imports `zod` from /packages/zod-4.6.7.js and refuses `react` (and
//     `react/jsx-runtime`) with "<file> imports 'react': React has types only in the dojo; its
//     runtime isn't bundled";
//   - the service worker precaches packages/** and no longer ts/6.0.3/lib.webworker*.d.ts, so a
//     zod buffer type-checks and runs offline after one online load.
//
// "No diagnostics" is never read off an empty list that may simply not be filled yet: each
// buffer is first written with one probe line whose error only the package's real types can
// produce (with an unresolved import the name is `any` and the probe is silent, and the list
// would hold "Cannot find module" instead). Once exactly that one problem is listed, the probe
// is deleted and the list must empty.
//
// The suite-server tests also wait for the ts-ls worker's /packages/types.json request to finish
// with 200, which proves the fetch. An edit typed before the packages were mounted used to keep a
// stale "Cannot find module 'zod'" until the next edit; the regression test below writes the
// buffer before the chip reads ready and needs no further edit.
//
// The last test runs against the course build (dist/) instead: 17.2's first `ts run` block that
// imports Zod, run from its Run button, prints what the same emitted code prints in Node with
// the same bundle.
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { expect, test, type Locator, type Page } from '@playwright/test';
import ts from 'typescript';
import { analyzeLesson } from '../src/content/node/analyze';
import { codeBlocks, gotoLessonAt } from './helpers/content';
import { COURSE_CONTENT, courseAt } from './helpers/course';
import { courseTest } from './helpers/course-server';
import {
  consoleEntries,
  ex,
  gotoRepl,
  lines,
  press,
  problems,
  readBuffer,
  readMeta,
  runStatus,
  setDoc,
  snapshot,
  waitForCompilerReady,
} from './helpers/editor';
import {
  DIST,
  E2E_DIST,
  startDistServer,
  tempProfile,
  type DistServer,
} from './helpers/preview-server';
import { launchProfile, waitForServiceWorker } from './helpers/service-worker';

const ZOD_BUNDLE = 'packages/zod-4.6.7.js';
const PACKAGE_TYPES = 'packages/types.json';

const ZOD_SOURCE = lines(
  "import { z } from 'zod';",
  'const User = z.object({ name: z.string() });',
  "console.log(User.parse({ name: 'Kim' }).name, User.safeParse({}).success);",
  '',
);
/** Only zod's real types make `.name` a string: an unresolved `z` is `any` and says nothing. */
const ZOD_PROBE = "const probe: number = User.parse({ name: 'Kim' }).name;";

const REACT_SOURCE = lines(
  "import { useState } from 'react';",
  'console.log(typeof useState);',
  '',
);
/** `useState(0)[0]` is `number` only with @types/react mounted. */
const REACT_PROBE = 'const probe: string = useState(0)[0];';

const JSX_RUNTIME_SOURCE = lines(
  "import { jsx } from 'react/jsx-runtime';",
  'console.log(typeof jsx);',
  '',
);
/** `jsx` is a function only with @types/react's jsx-runtime.d.ts mounted. */
const JSX_RUNTIME_PROBE = 'const probe: number = jsx;';

const STRING_TO_NUMBER = "Type 'string' is not assignable to type 'number'.";
const NUMBER_TO_STRING = "Type 'number' is not assignable to type 'string'.";
const TO_NUMBER = /is not assignable to type 'number'\./;

/** The entry's text without its position (the first span of the `li`). */
const textOf = (entry: Locator): Locator => entry.locator('span').first();

/**
 * Writes `source` plus the probe line into the current buffer, waits until the probe's error
 * is the one problem listed (the package resolved, its types are real, nothing else is
 * reported), then writes `source` alone and waits until no problem, squiggle or gutter mark is
 * left. The editor keeps focus in normal mode throughout.
 */
async function expectCleanAfterProbe(
  page: Page,
  source: string,
  probe: string,
  probeError: string | RegExp,
): Promise<void> {
  await setDoc(page, `${source}${probe}\n`);
  await expect(
    problems(page).filter({ hasText: probeError }),
    'the probe line is reported, so the diagnostics are for this text',
  ).toHaveCount(1);
  await expect(
    problems(page),
    'and nothing else: the import resolved',
  ).toHaveCount(1);
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);

  await setDoc(page, source);
  await expect(problems(page)).toHaveCount(0);
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
  await expect(page.locator('.cm-lint-marker')).toHaveCount(0);
  await expect(
    page.getByRole('tab', { name: 'Problems (0)', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.cm-content')).toBeFocused();
  expect((await snapshot(page)).mode).toBe('normal');
}

/** `:w`, then the one console line `Kim false` and "done in". */
async function expectZodRun(page: Page): Promise<void> {
  await ex(page, 'w');
  await expect(runStatus(page)).toHaveText(/^done in \d+(\.\d+)? (ms|s)$/);
  await expect(runStatus(page)).toHaveAttribute('data-status', 'done');
  await expect(consoleEntries(page)).toHaveCount(1);
  await expect(consoleEntries(page).first()).toHaveAttribute(
    'data-kind',
    'console',
  );
  await expect(textOf(consoleEntries(page).first())).toHaveText('Kim false');
  await expect(page.locator('.cm-content')).toBeFocused();
}

/**
 * /repl with the compiler ready and the ts-ls worker's fetch of /packages/types.json finished
 * with 200 (`ready` waits for it since the F14 fix; the tests still wait for the response, so a
 * failed load shows here rather than as a missing type).
 */
async function gotoReplWithPackages(page: Page): Promise<void> {
  const fetched = page.waitForEvent('requestfinished', {
    predicate: (request) =>
      new URL(request.url()).pathname === `/${PACKAGE_TYPES}`,
    timeout: 15_000,
  });
  await gotoRepl(page);
  await waitForCompilerReady(page);
  const request = await fetched;
  expect((await request.response())?.status(), 'types.json fetched').toBe(200);
}

test.describe('on the suite server', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReplWithPackages(page);
  });

  test('§12 F14: a zod buffer shows no diagnostics and :w prints "Kim false" with "done in", Zod loaded from /packages/zod-4.6.7.js', async ({
    page,
  }) => {
    // Every request the page and its workers make (the ts-ls worker's types.json fetch, the
    // sandbox's import of the bundle).
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await expectCleanAfterProbe(page, ZOD_SOURCE, ZOD_PROBE, STRING_TO_NUMBER);
    expect((await snapshot(page)).doc).toBe(ZOD_SOURCE);

    await expectZodRun(page);
    expect(
      requests.filter((url) => new URL(url).pathname === `/${ZOD_BUNDLE}`),
      'the sandbox imported the pre-bundled Zod',
    ).not.toHaveLength(0);
    expect(
      requests.filter((url) => /\/node_modules\/|\/zod(\/|$)/.test(url)),
      'and nothing else for zod',
    ).toEqual([]);
  });

  test('§12 F14: K on a z.infer<typeof User> alias shows name: string', async ({
    page,
  }) => {
    const source = lines(
      "import { z } from 'zod';",
      'const User = z.object({ name: z.string() });',
      'type U = z.infer<typeof User>;',
      "const kim: U = { name: 'Kim' };",
      'console.log(kim.name);',
      '',
    );
    // The compiler has answered for this text with zod's types (the probe needs `.name` to be a
    // string) before K asks; the buffer is left clean, the cursor on line 1.
    await expectCleanAfterProbe(page, source, ZOD_PROBE, STRING_TO_NUMBER);
    expect((await snapshot(page)).doc).toBe(source);

    await press(page, '3G');
    await press(page, 'w');
    const at = await snapshot(page);
    expect([at.line, at.col], 'the cursor is on U').toEqual([3, 5]);
    expect(at.mode).toBe('normal');

    const info = page.locator('.cm-tooltip.cm-dojo-info');
    await expect(info).toBeHidden();
    await press(page, 'K');
    await expect(info).toBeVisible();
    const signature = info.locator('.cm-dojo-info-signature');
    await expect(signature).toContainText('type U');
    await expect(signature).toContainText('name: string');
    await expect(signature).not.toContainText('any');
    await expect(page.locator('.cm-content')).toBeFocused();
  });

  test("§12 F14: a react buffer shows no diagnostics and :w fails with React's types-only message", async ({
    page,
  }) => {
    await expectCleanAfterProbe(
      page,
      REACT_SOURCE,
      REACT_PROBE,
      NUMBER_TO_STRING,
    );
    await ex(page, 'w');
    await expect(runStatus(page)).toHaveText(
      "failed: index.ts imports 'react': React has types only in the dojo; its runtime isn't bundled",
    );
    await expect(runStatus(page)).toHaveAttribute('data-status', 'failed');
    await expect(consoleEntries(page), 'nothing ran').toHaveCount(0);
    await expect(page.locator('.cm-content')).toBeFocused();

    // The JSX runtime is React's too: its types resolve and its run is refused the same way.
    await expectCleanAfterProbe(
      page,
      JSX_RUNTIME_SOURCE,
      JSX_RUNTIME_PROBE,
      TO_NUMBER,
    );
    await ex(page, 'w');
    await expect(runStatus(page)).toHaveText(
      "failed: index.ts imports 'react/jsx-runtime': React has types only in the dojo; its runtime isn't bundled",
    );
    await expect(runStatus(page)).toHaveAttribute('data-status', 'failed');
    await expect(consoleEntries(page)).toHaveCount(0);
  });
});

// Regression for the race reported with F14: an edit sent before the packages were mounted got
// "Cannot find module 'zod'" (TS2307), and the Problems list kept it until the next edit (6 of 6
// runs on the old core). `core.init()` now loads the packages before answering `ready`.
test('§12 F14: a zod import typed before the compiler is ready resolves without another edit', async ({
  page,
}) => {
  // `//   ^?` under `type U`: its widget is refreshed in the same lint cycle, right after the
  // diagnostics reach the Problems list (src/editor/diagnostics.ts), so once it shows U's
  // type the list below is this text's answer, not an empty list still waiting for one.
  const source = lines(
    "import { z } from 'zod';",
    'const User = z.object({ name: z.string() });',
    'type U = z.infer<typeof User>;',
    '//   ^?',
    "const kim: U = { name: 'Kim' };",
    'console.log(kim.name);',
    '',
  );
  await gotoRepl(page);
  await setDoc(page, source);
  // The chip only goes from loading to ready, so not ready now means not ready at the write.
  const chip = page.getByRole('status', { name: 'compiler status' });
  expect(
    await chip.getAttribute('data-state'),
    'the buffer was written before the compiler was ready',
  ).not.toBe('ready');

  // No further edit from here on.
  await waitForCompilerReady(page);
  const widget = page.locator('[data-testid="twoslash"]');
  await expect(widget).toHaveCount(1, { timeout: 10_000 });
  await expect(widget).toContainText('type U');
  await expect(widget).toContainText('name: string');
  await expect(widget).not.toHaveClass(/cm-twoslash-error/);
  await expect(
    problems(page).filter({ hasText: 'TS2307' }),
    'no stale "Cannot find module"',
  ).toHaveCount(0);
  await expect(problems(page)).toHaveCount(0);
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
  expect((await snapshot(page)).doc, 'the text is as written').toBe(source);

  // Quick info on the alias agrees.
  await press(page, '3G');
  await press(page, 'w');
  const at = await snapshot(page);
  expect([at.line, at.col], 'the cursor is on U').toEqual([3, 5]);
  const info = page.locator('.cm-tooltip.cm-dojo-info');
  await press(page, 'K');
  await expect(info).toBeVisible();
  const signature = info.locator('.cm-dojo-info-signature');
  await expect(signature).toContainText('type U');
  await expect(signature).toContainText('name: string');
  await expect(signature).not.toContainText('any');
  expect((await snapshot(page)).doc).toBe(source);
});

test('§12 F14: offline after one online load, the zod buffer still type-checks and :w still prints "Kim false"', async () => {
  test.setTimeout(120_000);
  const profile = await tempProfile();
  let server: DistServer | null = await startDistServer();
  const baseURL = server.url;
  let context = await launchProfile(profile.dir, baseURL, false);
  try {
    // One online load: /repl, the compiler ready, the service worker installed (its install
    // precached packages/**), and the zod buffer written and autosaved.
    let page = context.pages()[0] ?? (await context.newPage());
    await gotoRepl(page);
    await waitForCompilerReady(page);
    await waitForServiceWorker(page);
    await setDoc(page, ZOD_SOURCE);
    await expect
      .poll(() => readBuffer(page, 'index.ts').then((row) => row?.text))
      .toBe(ZOD_SOURCE);
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('index.ts');
    await context.close();
    await server.close();
    server = null;

    // The network off, the server gone, the browser started again: only the precache answers.
    context = await launchProfile(profile.dir, baseURL, true);
    page = context.pages()[0] ?? (await context.newPage());
    const fromServiceWorker = new Map<string, boolean>();
    page.on('response', (response) => {
      const { pathname } = new URL(response.url());
      if (pathname.startsWith('/packages/'))
        fromServiceWorker.set(pathname, response.fromServiceWorker());
    });

    await gotoRepl(page);
    expect((await snapshot(page)).doc, 'the zod buffer reopened').toBe(
      ZOD_SOURCE,
    );
    await waitForCompilerReady(page);
    await expectCleanAfterProbe(page, ZOD_SOURCE, ZOD_PROBE, STRING_TO_NUMBER);
    expect(
      fromServiceWorker.get(`/${PACKAGE_TYPES}`),
      'types.json came from the precache',
    ).toBe(true);

    await expectZodRun(page);
    expect(
      fromServiceWorker.get(`/${ZOD_BUNDLE}`),
      'the Zod bundle came from the precache',
    ).toBe(true);
  } finally {
    await context.close();
    await server?.close();
    await profile.remove();
  }
});

test('§12 F14: the precache manifest in dist-e2e/sw.js lists packages/types.json and packages/zod-4.6.7.js and no lib.webworker file', async () => {
  const sw = await readFile(path.join(E2E_DIST, 'sw.js'), 'utf8');
  const precached = [...sw.matchAll(/url:"([^"]+)"/g)].map(
    (m) => m[1] as string,
  );
  expect(precached.length, 'the manifest was parsed').toBeGreaterThan(0);

  // The two package files, and exactly what the build put under packages/.
  expect(precached).toContain(PACKAGE_TYPES);
  expect(precached).toContain(ZOD_BUNDLE);
  const built = (await readdir(path.join(E2E_DIST, 'packages'))).map(
    (name) => `packages/${name}`,
  );
  expect(precached.filter((url) => url.startsWith('packages/')).sort()).toEqual(
    built.sort(),
  );

  // No webworker lib is precached, though they still ship; every other lib still is.
  expect(precached.filter((url) => url.includes('lib.webworker'))).toEqual([]);
  const libs = await readdir(path.join(E2E_DIST, 'ts', '6.0.3'));
  const webworker = libs.filter((name) => name.startsWith('lib.webworker'));
  expect(webworker, 'the webworker libs are in the build').not.toHaveLength(0);
  const others = libs
    .filter((name) => !name.startsWith('lib.webworker'))
    .map((name) => `ts/6.0.3/${name}`);
  expect(precached.filter((url) => url.startsWith('ts/6.0.3/')).sort()).toEqual(
    others.sort(),
  );
});

const ZOD_LESSON = 'm17-boundaries/02-zod-and-valibot';

/**
 * What `code` prints in Node: the snippet transpiled by the repo's TypeScript, its `'zod'`
 * import pointed at the build's own bundle (the file the browser imports), and every
 * `console.log` call captured as Node formats it (`util.format`), one string per call.
 */
async function nodeConsoleLines(
  code: string,
  bundle: string,
): Promise<string[]> {
  const js = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2025,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const zod = /from\s+(['"])zod\1/g;
  expect(js.match(zod), 'the emitted snippet imports zod').not.toBeNull();
  const rewritten = js.replace(
    zod,
    `from ${JSON.stringify(pathToFileURL(bundle).href)}`,
  );
  const capture = [
    "import { format as __format } from 'node:util';",
    'const __lines = [];',
    'console.log = (...args) => { __lines.push(__format(...args)); };',
    "process.on('exit', () => { process.stdout.write(JSON.stringify(__lines)); });",
    '',
  ].join('\n');
  const dir = await mkdtemp(path.join(tmpdir(), 'ts-dojo-zod-'));
  try {
    const file = path.join(dir, 'snippet.mjs');
    await writeFile(file, capture + rewritten);
    const { stdout } = await promisify(execFile)(process.execPath, [file]);
    return JSON.parse(stdout) as string[];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

courseTest(
  '§12 F14: a Zod example in 17.2 runs in the browser',
  async ({ page }) => {
    // The lesson's first `ts run` fence that imports Zod, and its place among the run blocks.
    const analysis = await analyzeLesson(
      courseAt(COURSE_CONTENT).lessonMdx(ZOD_LESSON),
      `${ZOD_LESSON}/lesson.mdx`,
    );
    const runFences = analysis.fences.filter((fence) => fence.kind === 'run');
    const index = runFences.findIndex((fence) =>
      /from\s+['"]zod['"]/.test(fence.code),
    );
    expect(index, `${ZOD_LESSON} has a ts run block importing zod`).not.toBe(
      -1,
    );
    const fence = runFences[index];
    if (fence === undefined) throw new Error('unreachable');
    const expected = await nodeConsoleLines(
      fence.code,
      path.join(DIST, ZOD_BUNDLE),
    );
    expect(
      expected.length,
      'the snippet prints something in Node',
    ).toBeGreaterThan(0);

    const responses: { path: string; status: number }[] = [];
    page.on('response', (response) => {
      responses.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
    });
    await gotoLessonAt(page, ZOD_LESSON);
    const block = codeBlocks(page, 'run').nth(index);
    await expect(block.locator('pre').first()).toHaveText(fence.code);
    const output = block.getByRole('region', { name: 'Output' });
    await expect(output).toHaveCount(0);

    // Only what the Run does counts from here.
    responses.length = 0;
    const run = block.getByRole('button', { name: 'Run', exact: true });
    await run.focus();
    await expect(run).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(output.getByRole('status')).toHaveText(
      /^done in \d+(\.\d+)? (ms|s)$/,
    );
    const entries = output.locator('li');
    await expect(entries).toHaveCount(expected.length);
    await expect(entries.and(page.locator('li.text-destructive'))).toHaveCount(
      0,
    );
    // Each entry's own text: the `li`'s text without the location span after it.
    const shown = await entries.evaluateAll((items) =>
      items.map((item) =>
        [...item.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join(''),
      ),
    );
    expect(shown).toEqual(expected);
    await expect(run).toBeFocused();

    expect(
      responses.filter((r) => r.path === `/${ZOD_BUNDLE}`),
      'the Run fetched the pre-bundled Zod',
    ).toEqual([{ path: `/${ZOD_BUNDLE}`, status: 200 }]);
  },
);
