// §12 F8, moving between exercises and lessons (spec §4 `:next` `:prev` `:lesson`, §6 Pages:
// "`/l/:lesson` … first unfinished exercise selected; `/l/:lesson/:exercise` … the URL always
// reflects the selection", §6 Global keys `] e` `[ e` `g n` `g p`), on the three fixture lessons
// in roadmap order (01-fix, 02-implement, 03-type-challenge), from the keyboard in Chrome:
//   5. "`:next` and `:prev` move between exercises and across lesson boundaries; the URL
//      reflects the current exercise; a direct link to `/l/<lesson>/<exercise>` opens it."
// Each move is checked on the URL, the theory article's lesson, the strip's `aria-current` chip
// and the practice side's `data-exercise` (e2e/helpers/lesson.ts `expectExercise`). "First
// unfinished" is proven with an exercise passed by `:test` on its own solution, so the lesson
// page has to skip it. On a `predict` exercise there is no `:` line: `:next`/`:prev` go
// through the palette there, as §6 lists every ex command in it. Keyboard only; the seam
// focuses the editor at the start and loads the solution text. No fixed sleeps.
import { expect, test } from '@playwright/test';
import { ex, setDoc, snapshot } from './helpers/editor';
import { lessonRoute } from './helpers/content';
import {
  chips,
  currentChip,
  escToEditor,
  expectExercise,
  expectFocus,
  exerciseHeader,
  lessonNotice,
  openExercise,
  practicePane,
  readExerciseYaml,
  runFromPalette,
} from './helpers/lesson';
import {
  exerciseRoute,
  gotoExercise,
  readExerciseFile,
  runTest,
  verdict,
} from './helpers/verify';

test.describe('§12 F8: `:next` and `:prev` move between exercises and across lesson boundaries; the URL reflects the current exercise; a direct link to `/l/<lesson>/<exercise>` opens it.', () => {
  test('`:next` and `:prev` within a lesson and across both lesson boundaries; the URL and the strip follow every move', async ({
    page,
  }) => {
    await openExercise(page, '02-implement', '01-largest-shape');
    await expect(chips(page)).toHaveCount(2);

    await ex(page, 'next');
    await expectExercise(page, '02-implement', '02-literal-discriminant');
    await escToEditor(page);
    // Past the lesson's last exercise: the next lesson, on its first unfinished exercise.
    await ex(page, 'next');
    await expectExercise(page, '03-type-challenge', '01-describe-the-events');
    expect((await snapshot(page)).doc).not.toBe('');
    // `/l/<lesson>` was replaced by its exercise: Back returns to where `:next` was run.
    await page.goBack();
    await expectExercise(page, '02-implement', '02-literal-discriminant');
    await page.goForward();
    await expectExercise(page, '03-type-challenge', '01-describe-the-events');
    await escToEditor(page);
    expect((await snapshot(page)).doc).toBe(
      readExerciseFile(
        '03-type-challenge',
        '01-describe-the-events',
        'starter/index.ts',
      ),
    );

    // Before the lesson's first exercise: the previous lesson's last exercise.
    await ex(page, 'prev');
    await expectExercise(page, '02-implement', '02-literal-discriminant');
    await escToEditor(page);
    await ex(page, 'prev');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await escToEditor(page);
    await ex(page, 'prev');
    await expectExercise(page, '01-fix', '02-what-is-left');
    // A predict exercise has no editor: `:prev` from the palette.
    await runFromPalette(page, 'prev', ':prev');
    await expectExercise(page, '01-fix', '01-handle-the-new-shape');
    await escToEditor(page);
    // The first exercise of the course: nothing moves, and the reason is given.
    await ex(page, 'prev');
    await expect(lessonNotice(page)).toHaveText(
      'this is the first exercise of the course',
    );
    await expect(page).toHaveURL(
      exerciseRoute('01-fix', '01-handle-the-new-shape'),
    );
    // The URL survives a reload as the selection.
    await page.reload();
    await expectExercise(page, '01-fix', '01-handle-the-new-shape');
  });

  test('past the last exercise of the course `:next` stays and says so', async ({
    page,
  }) => {
    await openExercise(page, '03-type-challenge', '02-area-by-kind');
    await ex(page, 'next');
    await expect(lessonNotice(page)).toHaveText(
      'this is the last exercise of the course',
    );
    await expect(page).toHaveURL(
      exerciseRoute('03-type-challenge', '02-area-by-kind'),
    );
    await expectFocus(page, 'editor');
  });

  test('crossing into a lesson lands on its first unfinished exercise: a passed one is skipped', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoExercise(page, '03-type-challenge', '01-describe-the-events');
    await setDoc(
      page,
      readExerciseFile(
        '03-type-challenge',
        '01-describe-the-events',
        'solution/index.ts',
      ),
    );
    await runTest(page);
    await expect(verdict(page)).toHaveAttribute('data-verdict', 'passed');

    await ex(page, 'prev');
    await expectExercise(page, '02-implement', '02-literal-discriminant');
    await escToEditor(page);
    // Past 02-implement's last exercise, 03-type-challenge opens on 02-area-by-kind because
    // 01-describe-the-events is passed.
    await ex(page, 'next');
    await expectExercise(page, '03-type-challenge', '02-area-by-kind');
    await expect(currentChip(page)).toHaveAttribute('data-state', 'untouched');
    await escToEditor(page);
    // `:lesson prev` / `:lesson next`: the lesson's own route, then its first unfinished exercise.
    await ex(page, 'lesson prev');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await escToEditor(page);
    await ex(page, 'lesson next');
    await expectExercise(page, '03-type-challenge', '02-area-by-kind');
    // And straight from the lesson link.
    await page.goto(lessonRoute('03-type-challenge'));
    await expectExercise(page, '03-type-challenge', '02-area-by-kind');
  });

  test('`] e` / `[ e` and `g n` / `g p` from the theory pane move the same way', async ({
    page,
  }) => {
    await openExercise(page, '01-fix', '01-handle-the-new-shape');
    await page.keyboard.press('Control+h');
    await expectFocus(page, 'theory');
    await page.keyboard.press(']');
    await page.keyboard.press('e');
    await expectExercise(page, '01-fix', '02-what-is-left');
    await expectFocus(page, 'theory');
    await page.keyboard.press(']');
    await page.keyboard.press('e');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await page.keyboard.press('1');
    await expectFocus(page, 'theory');
    await page.keyboard.press('[');
    await page.keyboard.press('e');
    await expectExercise(page, '01-fix', '02-what-is-left');
    await page.keyboard.press('1');
    await page.keyboard.press('[');
    await page.keyboard.press('e');
    await expectExercise(page, '01-fix', '01-handle-the-new-shape');
    await expectFocus(page, 'theory');

    await page.keyboard.press('g');
    await page.keyboard.press('n');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await page.keyboard.press('1');
    await expectFocus(page, 'theory');
    await page.keyboard.press('g');
    await page.keyboard.press('n');
    await expectExercise(page, '03-type-challenge', '01-describe-the-events');
    await page.keyboard.press('1');
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await page.keyboard.press('1');
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expectExercise(page, '01-fix', '01-handle-the-new-shape');
    await page.keyboard.press('1');
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expect(lessonNotice(page)).toHaveText('this is the first lesson');
    await expectExercise(page, '01-fix', '01-handle-the-new-shape');
  });

  test('a direct link to /l/<lesson>/<exercise> opens that exercise; /l/<lesson> opens its first unfinished one; an unknown exercise says so', async ({
    page,
  }) => {
    const links = [
      ['03-type-challenge', '02-area-by-kind'],
      ['01-fix', '02-what-is-left'],
      ['02-implement', '02-literal-discriminant'],
    ] as const;
    for (const [lesson, exercise] of links) {
      const yaml = readExerciseYaml(lesson, exercise);
      await page.goto(exerciseRoute(lesson, exercise));
      await expectExercise(page, lesson, exercise);
      await expect(exerciseHeader(page).getByRole('heading')).toHaveText(
        yaml.title,
      );
      if (yaml.kind !== 'predict') {
        await escToEditor(page);
        expect((await snapshot(page)).doc).toBe(
          readExerciseFile(lesson, exercise, 'starter/index.ts'),
        );
      }
    }
    await page.goto(lessonRoute('01-fix'));
    await expect(page).toHaveURL(
      exerciseRoute('01-fix', '01-handle-the-new-shape'),
    );
    await expectExercise(page, '01-fix', '01-handle-the-new-shape');

    await page.goto(`${lessonRoute('01-fix')}/99-missing`);
    await expect(practicePane(page)).toContainText(
      'This lesson has no exercise named 99-missing.',
    );
    await expect(page).toHaveURL(`${lessonRoute('01-fix')}/99-missing`);
  });
});
