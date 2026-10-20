// §12 F4 "Sandbox runner": every criterion driven on /repl in Chrome from the keyboard. `:w`
// emits the project and runs it in a fresh worker; the output pane (section[data-pane=output])
// shows the console entries with their TypeScript line, the status line and the Problems tab,
// and takes its own keys (`j`/`k`, `Enter`, `h`/`l`, `Esc`) once `:output` focuses it. The
// seam is read, never driven; every wait is an `expect` with a timeout; no fixed sleeps.
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  consoleEntries,
  currentPath,
  cursor,
  ex,
  gotoRepl,
  lines,
  outputPane,
  press,
  problems,
  runStatus,
  setDoc,
  snapshot,
  type,
  vimPanel,
  waitForCompilerReady,
} from './helpers/editor';

/** §4: the deadline is 5 s; the status must change within it plus a margin. */
const DEADLINE_MS = 5000;
const AFTER_DEADLINE = DEADLINE_MS + 2000;

const editor = (page: Page): Locator => page.locator('.cm-content');
/** The entry's text without its position (the first span of the `li`). */
const textOf = (entry: Locator): Locator => entry.locator('span').first();
const locOf = (entry: Locator): Locator => entry.locator('[data-loc]');

/** Switch to a file with `:b` and wait for the switch (it happens after the engine is done). */
async function openBuffer(page: Page, name: string, path: string) {
  await ex(page, `b ${name}`);
  await expect.poll(() => currentPath(page)).toBe(path);
  await expect(editor(page)).toBeFocused();
}

/** A run that ended on its own: `done in N ms` (or `N s`) and `data-status="done"`. */
async function expectDone(page: Page) {
  await expect(runStatus(page)).toHaveText(/^done in \d+(\.\d+)? (ms|s)/, {
    timeout: AFTER_DEADLINE,
  });
  await expect(runStatus(page)).toHaveAttribute('data-status', 'done');
}

test.beforeEach(async ({ page }) => {
  await gotoRepl(page);
  await waitForCompilerReady(page);
});

// §12 F4: `console.log` of a string, a nested object, a Map, a class instance and an Error
// renders readably with its source line.
test('console.log of a string, a nested object, a Map, a class instance and an Error renders readably with its source line', async ({
  page,
}) => {
  await setDoc(
    page,
    lines(
      'class Point { x = 1; y = 2 }',
      "console.log('hi');",
      'console.log({ a: { b: { c: { d: 1 } } } });',
      "console.log(new Map([['k', 1]]));",
      'console.log(new Point());',
      "console.log(new Error('boom'));",
    ),
  );
  await expect(consoleEntries(page)).toHaveCount(0);
  await ex(page, 'w');
  await expectDone(page);
  const expected: [text: string, line: number][] = [
    ['hi', 2],
    ['{ a: { b: { c: [Object] } } }', 3],
    ["Map(1) { 'k' => 1 }", 4],
    ['Point { x: 1, y: 2 }', 5],
    ['Error: boom', 6],
  ];
  await expect(consoleEntries(page)).toHaveCount(expected.length);
  for (const [i, [text, line]] of expected.entries()) {
    const entry = consoleEntries(page).nth(i);
    await expect(entry, `entry ${String(i)} is a console line`).toHaveAttribute(
      'data-kind',
      'console',
    );
    await expect(entry).toHaveAttribute('data-level', 'log');
    await expect(textOf(entry), `entry ${String(i)} text`).toHaveText(text);
    await expect(locOf(entry), `entry ${String(i)} source line`).toHaveText(
      `index.ts:${String(line)}`,
    );
  }
  expect((await snapshot(page)).mode, 'still in normal mode after :w').toBe(
    'normal',
  );
});

// §12 F4: `while (true) {}` is terminated at the deadline, the page stays responsive throughout
// (Playwright keeps typing during the run), and the status reads "killed after 5 s".
test('while (true) {} is terminated at the deadline, the page stays responsive throughout, and the status reads "killed after 5 s"', async ({
  page,
}) => {
  // The compiler wait plus a full 5 s run plus the typing does not fit the default 20 s.
  test.setTimeout(40_000);
  await setDoc(page, 'while (true) {}');
  // Record every status the pane shows (to prove it never read "done") and when the first
  // `running` appeared relative to the Enter that submitted `:w`.
  await page.evaluate(() => {
    const status = document.querySelector('[aria-label="run status"]');
    if (!(status instanceof HTMLElement)) throw new Error('no run status');
    const seen: { status: string; at: number }[] = [];
    const record = () => {
      const value = status.dataset['status'] ?? '';
      if (seen.at(-1)?.status !== value)
        seen.push({ status: value, at: performance.now() });
    };
    record();
    new MutationObserver(record).observe(status, {
      attributes: true,
      attributeFilter: ['data-status'],
    });
    const probe = { seen, enterAt: 0 };
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Enter' && probe.enterAt === 0)
          probe.enterAt = performance.now();
      },
      { capture: true },
    );
    (window as unknown as { __runProbe: typeof probe }).__runProbe = probe;
  });

  await ex(page, 'w');
  await expect(runStatus(page)).toHaveText('running');
  await expect(runStatus(page)).toHaveAttribute('data-status', 'running');

  // The responsiveness proof: the editor still takes keys while the worker spins.
  await expect(editor(page)).toBeFocused();
  await expect(runStatus(page)).toHaveAttribute('data-status', 'running');
  await press(page, 'i');
  await type(page, 'hello');
  await press(page, '<Esc>');
  const typed = await snapshot(page);
  expect(typed.doc.startsWith('hello'), 'the typed text arrived').toBe(true);
  expect(typed.mode).toBe('normal');
  await expect(
    runStatus(page),
    'still running while the text was typed',
  ).toHaveAttribute('data-status', 'running');

  await expect(runStatus(page)).toHaveText('killed after 5 s', {
    timeout: AFTER_DEADLINE,
  });
  await expect(runStatus(page)).toHaveAttribute('data-status', 'killed');
  await expect(consoleEntries(page)).toHaveCount(0);

  const probe = await page.evaluate(
    () =>
      (
        window as unknown as {
          __runProbe: {
            seen: { status: string; at: number }[];
            enterAt: number;
          };
        }
      ).__runProbe,
  );
  const statuses = probe.seen.map((s) => s.status);
  expect(statuses, 'the status never read done').not.toContain('done');
  expect(statuses.at(-1)).toBe('killed');
  const running = probe.seen.find((s) => s.status === 'running');
  const killed = probe.seen.find((s) => s.status === 'killed');
  expect(running, 'the pane showed running').toBeDefined();
  if (running !== undefined && killed !== undefined && probe.enterAt > 0) {
    console.log(
      `[sandbox] :w Enter → running in ${String(Math.round(running.at - probe.enterAt))} ms; running → killed after ${String(Math.round(killed.at - running.at))} ms`,
    );
  }
  // The editor still answers keys after the kill too.
  await expect(editor(page)).toBeFocused();
  await press(page, 'u');
  expect((await snapshot(page)).doc).toBe('while (true) {}');
});

// §12 F4: A thrown error shows the message and the TypeScript file and line; `Enter` on it
// moves the cursor there.
test('a thrown error shows the message and the TypeScript file and line; Enter on it moves the cursor there', async ({
  page,
}) => {
  // Line 1 is erased from the JavaScript, so the TypeScript line (3) differs from the JS line.
  await setDoc(
    page,
    lines(
      'type T = string;',
      "const reason: T = 'boom';",
      'throw new Error(reason);',
    ),
  );
  await ex(page, 'w');
  await expectDone(page);
  const errors = consoleEntries(page).and(
    page.locator('li[data-kind="error"]'),
  );
  await expect(errors).toHaveCount(1);
  await expect(consoleEntries(page)).toHaveCount(1);
  await expect(textOf(errors.first())).toHaveText('Error: boom');
  await expect(locOf(errors.first())).toHaveText('index.ts:3');

  await ex(page, 'output');
  await expect(outputPane(page)).toBeFocused();
  await expect(editor(page)).not.toBeFocused();
  await expect(errors.first()).toHaveAttribute('data-selected', 'true');
  await press(page, 'j');
  await expect(outputPane(page)).toBeFocused();
  await expect(errors.first(), 'j stays on the only entry').toHaveAttribute(
    'data-selected',
    'true',
  );
  await press(page, '<CR>');
  await expect(editor(page)).toBeFocused();
  const s = await snapshot(page);
  expect([s.line, s.col], 'the cursor is on `new` of the throw').toEqual([
    3, 6,
  ]);
  expect(s.mode).toBe('normal');
  expect(s.path).toBe('/index.ts');
});

// §12 F4: Two files importing each other without a cycle run in the right order; a cycle falls
// back to CommonJS and still runs (fixtures for both).
test('two files importing each other without a cycle run in the right order; a cycle falls back to CommonJS and still runs', async ({
  page,
}) => {
  test.setTimeout(40_000);
  // No cycle: shapes.ts logs first, then index.ts uses its export.
  await openBuffer(page, 'shapes', '/shapes.ts');
  await setDoc(
    page,
    lines(
      "console.log('shapes');",
      'export function area(r: number): number { return r * r; }',
    ),
  );
  await openBuffer(page, 'index', '/index.ts');
  await setDoc(
    page,
    lines("import { area } from './shapes';", "console.log('index', area(2));"),
  );
  await ex(page, 'w');
  await expectDone(page);
  await expect(runStatus(page)).not.toContainText('CommonJS');
  await expect(consoleEntries(page)).toHaveCount(2);
  await expect(textOf(consoleEntries(page).nth(0))).toHaveText('shapes');
  await expect(locOf(consoleEntries(page).nth(0))).toHaveText('shapes.ts:1');
  await expect(textOf(consoleEntries(page).nth(1))).toHaveText('index 4');
  await expect(locOf(consoleEntries(page).nth(1))).toHaveText('index.ts:2');

  // A cycle: index ↔ shapes. CommonJS loads shapes first (with index's exports still empty),
  // then index sees shapes' export.
  await setDoc(
    page,
    lines(
      "import { b } from './shapes';",
      "export const a = 'a';",
      "console.log('index sees', b);",
    ),
  );
  await openBuffer(page, 'shapes', '/shapes.ts');
  await setDoc(
    page,
    lines(
      "import { a } from './index';",
      "export const b = 'b';",
      "console.log('shapes sees', String(a));",
    ),
  );
  // `:w` runs the current buffer on /repl (F5), so back to the entry first.
  await openBuffer(page, 'index', '/index.ts');
  await ex(page, 'w');
  await expectDone(page);
  await expect(runStatus(page)).toContainText('done in');
  await expect(runStatus(page)).toContainText('CommonJS');
  await expect(consoleEntries(page)).toHaveCount(2);
  await expect(consoleEntries(page).nth(0)).toHaveAttribute(
    'data-kind',
    'console',
  );
  await expect(textOf(consoleEntries(page).nth(0))).toHaveText(
    'shapes sees undefined',
  );
  await expect(textOf(consoleEntries(page).nth(1))).toHaveText('index sees b');
});

// §12 F4: Top-level `await` works in a single-file run.
test('top-level await works in a single-file run', async ({ page }) => {
  await setDoc(
    page,
    lines('const v = await Promise.resolve(41);', 'console.log(v + 1);'),
  );
  await ex(page, 'w');
  await expectDone(page);
  await expect(consoleEntries(page)).toHaveCount(1);
  await expect(consoleEntries(page).first()).toHaveAttribute(
    'data-kind',
    'console',
  );
  await expect(textOf(consoleEntries(page).first())).toHaveText('42');
  await expect(locOf(consoleEntries(page).first())).toHaveText('index.ts:2');
});

// §12 F4: Output stops at 500 entries or 200 KB with one truncation line.
test('output stops at 500 entries or 200 KB with one truncation line', async ({
  page,
}) => {
  test.setTimeout(40_000);
  // The entry cap: 1000 lines → 500 entries and one truncation line.
  await setDoc(page, 'for (let i = 0; i < 1000; i += 1) console.log(i);');
  await ex(page, 'w');
  await expectDone(page);
  await expect(consoleEntries(page)).toHaveCount(501);
  await expect(textOf(consoleEntries(page).nth(0))).toHaveText('0');
  await expect(textOf(consoleEntries(page).nth(499))).toHaveText('499');
  await expect(consoleEntries(page).nth(499)).toHaveAttribute(
    'data-kind',
    'console',
  );
  const truncated = consoleEntries(page).last();
  await expect(truncated).toHaveAttribute('data-kind', 'truncated');
  await expect(textOf(truncated)).toHaveText(/^output truncated/);
  await expect(
    consoleEntries(page).and(page.locator('li[data-kind="truncated"]')),
    'exactly one truncation line',
  ).toHaveCount(1);

  // The byte cap: 10 KB per line → 20 lines fill 200 KB, the 21st is the truncation line.
  await setDoc(
    page,
    "for (let i = 0; i < 100; i += 1) console.log('x'.repeat(10_000));",
  );
  await ex(page, 'w');
  await expectDone(page);
  await expect(consoleEntries(page)).toHaveCount(21);
  await expect(consoleEntries(page).nth(19)).toHaveAttribute(
    'data-kind',
    'console',
  );
  await expect(consoleEntries(page).last()).toHaveAttribute(
    'data-kind',
    'truncated',
  );
  await expect(textOf(consoleEntries(page).last())).toHaveText(
    /^output truncated/,
  );
});

// §12 F4: A pending `setTimeout` after the entry settles shows "still running (1 timer)";
// `:kill` ends it.
test('a pending setTimeout after the entry settles shows "still running (1 timer)"; :kill ends it', async ({
  page,
}) => {
  await setDoc(
    page,
    lines(
      "setTimeout(() => console.log('late'), 60_000);",
      "console.log('now');",
    ),
  );
  await ex(page, 'w');
  await expect(runStatus(page)).toHaveText('still running (1 timer)');
  await expect(runStatus(page)).toHaveAttribute('data-status', 'still-running');
  await expect(consoleEntries(page)).toHaveCount(1);
  await expect(textOf(consoleEntries(page).first())).toHaveText('now');

  await ex(page, 'kill');
  await expect(runStatus(page)).toHaveText(/^killed after \d+(\.\d+)? (ms|s)$/);
  await expect(runStatus(page)).toHaveAttribute('data-status', 'killed');
  // The timer is gone with its worker: no `late` ever arrives and the status stays killed.
  await expect(consoleEntries(page)).toHaveCount(1);

  await ex(page, 'kill');
  await expect(vimPanel(page)).toHaveText('nothing is running');
  await expect(runStatus(page)).toHaveAttribute('data-status', 'killed');
  await expect(editor(page)).toBeFocused();
});

test.describe('the output pane keys', () => {
  // §4 Output pane: `h`/`l` switch tabs, `Esc` returns to the editor.
  test('h and l switch the tabs (wrapping) and Esc returns to the editor', async ({
    page,
  }) => {
    const consoleTab = page.getByRole('tab', { name: /^Console/ });
    const problemsTab = page.getByRole('tab', { name: /^Problems \(\d+\)$/ });
    const testsTab = page.getByRole('tab', { name: 'Tests' });
    await ex(page, 'output');
    await expect(outputPane(page)).toBeFocused();
    await expect(consoleTab).toHaveAttribute('aria-selected', 'true');
    await press(page, 'l');
    await expect(problemsTab).toHaveAttribute('aria-selected', 'true');
    await expect(consoleTab).toHaveAttribute('aria-selected', 'false');
    await press(page, 'l');
    await expect(testsTab).toHaveAttribute('aria-selected', 'true');
    await press(page, 'l');
    await expect(consoleTab, 'l wraps to Console').toHaveAttribute(
      'aria-selected',
      'true',
    );
    await press(page, 'h');
    await expect(testsTab, 'h wraps to Tests').toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(outputPane(page), 'the pane kept focus').toBeFocused();
    await press(page, '<Esc>');
    await expect(editor(page)).toBeFocused();
    expect((await snapshot(page)).mode).toBe('normal');
  });

  // §4 Output pane: `j`/`k` move the selection; `Enter` jumps to the selected entry's line.
  test('j and k move the selection over the console entries and Enter follows it', async ({
    page,
  }) => {
    await setDoc(
      page,
      lines(
        "console.log('one');",
        "console.log('two');",
        "console.log('three');",
      ),
    );
    await ex(page, 'w');
    await expect(runStatus(page)).toHaveText(/^done in /);
    await expect(consoleEntries(page)).toHaveCount(3);
    await ex(page, 'output');
    await expect(outputPane(page)).toBeFocused();
    await expect(consoleEntries(page).nth(0)).toHaveAttribute(
      'data-selected',
      'true',
    );
    await press(page, 'j');
    await press(page, 'j');
    await expect(consoleEntries(page).nth(2)).toHaveAttribute(
      'data-selected',
      'true',
    );
    await press(page, 'j');
    await expect(
      consoleEntries(page).nth(2),
      'j stops at the last entry',
    ).toHaveAttribute('data-selected', 'true');
    await press(page, 'k');
    await expect(consoleEntries(page).nth(1)).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(consoleEntries(page).nth(2)).not.toHaveAttribute(
      'data-selected',
      'true',
    );
    await press(page, '<CR>');
    await expect(editor(page)).toBeFocused();
    // The frame's column is the `.log` call's, mapped back to the TypeScript text.
    expect(await cursor(page)).toEqual([2, 8]);
  });

  // §4 Output pane: `Enter` jumps to the diagnostic.
  test('Enter on a Problems entry moves the cursor to the diagnostic', async ({
    page,
  }) => {
    await setDoc(page, lines('const ok = 1;', "const a: number = 'x';"));
    await expect(problems(page)).toHaveCount(1);
    await press(page, 'gg0');
    expect((await snapshot(page)).line).toBe(1);
    await ex(page, 'output');
    await expect(outputPane(page)).toBeFocused();
    await press(page, 'l');
    await expect(
      page.getByRole('tab', { name: 'Problems (1)' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(problems(page).first()).toHaveAttribute(
      'data-selected',
      'true',
    );
    await press(page, '<CR>');
    await expect(editor(page)).toBeFocused();
    const s = await snapshot(page);
    expect([s.line, s.col], 'the cursor is on the diagnostic').toEqual([2, 6]);
    expect(s.mode).toBe('normal');
  });
});
