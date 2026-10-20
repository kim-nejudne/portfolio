// §12 F3 criterion 3 ("Every ex command in §4 does what its row says"), for the rows the lesson
// page owns (F8): `:hint`, `:sol`/`:solution`, `:reset`, `:done`, `:next`/`:n`, `:prev`/`:N`,
// `:lesson next`, `:lesson prev`, `:theory`, `:practice`, `:output`, `:focus left/right/up/
// down`, `:layout split/theory/practice` and `:prompt`, each run from the editor's `:` line on
// a fixture lesson (spec §4 Ex commands, §6 Lesson page: "`:layout` switches to one pane full
// width. The layout choice is remembered"; §6 Command palette: every ex command is in it, and
// on a `predict` exercise, which has no `:` line, the palette is how they run). A pane the
// layout hides comes back with the split when it is asked for by `1`/`2`/`3`, `Esc` or its
// ex command. The criteria tests in e2e/lesson-*.spec.ts go deeper on `:hint`, `:sol`,
// `:reset`, `:done` and `:next`/`:prev`; this file proves each row and its aliases and bad
// arguments. Keyboard only; the seam focuses the editor at the start. No fixed sleeps.
import { expect, test, type Page } from '@playwright/test';
import {
  SETTINGS_KEY,
  ex,
  press,
  readStoredSettings,
  snapshot,
  vimPanel,
} from './helpers/editor';
import {
  answer,
  checkQuestion,
  doneButton,
  escToEditor,
  expectExercise,
  expectExerciseAt,
  expectFocus,
  focused,
  headerField,
  hintItems,
  layoutRoot,
  lessonNotice,
  openExercise,
  practicePane,
  predictQuestion,
  promptBox,
  readCheckQuestions,
  readExerciseYaml,
  readLessonRow,
  runFromPalette,
  separator,
  solutionPane,
  squash,
  theoryPane,
  widthShare,
  type FocusTarget,
} from './helpers/lesson';
import { exerciseRoute, readExerciseFile } from './helpers/verify';
import { lessonId } from './helpers/content';
import { courseLessons, exerciseFolders, routeOf } from './helpers/course';

const FIX = { lesson: '01-fix', exercise: '01-handle-the-new-shape' } as const;
const PREDICT = { lesson: '01-fix', exercise: '02-what-is-left' } as const;

async function expectLayout(
  page: Page,
  mode: 'split' | 'theory' | 'practice',
): Promise<void> {
  await expect(layoutRoot(page)).toHaveAttribute('data-layout', mode);
  if (mode === 'practice') await expect(theoryPane(page)).toBeHidden();
  else await expect(theoryPane(page)).toBeVisible();
  if (mode === 'theory') await expect(practicePane(page)).toBeHidden();
  else await expect(practicePane(page)).toBeVisible();
  await expect(separator(page)).toHaveCount(mode === 'split' ? 1 : 0);
}

/** Runs an ex command and asserts where the focus went. */
async function exTo(
  page: Page,
  command: string,
  to: FocusTarget,
): Promise<void> {
  await ex(page, command);
  await expectFocus(page, to, `:${command} → ${to}`);
}

test.describe(':hint', () => {
  test('reveals the next hint, in order, and says when none are left', async ({
    page,
  }) => {
    const { hints = [] } = readExerciseYaml(FIX.lesson, FIX.exercise);
    expect(hints).toHaveLength(2);
    await openExercise(page, FIX.lesson, FIX.exercise);
    await expect(headerField(page, 'hints')).toHaveText('hints 0/2');
    await ex(page, 'hint');
    await expect(hintItems(page)).toHaveCount(1);
    await expect(hintItems(page).first()).toHaveText(
      `Hint 1. ${hints[0] ?? ''}`,
    );
    await expect(lessonNotice(page)).toHaveText('hint 1 of 2');
    await expect(vimPanel(page)).toContainText('hint 1 of 2');
    await ex(page, 'hint');
    await expect(hintItems(page)).toHaveCount(2);
    await expect(hintItems(page).nth(1)).toHaveText(
      `Hint 2. ${hints[1] ?? ''}`,
    );
    await expect(headerField(page, 'hints')).toHaveText('hints 2/2');
    await ex(page, 'hint');
    await expect(lessonNotice(page)).toHaveText(
      'no more hints: all 2 are shown',
    );
    await expect(hintItems(page)).toHaveCount(2);
    await expectFocus(page, 'editor');
  });
});

test.describe(':sol and :solution', () => {
  test('open the solution read-only in a split; the same command again closes it', async ({
    page,
  }) => {
    const solution = readExerciseFile(
      FIX.lesson,
      FIX.exercise,
      'solution/index.ts',
    );
    await openExercise(page, FIX.lesson, FIX.exercise);
    await ex(page, 'solution');
    await expect(solutionPane(page)).toBeVisible();
    expect(
      (
        await solutionPane(page)
          .locator('figure[data-path="/index.ts"] pre')
          .textContent()
      )?.trimEnd(),
    ).toBe(solution.trimEnd());
    await expect(headerField(page, 'solution-viewed')).toHaveText(
      'solution viewed',
    );
    await expectFocus(page, 'editor');
    await ex(page, 'sol');
    await expect(solutionPane(page)).toHaveCount(0);
    await ex(page, 'sol');
    await expect(solutionPane(page)).toBeVisible();
    await ex(page, 'solution');
    await expect(solutionPane(page)).toHaveCount(0);
  });
});

test.describe(':reset', () => {
  test('asks in the Vim panel; Esc and Enter cancel like n; y restores the starter', async ({
    page,
  }) => {
    const starter = readExerciseFile(
      FIX.lesson,
      FIX.exercise,
      'starter/index.ts',
    );
    await openExercise(page, FIX.lesson, FIX.exercise);
    await press(page, 'dd');
    const edited = (await snapshot(page)).doc;
    expect(edited).not.toBe(starter);
    for (const cancel of ['Escape', 'Enter', 'n']) {
      await ex(page, 'reset');
      const prompt = vimPanel(page).getByRole('alertdialog');
      await expect(prompt).toContainText('Reset to the starter files? (y/n)');
      await page.keyboard.press(cancel);
      await expect(prompt).toHaveCount(0);
      await expect(lessonNotice(page)).toHaveText('reset cancelled');
      expect((await snapshot(page)).doc, `${cancel} keeps the edit`).toBe(
        edited,
      );
      await expectFocus(page, 'editor');
    }
    await ex(page, 'reset');
    await page.keyboard.press('y');
    await expect.poll(async () => (await snapshot(page)).doc).toBe(starter);
    await expectFocus(page, 'editor');
  });
});

test.describe(':done', () => {
  test('works from either pane: the done button in the theory pane (Enter) and the `:` line', async ({
    page,
  }) => {
    const [question] = readCheckQuestions('02-implement');
    if (question === undefined) throw new Error('02-implement has no question');
    await openExercise(page, '02-implement', '01-largest-shape');
    await page.keyboard.press('Control+h');
    await expectFocus(page, 'theory');
    // Tab through the theory pane to its button.
    const tabTo = async (target: FocusTarget): Promise<void> => {
      for (let i = 0; i < 40 && (await focused(page)) !== target; i += 1) {
        await page.keyboard.press('Tab');
      }
      await expectFocus(page, target);
    };
    await tabTo('done');
    await page.keyboard.press('Enter');
    await expectFocus(page, 'check', 'the button jumps to the open question');
    await expect(lessonNotice(page)).toHaveText(
      '1 question remains: answer it correctly, then :done',
    );
    const block = checkQuestion(page, question.id);
    await answer(page, block, question.answer);
    await tabTo('done');
    await page.keyboard.press('Enter');
    await expect(lessonNotice(page)).toHaveText('Theory read.');
    await expect(doneButton(page)).toHaveAttribute('data-read', 'true');
    await expect
      .poll(
        async () =>
          typeof (await readLessonRow(page, '02-implement'))?.theoryReadAt,
      )
      .toBe('number');
    const readAt = (await readLessonRow(page, '02-implement'))?.theoryReadAt;
    // From the editor: the same command, and it keeps the first time.
    await escToEditor(page);
    await ex(page, 'done');
    await expect(vimPanel(page)).toContainText('Theory read.');
    expect((await readLessonRow(page, '02-implement'))?.theoryReadAt).toBe(
      readAt,
    );
  });
});

test.describe(':next, :n, :prev, :N', () => {
  test('move to the next and previous exercise; the aliases do the same', async ({
    page,
  }) => {
    await openExercise(page, '02-implement', '01-largest-shape');
    await ex(page, 'n');
    await expectExercise(page, '02-implement', '02-literal-discriminant');
    await escToEditor(page);
    await ex(page, 'N');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await escToEditor(page);
    await ex(page, 'next');
    await expectExercise(page, '02-implement', '02-literal-discriminant');
    await escToEditor(page);
    await ex(page, 'prev');
    await expectExercise(page, '02-implement', '01-largest-shape');
  });
});

test.describe(':lesson next and :lesson prev', () => {
  test('go to the next or previous lesson directly (its first unfinished exercise), stop at the ends, and reject other arguments', async ({
    page,
  }) => {
    const lessons = courseLessons();
    const after = lessons[lessons.indexOf(lessonId('03-type-challenge')) + 1];
    const last = lessons.at(-1);
    if (after === undefined || last === undefined) {
      throw new Error('the course ends at the fixture module');
    }
    await openExercise(page, '02-implement', '02-literal-discriminant');
    await ex(page, 'lesson next');
    await expectExercise(page, '03-type-challenge', '01-describe-the-events');
    await escToEditor(page);
    // Into the next module: its first lesson, a predict one (no `:` line there: the palette).
    await ex(page, 'lesson next');
    await expectExerciseAt(page, after, exerciseFolders(after)[0] ?? '');
    await runFromPalette(page, 'lesson prev', ':lesson prev');
    await expectExercise(page, '03-type-challenge', '01-describe-the-events');
    await escToEditor(page);
    await ex(page, 'lesson prev');
    // Not `:prev`: the lesson opens on its first unfinished exercise, not its last one.
    await expectExercise(page, '02-implement', '01-largest-shape');
    await escToEditor(page);
    await ex(page, 'lesson prev');
    await expectExercise(page, '01-fix', '01-handle-the-new-shape');
    await escToEditor(page);
    await ex(page, 'lesson prev');
    await expect(lessonNotice(page)).toHaveText('this is the first lesson');
    await ex(page, 'lesson up');
    await expect(vimPanel(page)).toContainText(
      ':lesson takes one of: next, prev',
    );
    await expect(page).toHaveURL(
      exerciseRoute('01-fix', '01-handle-the-new-shape'),
    );

    // The course's last lesson (predict only): `:lesson next` from the palette stops there.
    const [lastFirst] = exerciseFolders(last);
    if (lastFirst === undefined) throw new Error(`${last} has no exercise`);
    await page.goto(routeOf(last));
    await expectExerciseAt(page, last, lastFirst);
    await page.keyboard.press('2');
    await expectFocus(page, 'question');
    await runFromPalette(page, 'lesson next', ':lesson next');
    await expect(lessonNotice(page)).toHaveText('this is the last lesson');
    await expect(page).toHaveURL(routeOf(`${last}/${lastFirst}`));
  });
});

test.describe(':theory, :practice, :output', () => {
  test('focus that pane from the editor', async ({ page }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    await exTo(page, 'theory', 'theory');
    await escToEditor(page);
    await exTo(page, 'output', 'output');
    await escToEditor(page);
    await exTo(page, 'practice', 'editor');
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('on a predict exercise they run from the palette: :practice focuses the question, :theory the theory, :output says there is none', async ({
    page,
  }) => {
    await page.goto(exerciseRoute(PREDICT.lesson, PREDICT.exercise));
    await expectExercise(page, PREDICT.lesson, PREDICT.exercise);
    await page.keyboard.press('1');
    await expectFocus(page, 'theory');
    await runFromPalette(page, ':practice', ':practice');
    await expectFocus(page, 'question');
    await runFromPalette(page, ':theory', ':theory');
    await expectFocus(page, 'theory');
    await runFromPalette(page, ':output', ':output');
    await expect(lessonNotice(page)).toHaveText(
      'a predict exercise has no output pane',
    );
    await expect(predictQuestion(page)).toHaveAttribute(
      'data-answered',
      'false',
    );
  });
});

test.describe(':focus left/right/up/down', () => {
  test('moves by position from the editor: left is theory, down is output, nothing is right or up; other arguments are rejected', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    await exTo(page, 'focus left', 'theory');
    await escToEditor(page);
    await exTo(page, 'focus down', 'output');
    await escToEditor(page);
    await exTo(page, 'focus right', 'editor');
    await exTo(page, 'focus up', 'editor');
    await ex(page, 'focus sideways');
    await expect(vimPanel(page)).toContainText(
      ':focus takes one of: left, right, up, down',
    );
    await expectFocus(page, 'editor');
  });
});

test.describe(':layout split, :layout theory, :layout practice', () => {
  test('one pane full width or the split, remembered in the store and the settings; other arguments are rejected', async ({
    page,
  }) => {
    await openExercise(page, '02-implement', '01-largest-shape');
    await expectLayout(page, 'split');

    await exTo(page, 'layout practice', 'editor');
    await expectLayout(page, 'practice');
    await expect(lessonNotice(page)).toHaveText('layout: practice');
    expect(await widthShare(page, practicePane(page))).toBeCloseTo(1, 2);

    await exTo(page, 'layout split', 'editor');
    await expectLayout(page, 'split');
    expect(await widthShare(page, theoryPane(page))).toBeCloseTo(0.4, 2);

    await ex(page, 'layout theory');
    await expectLayout(page, 'theory');
    expect(await widthShare(page, theoryPane(page))).toBeCloseTo(1, 2);
    // Back to the split from the theory pane, through the palette (where the focus lands after
    // `:layout theory` is the next test's).
    await page.keyboard.press('1');
    await expectFocus(page, 'theory');
    await runFromPalette(page, 'layout split', ':layout split');
    await expectLayout(page, 'split');

    await escToEditor(page);
    await ex(page, 'layout wide');
    await expect(vimPanel(page)).toContainText(
      ':layout takes one of: split, theory, practice',
    );
    await expectLayout(page, 'split');
  });

  test('`:layout theory` run from the editor moves the focus to the theory pane, since the editor is hidden', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    await ex(page, 'layout theory');
    await expectLayout(page, 'theory');
    await expectFocus(
      page,
      'theory',
      ':layout theory moves the focus to theory',
    );
  });

  test('a hidden pane comes back with the split when 1, 2, 3, Esc, :theory, :output or :practice asks for it', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    // Theory hidden.
    await ex(page, 'layout practice');
    await expectLayout(page, 'practice');
    await exTo(page, 'theory', 'theory');
    await expectLayout(page, 'split');
    await escToEditor(page);
    await ex(page, 'layout practice');
    await page.keyboard.press('Control+j');
    await expectFocus(page, 'output');
    await page.keyboard.press('1');
    await expectFocus(page, 'theory');
    await expectLayout(page, 'split');

    // Practice hidden: from the theory pane, by key.
    for (const [key, to] of [
      ['2', 'editor'],
      ['3', 'output'],
      ['Escape', 'editor'],
    ] as const) {
      await escToEditor(page);
      await ex(page, 'layout theory');
      await expectLayout(page, 'theory');
      await page.keyboard.press('1');
      await expectFocus(page, 'theory');
      await page.keyboard.press(key);
      await expectFocus(page, to, `${key} with the practice side hidden`);
      await expectLayout(page, 'split');
    }
    // ... and by ex command, from the palette (the `:` line is hidden with the editor).
    for (const [command, to] of [
      ['output', 'output'],
      ['practice', 'editor'],
    ] as const) {
      await escToEditor(page);
      await ex(page, 'layout theory');
      await expectLayout(page, 'theory');
      await page.keyboard.press('1');
      await expectFocus(page, 'theory');
      await runFromPalette(page, `:${command}`, `:${command}`);
      await expectFocus(page, to, `:${command} with the practice side hidden`);
      await expectLayout(page, 'split');
    }
  });

  test('the layout choice is remembered: per lesson in the store, as the default in the settings, and over a reload', async ({
    page,
  }) => {
    await openExercise(page, '02-implement', '01-largest-shape');
    await ex(page, 'layout practice');
    await expectLayout(page, 'practice');
    await expect
      .poll(async () => (await readLessonRow(page, '02-implement'))?.layout)
      .toBe('practice');
    expect((await readStoredSettings(page))?.layout).toBe('practice');

    await page.reload();
    await expectExercise(page, '02-implement', '01-largest-shape');
    await expectLayout(page, 'practice');

    // A lesson without its own choice takes the last one as the default.
    await escToEditor(page);
    await ex(page, 'lesson next');
    await expectExercise(page, '03-type-challenge', '01-describe-the-events');
    await expectLayout(page, 'practice');
    await escToEditor(page);
    await ex(page, 'layout split');
    await expectLayout(page, 'split');
    await expect
      .poll(
        async () => (await readLessonRow(page, '03-type-challenge'))?.layout,
      )
      .toBe('split');
    expect((await readStoredSettings(page))?.layout).toBe('split');

    // 02-implement keeps its own choice.
    await escToEditor(page);
    await ex(page, 'lesson prev');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await expectLayout(page, 'practice');
    await page.reload();
    await expectExercise(page, '02-implement', '01-largest-shape');
    await expectLayout(page, 'practice');
    expect(
      await page.evaluate((key) => localStorage.getItem(key), SETTINGS_KEY),
    ).toContain('"layout":"split"');
  });
});

test.describe(':prompt', () => {
  test('shows or hides the exercise prompt above the editor', async ({
    page,
  }) => {
    const { prompt = '' } = readExerciseYaml(
      '02-implement',
      '01-largest-shape',
    );
    // The prompt's opening words, before any inline code.
    const opening = squash(prompt.split('`')[0] ?? '');
    expect(opening.length).toBeGreaterThan(10);
    await openExercise(page, '02-implement', '01-largest-shape');
    await expect(promptBox(page)).toContainText(opening);
    const editorTop = async (): Promise<number> =>
      (await page.locator('.cm-editor').boundingBox())?.y ?? 0;
    const promptBox0 = await promptBox(page).boundingBox();
    expect(promptBox0?.y ?? Infinity).toBeLessThan(await editorTop());

    await ex(page, 'prompt');
    await expect(promptBox(page)).toHaveCount(0);
    await expectFocus(page, 'editor');
    await ex(page, 'prompt');
    await expect(promptBox(page)).toContainText(opening);
    await expectFocus(page, 'editor');
    // The editor's text never changed.
    expect((await snapshot(page)).doc).toBe(
      readExerciseFile('02-implement', '01-largest-shape', 'starter/index.ts'),
    );
  });
});

test.describe('the palette on a predict exercise', () => {
  test('Ctrl-p, `next`, Enter runs :next: the URL moves to the next exercise', async ({
    page,
  }) => {
    await page.goto(exerciseRoute(PREDICT.lesson, PREDICT.exercise));
    await expectExercise(page, PREDICT.lesson, PREDICT.exercise);
    await page.keyboard.press('2');
    await expectFocus(page, 'question');
    await runFromPalette(page, 'next', ':next');
    await expectExercise(page, '02-implement', '01-largest-shape');
  });
});

// Three things the first pass of these specs found, each fixed in the app: a move from the
// editor left the focus on <body>; `:focus` from the palette acted as if typed in the editor;
// a notice was hidden with the practice side under `:layout theory`.
test.describe('focus after a move, :focus from the palette, notices under :layout theory', () => {
  test(':next from the editor lands the focus in the next exercise’s editor, and on its question for a predict', async ({
    page,
  }) => {
    await openExercise(page, '02-implement', '01-largest-shape');
    await escToEditor(page);
    await ex(page, 'next');
    await expectExercise(page, '02-implement', '02-literal-discriminant');
    await expectFocus(page, 'editor', 'the new editor has the focus');
    expect((await snapshot(page)).mode).toBe('normal');
    await ex(page, 'prev');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await expectFocus(page, 'editor');
    await ex(page, 'lesson prev');
    await expectExercise(page, '01-fix', '01-handle-the-new-shape');
    await expectFocus(page, 'editor', 'across a lesson too');
    await ex(page, 'next');
    await expectExercise(page, '01-fix', '02-what-is-left');
    await expect(predictQuestion(page)).toBeFocused();
  });

  test(':focus down from the palette with the theory pane focused does what Ctrl-j there does: nothing', async ({
    page,
  }) => {
    await openExercise(page, '02-implement', '01-largest-shape');
    await ex(page, 'theory');
    await expectFocus(page, 'theory');
    await runFromPalette(page, ':focus down', ':focus down');
    await expectFocus(page, 'theory', 'no pane lies below the theory');
    await runFromPalette(page, ':focus right', ':focus right');
    await expectFocus(page, 'editor', 'the editor lies to its right');
  });

  test('a notice shows under :layout theory, where the practice side is hidden', async ({
    page,
  }) => {
    await openExercise(page, '01-fix', '01-handle-the-new-shape');
    await escToEditor(page);
    await ex(page, 'layout theory');
    await expect(layoutRoot(page)).toHaveAttribute('data-layout', 'theory');
    await expectFocus(page, 'theory');
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expect(lessonNotice(page)).toHaveText('this is the first lesson');
    await expect(lessonNotice(page)).toBeVisible();
  });
});
