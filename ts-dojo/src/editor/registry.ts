// The one editor mounted on the page (§2: "one CodeMirror instance per page"). The ex commands
// are engine-global (`Vim.defineEx` once per page load), so they dispatch to whichever editor
// is mounted; the palette runs its commands through the same handle. `window.__tsDojo` is the
// Playwright seam, the Prep spike's `window.__spike` convention: tests read the document, the
// cursor and the Vim mode through the live view instead of scraping the DOM.
import type { EditorView } from '@codemirror/view';
import type { CodeMirror, Vim as VimApi } from '@replit/codemirror-vim';
import type { EditorAction } from './host';

export interface EditorHandle {
  readonly view: EditorView;
  readonly cm: CodeMirror | null;
  readonly currentPath: string;
  readonly paths: readonly string[];
  dispatch(action: EditorAction): void;
  /** Runs an ex line as if typed at the `:` prompt (`focus left`, `set rnu`). */
  runEx(input: string): void;
  /** Opens the `:` prompt with `prefix` already typed (`b `). */
  prefillEx(prefix: string): void;
  openFile(path: string, offset?: number): boolean;
  /** Opens the file with the cursor on a 1-based line and column (the output pane's `Enter`). */
  openFileAt(path: string, line: number, column: number): boolean;
  focus(): void;
  notify(text: string): void;
}

export interface TsDojoSeam {
  editor: EditorHandle;
  Vim: typeof VimApi;
}

declare global {
  interface Window {
    __tsDojo?: TsDojoSeam;
  }
}

let active: EditorHandle | null = null;

export function setActiveEditor(
  handle: EditorHandle | null,
  Vim: typeof VimApi,
): void {
  active = handle;
  if (typeof window === 'undefined') return;
  if (handle === null) delete window.__tsDojo;
  else window.__tsDojo = { editor: handle, Vim };
}

export function getActiveEditor(): EditorHandle | null {
  return active;
}
