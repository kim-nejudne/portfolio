// §12 F3: "`"+y` and `"+p` use the system clipboard over HTTPS and on localhost." The localhost
// half, in Chrome with the clipboard permissions playwright.config.ts grants: a `"+yy` lands
// in `navigator.clipboard` with its trailing newline, `"*` is the same register (the
// starRegister default), and `"+p` pastes what another app put there, as a line when the
// text ends in a newline and inline otherwise (the clipboardPaste default from Prep). The
// HTTPS half is Kim's check on the droplet. Keyboard only; the clipboard is read and written
// through `page.evaluate`.
import { expect, test } from '@playwright/test';
import {
  cursor,
  gotoRepl,
  lines,
  press,
  readClipboard,
  setDoc,
  snapshot,
  writeClipboard,
} from './helpers/editor';

const DOC = lines('first line', 'second line', 'third line');

test.beforeEach(async ({ page }) => {
  await gotoRepl(page);
  await writeClipboard(page, 'untouched');
});

test('"+yy on line 1 writes the line, with its newline, to the system clipboard', async ({
  page,
}) => {
  await setDoc(page, DOC);
  await press(page, '"+yy');
  await expect.poll(() => readClipboard(page)).toBe('first line\n');
  expect((await snapshot(page)).doc).toBe(DOC);
});

test('"*yy writes the system clipboard too (the * register is the + register)', async ({
  page,
}) => {
  await setDoc(page, DOC, { line: 2, col: 0 });
  await press(page, '"*yy');
  await expect.poll(() => readClipboard(page)).toBe('second line\n');
  await setDoc(page, 'gamma delta');
  await press(page, 'v$"*y');
  await expect.poll(() => readClipboard(page)).toBe('gamma delta');
  expect((await snapshot(page)).mode).toBe('normal');
});

test('"+y with a motion and from visual mode writes charwise text', async ({
  page,
}) => {
  await setDoc(page, 'alpha beta');
  await press(page, '"+yw');
  await expect.poll(() => readClipboard(page)).toBe('alpha ');
  await setDoc(page, 'gamma delta');
  await press(page, 'v$"+y');
  await expect.poll(() => readClipboard(page)).toBe('gamma delta');
  expect((await snapshot(page)).mode).toBe('normal');
});

test('"+p pastes clipboard text that ends in a newline as its own line below', async ({
  page,
}) => {
  await setDoc(page, DOC, { line: 1, col: 3 });
  await writeClipboard(page, 'from outside\n');
  await press(page, '"+p');
  await expect
    .poll(async () => (await snapshot(page)).doc)
    .toBe(lines('first line', 'from outside', 'second line', 'third line'));
  expect(await cursor(page)).toEqual([2, 0]);
});

test('"+p pastes clipboard text without a newline inline after the cursor', async ({
  page,
}) => {
  await setDoc(page, DOC, { line: 1, col: 4 });
  await writeClipboard(page, 'inline');
  await press(page, '"+p');
  await expect
    .poll(async () => (await snapshot(page)).doc)
    .toBe(lines('firstinline line', 'second line', 'third line'));
});

test('"+p after a "+yy still pastes charwise clipboard text inline and whole (the Prep fix)', async ({
  page,
}) => {
  await setDoc(page, lines('one', 'two'));
  await press(page, 'j"+yy');
  await expect.poll(() => readClipboard(page)).toBe('two\n');
  await writeClipboard(page, 'pasted');
  await press(page, '"+p');
  await expect
    .poll(async () => (await snapshot(page)).doc)
    .toBe(lines('one', 'tpastedwo'));
  await writeClipboard(page, 'full line\n');
  await press(page, '"+p');
  await expect
    .poll(async () => (await snapshot(page)).doc)
    .toBe(lines('one', 'tpastedwo', 'full line'));
  // The ordinary registers are untouched by the redefinition.
  await setDoc(page, lines('one', 'two'));
  await press(page, 'yyjp');
  expect((await snapshot(page)).doc).toBe(lines('one', 'two', 'one'));
  await press(page, '"ayw$"ap');
  expect((await snapshot(page)).doc).toBe(lines('one', 'two', 'oneone'));
});

test('"*p reads the system clipboard too', async ({ page }) => {
  await setDoc(page, 'x');
  await writeClipboard(page, 'star');
  await press(page, '"*p');
  await expect.poll(async () => (await snapshot(page)).doc).toBe('xstar');
});
