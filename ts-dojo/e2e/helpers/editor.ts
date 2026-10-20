// Playwright helpers for the editor on /repl (the Prep spike's spike/vim/helpers.ts, ported to
// the `window.__tsDojo` seam of src/editor/registry.ts): Vim key notation in, real key presses
// out, and a snapshot of the editor and Vim state read back from the live view. Nothing here
// clicks; focus is taken through the seam and asserted on `.cm-content`. Every wait is an
// `expect` or a `waitForFunction`; there are no fixed sleeps.
import { expect, type Page } from '@playwright/test';
import type { CodeMirrorV } from '@replit/codemirror-vim';
import type { TsDojoAppSeam } from '../../src/app/seam';
import type { TsDojoSeam } from '../../src/editor/registry';

/** The seams the app publishes (importing the types also declares `window.__tsDojo` and `window.__tsDojoApp`). */
export type Seam = TsDojoSeam;
export type AppSeam = TsDojoAppSeam;

export const TS_VERSION = '6.0.3';
export const SETTINGS_KEY = 'ts-dojo:settings';

const NAMED: Record<string, string> = {
  Esc: 'Escape',
  CR: 'Enter',
  BS: 'Backspace',
  Space: 'Space',
  Tab: 'Tab',
  Del: 'Delete',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
};
const MODIFIERS: Record<string, string> = {
  C: 'Control',
  S: 'Shift',
  A: 'Alt',
};
/** Characters Playwright's `press` would read as a chord separator. */
const CHARACTERS: Record<string, string> = { '+': 'Shift+Equal' };

/** `dw<Esc>` → ['d', 'w', 'Escape']; `<C-d>` → 'Control+d'; `<S-Tab>` → 'Shift+Tab'. */
export function toPlaywrightKeys(sequence: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < sequence.length; i += 1) {
    const char = sequence[i] as string;
    if (char === '<') {
      const end = sequence.indexOf('>', i);
      const name = end === -1 ? '' : sequence.slice(i + 1, end);
      const chord = /^([CSA])-(.+)$/.exec(name);
      if (chord) {
        const key = chord[2] as string;
        keys.push(`${MODIFIERS[chord[1] as string]}+${NAMED[key] ?? key}`);
        i = end;
        continue;
      }
      const named = NAMED[name];
      if (named !== undefined) {
        keys.push(named);
        i = end;
        continue;
      }
    }
    keys.push(CHARACTERS[char] ?? char);
  }
  return keys;
}

export async function press(page: Page, sequence: string): Promise<void> {
  for (const key of toPlaywrightKeys(sequence)) await page.keyboard.press(key);
}

/** Type literal text (insert mode, or the `:` and `/` prompts). */
export async function type(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
}

/** `:` prompt → command → Enter. */
export async function ex(page: Page, command: string): Promise<void> {
  await press(page, ':');
  await expect(page.locator('.cm-vim-panel input')).toBeFocused();
  await type(page, command);
  await press(page, '<CR>');
}

export interface Snapshot {
  doc: string;
  /** 1-based line and 0-based column of the cursor (selection head). */
  line: number;
  col: number;
  anchorLine: number;
  anchorCol: number;
  mode:
    'normal' | 'insert' | 'replace' | 'visual' | 'visual-line' | 'visual-block';
  /** The engine's own mode name. */
  engineMode: string;
  /** The vim status panel's text (`--NORMAL--`, or the last notification). */
  status: string;
  /** Search highlight marks in the DOM. */
  matches: number;
  folds: number;
  gutter: string[];
  scrollTop: number;
  wrapping: boolean;
  /** How many whole lines fit in the editor's scroller. */
  visibleLines: number;
  lineHeight: number;
  path: string;
}

export async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const seam = window.__tsDojo;
    if (seam === undefined) throw new Error('window.__tsDojo is not set');
    const { view, cm } = seam.editor;
    const vim = cm?.state.vim;
    if (!cm || !vim) throw new Error('the editor has no vim state');
    const { head, anchor } = view.state.selection.main;
    const headLine = view.state.doc.lineAt(head);
    const anchorLine = view.state.doc.lineAt(anchor);
    const overwrite = (cm.state as { overwrite?: boolean }).overwrite === true;
    let mode: Snapshot['mode'] = 'normal';
    if (vim.insertMode) mode = overwrite ? 'replace' : 'insert';
    else if (vim.visualMode)
      mode = vim.visualBlock
        ? 'visual-block'
        : vim.visualLine
          ? 'visual-line'
          : 'visual';
    const gutter = [
      ...document.querySelectorAll('.cm-lineNumbers .cm-gutterElement'),
    ]
      .filter(
        (element) => (element as HTMLElement).style.visibility !== 'hidden',
      )
      .map((element) => element.textContent?.trim() ?? '')
      .filter((text) => text !== '');
    return {
      doc: view.state.doc.toString(),
      line: headLine.number,
      col: head - headLine.from,
      anchorLine: anchorLine.number,
      anchorCol: anchor - anchorLine.from,
      mode,
      engineMode: vim.mode ?? '',
      status:
        document.querySelector('.cm-vim-panel')?.textContent?.trim() ?? '',
      matches: document.querySelectorAll('.cm-searchMatch').length,
      folds: document.querySelectorAll('.cm-foldPlaceholder').length,
      gutter,
      scrollTop: view.scrollDOM.scrollTop,
      wrapping: view.lineWrapping,
      visibleLines: Math.floor(
        view.scrollDOM.clientHeight / view.defaultLineHeight,
      ),
      lineHeight: view.defaultLineHeight,
      path: seam.editor.currentPath,
    };
  });
}

/** Resolves once the editor controller has published the seam. */
export async function waitForEditor(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__tsDojo !== undefined);
}

/** Replace the document, leave any mode, put the cursor at a 1-based line and 0-based column, focus the editor. */
export async function setDoc(
  page: Page,
  text: string,
  at: { line: number; col: number } = { line: 1, col: 0 },
): Promise<void> {
  await waitForEditor(page);
  await page.evaluate(
    ({ text, at }) => {
      const seam = window.__tsDojo;
      if (seam === undefined) throw new Error('window.__tsDojo is not set');
      const { view, cm } = seam.editor;
      const { Vim } = seam;
      const vim = cm?.state.vim;
      if (!cm || !vim) throw new Error('the editor has no vim state');
      const editor = cm as CodeMirrorV;
      if (vim.visualMode) Vim.exitVisualMode(editor);
      if (vim.insertMode) Vim.exitInsertMode(editor);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      });
      const line = view.state.doc.line(at.line);
      view.dispatch({
        selection: { anchor: line.from + at.col },
        scrollIntoView: true,
      });
      view.focus();
    },
    { text, at },
  );
  await expect(page.locator('.cm-content')).toBeFocused();
}

export async function cursor(page: Page): Promise<[line: number, col: number]> {
  const s = await snapshot(page);
  return [s.line, s.col];
}

export async function currentPath(page: Page): Promise<string> {
  return page.evaluate(() => {
    const seam = window.__tsDojo;
    if (seam === undefined) throw new Error('window.__tsDojo is not set');
    return seam.editor.currentPath;
  });
}

/** Focus the editor through the seam (no mouse) and prove `.cm-content` has focus. */
export async function focusEditor(page: Page): Promise<void> {
  await waitForEditor(page);
  await page.evaluate(() => {
    window.__tsDojo?.editor.focus();
  });
  await expect(page.locator('.cm-content')).toBeFocused();
}

/** `/repl` with the editor mounted and focused in normal mode. */
export async function gotoRepl(page: Page): Promise<void> {
  await page.goto('/repl');
  await focusEditor(page);
  expect((await snapshot(page)).mode).toBe('normal');
}

/** The worker's `ready`, seen through the header chip (a cold worker takes a few seconds). */
export async function waitForCompilerReady(page: Page): Promise<void> {
  const chip = page.getByRole('status', { name: 'compiler status' });
  await expect(chip).toHaveText(`TypeScript ${TS_VERSION}`, {
    timeout: 15_000,
  });
  await expect(chip).toHaveAttribute('data-state', 'ready');
}

/** The Problems list under the editor on /repl: one `li` per diagnostic of every file. */
export function problems(page: Page) {
  return page.locator('[data-testid="problems"] li');
}

/** The Console tab's entries in the output pane: one `li` per console line, error or truncation. */
export function consoleEntries(page: Page) {
  return page.locator('[data-testid="console"] li');
}

/** The output pane's status line: `running`, `done in N ms`, `killed after 5 s`, `still running (1 timer)`. */
export function runStatus(page: Page) {
  return page.getByRole('status', { name: 'run status' });
}

/** The §4 output pane (a focus target with its own keys). */
export function outputPane(page: Page) {
  return page.locator('[data-pane="output"]');
}

export function vimPanel(page: Page) {
  return page.locator('.cm-vim-panel');
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

export async function writeClipboard(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
}

/** The stored §7 settings object, or null when nothing is stored. */
export async function readStoredSettings(
  page: Page,
): Promise<Record<string, unknown> | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
  }, SETTINGS_KEY);
}

export const lines = (...rows: string[]): string => rows.join('\n');

/** The file tabs above the editor (the §4 tabs; on /repl one per scratch buffer). */
export function fileTabs(page: Page) {
  return page.getByRole('tablist', { name: 'Files' }).getByRole('tab');
}

/** The §7 `buffers` row of that name, read from IndexedDB directly; null when absent. */
export async function readBuffer(
  page: Page,
  name: string,
): Promise<{ name: string; text: string; updatedAt: number } | null> {
  return page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('ts-dojo');
        open.onerror = () =>
          reject(open.error ?? new Error('indexedDB open failed'));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('buffers')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db
            .transaction('buffers')
            .objectStore('buffers')
            .get(name);
          get.onerror = () =>
            reject(get.error ?? new Error('indexedDB get failed'));
          get.onsuccess = () => {
            db.close();
            resolve(
              (get.result as
                | { name: string; text: string; updatedAt: number }
                | undefined) ?? null,
            );
          };
        };
      }),
    name,
  );
}

/** The names in the §7 `buffers` table, in key order. */
export async function bufferNames(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('ts-dojo');
        open.onerror = () =>
          reject(open.error ?? new Error('indexedDB open failed'));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('buffers')) {
            db.close();
            resolve([]);
            return;
          }
          const keys = db
            .transaction('buffers')
            .objectStore('buffers')
            .getAllKeys();
          keys.onerror = () =>
            reject(keys.error ?? new Error('indexedDB getAllKeys failed'));
          keys.onsuccess = () => {
            db.close();
            resolve(keys.result.map(String));
          };
        };
      }),
  );
}

/** The `value` of a §7 `meta` row (`lastBuffer`), or null. */
export async function readMeta(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (key) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('ts-dojo');
        open.onerror = () =>
          reject(open.error ?? new Error('indexedDB open failed'));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('meta')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction('meta').objectStore('meta').get(key);
          get.onerror = () =>
            reject(get.error ?? new Error('indexedDB get failed'));
          get.onsuccess = () => {
            db.close();
            resolve(
              (get.result as { value?: unknown } | undefined)?.value ?? null,
            );
          };
        };
      }),
    key,
  );
}

/** Open in REPL through the app seam (src/app/seam.ts), as F6's theory block button will. */
export async function openInRepl(
  page: Page,
  request: { snippet: string; name?: string },
): Promise<string> {
  await page.waitForFunction(() => window.__tsDojoApp !== undefined);
  return page.evaluate((request) => {
    const seam = window.__tsDojoApp;
    if (seam === undefined) throw new Error('window.__tsDojoApp is not set');
    return seam.openInRepl(request);
  }, request);
}

/**
 * CodeMirror ignores the completion keys for `interactionDelay` after a list opens (75 ms,
 * `COMPLETION_INTERACTION_DELAY_MS` in src/editor/completions.ts), so a key pressed at once on a
 * busy machine is dropped. Waits until the list is shown and that delay has passed.
 */
export async function waitForCompletionKeys(page: Page): Promise<void> {
  await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible();
  const shownBy = await page.evaluate(() => performance.now());
  await page.waitForFunction(
    (since) => performance.now() - since > 100,
    shownBy,
  );
}
