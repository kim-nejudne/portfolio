// §12 F3: "Multi-file: tabs, `:b`, `:ls`, `gt`, `gT`; a lesson `.d.ts` is read-only and
// marked." The /repl welcome buffers (F5) are the two tabs here; the selected tab
// (`aria-selected`) follows `:b`, `gt` and `gT` (which wrap), `:ls` prints Vim's list, and each
// file keeps its own cursor and its own undo history across switches (§2: one EditorState per
// file). A lesson-supplied `.d.ts` has no host on /repl since F5 (scratch buffers are all
// editable): the read-only tab, its badge and the refused edits are proven on the lesson page
// at F8 with a real lesson `.d.ts`. Keyboard only.
import { expect, test } from '@playwright/test';
import {
  currentPath,
  cursor,
  ex,
  fileTabs,
  gotoRepl,
  press,
  snapshot,
  vimPanel,
} from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await gotoRepl(page);
});

test('two tabs, index.ts selected first, neither read-only', async ({
  page,
}) => {
  const tabs = fileTabs(page);
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveAttribute('data-path', '/index.ts');
  await expect(tabs.nth(1)).toHaveAttribute('data-path', '/shapes.ts');
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
  await expect(tabs.nth(0)).not.toHaveAttribute('data-readonly', 'true');
  await expect(tabs.nth(1)).not.toHaveAttribute('data-readonly', 'true');
  await expect(page.locator('.cm-editor')).not.toHaveAttribute(
    'data-readonly',
    'true',
  );
  expect(await currentPath(page)).toBe('/index.ts');
});

test('aria-selected follows :b', async ({ page }) => {
  // Scoped to the Files tab list: the output pane (F4) has its own tabs.
  const selected = page
    .getByRole('tablist', { name: 'Files' })
    .getByRole('tab', { selected: true });
  await ex(page, 'b shapes');
  await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
  await expect(selected).toHaveAttribute('data-path', '/shapes.ts');
  await expect(selected).toHaveCount(1);
  await ex(page, 'b /index.ts');
  await expect.poll(() => currentPath(page)).toBe('/index.ts');
  await expect(selected).toHaveAttribute('data-path', '/index.ts');
  await ex(page, 'b shapes.ts');
  await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
  await expect(selected).toHaveAttribute('data-path', '/shapes.ts');
  await expect(page.locator('.cm-content')).toBeFocused();
});

test('gt and gT cycle the tabs and wrap', async ({ page }) => {
  // Scoped to the Files tab list: the output pane (F4) has its own tabs.
  const selected = page
    .getByRole('tablist', { name: 'Files' })
    .getByRole('tab', { selected: true });
  await press(page, 'gt');
  await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
  await expect(selected).toHaveAttribute('data-path', '/shapes.ts');
  await press(page, 'gt');
  await expect.poll(() => currentPath(page), 'gt wraps').toBe('/index.ts');
  await expect(selected).toHaveAttribute('data-path', '/index.ts');
  await press(page, 'gT');
  await expect.poll(() => currentPath(page), 'gT wraps').toBe('/shapes.ts');
  await expect(selected).toHaveAttribute('data-path', '/shapes.ts');
  await press(page, 'gT');
  await expect.poll(() => currentPath(page)).toBe('/index.ts');
  await expect(page.locator('.cm-content')).toBeFocused();
});

test(':ls lists the files, the current one with %a', async ({ page }) => {
  await ex(page, 'ls');
  await expect(vimPanel(page)).toHaveText(
    [' 1 %a "index.ts"', ' 2    "shapes.ts"'].join('\n'),
  );
  await press(page, 'gt');
  await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
  await ex(page, 'ls');
  await expect(vimPanel(page)).toHaveText(
    [' 1    "index.ts"', ' 2 %a "shapes.ts"'].join('\n'),
  );
});

test('each file keeps its own cursor across switches', async ({ page }) => {
  await press(page, '4G2l');
  expect(await cursor(page)).toEqual([4, 2]);
  await ex(page, 'b shapes');
  await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
  await press(page, '6G4l');
  expect(await cursor(page)).toEqual([6, 4]);
  await ex(page, 'b index');
  await expect.poll(() => currentPath(page)).toBe('/index.ts');
  expect(await cursor(page)).toEqual([4, 2]);
  await ex(page, 'b shapes');
  await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
  expect(await cursor(page)).toEqual([6, 4]);
});

test('each file keeps its own undo history', async ({ page }) => {
  const index = (await snapshot(page)).doc;
  await press(page, 'dd');
  const edited = (await snapshot(page)).doc;
  expect(edited).toBe(index.split('\n').slice(1).join('\n'));
  await ex(page, 'b shapes');
  await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
  const shapes = (await snapshot(page)).doc;
  await press(page, 'u');
  expect((await snapshot(page)).doc, 'nothing to undo in shapes.ts').toBe(
    shapes,
  );
  await press(page, 'x');
  expect((await snapshot(page)).doc).toBe(shapes.slice(1));
  await ex(page, 'b index');
  await expect.poll(() => currentPath(page)).toBe('/index.ts');
  expect((await snapshot(page)).doc, 'the index.ts edit survived').toBe(edited);
  await press(page, 'u');
  expect((await snapshot(page)).doc, 'u undoes the index.ts edit only').toBe(
    index,
  );
  await ex(page, 'b shapes');
  await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
  expect((await snapshot(page)).doc).toBe(shapes.slice(1));
  await press(page, 'u');
  expect((await snapshot(page)).doc).toBe(shapes);
});
