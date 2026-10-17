// Playwright helpers for the checklist: Vim key notation in, real key presses out, and a
// snapshot of the editor and Vim state read back from the page (see types.ts).
import type { Page } from '@playwright/test';
import type { CodeMirrorV } from '@replit/codemirror-vim';

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
  /** The engine's own mode name from its vim-mode-change event. */
  engineMode: string;
  /** The vim status panel's text. */
  status: string;
  /** Search highlight marks in the DOM. */
  matches: number;
  folds: number;
  gutter: string[];
  scrollTop: number;
  wrapping: boolean;
  writes: number;
}

export async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const { view, cm } = window.__spike;
    const vim = cm.state.vim;
    if (!vim) throw new Error('the editor has no vim state');
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
      folds: window.__spike.foldCount(),
      gutter: window.__spike.gutterNumbers(),
      scrollTop: view.scrollDOM.scrollTop,
      wrapping: view.lineWrapping,
      writes: window.__spike.writes,
    };
  });
}

/** Replace the document, leave any mode, put the cursor at a 1-based line and 0-based column, focus the editor. */
export async function setDoc(
  page: Page,
  text: string,
  at: { line: number; col: number } = { line: 1, col: 0 },
): Promise<void> {
  await page.evaluate(
    ({ text, at }) => {
      const { view, cm, Vim } = window.__spike;
      const vim = cm.state.vim;
      if (!vim) throw new Error('the editor has no vim state');
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
}

export async function cursor(page: Page): Promise<[line: number, col: number]> {
  const s = await snapshot(page);
  return [s.line, s.col];
}

export async function apply(
  page: Page,
  workaround: keyof Window['__spike']['workarounds'],
): Promise<void> {
  await page.evaluate((name) => {
    window.__spike.workarounds[name]();
    window.__spike.view.focus();
  }, workaround);
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

export async function writeClipboard(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
}

export const lines = (...rows: string[]): string => rows.join('\n');
