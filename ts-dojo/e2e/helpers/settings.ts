// Playwright helpers for F10, the Settings page (spec §7 Settings, §4 Mappings and the vimrc, §6
// Theme and type; src/pages/settings.tsx and src/pages/settings/*.tsx): the page's controls by
// role and label, a no-reload marker, keyboard-only ways to reach a control and replace its
// text, the computed code font size, a description of the focused control for Tab-order checks,
// the shipped vimrc read from docs/spec.md §4 at test time, the sandbox `run` messages a page
// posts, and the /progress export and import steps the settings tests share. Nothing here
// clicks; every wait is an `expect` or `expect.poll`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import {
  catchDownload,
  fileInput,
  importDialog,
  progressNotice,
  tabTo,
  type Downloaded,
} from './progress';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The §4 "Shipped defaults" vimrc block as docs/spec.md holds it (no trailing newline). */
export function specShippedVimrc(): string {
  const spec = readFileSync(`${REPO_ROOT}docs/spec.md`, 'utf8');
  const match = /Shipped defaults:\r?\n\r?\n```vim\r?\n([\s\S]*?)\r?\n```/.exec(
    spec,
  );
  if (match === null) throw new Error('docs/spec.md has no §4 shipped vimrc');
  return match[1] as string;
}

/** `/settings` with its heading rendered. */
export async function gotoSettings(page: Page): Promise<void> {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
}

// ---------------------------------------------------------------------------------------------
// Controls

export function themeRadio(
  page: Page,
  label: 'System' | 'Light' | 'Dark',
): Locator {
  return page.getByRole('radio', { name: label, exact: true });
}

export function relativeNumbersBox(page: Page): Locator {
  return page.getByRole('checkbox', { name: 'Relative line numbers' });
}

export function fontSizeInput(page: Page): Locator {
  return page.getByRole('spinbutton', { name: 'Font size (px)' });
}

export function timeoutInput(page: Page): Locator {
  return page.getByRole('spinbutton', { name: 'Default timeout (ms)' });
}

export function vimrcField(page: Page): Locator {
  return page.getByRole('textbox', { name: 'vimrc', exact: true });
}

export function compilerField(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Compiler defaults', exact: true });
}

export function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

export function vimrcProblems(page: Page): Locator {
  return page.locator('ul[aria-label="vimrc problems"] li');
}

export function compilerProblems(page: Page): Locator {
  return page.locator('ul[aria-label="compiler defaults problems"] li');
}

export function vimrcStatus(page: Page): Locator {
  return page.getByRole('status', { name: 'vimrc status' });
}

export function compilerStatus(page: Page): Locator {
  return page.getByRole('status', { name: 'compiler defaults status' });
}

/** The editor's own vimrc line under the editor (src/editor/editor.tsx). */
export function editorVimrcStatus(page: Page): Locator {
  return page.getByRole('status', { name: 'vimrc', exact: true });
}

// ---------------------------------------------------------------------------------------------
// Keyboard

/** Tab to the field, select all of it and type `text` in its place. */
export async function replaceText(
  page: Page,
  field: Locator,
  text: string,
): Promise<void> {
  await tabTo(page, field);
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text);
  await expect(field).toHaveValue(text);
}

/**
 * Presses `key` until `target` has the focus. After a client-side navigation the new page's
 * key listener (src/app/use-page-keys.ts) is attached in an effect, a moment after its heading
 * renders; a key pressed in between is dropped, never handled later, so pressing again cannot
 * skip past the target. A press that was handled but moved the focus elsewhere fails.
 */
export async function pressUntilFocused(
  page: Page,
  key: string,
  target: Locator,
): Promise<void> {
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(target).toBeFocused({ timeout: 500 });
  }).toPass({ timeout: 5000 });
}

/**
 * What has the focus, for Tab-order checks: `#id` for a control with an id, `radio <value>`,
 * `checkbox <label>`, `<tag> <text>` for a link or button, `body` for nothing.
 */
export async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (active === null || active === document.body) return 'body';
    if (active instanceof HTMLInputElement && active.type === 'radio') {
      return `radio ${active.value}`;
    }
    if (active instanceof HTMLInputElement && active.type === 'checkbox') {
      return `checkbox ${active.labels?.[0]?.textContent?.trim() ?? ''}`;
    }
    if (active.id !== '') return `#${active.id}`;
    return `${active.tagName.toLowerCase()} ${active.textContent?.trim() ?? ''}`;
  });
}

/** Presses Tab `count` times and returns what had the focus after each press. */
export async function tabStops(page: Page, count: number): Promise<string[]> {
  const stops: string[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press('Tab');
    stops.push(await describeFocus(page));
  }
  return stops;
}

// ---------------------------------------------------------------------------------------------
// Effects

/** The element's computed `font-size` (`20px`). */
export async function computedFontSize(target: Locator): Promise<string> {
  return target.evaluate((element) => getComputedStyle(element).fontSize);
}

/** `--code-font-size` as src/app/font-size.ts sets it on <html>'s style. */
export async function codeFontSizeProperty(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--code-font-size'),
  );
}

export async function htmlIsDark(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  );
}

// ---------------------------------------------------------------------------------------------
// No reload

/** Sets a marker on the window; a reload or a full navigation loses it. */
export async function markNoReload(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __noReload?: boolean }).__noReload = true;
  });
}

export async function expectNoReload(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => (window as unknown as { __noReload?: boolean }).__noReload === true,
    ),
    'the window marker survived: the page was not reloaded',
  ).toBe(true);
}

// ---------------------------------------------------------------------------------------------
// The sandbox's `run` messages

export interface RecordedRun {
  timeoutMs: unknown;
  entry: unknown;
}

/**
 * Before any page script: wraps `Worker.prototype.postMessage` so every message whose `type` is
 * `'run'` (src/workers/sandbox/runner.ts, one per Run, `:w` or `:test`) is recorded with its
 * `timeoutMs` and `entry`. Read them with `recordedRuns`.
 */
export async function recordRunMessages(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const runs: { timeoutMs: unknown; entry: unknown }[] = [];
    (window as unknown as { __runMessages: typeof runs }).__runMessages = runs;
    const original = Object.getOwnPropertyDescriptor(
      Worker.prototype,
      'postMessage',
    )?.value as (this: Worker, ...args: unknown[]) => void;
    Worker.prototype.postMessage = function (
      this: Worker,
      message: unknown,
      ...rest: unknown[]
    ) {
      if (
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: unknown }).type === 'run'
      ) {
        const { timeoutMs, entry } = message as {
          timeoutMs: unknown;
          entry: unknown;
        };
        runs.push({ timeoutMs, entry });
      }
      original.apply(this, [message, ...rest]);
    } as Worker['postMessage'];
  });
}

export async function recordedRuns(page: Page): Promise<RecordedRun[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __runMessages?: RecordedRun[] }).__runMessages ??
      [],
  );
}

// ---------------------------------------------------------------------------------------------
// /progress export and import

/** On /progress: the file the Export button downloads, pressed from the keyboard. */
export async function exportFromProgress(page: Page): Promise<Downloaded> {
  return catchDownload(page, async () => {
    await tabTo(page, page.getByRole('button', { name: 'Export progress' }));
    await page.keyboard.press('Enter');
  });
}

/** On /progress: `json` chosen as the file to import, through the file input (no picker). */
export async function chooseImportFile(
  page: Page,
  name: string,
  json: unknown,
): Promise<void> {
  await fileInput(page).setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(typeof json === 'string' ? json : JSON.stringify(json)),
  });
}

/** The import preview's settings line (`theme, vimrc changed`, `no change`). */
export function settingsLine(page: Page): Locator {
  return importDialog(page).locator(
    '[data-category="settings"] [data-field="change"]',
  );
}

/** In the open import preview: Cancel has the focus; Tab to Apply, Enter, and wait for the notice. */
export async function applyImport(page: Page, name: string): Promise<void> {
  const dialog = importDialog(page);
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(progressNotice(page)).toHaveText(`imported ${name}`);
}
