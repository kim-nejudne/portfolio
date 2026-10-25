// §12 F3: "The shipped vimrc applies; `imap jk <Esc>` works; a bad vimrc line is reported with
// its number and skipped, and the good lines still apply." The first describe drives the
// shipped lines on /repl (src/editor/vimrc.ts SHIPPED_VIMRC): `jk`, `]d` → `:dnext`, `K` →
// `:info`, `gd` → `:def`, `gt` → `:bnext`, `<C-h>` → `:focus left` in normal mode and backspace
// in insert mode. The second stores a custom vimrc in `ts-dojo:settings` before the page loads
// (a replacement for the shipped text, not an overlay): line 3 is bad and must be named in the
// vimrc status line, the lines around it must apply, and a shipped mapping the custom text
// lacks (`gt`) must be gone.
import { expect, test } from '@playwright/test';
import {
  currentPath,
  cursor,
  ex,
  gotoRepl,
  press,
  SETTINGS_KEY,
  snapshot,
  type,
  vimPanel,
  waitForCompilerReady,
} from './helpers/editor';

const INDEX_LINE_4 = 'const size = area(circle);';

test.describe('the shipped vimrc', () => {
  test.beforeEach(async ({ page }) => {
    await gotoRepl(page);
    await expect(
      page.getByRole('status', { name: 'vimrc' }),
      'no vimrc errors for the shipped text',
    ).toBeHidden();
  });

  test('imap jk <Esc>: typing jk in insert mode leaves it with the document unchanged', async ({
    page,
  }) => {
    const before = (await snapshot(page)).doc;
    await press(page, 'i');
    expect((await snapshot(page)).mode).toBe('insert');
    await type(page, 'jk');
    const after = await snapshot(page);
    expect(after.mode).toBe('normal');
    expect(after.doc).toBe(before);
    await expect(vimPanel(page)).toHaveText('--NORMAL--');
  });

  test(']d reaches :dnext (with no diagnostics it says so)', async ({
    page,
  }) => {
    await press(page, ']d');
    await expect(vimPanel(page)).toHaveText('no diagnostics');
    await press(page, '[d');
    await expect(vimPanel(page)).toHaveText('no diagnostics');
  });

  test('K reaches :info: quick info for the symbol at the cursor', async ({
    page,
  }) => {
    await waitForCompilerReady(page);
    await press(page, '4G0fa');
    expect(await cursor(page)).toEqual([4, 13]);
    expect((await snapshot(page)).doc.split('\n')[3]).toBe(INDEX_LINE_4);
    await expect(page.locator('.cm-tooltip.cm-dojo-info')).toBeHidden();
    await press(page, 'K');
    await expect(page.locator('.cm-tooltip.cm-dojo-info')).toContainText(
      'area(shape: Shape): number',
    );
  });

  test('gd reaches :def: from area in index.ts line 4 to its declaration in shapes.ts line 6', async ({
    page,
  }) => {
    await waitForCompilerReady(page);
    await press(page, '4G0fa');
    expect(await cursor(page)).toEqual([4, 13]);
    await press(page, 'gd');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await expect
      .poll(async () => (await snapshot(page)).line, {
        message: 'the cursor lands on the declaration line',
      })
      .toBe(6);
    const s = await snapshot(page);
    expect(s.doc.split('\n')[5]).toBe(
      'export function area(shape: Shape): number {',
    );
    expect(s.col).toBe(16);
    await expect(page.getByRole('tab', { name: 'shapes.ts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('.cm-content')).toBeFocused();
  });

  test('gt reaches :bnext: the next tab', async ({ page }) => {
    expect(await currentPath(page)).toBe('/index.ts');
    await press(page, 'gt');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await expect(page.getByRole('tab', { name: 'shapes.ts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await press(page, 'gT');
    await expect.poll(() => currentPath(page)).toBe('/index.ts');
  });

  test('<C-j> moves panes from visual mode too (§4: "in normal and visual mode")', async ({
    page,
  }) => {
    await press(page, 'vl');
    expect((await snapshot(page)).mode).toBe('visual');
    await press(page, '<C-j>');
    await expect(page.locator('[data-pane="output"]')).toBeFocused();
    await press(page, '<Esc>');
    await expect(page.locator('.cm-content')).toBeFocused();
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('<C-h> is :focus left in normal mode and backspace in insert mode', async ({
    page,
  }) => {
    const before = (await snapshot(page)).doc;
    await press(page, '<C-h>');
    await expect(vimPanel(page)).toHaveText('nothing to the left on /repl');
    expect((await snapshot(page)).doc).toBe(before);
    await expect(page.locator('.cm-content')).toBeFocused();

    await press(page, 'A');
    await type(page, 'xy');
    expect((await snapshot(page)).mode).toBe('insert');
    await press(page, '<C-h>');
    const after = await snapshot(page);
    expect(after.mode).toBe('insert');
    expect(after.doc.split('\n')[0]).toBe(`${before.split('\n')[0]}x`);
    await press(page, '<Esc>');
  });
});

test.describe('a custom vimrc with a bad line', () => {
  const VIMRC = 'imap jk <Esc>\nnmap gd :def<CR>\nfoo bar\nnmap Q :ls<CR>';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([key, vimrc]) => {
        localStorage.setItem(key, JSON.stringify({ vimrc }));
      },
      [SETTINGS_KEY, VIMRC] as const,
    );
    await gotoRepl(page);
  });

  test('line 3 is reported with its number; lines 1, 2 and 4 apply; the shipped gt is gone', async ({
    page,
  }) => {
    const status = page.getByRole('status', { name: 'vimrc' });
    await expect(status).toBeVisible();
    await expect(status).toHaveText('vimrc line 3: unknown command "foo"');

    // Line 1 applies.
    const before = (await snapshot(page)).doc;
    await press(page, 'i');
    await type(page, 'jk');
    expect((await snapshot(page)).mode).toBe('normal');
    expect((await snapshot(page)).doc).toBe(before);

    // Line 4 applies: Q runs :ls.
    await press(page, 'Q');
    await expect(vimPanel(page)).toContainText('"index.ts"');
    await expect(vimPanel(page)).toContainText('"shapes.ts"');

    // The shipped gt is not part of this vimrc: the tab does not change.
    await press(page, 'gt');
    await press(page, '<Esc>');
    await ex(page, 'ls');
    await expect(vimPanel(page)).toContainText('%a "index.ts"');
    expect(await currentPath(page)).toBe('/index.ts');
    await expect(page.getByRole('tab', { name: 'index.ts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('line 2 applies: gd still goes to the definition', async ({ page }) => {
    await waitForCompilerReady(page);
    await press(page, '4G0fa');
    expect(await cursor(page)).toEqual([4, 13]);
    await press(page, 'gd');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await expect.poll(async () => (await snapshot(page)).line).toBe(6);
  });
});
