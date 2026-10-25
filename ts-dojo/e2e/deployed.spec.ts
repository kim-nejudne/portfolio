// The v1 gate against a deployed site (spec §11 "Gate (v1): §12 passes, and Kim completes Tier 0
// and Tier 1 on the deployed site without a mouse"; §12 F11 criterion 3 and the §12 v1 gate box),
// under the ship-prompt deviations recorded in docs/progress.md:
//   D1. the gate is met by this keyboard-only walk of every M00–M04 lesson, end to end, from a
//       fresh Chrome profile, with every blocking bug it finds fixed;
//   D2. the F14 "Tier 4 in the browser" check (For Kim steps 1–4) is done here too.
// The target is `DEPLOYED_URL` (https://dojo.kimnejudne.dev by default; a `pnpm preview` of
// dist/ for a dry run), through the `deployed` project of playwright.config.ts, which is off by
// default:
//
//   DEPLOYED_URL=https://dojo.kimnejudne.dev pnpm test:e2e --project deployed
//
// No mouse anywhere: no click, hover or `page.mouse`. Navigation is by URL and by the app's own
// keys and ex commands; the `window.__tsDojo` seam focuses the editor and replaces a buffer's
// text (`setDoc`), as e2e/course.spec.ts does. The walk is generated from content/ at
// collection time (tiers t0 and t1 of roadmap.yaml, each module's lessons, each lesson's
// exercise folders, each exercise's YAML and solution/), never hard-coded.
//
// Per lesson, in roadmap order: open its first editor exercise; `:done` until theory is read,
// answering the Check yourself question `:done` jumps to (the right option from the lesson's
// own `<Predict>` props, chosen with j/k and Enter); pass every editor exercise with `:test`
// on its solution/ files; answer every `predict` exercise with `2`, j/k and Enter; then the
// lesson's §7 row says complete. After the five modules: every module card on the roadmap says
// complete with a full ring, and still does after a reload.
//
// Tier 4 (F14 For Kim): 17.2's first example runs and ends in "done in"; a 17.4 exercise with
// JSX gets React's types (a probe line is reported, the clean starter has no problem, `K` on
// `ReactNode` shows it); `/repl` runs `import { z } from 'zod'` with `:w`; then, offline on the
// same profile, 17.2's example runs again from the precache. Playwright's `offline` does not
// reach a dedicated worker's requests, so the proof is `fromServiceWorker()` on the document and
// on the Zod bundle the sandbox imports, as e2e/packages.spec.ts proves it locally.
//
// Serial: one profile is shared across a describe's tests, so a failure skips what follows it.
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Response,
} from '@playwright/test';
import { analyzeLesson } from '../src/content/node/analyze';
import { codeBlocks, gotoLessonAt } from './helpers/content';
import { COURSE_CONTENT, courseAt } from './helpers/course';
import {
  consoleEntries,
  ex,
  gotoRepl,
  lines,
  press,
  problems,
  runStatus,
  setDoc,
  snapshot,
  type,
  waitForCompilerReady,
} from './helpers/editor';
import {
  answer,
  checkQuestion,
  chip,
  escToEditor,
  expectExerciseAt,
  expectFocus,
  lessonNotice,
  predictQuestion,
  result,
} from './helpers/lesson';
import { tempProfile } from './helpers/preview-server';
import {
  card,
  expectRoadmap,
  field,
  readStore,
  ring,
} from './helpers/progress';
import { launchProfile, waitForServiceWorker } from './helpers/service-worker';
import { gotoExerciseAt, openPath, runTest, verdict } from './helpers/verify';

const BASE = process.env['DEPLOYED_URL'] ?? 'https://dojo.kimnejudne.dev';
const COURSE = courseAt(COURSE_CONTENT);
/** Tier 0 and Tier 1 (§11 v1 gate): the modules of `t0` and `t1`, in roadmap order. */
const GATE_TIERS = ['t0', 't1'];
const GATE_MODULES = COURSE.readTiers()
  .filter((tier) => GATE_TIERS.includes(tier.id))
  .flatMap((tier) => tier.modules);

const ZOD_LESSON = 'm17-boundaries/02-zod-and-valibot';
const REACT_EXERCISE = 'm17-boundaries/04-react/01-type-the-notice';
const ZOD_SOURCE = lines(
  "import { z } from 'zod';",
  'const User = z.object({ name: z.string() });',
  "console.log(User.parse({ name: 'Kim' }).name, User.safeParse({}).success);",
  '',
);
const DONE_IN = /^done in \d+(\.\d+)? (ms|s)$/;
const ZOD_BUNDLE = /^\/packages\/zod-[^/]+\.js$/;

test.describe.configure({ mode: 'serial' });

/** A fresh profile and a Chrome on it against `BASE`, online; closed and removed by `close`. */
async function freshProfile(): Promise<{
  dir: string;
  context: BrowserContext;
  page: Page;
  /** Closes the Chrome, once; `close` does it too and removes the profile. */
  closeContext: () => Promise<void>;
  close: () => Promise<void>;
}> {
  const profile = await tempProfile();
  const context = await launchProfile(profile.dir, BASE, false);
  const page = context.pages()[0] ?? (await context.newPage());
  let closed = false;
  const closeContext = async () => {
    if (closed) return;
    closed = true;
    await context.close();
  };
  return {
    dir: profile.dir,
    context,
    page,
    closeContext,
    close: async () => {
      await closeContext();
      await profile.remove();
    },
  };
}

/** The right option of every `<Predict>` in the lesson's theory, by its `id`. */
async function checkAnswers(lessonId: string): Promise<Map<string, number>> {
  const analysis = await analyzeLesson(
    COURSE.lessonMdx(lessonId),
    `${lessonId}/lesson.mdx`,
  );
  return new Map(
    analysis.predicts.map((site) => [
      String(site.props['id']),
      Number(site.props['answer']),
    ]),
  );
}

/**
 * With an editor exercise of the lesson open and the editor focused: `:done`, and while the
 * notice says questions remain, answer the one `:done` focused and `:done` again, until the
 * notice says "Theory read." (§1 Completion: every question right, then `:done`).
 */
async function readTheory(page: Page, lessonId: string): Promise<void> {
  const answers = await checkAnswers(lessonId);
  let previous = '';
  for (let round = 0; round <= answers.size; round += 1) {
    await ex(page, 'done');
    // The notice changes on every `:done` here (N remain → N-1 remain → Theory read), so the
    // wait is for a text other than the previous round's that reads as one of those.
    await expect
      .poll(
        async () => {
          const text = (await lessonNotice(page).textContent()) ?? '';
          return text !== previous &&
            /^(Theory read\.|\d+ questions? remains?: )/.test(text)
            ? text
            : null;
        },
        { message: `${lessonId}: :done answered (after "${previous}")` },
      )
      .not.toBeNull();
    const notice = (await lessonNotice(page).textContent()) ?? '';
    previous = notice;
    if (notice.startsWith('Theory read.')) return;

    await expectFocus(page, 'check', ':done focuses the unanswered question');
    const id = await page.evaluate(
      () => document.activeElement?.getAttribute('data-check-id') ?? '',
    );
    const right = answers.get(id);
    if (right === undefined) {
      throw new Error(`${lessonId}: :done focused an unknown question "${id}"`);
    }
    const block = checkQuestion(page, id);
    await answer(page, block, right);
    await expect(result(block)).toHaveAttribute('data-result', 'correct');
    await escToEditor(page);
  }
  throw new Error(`${lessonId}: theory still not read after every question`);
}

/** Every solution file in its buffer (`:b`, then the seam), `:test`, and the pass shown. */
async function passEditorExercise(page: Page, id: string): Promise<void> {
  const solution = COURSE.solutionFiles(id);
  expect(
    Object.keys(solution).length,
    `${id}: solution/ has files`,
  ).toBeGreaterThan(0);
  await gotoExerciseAt(page, id);
  for (const [path, text] of Object.entries(solution)) {
    await openPath(page, path);
    await setDoc(page, text);
  }
  expect((await snapshot(page)).mode).toBe('normal');
  // A cold `:test` on the deployed site: the sandbox worker chunk may come over the network.
  await runTest(page, { timeout: 30_000 });
  await expect(verdict(page), `${id}: :test passes`).toHaveAttribute(
    'data-verdict',
    'passed',
  );
  await expect(chip(page, COURSE.folderOf(id))).toHaveAttribute(
    'data-state',
    'passed',
  );
}

/** `2` to the question, j/k to the `answer` option, Enter, and the pass shown. */
async function passPredictExercise(page: Page, id: string): Promise<void> {
  const exercise = COURSE.readExercise(id);
  const right = exercise.answer;
  if (right === undefined) throw new Error(`${id}: predict has no answer`);
  await page.goto(`/l/${id}`);
  await expectExerciseAt(page, COURSE.lessonOf(id), COURSE.folderOf(id));
  const question = predictQuestion(page);
  await page.keyboard.press('2');
  await expectFocus(page, 'question');
  await answer(page, question, right);
  await expect(result(question)).toHaveAttribute('data-result', 'correct');
  await expect(question).toHaveAttribute('data-correct', 'true');
  await expect(chip(page, COURSE.folderOf(id))).toHaveAttribute(
    'data-state',
    'passed',
  );
}

/** The lesson's §7 row, as the app stored it. */
async function lessonState(
  page: Page,
  lessonId: string,
): Promise<string | undefined> {
  const dump = await readStore(page);
  return dump.lessons.find((row) => row.id === lessonId)?.state;
}

async function completeLesson(page: Page, lessonId: string): Promise<void> {
  const folders = COURSE.exerciseFolders(lessonId);
  const firstEditor = folders.find(
    (folder) => COURSE.readExercise(`${lessonId}/${folder}`).kind !== 'predict',
  );
  if (firstEditor === undefined) {
    throw new Error(`${lessonId}: no editor exercise to run :done from`);
  }

  // Theory: the Check yourself questions, then `:done`.
  await gotoExerciseAt(page, `${lessonId}/${firstEditor}`);
  await readTheory(page, lessonId);

  // Practice: every exercise, in the strip's order.
  for (const folder of folders) {
    const id = `${lessonId}/${folder}`;
    if (COURSE.readExercise(id).kind === 'predict') {
      await passPredictExercise(page, id);
    } else {
      await passEditorExercise(page, id);
    }
  }

  await expect
    .poll(() => lessonState(page, lessonId), {
      message: `${lessonId} is complete`,
    })
    .toBe('complete');
}

/** The module's card on the roadmap says complete, with a full ring and every core lesson counted. */
async function expectModuleComplete(
  page: Page,
  moduleId: string,
): Promise<void> {
  const c = card(page, moduleId);
  const core = COURSE.coreLessons(moduleId).length;
  await expect(c, `${moduleId} card`).toHaveAttribute('data-state', 'complete');
  await expect(ring(c), `${moduleId} ring`).toHaveAttribute(
    'data-state',
    'complete',
  );
  expect(
    Number(await ring(c).getAttribute('data-progress')),
    `${moduleId} ring is full`,
  ).toBe(1);
  await expect(field(c, 'progress')).toHaveText(
    `${String(core)} of ${String(core)} lessons complete`,
  );
}

test.describe(`§11 v1 gate (D1): Tier 0 and Tier 1 completed at ${BASE} without a mouse`, () => {
  let site: Awaited<ReturnType<typeof freshProfile>>;

  test.beforeAll(async () => {
    expect(GATE_MODULES, 'roadmap.yaml has t0 and t1').toHaveLength(5);
    site = await freshProfile();
  });

  test.afterAll(async () => {
    await site.close();
  });

  for (const moduleId of GATE_MODULES) {
    test(`${moduleId}: every lesson completes from the keyboard`, async () => {
      for (const lessonId of COURSE.moduleLessons(moduleId)) {
        await test.step(lessonId, () => completeLesson(site.page, lessonId));
      }
    });
  }

  test('the roadmap shows every M00–M04 ring full, and still does after a reload', async () => {
    const { page } = site;
    await page.goto('/');
    await expectRoadmap(page);
    for (const moduleId of GATE_MODULES) {
      await expectModuleComplete(page, moduleId);
    }
    await page.reload();
    await expectRoadmap(page);
    for (const moduleId of GATE_MODULES) {
      await expectModuleComplete(page, moduleId);
    }
  });
});

/** The first `ts run` block of 17.2: Run from its button (focused, Enter), ending in "done in". */
async function runFirstExample(page: Page): Promise<void> {
  const block = codeBlocks(page, 'run').first();
  await expect(block.locator('pre').first()).toContainText("from 'zod'");
  const run = block.getByRole('button', { name: 'Run', exact: true });
  await run.focus();
  await expect(run).toBeFocused();
  await page.keyboard.press('Enter');
  const output = block.getByRole('region', { name: 'Output' });
  await expect(output.getByRole('status')).toHaveText(DONE_IN, {
    timeout: 30_000,
  });
  await expect(output.locator('li')).not.toHaveCount(0);
  await expect(output.locator('li.text-destructive')).toHaveCount(0);
}

test.describe(`§12 F14 (D2): Tier 4 in the browser at ${BASE}`, () => {
  let site: Awaited<ReturnType<typeof freshProfile>>;

  test.beforeAll(async () => {
    site = await freshProfile();
  });

  test.afterAll(async () => {
    await site.close();
  });

  test('step 1: on 17.2, Run on the first example prints its output and "done in"', async () => {
    const { page } = site;
    const responses: Response[] = [];
    page.on('response', (response) => responses.push(response));
    await gotoLessonAt(page, ZOD_LESSON);
    await runFirstExample(page);
    expect(
      responses.filter((r) => ZOD_BUNDLE.test(new URL(r.url()).pathname)),
      'the Run fetched the pre-bundled Zod',
    ).not.toHaveLength(0);
    // The service worker installs on this load; the offline step below relies on it.
    await waitForServiceWorker(page);
  });

  test("step 2: a 17.4 exercise with JSX gets React's types in quick info and no \"Cannot find module 'react'\"", async () => {
    const { page } = site;
    await gotoExerciseAt(page, REACT_EXERCISE);
    const starter = (await snapshot(page)).doc;
    expect(starter).toContain("from 'react'");
    expect(starter).toContain('<section');

    // A probe that only React's real types can report: with an unresolved import `ReactNode`
    // is `any` and the line is silent. Its squiggle is this file's; tests.ts has its own
    // expected diagnostics against the starter, so the Problems count is not read here.
    await setDoc(
      page,
      `${starter}\nconst probe: number = null as unknown as ReactNode;\n`,
    );
    await expect(
      page.locator('.cm-lintRange-error').last(),
      'the probe is reported',
    ).toHaveText('probe');

    await setDoc(page, starter);
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
    await expect(page.locator('.cm-lint-marker')).toHaveCount(0);

    // The Problems tab, from the keyboard (`Ctrl-j` from the editor to the output pane, `l` to
    // the next tab): no "Cannot find module" for any file; `Esc` back to the editor.
    await press(page, '<C-j>');
    await expectFocus(page, 'output');
    await page.keyboard.press('l');
    await expect(
      page.getByRole('tab', { name: /^Problems \(\d+\)$/ }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      problems(page).filter({ hasText: 'Cannot find module' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expectFocus(page, 'editor');

    // K on `ReactNode` (the first match from the top of the file).
    await press(page, 'gg0');
    await press(page, '/');
    await type(page, 'ReactNode');
    await press(page, '<CR>');
    const at = await snapshot(page);
    expect(at.line, 'the cursor is on the import line').toBe(1);
    expect(at.mode).toBe('normal');
    const info = page.locator('.cm-tooltip.cm-dojo-info');
    await press(page, 'K');
    await expect(info).toBeVisible();
    await expect(info.locator('.cm-dojo-info-signature')).toContainText(
      'ReactNode',
    );
    await expect(info).not.toContainText("Cannot find module 'react'");
    await expect(page.locator('.cm-content')).toBeFocused();
  });

  test("step 3: /repl runs `import { z } from 'zod'` with :w", async () => {
    const { page } = site;
    await gotoRepl(page);
    await waitForCompilerReady(page);
    await setDoc(page, ZOD_SOURCE);
    await ex(page, 'w');
    await expect(runStatus(page)).toHaveText(DONE_IN, { timeout: 30_000 });
    await expect(runStatus(page)).toHaveAttribute('data-status', 'done');
    await expect(consoleEntries(page)).toHaveCount(1);
    await expect(
      consoleEntries(page).first().locator('span').first(),
    ).toHaveText('Kim false');
  });

  test('step 4: offline, 17.2 reopens from the precache and its example runs again', async () => {
    // The same profile, started again with the network off: only the precache can answer.
    await site.closeContext();
    const context = await launchProfile(site.dir, BASE, true);
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      const responses: Response[] = [];
      page.on('response', (response) => responses.push(response));

      const opened = await page.goto(`/l/${ZOD_LESSON}`);
      expect(opened?.fromServiceWorker(), 'the document').toBe(true);
      await gotoLessonAt(page, ZOD_LESSON);
      await runFirstExample(page);
      const bundle = responses.find((r) =>
        ZOD_BUNDLE.test(new URL(r.url()).pathname),
      );
      expect(bundle?.fromServiceWorker(), 'the Zod bundle').toBe(true);
    } finally {
      await context.close();
    }
  });
});
