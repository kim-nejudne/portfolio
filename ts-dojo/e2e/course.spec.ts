// §12 F11, content wave 1 (Tier 0 and 1), in Chrome against the built course:
//   1. "M00 to M04 exist as §8 lists them: 20 lessons, each with the §1 structure, at least two
//      exercises (one in M00), at least one `predict`, hints on every editor exercise, and at
//      least one `ts twoslash` block."
// §12 F12, content wave 2 (Tier 2): "M05 to M09, 19 core lessons and the two optional ones, to
//   the same rules as F11, lint passing." The tests below are generated from the tree, so they
//   cover every wave the course holds.
// src/content/node/curriculum.test.ts proves the counts and the §1 structure in the source, and
// `pnpm content:lint` (criterion 2) proves every exercise solvable in Node. This spec proves the
// same course as Kim meets it in the browser, generated from the content tree at collection time
// (tiers, modules, lessons, exercise folders), never hard-coded:
//   - per lesson, `/l/<lesson id>` renders the frontmatter title and objectives, the five §1
//     sections as the only h2s in order, every inline `<Predict>`, every `ts twoslash` block with
//     one pre-rendered result per `^?` (and each result is about the identifier under its
//     caret), and the exercise strip with the lesson's exercise folders in order;
//   - per editor exercise (`fix`, `implement`, `type-challenge`), the starter fails `:test` and
//     the solution, every file of solution/ put in its buffer, passes it: what the lint proves in
//     Node, in Chrome;
//   - per `predict` exercise, a wrong option fails and the `answer` option passes, chosen with
//     `2` and `j`/`k`/`Enter`.
// The build is served by this spec's own `startDistServer` (one per worker, the §10 CSP on), never
// by the suite's server on 4173, which serves the fixture course; the worker refuses a build whose
// inlined §7 `contentVersion` is not the content tree's, so a stale dist/ cannot pass or fail
// for content it was not built from. Keyboard only: the seam focuses the editor and replaces a
// file's text (`setDoc`), as the F7 and F8 specs do. Every wait is an `expect`; no fixed sleeps.
import { test as base, expect } from '@playwright/test';
import { analyzeLesson } from '../src/content/node/analyze';
import {
  codeBlocks,
  gotoLessonAt,
  theory,
  twoslashQueries,
  twoslashResults,
} from './helpers/content';
import { COURSE_CONTENT, courseAt } from './helpers/course';
import { setDoc, snapshot } from './helpers/editor';
import {
  answer,
  chip,
  chips,
  expectExerciseAt,
  expectFocus,
  explanation,
  options,
  predictQuestion,
  result,
  shown,
  squash,
} from './helpers/lesson';
import {
  builtFrom,
  DIST,
  startDistServer,
  type DistServer,
} from './helpers/preview-server';
import {
  gotoExerciseAt,
  openPath,
  runTest,
  testsTab,
  verdict,
} from './helpers/verify';

/** The content tree the tests are generated from, and the build of it they run against. */
const CONTENT = COURSE_CONTENT;
const BUILD = DIST;
const COURSE = courseAt(CONTENT);
/** Every lesson of the course, in course order (tiers, modules, lessons). */
const LESSONS = COURSE.courseLessons();

/** §1 Lesson anatomy: theory, always in this order. */
const SECTIONS = [
  'Concept',
  'Examples',
  'Pitfalls',
  'Check yourself',
  'Further reading',
];
const PASSED = 'Passed. :next opens the next exercise.';

const test = base.extend<object, { courseServer: DistServer }>({
  courseServer: [
    // Playwright reads the fixtures a fixture needs from its first parameter's pattern.
    // eslint-disable-next-line no-empty-pattern
    async ({}, provide) => {
      const version = await COURSE.contentHash();
      if (!(await builtFrom(BUILD, version))) {
        throw new Error(
          `${BUILD} is not a build of ${CONTENT} as it stands (contentVersion ${version}): run \`pnpm build\` first`,
        );
      }
      const server = await startDistServer({ dir: BUILD });
      await provide(server);
      await server.close();
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ courseServer }, provide) => {
    await provide(courseServer.url);
  },
});

/** A pattern for `word` standing alone (not inside a longer identifier). */
function alone(word: string): RegExp {
  return new RegExp(
    `(^|[^A-Za-z0-9_$])${word.replace(/\$/g, '\\$')}(?![A-Za-z0-9_$])`,
  );
}

/** The §12 criterion a lesson's tests prove: each content wave owns its tiers' modules (§8, §11). */
function criterion(id: string): string {
  const module = Number(id.slice(1, 3));
  if (module <= 4) return '§12 F11 criterion 1';
  if (module <= 9) return '§12 F12';
  if (module <= 14) return '§12 F13';
  return '§12 F14';
}

for (const lessonId of LESSONS) {
  test.describe(lessonId, () => {
    if (!COURSE.lessonExists(lessonId)) {
      test(`${criterion(lessonId)}: ${lessonId} exists`, () => {
        throw new Error(
          `${CONTENT}/modules/${lessonId} has no lesson.mdx or no exercises/`,
        );
      });
      return;
    }
    const front = COURSE.readLesson(lessonId);
    const folders = COURSE.exerciseFolders(lessonId);

    test(`${criterion(lessonId)}: ${lessonId} renders with the §1 sections, its twoslash results and its exercise strip`, async ({
      page,
    }) => {
      const analysis = await analyzeLesson(
        COURSE.lessonMdx(lessonId),
        `${lessonId}/lesson.mdx`,
      );
      const fences = analysis.fences.filter((f) => f.kind === 'twoslash');
      expect(
        fences.length,
        'criterion 1: at least one ts twoslash block',
      ).toBeGreaterThan(0);

      await gotoLessonAt(page, lessonId);
      const article = theory(page);

      // The frontmatter's title (the page's only h1) and objectives.
      await expect(article.getByRole('heading', { level: 1 })).toHaveText(
        front.title,
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(article.locator('ul.objectives li')).toHaveText(
        front.objectives,
      );

      // The five sections, in §1's order, and no other h2.
      await expect(article.getByRole('heading', { level: 2 })).toHaveText(
        SECTIONS,
      );

      // Every inline <Predict>, in source order, with its options.
      const checks = article.locator('section[data-check-id]');
      await expect(checks).toHaveCount(analysis.predicts.length);
      for (const [index, site] of analysis.predicts.entries()) {
        await expect(checks.nth(index)).toHaveAttribute(
          'data-check-id',
          String(site.props['id']),
        );
        await expect(options(checks.nth(index))).toHaveCount(
          (site.props['options'] as unknown[]).length,
        );
      }

      // Every ts twoslash block, with one pre-rendered result per ^?, each about the identifier
      // under its caret; no ^? survives into the page.
      const blocks = codeBlocks(page, 'twoslash');
      await expect(
        blocks,
        'one rendered block per ts twoslash fence',
      ).toHaveCount(fences.length);
      let queried = 0;
      for (const [index, fence] of fences.entries()) {
        const block = blocks.nth(index);
        const where = `the ts twoslash block at lesson.mdx:${String(fence.line)}`;
        const queries = twoslashQueries(fence.code);
        queried += queries.length;
        const results = twoslashResults(block);
        await expect(results, `${where}: one result per ^?`).toHaveCount(
          queries.length,
        );
        for (const [at, query] of queries.entries()) {
          const rendered = results.nth(at);
          const which = `${where}, the ^? under line ${String(query.line + 1)} column ${String(query.col + 1)}`;
          await expect(rendered, which).toBeVisible();
          await expect(rendered, `${which}: a type`).toHaveText(/\S/);
          if (query.word !== null) {
            await expect(rendered, `${which}: names ${query.word}`).toHaveText(
              alone(query.word),
            );
          }
        }
        expect(await block.innerHTML(), `${where}: no ^? left`).not.toContain(
          '^?',
        );
      }
      if (queried === 0) {
        test.info().annotations.push({
          type: 'note',
          description: `${lessonId}: its twoslash blocks have no ^? query`,
        });
      }

      // The exercise strip: the lesson's exercise folders, in order, with their kinds and titles.
      const strip = chips(page);
      await expect(strip).toHaveCount(folders.length);
      for (const [index, folder] of folders.entries()) {
        const exercise = COURSE.readExercise(`${lessonId}/${folder}`);
        await expect(strip.nth(index)).toHaveAttribute('data-exercise', folder);
        await expect(strip.nth(index)).toHaveAttribute(
          'data-kind',
          exercise.kind,
        );
        await expect(strip.nth(index)).toContainText(
          `${String(index + 1)}. ${exercise.title}`,
        );
      }
    });

    for (const folder of folders) {
      const id = `${lessonId}/${folder}`;
      const exercise = COURSE.readExercise(id);

      if (exercise.kind === 'predict') {
        test(`${criterion(id)}: ${id} passes when its answer is chosen with j/k/Enter`, async ({
          page,
        }) => {
          const opts = exercise.options ?? [];
          const right = exercise.answer ?? -1;
          expect(opts.length).toBeGreaterThanOrEqual(2);
          expect(right).toBeGreaterThanOrEqual(0);
          expect(right).toBeLessThan(opts.length);
          const wrong = right === 0 ? 1 : 0;

          await page.goto(`/l/${id}`);
          await expectExerciseAt(page, lessonId, folder);
          const question = predictQuestion(page);
          await expect(question).toHaveAttribute('data-answered', 'false');
          // Prose as the page shows it (code spans without backticks); the snippet as written.
          await expect(question.locator('p').first()).toHaveText(
            shown(exercise.question ?? ''),
          );
          if (exercise.code !== undefined) {
            await expect(question.locator('pre')).toHaveText(
              squash(exercise.code),
            );
          }
          await expect(options(question).locator('code')).toHaveText(
            opts.map((option) => shown(option)),
          );

          // `2` focuses the question; a wrong option is recorded and passes nothing.
          await page.keyboard.press('2');
          await expectFocus(page, 'question');
          await answer(page, question, wrong);
          await expect(result(question)).toHaveAttribute(
            'data-result',
            'incorrect',
          );
          await expect(chip(page, folder)).toHaveAttribute(
            'data-state',
            'in-progress',
          );

          // The `answer` option passes the exercise and shows the explanation.
          await answer(page, question, right);
          await expect(result(question)).toHaveAttribute(
            'data-result',
            'correct',
          );
          await expect(question).toHaveAttribute('data-correct', 'true');
          await expect(explanation(question)).toContainText(
            shown(exercise.explanation ?? ''),
          );
          await expect(chip(page, folder)).toHaveAttribute(
            'data-state',
            'passed',
          );
        });
        continue;
      }

      test(`${criterion(id)}: ${id} passes :test with its solution in Chrome`, async ({
        page,
      }) => {
        // A cold compiler, then two :test runs, under the whole suite's load.
        test.setTimeout(60_000);
        const solution = COURSE.solutionFiles(id);
        const paths = Object.keys(solution);
        expect(paths.length, 'solution/ has files').toBeGreaterThan(0);

        await gotoExerciseAt(page, id);
        expect(
          await page.evaluate(() => window.__tsDojo?.editor.paths ?? []),
          '§3: starter/ and solution/ hold the same file names',
        ).toEqual(expect.arrayContaining(paths));

        // The starter, as the page opened it, fails: the pass below is the solution's doing.
        await runTest(page);
        await expect(verdict(page)).toHaveAttribute('data-verdict', 'failed');

        // Every solution file in its buffer, through `:b`.
        for (const [path, text] of Object.entries(solution)) {
          await openPath(page, path);
          await setDoc(page, text);
        }
        for (const [path, text] of Object.entries(solution)) {
          expect(
            await page.evaluate(
              (p) => window.__tsDojo?.editor.text(p) ?? null,
              path,
            ),
            `${path} holds the solution`,
          ).toBe(text);
        }
        expect((await snapshot(page)).mode).toBe('normal');

        await runTest(page);
        await expect(verdict(page)).toHaveAttribute('data-verdict', 'passed');
        await expect(verdict(page)).toHaveText(PASSED);
        await expect(testsTab(page)).toHaveText('Tests ✓');
        await expect(chip(page, folder)).toHaveAttribute(
          'data-state',
          'passed',
        );
      });
    }
  });
}
