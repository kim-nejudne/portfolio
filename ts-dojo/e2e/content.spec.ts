// §12 F6, the content pipeline, on the fixture lessons, under fixtures/content/modules/m99-fixtures
// since F11 (the fixture course the suite's server builds):
//   3. "A `ts twoslash` block renders its `^?` results at build time; the browser loads no
//      worker for theory."
//   4. "`ts run` blocks have Run and Open in REPL; `ts run errors` blocks show their
//      diagnostics."
//   5. "Three fixture lessons (one per editor kind, plus a `predict`) exist under `content/`
//      and render."
// and §12 F5 criterion 3, now that F6 has the button F5's seam stood in for:
//   "Open in REPL from a theory block creates a buffer with the snippet and focuses the editor
//   in normal mode."
// Criteria 1 and 2 of F6 are Node matters (scripts/content-lint.test.ts). The expected titles,
// objectives and fence bodies are read from the lesson.mdx files at test time, so the test
// follows the content; the hard-coded titles only prove the frontmatter parser read the right
// field. Keyboard only: the buttons are focused through `locator.focus()` and pressed with
// Enter. Every wait is an `expect`, `expect.poll` or `waitForFunction`; no fixed sleeps.
import { expect, test, type Page } from '@playwright/test';
import {
  codeBlocks,
  FIXTURE_LESSONS,
  firstFence,
  frontmatterObjectives,
  frontmatterTitle,
  gotoLesson,
  lessonRoute,
  readLessonMdx,
  theory,
  type FixtureLesson,
} from './helpers/content';
import {
  bufferNames,
  currentPath,
  press,
  readBuffer,
  readMeta,
  snapshot,
  vimPanel,
  waitForCompilerReady,
  waitForEditor,
} from './helpers/editor';

const ORIGIN = 'http://localhost:4173';
const HEADINGS = [
  'Concept',
  'Examples',
  'Pitfalls',
  'Check yourself',
  'Further reading',
];

/** One lesson per editor kind (§12 F6 criterion 5), with the second exercise's kind too. */
const FIXTURES: Record<
  FixtureLesson,
  {
    title: string;
    exercises: [folder: string, kind: string][];
    predictId: string;
  }
> = {
  '01-fix': {
    title: 'Fixing an exhaustiveness error',
    exercises: [
      ['01-handle-the-new-shape', 'fix'],
      ['02-what-is-left', 'predict'],
    ],
    predictId: 'default-branch-type',
  },
  '02-implement': {
    title: 'Implementing over a union',
    exercises: [
      ['01-largest-shape', 'implement'],
      ['02-literal-discriminant', 'fix'],
    ],
    predictId: 'best-after-check',
  },
  '03-type-challenge': {
    title: 'Describing alternatives as a type',
    exercises: [
      ['01-describe-the-events', 'type-challenge'],
      ['02-area-by-kind', 'implement'],
    ],
    predictId: 'equal-result',
  },
};

const editor = (page: Page) => page.locator('.cm-content');
const exerciseList = (page: Page) =>
  page
    .getByRole('complementary', { name: 'Practice' })
    .locator('ol.exercise-list');

test.describe('§12 F6: three fixture lessons (one per editor kind, plus a predict) exist under content/ and render', () => {
  for (const folder of FIXTURE_LESSONS) {
    const fixture = FIXTURES[folder];
    test(`${folder} renders its title, objectives, the five sections, a ${fixture.exercises[0]?.[1] ?? ''} exercise and a Predict`, async ({
      page,
    }) => {
      const mdx = readLessonMdx(folder);
      const title = frontmatterTitle(mdx);
      const objectives = frontmatterObjectives(mdx);
      expect(title, 'the frontmatter parser read the title').toBe(
        fixture.title,
      );
      expect(objectives, 'the frontmatter has two objectives').toHaveLength(2);

      await gotoLesson(page, folder);
      const article = theory(page);
      await expect(article.getByRole('heading', { level: 1 })).toHaveText(
        title,
      );
      await expect(
        page.getByRole('heading', { level: 1 }),
        'the lesson title is the only h1',
      ).toHaveCount(1);
      const items = article.locator('ul.objectives li');
      await expect(items).toHaveCount(2);
      await expect(items).toHaveText(objectives);
      await expect(article.getByRole('heading', { level: 2 })).toHaveText(
        HEADINGS,
      );

      // One fence of each kind the lesson uses, all rendered by shiki at build time.
      for (const kind of ['twoslash', 'run', 'run-errors'] as const) {
        await expect(codeBlocks(page, kind), `one ${kind} block`).toHaveCount(
          1,
        );
        await expect(
          codeBlocks(page, kind).locator('.twoslash-host pre.shiki'),
          `the ${kind} block is a shiki <pre>`,
        ).toHaveCount(1);
      }

      // The exercises, in order, with their kinds.
      const rows = exerciseList(page).locator('li[data-exercise][data-kind]');
      await expect(rows).toHaveCount(fixture.exercises.length);
      for (const [index, [exercise, kind]] of fixture.exercises.entries()) {
        await expect(rows.nth(index)).toHaveAttribute(
          'data-exercise',
          exercise,
        );
        await expect(rows.nth(index)).toHaveAttribute('data-kind', kind);
        await expect(rows.nth(index).getByRole('link')).toHaveAttribute(
          'href',
          `${lessonRoute(folder)}/${exercise}`,
        );
      }

      // The inline Predict under Check yourself: a question and four options.
      const predict = article.locator('section.predict');
      await expect(predict).toHaveCount(1);
      await expect(predict).toHaveAttribute('data-check-id', fixture.predictId);
      await expect(predict.locator('li[data-option]')).toHaveCount(4);
      await expect(predict.locator('li[data-option]').nth(3)).toHaveAttribute(
        'data-option',
        '3',
      );
      await expect(predict.locator('p').first()).not.toBeEmpty();
    });
  }

  test("the three lessons are the module's three, each exercise kind appears, and a lesson that does not exist says so", async ({
    page,
  }) => {
    const kinds = new Set(
      Object.values(FIXTURES).flatMap((f) => f.exercises.map(([, k]) => k)),
    );
    expect([...kinds].sort()).toEqual([
      'fix',
      'implement',
      'predict',
      'type-challenge',
    ]);
    await page.goto('/l/m99-fixtures/does-not-exist');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Lesson not found',
    );
    // The main region names the path (the header's breadcrumb shows it too).
    await expect(
      page.getByRole('main').getByText('/l/m99-fixtures/does-not-exist'),
    ).toBeVisible();
    await expect(theory(page)).toHaveCount(0);
    await expect(page.locator('ol.exercise-list')).toHaveCount(0);
  });
});

test.describe('§12 F6: a ts twoslash block renders its ^? results at build time; the browser loads no worker for theory', () => {
  test('01-fix shows "(parameter) shape: Circle" and "(parameter) shape: Square" from the built HTML, with no ^? left', async ({
    page,
  }) => {
    const scripts = new Set<string>();
    page.on('response', (response) => {
      if (/\/assets\/.*\.js(\?.*)?$/.test(response.url()))
        scripts.add(response.url());
    });
    await gotoLesson(page, '01-fix');
    const block = codeBlocks(page, 'twoslash');
    const popovers = block.locator('.meta-line .popover');
    await expect(popovers).toHaveCount(2);
    await expect(popovers.nth(0)).toHaveText('(parameter) shape: Circle');
    await expect(popovers.nth(1)).toHaveText('(parameter) shape: Square');
    // The query lines are consumed by the renderer: no `^?` survives into the page...
    expect(await block.innerHTML()).not.toContain('^?');
    // ...while the twoslash source still has two.
    expect(
      firstFence(readLessonMdx('01-fix'), 'twoslash').match(/\^\?/g),
    ).toHaveLength(2);
    // The result is a string inside a built chunk: it was computed before the browser opened.
    const bodies = await Promise.all(
      [...scripts].map(async (url) => (await page.request.get(url)).text()),
    );
    expect(
      bodies.some((body) => body.includes('(parameter) shape: Circle')),
      `a built chunk carries the twoslash result (${String(scripts.size)} scripts seen)`,
    ).toBe(true);
    // The other lessons' queries rendered too (one each).
    await gotoLesson(page, '02-implement');
    await expect(
      codeBlocks(page, 'twoslash').locator('.meta-line .popover'),
    ).toHaveText(['(property) text: string']);
    await gotoLesson(page, '03-type-challenge');
    await expect(
      codeBlocks(page, 'twoslash').locator('.meta-line .popover'),
    ).toHaveText([/^type Click = \{\s+type: "click";\s+x: number;\s+\}$/]);
  });

  test('the only worker is the ts-ls worker main.tsx starts on every page, the same one the roadmap starts; nothing fetches twoslash or shiki', async ({
    page,
  }) => {
    const started: string[] = [];
    const requests: string[] = [];
    page.on('worker', (worker) => started.push(worker.url()));
    page.on('request', (request) => requests.push(request.url()));

    // The roadmap has no theory: whatever worker it starts is the app's, not the content's.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
    await expect.poll(() => started.length).toBe(1);
    const appWorker = started[0] as string;
    expect(appWorker.startsWith(`${ORIGIN}/assets/`)).toBe(true);

    // The lesson page (a new document, so the app worker starts again) renders its twoslash
    // result and still has exactly one worker, with the same URL, once the compiler is ready.
    await gotoLesson(page, '01-fix');
    await expect(
      codeBlocks(page, 'twoslash').locator('.meta-line .popover').first(),
    ).toHaveText('(parameter) shape: Circle');
    await waitForCompilerReady(page);
    expect(page.workers().map((w) => w.url())).toEqual([appWorker]);
    expect(started, "one worker per document, both the app's").toEqual([
      appWorker,
      appWorker,
    ]);

    // No request names twoslash or shiki, and none leaves the origin (§12 F2).
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.filter((url) => /twoslash|shiki/i.test(url))).toEqual([]);
    expect(requests.filter((url) => !url.startsWith(`${ORIGIN}/`))).toEqual([]);
  });
});

test.describe('§12 F6: ts run blocks have Run and Open in REPL; ts run errors blocks show their diagnostics', () => {
  test('01-fix: the run block has both buttons, Run prints the two lines under it and reports done in N ms', async ({
    page,
  }) => {
    await gotoLesson(page, '01-fix');
    const block = codeBlocks(page, 'run');
    const run = block.getByRole('button', { name: 'Run', exact: true });
    const open = block.getByRole('button', { name: 'Open in REPL' });
    await expect(block.getByRole('button')).toHaveCount(2);
    await expect(run).toBeVisible();
    await expect(open).toBeVisible();
    // No diagnostics list: the snippet compiles.
    await expect(block.locator('ul.code-block-diagnostics')).toHaveCount(0);
    const output = block.getByRole('region', { name: 'Output' });
    await expect(output).toHaveCount(0);

    await run.focus();
    await expect(run).toBeFocused();
    await page.keyboard.press('Enter');
    const entries = output.locator('li');
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText('circle with radius 2');
    await expect(entries.nth(1)).toContainText('square with side 3');
    await expect(output.getByRole('status')).toHaveText(/^done in \d+ ms$/);
    // Running stays on the lesson (on its first exercise, §6), with the button still focused.
    await expect(page).toHaveURL(
      `${lessonRoute('01-fix')}/01-handle-the-new-shape`,
    );
    await expect(run).toBeFocused();
    // The other blocks printed nothing.
    await expect(
      theory(page).getByRole('region', { name: 'Output' }),
    ).toHaveCount(1);
  });

  test('a static or twoslash block has neither button and no diagnostics', async ({
    page,
  }) => {
    await gotoLesson(page, '01-fix');
    await expect(codeBlocks(page, 'twoslash').getByRole('button')).toHaveCount(
      0,
    );
    await expect(
      codeBlocks(page, 'twoslash').locator('ul.code-block-diagnostics'),
    ).toHaveCount(0);
    // Every button in the theory belongs to a run or run-errors block.
    await expect(theory(page).getByRole('button')).toHaveCount(4);
  });

  test('01-fix: the run errors block has the buttons and lists TS2322 "not assignable to type \'never\'" at line 13', async ({
    page,
  }) => {
    await gotoLesson(page, '01-fix');
    const block = codeBlocks(page, 'run-errors');
    await expect(
      block.getByRole('button', { name: 'Run', exact: true }),
    ).toBeVisible();
    await expect(
      block.getByRole('button', { name: 'Open in REPL' }),
    ).toBeVisible();
    const diagnostics = block.getByRole('list', { name: 'Diagnostics' });
    await expect(diagnostics).toHaveClass(/code-block-diagnostics/);
    const rows = diagnostics.locator('li');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveText(/^line 13, TS2322: /);
    await expect(rows.first()).toContainText(
      "is not assignable to type 'never'",
    );
    await expect(rows.first()).toContainText('"triangle"');
    // The fence's 13th line is the `never` assignment the message is about.
    const fence = firstFence(readLessonMdx('01-fix'), 'run errors');
    expect(fence.split('\n')[12]?.trim()).toBe(
      'const unreachable: never = shape;',
    );
  });

  test("02-implement: the run errors block lists TS18048 \"'best' is possibly 'undefined'\" at line 10", async ({
    page,
  }) => {
    await gotoLesson(page, '02-implement');
    const rows = codeBlocks(page, 'run-errors').locator(
      'ul.code-block-diagnostics li',
    );
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveText(
      "line 10, TS18048: 'best' is possibly 'undefined'.",
    );
    const fence = firstFence(readLessonMdx('02-implement'), 'run errors');
    expect(fence.split('\n')[9]?.trim()).toBe('return best.kind;');
  });
});

test.describe('§12 F5: Open in REPL from a theory block creates a buffer with the snippet and focuses the editor in normal mode', () => {
  test("Enter on the run block's Open in REPL opens /repl on 01-fix.ts holding the fence, the editor focused in normal mode", async ({
    page,
  }) => {
    const fence = firstFence(readLessonMdx('01-fix'), 'run');
    expect(fence.split('\n')[0]).toMatch(/^type Shape =/);
    await gotoLesson(page, '01-fix');
    expect(await bufferNames(page), 'a fresh context has no buffers').toEqual(
      [],
    );
    const open = codeBlocks(page, 'run').getByRole('button', {
      name: 'Open in REPL',
    });
    await open.focus();
    await expect(open).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/repl$/);
    await waitForEditor(page);
    // Focus is the app's doing: the test never focuses the editor itself.
    await expect(editor(page)).toBeFocused();
    await expect.poll(() => currentPath(page)).toBe('/01-fix.ts');
    const s = await snapshot(page);
    expect(s.doc, 'the buffer holds the fence').toBe(fence);
    expect(s.mode).toBe('normal');
    await expect(vimPanel(page)).toHaveText('--NORMAL--');
    await expect(
      page
        .getByRole('tablist', { name: 'Files' })
        .getByRole('tab', { selected: true }),
    ).toHaveAttribute('data-path', '/01-fix.ts');
    // The §7 row is there and is the last buffer; no welcome pair was seeded around it.
    expect((await readBuffer(page, '01-fix.ts'))?.text).toBe(fence);
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('01-fix.ts');
    expect(await bufferNames(page)).toEqual(['01-fix.ts']);

    // A Vim key lands in the editor straight away: the focus is real and the mode is normal.
    await press(page, 'j');
    expect((await snapshot(page)).line).toBe(2);
    expect((await snapshot(page)).doc).toBe(fence);
  });

  test("the run errors block's button makes a second buffer, 01-fix-2.ts, with its own snippet", async ({
    page,
  }) => {
    const runFence = firstFence(readLessonMdx('01-fix'), 'run');
    const errorsFence = firstFence(readLessonMdx('01-fix'), 'run errors');
    expect(errorsFence).not.toBe(runFence);
    await gotoLesson(page, '01-fix');
    const first = codeBlocks(page, 'run').getByRole('button', {
      name: 'Open in REPL',
    });
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/repl$/);
    await waitForEditor(page);
    await expect(editor(page)).toBeFocused();
    await expect.poll(() => currentPath(page)).toBe('/01-fix.ts');

    await page.goBack();
    await expect(page).toHaveURL(
      `${lessonRoute('01-fix')}/01-handle-the-new-shape`,
    );
    await expect(theory(page)).toHaveAttribute(
      'data-lesson',
      'm99-fixtures/01-fix',
    );
    const second = codeBlocks(page, 'run-errors').getByRole('button', {
      name: 'Open in REPL',
    });
    await second.focus();
    await expect(second).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/repl$/);
    await waitForEditor(page);
    await expect(editor(page)).toBeFocused();
    await expect.poll(() => currentPath(page)).toBe('/01-fix-2.ts');
    const s = await snapshot(page);
    expect(s.doc).toBe(errorsFence);
    expect(s.mode).toBe('normal');
    expect(await bufferNames(page)).toEqual(['01-fix-2.ts', '01-fix.ts']);
    expect(
      (await readBuffer(page, '01-fix.ts'))?.text,
      'the first is intact',
    ).toBe(runFence);
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('01-fix-2.ts');
  });
});
