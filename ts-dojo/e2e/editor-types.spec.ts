// §12 F3 (type feedback): "Squiggles and gutter marks appear within 300 ms of typing stopping;
// `]d` and `[d` move between diagnostics; `K` shows quick info at the cursor; `gd` jumps to a
// definition in another file." · "A `//   ^?` line shows the queried type under it and updates
// on edit." · "Completions open on typing and `Ctrl-Space`; `Ctrl-j`/`Ctrl-k` and `Tab`/
// `Shift-Tab` move; `Enter` or `Ctrl-y` accept; `Esc` closes and returns to normal mode." Plus
// signature help on `(` (§4). The 300 ms is measured inside the page: a keyup listener on the
// editor records the last key, a MutationObserver records when the first error squiggle enters
// the DOM. Every test waits for the compiler chip first; the timing test also warms the worker
// with one throwaway diagnostic so the measurement covers the lint delay and a warm reply.
import { expect, test, type Page } from '@playwright/test';
import {
  currentPath,
  cursor,
  gotoRepl,
  press,
  problems,
  setDoc,
  snapshot,
  type,
  vimPanel,
  waitForCompilerReady,
} from './helpers/editor';

const SQUIGGLE_BUDGET_MS = 300;

interface Timing {
  lastKeyup: number;
  appearedAt: number | null;
}

declare global {
  interface Window {
    __dojoTiming?: Timing;
  }
}

/** Starts recording keyups on the editor and the first `.cm-lintRange-error` to enter the DOM. */
async function startTiming(page: Page): Promise<void> {
  await page.evaluate(() => {
    const timing: Timing = { lastKeyup: 0, appearedAt: null };
    window.__dojoTiming = timing;
    const content = document.querySelector('.cm-content');
    const editor = document.querySelector('.cm-editor');
    if (content === null || editor === null) throw new Error('no editor');
    content.addEventListener('keyup', () => {
      timing.lastKeyup = performance.now();
    });
    const observer = new MutationObserver(() => {
      if (
        timing.appearedAt === null &&
        editor.querySelector('.cm-lintRange-error') !== null
      ) {
        timing.appearedAt = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(editor, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
}

async function readTiming(page: Page): Promise<Timing> {
  return page.evaluate(() => {
    const timing = window.__dojoTiming;
    if (timing === undefined) throw new Error('timing not started');
    return { lastKeyup: timing.lastKeyup, appearedAt: timing.appearedAt };
  });
}

test.beforeEach(async ({ page }) => {
  await gotoRepl(page);
  await waitForCompilerReady(page);
  await expect(problems(page), 'the demo project starts clean').toHaveCount(0);
});

test.describe('diagnostics', () => {
  test('squiggles and gutter marks appear within 300 ms of typing stopping, and the Problems list has the entry', async ({
    page,
  }) => {
    const original = (await snapshot(page)).doc;
    // Warm up: one throwaway error, seen and removed again.
    await press(page, 'G');
    await press(page, 'o');
    await type(page, 'const warm: number = true;');
    await press(page, '<Esc>');
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);
    await setDoc(page, original, { line: 8, col: 0 });
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
    await expect(problems(page)).toHaveCount(0);

    await startTiming(page);
    await press(page, 'o');
    await type(page, "const n: number = 'x';");
    await press(page, '<Esc>');
    const squiggle = page.locator('.cm-lintRange-error');
    await expect(squiggle).toHaveCount(1);
    await expect(squiggle).toHaveText('n');
    const timing = await readTiming(page);
    expect(timing.appearedAt).not.toBeNull();
    const elapsed = (timing.appearedAt ?? 0) - timing.lastKeyup;
    expect(
      elapsed,
      `squiggle ${elapsed.toFixed(0)} ms after the last keyup`,
    ).toBeLessThanOrEqual(SQUIGGLE_BUDGET_MS);
    await expect(page.locator('.cm-lint-marker')).toHaveCount(1);
    await expect(problems(page)).toHaveCount(1);
    await expect(problems(page).first()).toHaveText(
      "index.ts:9:7 Type 'string' is not assignable to type 'number'. TS2322",
    );
  });

  test(']d and [d move between two diagnostics and wrap', async ({ page }) => {
    // index.ts ends with a newline: G is the empty line 9, so the two errors go on 10 and 11.
    await press(page, 'G');
    await press(page, 'o');
    await type(page, "const a: number = 'x';");
    await press(page, '<Esc>');
    await press(page, 'o');
    await type(page, 'const b: string = 2;');
    await press(page, '<Esc>');
    await expect(problems(page)).toHaveCount(2);
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(2);
    await press(page, 'gg0');
    expect(await cursor(page)).toEqual([1, 0]);
    // Each key moves the cursor to the diagnostic (its start: `a` and `b` at column 6) and
    // leaves the editor in normal mode: a move, not a visual selection.
    const expectAt = async (at: [number, number], message?: string) => {
      const s = await snapshot(page);
      expect([s.line, s.col], message).toEqual(at);
      expect(s.mode, `${message ?? 'after the move'}: normal mode`).toBe(
        'normal',
      );
    };
    await press(page, ']d');
    await expectAt([10, 6]);
    await press(page, ']d');
    await expectAt([11, 6]);
    await press(page, ']d');
    await expectAt([10, 6], ']d wraps to the first');
    await press(page, '[d');
    await expectAt([11, 6], '[d wraps to the last');
    await press(page, '[d');
    await expectAt([10, 6]);
  });
});

test.describe('quick info and definition', () => {
  test('K shows quick info for the symbol at the cursor', async ({ page }) => {
    await press(page, '4G0fa');
    expect(await cursor(page)).toEqual([4, 13]);
    const info = page.locator('.cm-tooltip.cm-dojo-info');
    await expect(info).toBeHidden();
    await press(page, 'K');
    await expect(info).toBeVisible();
    // At the import site the symbol is the alias: "(alias) area(shape: Shape): number".
    await expect(info.locator('.cm-dojo-info-signature')).toContainText(
      'area(shape: Shape): number',
    );
    await expect(info).toContainText('The area of a shape, in square units.');
    // A cursor move closes it.
    await press(page, 'j');
    await expect(info).toBeHidden();
  });

  test('gd jumps from area in index.ts to its declaration in shapes.ts', async ({
    page,
  }) => {
    await press(page, '4G0fa');
    expect(await cursor(page)).toEqual([4, 13]);
    await press(page, 'gd');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await expect.poll(async () => cursor(page)).toEqual([6, 16]);
    expect((await snapshot(page)).doc.split('\n')[5]).toBe(
      'export function area(shape: Shape): number {',
    );
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(vimPanel(page)).toHaveText('--NORMAL--');
  });
});

test.describe('^? queries', () => {
  test('the widget under line 5 shows the type of size and updates when line 4 changes', async ({
    page,
  }) => {
    const widget = page.locator('[data-testid="twoslash"]');
    await expect(widget).toHaveCount(1);
    await expect(widget).toHaveText('const size: number');
    await expect(widget).not.toHaveClass(/cm-twoslash-error/);
    await press(page, '4G');
    await press(page, 'cc');
    await type(page, "const size = 'x';");
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc.split('\n')[3]).toBe("const size = 'x';");
    await expect(widget).toHaveText('const size: "x"');
  });

  test('a ^? pointing at nothing shows the error text', async ({ page }) => {
    await press(page, '6G');
    expect((await snapshot(page)).doc.split('\n')[5]).toBe('');
    await press(page, 'o');
    await type(page, '//^?');
    await press(page, '<Esc>');
    const widgets = page.locator('[data-testid="twoslash"]');
    await expect(widgets).toHaveCount(2);
    const error = widgets.nth(1);
    await expect(error).toHaveClass(/cm-twoslash-error/);
    await expect(error).toHaveText('Nothing above the ^ to query');
    await expect(widgets.first()).toHaveText('const size: number');
  });
});

test.describe('completions', () => {
  const tooltip = (page: Page) => page.locator('.cm-tooltip-autocomplete');
  const selectedLabel = (page: Page) =>
    tooltip(page).locator('li[aria-selected="true"] .cm-completionLabel');

  /** `o` on the empty last line, then `Ma`: the completion opens on typing. */
  async function openOnTyping(page: Page): Promise<void> {
    await press(page, 'G');
    await press(page, 'o');
    expect((await snapshot(page)).mode).toBe('insert');
    await type(page, 'Ma');
    await expect(tooltip(page)).toBeVisible();
    await expect(selectedLabel(page)).toHaveText(/^Ma/);
  }

  test('open on typing; Esc closes and returns to normal mode', async ({
    page,
  }) => {
    await openOnTyping(page);
    await press(page, '<Esc>');
    await expect(tooltip(page)).toBeHidden();
    await expect(vimPanel(page)).toHaveText('--NORMAL--');
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('open on Ctrl-Space', async ({ page }) => {
    await press(page, 'G');
    await press(page, 'o');
    await type(page, 'Ma');
    await expect(tooltip(page)).toBeVisible();
    await press(page, '<Esc>');
    await expect(tooltip(page)).toBeHidden();
    expect((await snapshot(page)).mode).toBe('normal');
    // Back in insert mode after the word, with nothing open: Ctrl-Space opens it.
    await press(page, 'A');
    expect((await snapshot(page)).mode).toBe('insert');
    await expect(tooltip(page)).toBeHidden();
    await press(page, '<C-Space>');
    await expect(tooltip(page)).toBeVisible();
    await expect(selectedLabel(page)).toHaveText(/^Ma/);
    await press(page, '<Esc>');
  });

  test('Ctrl-j, Ctrl-k, Tab and Shift-Tab move the selection', async ({
    page,
  }) => {
    await openOnTyping(page);
    const first = (await selectedLabel(page).textContent()) ?? '';
    await press(page, '<C-j>');
    await expect(selectedLabel(page)).not.toHaveText(first);
    const second = (await selectedLabel(page).textContent()) ?? '';
    await press(page, '<C-k>');
    await expect(selectedLabel(page)).toHaveText(first);
    await press(page, '<Tab>');
    await expect(selectedLabel(page)).toHaveText(second);
    await press(page, '<Tab>');
    await expect(selectedLabel(page)).not.toHaveText(second);
    await press(page, '<S-Tab>');
    await expect(selectedLabel(page)).toHaveText(second);
    await press(page, '<S-Tab>');
    await expect(selectedLabel(page)).toHaveText(first);
    await press(page, '<Esc>');
  });

  test('Enter accepts the selected item', async ({ page }) => {
    await openOnTyping(page);
    await press(page, '<C-j>');
    const label = (await selectedLabel(page).textContent()) ?? '';
    expect(label).toMatch(/^Ma/);
    await press(page, '<CR>');
    await expect(tooltip(page)).toBeHidden();
    const s = await snapshot(page);
    expect(s.doc.split('\n').at(-1), 'the new last line').toBe(label);
    expect(s.mode).toBe('insert');
    await press(page, '<Esc>');
  });

  test('Ctrl-y accepts the selected item', async ({ page }) => {
    await openOnTyping(page);
    const label = (await selectedLabel(page).textContent()) ?? '';
    expect(label).toMatch(/^Ma/);
    await press(page, '<C-y>');
    await expect(tooltip(page)).toBeHidden();
    const s = await snapshot(page);
    expect(s.doc.split('\n').at(-1), 'the new last line').toBe(label);
    expect(s.mode).toBe('insert');
    await press(page, '<Esc>');
  });
});

test.describe('signature help', () => {
  test('typing ( shows the signature with the active parameter; ) hides it', async ({
    page,
  }) => {
    const help = page.locator('[data-testid="signature-help"]');
    await press(page, 'G');
    await press(page, 'o');
    await type(page, 'area(');
    await expect(help).toBeVisible();
    await expect(help.locator('.cm-dojo-signature-label')).toHaveText(
      'area(shape: Shape): number',
    );
    await expect(help.locator('strong')).toHaveText('shape: Shape');
    await type(page, 'circle)');
    await expect(help).toBeHidden();
    await press(page, '<Esc>');
  });
});
