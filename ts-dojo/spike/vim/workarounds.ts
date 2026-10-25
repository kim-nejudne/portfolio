// The definitions that close the §4 checklist's gaps, one function each, so the Playwright
// checklist applies exactly the code docs/prep-vim.md quotes and F3 can lift it unchanged.
import { deleteCharBackward } from '@codemirror/commands';
import {
  foldAll,
  foldCode,
  toggleFold,
  unfoldAll,
  unfoldCode,
} from '@codemirror/language';
import {
  Compartment,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { getCM, Vim } from '@replit/codemirror-vim';

/** The editor swaps these at runtime; the page creates the view with all three. */
export const compartments = {
  lineNumbers: new Compartment(),
  wrap: new Compartment(),
  insertKeys: new Compartment(),
};

/** Folding (§4 W): `zo zc za zR zM` as Vim actions over CodeMirror's fold commands; needs codeFolding() or foldGutter(). */
export function foldKeys(): void {
  const commands = {
    foldOpen: unfoldCode,
    foldClose: foldCode,
    foldToggle: toggleFold,
    foldOpenAll: unfoldAll,
    foldCloseAll: foldAll,
  };
  for (const [name, command] of Object.entries(commands)) {
    Vim.defineAction(name, (cm) => {
      command(cm.cm6 as EditorView);
    });
  }
  const keys: [string, keyof typeof commands][] = [
    ['zo', 'foldOpen'],
    ['zc', 'foldClose'],
    ['za', 'foldToggle'],
    ['zR', 'foldOpenAll'],
    ['zM', 'foldCloseAll'],
  ];
  for (const [key, name] of keys)
    Vim.mapCommand(key, 'action', name, {}, { context: 'normal' });
}

/** `:set rnu / nornu / nu / nonu / wrap / nowrap` (§4 Ex): Vim options whose callbacks reconfigure CodeMirror. */
export function setOptions(view: EditorView): void {
  const state = { relativenumber: false, number: true, wrap: false };
  const relative = (lineNo: number, editorState: EditorState): string => {
    const current = editorState.doc.lineAt(
      editorState.selection.main.head,
    ).number;
    return lineNo === current
      ? String(lineNo)
      : String(Math.abs(lineNo - current));
  };
  const gutter = (): Extension => {
    if (!state.number) return [];
    if (!state.relativenumber) return lineNumbers();
    return [
      lineNumbers({ formatNumber: relative }),
      // The line-number gutter re-renders when its config changes, not when the cursor moves;
      // a fresh config on every selection change keeps the relative numbers current.
      EditorView.updateListener.of((update) => {
        if (update.selectionSet && !update.docChanged) {
          queueMicrotask(() => {
            update.view.dispatch({
              effects: compartments.lineNumbers.reconfigure([
                lineNumbers({ formatNumber: relative }),
                refresh,
              ]),
            });
          });
        }
      }),
    ];
  };
  const refresh = EditorView.updateListener.of((update) => {
    if (state.relativenumber && update.selectionSet && !update.docChanged) {
      queueMicrotask(() =>
        update.view.dispatch({
          effects: compartments.lineNumbers.reconfigure(gutter()),
        }),
      );
    }
  });
  const apply = (): void => {
    view.dispatch({
      effects: [
        compartments.lineNumbers.reconfigure(gutter()),
        compartments.wrap.reconfigure(
          state.wrap ? EditorView.lineWrapping : [],
        ),
      ],
    });
  };
  const option = (name: keyof typeof state, aliases: string[]): void => {
    Vim.defineOption(name, state[name], 'boolean', aliases, (value) => {
      if (value === undefined) return state[name];
      state[name] = value;
      apply();
      return undefined;
    });
  };
  option('relativenumber', ['rnu']);
  option('number', ['nu']);
  option('wrap', []);
}

/** `"*` as a second name for the clipboard register `"+` (§4 Registers): the engine only knows `+`. */
export function starRegister(): void {
  Vim.map('"*', '"+', 'normal');
  Vim.map('"*', '"+', 'visual');
}

/**
 * Insert-mode `Ctrl-h` as backspace (§4 Insert mode): a CodeMirror keymap entry that acts only
 * while Vim is in insert mode. Vim binds nothing to `<C-h>` in any mode, so the key reaches
 * CodeMirror's keymaps whenever the vimrc does not map it (the shipped vimrc maps it in normal
 * mode to `:focus left`); outside insert mode this entry declines and the key goes on to the browser.
 */
export const insertCtrlH: Extension = keymap.of([
  {
    key: 'Ctrl-h',
    run: (view) =>
      getCM(view)?.state.vim?.insertMode ? deleteCharBackward(view) : false,
  },
]);

/** The alternative tried for the record: a Vim insert-mode mapping to `<BS>`. */
export function insertCtrlHViaVimMap(): void {
  Vim.map('<C-h>', '<BS>', 'insert');
}

/** Normal-mode `U` (§4 Undo): the engine has none; `U` undoes like `u` (Vim's "undo the last changed line" semantics are not kept). */
export function lineUndo(): void {
  Vim.map('U', 'u', 'normal');
}

/** `:w` (§4 Ex): the engine's own `:w` calls a `save` command that does not exist here; the app redefines it (F3: run the code). */
export function writeEx(onWrite: () => void): void {
  Vim.defineEx('write', 'w', () => {
    onWrite();
  });
}

/**
 * `"+p` (§4 Registers): the engine reads the clipboard but pastes it with the linewise flag the
 * `+` register kept from the last `"+y`, so after a `"+yy` any charwise text from another app
 * is pasted as a line minus its last character. Derive linewise from the text itself instead.
 * `continuePaste` is the engine's own second half of the paste action.
 */
export function clipboardPaste(): void {
  Vim.defineAction('paste', function (this: unknown, cm, actionArgs, vim) {
    const actions = this as {
      continuePaste: (
        editor: typeof cm,
        args: typeof actionArgs,
        state: typeof vim,
        text: string,
        register: unknown,
      ) => void;
    };
    const register = Vim.getRegisterController().getRegister(
      actionArgs.registerName,
    ) as { toString(): string };
    if (actionArgs.registerName === '+') {
      void navigator.clipboard.readText().then((text) => {
        actions.continuePaste(
          cm,
          { ...actionArgs, linewise: text.endsWith('\n') },
          vim,
          text,
          register,
        );
      });
      return;
    }
    actions.continuePaste(cm, actionArgs, vim, register.toString(), register);
  });
}

/**
 * A leader key (§4 vimrc: `let mapleader = " "`). The engine runs the first full match for a
 * key and only waits for more keys when nothing matches in full, so a sequence that starts with
 * a bound key (`<Space>` is `l`, `,` repeats `f`) can never fire. Mapping the leader key to a
 * key name no default uses turns `<Leader>` into a prefix the engine waits on; the vimrc parser
 * then maps `<leader>x` lines as `<Leader>x`. An unmapped `<Leader>` sequence is swallowed, like
 * Vim's leader timeout, and with an operator pending the key keeps its motion meaning.
 */
export function leaderKey(key = '<Space>'): void {
  Vim.map(key, '<Leader>', 'normal');
  Vim.map(key, '<Leader>', 'visual');
}
