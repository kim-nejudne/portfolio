// §12 F10 "Settings" (spec §7 Settings, §4 Mappings and the vimrc, §6 Theme and type), from the
// keyboard in Chrome:
//   1. "vimrc, relative numbers, font size, theme, default timeout and compiler defaults are
//      editable and apply without a reload."
//   2. "Settings are included in export and restored by import."
// Criterion 1 is proven where the settings land: an open /repl tab next to /settings in the same
// context (the `storage` event), a lesson reached from /settings by client-side navigation in
// the same tab, and the lesson page's run deadline for an exercise with and without its own
// `timeoutMs`. A window marker proves no page was reloaded. The page's validation (nothing
// stored for a bad value, the vimrc's bad lines listed with their numbers) and its keyboard
// reach (Tab order, Space, the arrow keys, the global keys kept out of the text fields) are
// part of "editable". A vimrc without the shipped `set rnu` takes the relative numbers away
// with nothing stored. A theory block's Run is proven by the `run` message it posts to the
// sandbox, because no fixture `ts run` block can hang (fixtures/content/modules/m99-fixtures).
// Criterion 2 sets all six on /settings, exports, changes them, imports and checks the stored
// object, the page, the theme, the font size and /repl's diagnostics; an imported file's
// compiler defaults pass TypeScript's check or are left out; and an import makes the settings
// the file's (keys it lacks go back to their defaults). Keyboard only; no fixed sleeps.
import { expect, test } from '@playwright/test';
import { exerciseFolders, moduleLessons, readModule } from './helpers/course';
import { codeBlocks, gotoLesson, theory } from './helpers/content';
import {
  ex,
  gotoRepl,
  lines,
  press,
  problems,
  readStoredSettings,
  runStatus,
  setDoc,
  snapshot,
  type,
  waitForCompilerReady,
} from './helpers/editor';
import { expectExerciseAt, readExerciseYaml } from './helpers/lesson';
import {
  catchDownload,
  card,
  expectRoadmap,
  fileInput,
  gotoProgress,
  importDialog,
  lessonLink,
  progressNotice,
  storeSettings,
  tabTo,
} from './helpers/progress';
import {
  applyImport,
  button,
  chooseImportFile,
  codeFontSizeProperty,
  compilerField,
  compilerProblems,
  compilerStatus,
  computedFontSize,
  describeFocus,
  editorVimrcStatus,
  expectNoReload,
  exportFromProgress,
  fontSizeInput,
  gotoSettings,
  markNoReload,
  pressUntilFocused,
  recordedRuns,
  recordRunMessages,
  relativeNumbersBox,
  replaceText,
  settingsLine,
  specShippedVimrc,
  tabStops,
  themeRadio,
  timeoutInput,
  vimrcField,
  vimrcProblems,
  vimrcStatus,
} from './helpers/settings';
import { gotoExercise } from './helpers/verify';

/** Clean under the §2 defaults; TS2322 on line 2 with `noUncheckedIndexedAccess`. */
const INDEXED = lines(
  'const xs: number[] = [1];',
  'const n: number = xs[0];',
  '',
);
const INDEXED_ERROR =
  "Type 'number | undefined' is not assignable to type 'number'.";
const NO_UNCHECKED = '{"noUncheckedIndexedAccess": true}';

/** Five lines with the cursor on the third: what the gutter shows either way. */
const FIVE_LINES = lines('one', 'two', 'three', 'four', 'five');
const RELATIVE = ['2', '1', '3', '1', '2'];
const ABSOLUTE = ['1', '2', '3', '4', '5'];

const DARK = /(^|\s)dark(\s|$)/;
const BAD_LINE = 'vimrc line 2: unknown command "frobnicate"';

test.describe('§12 F10 criterion 1: apply without a reload', () => {
  // The system scheme is dark, so Light shows as a change from System, and Dark from Light.
  test.use({ colorScheme: 'dark' });

  // §12 F10: "vimrc, relative numbers, font size, theme, default timeout and compiler defaults
  // are editable and apply without a reload" — each changed on /settings, each seen in /repl.
  test('every setting applies live in an open /repl tab, without a reload: theme, relative numbers, font size, default timeout, vimrc, compiler defaults', async ({
    page: repl,
    context,
  }) => {
    test.setTimeout(90_000);
    await gotoRepl(repl);
    await waitForCompilerReady(repl);
    const settings = await context.newPage();
    await gotoSettings(settings);
    await markNoReload(repl);
    await markNoReload(settings);
    const html = repl.locator('html');

    // Theme: System (dark here) → Light → Dark → Light, with the arrow keys on the radios.
    await expect(html, 'System follows the dark system scheme').toHaveClass(
      DARK,
    );
    await tabTo(settings, themeRadio(settings, 'System'));
    await expect(themeRadio(settings, 'System')).toBeChecked();
    await settings.keyboard.press('ArrowRight');
    await expect(themeRadio(settings, 'Light')).toBeChecked();
    await expect(html, 'Light in /repl').not.toHaveClass(DARK);
    await expect
      .poll(() =>
        repl.evaluate(() => document.documentElement.style.colorScheme),
      )
      .toBe('light');
    await settings.keyboard.press('ArrowRight');
    await expect(themeRadio(settings, 'Dark')).toBeChecked();
    await expect(html, 'Dark in /repl').toHaveClass(DARK);
    await expect
      .poll(() =>
        repl.evaluate(() => document.documentElement.style.colorScheme),
      )
      .toBe('dark');
    await settings.keyboard.press('ArrowLeft');
    await expect(themeRadio(settings, 'Light')).toBeChecked();
    await expect(html, 'Light again in /repl').not.toHaveClass(DARK);

    // Relative numbers: the shipped vimrc's `set rnu` starts them on; Space toggles the box.
    await setDoc(repl, FIVE_LINES, { line: 3, col: 0 });
    await expect
      .poll(async () => (await snapshot(repl)).gutter, {
        message: 'relative from the shipped set rnu',
      })
      .toEqual(RELATIVE);
    await tabTo(settings, relativeNumbersBox(settings));
    await expect(relativeNumbersBox(settings)).toBeChecked();
    await settings.keyboard.press('Space');
    await expect(relativeNumbersBox(settings)).not.toBeChecked();
    await expect
      .poll(async () => (await snapshot(repl)).gutter, {
        message: 'absolute after the box is unchecked',
      })
      .toEqual(ABSOLUTE);
    await settings.keyboard.press('Space');
    await expect(relativeNumbersBox(settings)).toBeChecked();
    await expect
      .poll(async () => (await snapshot(repl)).gutter, {
        message: 'relative after the box is checked again',
      })
      .toEqual(RELATIVE);

    // Font size: the editor's text follows --code-font-size.
    const content = repl.locator('.cm-content');
    expect(await computedFontSize(content)).toBe('14px');
    await replaceText(settings, fontSizeInput(settings), '20');
    await expect.poll(() => computedFontSize(content)).toBe('20px');

    // Default timeout: read at the next run.
    await replaceText(settings, timeoutInput(settings), '1000');
    await expect
      .poll(() => readStoredSettings(repl))
      .toMatchObject({ defaultTimeoutMs: 1000 });
    await setDoc(repl, 'while (true) {}');
    await ex(repl, 'w');
    await expect(runStatus(repl)).toHaveText('killed after 1 s', {
      timeout: 4000,
    });
    await expect(runStatus(repl)).toHaveAttribute('data-status', 'killed');

    // vimrc: a replacement for the shipped text with one bad line, listed live, saved anyway.
    await replaceText(
      settings,
      vimrcField(settings),
      lines('imap kj <Esc>', 'frobnicate', ''),
    );
    await expect(vimrcProblems(settings)).toHaveText([BAD_LINE]);
    await tabTo(settings, button(settings, 'Save vimrc'));
    await settings.keyboard.press('Enter');
    await expect(vimrcStatus(settings)).toHaveText(
      'vimrc saved; 1 bad line skipped',
    );
    await expect(editorVimrcStatus(repl)).toBeVisible();
    await expect(editorVimrcStatus(repl)).toHaveText(BAD_LINE);
    // `kj` leaves insert mode; the shipped `jk` is gone with the text it came from.
    await setDoc(repl, 'abc');
    await press(repl, 'A');
    expect((await snapshot(repl)).mode).toBe('insert');
    await type(repl, 'kj');
    let s = await snapshot(repl);
    expect(s.mode, 'kj → <Esc>').toBe('normal');
    expect(s.doc).toBe('abc');
    await press(repl, 'A');
    await type(repl, 'jk');
    s = await snapshot(repl);
    expect(s.mode, 'jk is plain text now').toBe('insert');
    expect(s.doc).toBe('abcjk');
    await press(repl, '<Esc>');

    // Five of six applied, neither page reloaded.
    await expectNoReload(repl);
    await expectNoReload(settings);

    // Compiler defaults: merged over §2 for the /repl buffers; Clear takes them away again.
    // A known error first: the list going from 1 to 0 proves INDEXED's own lint has run, so
    // the editor is idle (no lint pending) when the setting changes, as it is in real use.
    await setDoc(repl, 'const s: string = 1;\n');
    await expect(problems(repl)).toHaveCount(1);
    await setDoc(repl, INDEXED);
    await expect(problems(repl), 'clean under the §2 defaults').toHaveCount(0);
    await replaceText(settings, compilerField(settings), NO_UNCHECKED);
    await tabTo(settings, button(settings, 'Save compiler defaults'));
    await settings.keyboard.press('Enter');
    await expect(compilerStatus(settings)).toHaveText(
      'compiler defaults saved',
      { timeout: 15_000 },
    );
    await expect(problems(repl)).toHaveCount(1);
    await expect(problems(repl).first()).toContainText('index.ts:2:7');
    await expect(problems(repl).first()).toContainText(INDEXED_ERROR);
    await expect(problems(repl).first()).toContainText('TS2322');
    await tabTo(settings, button(settings, 'Clear'));
    await settings.keyboard.press('Enter');
    await expect(compilerStatus(settings)).toHaveText(
      'compiler defaults cleared',
    );
    await expect(problems(repl), 'clean again after Clear').toHaveCount(0);

    await expectNoReload(repl);
    await expectNoReload(settings);
  });
});

// §12 F10 criterion 1, in the same tab: a lesson opened after the change, by client-side
// navigation, has the font size on its editor and its theory blocks, and the theme.
test('§12 F10 criterion 1, same tab: font size 18 and Dark set on /settings apply on a lesson reached through the roadmap and the module page, without a reload', async ({
  page,
}) => {
  const [lesson] = moduleLessons('m99-fixtures');
  if (lesson === undefined) throw new Error('m99-fixtures has no lesson');
  const exercise = exerciseFolders(lesson)[0] ?? '';

  await gotoSettings(page);
  await markNoReload(page);
  await expect(page.locator('html')).not.toHaveClass(DARK);
  await tabTo(page, themeRadio(page, 'System'));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(themeRadio(page, 'Dark')).toBeChecked();
  await expect(page.locator('html')).toHaveClass(DARK);
  await replaceText(page, fontSizeInput(page), '18');
  await expect.poll(() => codeFontSizeProperty(page)).toBe('18px');

  // The header link, the roadmap's j/Enter, the module page's j/Enter.
  await tabTo(page, page.getByRole('link', { name: 'ts-dojo', exact: true }));
  await page.keyboard.press('Enter');
  await expectRoadmap(page);
  await pressUntilFocused(page, 'j', card(page, 'm99-fixtures'));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/m/m99-fixtures');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    readModule('m99-fixtures').title,
  );
  await pressUntilFocused(page, 'j', lessonLink(page, lesson));
  await page.keyboard.press('Enter');
  await expectExerciseAt(page, lesson, exercise);

  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  expect(await computedFontSize(content), 'the lesson editor').toBe('18px');
  const block = theory(page).locator('.shiki').first();
  await expect(block).toBeVisible();
  expect(await computedFontSize(block), 'a theory code block').toBe('18px');
  await expect(page.locator('html')).toHaveClass(DARK);
  await expectNoReload(page);
});

test.describe('§12 F10 criterion 1: the default timeout on the lesson page', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettings(page);
    await replaceText(page, timeoutInput(page), '1000');
    await expect
      .poll(() => readStoredSettings(page))
      .toEqual({ defaultTimeoutMs: 1000 });
  });

  // §12 F10: the default timeout applies to an exercise whose exercise.yaml names none.
  test('an exercise without timeoutMs (02-literal-discriminant) follows the default timeout: :w of while (true) {} is killed after 1 s', async ({
    page,
  }) => {
    expect(
      readExerciseYaml('02-implement', '02-literal-discriminant'),
    ).not.toHaveProperty('timeoutMs');
    await gotoExercise(page, '02-implement', '02-literal-discriminant');
    await setDoc(page, 'while (true) {}');
    await ex(page, 'w');
    await expect(runStatus(page)).toHaveText('killed after 1 s', {
      timeout: 4000,
    });
    await expect(runStatus(page)).toHaveAttribute('data-status', 'killed');
  });

  // The other half of the precedence (`timeoutFor`): an exercise's own timeoutMs wins.
  test('an exercise with timeoutMs: 5000 (01-largest-shape) keeps 5 s under a 1000 ms default', async ({
    page,
  }) => {
    test.setTimeout(40_000);
    expect(readExerciseYaml('02-implement', '01-largest-shape')).toHaveProperty(
      'timeoutMs',
      5000,
    );
    await gotoExercise(page, '02-implement', '01-largest-shape');
    await setDoc(page, 'while (true) {}');
    await ex(page, 'w');
    await expect(runStatus(page)).toHaveText('running');
    await expect(runStatus(page)).toHaveText('killed after 5 s', {
      timeout: 8000,
    });
  });
});

// §12 F10 criterion 1, vimrc: the editor's options start from the engine defaults on each
// re-apply, so a `set` line that is no longer in the vimrc stops applying; the box on /settings
// follows the vimrc when no `:set` choice is stored.
test('§12 F10 criterion 1: a vimrc without the shipped set rnu turns the relative numbers off in an open /repl tab with nothing stored, and restoring the shipped vimrc turns them back on, without a reload', async ({
  page: repl,
  context,
}) => {
  const gutter = async (): Promise<string[]> => (await snapshot(repl)).gutter;
  await gotoRepl(repl);
  await setDoc(repl, FIVE_LINES, { line: 3, col: 0 });
  await expect
    .poll(gutter, { message: 'relative from the shipped set rnu' })
    .toEqual(RELATIVE);
  const settings = await context.newPage();
  await gotoSettings(settings);
  await markNoReload(repl);
  await markNoReload(settings);
  expect(await readStoredSettings(settings), 'a fresh profile').toBeNull();
  await expect(relativeNumbersBox(settings)).toBeChecked();

  const vimrc = lines('imap kj <Esc>', '');
  await replaceText(settings, vimrcField(settings), vimrc);
  await tabTo(settings, button(settings, 'Save vimrc'));
  await settings.keyboard.press('Enter');
  await expect(vimrcStatus(settings)).toHaveText('vimrc saved');
  await expect(relativeNumbersBox(settings)).not.toBeChecked();
  await expect
    .poll(gutter, { message: 'absolute once set rnu is gone' })
    .toEqual(ABSOLUTE);
  expect(
    await readStoredSettings(settings),
    'only the vimrc is stored, no relativeNumbers',
  ).toEqual({ vimrc });

  await tabTo(settings, button(settings, 'Restore the shipped vimrc'));
  await settings.keyboard.press('Enter');
  await expect(vimrcStatus(settings)).toHaveText('shipped vimrc restored');
  await expect(relativeNumbersBox(settings)).toBeChecked();
  await expect
    .poll(gutter, { message: 'relative again with the shipped vimrc' })
    .toEqual(RELATIVE);
  expect(await readStoredSettings(settings), 'nothing stored').toEqual({});

  await expectNoReload(repl);
  await expectNoReload(settings);
});

// §12 F10 criterion 1, default timeout: "for Run in a lesson" (src/pages/settings.tsx), read at
// each run. The `run` message the theory block posts to its sandbox carries the deadline.
test("§12 F10 criterion 1: a theory block's Run uses the default timeout: 5000 ms with nothing set, 1000 ms once /settings in another tab sets 1000, without a reload", async ({
  page,
  context,
}) => {
  await recordRunMessages(page);
  await gotoLesson(page, '01-fix');
  await markNoReload(page);
  const block = codeBlocks(page, 'run').first();
  const run = block.getByRole('button', { name: 'Run', exact: true });
  const status = block
    .getByRole('region', { name: 'Output' })
    .getByRole('status');

  await run.focus();
  await expect(run).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(status).toHaveText(/^done in \d+ ms$/);
  expect(await recordedRuns(page)).toEqual([
    { timeoutMs: 5000, entry: '/snippet.ts' },
  ]);

  const settings = await context.newPage();
  await gotoSettings(settings);
  await replaceText(settings, timeoutInput(settings), '1000');
  await expect
    .poll(() => readStoredSettings(settings))
    .toEqual({ defaultTimeoutMs: 1000 });

  await expect(run, 'Run kept the focus').toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await recordedRuns(page)).length).toBe(2);
  expect((await recordedRuns(page))[1]).toEqual({
    timeoutMs: 1000,
    entry: '/snippet.ts',
  });
  await expect(status).toHaveText(/^done in \d+ ms$/);
  await expectNoReload(page);
});

// §12 F10 criterion 1, "editable": a value the page cannot use is explained and nothing is
// stored; the vimrc's bad lines are listed with their numbers and skipped (§4).
test('§12 F10 criterion 1, validation: bad compiler defaults (JSON, an unknown option, an app-owned option, a TypeScript conflict), font size 30 and timeout 100 are explained and not stored; a bad vimrc line is listed with its number, Save stores the text and says 1 bad line skipped; Restore puts the shipped vimrc back and removes the key', async ({
  page,
}) => {
  test.setTimeout(40_000);
  await gotoSettings(page);
  expect(await readStoredSettings(page), 'nothing stored yet').toBeNull();
  const shipped = await vimrcField(page).inputValue();
  expect(shipped.trimEnd(), 'the §4 shipped vimrc').toBe(specShippedVimrc());
  await expect(page.getByText('No bad lines.')).toBeVisible();

  // Compiler defaults: the shape check, then TypeScript itself.
  const refused: [text: string, problem: string | RegExp][] = [
    ['{"noUncheckedIndexedAccess": tru}', /^not valid JSON: ./],
    ['{"foo": true}', "Unknown compiler option 'foo'."],
    [
      '{"module": "commonjs"}',
      'module is fixed by ts-dojo: code runs in the sandbox as ES modules, without tslib',
    ],
    [
      '{"exactOptionalPropertyTypes": true, "strict": false}',
      "Option 'exactOptionalPropertyTypes' cannot be specified without specifying option 'strictNullChecks'.",
    ],
  ];
  for (const [text, problem] of refused) {
    await replaceText(page, compilerField(page), text);
    await tabTo(page, button(page, 'Save compiler defaults'));
    await page.keyboard.press('Enter');
    await expect(compilerStatus(page), text).toHaveText(
      'compiler defaults not saved',
      { timeout: 15_000 },
    );
    await expect(compilerProblems(page), text).toHaveText([problem]);
    expect(await readStoredSettings(page), `${text} is not stored`).toBeNull();
  }

  // The number fields: explained at once, nothing stored.
  await replaceText(page, fontSizeInput(page), '30');
  await expect(page.locator('#font-size-help')).toHaveText(
    'Font size must be a whole number of px from 10 to 24; nothing was saved.',
  );
  await expect(fontSizeInput(page)).toHaveAttribute('aria-invalid', 'true');
  await replaceText(page, timeoutInput(page), '100');
  await expect(page.locator('#default-timeout-help')).toHaveText(
    'Default timeout must be a whole number of ms from 500 to 60000; nothing was saved.',
  );
  await expect(timeoutInput(page)).toHaveAttribute('aria-invalid', 'true');
  expect(await readStoredSettings(page), 'neither number is stored').toBeNull();

  // The vimrc: line 2 is listed before Save; Save stores the text all the same.
  const custom = lines('imap kj <Esc>', 'frobnicate', 'nmap Q :ls<CR>', '');
  await replaceText(page, vimrcField(page), custom);
  await expect(vimrcProblems(page)).toHaveText([BAD_LINE]);
  expect(await readStoredSettings(page), 'not stored before Save').toBeNull();
  await tabTo(page, button(page, 'Save vimrc'));
  await page.keyboard.press('Enter');
  await expect(vimrcStatus(page)).toHaveText('vimrc saved; 1 bad line skipped');
  expect(await readStoredSettings(page)).toEqual({ vimrc: custom });

  await tabTo(page, button(page, 'Restore the shipped vimrc'));
  await page.keyboard.press('Enter');
  await expect(vimrcStatus(page)).toHaveText('shipped vimrc restored');
  await expect(vimrcField(page)).toHaveValue(shipped);
  await expect(page.getByText('No bad lines.')).toBeVisible();
  const stored = await readStoredSettings(page);
  expect(stored, 'Restore removes the vimrc key').not.toHaveProperty('vimrc');

  // A valid number is written as soon as it is typed.
  await replaceText(page, fontSizeInput(page), '16');
  await expect(fontSizeInput(page)).toHaveAttribute('aria-invalid', 'false');
  await expect.poll(() => readStoredSettings(page)).toEqual({ fontSize: 16 });
});

// §12 F10 criterion 1, "editable" from the keyboard (§6: everything without a mouse).
test('§12 F10 criterion 1, keyboard: every control is reached with Tab from the top in order (the theme radios are one stop), Space toggles the checkbox, the arrow keys move the theme, and ? and g r typed in the vimrc stay text', async ({
  page,
}) => {
  await gotoSettings(page);
  await expect(page.locator('body')).toBeFocused();
  const shipped = await vimrcField(page).inputValue();
  // With nothing to save or restore, the four buttons are disabled and no Tab stop.
  for (const name of [
    'Save vimrc',
    'Restore the shipped vimrc',
    'Save compiler defaults',
    'Clear',
  ]) {
    await expect(button(page, name), name).toBeDisabled();
  }
  expect(await tabStops(page, 6)).toEqual([
    'a ts-dojo',
    'radio system',
    'checkbox Relative line numbers',
    '#font-size',
    '#default-timeout',
    '#vimrc',
  ]);

  // In the vimrc the global keys are text: a comment line with ? and g r.
  await page.keyboard.press('Control+End');
  await page.keyboard.type('" ');
  await page.keyboard.press('?');
  await page.keyboard.press('g');
  await page.keyboard.press('r');
  await expect(vimrcField(page)).toHaveValue(`${shipped}" ?gr`);
  await expect(vimrcField(page)).toBeFocused();
  await expect(page.getByRole('dialog'), 'no help overlay').toHaveCount(0);
  await expect(page, 'g r did not go to the roadmap').toHaveURL('/settings');
  await expect(page.getByText('No bad lines.')).toBeVisible();

  // The edits enable the vimrc's buttons and then the compiler defaults' buttons, in order.
  expect(await tabStops(page, 3)).toEqual([
    'button Save vimrc',
    'button Restore the shipped vimrc',
    '#compiler-defaults',
  ]);
  await page.keyboard.type('{}');
  expect(await tabStops(page, 2)).toEqual([
    'button Save compiler defaults',
    'button Clear',
  ]);
  expect(['body', 'a ts-dojo'], 'nothing on the page after Clear').toContain(
    (await tabStops(page, 1))[0],
  );

  // Space toggles the checkbox, and writes it.
  await tabTo(page, relativeNumbersBox(page));
  await expect(relativeNumbersBox(page)).toBeChecked();
  await page.keyboard.press('Space');
  await expect(relativeNumbersBox(page)).not.toBeChecked();
  await expect
    .poll(() => readStoredSettings(page))
    .toEqual({ relativeNumbers: false });
  await page.keyboard.press('Space');
  await expect(relativeNumbersBox(page)).toBeChecked();
  await expect
    .poll(() => readStoredSettings(page))
    .toEqual({ relativeNumbers: true });

  // The arrow keys move the theme within its one stop, and write it.
  await page.keyboard.press('Shift+Tab');
  expect(await describeFocus(page)).toBe('radio system');
  await page.keyboard.press('ArrowRight');
  await expect(themeRadio(page, 'Light')).toBeFocused();
  await expect(themeRadio(page, 'Light')).toBeChecked();
  await expect
    .poll(() => readStoredSettings(page))
    .toMatchObject({ theme: 'light' });
  await page.keyboard.press('ArrowRight');
  await expect(themeRadio(page, 'Dark')).toBeChecked();
  await expect(page.locator('html')).toHaveClass(DARK);
  await expect
    .poll(() => readStoredSettings(page))
    .toMatchObject({ theme: 'dark' });
  await page.keyboard.press('ArrowLeft');
  await expect(themeRadio(page, 'Light')).toBeChecked();
  await expect(page.locator('html')).not.toHaveClass(DARK);

  // The control: outside a text field the same keys are the app's.
  await tabTo(page, button(page, 'Save vimrc'));
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Keyboard help' });
  await expect(help).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await page.keyboard.press('g');
  await page.keyboard.press('r');
  await expect(page).toHaveURL('/');
});

// §12 F10: "Settings are included in export and restored by import."
test('§12 F10 criterion 2: the export carries every setting; the import restores them and they apply (the page, the theme, the font size, /repl)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const vimrc = lines('imap kj <Esc>', 'nmap Q :ls<CR>', '');
  const expected = {
    theme: 'dark',
    relativeNumbers: false,
    fontSize: 18,
    defaultTimeoutMs: 1500,
    vimrc,
    compilerDefaults: { noUncheckedIndexedAccess: true },
  };

  // All six, on /settings, from the keyboard.
  await gotoSettings(page);
  await tabTo(page, themeRadio(page, 'System'));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(themeRadio(page, 'Dark')).toBeChecked();
  await tabTo(page, relativeNumbersBox(page));
  await page.keyboard.press('Space');
  await expect(relativeNumbersBox(page)).not.toBeChecked();
  await replaceText(page, fontSizeInput(page), '18');
  await replaceText(page, timeoutInput(page), '1500');
  await replaceText(page, vimrcField(page), vimrc);
  await tabTo(page, button(page, 'Save vimrc'));
  await page.keyboard.press('Enter');
  await expect(vimrcStatus(page)).toHaveText('vimrc saved');
  await replaceText(page, compilerField(page), NO_UNCHECKED);
  await tabTo(page, button(page, 'Save compiler defaults'));
  await page.keyboard.press('Enter');
  await expect(compilerStatus(page)).toHaveText('compiler defaults saved', {
    timeout: 15_000,
  });
  expect(await readStoredSettings(page)).toEqual(expected);

  // Export.
  await gotoProgress(page);
  const file = await catchDownload(page, async () => {
    await tabTo(page, page.getByRole('button', { name: 'Export progress' }));
    await page.keyboard.press('Enter');
  });
  expect(file.json.settings, 'the export carries exactly the six').toEqual(
    expected,
  );

  // Every one changed (two of them removed), in force after a reload.
  await storeSettings(page, {
    theme: 'light',
    relativeNumbers: true,
    fontSize: 12,
    defaultTimeoutMs: 3000,
  });
  await gotoProgress(page);
  await expect(page.locator('html')).not.toHaveClass(DARK);
  expect(await codeFontSizeProperty(page)).toBe('12px');

  // Import: the preview names the six keys; Apply.
  await fileInput(page).setInputFiles({
    name: file.name,
    mimeType: 'application/json',
    buffer: Buffer.from(file.text),
  });
  const dialog = importDialog(page);
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator('[data-category="settings"] [data-field="change"]'),
  ).toHaveText(
    'theme, vimrc, relativeNumbers, fontSize, defaultTimeoutMs, compilerDefaults changed',
  );
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(progressNotice(page)).toHaveText(`imported ${file.name}`);

  // Restored, and applied in this tab at once.
  expect(await readStoredSettings(page)).toEqual(file.json.settings);
  await expect(page.locator('html')).toHaveClass(DARK);
  await expect.poll(() => codeFontSizeProperty(page)).toBe('18px');

  // The Settings page shows the restored values.
  await gotoSettings(page);
  await expect(themeRadio(page, 'Dark')).toBeChecked();
  await expect(relativeNumbersBox(page)).not.toBeChecked();
  await expect(fontSizeInput(page)).toHaveValue('18');
  await expect(timeoutInput(page)).toHaveValue('1500');
  await expect(vimrcField(page)).toHaveValue(vimrc);
  await expect(compilerField(page)).toHaveValue(
    JSON.stringify({ noUncheckedIndexedAccess: true }, null, 2),
  );

  // /repl runs under them: the compiler defaults, the vimrc, the absolute gutter.
  await gotoRepl(page);
  await waitForCompilerReady(page);
  await setDoc(page, INDEXED);
  await expect(problems(page)).toHaveCount(1);
  await expect(problems(page).first()).toContainText('index.ts:2:7');
  await expect(problems(page).first()).toContainText('TS2322');
  await setDoc(page, 'abc');
  await press(page, 'A');
  await type(page, 'kj');
  expect((await snapshot(page)).mode, 'the imported kj mapping').toBe('normal');
  await setDoc(page, FIVE_LINES, { line: 3, col: 0 });
  await expect
    .poll(async () => (await snapshot(page)).gutter, {
      message: 'relativeNumbers: false',
    })
    .toEqual(ABSOLUTE);
});

// §12 F10 criterion 2, with the check a Save on /settings makes: options TypeScript refuses
// would leave /repl without a project, so they are left out of the import and the preview says
// why; the rest of the settings import as usual.
test('§12 F10 criterion 2: an imported file whose compiler defaults TypeScript refuses imports without them, the preview says why, and /repl still type-checks', async ({
  page,
}) => {
  test.setTimeout(40_000);
  await gotoProgress(page);
  const base = await exportFromProgress(page);
  const name = 'refused-defaults.json';
  await chooseImportFile(page, name, {
    ...base.json,
    settings: { theme: 'dark', compilerDefaults: { foo: true } },
  });
  const dialog = importDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator('[data-field="settings-refused"]')).toHaveText(
    "The file's compiler defaults are left out: TypeScript says Unknown compiler option 'foo'.",
  );
  await expect(settingsLine(page)).toHaveText('theme changed');
  await applyImport(page, name);
  expect(await readStoredSettings(page)).toEqual({ theme: 'dark' });
  await expect(page.locator('html')).toHaveClass(DARK);

  await gotoRepl(page);
  await waitForCompilerReady(page);
  await setDoc(page, 'const s: string = 1;\n');
  await expect(problems(page)).toHaveCount(1);
  await expect(problems(page).first()).toHaveText(
    "index.ts:1:7 Type 'number' is not assignable to type 'string'. TS2322",
  );
});

// "Left out" means not imported: compiler defaults already here stay, though the import
// replaces the settings.
test("§12 F10 criterion 2: when a file's compiler defaults are refused, the ones already here stay and only the rest of the settings import", async ({
  page,
}) => {
  test.setTimeout(40_000);
  const mine = { noUncheckedIndexedAccess: true };
  await gotoProgress(page);
  await storeSettings(page, { compilerDefaults: mine });
  await gotoProgress(page);
  const base = await exportFromProgress(page);
  const name = 'refused-over-mine.json';
  await chooseImportFile(page, name, {
    ...base.json,
    settings: { theme: 'dark', compilerDefaults: { foo: true } },
  });
  const dialog = importDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator('[data-field="settings-refused"]')).toHaveText(
    "The file's compiler defaults are left out: TypeScript says Unknown compiler option 'foo'.",
  );
  await expect(settingsLine(page)).toHaveText('theme changed');
  await applyImport(page, name);
  expect(await readStoredSettings(page)).toEqual({
    theme: 'dark',
    compilerDefaults: mine,
  });
});

// An import that drops a stored `:set` choice reaches an editor already open in another tab:
// the vimrc decides again, as it would after a reload.
test("§12 F10 criterion 2: an import that drops a stored relativeNumbers reaches a /repl already open in another tab: the shipped vimrc's set rnu applies again, without a reload", async ({
  page: repl,
  context,
}) => {
  test.setTimeout(40_000);
  const gutter = async (): Promise<string[]> => (await snapshot(repl)).gutter;
  await gotoProgress(repl);
  await storeSettings(repl, { relativeNumbers: false });
  await gotoRepl(repl);
  await setDoc(repl, FIVE_LINES, { line: 3, col: 0 });
  await expect
    .poll(gutter, { message: 'absolute from the stored choice' })
    .toEqual(ABSOLUTE);
  const progress = await context.newPage();
  await gotoProgress(progress);
  await markNoReload(repl);
  const base = await exportFromProgress(progress);
  const name = 'no-settings.json';
  await chooseImportFile(progress, name, { ...base.json, settings: {} });
  await expect(importDialog(progress)).toBeVisible({ timeout: 15_000 });
  await expect(settingsLine(progress)).toHaveText('relativeNumbers changed');
  await applyImport(progress, name);
  expect(await readStoredSettings(progress)).toEqual({});
  await expect
    .poll(gutter, { message: 'relative again from the shipped set rnu' })
    .toEqual(RELATIVE);
  await expectNoReload(repl);
});

// §12 F10 criterion 2, "restored by import" (Kim's decision): the settings become the file's,
// so a key the file lacks goes back to its default.
test("§12 F10 criterion 2: an import makes the settings the file's: a custom vimrc, compiler defaults and font size the file lacks go back to their defaults", async ({
  page,
}) => {
  test.setTimeout(40_000);
  const local = {
    vimrc: lines('imap kj <Esc>', ''),
    compilerDefaults: { noUncheckedIndexedAccess: true },
    fontSize: 20,
  };
  await gotoProgress(page);
  await storeSettings(page, local);
  await gotoProgress(page);
  expect(await codeFontSizeProperty(page)).toBe('20px');
  const base = await exportFromProgress(page);
  expect(base.json.settings).toEqual(local);

  const name = 'theme-only.json';
  await chooseImportFile(page, name, {
    ...base.json,
    settings: { theme: 'dark' },
  });
  const dialog = importDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toContainText("The settings become the file's.");
  await expect(settingsLine(page)).toHaveText(
    'theme, vimrc, fontSize, compilerDefaults changed',
  );
  await applyImport(page, name);
  expect(await readStoredSettings(page)).toEqual({ theme: 'dark' });
  await expect(page.locator('html')).toHaveClass(DARK);
  await expect.poll(() => codeFontSizeProperty(page)).toBe('14px');

  await gotoSettings(page);
  await expect(themeRadio(page, 'Dark')).toBeChecked();
  expect((await vimrcField(page).inputValue()).trimEnd()).toBe(
    specShippedVimrc(),
  );
  await expect(compilerField(page)).toHaveValue('');
  await expect(fontSizeInput(page)).toHaveValue('14');

  // /repl: the §2 defaults (a known error first, so 1 → 0 proves INDEXED's lint ran) and the
  // shipped vimrc's jk.
  await gotoRepl(page);
  await waitForCompilerReady(page);
  await setDoc(page, 'const s: string = 1;\n');
  await expect(problems(page)).toHaveCount(1);
  await setDoc(page, INDEXED);
  await expect(
    problems(page),
    'INDEXED is clean without the defaults',
  ).toHaveCount(0);
  await setDoc(page, 'abc');
  await press(page, 'A');
  await type(page, 'jk');
  const s = await snapshot(page);
  expect(s.mode, 'the shipped jk').toBe('normal');
  expect(s.doc).toBe('abc');
});
