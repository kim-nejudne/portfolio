// `:set rnu / nornu / nu / wrap / nowrap / bg=dark / bg=light` (§4 Ex commands: "editor and
// theme options; persisted"). The engine's own `:set` parses the line and calls the option's
// callback; the callbacks here reconfigure the mounted editor's compartments (line numbers,
// relative or not; wrapping) and write the §7 settings object, and `bg=` writes `theme`, which
// src/app/theme.ts follows. A vimrc `set rnu` or the stored settings are applied through
// `applyOptionsSilently`, which does not persist; only an interactive `:set` does.
import { Compartment, type Extension } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { Vim } from '@replit/codemirror-vim';
import { readSettings, writeSettings, type Settings } from '@/store/settings';
import { parseBackground } from './ex-commands';
import { notifyCm } from './notify';

export interface EditorOptions {
  relativeNumbers: boolean;
  lineNumbers: boolean;
  wrap: boolean;
}

/** The option values in force; every file state of the mounted editor is kept in sync with them. */
export const editorOptions: EditorOptions = {
  relativeNumbers: false,
  lineNumbers: true,
  wrap: false,
};

/** Shared by every file state of the one editor on a page; `applyOptions` reconfigures them. */
export const optionCompartments = {
  lineNumbers: new Compartment(),
  wrap: new Compartment(),
};

let mountedView: EditorView | null = null;
let silent = 0;

export function setOptionsView(view: EditorView | null): void {
  mountedView = view;
}

/** `rnu`: the current line keeps its absolute number, the others show their distance. */
export function relativeNumber(lineNo: number, current: number): string {
  return lineNo === current
    ? String(lineNo)
    : String(Math.abs(lineNo - current));
}

/** The line-number gutter for the options in force, or nothing when `nu` is off. */
export function gutterExtension(): Extension {
  if (!editorOptions.lineNumbers) return [];
  if (!editorOptions.relativeNumbers) return lineNumbers();
  return [
    lineNumbers({
      formatNumber: (lineNo, state) =>
        relativeNumber(
          lineNo,
          state.doc.lineAt(state.selection.main.head).number,
        ),
    }),
    // The gutter re-renders its numbers when its config changes, not when the cursor moves,
    // so a cursor move reconfigures the compartment with a fresh gutter (docs/prep-vim.md).
    EditorView.updateListener.of((update) => {
      if (update.selectionSet && !update.docChanged) {
        queueMicrotask(() => {
          if (!editorOptions.relativeNumbers) return;
          update.view.dispatch({
            effects:
              optionCompartments.lineNumbers.reconfigure(gutterExtension()),
          });
        });
      }
    }),
  ];
}

export function wrapExtension(): Extension {
  return editorOptions.wrap ? EditorView.lineWrapping : [];
}

/** The compartments' contents for a fresh file state. */
export function optionExtensions(): Extension {
  return [
    optionCompartments.lineNumbers.of(gutterExtension()),
    optionCompartments.wrap.of(wrapExtension()),
  ];
}

/** Brings the mounted editor's current state in line with `editorOptions`. */
export function applyOptions(view: EditorView | null = mountedView): void {
  view?.dispatch({
    effects: [
      optionCompartments.lineNumbers.reconfigure(gutterExtension()),
      optionCompartments.wrap.reconfigure(wrapExtension()),
    ],
  });
}

function set(name: keyof EditorOptions, value: boolean): void {
  editorOptions[name] = value;
  applyOptions();
  if (silent === 0) writeSettings({ [name]: value });
}

/** Applies stored or vimrc values without persisting them. */
export function applyOptionsSilently(
  values: Partial<EditorOptions>,
  view: EditorView | null = mountedView,
): void {
  silent += 1;
  try {
    Object.assign(editorOptions, values);
    applyOptions(view);
  } finally {
    silent -= 1;
  }
}

/** Runs `fn` with `:set` persistence off (the vimrc's own `set` lines). */
export function withoutPersisting(fn: () => void): void {
  silent += 1;
  try {
    fn();
  } finally {
    silent -= 1;
  }
}

/** The stored §7 values as option values. */
export function optionsFromSettings(
  settings: Settings,
): Partial<EditorOptions> {
  const values: Partial<EditorOptions> = {};
  if (settings.relativeNumbers !== undefined)
    values.relativeNumbers = settings.relativeNumbers;
  if (settings.lineNumbers !== undefined)
    values.lineNumbers = settings.lineNumbers;
  if (settings.wrap !== undefined) values.wrap = settings.wrap;
  return values;
}

let defined = false;

/** `Vim.defineOption` for the four §4 options; once per page load. */
export function defineEditorOptions(): void {
  if (defined) return;
  defined = true;
  const boolean = (
    vimName: string,
    aliases: string[],
    name: keyof EditorOptions,
  ): void => {
    Vim.defineOption(vimName, undefined, 'boolean', aliases, (value, cm) => {
      // The engine calls once globally (cm undefined) and once per editor; act on the global call.
      if (cm !== undefined) return undefined;
      if (value === undefined) return editorOptions[name];
      set(name, value);
      return undefined;
    });
  };
  boolean('relativenumber', ['rnu'], 'relativeNumbers');
  boolean('number', ['nu'], 'lineNumbers');
  boolean('wrap', [], 'wrap');
  Vim.defineOption('background', undefined, 'string', ['bg'], (value, cm) => {
    const background = parseBackground(value);
    if (cm !== undefined) {
      // The per-editor call: the place to report a bad value, since the global call has no editor.
      if (value !== undefined && background === null) {
        notifyCm(cm, `bg takes dark or light, not "${String(value)}"`);
      }
      return undefined;
    }
    if (value === undefined) return readSettings(storage()).theme ?? 'system';
    if (background !== null && silent === 0) {
      writeSettings({ theme: background });
    }
    return undefined;
  });
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
