# Vim spike results (Prep)

Checked on 17 October 2026 with `@replit/codemirror-vim` 6.4.0 (its engine is the separate package `@replit/codemirror-vim-core` 0.1.0), `@codemirror/view` 6.43.14, `state` 6.7.6, `language` 6.13.1, `commands` 6.11.1, `search` 6.7.2, `lang-javascript` 6.2.5, in Google Chrome 155.0.8059.39 on Linux, headless, driven by Playwright 1.64.1 with `channel: 'chrome'`.

- The page: `spike/vim/` (`pnpm spike:vim`, http://localhost:5179). The checks: `spike/vim/checklist.spec.ts` (`pnpm spike:vim:check`), 94 tests, all passing. Every row below names its test by title; the title also carries the recorded result.
- Result is `pass` (as shipped), `workaround` (a mapping or definition closes it; the code is in `spike/vim/workarounds.ts`, named in the row, with the vimrc line where one exists) or `gap` (what happens today, listed for the `?` overlay).
- Editor setup the results assume (`spike/vim/main.ts`): `vim({ status: true })` first, then `EditorState.allowMultipleSelections.of(true)` (**without it visual block affects only one line**), `drawSelection()`, `history()`, `foldGutter()` and `codeFolding()` (the fold definitions need them), `bracketMatching()`, `javascript({ typescript: true, jsx: true })`, `keymap.of([...defaultKeymap, ...historyKeymap])`, no `searchKeymap`.
- Two §4 items need Kim in a real browser window: the browser-reserved keys and the clipboard round trip with another app. Steps at the end.

## The checklist

| Area | Item | Level | Result | Mapping or definition | Test | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Modes | normal | P | pass | | `Modes › normal mode at start` | status panel shows `--NORMAL--` |
| Modes | insert | P | pass | | `Modes › insert: i, typing, Esc back to normal one column left` | |
| Modes | replace | P | pass | | `Modes › replace: R types over, Esc` | engine mode `replace`, panel `--REPLACE--` |
| Modes | visual | P | pass | | `Modes › visual: v then e selects, d deletes the selection` | |
| Modes | visual-line | P | pass | | `Modes › visual-line: V j d deletes two lines` | |
| Modes | visual-block | P | workaround | `EditorState.allowMultipleSelections.of(true)` in the editor extensions | `Modes › visual-block: Ctrl-v j j d deletes a column`, `Modes › visual-block: Ctrl-v j I inserts on every line` | without the setting only one line of the block was affected (observed in the spike before the setting was added; not pinned by a test). Chrome keeps Ctrl-v for paste unless the page prevents it: on Kim's key list |
| Motions | `h j k l` | P | pass | | `Motions › h j k l` | |
| Motions | `w b e ge` | P | pass | | `Motions › w b e ge` | |
| Motions | `W B E` | P | pass | | `Motions › W B E treat punctuation as part of the word` | |
| Motions | `0 ^ $` | P | pass | | `Motions › 0 ^ $` | |
| Motions | `gg G` | P | pass | | `Motions › gg G` | |
| Motions | `{ }` | P | pass | | `Motions › { } move by paragraph` | |
| Motions | `%` | P | pass | | `Motions › % jumps between matching brackets` | needs `bracketMatching()` |
| Motions | `f t F T ; ,` | P | pass | | `Motions › f t F T ; ,` | |
| Motions | `H M L` | P | pass | | `Motions › H M L move within the visible screen` | the editor needs a fixed height so that a screen exists |
| Motions | `Ctrl-d Ctrl-u Ctrl-f Ctrl-b` | P | pass | | `Motions › Ctrl-d Ctrl-u Ctrl-f Ctrl-b scroll by half and full pages` | Chrome's own Ctrl-d, Ctrl-u, Ctrl-f, Ctrl-b are preventable per §4; on Kim's key list |
| Motions | counts | P | pass | | `Motions › counts: 3w 2j 5l 2k` | |
| Operators | `d c y > < = g~ gu gU` with motions and counts | P | pass | | `Operators › d with motions and counts`, `c with a motion`, `y with a motion and p`, `> and < with motions and counts`, `= reindents through the language`, `g~ gu gU with motions` | `=` uses lang-javascript's indentation |
| Operators | `dd cc yy D C Y x X s S r J` | P | pass | | `Operators › dd cc yy with counts`, `D C Y`, `x X s S r J with counts` | `Y` is linewise, as in Vim |
| Text objects | `iw aw iW aW` | P | pass | | `Text objects › iw aw`, `iW aW` | |
| Text objects | `is as` | P | pass | | `Text objects › is as` | sentence boundaries are approximate; the test asserts the sentence is gone, not the exact spacing |
| Text objects | `ip ap` | P | pass | | `Text objects › ip ap` | |
| Text objects | brackets `( [ { <` | P | pass | | `Text objects › brackets ( [ { < with i and a` | |
| Text objects | quotes `"` `'` and `` ` `` | P | pass | | `Text objects › quotes " ' \` with i and a` | `a"`, `a'`, `` a` `` select the quotes only; Vim also takes the trailing space |
| Text objects | `it at` | W | gap | none worth shipping | `Text objects › it at do nothing on JSX or TypeScript generics` | the adapter's `findMatchingTag` looks for HTML/XML tag nodes in the syntax tree (lang-html, lang-xml); a TypeScript buffer has none, JSX nodes are not recognised. Overlay. |
| Registers | unnamed | P | pass | | `Registers › unnamed: dw then P puts it back` | |
| Registers | `a`–`z`, `A`–`Z` append | P | pass | | `Registers › named a–z and append with A–Z` | |
| Registers | `0` | P | pass | | `Registers › 0 holds the last yank after a delete` | |
| Registers | `_` | P | pass | | `Registers › _ discards without touching the unnamed register` | |
| Registers | `+` yank | P | pass | | `Registers › + writes the system clipboard on yank, linewise, charwise and from visual mode` | `navigator.clipboard.writeText`; needs HTTPS or localhost and the permission |
| Registers | `+` put | P | workaround | `clipboardPaste()`: redefines the engine's `paste` action so that for `+` the linewise flag comes from the clipboard text (`text.endsWith('\n')`), then calls the engine's own `continuePaste` | `Registers › + reads the system clipboard on put ... pass with a gap`, `+ after a linewise "+yy pastes charwise clipboard text as a line minus its last character — gap`, `+ with clipboardPaste derives linewise from the clipboard text — workaround` | as shipped the engine pastes the clipboard with the `+` register's own linewise flag, which is whatever the last `"+y` left: a line copied in another app is pasted charwise and splits the line; after a `"+yy`, charwise text is pasted as a line minus its last character. Worth an upstream issue. |
| Registers | `*` | P | workaround | `starRegister()`: `Vim.map('"*', '"+', 'normal')` and `'visual'`; vimrc `nmap "* "+` and `vmap "* "+` | `Registers › * as shipped is ignored`, `* with starRegister is the clipboard register in normal and visual mode` | the engine's valid registers are `- " . : _ / +`, letters and digits; `"*yy` is a plain `yy`. With the map, `"*` is `"+` in both modes |
| Marks and jumps | `m` `'` `` ` `` | P | pass | | `Marks and jumps › m then ' and \` return to the line and the exact position` | |
| Marks and jumps | `''` | P | pass | | `Marks and jumps › '' returns to the position before the last jump` | |
| Marks and jumps | `Ctrl-o Ctrl-i` | W | pass | | `Marks and jumps › Ctrl-o and Ctrl-i walk the jump list` | `G`, `gg` and searches are jumps. Chrome's Ctrl-o (open file) is preventable: on Kim's key list |
| Search | `/ n N` | P | pass | | `Search › / n N` | wraps at the end |
| Search | `?` | P | pass | | `Search › ? searches backwards` | from inside a match `?` skips that match; Vim would stop at its start |
| Search | `* #` | P | pass | | `Search › * and # search the word under the cursor` | |
| Search | incremental | P | pass | | `Search › incremental: matches highlight while typing the pattern` | |
| Search | highlight, `:noh` | P | pass | | `Search › highlight stays after Enter and :noh clears it` | `cm-searchMatch` decorations through `@codemirror/search` |
| Repeat | `.` | P | pass | | `Repeat › . repeats the last change, with a count` | |
| Repeat | `; ,` | P | pass | | `Repeat › ; and , repeat f t F T` | |
| Repeat | macros `q @ @@` | W | pass | | `Repeat › macros: q records, @ plays, @@ repeats` | |
| Undo | `u Ctrl-r` | P | pass | | `Undo › u and Ctrl-r` | Chrome's Ctrl-r (reload) must be preventable: on Kim's key list |
| Undo | `U` | P | workaround | `lineUndo()`: `Vim.map('U', 'u', 'normal')`; vimrc `nmap U u` | `Undo › U as shipped does nothing in normal mode — gap`, `U with lineUndo undoes like u — workaround` | the engine has no normal-mode `U` (only visual `U`, uppercase). The mapping makes `U` a plain undo, not Vim's "undo all changes on the last changed line": Kim decides (spec question). Overlay either way |
| Ex | `:w` | P | pass with `Vim.defineEx('write', 'w', fn)` | `writeEx()` | `Ex › :w as shipped has nothing to call; with defineEx the app owns it` | as shipped `:w` calls a `save` command that does not exist and does nothing visible; F3 defines it (run the code) |
| Ex | `:s :%s` with `g` and `c` | P | pass | | `Ex › :s and :%s with the g flag`, `:%s with the c flag asks per match: y, n, a` | the `c` prompt takes `y n a` (also `q l`, untested) |
| Ex | `:g` | W | pass | | `Ex › :g with d and with s` | |
| Ex | `:sort` | W | pass | | `Ex › :sort, :sort! and :sort u` | the engine's tests also cover `i`, `n`, `x`, `o` flags and patterns |
| Ex | `:<n>` | P | pass | | `Ex › :<n> goes to a line` | lands on the first non-blank |
| Ex | `:map :nmap :imap :vmap :noremap :nnoremap :inoremap :vnoremap :unmap` | P | pass | | `Ex › :map :nmap :noremap :nnoremap and :unmap in normal mode`, `:imap and :inoremap in insert mode`, `:vmap and :vnoremap in visual mode` | the matching rules under "Mapping rules" below apply to every form |
| Ex | `:set` for `rnu nu wrap` | P | workaround | `setOptions(view)`: `Vim.defineOption('relativenumber', false, 'boolean', ['rnu'], cb)`, `Vim.defineOption('number', true, 'boolean', ['nu'], cb)`, `Vim.defineOption('wrap', false, 'boolean', [], cb)`; the callbacks reconfigure two compartments (`lineNumbers()` with a relative `formatNumber`; `EditorView.lineWrapping`) | `Ex › :set rnu nu wrap as shipped are unknown options — gap`, `:set rnu / nornu / nu / nonu / wrap / nowrap with setOptions — workaround` | as shipped: `Unknown option: rnu`. The engine's `:set` already parses the `no` prefix, `!` toggle, `?` query and `=` value. The relative gutter must be re-rendered on cursor moves: the spike reconfigures the compartment in a microtask on selection changes; F3 can use a ViewPlugin |
| Insert mode | `Ctrl-u` | W | pass | | `Insert mode › Ctrl-u deletes to the start of the line` | |
| Insert mode | `Ctrl-o` | W | pass | | `Insert mode › Ctrl-o runs one normal-mode command` | |
| Insert mode | `Ctrl-r <reg>` | W | pass | | `Insert mode › Ctrl-r <reg> inserts a register` | |
| Insert mode | `Ctrl-h` as backspace | W | workaround | `Vim.map('<C-h>', '<BS>', 'insert')`, which is vimrc `imap <C-h> <BS>` (`insertCtrlHViaVimMap()`); the CodeMirror keymap `insertCtrlH` (insert-mode only) works too | `Insert mode › Ctrl-h as shipped does nothing in insert mode — gap`, `Ctrl-h with the insertCtrlH keymap is backspace in insert mode only — workaround`, `Ctrl-h through a Vim insert mapping to <BS> (imap <C-h> <BS>) is backspace too — workaround` | the engine binds `<C-h>` nowhere and CodeMirror's Linux `standardKeymap` does not bind Ctrl-h (only the Mac emacs set does). Chrome's Ctrl-h (history) is preventable: on Kim's key list |
| Insert mode | `Ctrl-w` | W | gap (browser) | none; `Ctrl-Backspace` deletes a word through CodeMirror | `Insert mode › Ctrl-w deletes a word in the engine ... pass under synthetic keys`, `Ctrl-Backspace deletes a word through CodeMirror` | the engine's binding works when the key arrives; Chrome keeps the real Ctrl-w (§4). Overlay |
| Folding | `zo zc za zR zM` | W | workaround | `foldKeys()`: `Vim.defineAction('foldClose', cm => foldCode(cm.cm6))` (and `foldOpen` → `unfoldCode`, `foldToggle` → `toggleFold`, `foldOpenAll` → `unfoldAll`, `foldCloseAll` → `foldAll`), then `Vim.mapCommand('zc', 'action', 'foldClose', {}, { context: 'normal' })` for each key; needs `codeFolding()` or `foldGutter()` | `Folding › zc as shipped does not fold — gap`, `zo zc za zR zM with foldKeys over CodeMirror folds — workaround` | the engine has no fold keys at all (its `z` keys are `zt zz zb z. z<CR> z-`) |
| Not expected | `:normal` | gap expected | pass | | `Not expected › :normal works, beyond what the spec expects` | `:%normal A;` appends on every line |
| Not expected | `gq` | gap expected | pass | | `Not expected › gq hard-wraps at textwidth` | `:set tw=20` then `gqq` wraps; the operator is the engine's `hardWrap` |
| Not expected | `Ctrl-v` insert edge cases | gap | partly | | `Not expected › Ctrl-v insert edge case: $A appends on ragged lines` | `I`, `A`, `$A`, `c`, `d`, `I` with count verified; nothing else. Overlay |
| Not expected | `g` and `z` commands beyond the above | gap | documented | | `Not expected › other g and z commands: gv gJ zt zz exist` | present: `gv gi gI gJ gn gN gc g? gw g* g# g$ g^ g0 gj gk`, `zt zz zb z. z<CR> z-`; absent: everything else (`zf zd zj zk g; g, gx gf` ...). Overlay |

## Ctrl keys the page can intercept (Kim)

Playwright cannot answer this: its synthetic events bypass the browser's own accelerators. The spike page logs every keydown that reaches it; Kim fills the two columns.

| Key | Tab | Installed window | Used by |
| --- | --- | --- | --- |
| Ctrl-n, Ctrl-t, Ctrl-w | | | nothing (§4 reserved); Ctrl-w is the insert-mode gap |
| Ctrl-Shift-n, Ctrl-Shift-t, Ctrl-Shift-w | | | nothing (§4 reserved) |
| Ctrl-Tab, Ctrl-Shift-Tab | | | nothing (§4 reserved) |
| Ctrl-1 … Ctrl-9 | | | nothing (§4 reserved) |
| Ctrl-a, Ctrl-x | | | increment, decrement |
| Ctrl-b, Ctrl-f, Ctrl-d, Ctrl-u | | | page and half-page scrolling; Ctrl-u also insert-mode delete to line start |
| Ctrl-e, Ctrl-y | | | scroll one line; Ctrl-y also accepts a completion |
| Ctrl-g | | | nothing today (Vim's file info) |
| Ctrl-h, Ctrl-j, Ctrl-k, Ctrl-l | | | pane focus from normal mode; Ctrl-h backspace and Ctrl-j/Ctrl-k completion moves in insert mode |
| Ctrl-i, Ctrl-o | | | jump list; Ctrl-o one normal command in insert mode |
| Ctrl-p | | | command palette (normal mode), completion up (insert mode) |
| Ctrl-r | | | redo; Ctrl-r <reg> in insert mode |
| Ctrl-v | | | visual block |
| Ctrl-[ | | | Esc |
| Ctrl-Space | | | completions |
| Ctrl-Backspace | | | delete a word in insert mode (the Ctrl-w stand-in) |

## API confirmed (6.4.0 `dist/index.d.ts`, exercised in `API (what the vimrc parser and F3 need)`)

- `Vim.defineEx(name, prefix, fn)`; `Vim.defineAction(name, fn)` with `Vim.mapCommand(keys, 'action', name, {}, { context: 'normal' })` to bind keys (**`defineAction` confirmed**); `Vim.defineOption(name, default, 'boolean', aliases, cb)`; `Vim.map`, `Vim.noremap`, `Vim.unmap`, `Vim.mapclear(ctx)`; `Vim.handleKey(cm, key, 'user')`; `Vim.handleEx(cm, input)`; `Vim.getRegisterController().getRegister(name)`; `Vim.exitInsertMode(cm)`, `Vim.exitVisualMode(cm)`. `defineOperator`, `defineMotion` and `defineRegister` are declared but were not needed.
- `vim({ status: true })` renders `--NORMAL--`, `--INSERT--`, `--VISUAL--`, `--REPLACE--` in a `.cm-vim-panel`; a notification (`Unknown option: rnu`) replaces the mode text until the next notification. `getCM(view)` gives the adapter; `cm.state.vim` has `insertMode`, `visualMode`, `visualLine`, `visualBlock`, `mode`; `cm.cm6` is the `EditorView` (typed `any` on the interface an action receives).
- The `:` and `/` prompts are an `input` inside the panel; Playwright types into it and presses Enter.

### Mapping rules the vimrc parser must follow

1. A right-hand side `:cmd<CR>` runs the command; `:cmd` without `<CR>` opens the command line pre-filled, as in Vim (`API › a mapping to :w<CR> runs the command; a mapping to :w opens the command line pre-filled`).
2. The engine runs the first full match for the keys typed so far and waits for more keys only when nothing matches in full. So a multi-key mapping fires only when its first key is not a command by itself: `gd gt gT ]d [d K <C-h> <C-j> <C-k> <C-l>` and insert-mode `jk` all fire (`API › the shipped vimrc keys that are free or prefixes fire as multi-key mappings`); `<Space>d` and `,d` never do, and `Vim.unmap('<Space>')` does not remove the default (`API › a multi-key mapping whose first key is a full command by itself never fires — gap`).
3. `<leader>` means nothing to the engine (`API › <leader> means nothing to the engine — gap`). The parser expands it, and because of rule 2 the Space leader needs `leaderKey()`: `Vim.map('<Space>', '<Leader>', 'normal')` and `'visual'` turn `<Leader>` into a prefix no default uses, and every `<leader>x` line is emitted as `<Leader>x`. Verified: `<Leader>r` to an ex command, `<Leader>x` to keys, counts (`2<Space>x`), visual mode, an unmapped `<Leader>` sequence is swallowed, and `d<Space>` keeps its motion meaning (`API › leaderKey: ... — workaround`).
4. Re-mapping a key: the newest definition wins, `unmap` removes only the newest (the older one comes back), `mapclear(ctx)` empties the user layer for that context (`API › re-mapping a key ...`). Re-applying the vimrc on a settings change therefore starts with `mapclear` for normal, visual and insert, then re-applies the app's own mappings (`leaderKey`, `starRegister`, `lineUndo`, Ctrl-h), then the vimrc lines.
5. A single-key user mapping overrides the default for that key (`X` → `dd`), and `Vim.map` and `:nmap` are the same path (`API › a single-key mapping overrides the default ...`).

## What F3 applies by default (the W list, plus the P items that needed a definition)

| Item | Definition (all in `spike/vim/workarounds.ts`) |
| --- | --- |
| Visual block | `EditorState.allowMultipleSelections.of(true)` in the editor extensions |
| Leader (`let mapleader = " "`) | `leaderKey('<Space>')`; the parser emits `<leader>x` as `<Leader>x` |
| `"*` | `starRegister()` (`nmap "* "+`, `vmap "* "+`) |
| `"+p` | `clipboardPaste()` |
| `U` | `lineUndo()` (`nmap U u`), if Kim accepts the changed meaning |
| `:w` and every §4 ex command | `Vim.defineEx` |
| `:set rnu nu wrap` | `setOptions(view)` |
| Insert `Ctrl-h` | `imap <C-h> <BS>` (or the `insertCtrlH` keymap) |
| `zo zc za zR zM` | `foldKeys()` with `codeFolding()`/`foldGutter()` |

## Gaps for the `?` overlay ("What Vim mode can't do")

- `it` and `at` do nothing in a TypeScript buffer (no HTML/XML tags in the tree).
- Insert-mode `Ctrl-w`: Chrome keeps the key; use `Ctrl-Backspace`.
- `U` is a plain undo, not "undo the last changed line" (if the mapping ships).
- A custom mapping cannot start with a key that is a command on its own (`<Space>`, `,`, `s`, ...); use `<leader>`.
- `?` from inside a match skips that match; `a"` `a'` `` a` `` do not take the surrounding space.
- Visual block: `I`, `A`, `$A`, `c`, `d` are known to work; other insert edge cases are untested.
- No `zf`, `zd`, `zj`, `zk`; no `g;`, `g,`, `gx`, `gf`; `gq` and `:normal` work but are not promised.

## Needs Kim

1. `pnpm spike:vim`, open http://localhost:5179 in a Chrome tab, tick "preventDefault on every Ctrl key", click into the editor and press every key in the table above. A key that reaches the page appears in the log as "page prevented default"; a key the browser keeps never appears (and may open a tab, a window or a browser page). Fill the "Tab" column.
2. Chrome menu → Cast, save and share → Install page as app (or the install icon in the address bar). Repeat step 1 in the installed window and fill the "Installed window" column.
3. Clipboard round trip: in normal mode type `"+yy` and paste in a terminal; copy a line in a terminal and type `"+p` in the editor. Both directions should carry the text; note whether Chrome asked for the clipboard permission.
4. Record the three answers in the table above (and tick the Prep items under "For Kim" in docs/progress.md).
