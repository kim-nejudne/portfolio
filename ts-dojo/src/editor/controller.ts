// The editor behind the React component: one EditorView, one EditorState per project file
// (its own history and cursor), switched with `view.setState` for `:b`, `gt`, `gd` and the
// tabs; the project opened in ts-ls and every edit sent as `updateFile` (§2); the vimrc applied
// at creation and whenever the setting changes (§4); every ex command dispatched here (§4), the
// editor's own handled, the rest handed to the page's `EditorHost`. Nothing React in this file.
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { getCM, Vim, type CodeMirrorV } from '@replit/codemirror-vim';
import type { CompilerOptionsJson, Diag } from '@/protocol/ts-ls';
import {
  browserStorage,
  readSettings,
  subscribeSettings,
} from '@/store/settings';
import type { TsLsClient } from '@/workers/ts-ls/client';
import { cycleBuffer, listBuffers, resolveBuffer } from './buffers';
import { completions } from './completions';
import { describeOutside, pickDefinition } from './definition';
import { moveToDiagnostic, tsDiagnostics } from './diagnostics';
import { registerExCommands } from './ex-commands';
import { fileExtensions, sharedExtensions } from './extensions';
import {
  isEditorOwnAction,
  type EditorAction,
  type EditorFile,
  type EditorHost,
} from './host';
import { notify } from './notify';
import {
  applyOptionsSilently,
  defineEditorOptions,
  optionsFromSettings,
  setOptionsView,
  withoutPersisting,
} from './options';
import { quickInfo, showQuickInfoAtCursor } from './quick-info';
import {
  getActiveEditor,
  setActiveEditor,
  type EditorHandle,
} from './registry';
import { signatureHelp } from './signature-help';
import { twoslash } from './twoslash';
import { defineVimDefaults, vimDefaultMappings } from './vim-defaults';
import {
  applyVimrc,
  formatVimrcError,
  parseVimrc,
  SHIPPED_VIMRC,
  type VimrcError,
} from './vimrc';

export type { EditorFile } from './host';

export interface ControllerOptions {
  parent: HTMLElement;
  files: EditorFile[];
  /** The file `:w` runs; absent on `/repl`, where it is the current buffer. */
  entry?: string;
  /** The file opened first; `files[0]` when absent (`/repl` opens the last buffer). */
  initial?: string;
  compiler: TsLsClient;
  host: () => EditorHost;
  compilerOptions?: CompilerOptionsJson;
  libs?: string[];
  onFileChange: (path: string) => void;
  /** The file set changed (`/repl`'s `:e` and `:bd`): the tabs re-render from it. */
  onFilesChange?: (files: readonly EditorFile[]) => void;
  onVimrcErrors: (errors: VimrcError[]) => void;
  onChange?: (path: string, text: string) => void;
  onDiagnostics?: (diagnostics: Diag[]) => void;
  openPalette: () => void;
}

export interface EditorController extends EditorHandle {
  destroy(): void;
}

let exCommandsRegistered = false;

/** The §4 ex commands, engine-global, dispatching to the mounted editor. */
function ensureExCommands(): void {
  if (exCommandsRegistered) return;
  exCommandsRegistered = true;
  registerExCommands(
    (name, prefix, fn) => {
      Vim.defineEx(name, prefix, fn);
    },
    (action) => getActiveEditor()?.dispatch(action),
    (message) => getActiveEditor()?.notify(message),
  );
}

export function createEditorController(
  options: ControllerOptions,
): EditorController {
  const { compiler } = options;
  // The file set is fixed on a lesson page (§4) and live on /repl (`:e`, `:bd`), so these are
  // recomputed by `recompute` and read through closures everywhere below.
  let files: EditorFile[] = options.files.map((f) => ({ ...f }));
  let paths: string[] = [];
  const readOnly = new Set<string>();
  let editable: string[] = [];
  const recompute = (): void => {
    paths = files.map((f) => f.path);
    readOnly.clear();
    for (const f of files) if (f.readOnly === true) readOnly.add(f.path);
    editable = paths.filter((p) => !readOnly.has(p));
  };
  recompute();
  const states = new Map<string, EditorState>();
  let current =
    options.initial !== undefined && paths.includes(options.initial)
      ? options.initial
      : (paths[0] ?? '');
  let readOnlyNoticeAt = 0;
  // The buffer before the current one (Vim's alternate buffer): where `:bd` returns to.
  let previous: string | null = null;

  defineVimDefaults();
  defineEditorOptions();
  ensureExCommands();

  const shared = sharedExtensions([
    // First, so every request the listeners below make follows the edit into the worker.
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const path = current;
      const text = update.state.doc.toString();
      compiler.updateFile(path, text);
      options.onChange?.(path, text);
    }),
    tsDiagnostics({
      compiler,
      paths: () => editable,
      ...(options.onDiagnostics !== undefined
        ? { onDiagnostics: options.onDiagnostics }
        : {}),
    }),
    twoslash(),
    quickInfo(compiler),
    completions(compiler, { openPalette: options.openPalette }),
    signatureHelp(compiler),
  ]);

  const stateFor = (file: EditorFile): EditorState =>
    EditorState.create({
      doc: file.text,
      extensions: [
        shared,
        fileExtensions({
          path: file.path,
          readOnly: file.readOnly === true,
          onReadOnlyEdit: () => {
            const now = Date.now();
            if (now - readOnlyNoticeAt < 1000) return;
            readOnlyNoticeAt = now;
            handle.notify(`${file.path.slice(1)} is read-only`);
          },
        }),
      ],
    });
  for (const file of options.files) states.set(file.path, stateFor(file));

  const first = states.get(current);
  if (first === undefined)
    throw new Error('the editor needs at least one file');
  const view = new EditorView({ state: first, parent: options.parent });
  setOptionsView(view);

  const textOf = (path: string): string =>
    (path === current ? view.state : states.get(path))?.doc.toString() ?? '';

  // §2: the project opened at once; the worker queues it behind `init` when not ready yet.
  // Opened again with the live texts when the file set changes: the protocol has no add or
  // remove, and `openProject` reuses the parsed libs through the worker's registry.
  const openProject = (): void => {
    compiler.openProject({
      files: files
        .filter((f) => f.readOnly !== true)
        .map((f) => ({ path: f.path, text: textOf(f.path) })),
      dtsFiles: files
        .filter((f) => f.readOnly === true)
        .map((f) => ({ path: f.path, text: textOf(f.path) })),
      ...(options.compilerOptions !== undefined
        ? { compilerOptions: options.compilerOptions }
        : {}),
      ...(options.libs !== undefined ? { libs: options.libs } : {}),
    });
  };
  openProject();

  const leaveModes = (): void => {
    const cm = getCM(view);
    if (cm === null) return;
    const editor = cm as CodeMirrorV;
    if (cm.state.vim?.visualMode) Vim.exitVisualMode(editor);
    if (cm.state.vim?.insertMode) Vim.exitInsertMode(editor);
  };

  const openFile = (path: string, offset?: number): boolean => {
    const target = states.get(path);
    if (target === undefined) return false;
    if (path !== current) {
      leaveModes();
      states.set(current, view.state);
      view.setState(target);
      previous = current;
      current = path;
      applyOptionsSilently({}, view);
      options.onFileChange(path);
      if (readOnly.has(path)) {
        queueMicrotask(() => handle.notify(`${path.slice(1)} is read-only`));
      }
    }
    if (offset !== undefined) {
      const anchor = Math.min(offset, view.state.doc.length);
      view.dispatch({ selection: { anchor }, scrollIntoView: true });
    }
    view.focus();
    return true;
  };

  const openFileAt = (path: string, line: number, column: number): boolean => {
    if (!states.has(path)) return false;
    openFile(path);
    const doc = view.state.doc;
    const target = doc.line(Math.min(Math.max(line, 1), doc.lines));
    const anchor = Math.min(target.from + Math.max(column - 1, 0), target.to);
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
    view.focus();
    return true;
  };

  const filesChanged = (): void => {
    recompute();
    openProject();
    options.onFilesChange?.(files.map((f) => ({ ...f })));
  };

  const addFile = (file: EditorFile, index?: number): boolean => {
    if (states.has(file.path)) return false;
    states.set(file.path, stateFor(file));
    const at =
      index === undefined
        ? files.length
        : Math.max(0, Math.min(index, files.length));
    files = [...files.slice(0, at), { ...file }, ...files.slice(at)];
    filesChanged();
    return true;
  };

  const removeFile = (path: string): boolean => {
    if (!states.has(path) || files.length === 1) return false;
    if (path === current) {
      // Back to the buffer this one was opened from, as Vim does; else the next one.
      const alternate =
        previous !== null && previous !== path && states.has(previous)
          ? previous
          : cycleBuffer(path, paths, 1);
      if (alternate === null || alternate === path) return false;
      openFile(alternate);
    }
    if (previous === path) previous = null;
    states.delete(path);
    files = files.filter((f) => f.path !== path);
    filesChanged();
    return true;
  };

  // An ex command runs inside the engine's key handling (a `gt` mapping feeds `:bnext<CR>` key
  // by key and closes the prompt afterwards); replacing the state under it breaks that, so a
  // switch asked for by a command happens once the engine is done.
  const switchLater = (target: () => string | null): void => {
    queueMicrotask(() => {
      const path = target();
      if (path !== null) openFile(path);
    });
  };

  const run = async (): Promise<void> => {
    try {
      const entry = options.entry ?? current;
      const modules = await compiler.emit(editable);
      options.host().run(modules, entry);
    } catch (error) {
      handle.notify(
        `:w could not transpile: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const goToDefinition = async (): Promise<void> => {
    const pos = view.state.selection.main.head;
    let locations;
    try {
      locations = await compiler.getDefinition(current, pos);
    } catch {
      return;
    }
    const target = pickDefinition(locations, paths);
    switch (target.kind) {
      case 'open':
        openFile(target.path, target.offset);
        break;
      case 'outside':
        handle.notify(describeOutside(target.path));
        break;
      case 'none':
        handle.notify('no definition found');
        break;
    }
  };

  const dispatch = (action: EditorAction): void => {
    if (!isEditorOwnAction(action)) {
      if (action.type === 'run') void run();
      // After the engine's own handling: it re-focuses the editor when the `:` prompt closes,
      // which would undo a host's focus move made synchronously here.
      else queueMicrotask(() => options.host().action(action));
      return;
    }
    switch (action.type) {
      case 'buffer': {
        const path = resolveBuffer(action.name, paths);
        if (path === null) handle.notify(`no file named ${action.name}`);
        else switchLater(() => path);
        break;
      }
      case 'buffers':
        handle.notify(listBuffers(paths, current, readOnly));
        break;
      case 'bnext':
      case 'bprev': {
        switchLater(() =>
          cycleBuffer(current, paths, action.type === 'bnext' ? 1 : -1),
        );
        break;
      }
      case 'dnext':
        if (!moveToDiagnostic(view, 1)) handle.notify('no diagnostics');
        break;
      case 'dprev':
        if (!moveToDiagnostic(view, -1)) handle.notify('no diagnostics');
        break;
      case 'info':
        void showQuickInfoAtCursor(view, compiler).then((info) => {
          if (info === null) handle.notify('nothing to show here');
        });
        break;
      case 'def':
        void goToDefinition();
        break;
    }
  };

  // The vimrc (§4): applied now and again whenever the setting changes.
  let appliedVimrc: string | null = null;
  const applyVimrcText = (text: string): void => {
    appliedVimrc = text;
    let errors: VimrcError[] = [];
    withoutPersisting(() => {
      errors = applyVimrc(parseVimrc(text), Vim, vimDefaultMappings);
    });
    // Kim's stored `:set` choices come after the vimrc's own `set` lines (§4: persisted).
    applyOptionsSilently(
      optionsFromSettings(readSettings(browserStorage())),
      view,
    );
    options.onVimrcErrors(errors);
    if (errors.length > 0) {
      notify(view, errors.map(formatVimrcError).join('\n'), 8000);
    }
  };
  const vimrcOf = (settings: { vimrc?: string }): string =>
    settings.vimrc ?? SHIPPED_VIMRC;
  const unsubscribe = subscribeSettings((settings) => {
    const text = vimrcOf(settings);
    if (text !== appliedVimrc) applyVimrcText(text);
  });

  const handle: EditorController = {
    get view() {
      return view;
    },
    get cm() {
      return getCM(view);
    },
    get currentPath() {
      return current;
    },
    get paths() {
      return paths;
    },
    get files() {
      return files;
    },
    text: textOf,
    addFile,
    removeFile,
    dispatch,
    runEx(input) {
      const cm = getCM(view);
      if (cm === null) return;
      view.focus();
      Vim.handleEx(cm as CodeMirrorV, input);
    },
    prefillEx(prefix) {
      const cm = getCM(view);
      if (cm === null) return;
      view.focus();
      Vim.handleKey(cm, ':', 'user');
      const input = view.dom.querySelector<HTMLInputElement>(
        '.cm-vim-panel input',
      );
      if (input !== null) {
        input.value = prefix;
        input.focus();
      }
    },
    openFile,
    openFileAt,
    focus() {
      view.focus();
    },
    notify(text) {
      notify(view, text);
    },
    destroy() {
      unsubscribe();
      if (getActiveEditor() === handle) setActiveEditor(null, Vim);
      setOptionsView(null);
      view.destroy();
    },
  };

  setActiveEditor(handle, Vim);
  applyVimrcText(vimrcOf(readSettings(browserStorage())));
  return handle;
}
