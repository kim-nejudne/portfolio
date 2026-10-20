# Progress

The v1 checklist for ts-dojo: Prep from §11, then every acceptance criterion from docs/spec.md §12, copied verbatim (74 boxes; a trailing `(by hand)` tag was added to the two checks only Kim can do that §12 leaves untagged). Tick a box only when the `acceptance-reviewer` agent reports it met with evidence (a test name or `file:line`), or when Kim confirms a by-hand or droplet check. Claude never ticks a by-hand or droplet item.

**Build order (§11):** Prep → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F15 → F11 → F12 → F13 → F14 → v1 gate. One feature per session, one commit per feature (`F<n>: <title>`). The sections below are in this order; the SessionStart hook reads the first one with an unchecked, automatable item as the current feature.

**Tags**

- `(by hand)`: needs Kim in a real browser; listed under "For Kim" with the exact steps. Never claimed by Claude.
- `(droplet)`: checked on the droplet after Kim deploys. Same rule.
- §12 lists F12–F14 as one block; here each wave is its own section because §11 builds and commits them one at a time.

§11 gates are quoted under the feature that closes them.

## Prep

- [x] The §4 Vim checklist has a recorded result for every item: pass, workaround (with the mapping), or gap.
- [x] `public/ts/6.0.3/` holds every `lib.*.d.ts` from `typescript@6.0.3`, and §2's sizes are confirmed or corrected.
- [ ] `dojo.kimnejudne.dev` resolves to the droplet. (by hand)

> **Gate (§11):** every P item passes or has a working mapping, and the W list is written down.

**Notes (17 October 2026)**

- Vim spike: `spike/vim/` (the page, `workarounds.ts`, and `checklist.spec.ts`: 94 Playwright tests in Google Chrome 155 through `channel: 'chrome'`, `pnpm spike:vim:check`). The record is docs/prep-vim.md, one row per §4 item with its test. Every P item passes as shipped except four that need a definition, which the gate allows: `"*` (mapped to `"+`), `"+p` (`clipboardPaste()`, see the next bullet), `U` (mapped to `u`, see Spec questions) and `:set rnu/nu/wrap` (`Vim.defineOption`); `:w` is the app's own `defineEx`, and visual block needs one editor setting (next bullet). Of the W items, jumps, macros, `:g`, `:sort` and insert-mode `Ctrl-u Ctrl-o Ctrl-r` pass as shipped; insert `Ctrl-h` needs `imap <C-h> <BS>`; folds need `Vim.defineAction` plus `Vim.mapCommand` over CodeMirror's fold commands; `it`/`at` is a gap in TypeScript buffers; insert `Ctrl-w` stays the browser gap (`Ctrl-Backspace` instead). `defineAction` is confirmed. `:normal` and `gq` work although §4 expects neither.
- Findings that shape F3: visual block needs `EditorState.allowMultipleSelections.of(true)`; the engine runs the first full key match and waits only when nothing matches in full, so a Space leader works only through a virtual key (`leaderKey()`), the vimrc parser expands `<leader>` itself, a mapping to `:cmd` needs its `<CR>`, and re-applying the vimrc must `mapclear` first because `unmap` only removes the newest definition; `"+p` pastes with a stale linewise flag (`clipboardPaste()` fixes it). Browser-reserved keys and the clipboard round trip are Kim's (For Kim).
- Lib files: `scripts/copy-ts-libs.ts` copies the 107 `lib.*.d.ts` files (3,783,805 bytes) into `public/ts/6.0.3/`, proven by `scripts/copy-ts-libs.test.ts`. The folder is generated, so it is gitignored; today `pnpm copy-ts-libs` (or `pnpm test --run`, whose §12 test runs the copy) creates it, and F1 wires the copy into `build` and `dev` as §2 says. `lib.d.ts` (the ES5 + DOM + scripthost default) also sits in `typescript/lib` but is not a `lib.*.d.ts` and is not copied; it is the one name `knownLibFilesForCompilerOptions` returns after option conversion, so an F2 that followed §2 literally would request `/ts/6.0.3/lib.d.ts` and get a 404. §2 sizes, measured:

  | What | §2 | Measured | |
  | --- | --- | --- | --- |
  | ES chain `es5`–`es2025` (what `lib.es2025.d.ts` resolves) | 569,639 | 573,813 bytes, 76 files: 74 ES files (559,373) plus `lib.decorators.d.ts` and `lib.decorators.legacy.d.ts`, which `lib.es5.d.ts` references | corrected |
  | `lib.dom.d.ts` | 2,351,349 | 2,349,483 bytes | corrected |
  | decorators | 14 KB | 13,153 + 1,287 bytes | confirmed |
  | scripthost | 9 KB | 9,412 bytes | confirmed |

  `knownLibFilesForCompilerOptions` does not return only ES files for the default options, or anything usable: see Spec questions.
- Setup added for Prep, which F1 extends: `package.json` (pnpm 12.11.2, exact pins for everything §2 pins), `tsconfig.json` with the §2 flags, Prettier (`singleQuote`; `*.md` and `.claude/` ignored so the spec and the hooks keep their formatting), Vitest, Playwright 1.64.1 driving the installed Chrome (its own Chromium 1248 is not in the cache). No ESLint yet, so the pre-commit hook runs typecheck, format:check and the tests.

## F1. Scaffold

- [x] `pnpm dev`, `build`, `preview`, `typecheck`, `lint`, `format:check`, `test --run` and `test:e2e` exist and pass on a clean clone with Node 24 and pnpm 12.
- [x] GitHub Actions runs typecheck, lint, format check, unit tests and build on every push and pull request.
- [x] `tsconfig.json` has every flag listed in §2.
- [x] Every route in §6 renders a placeholder, in light and dark, and `?` opens the help overlay.
- [x] shadcn is initialised with `base-nova` and the Button, Dialog, Tabs, Tooltip, Command and Sheet primitives.

**Notes (17 October 2026)**

- Reviewed PASS by the acceptance-reviewer on 17 October 2026: every check run by the reviewer itself (typecheck, lint, format:check, 41 unit tests, 19 Playwright tests in Chrome, build, plus `pnpm dev` served `/`, a deep link and a lib file). Criteria 1 and 2 are ticked on the repository-side evidence (`scripts/scaffold.test.ts`, the workflow file, the lockfile matching `package.json`); the live run on GitHub needs Kim's push and is the F1 item under "For Kim".

- Scripts (§2 Build): `dev` and `build` run `copy-ts-libs` first, then Vite. `typecheck` is `tsc` over two projects: `tsconfig.json` is the app (`src/`, `jsx: react-jsx`, `types: ["vite/client"]`, every §2 flag) and `tsconfig.node.json` extends it for the Node side (`scripts/`, `spike/`, `e2e/`, the config files, `types: ["node"]`), so the flags are written once. `.npmrc` sets `save-exact`; every dependency is pinned exactly (Prep's convention), shadcn's additions re-pinned by hand after its init because it writes `^` ranges itself.
- shadcn 4.22.0 has no `base-nova` preset flag: `pnpm dlx shadcn@4.22.0 init -b base -p nova -y` (Base UI library, Nova preset) writes `style: "base-nova"`, `rsc: false`, and `add button dialog tabs tooltip command sheet -y` also adds `input`, `textarea` and `input-group`, which `command` depends on. Base UI is `@base-ui/react` 1.9.0; `command` is `cmdk` 1.1.1; `cn` 0.4.0 replaces clsx + tailwind-merge; `shadcn` itself is a runtime dependency because `globals.css` imports `shadcn/tailwind.css`, pinned at 4.21.5, the version the 4.22.0 CLI wrote and installed for itself (the CLI ran through `pnpm dlx`, the dependency is only that stylesheet). `src/lib/utils.ts` is shadcn's own helper path, the one file outside the §2 layout. `input-group.tsx` carries one scoped `eslint-disable-next-line` for two jsx-a11y rules: its addon's click handler only forwards focus to the input, and keyboard users reach the input directly.
- Type (§6): the mono face is JetBrains Mono, confirmed, through `@fontsource-variable/jetbrains-mono` 5.3.0 and `--font-mono` in `src/app/globals.css`; the sans face is Geist (`@fontsource-variable/geist`), what the Nova preset installs. Both are self-hosted and the build emits their woff2 subsets.
- Theme (§6, §7): `src/app/theme.ts` reads `theme` from the `ts-dojo:settings` object (`src/store/settings.ts`), follows `prefers-color-scheme` for `system` or nothing, and toggles `.dark` on `<html>` (Tailwind's `@custom-variant dark`) plus `color-scheme`. It runs from `main.tsx` before the first render because the §10 CSP has no `'unsafe-inline'` for scripts; a stored `light` or `dark` under the opposite system scheme can show the system colours for one frame until then (F10 can add CSS-only tokens for that case if it shows).
- Routes (§6): `createBrowserRouter`; `l/*` stands for `/l/:lesson` and `/l/:lesson/:exercise` because lesson ids contain a slash (`parseLessonPath` in `src/app/lesson-path.ts`; see Spec questions). A `*` route renders "Not found", since nginx serves `index.html` for every path.
- Keys (§6): `src/app/keys.ts` holds the §6 table (the overlay renders it) and the pure matcher; `useGlobalKeys` listens on `window` and skips editable targets and anything inside `.cm-editor` (the conflict rule). Only `?` is wired: F3 adds `Ctrl-p` and the two-key sequences, F8 the pane keys. The overlay is shadcn's `Dialog` with the Vim gaps list from docs/prep-vim.md (`src/editor/gaps.ts`); the listener mounts in an effect, so a Playwright test waits for the page's `h1` before pressing `?`.
- e2e: root `playwright.config.ts`, Google Chrome through `channel: 'chrome'` (Playwright 1.64.1's Chromium 1248 is not in the cache), one `webServer` running `pnpm build && pnpm preview --port 4173` (Kim's online-voting convention; what F15 needs for the service worker and the CSP; a preview already listening is reused outside CI). CI does not run e2e, which §12 F1 does not ask for; it runs on Kim's machine.
- Lint covers the Prep spike too: three `no-unsafe-return` lines in `spike/vim/checklist.spec.ts` were wrapped in blocks. `eslint-plugin-react-refresh` is not in §2 and was left out.
- Measured: `vite build` 340 ms; `index-*.js` 412 KB raw, 135 KB gzip; CSS 64 KB raw, 13 KB gzip; typed `pnpm lint` about 5 s. No compiler in the bundle yet (F2).
- Left for later features: the compiler status chip in the header (F2), `Ctrl-p` and the palette (F3), the pane keys and the conflict-rule Playwright test (F8), `content:lint` in CI before the build (F6), `vite-plugin-pwa` and the CSP check (F15).

## F2. Language-service worker

- [x] The worker reports `ready` with `tsVersion` `6.0.3`, and no request leaves the origin (Playwright network log).
- [x] `openProject` with `lib: ["es2025"]` fetches only ES lib files; with `libs: ["dom"]` it also fetches `lib.dom.d.ts`, once.
- [x] `getDiagnostics` on a 200-line fixture returns in under 300 ms p95 after warm-up, measured by a Vitest benchmark on the core module.
- [x] `getQuickInfo` returns the display string and docs for an identifier; `getTwoslashQueries` returns one entry per `^?` with the right line and text, and an error entry when the query points at whitespace.
- [x] `emit` returns JavaScript with an inline source map for every file and elides type-only imports.
- [x] A reply with an older `version` than the file's current one is dropped by the client (unit test).
- [x] `lintAst` reports every rule in §5 on a fixture, with file and line.
- [x] `runTypeTests` groups diagnostics into cases as §5 describes, including the TS2578 case.

**Notes (17 October 2026)**

- Reviewed PASS by the acceptance-reviewer on 17 October 2026, every criterion MET, every check run by the reviewer itself: typecheck, lint, format:check, 106 unit tests, `pnpm bench` (p95 23.86 ms in its run), 22 Playwright tests in Chrome (the 3 F2 compiler tests and the 19 scaffold tests). No F2 criterion is by hand or droplet, so nothing joins "For Kim". After the review the client gained one guard the reviewer flagged for F3 (`openProject` rejects requests still in flight for the previous project with `ProjectChangedError`, since every path restarts at version 0 and the version check alone could not tell), with its unit test; all checks were run again before the commit.
- Layout (§2): `src/protocol/ts-ls.ts` holds every §2 message, the `Diag` shape and `DEFAULT_COMPILER_OPTIONS`; `src/workers/ts-ls/core.ts` is the pure core (one `ts.LanguageService` over `@typescript/vfs`, every request a method), with `libs.ts` (lib chain), `twoslash.ts` (`^?` sites), `rules.ts` (§5 walkers), `type-tests.ts` (case finder), `ambient.ts` (the runtime `.d.ts`); `adapter.ts` serves the core over a port and `worker.ts` is the three-line Worker entry; `client.ts` is the main-thread side (request ids, versions, stale drop, status, §9 restart); `node/fetch-lib.ts` reads libs from `node_modules` for Vitest and the F6 content lint; `fixtures/two-hundred-lines.ts.txt` is the benchmark file. `src/verify/rules.ts` (ids, messages, always-on set) and `cases.ts` (range grouping) are shared with F7. `src/app/compiler.ts` holds the one client, started from `main.tsx` before the first render (§9 warm-up), and `compiler-status.tsx` is the header chip (`role="status"`, `aria-label="compiler status"`: "compiler loading" → "TypeScript 6.0.3"; "compiler restarting", then "compiler restarted" for 5 s; "compiler failed" after three crashes in a row).
- Protocol decisions, now in `src/protocol/ts-ls.ts` and the ts-worker skill: paths are virtual-FS absolute (`/index.ts`; `/dojo/*` and `/lib.*.d.ts` reserved); offsets 0-based, lines and columns 1-based; `openProject`, `updateFile` and `dispose` have no reply because §2 lists none: the worker handles requests in order, so the next request's reply means the project is open, and a failure comes back as `error` with that requestId (the client routes it to `onError`); `ProjectFile.version` exists so a restart re-sends the current versions; `error.requestId` is null for a malformed message. One `DocumentRegistry` per core and core-wide unique version strings for project files (libs stay at "0"), with the previous service disposed only after the new program is built, so the lib SourceFiles are parsed once and reused across projects (`core.test.ts` asserts the same `lib.es5.d.ts` object before and after a swap; swap plus first diagnostics 43 ms against 263 ms cold in the planning probe).
- Rules (§5): `implicit-any` reports codes 7006 and 7031 from a second check of the same files with `noImplicitAny` forced on, because with it off the compiler reports implicit anys only as "a better type may be inferred" suggestions under other codes (7044 and friends); the second service shares the registry. `eval` flags every reference to `eval` (an alias is a call waiting to happen), the global object's `eval` or `Function`, `new Function(...)` and `Function(...)`, and leaves a user object's own `eval` method alone. `ts-directive` walks every comment through the token tree and uses the compiler's own directive forms plus `@ts-nocheck`. Type cases are top-level tuple aliases named `cases*` and top-level `@ts-expect-error` statements; a diagnostic belongs to every case range it overlaps.
- Tests run in the Node project: `tsconfig.json` now excludes `src/**/*.test.ts(x)`, `src/**/*.bench.ts` and `src/**/node`, which `tsconfig.node.json` includes (with its own `exclude`, since the inherited one would hide them; ESLint's Node block matches the same globs). The benchmark is Vitest 5's `bench` test-context fixture under `benchmark.include` (`pnpm bench` = `vitest bench --run`; `bench` is no longer a top-level export in Vitest 5), and `core.test.ts` asserts the same p95 inside `pnpm test --run`. The 200-line fixture is `.ts.txt` so tsc, ESLint and Prettier leave it alone.
- Measured (`pnpm bench`, Node 24 on Kim's laptop, 17 October 2026; the result file is `test-results/ts-ls-diagnostics.bench.json`): `getDiagnostics` on the 200-line fixture after an edit, warm, 70 samples: p50 13.0 ms, p95 23.3 ms, p99 25.6 ms, mean 14.3 ms, max 27.8 ms, against the §9 budget of 300 ms p95; `core.test.ts` measures the same cycle 40 times inside `pnpm test --run` and asserts p95 under 300 ms. Cold `init` (76 libs fetched from disk and parsed) about 140 ms in Node. The worker chunk built by Vite 8 is 3,556,432 bytes raw, 990,257 gzip, 745,433 brotli (§2's 9,144,216 raw and 1,531,825 brotli describe the unminified package); `index-*.js` 417,450 raw, 116,333 brotli; `vite build` 1.4 s. In `pnpm dev`, headless Chrome: "compiler loading" → "TypeScript 6.0.3" in 3.3 s on the first load (Vite optimises `typescript` and reloads once) and 1.1 s on the next, 76 distinct lib requests, no DOM, every request same-origin, no console error.
- Left for later features: F3 wires diagnostics, hover, completions, signature help, definitions and `^?` widgets to `getCompiler()`; F4 widens `/dojo/runtime.d.ts` to the shim and runs `emit`'s modules; F6's content lint uses `createTsLsCore({ fetchLib: nodeFetchLib })`; F7 picks the `@dojo/type-utils` mechanism (F2's tests use a `declare module` in `dtsFiles`, which resolves with no `paths` entry) and assembles the verdict from `runTypeTests` and `lintAst`; F15 precaches `/ts/6.0.3/**` and measures the worker's memory and cold `ready` in Chrome. The 5 s restart notice is the chip's own timer and is not unit-tested; the restart logic is.

## F3. Editor

- [x] Every P item in the §4 checklist passes in Chrome; every W item has its mapping or definition applied by default.
- [x] The shipped vimrc applies; `imap jk <Esc>` works; a bad vimrc line is reported with its number and skipped, and the good lines still apply.
- [ ] Every ex command in §4 does what its row says, including `:w` running the code and `:set rnu` persisting.
- [x] Squiggles and gutter marks appear within 300 ms of typing stopping; `]d` and `[d` move between diagnostics; `K` shows quick info at the cursor; `gd` jumps to a definition in another file.
- [x] A `//   ^?` line shows the queried type under it and updates on edit.
- [x] Completions open on typing and `Ctrl-Space`; `Ctrl-j`/`Ctrl-k` and `Tab`/`Shift-Tab` move; `Enter` or `Ctrl-y` accept; `Esc` closes and returns to normal mode.
- [ ] `"+y` and `"+p` use the system clipboard over HTTPS and on localhost.
- [x] Multi-file: tabs, `:b`, `:ls`, `gt`, `gT`; a lesson `.d.ts` is read-only and marked.
- [x] Editing works before the compiler is ready, with the status chip showing.

**Notes (17 October 2026)**

- Reviewed by the acceptance-reviewer on 17 October 2026, every check run by the reviewer itself (typecheck, lint, format:check, 149 unit tests, 174 Playwright tests in Chrome): criteria 1, 2, 4, 5, 6, 8 and 9 MET; criterion 7 MET on localhost and NEEDS KIM for HTTPS (the "For Kim" item, after F15), so its box waits for Kim; criterion 3 NOT MET as written because `:w` running the code and the rows F4, F5, F7, F8 and F9 own are those features' work, which the F3 plan agreed (Spec questions); every row with an F3 target is proven, so F3's own scope is complete and the reviewer's verdict reads "FAIL (as written)". The box for criterion 3 stays open until F4–F9 close their rows; the SessionStart hook will keep naming F3 until then. After the review, three of its remarks were applied: the visual-mode pane keys (below), the F8 ownership of `:hint`/`:sol`/`:reset` in the Spec questions entry, and the `U` and `it`/`at` record under that same section.
- Layout (§2): `src/editor/controller.ts` owns the one `EditorView`, one `EditorState` per project file (own history and cursor; `view.setState` on a switch, deferred one microtask past the engine's key handling so a `gt` mapping or `:b` typed at the prompt does not replace the state under the prompt's close) and every ex command's dispatch; `editor.tsx` renders the tabs (`role="tab"`, `data-readonly` and a "read-only" badge for a lesson `.d.ts`) and the vimrc status line; `extensions.ts` is the Prep spike's setup plus the type feedback and a theme on the Tailwind tokens (`--syntax-*` and `--editor-*` in globals.css for light and dark); `vim-defaults.ts` is the spike's `workarounds.ts` lifted (fold actions, `clipboardPaste`, `starRegister`, `lineUndo`, `leaderKey`, `insertCtrlH`); `vimrc.ts` the parser and apply step; `options.ts` the `:set` options as `Vim.defineOption` callbacks over two compartments; `ex-commands.ts` the §4 table as data (registration, parsing, the palette items); `host.ts` the action types and the `EditorHost` a page implements; `diagnostics.ts`, `twoslash.ts`, `quick-info.ts`, `completions.ts`, `signature-help.ts`, `definition.ts` the §4 type feedback over `getCompiler()`; `registry.ts` the mounted editor and the Playwright seam `window.__tsDojo` (the spike's `window.__spike` convention). `/repl` (`src/pages/repl.tsx`) is the F3 host: a fixed demo project (`index.ts`, `shapes.ts`, read-only `units.d.ts`), a Problems list and the host messages in an output region; F5 swaps the file set for the Dexie buffers and F4 turns the region into the output pane.
- Vim (§4): every P and W item of the checklist runs on `/repl` in `e2e/editor-vim.spec.ts` (73 tests, the spike's checklist ported with the definitions on by default). Engine facts that shaped the code: `mapclear` empties the whole user layer, `Vim.mapCommand` entries included, so the fold keys are re-mapped with the leader, `"*` and `U` after every clear (`vimDefaultMappings`), before the vimrc lines; `@codemirror/lint`'s `nextDiagnostic` selects the range and the adapter turns a selection into visual mode, so `]d`/`[d` walk the lint state and move a plain cursor (`moveToDiagnostic`); the engine re-focuses the editor when the `:` prompt closes, so a host action from a command runs one microtask later; the adapter refuses edits in a `readOnly` state before any transaction, so the read-only notice shows on opening the tab (the transaction filter stays as a guard); the `:set` callback is called once globally and once per editor, the code acts on the global call; the updateFile listener comes before the feedback listeners so a signature-help request follows the `(` into the worker (otherwise the reply is stale and dropped).
- vimrc (§4): `SHIPPED_VIMRC` is the §4 text; the parser knows the `map` family, `unmap` (and `nunmap iunmap vunmap`), `set opt / noopt / opt=value`, `let mapleader = "<key>"` and `"` comments, expands `<leader>` to the virtual `<Leader>` key, reports a bad line with its number (parse errors and the engine's own refusals, like an unknown `:set` option) and applies the rest; the editor shows the list under the editor (`role="status"` named "vimrc") and in a notification. A custom vimrc replaces the shipped one (not an overlay). `U` ships as a plain undo, insert `Ctrl-h` and the visual-mode `Ctrl-h/j/k/l` pane mappings (§4 prose; the vimrc has `nmap` only) are applied in code, so the Settings vimrc text stays exactly §4's (Spec questions).
- `:set` persistence (§4, §7): `relativeNumbers`, `lineNumbers`, `wrap` and `theme` in `ts-dojo:settings`; the vimrc's own `set` lines and the stored values apply without persisting, an interactive `:set` persists; stored values win over the vimrc's `set rnu` because they are Kim's later choice; `src/app/theme.ts` now follows every settings write, so `:set bg=` and the F10 Settings page change the theme the same way. `lineNumbers` and `wrap` are two keys §7 does not list: see Spec questions.
- Ex commands (§4): all 30 table entries and 7 aliases registered (`src/editor/ex-commands.test.ts`), in the palette (42 items, variants listed as their own items, `:b`/`:e` open the `:` line pre-filled) and the `?` overlay. Proven on `/repl` in Chrome (`e2e/editor-ex.spec.ts`): `:b :ls :bnext :bprev :dnext :dprev :info :def :set :help :h :roadmap :rm :output :practice :focus up/down`; `:w`/`:run` transpile through `emit` and hand the modules to the host (the message "emitted 2 modules" on /repl). The rows F4 (`:w` running, `:kill`), F5 (`:e`, `:bd`), F7 (`:test`), F8 (`:hint :sol :reset :done :next :prev :lesson :theory :layout :prompt`, pane focus to the theory pane) and F9 (`:export`) own answer with the owning feature in a notification and are proven when those features land; the box stays open until then (Spec questions).
- Type feedback (§4): diagnostics 200 ms after typing stops (`linter({ delay: 200 })` + `lintGutter()`), every file's list to the page, the `^?` widgets refreshed in the same cycle; `e2e/editor-types.spec.ts` measures keyup to squiggle in the page and asserts ≤ 300 ms after one warm cycle. Completions through a highest-precedence DOM handler ahead of the Vim plugin (`Ctrl-Space`, `Ctrl-j/k`, `Tab`/`Shift-Tab`, `Ctrl-p` up, `Enter`/`Ctrl-y`, `Esc` closes and exits insert mode); `Ctrl-p` in normal mode opens the palette, in insert mode it is completion (§6). Signature help on `(` and `,`. `gd` across files through `getDefinition`; a lib location is reported, not opened.
- Global keys (§6): `Ctrl-p` and the two-key sequences `g r` (wired), `g n`, `g p`, `] e`, `[ e` (matched, handlers at F8) with a 1 s sequence timeout; the palette is shadcn's `Command` in a dialog; `Esc` restores focus through the dialog.
- Dependencies: `@codemirror/lint` 6.9.7 and `@codemirror/autocomplete` 6.20.3 (§2 names both), plus `@lezer/highlight` 1.2.5 made a direct dependency for the `tags` import the highlight style needs (it is `@codemirror/language`'s own dependency; pnpm's strict layout does not expose it otherwise).
- Tests: 149 unit tests (`pnpm test --run`); 174 Playwright tests (`pnpm test:e2e`, Chrome, about 40 s after the build): the 73-test checklist port plus `editor-vimrc`, `editor-ex`, `editor-types`, `editor-clipboard`, `editor-files`, `editor-before-ready` and `palette`, next to the F1/F2 specs (the F1 overlay test now counts the global keys table only, since the overlay gained the ex table).
- Measured (`vite build`, 17 October 2026): `index-*.js` 1,109,650 bytes raw, 364,990 gzip (F2: 417,450 raw; CodeMirror, the Vim engine, lang-javascript and cmdk joined the main chunk), CSS 66,720 raw, 13,370 gzip, the worker chunk unchanged at 3,556,432; build 1.7 s. §9's budgets are measured at F15; a split of the editor into its own chunk is an option then.
- **F5 (20 October 2026)** closed the `:e` and `:bd` rows of criterion 3 (`e2e/repl-buffers.spec.ts`) and replaced the `/repl` demo project with the welcome buffers (`index.ts`, `shapes.ts`, both editable). Criterion 8's read-only `.d.ts` half therefore lost its `/repl` test; the controller code is unchanged and F8 re-proves it on the lesson page with a real lesson `.d.ts`. Criterion 3 stays open for the rows F7, F8 and F9 own.
- Left for later features: running the emitted modules and the output pane with its tabs (F4); scratch buffers, `:e`, `:bd`, autosave (F5); the lesson page's host (F7–F9); the Settings page's vimrc editor (F10: `writeSettings({ vimrc })` re-applies through `subscribeSettings`); lessons and exercises in the palette (F6/F8); the pane keys `1 2 3`, `Ctrl-h/j/k/l` outside the editor and `Esc` (F8).

## F4. Sandbox runner

- [x] `console.log` of a string, a nested object, a Map, a class instance and an Error renders readably with its source line.
- [x] `while (true) {}` is terminated at the deadline, the page stays responsive throughout (Playwright keeps typing during the run), and the status reads "killed after 5 s".
- [x] A thrown error shows the message and the TypeScript file and line; `Enter` on it moves the cursor there.
- [x] Two files importing each other without a cycle run in the right order; a cycle falls back to CommonJS and still runs (fixtures for both).
- [x] Top-level `await` works in a single-file run.
- [x] Output stops at 500 entries or 200 KB with one truncation line.
- [x] A pending `setTimeout` after the entry settles shows "still running (1 timer)"; `:kill` ends it.

**Notes (18 October 2026)**

- Layout (§2, CLAUDE.md): the pure cores under `src/workers/sandbox/` run in Node and in the worker: `serialize.ts` (console arguments as text: depth 3, cycle-safe, Error, Map, Set, Date, class names, functions, typed arrays; a top-level string raw, a nested one quoted), `source-map.ts` (the inline v3 map decoded with about 40 lines of VLQ, no library), `modules.ts` (bundler-style resolution of relative specifiers to project files, the import graph, dependency order, cycle detection, specifier rewriting at the spans ts reports), `loader.ts` (ES modules: one URL per module built leaves first with its specifiers rewritten, then `import(entry)`; CommonJS: each module wrapped in `export default function (require, exports, module) {…}`, every wrapper imported, the entry run with a cached `require`, Node's partial-export semantics for the cycle) and `prelude.ts` (the console shim installed on the given global, the frame → TypeScript position mapping through a registry of loaded URLs, the timer wrappers that count pending timers, the output caps). `worker.ts` is the adapter: one `run` per worker, blob URLs, `error` and `unhandledrejection` → `runtimeError`, `done` when the entry settles. `runner.ts` is the main-thread owner (the analogue of F2's `client.ts`): resolves the graph, re-emits as CommonJS on a cycle, spawns the worker, keeps the deadline timer on the main thread where a tight loop cannot block it, terminates on the deadline, on `:kill` and when the next run starts, and holds the run state the pane renders. `src/protocol/sandbox.ts` has the messages, `DEFAULT_TIMEOUT_MS` 5000, the caps 500 entries / 200 000 bytes (UTF-8) and `TEST_TIMEOUT_MS` 1000 for F7. `src/app/output-pane.tsx` is the §4 pane (Console, Problems, Tests, the status line `role="status"` "run status"), `src/app/run-status.ts` its text, `src/app/sandbox.ts` the app's runner (`new Worker` + the ts-ls client for the fallback); `/repl` hosts it and F8's lesson page reuses it.
- Protocol: `emit` gained an optional `module: "commonjs"` and `EmittedFile` an `imports` list (specifier and its span, from `ts.preProcessFile` on the emitted text, so the rewriting needs no regex; empty for CommonJS output); the sandbox has a `truncated { entries, bytes }` message and sends `done` a second time with `pendingTimers: 0` when the last timer drains (Spec questions). `mode: "test"` is accepted and runs the entry like `run` until F7 adds the harness.
- Status line (§4, §12): `running`, `done in 12 ms` / `done in 1.3 s`, `killed after 5 s` (the deadline reports the configured time), `killed after 412 ms` (`:kill` reports the elapsed time), `still running (1 timer)`, `failed: <reason>` (an import outside the project, an emit error); `(CommonJS: cyclic imports)` is shown next to it after the fallback. The deadline is absolute from the start of the run and ends a "still running" run too; on `done` with no timers pending the worker is terminated at once (nothing can run any more).
- Pane keys: `j`/`k` move the selection, `Enter` opens the entry's file at its line and column through `openFileAt` on the editor handle (new in `src/editor/registry.ts`), `h`/`l` switch the tabs, `Esc` returns to the editor; `:w` switches to Console; `:kill` with nothing running says so in the Vim panel. The Problems and Tests panels stay mounted (`keepMounted`) so the F3 tests keep counting diagnostics; the Tests tab is a placeholder until F7.
- Engine facts that shaped the code: Chrome does not apply source maps to `Error.stack`, so the shim and the error path map themselves through the module's inline map; `ts.preProcessFile` reports an import's `pos` at the opening quote and `end` without the closing one; TypeScript's CommonJS output hoists `exports.a = void 0` above the `require`, so a module in a cycle sees the key with `undefined` (the fixture asserts that); a cycle with top-level `await` cannot run (the factories are synchronous) and surfaces as a runtime error; Node 24 imports `data:` URLs, which is how the loader tests run real `transpileModule` output without a browser.
- `src/workers/ts-ls/ambient.ts`: the shim provides exactly `console.log/info/warn/error/debug` and the four timers, and the worker has its own `queueMicrotask`, so the F2 declaration already matched; only its comment changed.
- Reviewed PASS by the acceptance-reviewer on 18 October 2026, every criterion MET, every check run by the reviewer itself (typecheck, lint, format:check, 197 unit tests, 183 Playwright tests in Chrome); its one remark, a `j`/`k` movement test over several entries, was added afterwards (`e2e/sandbox.spec.ts`, 184 Playwright tests now). No F4 criterion is by hand or droplet, so nothing joins "For Kim".
- Tests: 197 unit tests (`pnpm test --run`; new: `serialize`, `source-map`, `modules`, `loader`, `prelude`, `runner`, `run-status`, plus the two emit tests in `core.test.ts`); 184 (about 45 s after the build) Playwright tests (`pnpm test:e2e`): `e2e/sandbox.spec.ts` proves the seven criteria plus the pane keys, and the F3 `:w`/`<Space>r` tests now assert the console output (`12.57 cm`).
- Measured (`vite build`, 18 October 2026): the sandbox worker chunk is 8.3 KB; `index-*.js` 1,136,150 bytes raw, 374,370 gzip (F3: 1,109,650). In Chrome (`e2e/sandbox.spec.ts`, in-page `performance.now()`): `:w` to the `running` status 18–33 ms, `running` to `killed` 4,999–5,000 ms; the §9 budget for a trivial run is measured properly at F15.
- Left for later features: the test harness, `mode: "test"` and the Tests tab (F7); the lesson page hosting the pane and the attempt row before a run (F8); the default timeout from Settings (F10, `DEFAULT_TIMEOUT_MS` until then); the §9 "run of a trivial file under 150 ms" measurement (F15).

## F5. Standalone REPL

- [x] `/repl` opens the last buffer; `:e name` creates or switches; `:ls` lists; `:bd` deletes after confirmation.
- [x] A buffer survives a reload, autosaved within 1 s of the last keystroke.
- [ ] Open in REPL from a theory block creates a buffer with the snippet and focuses the editor in normal mode.

> **Gate (§11):** the REPL works: Vim checklist, diagnostics, `^?`, run, kill, clipboard.

**Notes (20 October 2026)**

- Reviewed by the acceptance-reviewer on 20 October 2026, every check run by the reviewer itself (typecheck, lint, format:check, 215 unit tests, 197 Playwright tests in Chrome): criteria 1 and 2 MET; criterion 3 NOT MET as written, "F5's half proven": everything after the click (`createReplBuffer`, the navigation, the last buffer opening, the editor focused in normal mode) is implemented and driven in Chrome through the app seam, but the trigger the criterion names, a theory block, does not exist before F6, the same situation as F3's criterion 3. The verdict reads "FAIL (as written)" with nothing in F5 to fix; the box stays open until F6 ships a Playwright test that focuses a `ts run` block, presses `Enter` and asserts the `/repl` landing (`.cm-content` focused, mode normal, document equal to the block's snippet). The SessionStart hook will keep naming F3 and F5 until F6–F9 close their rows.
- Layout (§2, CLAUDE.md): `src/store/db.ts` is the Dexie database `ts-dojo`, version 1, with all five §7 tables declared at once (`lessons: id`, `exercises: id`, `attempts: ++id, exerciseId`, `buffers: name`, `meta: key`) and their row types, so F7–F9 add rows without a schema version; the fields are `declare`d because `useDefineForClassFields` would otherwise shadow the tables Dexie sets in `super()`. `src/store/buffers.ts` is the name rule behind `:e` (`^[A-Za-z0-9][A-Za-z0-9._-]*$`, `.ts` appended when missing, so `notes` and `notes.ts` are one buffer), the path mapping (`notes.ts` ↔ `/notes.ts`), `allocateBufferName` (`scratch.ts`, `scratch-2.ts`, …) and the queries over `buffers` and `meta.lastBuffer`; `src/store/autosave.ts` the per-key 500 ms debounce (§7) with `flush` and `forget`. `src/pages/repl.tsx` reads the buffers on mount (and again on a new navigation to `/repl`, which Open in REPL from the page itself causes), seeds the two welcome buffers (`src/pages/welcome-buffers.ts`: the F3 demo's `index.ts` and `shapes.ts`, `const unit = 'cm'` in place of the `Unit` line) when the table is empty, opens the last buffer first and focuses the editor; `:e` and `:bd` are its host actions, `:w` runs the current buffer. `src/editor/confirm.ts` is the `y/n` prompt in the Vim panel through the adapter's `openDialog` (the engine's own `:s///c` mechanism; `role="alertdialog"`, a labelled input; `y` deletes, `n`, `Esc`, `Enter` or a lost focus keeps). `src/app/open-in-repl.ts` is the Open in REPL action (`createReplBuffer` + `/repl`), on `AppActions` for F6's block button and published as `window.__tsDojoApp.openInRepl` (`src/app/seam.ts`) for Playwright until then.
- Editor (§4): the controller's file set is live (`addFile(file, index?)`, `removeFile`, `files`, `onFilesChange`), `:e` inserts in name order (the order a reload shows), the tabs render from the live set, and a change re-opens the project with the live texts because the §2 protocol has no add or remove (the worker reuses the parsed libs through its registry; in-flight requests are rejected as `ProjectChangedError`, which the feedback extensions already drop). `removeFile` of the current buffer returns to the alternate buffer (the one it was opened from, as Vim does), else the next one. `entry` and `initial` are optional editor props: on `/repl` the entry is the current buffer and the initial file is the last buffer. `EditorFile` moved to `src/editor/host.ts`.
- Decisions: welcome buffers on an empty table ("/repl opens the last buffer" needs something to open on the first visit); `:bd` on the only buffer is refused ("cannot delete the last buffer": the REPL has no unnamed buffer); `:w` on `/repl` runs the buffer being edited (§4's "entry file" of a scratch-buffer REPL), so the F4 cycle fixture switches back to `index.ts` before `:w`; a scratch buffer is never read-only, so the F3 read-only `.d.ts` Playwright test (`e2e/editor-files.spec.ts`) has no host on `/repl` any more and is re-proven on the lesson page at F8 with a real lesson `.d.ts` (the controller's read-only code is unchanged). Dexie's convention repo (suki) is not on this machine; the schema is §7 verbatim.
- Dependencies: `dexie` 4.4.6 (the registry's `latest`; 4.4.7 is the `dev` tag) and, for Vitest in Node, `fake-indexeddb` 6.2.6 (dev).
- Tests: 215 unit tests (`pnpm test --run`; new: `src/store/buffers.test.ts`, `src/store/autosave.test.ts`, `src/app/open-in-repl.test.ts`); 197 Playwright tests (`pnpm test:e2e`, Chrome, about 45 s after the build): `e2e/repl-buffers.spec.ts` (16 tests, one `describe` per criterion) plus the F3 and F4 specs updated for the two welcome buffers (`editor-files`, `editor-ex`, `sandbox`). The §11 gate ("the REPL works: Vim checklist, diagnostics, `^?`, run, kill, clipboard") is covered by the F3, F4 and F5 specs on `/repl`; clipboard over HTTPS stays the F3 "For Kim" item.
- Measured (`vite build`, 20 October 2026): `index-*.js` 1,236,826 bytes raw, 402,184 gzip (F4: 1,136,150 raw; Dexie joined the main chunk), CSS 66,904 raw, 13,440 gzip, the ts-ls worker chunk 3,556,779, the sandbox worker 8,346; build about 2 s.
- Left for later features: the `ts run` block's Run and Open in REPL buttons calling `openInRepl` (F6, which also proves "from a theory block"); the lesson page's read-only `.d.ts` test (F8); `buffers` in the export and import (F9); the `:e`/`:bd` palette items already exist (F3).

## F6. Content pipeline

- [ ] `pnpm content:lint` fails on each §3 condition, proven by one fixture per condition.
- [ ] Every shipped solution passes its own exercise and every starter fails it, checked in Node with the same core modules the app uses.
- [ ] A `ts twoslash` block renders its `^?` results at build time; the browser loads no worker for theory.
- [ ] `ts run` blocks have Run and Open in REPL; `ts run errors` blocks show their diagnostics.
- [ ] Three fixture lessons (one per editor kind, plus a `predict`) exist under `content/` and render.

## F7. Exercise verification

- [ ] For a `type-challenge` fixture, each `cases` element is its own case with pass or fail, and an unused `@ts-expect-error` fails its case.
- [ ] For an `implement` fixture, every runtime test reports pass or fail with expected and actual; a 1 s hang reports `timeout`.
- [ ] `forbid: [explicit-any]` fails a solution with `any` and names the line; without the rule the same solution passes.
- [ ] A `@ts-ignore`, `@ts-nocheck` or `@ts-expect-error` in a non-test user file always fails, and so does `eval`.
- [ ] A `fix` exercise passes only when every file has zero diagnostics.
- [ ] Compiles failing stops the other groups, with the reason shown.
- [ ] The Tests tab shows the four groups; `j`/`k` move, `Enter` expands or jumps to the source.

## F8. Lesson page

- [ ] Theory and practice side by side; `Ctrl-h/j/k/l`, `1`/`2`/`3` and `Esc` move focus as §4 and §6 say.
- [ ] With the editor focused in normal mode, `g r`, `g n`, `] e` and `?` do nothing app-level (Playwright).
- [ ] `:done` with Check yourself questions unanswered jumps to the first one and says how many remain; once all are answered correctly, `:done` marks theory read; passing every required exercise then completes the lesson, and the module page and the roadmap show it.
- [ ] `:hint` reveals hints in order and records the count; `:sol` opens the solution read-only and records it; `:reset` restores the starter after confirmation.
- [ ] `:next` and `:prev` move between exercises and across lesson boundaries; the URL reflects the current exercise; a direct link to `/l/<lesson>/<exercise>` opens it.
- [ ] Files are autosaved per exercise and restored on return, including after a reload mid-edit.
- [ ] A `predict` exercise answers with `j`/`k`/`Enter`, shows the explanation and records the answer.

> **Gate (§11):** one lesson works end to end.

## F9. Roadmap, modules and progress

- [ ] The roadmap renders every tier and module from `roadmap.yaml` with prerequisite edges and progress rings; `j`/`k`/`h`/`l`/`Enter`/`c` work without a mouse.
- [ ] Continue opens the last touched exercise.
- [ ] A module with unmet prerequisites shows "Recommended first" and still opens.
- [ ] `/progress` shows per-module counts, hints used and solutions viewed; `:export` downloads the JSON in §7; import previews and merges as §7 says; each reset scope works with its confirmation.
- [ ] Progress survives a reload and a content deploy; a `renames.yaml` entry migrates an id (fixture rename).

## F10. Settings

- [ ] vimrc, relative numbers, font size, theme, default timeout and compiler defaults are editable and apply without a reload.
- [ ] Settings are included in export and restored by import.

## F15. Offline, performance and deploy

- [ ] After one online load, with the network off: the app opens, a lesson loads, diagnostics and a run work (Playwright with `offline: true`).
- [ ] Every budget in §9 is measured and recorded in `docs/progress.md`; any miss has a note.
- [ ] `deploy/deploy.sh` ships `dist/` to `/var/www/ts-dojo`; HTTPS answers with a valid certificate; HTTP redirects. (droplet)
- [ ] `/l/<lesson>` loads directly; `/ts/6.0.3/lib.es2025.d.ts` is served precompressed as `text/plain`; `/assets/*` is immutable; `index.html` and `sw.js` are `no-cache`. (droplet)
- [ ] The CSP in §10 is present and nothing in the app is blocked by it (no CSP errors in the Playwright console).
- [ ] `deploy/README.md` exists with the §10 table and the Deploying, Rollback, Caching, DNS/TLS and nginx sections.

> **Gate (§11):** deployed at dojo.kimnejudne.dev; offline works.

## F11. Content wave 1 (Tier 0 and 1)

- [ ] M00 to M04 exist as §8 lists them: 20 lessons, each with the §1 structure, at least two exercises (one in M00), at least one `predict`, hints on every editor exercise, and at least one `ts twoslash` block.
- [ ] `pnpm content:lint` passes for the whole tree.
- [ ] Kim completes Tier 0 and Tier 1 on the deployed site without a mouse (by hand; the v1 gate).

> **Gate (§11):** §12 passes, and Kim completes Tier 0 and Tier 1 on the deployed site without a mouse.

## F12. Content wave 2 (Tier 2)

- [ ] F12: M05 to M09, 19 core lessons and the two optional ones, to the same rules as F11, lint passing.

Shared rules from §12 "F12–F14": to the same rules as F11, lint passing.

## F13. Content wave 3 (Tier 3)

- [ ] F13: M10 to M14, 18 core lessons and three optional, with the type-challenges sets crediting their source.

Shared rules from §12 "F12–F14": to the same rules as F11, lint passing.

## F14. Content wave 4 (Tier 4)

- [ ] F14: M15 to M18, 17 core lessons and one optional; Zod and React's types pre-bundled for 17.2 and 17.4.

Shared rules from §12 "F12–F14": to the same rules as F11, lint passing.

## v1 gate

- [ ] Kim completes Tier 0 and Tier 1 at dojo.kimnejudne.dev without a mouse, and every blocking bug found on the way is fixed. (by hand)

## Deviations

Anything built differently from what the spec names (library, version, flag, key, limit), with the reason and the date Kim accepted it. Empty means the code follows the spec as written.

- **§2 lib set (F2, accepted by Kim with the F2 plan on 17 October 2026).** §2 says the worker fetches "exactly the set `knownLibFilesForCompilerOptions(options, ts)` returns". Prep proved that function cannot return the ES-only set (it is a prefix slice of a fixed list: 101 names with DOM, webworker and scripthost for the defaults, only `lib.d.ts` after option conversion). The worker instead resolves the set the way the compiler does, by following the `/// <reference lib="…" />` directives from each `lib` entry (`src/workers/ts-ls/libs.ts`): 76 files for `es2025`, `lib.dom.d.ts` only when a lesson adds `libs: [dom]`. Proven by `src/workers/ts-ls/libs.test.ts` and `core.test.ts`; the §12 F2 criterion ("fetches only ES lib files; with `libs: ["dom"]` it also fetches `lib.dom.d.ts`, once") is met as written.
- **§2 project contents: an app-added declaration file (F2, accepted by Kim with the F2 plan on 17 October 2026).** §2 and §5 describe a project as the exercise's files, `tests.ts` and the lesson's `.d.ts` files. The worker adds one more root file, `/dojo/runtime.d.ts`, to every project whose lib set has neither `dom` nor `webworker`, because the §2 defaults (`lib: ["es2025"]`, no DOM) leave `console` and the timers undeclared and every `ts run` example uses them (the "Spec questions" entry below has the detail). It is not a user file: never editable, never a tab, outside the §5 Compiles rule and the rules walk. F4 sets its final contents to exactly what the sandbox shim provides.

## Spec questions

Proposed changes to docs/spec.md, which Claude never edits. Kim answers here or in the spec.

- **§2 Stack, react-router.** The table says react-router 7 ("current"). On 17 October 2026 the registry's `latest` is 8.4.0, with 7.x still published. F1 pinned 7.18.4, the newest 7.x, as the spec says; the spec names 7 in the Stack table and the Components list. Say so if 8 is wanted.
- **§5 Runtime tests, types for `test` and `expect`.** The prelude defines `test`, `test.skip` and `expect` at runtime, and `tests.ts` must compile with zero diagnostics outside case ranges, but §5 does not say how `tests.ts` sees their types. Proposal: F7 ships an ambient `.d.ts` (the harness types) added to every exercise project, so lesson authors use `test` and `expect` as globals with no import. The `lesson` skill and its reference exercises assume this.
- **§2 default options leave `console` and timers undeclared.** With `lib: ["es2025"]` and `types: []`, `console.log` is TS2584 ("Cannot find name 'console'") and `setTimeout` is undeclared, because both live in `lib.dom.d.ts` and `@types/node`, not in the ES lib. Every `ts run` example and most exercises use them, and §12 F4 needs `setTimeout`. Proposal: the app adds one ambient `.d.ts` to every project (not a lesson file) declaring the sandbox's `console` shim and its timers, alongside the test harness types above. Decide at F2 (names and location) and F4 (what the shim really provides). Confirmed with `typescript@6.0.3` on 17 October 2026 while compiling the lesson skill's reference. **Decided at F2 (17 October 2026, accepted by Kim with the F2 plan; also under Deviations):** the worker adds `/dojo/runtime.d.ts` to every project whose lib set has neither `dom` nor `webworker` (those declare console and the timers themselves, and a second declaration would clash): `console.log/info/warn/error/debug`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` and `queueMicrotask` (`src/workers/ts-ls/ambient.ts`). Paths under `/dojo/` are reserved and never a tab. F4 widens the file to exactly what the shim provides; F7 adds `/dojo/test-harness.d.ts` for `test`, `test.skip` and `expect`.
- **§13 open question** ("write docs/progress.md and CLAUDE.md now, as job-search has, or at F1?"): written now, in the Claude Code setup session on 17 October 2026.
- **§2 `knownLibFilesForCompilerOptions` (Prep, 17 October 2026).** It is not a dependency walk but a prefix slice of a hardcoded name list. With the §2 defaults written as JSON (`lib: ["es2025"]`) it returns 101 names, among them `lib.d.ts`, every DOM, webworker and scripthost file, and five files 6.0.3 does not ship; after `ts.convertCompilerOptionsFromJson` (lib entries become file names and `ScriptTarget[12]` reads back as `"LatestStandard"`) it returns only `lib.d.ts`. It can never return "only ES files", so §2's "exactly the set it returns" cannot be built. Proposal: F2 resolves the set by following the `/// <reference lib="…" />` directives from `lib.<name>.d.ts` for each `lib` entry (76 files for `es2025`, the two decorators files included, 573,813 bytes), and the §2 sentence is reworded to say so. Pinned by `scripts/copy-ts-libs.test.ts`; the ts-worker skill carries the note. **Answered at F2 (17 October 2026):** Kim accepted the proposal with the F2 plan; the worker follows the reference directives and the entry is under Deviations. The §2 sentence still awaits its rewording.
- **§4 Undo, `U` (Prep).** The engine has no normal-mode `U`. The proposed mapping `nmap U u` makes `U` a plain undo rather than Vim's "undo all changes on the last changed line". Accept the mapping, or drop `U` from the checklist and list it in the `?` overlay? **F3 ships the mapping** (`lineUndo` in `src/editor/vim-defaults.ts`) and the overlay line; the same applies to `it`/`at` (W), which ship as a documented gap with no definition (docs/prep-vim.md: the adapter finds HTML and XML tag nodes only). Both go under Deviations once Kim accepts them, so criterion 1 of F3 reads as met without a caveat.
- **§4 P items that need a definition (Prep).** `"*`, `"+p`, `U` and `:set rnu/nu/wrap` are P ("must pass as shipped") but need the definitions recorded in docs/prep-vim.md, and visual block needs `EditorState.allowMultipleSelections.of(true)` in the editor; the §11 gate accepts a working mapping, so Prep passes either way. Re-level them to W, or leave the table and keep the record? Related: W allows a default vimrc mapping, so insert-mode `Ctrl-h` can be `imap <C-h> <BS>` in the shipped vimrc text, or applied in code so the Settings vimrc matches §4 exactly; F3 applies it in code unless Kim prefers the vimrc line.
- **§6 `/l/:lesson` with lesson ids that contain a slash (F1).** Lesson ids are `<module>/<lesson>` (`m03-unions/05-discriminated-unions`, §3), so `/l/:lesson` cannot be one react-router segment. F1 matches `l/*` and `parseLessonPath` (`src/app/lesson-path.ts`) splits `<module>/<lesson>[/<exercise>]`; the URLs in the browser are the §6 shapes unchanged. Proposal: a note on the two §6 rows that the lesson id spans two path segments; nothing else changes.
- **§2 ESLint 9 (F1).** Built with ESLint 9.39.5 as the spec says. On 17 October 2026 npm marks every 9.x release deprecated in favour of 10.x (10.12.0); `eslint-plugin-jsx-a11y` 6.10.2 declares `eslint ^9` at most, while `typescript-eslint` 8.71.2 and `eslint-plugin-react-hooks` 7.1.1 accept 10. Move to 10 when jsx-a11y does, or now if Kim prefers a peer warning over a deprecated major.
- **§4 `:set` persistence against the §7 settings keys (F3).** §4 says `:set rnu / nornu / nu / wrap / nowrap / bg=dark / bg=light` are "editor and theme options; persisted", but §7 names only `relativeNumbers` and `theme` among the settings keys. F3 persists all four: `relativeNumbers` and `theme` as §7 names them, plus `lineNumbers` and `wrap` as two new keys in the `ts-dojo:settings` object (`src/store/settings.ts`). Proposal: add `lineNumbers` and `wrap` to the §7 key list.
- **§4 `Ctrl-h/j/k/l` in visual mode (F3).** §4 says the pane keys work "in normal and visual mode only", but the shipped vimrc in the same section maps them with `nmap` alone. F3 keeps the vimrc text verbatim and adds the four `vmap` equivalents in code (`visualPaneKeys` in `src/editor/vim-defaults.ts`), re-applied with the other defaults. Proposal: add the four `vmap` lines to the §4 vimrc, or drop "and visual" from the prose.
- **§12 F3, ex commands whose targets are later features (F3, agreed with Kim in the F3 plan on 17 October 2026).** The criterion "Every ex command in §4 does what its row says, including `:w` running the code" names rows that F4 (`:w` running, `:kill`), F5 (`:e`, `:bd`), F7 (`:test`), F8 (`:hint`, `:sol`, `:reset`, `:done`, `:next`, `:prev`, `:lesson`, `:theory`, `:layout`, `:prompt`, pane focus to the theory pane) and F9 (`:export`) build. F3 registers every command and alias with `Vim.defineEx`, lists them in the palette and the overlay, parses their arguments and dispatches each to the page's host; `:w` transpiles through `emit` and hands the modules to the host; the rows with F3 targets are proven in Chrome and the others answer with the feature that owns them. The box stays unticked until those features close it. Proposal: split the criterion, or move the later rows to their features' §12 blocks.
  **F4 (18 October 2026)** closed the `:w` running and `:kill` rows (`e2e/sandbox.spec.ts`, `e2e/editor-ex.spec.ts`). **F5 (20 October 2026)** closed the `:e` and `:bd` rows (`e2e/repl-buffers.spec.ts`).
- **§2 `emit { paths }` and `emitResult` (F4).** The sandbox loader needs the span of every surviving import to rewrite it to a blob URL, and a cyclic graph needs CommonJS output (§2 Decisions). F4 widened the request to `emit { paths, module?: "commonjs" }` and `EmittedFile` to `{ path, js, imports: { specifier, start, end }[] }`. Proposal: add both to the §2 protocol lines.
- **§2 sandbox → UI messages (F4).** §4 asks for one "output truncated" line and for "still running (N timers)" after the entry settles. F4 added `truncated { entries, bytes }` (the worker stops posting at the cap, so a logging loop cannot flood the main thread) and sends `done` a second time with `pendingTimers: 0` when the last timer drains, so the status can end in "done in N ms" without `:kill`. Proposal: list `truncated` and note the second `done` in §2.
- **§4 output pane keys and statuses (F4).** §4 names `j`/`k` and `Enter` for the pane but no key to switch its tabs; F4 uses `h`/`l`. §4 says "killed after N ms" and §12 "killed after 5 s": the deadline reports the configured time (`5 s`), `:kill` the elapsed time (`412 ms`); the deadline also ends a run that is "still running". Proposal: add `h`/`l` to the pane's keys and the two wordings to §4.

- **§7 `meta` keys, `lastBuffer` (F5).** §12 F5 says "`/repl` opens the last buffer" but §7's `meta` table lists only `schemaVersion`, `contentVersion`, `lastLessonId` and `importedAt`, and `buffers.updatedAt` cannot carry it (the import merge rule "the newer `updatedAt` wins" would make a merely viewed buffer beat an edited one). F5 stores the name under `meta.lastBuffer`, written on mount and on every switch. Proposal: add `lastBuffer` to the §7 `meta` key list.
- **§4 `:w` on `/repl` (F5).** §4 says `:w` "runs the entry file"; a scratch-buffer REPL has no fixed entry, so F5 runs the buffer being edited (imports between buffers still work: every buffer is a file of one project). Proposal: a note on the `:w` row that on `/repl` the entry is the current buffer.
- **§12 F5 criterion 3, "from a theory block" (F5).** No theory block exists before F6 (the content pipeline renders `ts run` fences). F5 ships `openInRepl` on `AppActions` and proves the flow through the app seam `window.__tsDojoApp.openInRepl`; F6's block button calls the same function and its §12 criterion ("`ts run` blocks have Run and Open in REPL") proves the button. Proposal: none; noted so the F5 tick reads with that context.

## Measured budgets (§9)

Measured at F15 on Kim's laptop in Chrome. A miss needs a note.

| What | Budget | Measured | Note |
| --- | --- | --- | --- |
| Cold load, app shell interactive | under 2 s on broadband | | |
| Cold load, compiler `ready` | under 5 s; the editor is usable before that, with the "compiler loading" chip | | |
| Warm load (service worker), compiler `ready` | under 1.5 s | | |
| Diagnostics for a 200-line file, `es2025` lib, warm | under 300 ms p95 after typing stops | | |
| Quick info | under 100 ms | | |
| Run of a trivial file, worker spawn included | under 150 ms | | |
| ts-ls worker memory, steady | under 250 MB | | |
| Total precache | under 15 MB raw | | |

## For Kim

Checks only Kim can do. Feature sessions add their items here with exact steps; Kim ticks them here and in the feature's section above.

- [ ] Prep: add the Namecheap A record `dojo` → the droplet, then confirm `dojo.kimnejudne.dev` resolves (`dig +short dojo.kimnejudne.dev`).
- [ ] Prep (by hand): browser-reserved keys in a tab. `pnpm spike:vim`, open http://localhost:5179 in Chrome, tick "preventDefault on every Ctrl key", click into the editor and press every key in the table "Ctrl keys the page can intercept" in docs/prep-vim.md. A key that reaches the page appears in the key log as "page prevented default"; a key the browser keeps never appears. Fill the "Tab" column.
- [ ] Prep (by hand): the same in an installed window. Chrome menu → Cast, save and share → Install page as app (or the install icon in the address bar), repeat the key presses there and fill the "Installed window" column.
- [ ] Prep (by hand): clipboard round trip. In the spike editor in normal mode type `"+yy`, then paste in a terminal; copy a line in a terminal, then type `"+p` in the editor. Both directions should carry the text; note whether Chrome asked for clipboard permission. Record the answer in docs/prep-vim.md.
- [x] F1: push the `F1: Scaffold` commit, then open the repository's Actions tab on GitHub and confirm the "CI" run for it is green (Typecheck, Lint, Format check, Unit tests, Build all pass on the `ubuntu-latest` runner with Node 24). Done 17 October 2026 at Kim's request: repository `kim-nejudne/ts-dojo` (private), run 39016881255 for `f0dbd4d` green in 48 s; Kim confirmed the tick.
- [ ] F3 (droplet, after F15): clipboard over HTTPS. On https://dojo.kimnejudne.dev/repl in normal mode type `"+yy`, paste in a terminal; copy a line in a terminal, type `"+p` in the editor. Both directions carry the text (Playwright proved localhost; §12 F3 names HTTPS too).
- [ ] F15 (droplet): run `deploy/deploy.sh` with `TS_DOJO_HOST` set; confirm HTTPS answers with a valid certificate and HTTP redirects.
- [ ] F15 (droplet): open `/l/<lesson>` directly; check `/ts/6.0.3/lib.es2025.d.ts` is served precompressed as `text/plain`, `/assets/*` is immutable, and `index.html` and `sw.js` are `no-cache` (`curl -I`).
- [ ] F11 (by hand): complete Tier 0 and Tier 1 on the deployed site without a mouse; note every blocking bug.
- [ ] v1 gate: Tier 0 and Tier 1 completed at dojo.kimnejudne.dev without a mouse, and every blocking bug found on the way fixed.
