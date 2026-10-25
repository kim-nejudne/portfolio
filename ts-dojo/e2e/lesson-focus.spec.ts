// §12 F8, the lesson page's panes and the §6 conflict rule, from the keyboard in Chrome:
//   1. "Theory and practice side by side; `Ctrl-h/j/k/l`, `1`/`2`/`3` and `Esc` move focus as
//      §4 and §6 say."
//   2. "With the editor focused in normal mode, `g r`, `g n`, `] e` and `?` do nothing
//      app-level (Playwright)."
// §4 Focus and panes: exactly one of theory, editor and output has focus; `Ctrl-h/j/k/l` move
// by position (theory left; editor above output on the right), from normal mode through the
// vimrc's `:focus` mappings and from the other panes through the app; in insert mode they keep
// their Vim meaning; `Esc` in a non-editor pane returns to the editor. §6: `1 2 3` name a pane;
// a `predict` exercise's question is the practice side's target; the split defaults to 40/60.
// Criterion 2 also covers the rest of the §6 keys a lesson page binds (`g p`, `[ e`, `1 2 3`,
// `Enter`), proves each key reached Vim where Vim gives it a meaning, and runs the same keys
// from the theory pane as the control: there they act. The last describe checks the §6 theory
// reading keys (`j k gg G Ctrl-d Ctrl-u`), including that a `gg` the pane handled leaves no `g`
// pending for the global `g n`. The focused pane is asserted after every key (e2e/helpers/
// lesson.ts `focused`). Keyboard only, except that the editor is first focused through the
// seam (e2e/helpers/editor.ts); no fixed sleeps.
import { expect, test, type Page } from '@playwright/test';
import {
  cursor,
  press,
  snapshot,
  type,
  vimPanel,
  waitForCompilerReady,
} from './helpers/editor';
import {
  chip,
  currentChip,
  escToEditor,
  expectExercise,
  expectFocus,
  focused,
  layoutRoot,
  lessonNotice,
  openExercise,
  practicePane,
  predictQuestion,
  readExerciseYaml,
  separator,
  theoryPane,
  widthShare,
  type FocusTarget,
} from './helpers/lesson';
import { exerciseRoute, readExerciseFile } from './helpers/verify';

const FIX = { lesson: '01-fix', exercise: '01-handle-the-new-shape' } as const;
const PREDICT = { lesson: '01-fix', exercise: '02-what-is-left' } as const;

/** Presses one key and asserts where the focus went. */
async function step(
  page: Page,
  key: string,
  to: FocusTarget,
  from?: FocusTarget,
): Promise<void> {
  if (from !== undefined) await expectFocus(page, from, `before ${key}`);
  await page.keyboard.press(key);
  await expectFocus(
    page,
    to,
    `${key}${from === undefined ? '' : ` from ${from}`} → ${to}`,
  );
}

test.describe('§12 F8: Theory and practice side by side; `Ctrl-h/j/k/l`, `1`/`2`/`3` and `Esc` move focus as §4 and §6 say.', () => {
  test('theory on the left, practice on the right, 40/60 of the row', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    await expect(layoutRoot(page)).toHaveAttribute('data-layout', 'split');
    const row = await layoutRoot(page).boundingBox();
    const theory = await theoryPane(page).boundingBox();
    const practice = await practicePane(page).boundingBox();
    expect(row).not.toBeNull();
    expect(theory).not.toBeNull();
    expect(practice).not.toBeNull();
    if (row === null || theory === null || practice === null) return;
    // Side by side: same row, theory entirely left of practice.
    expect(theory.x + theory.width).toBeLessThanOrEqual(practice.x);
    expect(Math.abs(theory.y - practice.y)).toBeLessThan(2);
    expect(Math.abs(theory.height - practice.height)).toBeLessThan(2);
    // §6 "The split defaults to 40/60": the separator takes the few pixels in between.
    expect(theory.width / row.width).toBeCloseTo(0.4, 2);
    expect(practice.width / row.width).toBeGreaterThan(0.58);
    expect(practice.width / row.width).toBeLessThanOrEqual(0.6);
    await expect(separator(page)).toHaveAttribute('aria-valuenow', '40');
    // Both panes are filled: the theory article and the editor with the exercise's starter.
    await expect(theoryPane(page).locator('article.theory')).toBeVisible();
    expect((await snapshot(page)).doc).toBe(
      readExerciseFile(FIX.lesson, FIX.exercise, 'starter/index.ts'),
    );
  });

  test('Ctrl-h/j/k/l move between theory, editor and output: from the editor in normal mode and from the other panes', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    await expect(vimPanel(page)).toHaveText('--NORMAL--');
    // From the editor (normal mode, the vimrc's `:focus` mappings).
    await step(page, 'Control+h', 'theory', 'editor');
    await step(page, 'Control+l', 'editor', 'theory');
    await step(page, 'Control+j', 'output', 'editor');
    await step(page, 'Control+k', 'editor', 'output');
    await step(page, 'Control+j', 'output', 'editor');
    await step(page, 'Control+h', 'theory', 'output');
    // No pane lies that way: the focus stays.
    await step(page, 'Control+h', 'theory', 'theory');
    await step(page, 'Control+j', 'theory', 'theory');
    await step(page, 'Control+k', 'theory', 'theory');
    await step(page, 'Control+l', 'editor', 'theory');
    await step(page, 'Control+l', 'editor', 'editor');
    await step(page, 'Control+k', 'editor', 'editor');
    await step(page, 'Control+j', 'output', 'editor');
    await step(page, 'Control+j', 'output', 'output');
    await step(page, 'Control+l', 'output', 'output');
    await step(page, 'Control+k', 'editor', 'output');
    // §4: normal and visual mode.
    await press(page, 'v');
    expect((await snapshot(page)).mode).toBe('visual');
    await step(page, 'Control+h', 'theory', 'editor');
    await step(page, 'Control+l', 'editor', 'theory');
    await press(page, 'V');
    expect((await snapshot(page)).mode).toBe('visual-line');
    await step(page, 'Control+j', 'output', 'editor');
    await step(page, 'Control+k', 'editor', 'output');
    // The editor came back in normal mode with the starter untouched: no key was typed into it.
    const s = await snapshot(page);
    expect(s.mode).toBe('normal');
    expect(s.doc).toBe(
      readExerciseFile(FIX.lesson, FIX.exercise, 'starter/index.ts'),
    );
    await expect(page).toHaveURL(exerciseRoute(FIX.lesson, FIX.exercise));
  });

  test('in insert mode Ctrl-h keeps its Vim meaning (backspace) and Ctrl-l moves no focus', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    const firstLine =
      readExerciseFile(FIX.lesson, FIX.exercise, 'starter/index.ts').split(
        '\n',
      )[0] ?? '';
    await press(page, 'A');
    await type(page, 'xy');
    expect((await snapshot(page)).mode).toBe('insert');
    await step(page, 'Control+h', 'editor', 'editor');
    let s = await snapshot(page);
    expect(s.doc.split('\n')[0]).toBe(`${firstLine}x`);
    expect(s.mode).toBe('insert');
    await step(page, 'Control+l', 'editor', 'editor');
    s = await snapshot(page);
    expect(s.mode).toBe('insert');
    await press(page, '<Esc>');
    // Back in normal mode, the mapping works again.
    await step(page, 'Control+h', 'theory', 'editor');
  });

  test('1, 2 and 3 name theory, editor and output from the theory and output panes', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    await step(page, 'Control+h', 'theory', 'editor');
    await step(page, '1', 'theory', 'theory');
    await step(page, '3', 'output', 'theory');
    await step(page, '3', 'output', 'output');
    await step(page, '1', 'theory', 'output');
    await step(page, '2', 'editor', 'theory');
    await step(page, 'Control+j', 'output', 'editor');
    await step(page, '2', 'editor', 'output');
    // `1`, `2` and `3` typed in the editor are Vim counts, not pane keys (criterion 2 has more).
    expect((await snapshot(page)).mode).toBe('normal');
    await expect(page).toHaveURL(exerciseRoute(FIX.lesson, FIX.exercise));
  });

  test('Esc from the theory pane, from the output pane and from the page body focuses the editor', async ({
    page,
  }) => {
    await page.goto(exerciseRoute(FIX.lesson, FIX.exercise));
    await expectExercise(page, FIX.lesson, FIX.exercise);
    // Nothing focused yet: Esc is the way in.
    await expectFocus(page, 'body');
    await escToEditor(page);
    await step(page, 'Control+h', 'theory', 'editor');
    await step(page, 'Escape', 'editor', 'theory');
    await step(page, 'Control+j', 'output', 'editor');
    await step(page, 'Escape', 'editor', 'output');
    // `Esc` in the editor is Vim's: the focus stays and the mode is normal.
    await step(page, 'Escape', 'editor', 'editor');
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('on a predict exercise the question block is the practice side: 2, Esc and Ctrl-l focus it, Ctrl-h leaves it, 3 has no output pane', async ({
    page,
  }) => {
    await page.goto(exerciseRoute(PREDICT.lesson, PREDICT.exercise));
    await expectExercise(page, PREDICT.lesson, PREDICT.exercise);
    await expect(practicePane(page).locator('.cm-editor')).toHaveCount(0);
    await expect(
      practicePane(page).locator('[data-pane="output"]'),
    ).toHaveCount(0);
    await expectFocus(page, 'body');
    await step(page, '2', 'question', 'body');
    await step(page, 'Control+h', 'theory', 'question');
    await step(page, 'Control+l', 'question', 'theory');
    await step(page, '1', 'theory', 'question');
    await step(page, 'Escape', 'question', 'theory');
    await step(page, 'Control+j', 'question', 'question');
    await step(page, '3', 'question', 'question');
    await expect(lessonNotice(page)).toHaveText(
      'a predict exercise has no output pane',
    );
    await step(page, 'Control+h', 'theory', 'question');
    await step(page, '3', 'theory', 'theory');
    // None of these answered the question.
    await expect(predictQuestion(page)).toHaveAttribute(
      'data-answered',
      'false',
    );
  });

  test('the separator moves 5 at a time with l/h and the arrows when focused, and the theory pane follows', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    await step(page, 'Control+h', 'theory', 'editor');
    // Reach the separator with Tab: it follows the theory pane's last control (the done button).
    for (let i = 0; i < 40 && (await focused(page)) !== 'separator'; i += 1) {
      await page.keyboard.press('Tab');
    }
    await expectFocus(page, 'separator');
    const handle = separator(page);
    await expect(handle).toHaveAttribute('aria-valuenow', '40');
    expect(await widthShare(page, theoryPane(page))).toBeCloseTo(0.4, 2);
    await page.keyboard.press('l');
    await expect(handle).toHaveAttribute('aria-valuenow', '45');
    await expect
      .poll(() => widthShare(page, theoryPane(page)))
      .toBeCloseTo(0.45, 2);
    await page.keyboard.press('h');
    await expect(handle).toHaveAttribute('aria-valuenow', '40');
    await expect
      .poll(() => widthShare(page, theoryPane(page)))
      .toBeCloseTo(0.4, 2);
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '45');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '35');
    await expect
      .poll(() => widthShare(page, theoryPane(page)))
      .toBeCloseTo(0.35, 2);
    // The separator keeps the focus; the keys did not leak to the global map.
    await expectFocus(page, 'separator');
    await expect(page).toHaveURL(exerciseRoute(FIX.lesson, FIX.exercise));
  });
});

test.describe('§12 F8: With the editor focused in normal mode, `g r`, `g n`, `] e` and `?` do nothing app-level (Playwright).', () => {
  /** Nothing app-level changed: same route, same exercise, no dialog, editor focused in normal mode. */
  async function expectUnchanged(page: Page, after: string): Promise<void> {
    await expect(page, `${after}: the route`).toHaveURL(
      exerciseRoute(FIX.lesson, FIX.exercise),
    );
    await expect(currentChip(page), `${after}: the exercise`).toHaveAttribute(
      'data-exercise',
      FIX.exercise,
    );
    await expect(page.getByRole('dialog'), `${after}: no dialog`).toHaveCount(
      0,
    );
    await expect(lessonNotice(page), `${after}: no notice`).toHaveText('');
    await expectFocus(page, 'editor', `${after}: the editor keeps the focus`);
  }

  test('g r, g n, ] e and ? reach Vim: the route, the exercise, the dialogs and the focus stay', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    const starter = readExerciseFile(
      FIX.lesson,
      FIX.exercise,
      'starter/index.ts',
    );
    const rows = starter.split('\n');
    const firstKind = rows.findIndex((line) => line.includes('kind'));
    const lastKind = rows.findLastIndex((line) => line.includes('kind'));
    expect(firstKind).toBeGreaterThanOrEqual(0);
    expect(lastKind).toBeGreaterThan(firstKind);

    // g r: no Vim command; the key state is cleared and the next motion works.
    await press(page, 'gr');
    await expectUnchanged(page, 'g r');
    await press(page, '<Esc>j');
    expect(await cursor(page)).toEqual([2, 0]);
    expect((await snapshot(page)).mode).toBe('normal');

    // g n: Vim's "select the next match" once a search pattern exists.
    await press(page, 'gg');
    await press(page, '/');
    await expect(vimPanel(page).locator('input')).toBeFocused();
    await type(page, 'kind');
    await press(page, '<CR>');
    await expectFocus(page, 'editor');
    await press(page, 'gg');
    await press(page, 'gn');
    await expectUnchanged(page, 'g n');
    let s = await snapshot(page);
    expect(s.mode, 'g n selected the match in visual mode').toBe('visual');
    const col = (rows[firstKind] ?? '').indexOf('kind');
    expect([s.anchorLine, s.anchorCol]).toEqual([firstKind + 1, col]);
    // CodeMirror's selection head sits after the last selected character.
    expect([s.line, s.col]).toEqual([firstKind + 1, col + 'kind'.length]);
    await press(page, '<Esc>');

    // ] e: Vim's `]` waits for a symbol; `e` is none, so nothing moves.
    await press(page, 'gg');
    await press(page, ']e');
    await expectUnchanged(page, '] e');
    expect(await cursor(page)).toEqual([1, 0]);
    await press(page, '<Esc>j');
    expect(await cursor(page)).toEqual([2, 0]);

    // ?: Vim's backward search, not the help overlay.
    await press(page, 'gg');
    await press(page, '?');
    await expect(vimPanel(page).locator('input')).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await type(page, 'kind');
    await press(page, '<CR>');
    await expectUnchanged(page, '?');
    s = await snapshot(page);
    expect(
      [s.line, s.col],
      '? searched backwards, wrapping to the last match',
    ).toEqual([lastKind + 1, (rows[lastKind] ?? '').lastIndexOf('kind')]);
    expect(s.mode).toBe('normal');
    expect(s.doc).toBe(starter);
  });

  test('g p, [ e, 1, 2, 3 and Enter are Vim keys in the editor too', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    const starter = readExerciseFile(
      FIX.lesson,
      FIX.exercise,
      'starter/index.ts',
    );
    // g p (Vim's put before the cursor, after an empty unnamed register: nothing) and [ e.
    await press(page, 'gp');
    await expectUnchanged(page, 'g p');
    await press(page, '<Esc>[e');
    await expectUnchanged(page, '[ e');
    await press(page, '<Esc>');
    expect(await cursor(page)).toEqual([1, 0]);
    // 1 2 3 are counts: `2j` moves two lines, `3j` three, `1G` back to the top.
    await press(page, '2j');
    await expectUnchanged(page, '2');
    expect(await cursor(page)).toEqual([3, 0]);
    await press(page, '3j');
    await expectUnchanged(page, '3');
    expect(await cursor(page)).toEqual([6, 0]);
    await press(page, '1G');
    await expectUnchanged(page, '1');
    expect(await cursor(page)).toEqual([1, 0]);
    // Enter: Vim's "first non-blank of the next line".
    await press(page, '<CR>');
    await expectUnchanged(page, 'Enter');
    const second = starter.split('\n')[1] ?? '';
    expect(await cursor(page)).toEqual([
      2,
      second.length - second.trimStart().length,
    ]);
    expect((await snapshot(page)).doc).toBe(starter);
  });

  test('control: the same keys from the theory pane do act (] e next exercise, g n next lesson, ? help, g r roadmap)', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    await step(page, 'Control+h', 'theory', 'editor');
    await press(page, ']e');
    await expectExercise(page, PREDICT.lesson, PREDICT.exercise);
    await expectFocus(
      page,
      'theory',
      'the theory pane keeps the focus within the lesson',
    );
    await press(page, '[e');
    await expectExercise(page, FIX.lesson, FIX.exercise);
    await expectFocus(page, 'theory');
    await press(page, 'gn');
    // The next lesson, on its first unfinished exercise (§6).
    const next = readExerciseYaml('02-implement', '01-largest-shape');
    await expectExercise(page, '02-implement', '01-largest-shape');
    await expect(chip(page, '01-largest-shape')).toContainText(next.title);
    // A new lesson page: the focus starts on the body; 1 gives the theory pane.
    await step(page, '1', 'theory');
    await press(page, '?');
    const help = page.getByRole('dialog', { name: 'Keyboard help' });
    await expect(help).toBeVisible();
    // Keys inside a dialog stay with it: 2 moves no pane focus behind it.
    await page.keyboard.press('2');
    await expect(help).toBeVisible();
    await expectFocus(page, 'dialog');
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    await expectFocus(
      page,
      'theory',
      'closing the help returns to the theory pane',
    );
    await press(page, 'gr');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
    // g p from the theory pane goes back a lesson: covered in e2e/lesson-nav.spec.ts.
  });

  test('§6 conflict rule on the lesson page: Ctrl-p opens the palette from normal mode and is completion in insert mode', async ({
    page,
  }) => {
    await openExercise(page, FIX.lesson, FIX.exercise);
    // Completions come from the compiler.
    await waitForCompilerReady(page);
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await press(page, '<C-p>');
    await expect(palette).toBeVisible();
    await expect(palette.locator('[cmdk-input]')).toBeFocused();
    await press(page, '<Esc>');
    await expect(palette).toBeHidden();
    await expectFocus(
      page,
      'editor',
      'Esc closes the palette and returns to the editor',
    );
    // Insert mode: Ctrl-p never opens the palette.
    await press(page, 'Go');
    await type(page, 'sha');
    await press(page, '<C-p>');
    await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible();
    await expect(palette).toHaveCount(0);
    await expectFocus(page, 'editor');
    expect((await snapshot(page)).mode).toBe('insert');
    await press(page, '<Esc>');
    await expect(page).toHaveURL(exerciseRoute(FIX.lesson, FIX.exercise));
  });
});

// §6 Lesson page, "Theory keys when focused: `j k gg G Ctrl-d Ctrl-u` scroll", and the §6
// global table that also starts sequences with `g`: a reading key the pane handles must not
// complete a global sequence.
test.describe('§6 theory keys: j k gg G Ctrl-d Ctrl-u scroll the focused theory pane', () => {
  async function scrollTop(page: Page): Promise<number> {
    return theoryPane(page).evaluate((pane) => pane.scrollTop);
  }

  test('j/k move 40 px, G and gg go to the ends, Ctrl-d/Ctrl-u half a page; the focus and the route stay', async ({
    page,
  }) => {
    await page.goto(exerciseRoute(FIX.lesson, FIX.exercise));
    await expectExercise(page, FIX.lesson, FIX.exercise);
    await step(page, '1', 'theory');
    const box = await theoryPane(page).evaluate((pane) => ({
      max: pane.scrollHeight - pane.clientHeight,
      half: Math.round(pane.clientHeight / 2),
    }));
    expect(box.max).toBeGreaterThan(box.half + 80);
    expect(await scrollTop(page)).toBe(0);
    await page.keyboard.press('j');
    await expect.poll(() => scrollTop(page)).toBe(40);
    await page.keyboard.press('j');
    await expect.poll(() => scrollTop(page)).toBe(80);
    await page.keyboard.press('k');
    await expect.poll(() => scrollTop(page)).toBe(40);
    await page.keyboard.press('G');
    await expect.poll(() => scrollTop(page)).toBe(box.max);
    await press(page, 'gg');
    await expect.poll(() => scrollTop(page)).toBe(0);
    await page.keyboard.press('Control+d');
    await expect.poll(() => scrollTop(page)).toBe(box.half);
    await page.keyboard.press('Control+u');
    await expect.poll(() => scrollTop(page)).toBe(0);
    await expectFocus(page, 'theory');
    await expect(page).toHaveURL(exerciseRoute(FIX.lesson, FIX.exercise));
  });

  test('gg then n: the pane scrolls to the top and n completes no `g n` (the route stays)', async ({
    page,
  }) => {
    await page.goto(exerciseRoute(FIX.lesson, FIX.exercise));
    await expectExercise(page, FIX.lesson, FIX.exercise);
    await step(page, '1', 'theory');
    await page.keyboard.press('G');
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
    await press(page, 'gg');
    await expect.poll(() => scrollTop(page)).toBe(0);
    await page.keyboard.press('n');
    // `n` is no theory key; a `g n` would have opened the next lesson at once.
    await page.keyboard.press('j');
    await expect(page).toHaveURL(exerciseRoute(FIX.lesson, FIX.exercise));
    await expectFocus(page, 'theory');
    await expect.poll(() => scrollTop(page)).toBe(40);
  });
});
