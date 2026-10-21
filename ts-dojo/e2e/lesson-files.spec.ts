// The lesson page's file tabs (spec §4 Multi-file exercises: "Lesson-supplied `.d.ts` files are
// read-only and marked"; §3 `types/*.d.ts` "added to the project read-only"), which §12 F3
// criterion 8 names and which /repl lost at F5 (e2e/editor-files.spec.ts): the fixture
// `02-implement/02-literal-discriminant` ships `types/geometry.d.ts`. It is a tab after the
// exercise's files, carries `data-readonly` and a visible "read-only" badge, `:ls` marks it
// `[RO]`, every Vim edit on it is refused with a notice, and its type is in the project (the
// solution uses it and passes `:test`). Also §6 theory keys: `Enter` on a focused code block
// runs Open in REPL. Keyboard only; the seam focuses the editor at the start. No fixed sleeps.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  currentPath,
  ex,
  fileTabs,
  press,
  setDoc,
  snapshot,
  type,
  vimPanel,
} from './helpers/editor';
import { codeBlocks, firstFence, readLessonMdx } from './helpers/content';
import { openExercise } from './helpers/lesson';
import {
  gotoExercise,
  readExerciseFile,
  runTest,
  verdict,
} from './helpers/verify';

const LESSON = '02-implement';
const EXERCISE = '02-literal-discriminant';
const DTS_PATH = '/types/geometry.d.ts';
const DTS = readFileSync(
  fileURLToPath(
    new URL(
      `../fixtures/content/modules/m99-fixtures/${LESSON}/exercises/${EXERCISE}/types/geometry.d.ts`,
      import.meta.url,
    ),
  ),
  'utf8',
);

test.describe('§12 F3 (on the lesson page): a lesson .d.ts is read-only and marked', () => {
  test('the .d.ts is the third tab, marked read-only; :ls says [RO]', async ({
    page,
  }) => {
    await openExercise(page, LESSON, EXERCISE);
    const tabs = fileTabs(page);
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveAttribute('data-path', '/index.ts');
    await expect(tabs.nth(1)).toHaveAttribute('data-path', '/tests.ts');
    await expect(tabs.nth(2)).toHaveAttribute('data-path', DTS_PATH);
    await expect(tabs.nth(2)).toHaveAttribute('data-readonly', 'true');
    await expect(tabs.nth(0)).not.toHaveAttribute('data-readonly', 'true');
    await expect(
      tabs.nth(2).getByText('read-only', { exact: true }),
    ).toBeVisible();
    await ex(page, 'ls');
    await expect(vimPanel(page)).toContainText('"geometry.d.ts" [RO]');
    await expect(vimPanel(page)).toContainText('%a "index.ts"');
  });

  test('every edit on the .d.ts is refused with a notice; gt reaches it and leaves it', async ({
    page,
  }) => {
    await openExercise(page, LESSON, EXERCISE);
    await ex(page, 'b geometry.d.ts');
    await expect.poll(() => currentPath(page)).toBe(DTS_PATH);
    await expect(vimPanel(page)).toHaveText('types/geometry.d.ts is read-only');
    expect((await snapshot(page)).doc).toBe(DTS);
    for (const keys of ['x', 'dd', 'p']) {
      await press(page, keys);
      expect((await snapshot(page)).doc, keys).toBe(DTS);
    }
    await press(page, 'i');
    await type(page, 'abc');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe(DTS);
    await press(page, 'gt');
    await expect.poll(() => currentPath(page), 'gt wraps').toBe('/index.ts');
  });

  test('its type is part of the project: the solution uses SquareUnits and passes :test', async ({
    page,
  }) => {
    // gotoExercise waits for the compiler and records the Tests tab for runTest.
    await gotoExercise(page, LESSON, EXERCISE);
    const solution = readExerciseFile(LESSON, EXERCISE, 'solution/index.ts');
    expect(solution).toContain('SquareUnits');
    await setDoc(page, solution);
    await runTest(page);
    await expect(verdict(page)).toHaveAttribute('data-verdict', 'passed');
  });
});

test.describe('§6 theory keys: Enter on a focused code block runs Open in REPL', () => {
  test('a focused ts run block opens its snippet in the REPL with Enter', async ({
    page,
  }) => {
    await openExercise(page, '01-fix', '01-handle-the-new-shape');
    const fence = firstFence(readLessonMdx('01-fix'), 'run');
    const block = codeBlocks(page, 'run').first();
    await block.focus();
    await expect(block).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/repl$/);
    // The lesson page's editor may still be the one the seam names for a moment; wait for the
    // /repl editor on its new buffer (as e2e/content.spec.ts waits for its focus).
    await page.waitForFunction(
      () => window.__tsDojo?.editor.currentPath === '/01-fix.ts',
    );
    await expect(page.locator('.cm-content')).toBeFocused();
    expect((await snapshot(page)).doc).toBe(fence);
  });
});
