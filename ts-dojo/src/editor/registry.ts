// The one editor mounted on the page (§2: "one CodeMirror instance per page"). The ex commands
// are engine-global (`Vim.defineEx` once per page load), so they dispatch to whichever editor
// is mounted; the palette runs its commands through the same handle. `window.__tsDojo` is the
// Playwright seam, the Prep spike's `window.__spike` convention: tests read the document, the
// cursor and the Vim mode through the live view instead of scraping the DOM.
import type { EditorView } from '@codemirror/view';
import type { CodeMirror, Vim as VimApi } from '@replit/codemirror-vim';
import type { EditorAction, EditorFile } from './host';

export interface EditorHandle {
  readonly view: EditorView;
  readonly cm: CodeMirror | null;
  readonly currentPath: string;
  readonly paths: readonly string[];
  /** The live file set (`/repl`'s `:e` and `:bd` change it). */
  readonly files: readonly EditorFile[];
  /** A file's current text, edits included ('' for an unknown path): what `:test` verifies. */
  text(path: string): string;
  /** Adds a file (and its project entry) at `index`, or at the end; false when the path exists. */
  addFile(file: EditorFile, index?: number): boolean;
  /** Removes a file, switching away from it first; false for an unknown path or the last file. */
  removeFile(path: string): boolean;
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
