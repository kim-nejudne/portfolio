// §12 F3: "Every ex command in §4 does what its row says, including `:w` running the code and
// `:set rnu` persisting." Every row whose target exists on /repl is driven from the `:` prompt
// here: the file commands, the diagnostics and type commands, `:set` with persistence across a
// reload, `:help`/`:h`, `:roadmap`/`:rm`, the pane commands, `:w`/`:run`, and the Ctrl-p
// palette (normal mode only). The rows other features own (`:test`, `:kill`, `:hint`, ...)
// must say which feature, in the Vim panel, instead of failing silently. Keyboard only; the
// seam is read, never driven, except where a pane other than the editor has focus.
import { expect, test, type Page } from '@playwright/test';
import {
  currentPath,
  cursor,
  ex,
  focusEditor,
  gotoRepl,
  lines,
  messages,
  press,
  problems,
  readStoredSettings,
  setDoc,
  snapshot,
  type,
  vimPanel,
  waitForCompilerReady,
} from './helpers/editor';

const TWO_ERRORS = lines(
  "const a: number = 'x';",
  'const ok = 1;',
  'const b: string = 2;',
);

/** The cursor is at `at` and the editor is in normal mode (a move, not a visual selection). */
async function expectCursorAt(
  page: Page,
  at: [line: number, col: number],
  message?: string,
): Promise<void> {
  const s = await snapshot(page);
  expect([s.line, s.col], message).toEqual(at);
  expect(s.mode, `${message ?? 'after the move'}: still in normal mode`).toBe(
    'normal',
  );
}

test.beforeEach(async ({ page }) => {
  await gotoRepl(page);
});

test.describe(':b, :ls, :bnext, :bprev', () => {
  test(':b <file> switches the tab by basename, full name or unique prefix', async ({
    page,
  }) => {
    await ex(page, 'b shapes');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await expect(page.getByRole('tab', { name: 'shapes.ts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await ex(page, 'b units.d.ts');
    await expect.poll(() => currentPath(page)).toBe('/units.d.ts');
    await expect(
      page.getByRole('tab', { name: 'units.d.ts read-only' }),
    ).toHaveAttribute('aria-selected', 'true');
    await ex(page, 'b index');
    await expect.poll(() => currentPath(page)).toBe('/index.ts');
    await expect(page.locator('.cm-content')).toBeFocused();
  });

  test(':b nope says there is no such file', async ({ page }) => {
    await ex(page, 'b nope');
    await expect(vimPanel(page)).toHaveText('no file named nope');
    expect(await currentPath(page)).toBe('/index.ts');
  });

  test(':ls lists the three files with %a on the current one and [RO] on the .d.ts', async ({
    page,
  }) => {
    await ex(page, 'ls');
    await expect(vimPanel(page)).toHaveText(
      [' 1 %a "index.ts"', ' 2    "shapes.ts"', ' 3    "units.d.ts" [RO]'].join(
        '\n',
      ),
    );
    await ex(page, 'b shapes');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await ex(page, 'ls');
    await expect(vimPanel(page)).toContainText('%a "shapes.ts"');
    await expect(vimPanel(page)).toContainText('    "index.ts"');
  });

  test(':bnext and :bprev cycle and wrap', async ({ page }) => {
    await ex(page, 'bnext');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await ex(page, 'bnext');
    await expect.poll(() => currentPath(page)).toBe('/units.d.ts');
    await ex(page, 'bnext');
    await expect.poll(() => currentPath(page)).toBe('/index.ts');
    await ex(page, 'bprev');
    await expect.poll(() => currentPath(page)).toBe('/units.d.ts');
    await ex(page, 'bprev');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await ex(page, 'bprev');
    await expect.poll(() => currentPath(page)).toBe('/index.ts');
  });
});

test.describe(':dnext, :dprev, :info, :def', () => {
  test(':dnext and :dprev move between two errors and wrap', async ({
    page,
  }) => {
    await waitForCompilerReady(page);
    await setDoc(page, TWO_ERRORS);
    await expect(problems(page)).toHaveCount(2);
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(2);
    await press(page, 'gg0');
    // The cursor lands on the diagnostic (its start, `a` and `b` at column 6) and the editor
    // stays in normal mode: a move, not a selection.
    await ex(page, 'dnext');
    await expectCursorAt(page, [1, 6]);
    await ex(page, 'dnext');
    await expectCursorAt(page, [3, 6]);
    await ex(page, 'dnext');
    await expectCursorAt(page, [1, 6], ':dnext wraps');
    await ex(page, 'dprev');
    await expectCursorAt(page, [3, 6], ':dprev wraps');
    await ex(page, 'dprev');
    await expectCursorAt(page, [1, 6]);
  });

  test(':info shows quick info at the cursor', async ({ page }) => {
    await waitForCompilerReady(page);
    await press(page, '4G0fa');
    expect(await cursor(page)).toEqual([4, 13]);
    await ex(page, 'info');
    await expect(page.locator('.cm-tooltip.cm-dojo-info')).toContainText(
      'area(shape: Shape): number',
    );
    await expect(page.locator('.cm-tooltip.cm-dojo-info')).toContainText(
      'The area of a shape, in square units.',
    );
  });

  test(':def jumps to the definition in another file', async ({ page }) => {
    await waitForCompilerReady(page);
    await press(page, '4G0fa');
    await ex(page, 'def');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await expect.poll(async () => cursor(page)).toEqual([6, 16]);
  });
});

test.describe(':set', () => {
  test(':set nornu persists across a reload; :set rnu restores', async ({
    page,
  }) => {
    // The shipped vimrc's `set rnu`: relative by default.
    await press(page, '3G');
    await expect
      .poll(async () => (await snapshot(page)).gutter.slice(0, 4))
      .toEqual(['2', '1', '3', '1']);
    await ex(page, 'set nornu');
    await expect
      .poll(async () => (await snapshot(page)).gutter.slice(0, 4))
      .toEqual(['1', '2', '3', '4']);
    expect(await readStoredSettings(page)).toMatchObject({
      relativeNumbers: false,
    });

    await page.reload();
    await focusEditor(page);
    await press(page, '3G');
    expect(await cursor(page)).toEqual([3, 0]);
    expect(
      (await snapshot(page)).gutter.slice(0, 4),
      'absolute after the reload',
    ).toEqual(['1', '2', '3', '4']);

    await ex(page, 'set rnu');
    await expect
      .poll(async () => (await snapshot(page)).gutter.slice(0, 4))
      .toEqual(['2', '1', '3', '1']);
    expect(await readStoredSettings(page)).toMatchObject({
      relativeNumbers: true,
    });
  });

  test(':set nonu hides the gutter and :set nu shows it; both persist', async ({
    page,
  }) => {
    await ex(page, 'set nonu');
    await expect.poll(async () => (await snapshot(page)).gutter).toEqual([]);
    expect(await readStoredSettings(page)).toMatchObject({
      lineNumbers: false,
    });
    await ex(page, 'set nu');
    await expect
      .poll(async () => (await snapshot(page)).gutter.length)
      .toBeGreaterThan(0);
    expect(await readStoredSettings(page)).toMatchObject({
      lineNumbers: true,
    });
  });

  test(':set wrap and :set nowrap toggle line wrapping; both persist', async ({
    page,
  }) => {
    expect((await snapshot(page)).wrapping).toBe(false);
    await ex(page, 'set wrap');
    await expect.poll(async () => (await snapshot(page)).wrapping).toBe(true);
    expect(await readStoredSettings(page)).toMatchObject({ wrap: true });
    await ex(page, 'set nowrap');
    await expect.poll(async () => (await snapshot(page)).wrapping).toBe(false);
    expect(await readStoredSettings(page)).toMatchObject({ wrap: false });
  });

  test(':set bg=light and bg=dark switch the theme and persist it', async ({
    page,
  }) => {
    const html = page.locator('html');
    await ex(page, 'set bg=dark');
    await expect(html).toHaveClass(/\bdark\b/);
    expect(await readStoredSettings(page)).toMatchObject({ theme: 'dark' });
    await ex(page, 'set bg=light');
    await expect(html).not.toHaveClass(/\bdark\b/);
    expect(await readStoredSettings(page)).toMatchObject({ theme: 'light' });
    await ex(page, 'set bg=dark');
    await expect(html).toHaveClass(/\bdark\b/);
    expect(await readStoredSettings(page)).toMatchObject({ theme: 'dark' });
  });

  test(':set foo reports an unknown option', async ({ page }) => {
    await ex(page, 'set foo');
    await expect(vimPanel(page)).toHaveText('Unknown option: foo');
  });
});

test.describe(':help, :roadmap and the pane commands', () => {
  test(':help and :h open the keyboard help overlay', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Keyboard help' });
    await ex(page, 'help');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#help-ex-commands')).toHaveText('Ex commands');
    await press(page, '<Esc>');
    await expect(dialog).toBeHidden();
    await focusEditor(page);
    await ex(page, 'h');
    await expect(dialog).toBeVisible();
    await press(page, '<Esc>');
    await expect(dialog).toBeHidden();
  });

  test(':roadmap goes to the roadmap', async ({ page }) => {
    await ex(page, 'roadmap');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
  });

  test(':rm goes to the roadmap', async ({ page }) => {
    await ex(page, 'rm');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
  });

  test(':output focuses the output pane and Esc there returns to the editor', async ({
    page,
  }) => {
    const output = page.locator('[data-pane="output"]');
    await ex(page, 'output');
    await expect(output).toBeFocused();
    await press(page, '<Esc>');
    await expect(page.locator('.cm-content')).toBeFocused();
    await ex(page, 'focus down');
    await expect(output).toBeFocused();
    await press(page, '<Esc>');
    await expect(page.locator('.cm-content')).toBeFocused();
  });

  test(':practice and :focus up focus the editor; :theory says there is no theory pane', async ({
    page,
  }) => {
    const output = page.locator('[data-pane="output"]');
    await ex(page, 'practice');
    await expect(page.locator('.cm-content')).toBeFocused();
    await ex(page, 'focus up');
    await expect(page.locator('.cm-content')).toBeFocused();
    // From the output pane the editor is not focused, so the pane is reached with the vimrc's
    // Ctrl-j and the action goes through the seam's dispatch (the same path the `:` line takes).
    await press(page, '<C-j>');
    await expect(output).toBeFocused();
    await page.evaluate(() => {
      window.__tsDojo?.editor.dispatch({ type: 'focusPane', pane: 'editor' });
    });
    await expect(page.locator('.cm-content')).toBeFocused();
    await press(page, '<C-j>');
    await expect(output).toBeFocused();
    await page.evaluate(() => {
      window.__tsDojo?.editor.dispatch({
        type: 'focusDirection',
        direction: 'up',
      });
    });
    await expect(page.locator('.cm-content')).toBeFocused();
    await ex(page, 'theory');
    await expect(vimPanel(page)).toHaveText('no theory pane on /repl');
  });

  test(':focus left and :focus right say there is nothing there on /repl', async ({
    page,
  }) => {
    await ex(page, 'focus left');
    await expect(vimPanel(page)).toHaveText('nothing to the left on /repl');
    await ex(page, 'focus right');
    await expect(vimPanel(page)).toHaveText('nothing to the right on /repl');
    await expect(page.locator('.cm-content')).toBeFocused();
  });
});

test.describe(':w and :run', () => {
  test(':w transpiles the project and hands it to the host', async ({
    page,
  }) => {
    await waitForCompilerReady(page);
    await ex(page, 'w');
    await expect(messages(page)).toHaveCount(1);
    await expect(messages(page).first()).toHaveText(
      'emitted 2 modules (index.ts, shapes.ts); running index.ts is F4',
    );
    await ex(page, 'run');
    await expect(messages(page)).toHaveCount(2);
    await expect(messages(page).nth(1)).toHaveText(
      'emitted 2 modules (index.ts, shapes.ts); running index.ts is F4',
    );
  });
});

test.describe('the rows other features own', () => {
  const NOT_HERE: [command: string, feature: string, label: string][] = [
    ['test', 'F7', ':test'],
    ['t', 'F7', ':test'],
    ['kill', 'F4', ':kill'],
    ['hint', 'F8', ':hint'],
    ['sol', 'F8', ':sol'],
    ['solution', 'F8', ':sol'],
    ['reset', 'F8', ':reset'],
    ['done', 'F8', ':done'],
    ['next', 'F8', ':next'],
    ['prev', 'F8', ':prev'],
    ['lesson next', 'F8', ':lesson'],
    ['lesson prev', 'F8', ':lesson'],
    ['layout split', 'F8', ':layout'],
    ['layout theory', 'F8', ':layout'],
    ['layout practice', 'F8', ':layout'],
    ['prompt', 'F8', ':prompt'],
    ['e x', 'F5', ':e'],
    ['bd', 'F5', ':bd'],
    ['export', 'F9', ':export'],
  ];

  for (const [command, feature, label] of NOT_HERE) {
    test(`:${command} says it belongs to ${feature}`, async ({ page }) => {
      const before = (await snapshot(page)).doc;
      await ex(page, command);
      await expect(vimPanel(page)).toContainText(
        new RegExp(`\\b${feature}\\b`),
      );
      await expect(vimPanel(page)).toContainText(label);
      expect((await snapshot(page)).doc).toBe(before);
      expect(await currentPath(page)).toBe('/index.ts');
    });
  }
});

test.describe('Ctrl-p', () => {
  test('in normal mode Ctrl-p opens the palette and Enter runs :help', async ({
    page,
  }) => {
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    const help = page.getByRole('dialog', { name: 'Keyboard help' });
    await press(page, '<C-p>');
    await expect(palette).toBeVisible();
    await expect(palette.locator('[cmdk-input]')).toBeFocused();
    await type(page, 'help');
    await expect(
      palette.locator('[cmdk-item][aria-selected="true"]'),
    ).toContainText(':help');
    await press(page, '<CR>');
    await expect(palette).toBeHidden();
    await expect(help).toBeVisible();
    await press(page, '<Esc>');
    await expect(help).toBeHidden();
  });

  test('in insert mode Ctrl-p is completion, not the palette', async ({
    page,
  }) => {
    await waitForCompilerReady(page);
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    const tooltip = page.locator('.cm-tooltip-autocomplete');
    const selected = tooltip.locator(
      'li[aria-selected="true"] .cm-completionLabel',
    );
    // With a completion open, Ctrl-p moves the selection up.
    await press(page, 'G');
    await press(page, 'o');
    expect((await snapshot(page)).mode).toBe('insert');
    await type(page, 'Ma');
    await expect(tooltip).toBeVisible();
    await expect(selected).toHaveText('Map');
    await press(page, '<C-j>');
    await expect(selected).toHaveText('Math');
    await press(page, '<C-p>');
    await expect(selected, 'Ctrl-p moves the selection up').toHaveText('Map');
    await expect(palette).toBeHidden();
    expect((await snapshot(page)).mode).toBe('insert');
    await press(page, '<Esc>');
    await expect(tooltip).toBeHidden();
    await expect(vimPanel(page)).toHaveText('--NORMAL--');

    // With nothing open, Ctrl-p starts a completion; the palette never appears.
    await press(page, 'o');
    expect((await snapshot(page)).mode).toBe('insert');
    await press(page, '<C-p>');
    await expect(tooltip).toBeVisible();
    await expect(palette).toBeHidden();
    expect((await snapshot(page)).mode).toBe('insert');
    await press(page, '<Esc>');
    await expect(tooltip).toBeHidden();
    await expect(palette).toBeHidden();
    await expect(vimPanel(page)).toHaveText('--NORMAL--');
  });
});
