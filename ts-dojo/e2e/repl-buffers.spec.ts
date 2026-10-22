// §12 F5, the standalone REPL (§4 "What REPL means here": "The standalone page at `/repl` has
// named scratch buffers"; §7 `buffers`: `name`, `text`, `updatedAt`):
//   1. "`/repl` opens the last buffer; `:e name` creates or switches; `:ls` lists; `:bd` deletes
//      after confirmation."
//   2. "A buffer survives a reload, autosaved within 1 s of the last keystroke."
//   3. "Open in REPL from a theory block creates a buffer with the snippet and focuses the
//      editor in normal mode."
// Every browser context starts with an empty IndexedDB, so the first `/repl` of a test seeds
// the welcome pair (`index.ts`, `shapes.ts`). The stored side is read straight from IndexedDB
// (`readBuffer`, `bufferNames`, `readMeta`), never through the app. Keyboard only; the seams
// are read, not driven, except `openInRepl`, which stands in for F6's theory-block button.
import { expect, test, type Page } from '@playwright/test';
import {
  bufferNames,
  consoleEntries,
  currentPath,
  ex,
  fileTabs,
  focusEditor,
  gotoRepl,
  lines,
  openInRepl,
  press,
  problems,
  readBuffer,
  readMeta,
  runStatus,
  setDoc,
  snapshot,
  type,
  vimPanel,
  waitForCompilerReady,
  waitForEditor,
} from './helpers/editor';

const WELCOME_FIRST_LINE = "import { area, type Shape } from './shapes';";
const WELCOME_LAST_LINE = 'console.log(size.toFixed(2), unit);';

/** The selected tab of the Files tab list (the output pane has its own tabs). */
function selectedTab(page: Page) {
  return page
    .getByRole('tablist', { name: 'Files' })
    .getByRole('tab', { selected: true });
}

/** The tab for `path`, located by its own attribute. */
function tabFor(page: Page, path: string) {
  return page
    .getByRole('tablist', { name: 'Files' })
    .locator(`[role="tab"][data-path="${path}"]`);
}

/** The `:bd` prompt in the Vim panel and the input that takes the one key. */
function confirmPrompt(page: Page, name: string) {
  const prompt = vimPanel(page).getByRole('alertdialog');
  const input = prompt.getByLabel(`Delete buffer "${name}"?`, { exact: true });
  return { prompt, input };
}

/** The editor is the focused element and Vim is in normal mode. */
async function expectEditorNormal(page: Page, message?: string) {
  await expect(page.locator('.cm-content'), message).toBeFocused();
  expect((await snapshot(page)).mode, message).toBe('normal');
}

test.describe('§12 F5: /repl opens the last buffer', () => {
  test('the first visit seeds index.ts and shapes.ts, opens index.ts and records it as the last buffer', async ({
    page,
  }) => {
    // A fresh context has no buffers (IndexedDB is only reachable once a page of the origin
    // is open, so the seeding is proven by the exact pair the load leaves behind).
    await gotoRepl(page);
    await expect(fileTabs(page)).toHaveCount(2);
    await expect(fileTabs(page).nth(0)).toHaveAttribute(
      'data-path',
      '/index.ts',
    );
    await expect(fileTabs(page).nth(1)).toHaveAttribute(
      'data-path',
      '/shapes.ts',
    );
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/index.ts');
    expect(await currentPath(page)).toBe('/index.ts');
    const doc = (await snapshot(page)).doc;
    expect(doc.split('\n')[0]).toBe(WELCOME_FIRST_LINE);
    expect(doc.trimEnd().split('\n').at(-1)).toBe(WELCOME_LAST_LINE);
    expect(await bufferNames(page)).toEqual(['index.ts', 'shapes.ts']);
    expect((await readBuffer(page, 'index.ts'))?.text).toBe(doc);
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('index.ts');
  });

  test('after :e notes a reload opens notes.ts, its tab selected among the tabs in name order', async ({
    page,
  }) => {
    await gotoRepl(page);
    await ex(page, 'e notes');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/notes.ts');
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('notes.ts');

    await page.reload();
    await focusEditor(page);
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/notes.ts');
    expect(await currentPath(page)).toBe('/notes.ts');
    expect((await snapshot(page)).doc).toBe('');
    await expect(fileTabs(page)).toHaveCount(3);
    await expect(fileTabs(page).nth(0)).toHaveAttribute(
      'data-path',
      '/index.ts',
    );
    await expect(fileTabs(page).nth(1)).toHaveAttribute(
      'data-path',
      '/notes.ts',
    );
    await expect(fileTabs(page).nth(2)).toHaveAttribute(
      'data-path',
      '/shapes.ts',
    );
    expect(await bufferNames(page)).toEqual([
      'index.ts',
      'notes.ts',
      'shapes.ts',
    ]);
  });

  test('a switch with gt is remembered too: the reload opens shapes.ts', async ({
    page,
  }) => {
    await gotoRepl(page);
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('index.ts');
    await press(page, 'gt');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('shapes.ts');

    await page.reload();
    await focusEditor(page);
    expect(await currentPath(page)).toBe('/shapes.ts');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/shapes.ts');
    expect((await snapshot(page)).doc).toContain('export type Shape =');
  });
});

test.describe('§12 F5: :e name creates or switches', () => {
  test.beforeEach(async ({ page }) => {
    await gotoRepl(page);
  });

  test(':e notes creates an empty notes.ts, opens it with [New] and stores its row', async ({
    page,
  }) => {
    expect(await bufferNames(page)).toEqual(['index.ts', 'shapes.ts']);
    await ex(page, 'e notes');
    await expect(vimPanel(page)).toHaveText('"notes.ts" [New]');
    await expect(fileTabs(page)).toHaveCount(3);
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/notes.ts');
    expect(await currentPath(page)).toBe('/notes.ts');
    expect((await snapshot(page)).doc).toBe('');
    await expectEditorNormal(page);
    await expect
      .poll(() => bufferNames(page))
      .toEqual(['index.ts', 'notes.ts', 'shapes.ts']);
    const row = await readBuffer(page, 'notes.ts');
    expect(row?.text).toBe('');
    expect(typeof row?.updatedAt).toBe('number');
  });

  test(':e on an existing buffer switches to it without creating or overwriting anything', async ({
    page,
  }) => {
    const index = (await snapshot(page)).doc;
    await ex(page, 'e notes');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/notes.ts');
    await expect.poll(() => bufferNames(page)).toHaveLength(3);

    // By name without the extension...
    await ex(page, 'e index');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/index.ts');
    expect(await currentPath(page)).toBe('/index.ts');
    expect((await snapshot(page)).doc, ':e index keeps the text').toBe(index);
    await expect(fileTabs(page)).toHaveCount(3);
    expect(
      (await readBuffer(page, 'index.ts'))?.text,
      'the row is intact',
    ).toBe(index);

    // ...and with it: `notes.ts` is the buffer `:e notes` made, not a second one.
    await ex(page, 'e notes.ts');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/notes.ts');
    expect(await currentPath(page)).toBe('/notes.ts');
    await expect(fileTabs(page)).toHaveCount(3);
    expect(await bufferNames(page)).toEqual([
      'index.ts',
      'notes.ts',
      'shapes.ts',
    ]);
    await expectEditorNormal(page);
  });

  test(':e refuses a path, a dot file and no name, and changes nothing', async ({
    page,
  }) => {
    for (const bad of ['a/b', '.hidden']) {
      await ex(page, `e ${bad}`);
      await expect(vimPanel(page)).toContainText(':e needs a file name');
      expect(await currentPath(page), `after :e ${bad}`).toBe('/index.ts');
      await expect(fileTabs(page)).toHaveCount(2);
    }
    await ex(page, 'e');
    await expect(vimPanel(page)).toContainText(/:e needs a (file|buffer) name/);
    expect(await currentPath(page)).toBe('/index.ts');
    await expect(fileTabs(page)).toHaveCount(2);
    expect(await bufferNames(page)).toEqual(['index.ts', 'shapes.ts']);
    await expectEditorNormal(page);
  });
});

test.describe('§12 F5: :ls lists', () => {
  test(':ls prints every scratch buffer with %a on the current one, including one :e just made', async ({
    page,
  }) => {
    await gotoRepl(page);
    await ex(page, 'ls');
    await expect(vimPanel(page)).toHaveText(
      [' 1 %a "index.ts"', ' 2    "shapes.ts"'].join('\n'),
    );
    await ex(page, 'e notes');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/notes.ts');
    await ex(page, 'ls');
    await expect(vimPanel(page)).toHaveText(
      [' 1    "index.ts"', ' 2 %a "notes.ts"', ' 3    "shapes.ts"'].join('\n'),
    );
    await ex(page, 'b shapes');
    await expect.poll(() => currentPath(page)).toBe('/shapes.ts');
    await ex(page, 'ls');
    await expect(vimPanel(page)).toHaveText(
      [' 1    "index.ts"', ' 2    "notes.ts"', ' 3 %a "shapes.ts"'].join('\n'),
    );
    await expectEditorNormal(page);
  });
});

test.describe('§12 F5: :bd deletes after confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoRepl(page);
    await ex(page, 'e notes');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/notes.ts');
    await expect
      .poll(() => bufferNames(page))
      .toEqual(['index.ts', 'notes.ts', 'shapes.ts']);
  });

  test(':bd asks "Delete buffer?" in the Vim panel; y removes the tab and the row and opens the neighbour', async ({
    page,
  }) => {
    const { prompt, input } = confirmPrompt(page, 'notes.ts');
    await ex(page, 'bd');
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveText('Delete buffer "notes.ts"? (y/n)');
    await expect(input).toBeFocused();
    // Nothing is gone before the answer.
    await expect(tabFor(page, '/notes.ts')).toHaveCount(1);
    expect(await bufferNames(page)).toContain('notes.ts');

    await page.keyboard.press('y');
    await expect(prompt).toBeHidden();
    await expect(tabFor(page, '/notes.ts')).toHaveCount(0);
    await expect(fileTabs(page)).toHaveCount(2);
    await expect(vimPanel(page)).toHaveText('"notes.ts" deleted');
    await expect.poll(() => readBuffer(page, 'notes.ts')).toBeNull();
    expect(await bufferNames(page)).toEqual(['index.ts', 'shapes.ts']);
    // The neighbour (the next tab, wrapping) is current and the editor has focus again.
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/index.ts');
    expect(await currentPath(page)).toBe('/index.ts');
    expect((await snapshot(page)).doc.split('\n')[0]).toBe(WELCOME_FIRST_LINE);
    await expectEditorNormal(page);
  });

  test('n keeps the buffer, and so does Escape', async ({ page }) => {
    const { prompt, input } = confirmPrompt(page, 'notes.ts');
    for (const key of ['n', 'Escape']) {
      await ex(page, 'bd');
      await expect(prompt).toBeVisible();
      await expect(input).toBeFocused();
      await page.keyboard.press(key);
      await expect(prompt, `after ${key}`).toBeHidden();
      await expect(tabFor(page, '/notes.ts'), `after ${key}`).toHaveCount(1);
      await expect(selectedTab(page), `after ${key}`).toHaveAttribute(
        'data-path',
        '/notes.ts',
      );
      expect(await currentPath(page), `after ${key}`).toBe('/notes.ts');
      expect(await bufferNames(page), `after ${key}`).toEqual([
        'index.ts',
        'notes.ts',
        'shapes.ts',
      ]);
      await expectEditorNormal(page, `after ${key}`);
    }
    await expect(vimPanel(page)).not.toContainText('deleted');
  });

  test('the deletion survives a reload', async ({ page }) => {
    const { prompt, input } = confirmPrompt(page, 'notes.ts');
    await ex(page, 'bd');
    await expect(input).toBeFocused();
    await page.keyboard.press('y');
    await expect(prompt).toBeHidden();
    await expect.poll(() => readBuffer(page, 'notes.ts')).toBeNull();
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('index.ts');

    await page.reload();
    await focusEditor(page);
    await expect(fileTabs(page)).toHaveCount(2);
    await expect(tabFor(page, '/notes.ts')).toHaveCount(0);
    expect(await currentPath(page)).toBe('/index.ts');
    expect(await bufferNames(page)).toEqual(['index.ts', 'shapes.ts']);
  });

  test('the last buffer cannot be deleted', async ({ page }) => {
    const { prompt, input } = confirmPrompt(page, 'notes.ts');
    // notes.ts, then index.ts: shapes.ts is left alone.
    await ex(page, 'bd');
    await expect(input).toBeFocused();
    await page.keyboard.press('y');
    await expect(prompt).toBeHidden();
    await expect(fileTabs(page)).toHaveCount(2);
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/index.ts');
    const second = confirmPrompt(page, 'index.ts');
    await ex(page, 'bd');
    await expect(second.prompt).toHaveText('Delete buffer "index.ts"? (y/n)');
    await expect(second.input).toBeFocused();
    await page.keyboard.press('y');
    await expect(second.prompt).toBeHidden();
    await expect(fileTabs(page)).toHaveCount(1);
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/shapes.ts');
    await expect.poll(() => bufferNames(page)).toEqual(['shapes.ts']);

    await ex(page, 'bd');
    await expect(vimPanel(page)).toHaveText('cannot delete the last buffer');
    await expect(vimPanel(page).getByRole('alertdialog')).toHaveCount(0);
    await expect(fileTabs(page)).toHaveCount(1);
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/shapes.ts');
    expect(await currentPath(page)).toBe('/shapes.ts');
    expect(await bufferNames(page)).toEqual(['shapes.ts']);
    expect((await readBuffer(page, 'shapes.ts'))?.text).toContain(
      'export type Shape =',
    );
    await expectEditorNormal(page);
  });
});

test.describe('§12 F5: a buffer survives a reload, autosaved within 1 s of the last keystroke', () => {
  test('text typed in insert mode is in the buffers row within 1 s and is back after a reload', async ({
    page,
  }) => {
    await gotoRepl(page);
    const original = (await snapshot(page)).doc;
    expect((await readBuffer(page, 'index.ts'))?.text).toBe(original);

    await press(page, 'i');
    expect((await snapshot(page)).mode).toBe('insert');
    await type(page, '// hi');
    await press(page, '<Esc>');
    const edited = (await snapshot(page)).doc;
    expect(edited).toBe(`// hi${original}`);
    expect((await snapshot(page)).mode).toBe('normal');
    // §7: autosaved 500 ms after the last keystroke; §12 F5 allows 1 s, counted from <Esc>.
    await expect
      .poll(() => readBuffer(page, 'index.ts').then((row) => row?.text), {
        timeout: 1_000,
        intervals: [50, 100],
      })
      .toBe(edited);
    const row = await readBuffer(page, 'index.ts');
    expect(row?.name).toBe('index.ts');
    expect(typeof row?.updatedAt).toBe('number');
    // The other buffer was not touched.
    expect((await readBuffer(page, 'shapes.ts'))?.text).toContain(
      'export type Shape =',
    );

    await page.reload();
    await focusEditor(page);
    expect(await currentPath(page)).toBe('/index.ts');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/index.ts');
    expect((await snapshot(page)).doc, 'the edit survived the reload').toBe(
      edited,
    );
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('a multi-line edit in a buffer :e made is autosaved within 1 s and survives a reload too', async ({
    page,
  }) => {
    await gotoRepl(page);
    await ex(page, 'e notes');
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/notes.ts');
    await expect
      .poll(() => readBuffer(page, 'notes.ts').then((r) => r?.text))
      .toBe('');
    const text = lines('const n = 1;', 'console.log(n);');
    await press(page, 'i');
    await type(page, text);
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe(text);
    await expect
      .poll(() => readBuffer(page, 'notes.ts').then((row) => row?.text), {
        timeout: 1_000,
        intervals: [50, 100],
      })
      .toBe(text);

    await page.reload();
    await focusEditor(page);
    expect(await currentPath(page)).toBe('/notes.ts');
    expect((await snapshot(page)).doc).toBe(text);
    expect((await readBuffer(page, 'index.ts'))?.text.split('\n')[0]).toBe(
      WELCOME_FIRST_LINE,
    );
  });
});

test.describe('§12 F5: Open in REPL creates a buffer with the snippet and focuses the editor in normal mode', () => {
  const SNIPPET = lines(
    'const n: number = 1;',
    'console.log(n.toFixed(2));',
    '',
  );
  const SECOND = lines('const s = "two";', 'console.log(s);', '');

  test('from / (no editor mounted): /repl opens scratch.ts with the snippet, the editor focused in normal mode', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
    await expect(page.locator('body')).toBeFocused();
    expect(await bufferNames(page)).toEqual([]);

    const name = await openInRepl(page, { snippet: SNIPPET });
    expect(name).toBe('scratch.ts');
    await expect(page).toHaveURL(/\/repl$/);
    await waitForEditor(page);
    // Focus is the app's doing: the test never calls `focusEditor` here.
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/scratch.ts');
    expect(await currentPath(page)).toBe('/scratch.ts');
    const s = await snapshot(page);
    expect(s.doc).toBe(SNIPPET);
    expect(s.mode).toBe('normal');
    await expect(vimPanel(page)).toHaveText('--NORMAL--');
    expect((await readBuffer(page, 'scratch.ts'))?.text).toBe(SNIPPET);
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('scratch.ts');

    // A Vim key lands in the editor straight away: the focus is real.
    await press(page, 'j');
    expect((await snapshot(page)).line).toBe(2);
  });

  test('a second call from /repl makes scratch-2.ts, the new last buffer', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
    expect(await openInRepl(page, { snippet: SNIPPET })).toBe('scratch.ts');
    await expect(page).toHaveURL(/\/repl$/);
    await waitForEditor(page);
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/scratch.ts');

    expect(await openInRepl(page, { snippet: SECOND })).toBe('scratch-2.ts');
    await expect
      .poll(() => bufferNames(page))
      .toEqual(['scratch-2.ts', 'scratch.ts']);
    expect((await readBuffer(page, 'scratch-2.ts'))?.text).toBe(SECOND);
    expect(
      (await readBuffer(page, 'scratch.ts'))?.text,
      'the first is intact',
    ).toBe(SNIPPET);
    await expect.poll(() => readMeta(page, 'lastBuffer')).toBe('scratch-2.ts');
    await expect(page).toHaveURL(/\/repl$/);

    // The page re-reads its buffers on the new navigation (no reload): the new buffer is open,
    // with its snippet, focused in normal mode.
    await expect
      .poll(() => currentPath(page), 'the new buffer opens in place')
      .toBe('/scratch-2.ts');
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(selectedTab(page)).toHaveAttribute(
      'data-path',
      '/scratch-2.ts',
    );
    expect(await currentPath(page)).toBe('/scratch-2.ts');
    const s = await snapshot(page);
    expect(s.doc).toBe(SECOND);
    expect(s.mode).toBe('normal');
    await expect(fileTabs(page)).toHaveCount(2);
    await expect(fileTabs(page).nth(0)).toHaveAttribute(
      'data-path',
      '/scratch-2.ts',
    );
    await expect(fileTabs(page).nth(1)).toHaveAttribute(
      'data-path',
      '/scratch.ts',
    );
  });

  test('a lesson name becomes <name>.ts, then <name>-2.ts', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
    expect(
      await openInRepl(page, { snippet: SNIPPET, name: '03-narrowing' }),
    ).toBe('03-narrowing.ts');
    await expect(page).toHaveURL(/\/repl$/);
    await waitForEditor(page);
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(selectedTab(page)).toHaveAttribute(
      'data-path',
      '/03-narrowing.ts',
    );
    expect((await snapshot(page)).doc).toBe(SNIPPET);
    expect((await snapshot(page)).mode).toBe('normal');
    expect(
      await openInRepl(page, { snippet: SECOND, name: '03-narrowing' }),
    ).toBe('03-narrowing-2.ts');
    await expect
      .poll(() => bufferNames(page))
      .toEqual(['03-narrowing-2.ts', '03-narrowing.ts']);
    expect((await readBuffer(page, '03-narrowing-2.ts'))?.text).toBe(SECOND);
  });
});

// Kim's decision on 22 October 2026 (Spec questions, "/repl buffers are one project"): every
// buffer is its own module, so two snippets opened from theory that declare the same name don't
// clash, while imports between buffers keep working (the welcome pair) and a script still runs.
test.describe('/repl buffers are separate modules', () => {
  const FIRST = lines('const total = 1;', 'console.log(total);', '');
  const SECOND = lines('const total = 2;', 'console.log(total * 10);', '');

  test('two script snippets declaring the same const report nothing, and each still runs', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
    expect(await openInRepl(page, { snippet: FIRST, name: 'first' })).toBe(
      'first.ts',
    );
    await waitForEditor(page);
    expect(await openInRepl(page, { snippet: SECOND, name: 'second' })).toBe(
      'second.ts',
    );
    await waitForEditor(page);
    await waitForCompilerReady(page);
    await expect(selectedTab(page)).toHaveAttribute('data-path', '/second.ts');
    // The welcome pair compiles too: index.ts still imports from shapes.ts.
    await expect(problems(page)).toHaveCount(0);
    await focusEditor(page);
    await ex(page, 'w');
    await expect(runStatus(page)).toContainText('done in');
    await expect(consoleEntries(page)).toHaveText([/^20/]);
  });

  test('a real error in one buffer is still reported', async ({ page }) => {
    await gotoRepl(page);
    await waitForCompilerReady(page);
    await setDoc(page, lines("const total: number = 'one';", ''));
    await expect(
      problems(page).filter({
        hasText: "Type 'string' is not assignable to type 'number'.",
      }),
    ).toHaveCount(1);
  });
});
