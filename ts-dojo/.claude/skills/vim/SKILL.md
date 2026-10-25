---
name: vim
description: Reference for ts-dojo's Vim layer and keyboard model — the §4 checklist (P must pass, W may use a mapping or definition, documented gaps), the browser-reserved keys, the shipped vimrc and the vimrc parser rules, the ex command table with aliases, the §4 and §6 focus rules (no global key fires while the editor has focus), the global keys, the @replit/codemirror-vim 6.4.0 API, and where Prep records its results (docs/prep-vim.md). Use when writing or changing the editor, key handling, ex commands, pane focus, the command palette, the help overlay, Playwright keyboard tests, or the Prep Vim spike.
---

# Vim in ts-dojo

The editor is CodeMirror 6 with `@replit/codemirror-vim` 6.4.0 (the CodeMirror 5 Vim engine; small, MIT). Monaco with `monaco-vim` was rejected (§ Decisions). The editor's `:` line is the app's command line. docs/spec.md §4 and §6 are the source; this file collects them.

## Browser-reserved keys (§4)

Chrome on Linux reserves `Ctrl-n`, `Ctrl-t`, `Ctrl-w`, their `Shift` variants, `Ctrl-Tab` and `Ctrl-1` to `Ctrl-9`. A page cannot intercept them. So nothing in the app depends on those keys, completion never needs `Ctrl-n`, and insert-mode `Ctrl-w` is a known gap (`Ctrl-Backspace` deletes a word instead). Prep checks whether an installed PWA window frees any of them, in a tab and in an installed window.

## The checklist (§4)

Prep runs this list against `@replit/codemirror-vim` 6.4.0 and records pass, workaround or gap per item. **P** must pass as shipped. **W** may be met by a default mapping in the shipped vimrc or by a `Vim.defineEx` or `Vim.defineAction` definition (`defineAction` to be confirmed in Prep). F3's first criterion is that every P item passes in Chrome and every W item has its mapping or definition applied by default.

| Area | Items | Level |
| --- | --- | --- |
| Modes | normal, insert, replace, visual, visual-line, visual-block | P |
| Motions | `h j k l w b e ge W B E 0 ^ $ gg G { } % f t F T ; , H M L`, `Ctrl-d Ctrl-u Ctrl-f Ctrl-b`, counts | P |
| Operators | `d c y > < = g~ gu gU` with motions and counts; `dd cc yy D C Y x X s S r J` | P |
| Text objects | `iw aw iW aW is as ip ap`, brackets `( [ { <`, quotes `"`, `'` and `` ` ``, `it at` | P (`it at` W) |
| Registers | unnamed, `a`–`z`, `0`, `_`, `+` and `*` (system clipboard) | P |
| Marks and jumps | `m`, `'`, `` ` ``, `''`, `Ctrl-o Ctrl-i` | P (jumps W) |
| Search | `/ ? n N * #`, incremental, highlight, `:noh` | P |
| Repeat | `.`, `;` `,`, macros `q @ @@` | P (macros W) |
| Undo | `u Ctrl-r U` | P |
| Ex | `:w :s :%s` with `g` and `c` flags, `:g`, `:sort`, `:<n>`, `:map :nmap :imap :vmap :noremap :nnoremap :inoremap :vnoremap :unmap`, `:set` for `rnu nu wrap` | P (`:g :sort` W) |
| Insert mode | `Ctrl-u Ctrl-o Ctrl-r <reg>`, `Ctrl-h` as backspace; `Ctrl-w` is a browser gap | W |
| Folding | `zo zc za zR zM` on CodeMirror folds | W |
| Not expected | `:normal`, `gq`, every `Ctrl-v` insert edge case, `g` and `z` commands beyond the above | gap, documented |

Known gaps go in the `?` help overlay under "What Vim mode can't do".

## Prep results (17 October 2026): read `docs/prep-vim.md` before touching key handling

Prep ran the checklist in Google Chrome 155 with Playwright (`spike/vim/checklist.spec.ts`, `pnpm spike:vim:check`, 94 tests). docs/prep-vim.md has one row per item with its test, the "Ctrl keys" table Kim fills by hand, and the gaps list for the `?` overlay. The engine is the separate package `@replit/codemirror-vim-core` 0.1.0 (`vim.js`); 6.4.0's `dist/index.js` is only the CodeMirror 6 adapter.

**Results in one paragraph.** Every P item passes as shipped except four that need a definition the §11 gate allows: `"*` (the engine knows `+` only), `"+p` (stale linewise flag), normal-mode `U` (the engine has none) and `:set rnu nu wrap` ("Unknown option"); visual block needs `allowMultipleSelections`. Of the W items, jumps (`Ctrl-o Ctrl-i`), macros, `:g`, `:sort`, insert `Ctrl-u Ctrl-o Ctrl-r` pass as shipped; insert `Ctrl-h` needs a mapping; folds need definitions; `it at` is a gap in a TypeScript buffer; insert `Ctrl-w` stays the browser gap. `:normal` and `gq` work. `defineAction` is confirmed.

**What F3 applies by default** (code in `spike/vim/workarounds.ts`, lift it unchanged):

| Item | Definition |
| --- | --- |
| Visual block | `EditorState.allowMultipleSelections.of(true)` in the editor extensions; without it a block operation touches one line |
| Space leader | `leaderKey('<Space>')`: `Vim.map('<Space>', '<Leader>', 'normal')` and `'visual'`; the parser emits every `<leader>x` line as `<Leader>x` |
| `"*` | `starRegister()`: `Vim.map('"*', '"+', 'normal')` and `'visual'` |
| `"+p` | `clipboardPaste()`: redefines the `paste` action so the linewise flag comes from the clipboard text (as shipped a copied line is pasted charwise, and after `"+yy` charwise text loses its last character) |
| `U` | `lineUndo()`: `Vim.map('U', 'u', 'normal')`, pending Kim's answer under Spec questions (plain undo, not line undo) |
| `:set rnu nu wrap` | `setOptions(view)`: `Vim.defineOption('relativenumber', false, 'boolean', ['rnu'], cb)` and the same for `number`/`nu` and `wrap`; the callbacks reconfigure compartments (`lineNumbers({ formatNumber })`, `EditorView.lineWrapping`); the relative gutter must be re-rendered on cursor moves |
| Insert `Ctrl-h` | `Vim.map('<C-h>', '<BS>', 'insert')` (`imap <C-h> <BS>`), or the insert-only CodeMirror keymap `insertCtrlH` |
| `zo zc za zR zM` | `foldKeys()`: `Vim.defineAction('foldClose', cm => foldCode(cm.cm6))` (and open, toggle, openAll, closeAll) plus `Vim.mapCommand('zc', 'action', 'foldClose', {}, { context: 'normal' })`; needs `codeFolding()` or `foldGutter()` |
| `:w` and the ex table | `Vim.defineEx(name, prefix, fn)`; as shipped `:w` does nothing visible |

**Mapping rules the vimrc parser must follow** (each proven in the `API` describe of the spike):

1. A right-hand side `:cmd<CR>` runs the command; `:cmd` without `<CR>` opens the command line pre-filled, as in Vim.
2. The engine runs the first full match and waits for more keys only when nothing matches in full. A multi-key mapping fires only when its first key is not a command by itself: `gd gt gT ]d [d K <C-h> <C-j> <C-k> <C-l>` and insert `jk` fire; `<Space>d` and `,d` never do, and `unmap` cannot remove a default. Hence the virtual `<Leader>` key above.
3. `<leader>` means nothing to the engine; the parser expands `let mapleader`.
4. Re-mapping a key: the newest definition wins; `unmap` removes only the newest (the older one comes back); `mapclear(ctx)` empties the user layer. Re-applying the vimrc on a settings change: `mapclear` for normal, visual and insert, then the app's own mappings, then the vimrc lines.
5. A single-key user mapping overrides the default for that key; `Vim.map` and `:nmap` are the same path.

**Engine quirks worth knowing:** `a"` `a'` `` a` `` select the quotes only (Vim also takes the trailing space); `?` from inside a match skips that match; the status panel shows `--NORMAL--` and friends but a notification replaces the mode text until the next notification; `cm.cm6` is the `EditorView` (typed `any` in an action's `cm`); Chrome lets the page take Ctrl-d/u/f/b/r/o/h/p/v only if the page prevents them (Kim's table in docs/prep-vim.md says which arrive in a tab and in an installed window).

## Shipped vimrc and the parser (§4)

Settings holds a vimrc text area. Supported lines: the `map` family (`:map :nmap :imap :vmap :noremap :nnoremap :inoremap :vnoremap`), `unmap`, `set <option>`, `let mapleader = "<key>"`, and `"` comments. They are parsed into `Vim.map`, `Vim.unmap` and option calls when the editor is created and whenever the setting changes. Bad lines are listed with their line number and skipped; the good lines still apply (§12 F3).

```vim
let mapleader = " "
imap jk <Esc>
nmap <leader>r :run<CR>
nmap <leader>t :test<CR>
nmap <leader>h :hint<CR>
nmap ]d :dnext<CR>
nmap [d :dprev<CR>
nmap K :info<CR>
nmap gd :def<CR>
nmap gt :bnext<CR>
nmap gT :bprev<CR>
nmap <C-h> :focus left<CR>
nmap <C-j> :focus down<CR>
nmap <C-k> :focus up<CR>
nmap <C-l> :focus right<CR>
set rnu
```

`Ctrl-h/j/k/l` move between panes the way vim-tmux-navigator does, in normal and visual mode only. In insert mode they keep their Vim meaning (`Ctrl-h` is backspace).

## Ex commands (§4)

Each command is registered with `Vim.defineEx` and also listed in the `Ctrl-p` palette.

| Command | Aliases | Does |
| --- | --- | --- |
| `:w` | `:run` | Transpiles the project and runs the entry file. |
| `:test` | `:t` | Runs the tests and the full verification (§5). |
| `:kill` | | Terminates a running sandbox. |
| `:hint` | | Reveals the next hint. |
| `:sol` | `:solution` | Opens the solution read-only in a split; `:sol` again closes it. |
| `:reset` | | Restores the starter after a confirmation. |
| `:done` | | Marks the lesson's theory as read, from either pane. |
| `:next`, `:prev` | `:n`, `:N` | Next or previous exercise; past the last, the next lesson. |
| `:lesson next`, `:lesson prev` | | Next or previous lesson directly. |
| `:roadmap` | `:rm` | Goes to the roadmap. |
| `:theory`, `:practice`, `:output` | | Focuses that pane. |
| `:focus left/right/up/down` | | Pane focus; what `Ctrl-h/j/k/l` call. |
| `:layout split`, `:layout theory`, `:layout practice` | | Two panes, or one full width. |
| `:prompt` | | Shows or hides the exercise prompt above the editor. |
| `:b <file>`, `:ls`, `:bnext`, `:bprev` | | File tabs in a multi-file exercise; scratch buffers in `/repl`. |
| `:e <name>`, `:bd` | | `/repl` only: create or open a scratch buffer; delete one after a confirmation. |
| `:dnext`, `:dprev`, `:info`, `:def` | | Next or previous diagnostic, quick info at the cursor, go to definition. |
| `:set rnu / nornu / nu / wrap / nowrap / bg=dark / bg=light` | | Editor and theme options; persisted. |
| `:export` | | Downloads the progress JSON (§7). |
| `:help` | `:h` | The keyboard help overlay. |

`:done` with Check yourself questions left jumps to the first unanswered one and says how many remain (§1). `:reset` keeps the attempt history. `:sol` marks the exercise "solution viewed"; it still passes only when Kim's own files pass.

## Keys inside the editor that are not Vim's (§4)

- Completions open on typing and `Ctrl-Space`; `Ctrl-j`/`Ctrl-k` and `Tab`/`Shift-Tab` move, `Ctrl-p` also moves up, `Enter` or `Ctrl-y` accept, `Esc` closes and returns to normal mode.
- `K` quick info at the cursor (mapping to `:info`); hover also shows it. `gd` go to definition across the exercise's files. `]d`/`[d` next and previous diagnostic.
- Signature help on `(` and `,`. A `//   ^?` line shows the queried type under it and updates on edit.
- `"+y` and `"+p` use the system clipboard; the Clipboard API needs HTTPS or localhost (§12 F3).

## Focus and the global keys (§4, §6)

Exactly one pane has focus: theory, editor or output. **Inside the editor every key goes to Vim; the app handles none of them.** `Ctrl-h/j/k/l` move focus from normal mode through the vimrc mappings, and from any non-editor pane through the app. `Esc` in a non-editor pane returns focus to the editor.

Global keys fire only when the editor does not have focus:

| Key | Action |
| --- | --- |
| `?` | Keyboard help overlay, with the Vim gaps list |
| `Ctrl-p` | Command palette: lessons, exercises and every ex command, fuzzy-matched |
| `g r` | Roadmap |
| `g n` / `g p` | Next / previous lesson |
| `] e` / `[ e` | Next / previous exercise |
| `Ctrl-h j k l` | Pane focus |
| `1` `2` `3` | Focus theory / editor / output |
| `Esc` | Focus the editor |
| `j k gg G Ctrl-d Ctrl-u` | Scroll the focused reading pane |
| `Enter` | Activate the focused item |

Conflict rule: no global key fires while the editor is focused, so nothing can shadow a Vim key. `Ctrl-p` opens the palette from normal mode only; in insert mode it stays completion. §12 F8 proves it in Playwright: with the editor focused in normal mode, `g r`, `g n`, `] e` and `?` do nothing app-level.

Theory pane keys when focused: `j k gg G Ctrl-d Ctrl-u` scroll, `Enter` on a code block runs Open in REPL, `j`/`k` and `Enter` answer a Check yourself question when one has focus. Output pane: `j`/`k` move, `Enter` jumps to the diagnostic, failed test or rule hit; the Tests tab's four rows expand with `Enter`. Roadmap: `j`/`k` reading order, `h`/`l` within a band, `Enter` opens, `c` continues. Module page: `j`/`k`/`Enter`. `predict` exercises: `j`/`k`/`Enter`.

## The `@replit/codemirror-vim` API (6.4.0, confirmed in Prep)

```js
import { vim, Vim, getCM } from '@replit/codemirror-vim';
// vim() must come before other keymaps; status: true renders --NORMAL-- etc. in a .cm-vim-panel
new EditorView({ extensions: [vim({ status: true }), EditorState.allowMultipleSelections.of(true), drawSelection(), /* ... */] });

const cm = getCM(view);              // the CodeMirror 5 adapter; cm.state.vim has insertMode, visualMode, visualLine, visualBlock, mode
Vim.defineEx('write', 'w', (cm, params) => { /* params: commandName, argString, args, line, lineEnd, input */ });
Vim.defineAction('foldClose', (cm, actionArgs, vim) => foldCode(cm.cm6));   // cm.cm6 is the EditorView
Vim.mapCommand('zc', 'action', 'foldClose', {}, { context: 'normal' });     // binds keys to an action
Vim.defineOption('relativenumber', false, 'boolean', ['rnu'], (value) => { /* undefined = get */ });
Vim.map('jk', '<Esc>', 'insert');   Vim.noremap('Y', 'y$', 'normal');   Vim.unmap('jk', 'insert');   Vim.mapclear('normal');
Vim.handleKey(cm, 'd', 'user');     Vim.handleEx(cm, '2');
Vim.getRegisterController().getRegister('+');   Vim.exitInsertMode(cm);   Vim.exitVisualMode(cm);
```

`defineOperator`, `defineMotion` and `defineRegister` are declared in `dist/index.d.ts` but were not needed. The `:` and `/` prompts are an `input` inside the panel. `navigator.clipboard` (the `+` register) needs HTTPS or localhost and the permission.

## Testing keys (Playwright)

`spike/vim/helpers.ts` has the helpers the spike used: `press(page, 'dw<Esc>')` turns Vim notation into key presses (`<C-d>` → `Control+d`, `+` → `Shift+Equal`), `snapshot(page)` reads the document, cursor, mode, status text, search matches, folds and gutter, `setDoc` resets the buffer and mode, `ex(page, 's/a/b/g')` types at the prompt. Reuse them in `e2e/`. Drive everything with `page.keyboard.press` and `page.keyboard.type`; assert the focused pane before and after; wait for the compiler chip to leave "compiler loading" before anything that needs diagnostics; never rely on a fixed sleep. The `e2e-writer` agent has the flows §12 requires.
