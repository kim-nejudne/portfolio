# Progress

The v1 checklist for ts-dojo: Prep from §11, then every acceptance criterion from docs/spec.md §12, copied verbatim (74 boxes; a trailing `(by hand)` tag was added to the two checks only Kim can do that §12 leaves untagged). Tick a box only when the `acceptance-reviewer` agent reports it met with evidence (a test name or `file:line`), or when Kim confirms a by-hand or droplet check. Claude never ticks a by-hand or droplet item.

**Build order (§11):** Prep → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F15 → F11 → F12 → F13 → F14 → v1 gate. One feature per session, one commit per feature (`F<n>: <title>`). The sections below are in this order; the SessionStart hook reads the first one with an unchecked, automatable item as the current feature.

**Tags**

- `(by hand)`: needs Kim in a real browser; listed under "For Kim" with the exact steps. Never claimed by Claude.
- `(droplet)`: checked on the droplet after Kim deploys. Same rule.
- §12 lists F12–F14 as one block; here each wave is its own section because §11 builds and commits them one at a time.

§11 gates are quoted under the feature that closes them.

## Prep

- [ ] The §4 Vim checklist has a recorded result for every item: pass, workaround (with the mapping), or gap.
- [ ] `public/ts/6.0.3/` holds every `lib.*.d.ts` from `typescript@6.0.3`, and §2's sizes are confirmed or corrected.
- [ ] `dojo.kimnejudne.dev` resolves to the droplet. (by hand)

> **Gate (§11):** every P item passes or has a working mapping, and the W list is written down.

## F1. Scaffold

- [ ] `pnpm dev`, `build`, `preview`, `typecheck`, `lint`, `format:check`, `test --run` and `test:e2e` exist and pass on a clean clone with Node 24 and pnpm 12.
- [ ] GitHub Actions runs typecheck, lint, format check, unit tests and build on every push and pull request.
- [ ] `tsconfig.json` has every flag listed in §2.
- [ ] Every route in §6 renders a placeholder, in light and dark, and `?` opens the help overlay.
- [ ] shadcn is initialised with `base-nova` and the Button, Dialog, Tabs, Tooltip, Command and Sheet primitives.

## F2. Language-service worker

- [ ] The worker reports `ready` with `tsVersion` `6.0.3`, and no request leaves the origin (Playwright network log).
- [ ] `openProject` with `lib: ["es2025"]` fetches only ES lib files; with `libs: ["dom"]` it also fetches `lib.dom.d.ts`, once.
- [ ] `getDiagnostics` on a 200-line fixture returns in under 300 ms p95 after warm-up, measured by a Vitest benchmark on the core module.
- [ ] `getQuickInfo` returns the display string and docs for an identifier; `getTwoslashQueries` returns one entry per `^?` with the right line and text, and an error entry when the query points at whitespace.
- [ ] `emit` returns JavaScript with an inline source map for every file and elides type-only imports.
- [ ] A reply with an older `version` than the file's current one is dropped by the client (unit test).
- [ ] `lintAst` reports every rule in §5 on a fixture, with file and line.
- [ ] `runTypeTests` groups diagnostics into cases as §5 describes, including the TS2578 case.

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

- None yet.

## Spec questions

Proposed changes to docs/spec.md, which Claude never edits. Kim answers here or in the spec.

- **§2 Stack, react-router.** The table says react-router 7 ("current"). On 17 October 2026 the registry's `latest` is 8.4.0, with 7.x still published. F1 will pin `^7` as the spec says unless Kim wants 8; the spec names 7 in the Stack table and the Components list.
- **§5 Runtime tests, types for `test` and `expect`.** The prelude defines `test`, `test.skip` and `expect` at runtime, and `tests.ts` must compile with zero diagnostics outside case ranges, but §5 does not say how `tests.ts` sees their types. Proposal: F7 ships an ambient `.d.ts` (the harness types) added to every exercise project, so lesson authors use `test` and `expect` as globals with no import. The `lesson` skill and its reference exercises assume this.
- **§2 default options leave `console` and timers undeclared.** With `lib: ["es2025"]` and `types: []`, `console.log` is TS2584 ("Cannot find name 'console'") and `setTimeout` is undeclared, because both live in `lib.dom.d.ts` and `@types/node`, not in the ES lib. Every `ts run` example and most exercises use them, and §12 F4 needs `setTimeout`. Proposal: the app adds one ambient `.d.ts` to every project (not a lesson file) declaring the sandbox's `console` shim and its timers, alongside the test harness types above. Decide at F2 (names and location) and F4 (what the shim really provides). Confirmed with `typescript@6.0.3` on 17 October 2026 while compiling the lesson skill's reference.
- **§13 open question** ("write docs/progress.md and CLAUDE.md now, as job-search has, or at F1?"): written now, in the Claude Code setup session on 17 October 2026.

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
- [ ] F15 (droplet): run `deploy/deploy.sh` with `TS_DOJO_HOST` set; confirm HTTPS answers with a valid certificate and HTTP redirects.
- [ ] F15 (droplet): open `/l/<lesson>` directly; check `/ts/6.0.3/lib.es2025.d.ts` is served precompressed as `text/plain`, `/assets/*` is immutable, and `index.html` and `sw.js` are `no-cache` (`curl -I`).
- [ ] F11 (by hand): complete Tier 0 and Tier 1 on the deployed site without a mouse; note every blocking bug.
- [ ] v1 gate: Tier 0 and Tier 1 completed at dojo.kimnejudne.dev without a mouse, and every blocking bug found on the way fixed.
