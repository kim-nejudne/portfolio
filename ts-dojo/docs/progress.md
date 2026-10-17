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

- [ ] Every P item in the §4 checklist passes in Chrome; every W item has its mapping or definition applied by default.
- [ ] The shipped vimrc applies; `imap jk <Esc>` works; a bad vimrc line is reported with its number and skipped, and the good lines still apply.
- [ ] Every ex command in §4 does what its row says, including `:w` running the code and `:set rnu` persisting.
- [ ] Squiggles and gutter marks appear within 300 ms of typing stopping; `]d` and `[d` move between diagnostics; `K` shows quick info at the cursor; `gd` jumps to a definition in another file.
- [ ] A `//   ^?` line shows the queried type under it and updates on edit.
- [ ] Completions open on typing and `Ctrl-Space`; `Ctrl-j`/`Ctrl-k` and `Tab`/`Shift-Tab` move; `Enter` or `Ctrl-y` accept; `Esc` closes and returns to normal mode.
- [ ] `"+y` and `"+p` use the system clipboard over HTTPS and on localhost.
- [ ] Multi-file: tabs, `:b`, `:ls`, `gt`, `gT`; a lesson `.d.ts` is read-only and marked.
- [ ] Editing works before the compiler is ready, with the status chip showing.

## F4. Sandbox runner

- [ ] `console.log` of a string, a nested object, a Map, a class instance and an Error renders readably with its source line.
- [ ] `while (true) {}` is terminated at the deadline, the page stays responsive throughout (Playwright keeps typing during the run), and the status reads "killed after 5 s".
- [ ] A thrown error shows the message and the TypeScript file and line; `Enter` on it moves the cursor there.
- [ ] Two files importing each other without a cycle run in the right order; a cycle falls back to CommonJS and still runs (fixtures for both).
- [ ] Top-level `await` works in a single-file run.
- [ ] Output stops at 500 entries or 200 KB with one truncation line.
- [ ] A pending `setTimeout` after the entry settles shows "still running (1 timer)"; `:kill` ends it.

## F5. Standalone REPL

- [ ] `/repl` opens the last buffer; `:e name` creates or switches; `:ls` lists; `:bd` deletes after confirmation.
- [ ] A buffer survives a reload, autosaved within 1 s of the last keystroke.
- [ ] Open in REPL from a theory block creates a buffer with the snippet and focuses the editor in normal mode.

> **Gate (§11):** the REPL works: Vim checklist, diagnostics, `^?`, run, kill, clipboard.

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
- **§4 Undo, `U` (Prep).** The engine has no normal-mode `U`. The proposed mapping `nmap U u` makes `U` a plain undo rather than Vim's "undo all changes on the last changed line". Accept the mapping, or drop `U` from the checklist and list it in the `?` overlay?
- **§4 P items that need a definition (Prep).** `"*`, `"+p`, `U` and `:set rnu/nu/wrap` are P ("must pass as shipped") but need the definitions recorded in docs/prep-vim.md, and visual block needs `EditorState.allowMultipleSelections.of(true)` in the editor; the §11 gate accepts a working mapping, so Prep passes either way. Re-level them to W, or leave the table and keep the record? Related: W allows a default vimrc mapping, so insert-mode `Ctrl-h` can be `imap <C-h> <BS>` in the shipped vimrc text, or applied in code so the Settings vimrc matches §4 exactly; F3 applies it in code unless Kim prefers the vimrc line.
- **§6 `/l/:lesson` with lesson ids that contain a slash (F1).** Lesson ids are `<module>/<lesson>` (`m03-unions/05-discriminated-unions`, §3), so `/l/:lesson` cannot be one react-router segment. F1 matches `l/*` and `parseLessonPath` (`src/app/lesson-path.ts`) splits `<module>/<lesson>[/<exercise>]`; the URLs in the browser are the §6 shapes unchanged. Proposal: a note on the two §6 rows that the lesson id spans two path segments; nothing else changes.
- **§2 ESLint 9 (F1).** Built with ESLint 9.39.5 as the spec says. On 17 October 2026 npm marks every 9.x release deprecated in favour of 10.x (10.12.0); `eslint-plugin-jsx-a11y` 6.10.2 declares `eslint ^9` at most, while `typescript-eslint` 8.71.2 and `eslint-plugin-react-hooks` 7.1.1 accept 10. Move to 10 when jsx-a11y does, or now if Kim prefers a peer warning over a deprecated major.

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
- [ ] F15 (droplet): run `deploy/deploy.sh` with `TS_DOJO_HOST` set; confirm HTTPS answers with a valid certificate and HTTP redirects.
- [ ] F15 (droplet): open `/l/<lesson>` directly; check `/ts/6.0.3/lib.es2025.d.ts` is served precompressed as `text/plain`, `/assets/*` is immutable, and `index.html` and `sw.js` are `no-cache` (`curl -I`).
- [ ] F11 (by hand): complete Tier 0 and Tier 1 on the deployed site without a mouse; note every blocking bug.
- [ ] v1 gate: Tier 0 and Tier 1 completed at dojo.kimnejudne.dev without a mouse, and every blocking bug found on the way fixed.
