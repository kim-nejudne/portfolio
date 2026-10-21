// §12 F8, theory read and lesson completion (spec §1 Completion, §4 `:done`, §6 Lesson page and
// Module page and Roadmap, §7 `lessons`), on the fixture lesson 01-fix (one Check yourself
// question, a `fix` exercise and a `predict` exercise), from the keyboard in Chrome:
//   3. "`:done` with Check yourself questions unanswered jumps to the first one and says how
//      many remain; once all are answered correctly, `:done` marks theory read; passing every
//      required exercise then completes the lesson, and the module page and the roadmap show
//      it."
// The question's options and right answer, the exercise's solution and the predict's answer
// are read from the repository at test time. The fix exercise passes by `:test` on its own
// solution (e2e/helpers/verify.ts `runTest`, which waits for this run's verdict), the predict
// by its right option. Each step is checked on the page and in the §7 rows read from
// IndexedDB. The second test runs the other order (exercises first, then `:done`) and reaches
// `:done` through the palette on the predict exercise, where no editor exists. Keyboard only;
// the seam replaces the buffer with the solution (`setDoc`) and focuses the editor at the
// start. No fixed sleeps.
import { expect, test } from '@playwright/test';
import { ex, press, setDoc, vimPanel } from './helpers/editor';
import { FIXTURE_MODULE, lessonId } from './helpers/content';
import {
  answer,
  checkQuestion,
  chip,
  doneButton,
  escToEditor,
  expectExercise,
  expectFocus,
  explanation,
  layoutRoot,
  lessonNotice,
  predictQuestion,
  readCheckQuestions,
  readExerciseRow,
  readExerciseYaml,
  readLessonRow,
  result,
  runFromPalette,
  shown,
} from './helpers/lesson';
import {
  gotoExercise,
  readExerciseFile,
  runTest,
  verdict,
} from './helpers/verify';

const LESSON = '01-fix';
const FIX = '01-handle-the-new-shape';
const PREDICT = '02-what-is-left';

const ONE_REMAINS = '1 question remains: answer it correctly, then :done';

test.describe('§12 F8: `:done` with Check yourself questions unanswered jumps to the first one and says how many remain; once all are answered correctly, `:done` marks theory read; passing every required exercise then completes the lesson, and the module page and the roadmap show it.', () => {
  test('`:done` jumps to the unanswered question until it is right, then marks theory read; passing both exercises completes the lesson; /m and / show it', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const questions = readCheckQuestions(LESSON);
    expect(questions).toHaveLength(1);
    const question = questions[0];
    if (question === undefined) return;
    const predict = readExerciseYaml(LESSON, PREDICT);
    if (predict.answer === undefined) throw new Error('predict has no answer');

    await gotoExercise(page, LESSON, FIX);
    const block = checkQuestion(page, question.id);
    await expect(block).toHaveAttribute('data-answered', 'false');
    await expect(doneButton(page)).toHaveAttribute('data-read', 'false');

    // 1. `:done` with the question unanswered: the question gets the focus, the notice counts.
    await ex(page, 'done');
    await expectFocus(page, 'check', ':done focuses the unanswered question');
    await expect(block).toBeFocused();
    await expect(block).toBeInViewport();
    await expect(lessonNotice(page)).toHaveText(ONE_REMAINS);
    await expect(vimPanel(page)).toContainText(ONE_REMAINS);
    expect((await readLessonRow(page, LESSON))?.theoryReadAt).toBeUndefined();
    await expect(doneButton(page)).toHaveAttribute('data-read', 'false');

    // 2. A wrong answer: the explanation says so, and the question still counts as open.
    const wrong = question.answer === 0 ? 1 : 0;
    await answer(page, block, wrong);
    await expect(result(block)).toHaveAttribute('data-result', 'incorrect');
    await expect(explanation(block)).toContainText(shown(question.explanation));
    await expect
      .poll(async () => (await readLessonRow(page, LESSON))?.questions)
      .toMatchObject({
        [question.id]: { answerIndex: wrong, correct: false },
      });
    await escToEditor(page);
    await ex(page, 'done');
    await expectFocus(page, 'check', 'a wrong answer leaves the question open');
    await expect(lessonNotice(page)).toHaveText(ONE_REMAINS);
    expect((await readLessonRow(page, LESSON))?.theoryReadAt).toBeUndefined();

    // 3. The right answer, then `:done`: theory read, not yet complete.
    await answer(page, block, question.answer);
    await expect(result(block)).toHaveAttribute('data-result', 'correct');
    await expect
      .poll(async () => (await readLessonRow(page, LESSON))?.questions)
      .toMatchObject({
        [question.id]: { answerIndex: question.answer, correct: true },
      });
    await escToEditor(page);
    await ex(page, 'done');
    await expect(lessonNotice(page)).toHaveText('Theory read.');
    await expect(doneButton(page)).toHaveAttribute('data-read', 'true');
    await expect(doneButton(page)).toHaveText('Theory read');
    await expectFocus(
      page,
      'editor',
      'with nothing left, :done moves no focus',
    );
    let row = await readLessonRow(page, LESSON);
    expect(typeof row?.theoryReadAt).toBe('number');
    expect(row?.state).toBe('in-progress');
    expect(row?.completedAt).toBeUndefined();

    // 4. The fix exercise passes on its solution: one of two required exercises.
    await setDoc(page, readExerciseFile(LESSON, FIX, 'solution/index.ts'));
    await runTest(page);
    await expect(verdict(page)).toHaveAttribute('data-verdict', 'passed');
    await expect(chip(page, FIX)).toHaveAttribute('data-state', 'passed');
    await expect
      .poll(async () => (await readExerciseRow(page, LESSON, FIX))?.state)
      .toBe('passed');
    row = await readLessonRow(page, LESSON);
    expect(row?.state, 'the predict is still open').toBe('in-progress');

    // 5. The predict exercise's right answer completes the lesson.
    await ex(page, 'next');
    await expectExercise(page, LESSON, PREDICT);
    await page.keyboard.press('2');
    await expectFocus(page, 'question');
    await answer(page, predictQuestion(page), predict.answer);
    await expect(result(predictQuestion(page))).toHaveAttribute(
      'data-result',
      'correct',
    );
    await expect(chip(page, PREDICT)).toHaveAttribute('data-state', 'passed');
    await expect(lessonNotice(page)).toHaveText('Lesson complete.');
    await expect
      .poll(async () => (await readLessonRow(page, LESSON))?.state)
      .toBe('complete');
    row = await readLessonRow(page, LESSON);
    expect(typeof row?.completedAt).toBe('number');

    // 6. The module page and the roadmap show it.
    await page.goto(`/m/${FIXTURE_MODULE}`);
    const lessons = page.locator('ol.module-lessons > li[data-lesson]');
    await expect(lessons).toHaveCount(3);
    const done = lessons.and(
      page.locator(`li[data-lesson="${lessonId(LESSON)}"]`),
    );
    await expect(done).toHaveAttribute('data-state', 'complete');
    await expect(done.locator('[data-field="state"]')).toHaveText('complete');
    await expect(
      lessons.and(page.locator('li[data-state="complete"]')),
    ).toHaveCount(1);
    await expect(
      page.locator(`section[data-module="${FIXTURE_MODULE}"]`),
    ).toHaveAttribute('data-state', 'in-progress');
    await expectFocus(page, 'body');
    await press(page, 'gr');
    await expect(page).toHaveURL(/\/$/);
    const card = page.locator(`a[data-module="${FIXTURE_MODULE}"]`);
    await expect(card).toHaveAttribute('data-state', 'in-progress');
    await expect(card.locator('[data-field="progress"]')).toHaveText(
      '1 of 3 lessons complete',
    );

    // 7. A reload keeps it.
    await page.reload();
    await expect(card.locator('[data-field="progress"]')).toHaveText(
      '1 of 3 lessons complete',
    );
  });

  test('the other order: exercises first, then the question, then `:done` from the palette on the predict exercise completes the lesson at once', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const [question] = readCheckQuestions(LESSON);
    if (question === undefined) throw new Error('01-fix has no question');
    const predict = readExerciseYaml(LESSON, PREDICT);
    if (predict.answer === undefined) throw new Error('predict has no answer');

    await gotoExercise(page, LESSON, FIX);
    await setDoc(page, readExerciseFile(LESSON, FIX, 'solution/index.ts'));
    await runTest(page);
    await expect(verdict(page)).toHaveAttribute('data-verdict', 'passed');

    // `:done` from the practice-only layout brings the theory back to show the question.
    await ex(page, 'layout practice');
    await expect(layoutRoot(page)).toHaveAttribute('data-layout', 'practice');
    await ex(page, 'done');
    await expect(layoutRoot(page)).toHaveAttribute('data-layout', 'split');
    const block = checkQuestion(page, question.id);
    await expectFocus(page, 'check');
    await expect(lessonNotice(page)).toHaveText(ONE_REMAINS);
    await answer(page, block, question.answer);
    await expect(result(block)).toHaveAttribute('data-result', 'correct');

    await escToEditor(page);
    await ex(page, 'next');
    await expectExercise(page, LESSON, PREDICT);
    await page.keyboard.press('2');
    await answer(page, predictQuestion(page), predict.answer);
    await expect(chip(page, PREDICT)).toHaveAttribute('data-state', 'passed');
    // Every exercise passed, but theory is not read yet: not complete.
    await expect
      .poll(async () => (await readExerciseRow(page, LESSON, PREDICT))?.state)
      .toBe('passed');
    expect((await readLessonRow(page, LESSON))?.state).toBe('in-progress');

    // No editor on a predict exercise: `:done` from the palette.
    await expectFocus(page, 'question');
    await runFromPalette(page, 'done', ':done');
    await expect(lessonNotice(page)).toHaveText(
      'Theory read. Lesson complete.',
    );
    await expect(doneButton(page)).toHaveAttribute('data-read', 'true');
    await expect
      .poll(async () => (await readLessonRow(page, LESSON))?.state)
      .toBe('complete');
  });
});
