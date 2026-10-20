// §12 F8, the practice side of the lesson page (spec §1 Hints, solutions, reset, attempts and
// Exercise kinds, §4 `:hint` `:sol` `:reset`, §6 Lesson page, §7 `exercises` and `attempts`),
// from the keyboard in Chrome:
//   4. "`:hint` reveals hints in order and records the count; `:sol` opens the solution
//      read-only and records it; `:reset` restores the starter after confirmation."
//   6. "Files are autosaved per exercise and restored on return, including after a reload
//      mid-edit."
//   7. "A `predict` exercise answers with `j`/`k`/`Enter`, shows the explanation and records
//      the answer."
// Hints, solutions, starters, options, answers and explanations are read from the repository
// at test time. "Records" is checked in the §7 rows read straight from IndexedDB (e2e/helpers/
// lesson.ts) and again after a reload. The autosave (§7: 500 ms after the last keystroke) is
// waited for by polling the stored row, never by a sleep; "a reload mid-edit" reloads while
// Vim is still in insert mode. Keyboard only; the seam focuses the editor at the start and
// reads files that are not shown. No fixed sleeps.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import {
  ex,
  focusEditor,
  press,
  runStatus,
  snapshot,
  type,
  vimPanel,
} from './helpers/editor';
import { FIXTURE_MODULE, type FixtureLesson } from './helpers/content';
import {
  answer,
  chip,
  escToEditor,
  expectExercise,
  expectFocus,
  explanation,
  headerField,
  highlighted,
  hintItems,
  lessonNotice,
  openExercise,
  options,
  predictQuestion,
  readAttempts,
  readExerciseRow,
  readExerciseYaml,
  result,
  solutionPane,
  squash,
} from './helpers/lesson';
import {
  exerciseRoute,
  gotoExercise,
  openBuffer,
  readExerciseFile,
} from './helpers/verify';

const IMPLEMENT = {
  lesson: '02-implement',
  exercise: '01-largest-shape',
} as const;
const NEXT = {
  lesson: '02-implement',
  exercise: '02-literal-discriminant',
} as const;
const PREDICT = { lesson: '01-fix', exercise: '02-what-is-left' } as const;

function solutionFiles(lesson: FixtureLesson, exercise: string): string[] {
  const dir = fileURLToPath(
    new URL(
      `../content/modules/${FIXTURE_MODULE}/${lesson}/exercises/${exercise}/solution/`,
      import.meta.url,
    ),
  );
  return readdirSync(dir).sort();
}

async function doc(page: Page): Promise<string> {
  return (await snapshot(page)).doc;
}

/** A file's text in the mounted editor (shown or not), through the seam. */
async function fileText(page: Page, path: string): Promise<string> {
  return page.evaluate(
    (path) => window.__tsDojo?.editor.text(path) ?? '',
    path,
  );
}

/** Waits until the §7 row holds `text` for `path` (the 500 ms autosave). */
async function expectSaved(
  page: Page,
  lesson: FixtureLesson,
  exercise: string,
  path: string,
  text: string,
): Promise<void> {
  await expect
    .poll(
      async () => (await readExerciseRow(page, lesson, exercise))?.files[path],
      { message: `${path} autosaved` },
    )
    .toBe(text);
}

test.describe('§12 F8: `:hint` reveals hints in order and records the count; `:sol` opens the solution read-only and records it; `:reset` restores the starter after confirmation.', () => {
  test('`:hint` shows the next hint in order, counts it in the header and the store, keeps the count over a reload, and stops at the last', async ({
    page,
  }) => {
    const { hints = [] } = readExerciseYaml(
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
    );
    expect(hints).toHaveLength(3);
    await openExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await expect(headerField(page, 'hints')).toHaveText('hints 0/3');
    await expect(hintItems(page)).toHaveCount(0);

    for (const n of [1, 2]) {
      await ex(page, 'hint');
      await expect(hintItems(page)).toHaveCount(n);
      await expect(lessonNotice(page)).toHaveText(`hint ${n} of 3`);
      await expect(headerField(page, 'hints')).toHaveText(`hints ${n}/3`);
      await expect
        .poll(
          async () =>
            (await readExerciseRow(page, IMPLEMENT.lesson, IMPLEMENT.exercise))
              ?.hintsUsed,
        )
        .toBe(n);
    }
    // In order: hint 1, then hint 2, with the YAML's texts.
    for (const [i, text] of hints.slice(0, 2).entries()) {
      await expect(hintItems(page).nth(i)).toHaveAttribute(
        'data-hint',
        String(i + 1),
      );
      await expect(hintItems(page).nth(i)).toHaveText(`Hint ${i + 1}. ${text}`);
    }
    expect(
      (await readExerciseRow(page, IMPLEMENT.lesson, IMPLEMENT.exercise))
        ?.state,
    ).toBe('in-progress');

    // The count survives a reload.
    await page.reload();
    await expectExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await expect(hintItems(page)).toHaveCount(2);
    await expect(headerField(page, 'hints')).toHaveText('hints 2/3');
    await expect(hintItems(page).nth(1)).toHaveText(
      `Hint 2. ${hints[1] ?? ''}`,
    );
    await focusEditor(page);

    await ex(page, 'hint');
    await expect(hintItems(page)).toHaveCount(3);
    await expect(hintItems(page).nth(2)).toHaveText(
      `Hint 3. ${hints[2] ?? ''}`,
    );
    await expect(lessonNotice(page)).toHaveText('hint 3 of 3');
    // Past the last: the count stays at the total and the notice says so.
    await ex(page, 'hint');
    await expect(lessonNotice(page)).toHaveText(
      'no more hints: all 3 are shown',
    );
    await expect(vimPanel(page)).toContainText(
      'no more hints: all 3 are shown',
    );
    await expect(hintItems(page)).toHaveCount(3);
    await expect(headerField(page, 'hints')).toHaveText('hints 3/3');
    expect(
      (await readExerciseRow(page, IMPLEMENT.lesson, IMPLEMENT.exercise))
        ?.hintsUsed,
    ).toBe(3);
  });

  test('`:sol` opens the solution files read-only beside the editor and records it; `:sol` again closes it; `:solution` is the same command', async ({
    page,
  }) => {
    const starter = readExerciseFile(
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      'starter/index.ts',
    );
    const files = solutionFiles(IMPLEMENT.lesson, IMPLEMENT.exercise);
    expect(files.length).toBeGreaterThan(0);
    await openExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await expect(solutionPane(page)).toHaveCount(0);
    await expect(headerField(page, 'solution-viewed')).toHaveCount(0);

    await ex(page, 'sol');
    const pane = solutionPane(page);
    await expect(pane).toBeVisible();
    await expect(lessonNotice(page)).toHaveText(
      'the solution, read-only; :sol closes it',
    );
    // Every solution file, with the repository's text.
    await expect(pane.locator('figure[data-path]')).toHaveCount(files.length);
    for (const file of files) {
      const figure = pane.locator(`figure[data-path="/${file}"]`);
      const text = await figure.locator('pre').textContent();
      expect(text?.trimEnd()).toBe(
        readExerciseFile(
          IMPLEMENT.lesson,
          IMPLEMENT.exercise,
          `solution/${file}`,
        ).trimEnd(),
      );
    }
    // In a split beside the editor.
    const editorBox = await page.locator('.cm-editor').boundingBox();
    const paneBox = await pane.boundingBox();
    expect(editorBox).not.toBeNull();
    expect(paneBox).not.toBeNull();
    if (editorBox !== null && paneBox !== null) {
      expect(editorBox.x + editorBox.width).toBeLessThanOrEqual(paneBox.x + 1);
    }
    // Read-only: nothing in it can be edited or focused, and the working copy is untouched.
    await expect(
      pane.locator(
        '[contenteditable], input, textarea, .cm-editor, [tabindex]',
      ),
    ).toHaveCount(0);
    expect(await doc(page)).toBe(starter);
    await expectFocus(page, 'editor');
    // Typing goes to Kim's own files, never into the solution.
    const before = await pane.locator('pre').first().textContent();
    await press(page, 'ggO');
    await type(page, '// mine');
    await press(page, '<Esc>');
    expect(await doc(page)).toBe(`// mine\n${starter}`);
    await expect(pane.locator('pre').first()).toHaveText(before ?? '');
    // Recorded.
    await expect(headerField(page, 'solution-viewed')).toHaveText(
      'solution viewed',
    );
    await expect
      .poll(
        async () =>
          (await readExerciseRow(page, IMPLEMENT.lesson, IMPLEMENT.exercise))
            ?.solutionViewed,
      )
      .toBe(true);

    // `:sol` again closes it; the record stays.
    await ex(page, 'sol');
    await expect(solutionPane(page)).toHaveCount(0);
    await expect(lessonNotice(page)).toHaveText('solution closed');
    await expect(headerField(page, 'solution-viewed')).toHaveText(
      'solution viewed',
    );
    // `:solution` opens it, `:sol` closes it: one command.
    await ex(page, 'solution');
    await expect(solutionPane(page)).toBeVisible();
    await ex(page, 'sol');
    await expect(solutionPane(page)).toHaveCount(0);
    // Viewing the solution passes nothing.
    expect(
      (await readExerciseRow(page, IMPLEMENT.lesson, IMPLEMENT.exercise))
        ?.state,
    ).not.toBe('passed');
    await page.reload();
    await expectExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await expect(headerField(page, 'solution-viewed')).toHaveText(
      'solution viewed',
    );
    await expect(solutionPane(page)).toHaveCount(0);
  });

  test('`:reset` asks first: `n` keeps the edit, `y` restores the starter in the editor and the store, and the attempts are kept', async ({
    page,
  }) => {
    const starter = readExerciseFile(
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      'starter/index.ts',
    );
    // `:w` needs the compiler (it emits first).
    await gotoExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await press(page, 'ggO');
    await type(page, '// my edit');
    await press(page, '<Esc>');
    const edited = await doc(page);
    expect(edited).toBe(`// my edit\n${starter}`);
    await expectSaved(
      page,
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      '/index.ts',
      edited,
    );
    // One attempt on record.
    await ex(page, 'w');
    await expect(runStatus(page)).toHaveText(/^done in \d+ ms$/);
    await expect
      .poll(
        async () =>
          (await readAttempts(page, IMPLEMENT.lesson, IMPLEMENT.exercise))
            .length,
      )
      .toBe(1);
    const attempts = await readAttempts(
      page,
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
    );

    // `n`: nothing changes.
    await ex(page, 'reset');
    await expect(vimPanel(page)).toContainText(
      'Reset to the starter files? (y/n)',
    );
    await expect(vimPanel(page).locator('input')).toBeFocused();
    await page.keyboard.press('n');
    await expect(lessonNotice(page)).toHaveText('reset cancelled');
    await expectFocus(page, 'editor');
    expect(await doc(page)).toBe(edited);
    expect(
      (await readExerciseRow(page, IMPLEMENT.lesson, IMPLEMENT.exercise))
        ?.files['/index.ts'],
    ).toBe(edited);

    // `y`: the starter, in the editor and in the store; the attempts stay.
    await ex(page, 'reset');
    await expect(vimPanel(page)).toContainText(
      'Reset to the starter files? (y/n)',
    );
    await page.keyboard.press('y');
    await expect(lessonNotice(page)).toHaveText(
      'restored the starter files; the attempts are kept',
    );
    await expect.poll(() => doc(page)).toBe(starter);
    await expectFocus(
      page,
      'editor',
      'the editor has the focus after the reset',
    );
    expect((await snapshot(page)).mode).toBe('normal');
    await expect
      .poll(
        async () =>
          (await readExerciseRow(page, IMPLEMENT.lesson, IMPLEMENT.exercise))
            ?.files,
      )
      .toEqual({});
    expect(
      await readAttempts(page, IMPLEMENT.lesson, IMPLEMENT.exercise),
    ).toEqual(attempts);

    // And it stays reset over a reload.
    await page.reload();
    await expectExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await escToEditor(page);
    expect(await doc(page)).toBe(starter);
  });
});

test.describe('§12 F8: Files are autosaved per exercise and restored on return, including after a reload mid-edit.', () => {
  test('an edit is autosaved for its own exercise and comes back after :next and :prev', async ({
    page,
  }) => {
    const starter = readExerciseFile(
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      'starter/index.ts',
    );
    const nextStarter = readExerciseFile(
      NEXT.lesson,
      NEXT.exercise,
      'starter/index.ts',
    );
    await openExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await press(page, 'ggO');
    await type(page, '// kept for 01');
    await press(page, '<Esc>');
    const edited = await doc(page);
    expect(edited).toBe(`// kept for 01\n${starter}`);
    await expectSaved(
      page,
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      '/index.ts',
      edited,
    );

    await ex(page, 'next');
    await expectExercise(page, NEXT.lesson, NEXT.exercise);
    await escToEditor(page);
    expect(await doc(page), 'the next exercise has its own starter').toBe(
      nextStarter,
    );
    expect(await readExerciseRow(page, NEXT.lesson, NEXT.exercise)).toBeNull();

    await ex(page, 'prev');
    await expectExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await escToEditor(page);
    expect(await doc(page)).toBe(edited);
  });

  test('text typed in insert mode is restored after a reload while still in insert mode', async ({
    page,
  }) => {
    const starter = readExerciseFile(
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      'starter/index.ts',
    );
    await openExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await press(page, 'ggO');
    await type(page, '// typed before the reload');
    expect((await snapshot(page)).mode).toBe('insert');
    const edited = await doc(page);
    expect(edited).toBe(`// typed before the reload\n${starter}`);
    await expectSaved(
      page,
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      '/index.ts',
      edited,
    );
    expect((await snapshot(page)).mode, 'still mid-edit').toBe('insert');

    await page.reload();
    await expectExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await escToEditor(page);
    expect(await doc(page)).toBe(edited);
  });

  // The stricter case: a reload inside the 500 ms autosave window. IndexedDB cannot finish a
  // write during the unload, so pagehide journals the waiting text synchronously
  // (src/store/unsaved.ts) and the exercise takes it back on its next mount.
  test('text typed just before a reload, before the autosave fired, is restored too', async ({
    page,
  }) => {
    const starter = readExerciseFile(
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      'starter/index.ts',
    );
    await openExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await press(page, 'ggO');
    await type(page, '// typed right before the reload');
    const edited = await doc(page);
    expect(edited).toBe(`// typed right before the reload\n${starter}`);
    const row = await readExerciseRow(
      page,
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
    );
    expect(
      row?.files['/index.ts'],
      'the autosave has not written it yet: this reload is inside the 500 ms window',
    ).toBeUndefined();

    await page.reload();
    await expectExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await escToEditor(page);
    expect(await doc(page)).toBe(edited);
    // It is in the store now, and the journal is empty again.
    await expectSaved(
      page,
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      '/index.ts',
      edited,
    );
    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem('ts-dojo:unsaved')),
      )
      .toBeNull();
  });

  test('edits in index.ts and tests.ts are both restored after a reload', async ({
    page,
  }) => {
    const index = readExerciseFile(
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      'starter/index.ts',
    );
    const tests = readExerciseFile(
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      'tests.ts',
    );
    await openExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await openBuffer(page, 'tests.ts');
    expect(await doc(page)).toBe(tests);
    await press(page, 'ggO');
    await type(page, '// in tests');
    await press(page, '<Esc>');
    await expectSaved(
      page,
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      '/tests.ts',
      `// in tests\n${tests}`,
    );
    await openBuffer(page, 'index.ts');
    await press(page, 'ggO');
    await type(page, '// in index');
    await press(page, '<Esc>');
    await expectSaved(
      page,
      IMPLEMENT.lesson,
      IMPLEMENT.exercise,
      '/index.ts',
      `// in index\n${index}`,
    );

    await page.reload();
    await expectExercise(page, IMPLEMENT.lesson, IMPLEMENT.exercise);
    await escToEditor(page);
    expect(await doc(page)).toBe(`// in index\n${index}`);
    expect(await fileText(page, '/tests.ts')).toBe(`// in tests\n${tests}`);
    await openBuffer(page, 'tests.ts');
    expect(await doc(page)).toBe(`// in tests\n${tests}`);
  });
});

test.describe('§12 F8: A `predict` exercise answers with `j`/`k`/`Enter`, shows the explanation and records the answer.', () => {
  test('j/k move the highlight, Enter answers: a wrong answer, then the right one; the explanation shows each time; the answer is recorded and shown after a reload', async ({
    page,
  }) => {
    const y = readExerciseYaml(PREDICT.lesson, PREDICT.exercise);
    const opts = y.options ?? [];
    const right = y.answer ?? -1;
    expect(opts.length).toBeGreaterThanOrEqual(3);
    expect(right).toBeGreaterThanOrEqual(0);
    const wrong = right === opts.length - 1 ? 0 : opts.length - 1;

    await page.goto(exerciseRoute(PREDICT.lesson, PREDICT.exercise));
    await expectExercise(page, PREDICT.lesson, PREDICT.exercise);
    const question = predictQuestion(page);
    await expect(question).toHaveAttribute('data-answered', 'false');
    await expect(options(question)).toHaveCount(opts.length);
    for (const [i, text] of opts.entries()) {
      await expect(options(question).nth(i).locator('code')).toHaveText(text);
    }
    await expect(question.locator('pre')).toContainText(
      (y.code ?? '').split('\n')[0] ?? '',
    );
    await expect(explanation(question)).toHaveCount(0);
    await expect(chip(page, PREDICT.exercise)).toHaveAttribute(
      'data-state',
      'untouched',
    );

    // `2` focuses the question; j/k (and the arrows) move the highlight, bounded at both ends.
    await page.keyboard.press('2');
    await expectFocus(page, 'question');
    expect(await highlighted(question)).toBe(0);
    await page.keyboard.press('k');
    await expect.poll(() => highlighted(question)).toBe(0);
    await page.keyboard.press('j');
    await expect.poll(() => highlighted(question)).toBe(1);
    await page.keyboard.press('j');
    await expect.poll(() => highlighted(question)).toBe(2);
    await page.keyboard.press('k');
    await expect.poll(() => highlighted(question)).toBe(1);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => highlighted(question)).toBe(2);
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => highlighted(question)).toBe(1);
    for (let i = 0; i < opts.length; i += 1) await page.keyboard.press('j');
    await expect.poll(() => highlighted(question)).toBe(opts.length - 1);
    // Moving answered nothing.
    await expect(question).toHaveAttribute('data-answered', 'false');
    expect(
      await readExerciseRow(page, PREDICT.lesson, PREDICT.exercise),
    ).toBeNull();

    // A wrong answer: the explanation, marked incorrect; recorded; in progress.
    await answer(page, question, wrong);
    await expect(result(question)).toHaveAttribute('data-result', 'incorrect');
    await expect(explanation(question)).toContainText(
      squash(y.explanation ?? ''),
    );
    await expect(question).toHaveAttribute('data-correct', 'false');
    await expect(chip(page, PREDICT.exercise)).toHaveAttribute(
      'data-state',
      'in-progress',
    );
    await expect
      .poll(() => readExerciseRow(page, PREDICT.lesson, PREDICT.exercise))
      .toMatchObject({ predictAnswer: wrong, state: 'in-progress' });

    // Retry with the right one: correct; passed.
    await answer(page, question, right);
    await expect(result(question)).toHaveAttribute('data-result', 'correct');
    await expect(explanation(question)).toContainText(
      squash(y.explanation ?? ''),
    );
    await expect(options(question).nth(wrong)).not.toHaveAttribute(
      'data-chosen',
      'true',
    );
    await expect(chip(page, PREDICT.exercise)).toHaveAttribute(
      'data-state',
      'passed',
    );
    await expect
      .poll(() => readExerciseRow(page, PREDICT.lesson, PREDICT.exercise))
      .toMatchObject({ predictAnswer: right, state: 'passed' });
    expect(
      typeof (await readExerciseRow(page, PREDICT.lesson, PREDICT.exercise))
        ?.passedAt,
    ).toBe('number');

    // After a reload the recorded answer and the explanation are shown.
    await page.reload();
    await expectExercise(page, PREDICT.lesson, PREDICT.exercise);
    const reloaded = predictQuestion(page);
    await expect(reloaded).toHaveAttribute('data-answered', 'true');
    await expect(options(reloaded).nth(right)).toHaveAttribute(
      'data-chosen',
      'true',
    );
    await expect(reloaded.locator('li[data-chosen="true"]')).toHaveCount(1);
    await expect(result(reloaded)).toHaveAttribute('data-result', 'correct');
    await expect(explanation(reloaded)).toContainText(
      squash(y.explanation ?? ''),
    );
    await expect(chip(page, PREDICT.exercise)).toHaveAttribute(
      'data-state',
      'passed',
    );

    // §1 "It stays passed": a later wrong answer is recorded but passes nothing back.
    await page.keyboard.press('2');
    await expectFocus(page, 'question');
    await answer(page, reloaded, wrong);
    await expect(result(reloaded)).toHaveAttribute('data-result', 'incorrect');
    await expect
      .poll(() => readExerciseRow(page, PREDICT.lesson, PREDICT.exercise))
      .toMatchObject({ predictAnswer: wrong, state: 'passed' });
    await expect(chip(page, PREDICT.exercise)).toHaveAttribute(
      'data-state',
      'passed',
    );
  });
});
