// The definitions that close the §4 checklist's gaps, lifted from the Prep spike
// (spike/vim/workarounds.ts, recorded in docs/prep-vim.md) and applied by default: the W items
// (folds, insert Ctrl-h) and the P items that needed a definition (`"*`, `"+p`, `U`, the Space
// leader). Everything here is engine-global (`Vim.*`), so it is applied once per page load;
// the mappings among them are user-layer mappings that `mapclear` removes, so `applyVimrc`
// re-applies them through `vimDefaultMappings` before the vimrc lines.
import { deleteCharBackward } from '@codemirror/commands';
import {
  foldAll,
  foldCode,
  toggleFold,
  unfoldAll,
  unfoldCode,
} from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { getCM, Vim } from '@replit/codemirror-vim';

const FOLD_COMMANDS = {
  foldOpen: unfoldCode,
  foldClose: foldCode,
  foldToggle: toggleFold,
  foldOpenAll: unfoldAll,
  foldCloseAll: foldAll,
};

const FOLD_KEYS: [string, keyof typeof FOLD_COMMANDS][] = [
  ['zo', 'foldOpen'],
  ['zc', 'foldClose'],
  ['za', 'foldToggle'],
  ['zR', 'foldOpenAll'],
  ['zM', 'foldCloseAll'],
];

/** Folding (§4 W): `zo zc za zR zM` as Vim actions over CodeMirror's fold commands; needs codeFolding() or foldGutter(). */
export function defineFoldActions(): void {
  for (const [name, command] of Object.entries(FOLD_COMMANDS)) {
    Vim.defineAction(name, (cm) => {
      command(cm.cm6 as EditorView);
    });
  }
}

/**
 * The key bindings for the fold actions. `mapCommand` puts them in the engine's user layer,
 * which `mapclear` empties, so they are re-applied with the other default mappings.
 */
export function mapFoldKeys(): void {
  for (const [key, name] of FOLD_KEYS)
    Vim.mapCommand(key, 'action', name, {}, { context: 'normal' });
}

/** Both halves, for a page that applies no vimrc. */
export function foldKeys(): void {
  defineFoldActions();
  mapFoldKeys();
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
 * mode to `:focus left`); outside insert mode this entry declines and the key goes on.
 */
export const insertCtrlH: Extension = keymap.of([
  {
    key: 'Ctrl-h',
    run: (view) =>
      getCM(view)?.state.vim?.insertMode ? deleteCharBackward(view) : false,
  },
]);

/** Normal-mode `U` (§4 Undo): the engine has none; `U` undoes like `u` (Spec questions: Vim's line-undo meaning is not kept). */
export function lineUndo(): void {
  Vim.map('U', 'u', 'normal');
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
 * then maps `<leader>x` lines as `<Leader>x`.
 */
export function leaderKey(key = '<Space>'): void {
  Vim.map(key, '<Leader>', 'normal');
  Vim.map(key, '<Leader>', 'visual');
}

/** The engine-global definitions (actions, not mappings): once per page load. */
let defined = false;
export function defineVimDefaults(): void {
  if (defined) return;
  defined = true;
  defineFoldActions();
  clipboardPaste();
}

/**
 * `Ctrl-h/j/k/l` move between panes "in normal and visual mode" (§4), but the shipped vimrc
 * maps them with `nmap` only; the visual half is applied here so the vimrc text stays §4's.
 */
export function visualPaneKeys(): void {
  const directions: [string, string][] = [
    ['<C-h>', 'left'],
    ['<C-j>', 'down'],
    ['<C-k>', 'up'],
    ['<C-l>', 'right'],
  ];
  for (const [key, direction] of directions) {
    Vim.map(key, `:focus ${direction}<CR>`, 'visual');
  }
}

/** The app's own user-layer mappings, re-applied after every `mapclear` and before the vimrc lines. */
export function vimDefaultMappings(leader: string): void {
  leaderKey(leader);
  starRegister();
  lineUndo();
  mapFoldKeys();
  visualPaneKeys();
}
