// What an ex command asks the app to do (spec §4 Ex commands). The editor parses the `:` line
// into one of these actions; the ones about the editor itself (buffers, diagnostics, quick
// info, definition) it handles, the rest go to the page that hosts it through `EditorHost`.
// F3 builds the table and the dispatch; the lesson page (F8), the sandbox (F4), verification
// (F7), the REPL buffers (F5) and the export (F9) fill the host methods they own.

/** The three §4 panes. `:practice` is the editor pane. */
export type Pane = 'theory' | 'editor' | 'output';
export type FocusDirection = 'left' | 'right' | 'up' | 'down';
export type LayoutMode = 'split' | 'theory' | 'practice';
export type Background = 'dark' | 'light';

export type HostAction =
  | { type: 'run' }
  | { type: 'test' }
  | { type: 'kill' }
  | { type: 'hint' }
  | { type: 'solution' }
  | { type: 'reset' }
  | { type: 'done' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'lesson'; direction: 'next' | 'prev' }
  | { type: 'roadmap' }
  | { type: 'focusPane'; pane: Pane }
  | { type: 'focusDirection'; direction: FocusDirection }
  | { type: 'layout'; mode: LayoutMode }
  | { type: 'prompt' }
  | { type: 'edit'; name: string }
  | { type: 'bdelete' }
  | { type: 'export' }
  | { type: 'help' }
  | { type: 'background'; value: Background };

/** Handled inside the editor component. */
export type EditorOwnAction =
  | { type: 'buffer'; name: string }
  | { type: 'buffers' }
  | { type: 'bnext' }
  | { type: 'bprev' }
  | { type: 'dnext' }
  | { type: 'dprev' }
  | { type: 'info' }
  | { type: 'def' };

export type EditorAction = HostAction | EditorOwnAction;

export const EDITOR_OWN_ACTIONS: ReadonlySet<EditorAction['type']> = new Set([
  'buffer',
  'buffers',
  'bnext',
  'bprev',
  'dnext',
  'dprev',
  'info',
  'def',
]);

export function isEditorOwnAction(
  action: EditorAction,
): action is EditorOwnAction {
  return EDITOR_OWN_ACTIONS.has(action.type);
}

/** One emitted module, what `:w` hands the host after `emit` (§2 `emit`, §4 `:w`). */
export interface RunModule {
  path: string;
  js: string;
}

/**
 * The page behind the editor. `run` receives the transpiled project; everything else is a
 * plain request. A host that cannot honour a request (no lesson on this page) says so in a
 * notification and returns.
 */
export interface EditorHost {
  run(modules: RunModule[], entry: string): void;
  action(action: HostAction): void;
}
