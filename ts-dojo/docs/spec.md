# ts-dojo: Technical Spec

Oct 17, 2026 · @Kim Nejudne

## Summary

Build one static web app at dojo.kimnejudne.dev that teaches TypeScript from the first type annotation to type-level programming and type-safe API design. It is a curriculum of 19 modules in five tiers. Every lesson has a theory page and a set of exercises that the compiler and a test runner check. Exercises are solved in a REPL: a CodeMirror editor with Vim keybindings, the real TypeScript compiler running in a Web Worker for live diagnostics and inferred types, and a second worker that runs the code in isolation. A roadmap page shows the tiers, the modules, their prerequisites and progress. Everything runs in the browser. There is no backend, no account and nothing to pay for.

**Goals**

- One ordered path from "what is a type annotation" to conditional types, type-level programming and type-safe API design.
- Every lesson has both parts: theory to read, then exercises that pass or fail by the compiler and by tests, never by eye.
- A REPL that feels like Neovim: modal editing, text objects, registers, ex commands and custom mappings. The whole app works without a mouse.
- Type errors, inferred types and `^?` queries shown inline, from the same compiler the lessons are about.
- Progress that survives reloads and deploys, and exports to a file.
- Works offline after the first load, and costs nothing to run.

**Not in v1**

- More than one user, accounts, or sync between devices. Progress lives in the browser and in exported JSON.
- A backend of any kind. The droplet serves static files only.
- An AI tutor, generated hints or generated exercises. Every hint and solution is hand-written.
- A line-at-a-time REPL. The REPL is a buffer you run. An inspector line is v1.1.
- Importing npm packages in the REPL. The two lessons that need a library ship it pre-bundled. General imports with type acquisition are phase 2.
- A phone layout. The lesson page needs two panes side by side.
- Gamification beyond progress: no streaks, points or badges.

### Decisions

| Topic | Decision |
| --- | --- |
| Name and URL | `ts-dojo` at `dojo.kimnejudne.dev`. |
| Who it's for | Kim only. Assumes fluent modern JavaScript. "Basic" means TypeScript basics, not programming basics. |
| REPL | A playground buffer with Vim keybindings, live diagnostics, hover types, twoslash `^?` queries and run-to-output. The editor's ex command line doubles as the app's command line. |
| Roadmap | In the app: tiers → modules → lessons with progress and prerequisite edges, and no hard gating. In this document: §11. |
| Compiler in the browser | `typescript@~6.0.3`, the last JavaScript build, in a Web Worker. TypeScript 7 is a native Go program with no JavaScript API, so it cannot run in a page. Behaviour that exists only in 7 is taught as theory and marked. |
| Editor | CodeMirror 6 with `@replit/codemirror-vim`. Monaco with `monaco-vim` was rejected: no clipboard register, open dot-repeat and macro bugs, and an unanswered question about maintenance. |
| Running code | A fresh dedicated Worker per run, terminated at a deadline. `ts.transpileModule` for emit. Multi-file projects run through blob-URL import rewriting. No bundler is shipped. |
| Stack | Vite, React 19, TypeScript strict, Tailwind 4, shadcn (base-nova, Base UI), react-router 7, Dexie, MDX, Vitest, Playwright, ESLint 9 and Prettier, pnpm 12, Node 24. |
| Hosting | Static files in `/var/www/ts-dojo` behind nginx and certbot on the droplet, deployed by hand with the plinth script. Never Vercel. A service worker precaches the app for offline use. |
| Content | Ships with the app. Written in four waves, one tier at a time, to one template, and checked by a content lint in CI. |
| Layout | Desktop and keyboard first. |
| Completion | A lesson is complete when its theory is read, which needs every Check yourself question answered correctly, and every required exercise is passed. |

Settled with Kim on 17 October 2026: the name and URL, pnpm, the React lesson (17.4) as a core lesson, and Check yourself questions counting toward completion.

## 1. Learning model

### Structure

Tier → module → lesson → exercise.

- A **tier** is a row on the roadmap: Orientation, Foundations, Intermediate, Advanced, Expert.
- A **module** is a node on the roadmap: 3–6 lessons on one topic, with prerequisites on other modules.
- A **lesson** is one page with two parts, theory and practice.
- An **exercise** is one task in the REPL with a pass rule.

§8 lists all of them: 19 modules, 74 core lessons and 6 optional ones, about 28 hours of core work.

### Lesson anatomy

Frontmatter in `lesson.mdx`:

| Field | Meaning |
| --- | --- |
| `id` | Stable slug such as `m03-unions/03-narrowing`. Never renamed once progress exists (§7). |
| `title`, `minutes` | Shown on the roadmap and module pages. `minutes` covers theory and core exercises. |
| `objectives` | 2–5 lines starting with a verb. Shown at the top of the theory pane. |
| `prerequisites` | Lesson ids. Used for the "recommended first" note, never to lock. |
| `tags` | Free text for the command palette. |
| `ts7` | Optional note when the lesson's behaviour differs in TypeScript 7 (§2). |

Theory, always in this order:

1. **Concept.** What it is and why it exists, in plain words, with the smallest example.
2. **Examples.** Runnable snippets. Each has Run and Open in REPL. `^?` queries are pre-rendered at build time.
3. **Pitfalls.** The two or three mistakes people make, each with a failing snippet.
4. **Check yourself.** One to three inline questions, answered in place. They count toward completion (below).
5. **Further reading.** Handbook links.

Practice: two to five exercises, easy to hard. The first is a near-copy of a theory example. The last combines the lesson with earlier material. Exercises marked `challenge: true` are optional and never block completion.

### Completion

- An exercise is **passed** when its pass rule holds once. It stays passed.
- Theory is **read** when every Check yourself question has been answered correctly (retries allowed; the explanation shows after each answer) and Kim then runs `:done` or presses the button at the end of the theory pane. `:done` with questions left jumps to the first unanswered one and says how many remain. Scrolling to the bottom does not count.
- A lesson is **complete** when theory is read and every non-challenge exercise is passed.
- A module is complete when its lessons are. States everywhere are not started, in progress and complete.

### Exercise kinds

| Kind | The task | Pass rule |
| --- | --- | --- |
| `fix` | The starter has type errors. Make it compile without changing the tests. | Zero diagnostics in every file. Runtime tests pass if present. No forbidden constructs. |
| `implement` | Write a function, class or type from a prompt. | Zero diagnostics. Runtime tests pass. Type cases pass if present. No forbidden constructs. |
| `type-challenge` | Implement a type. | Every type case passes and every `@ts-expect-error` line errors. No forbidden constructs. |
| `predict` | No editor. Read a snippet and pick the type or the output. | The chosen option is the right one. The explanation shows either way. |

Fields every editor exercise has: `prompt` (Markdown), starter files, solution files, `tests.ts`, one to three `hints`, `compilerOptions` overrides, `libs`, `forbid` rules, `challenge`, optional `.d.ts` files and a `timeoutMs` for the run. §3 has the file format and §5 the verification.

### Hints, solutions, reset, attempts

- `:hint` reveals the next hint. The count is stored per exercise.
- `:sol` opens the solution read-only in a split and marks the exercise "solution viewed". The exercise still passes only when Kim's own files pass.
- `:reset` restores the starter after a confirmation and keeps the attempt history.
- Every `:run` and `:test` records an attempt: time, verdict per group (§5), duration and a snapshot of the files. The newest 20 attempts per exercise are kept.

## 2. Architecture

### Components

```
┌──────────────────────── main thread ────────────────────────┐
│ app shell: router, layout, keyboard map, command palette    │
│ content registry: built from content/ at build time         │
│ editor: CodeMirror 6 + vim + TS extensions                  │
│ verifier: type cases + runtime tests + rules → verdict      │
│ progress store: Dexie (IndexedDB); settings in localStorage │
└───────────┬──────────────────────────────┬──────────────────┘
            │ postMessage                  │ postMessage
┌───────────▼───────────┐      ┌───────────▼───────────┐
│ ts-ls worker          │      │ sandbox worker        │
│ typescript 6.0.3      │      │ one per run           │
│ virtual FS + language │      │ console shim          │
│ service, twoslash,    │      │ test harness prelude  │
│ AST rules, emit       │      │ killed at deadline    │
└───────────────────────┘      └───────────────────────┘
 service worker: precaches the app, the compiler and /ts/6.0.3/**
```

- **App shell** (React, react-router 7): the pages in §6, the global keyboard map, the palette, theme.
- **Content registry**: `content/` is read at build time with `import.meta.glob`, validated with Zod and turned into typed objects. No content is fetched at runtime.
- **Editor**: one CodeMirror instance per page. Vim mode, diagnostics, hover, completion, `^?` widgets, file tabs (§4).
- **ts-ls worker**: one for the app's lifetime, started on load. Holds a `ts.LanguageService` over a virtual file system. Answers diagnostics, quick info, completions, twoslash queries, AST rule checks and emit.
- **sandbox worker**: created per run from transpiled modules, terminated at the deadline or on `:kill`. Its prelude provides the console shim and the test harness.
- **Verifier** (main thread): runs the groups in §5 and assembles the verdict.
- **Progress store**: the Dexie tables in §7.
- **Service worker**: generated by `vite-plugin-pwa`; precaches everything the app needs offline.

### Stack

| Part | Choice | Version | Why |
| --- | --- | --- | --- |
| Build | Vite | current stable at F1 | Kim's static-site convention (hub, plinth, online-voting) |
| UI | React 19, Tailwind 4, shadcn `base-nova` (Base UI), lucide | current | poke-project's `components.json`, with `rsc: false` |
| Router | react-router 7 | current | tallow and suki |
| Editor | `@codemirror/view`, `state`, `language`, `lint`, `autocomplete`, `lang-javascript` | 6.x (view 6.43.14, 2026-10-07) | weekly releases |
| Vim | `@replit/codemirror-vim` | 6.4.0 (2026-07-29) | §4 |
| Compiler | `typescript` | `~6.0.3` (2026-04-16) | last JavaScript build; API-compatible with 5.9 |
| Virtual FS | `@typescript/vfs` | 1.6.5 (2026-09-22) | `createSystem`, `createVirtualLanguageServiceHost`, `knownLibFilesForCompilerOptions` |
| Theory twoslash | `twoslash` with shiki | 0.3.9 | pre-renders `^?` in theory at build time; confirm the shiki transformer package at F6 |
| Content | `@mdx-js/rollup`, `yaml`, `zod` | current | |
| Storage | `dexie` | current | suki |
| Offline | `vite-plugin-pwa` | 2.0.0 | precache |
| Tests | `vitest`, `@playwright/test` | current | every project |
| Lint | ESLint 9 flat, typescript-eslint, react-hooks, jsx-a11y, Prettier (`singleQuote`) | current | online-voting and job-search |
| Package manager | pnpm 12, Node 24 | pinned in `packageManager` | job-search |

`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `moduleResolution: "bundler"`, `paths: { "@/*": ["./src/*"] }`. The app's own `typescript` dev dependency is the same `~6.0.3`, so one compiler checks the app and runs inside it.

### Repository layout

```
ts-dojo/
  content/                   lessons and exercises (§3)
  public/ts/6.0.3/           lib.*.d.ts copied from node_modules by scripts/copy-ts-libs.ts
  src/
    app/                     routes, layout, keyboard map, command palette, theme
    components/ui/           shadcn primitives
    content/                 Zod schemas, loaders, registry types, MDX components
    editor/                  CodeMirror setup, vim config and vimrc parser, TS extensions, ^? widgets
    workers/ts-ls/           core.ts (pure, runs in Node too) and worker.ts (adapter)
    workers/sandbox/         prelude.ts (console shim, test harness), loader.ts, worker.ts
    protocol/                message types shared by the UI and the workers
    verify/                  verdict assembly, case grouping, rule ids
    store/                   Dexie schema, progress queries, export/import, migrations, settings
    pages/                   roadmap, module, lesson, repl, settings, progress
  scripts/                   copy-ts-libs.ts, content-lint.ts
  deploy/                    nginx/ts-dojo.conf, deploy.sh, README.md
  docs/                      spec.md, progress.md
  e2e/                       Playwright
```

Both worker cores are pure modules with thin worker adapters, so the content lint (§3) and Vitest run them in Node without a browser.

### Workers and protocol

Every request carries a `requestId`. Replies about a file carry the file `version` they were computed against, and the UI drops a reply older than the file's current version.

UI → ts-ls: `init`, `openProject { compilerOptions, files, libs, dtsFiles }`, `updateFile { path, text, version }`, `getDiagnostics { paths }`, `getQuickInfo { path, offset }`, `getCompletions { path, offset }`, `getCompletionDetails { path, offset, name }`, `getSignatureHelp { path, offset }`, `getDefinition { path, offset }`, `getTwoslashQueries { path }`, `emit { paths }`, `lintAst { paths, rules }`, `runTypeTests { paths }`, `dispose`.

ts-ls → UI: `ready { tsVersion }`, `diagnostics`, `quickInfo`, `completions`, `completionDetails`, `signatureHelp`, `definition`, `twoslash`, `emitResult`, `astLint`, `typeTestResults`, `error`.

UI → sandbox: `run { modules, entry, mode: "run" | "test", timeoutMs }`. There is no stop message; the UI calls `worker.terminate()`.

sandbox → UI: `console { level, args, loc }`, `runtimeError { message, stack, loc }`, `testStart`, `testResult`, `testSummary`, `done { durationMs, pendingTimers }`.

### Compiler assets and options

- The `typescript` package is imported by the ts-ls worker and bundled by Vite into the worker chunk: 9,144,216 bytes raw, 1,531,825 bytes brotli, served immutable under `/assets/`.
- `lib.*.d.ts` files are copied by `scripts/copy-ts-libs.ts` into `public/ts/6.0.3/` and fetched by the worker on demand, exactly the set `knownLibFilesForCompilerOptions(options, ts)` returns. `createDefaultMapFromCDN` is not used: it needs the network, writes `localStorage` (absent in workers) and always includes DOM.
- Sizes, raw: the ES chain `es5` to `es2025` is 569,639 bytes; `lib.dom.d.ts` is 2,351,349 bytes (323 KB brotli); decorators 14 KB; scripthost 9 KB. First load is about 1.6 MB brotli for the compiler plus ES libs, 0.33 MB more when a lesson asks for DOM, and about 12 MB in Cache Storage after precache.
- Default compiler options for every exercise and REPL buffer: `strict: true`, `target: "es2025"`, `module: "esnext"`, `moduleResolution: "bundler"`, `lib: ["es2025"]`, `types: []`, `skipLibCheck: true`, `isolatedModules: true`, `useDefineForClassFields: true`. TypeScript's default lib for `es2025` pulls in DOM, so `lib` is always set explicitly. A lesson adds `libs: [dom]` when it needs the DOM, and overrides any flag it teaches (`strictNullChecks: false` in lesson 3.2, `noUncheckedIndexedAccess: true` in 16.1).
- One language service lives across exercises: `openProject` swaps the root files and options, which is cheap next to re-parsing the lib files.

### Build

`pnpm build` runs `copy-ts-libs`, then `vite build` (MDX through `@mdx-js/rollup`, content through `import.meta.glob`, twoslash pre-render through the shiki transformer), then the service-worker manifest. `pnpm content:lint` (§3) runs in CI before the build and in `deploy.sh` before shipping.

Scripts, following Kim's names: `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `format:check`, `test`, `test:watch`, `test:e2e`, `content:lint`.

## 3. Content model

### Layout

```
content/
  roadmap.yaml
  renames.yaml                       old id → new id, applied when the store opens (§7)
  modules/
    m03-unions/
      module.yaml
      01-union-and-literal-types/
        lesson.mdx
        exercises/
          01-first-union/
            exercise.yaml
            starter/index.ts
            solution/index.ts
            tests.ts
          02-literal-widening/
            ...
          03-predict-widening/
            exercise.yaml              predict kind: no starter, solution or tests
```

### `roadmap.yaml`

```yaml
tiers:
  - id: t1
    title: Foundations
    modules: [m01-types, m02-functions, m03-unions, m04-objects]
```

### `module.yaml`

```yaml
id: m03-unions
title: Unions and narrowing
summary: One sentence for the roadmap card.
prerequisites: [m02-functions]
lessons: [01-union-and-literal-types, 02-null-undefined-strict]   # folder names, in order
```

### `lesson.mdx`

The frontmatter from §1, then the body. Code fences carry a meta string:

| Fence | Rendering |
| --- | --- |
| `ts` | Static, highlighted by shiki. |
| `ts run` | Run and Open in REPL buttons; output shows under the block. Must have zero diagnostics (lint). |
| `ts run errors` | Same, but diagnostics are expected and are rendered inline as part of the lesson. |
| `ts twoslash` | `^?` queries and error markers pre-rendered at build time by `twoslash`. Never runs in the browser. |

MDX components: `<Callout kind="tip" / "warn" / "ts7">`, `<Predict id>` (an inline Check yourself question with an id unique in the lesson, 2–5 options, one correct, and an explanation; its answer is stored per lesson, §7), `<Key>` (a keystroke chip such as `<Key>gd</Key>`), `<Lesson id>` (a link that shows the lesson's state).

### `exercise.yaml`

```yaml
id: m03-unions/01-union-and-literal-types/01-first-union
kind: implement                 # fix | implement | type-challenge | predict
title: Your first union
minutes: 5
challenge: false
entry: index.ts                 # the file :run executes; tests import it
tests: tests.ts                 # optional for fix
compilerOptions: {}             # merged over the defaults in §2
libs: [es2025]                  # add dom when needed
forbid: [explicit-any]          # rule ids from §5
timeoutMs: 5000
hints:
  - A union lists the alternatives with a vertical bar.
  - The parameter type is `"on" | "off"`.
```

`starter/` and `solution/` hold the same file names. Extra `types/*.d.ts` files are added to the project read-only. For `predict`, the fields `code`, `question`, `options` (2–5), `answer` (an index) and `explanation` replace the file fields.

### Schemas and loading

`src/content/schema.ts` holds the Zod schemas for the three YAML shapes and the MDX frontmatter. The loader runs at build time; any invalid file fails the build with the path and the Zod message. Ids are unique across the whole tree. The registry exposes `tiers`, `modules`, `lessons` and `exercises`, by id and in order.

### Content lint

`pnpm content:lint` runs in Node with the same `ts-ls` core and sandbox prelude the app uses (the pure modules in §2), so a lesson passes here exactly when it passes in the browser. It fails on any of:

1. A schema error, a duplicate id, a prerequisite that doesn't exist, or a cycle in prerequisites.
2. A solution that does not pass its own exercise: a diagnostic, a failing type case, a failing runtime test or a forbidden construct.
3. A starter that already passes. For `fix`, a starter with no diagnostics.
4. A lesson with fewer than two exercises (one in M00), a module with fewer than three lessons, a non-`predict` exercise without hints, or more than three hints.
5. A `predict` exercise or an inline `<Predict>` with zero or more than one correct option, fewer than two options, or a missing or duplicate id.
6. A `ts run` block with diagnostics, or a `ts twoslash` block that fails to render.
7. A lesson id that does not match its folder, or a `renames.yaml` target that does not exist.

The lint prints one line per exercise with the groups that passed, so a content wave is reviewed from its output.

## 4. REPL and editor

### What "REPL" means here

A buffer you edit in Vim and run. The editor shows type errors as you type, the inferred type of anything under the cursor, and the answer to `//   ^?` queries inline. `:w` runs the entry file in the sandbox and shows console output, runtime errors and test results in the output pane. The standalone page at `/repl` has named scratch buffers; the lesson page uses the same editor with the exercise's files.

### Browser-reserved keys

Chrome on Linux reserves `Ctrl-n`, `Ctrl-t`, `Ctrl-w`, their `Shift` variants, `Ctrl-Tab` and `Ctrl-1` to `Ctrl-9`. A page cannot intercept them. So nothing in the app depends on those keys, completion never needs `Ctrl-n`, and insert-mode `Ctrl-w` is a known gap (`Ctrl-Backspace` deletes a word instead). Prep checks whether an installed PWA window frees any of them.

### Vim checklist

The Prep spike runs this list against `@replit/codemirror-vim` 6.4.0 and records pass, workaround or gap per item. **P** must pass as shipped. **W** may be met by a default mapping in the shipped vimrc or by a `Vim.defineEx` or `Vim.defineAction` definition (`defineAction` to be confirmed in Prep).

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

### Mappings and the vimrc

Settings holds a vimrc text area. Supported lines: the `map` family above, `unmap`, `set <option>`, `let mapleader = "<key>"`, and `"` comments. They are parsed into `Vim.map`, `Vim.unmap` and option calls when the editor is created and whenever the setting changes. Bad lines are listed with their line number and skipped.

Shipped defaults:

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

`Ctrl-h/j/k/l` move between panes, the way vim-tmux-navigator does, in normal and visual mode only. In insert mode they keep their Vim meaning.

### Ex commands

The editor's `:` line is the app's command line. Each command is registered with `Vim.defineEx` and also listed in the `Ctrl-p` palette.

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

### Type feedback in the editor

- **Diagnostics.** A `@codemirror/lint` source asks ts-ls for syntactic and semantic diagnostics of every project file 200 ms after typing stops. Squiggles and gutter marks in the editor; the full list in the output pane's Problems tab, with file and line for other files. `]d` and `[d` move between them.
- **Quick info.** `hoverTooltip` on mouse hover, `K` at the cursor. Shows the signature and the JSDoc.
- **Completions.** The `@codemirror/autocomplete` source asks for completions on typing and on `Ctrl-Space`; details load when an item is selected. `Ctrl-j`/`Ctrl-k` and `Tab`/`Shift-Tab` move, `Ctrl-p` also moves up, `Enter` or `Ctrl-y` accept, `Esc` closes and returns to normal mode.
- **Twoslash queries.** A line matching `//\s*\^\?` asks for the quick info at the `^` column on the line above. The answer renders as a block widget under the comment, refreshed with every diagnostics cycle, and shows an error when the query points at nothing.
- **Signature help** on `(` and `,`. **Go to definition** with `gd`, across the exercise's files.
- The editor accepts input before the compiler is ready; a status chip says "compiler loading" until `ready`.

### Running and the output pane

- `:w` asks ts-ls to `emit` the project, then starts a sandbox worker with the modules. The output pane has tabs: **Console**, **Problems** (diagnostics), **Tests** (after `:test`), and a status line: running, done in N ms, killed after N ms.
- Console entries are serialized in the worker: depth 3, cycle-safe, with Error, Map, Set, Date, class names and functions shown readably. Capped at 500 entries or 200 KB, then one "output truncated" line.
- Runtime errors show the message and the TypeScript file and line, mapped through the inline source map. In the output pane `j`/`k` move and `Enter` moves the cursor to that line.
- The deadline is `timeoutMs` (default 5 s). At the deadline the worker is terminated and the status says so. If the entry module settles but timers are still pending, the status says "still running" with the count, and `:kill` ends it.
- `:test` runs with `mode: "test"`: the test file is the entry and the harness prelude streams results to the Tests tab (§5).

### Multi-file exercises

Files show as tabs above the editor. `:b <file>`, `:ls`, `gt` and `gT` switch. Lesson-supplied `.d.ts` files are read-only and marked. The starter's file set is fixed; exercises never ask Kim to create files.

### Focus and panes

Exactly one pane has focus: theory, editor or output. Inside the editor every key goes to Vim; the app handles none of them. `Ctrl-h/j/k/l` move focus between theory, editor and output from normal mode (through the mappings above) and from any non-editor pane (through the app). `Esc` in a non-editor pane returns focus to the editor.

## 5. Exercise verification

Verification has four groups. A group that an exercise doesn't define counts as passed. The exercise passes when all four do.

### Compiles

Every user file must have zero diagnostics, except inside type-case ranges (below). `@ts-ignore`, `@ts-nocheck` and `@ts-expect-error` in a user file other than `tests.ts` always fail, so an error cannot be silenced.

### Type cases

- `tests.ts` imports from the solution's files and from `@dojo/type-utils`, a vendored copy of type-challenges' `utils/index.d.ts` (MIT): `Expect`, `Equal`, `NotEqual`, `IsAny`, `IsTrue`, `IsFalse`, `Alike`, `ExpectExtends`, `ExpectValidArgs`. The alias resolves inside the virtual FS to a bundled `.d.ts`.
- ts-ls finds cases by walking the `tests.ts` AST: every element of a tuple type alias whose name starts with `cases`, and every statement whose leading comment is `@ts-expect-error`. A case's name is a trailing `// name` comment, or `case N`. Its range is the element's or statement's text range, including the directive line.
- A case fails when any diagnostic falls inside its range. An unused `@ts-expect-error` produces TS2578 on the directive line, inside the range, so a line that was supposed to error and no longer does fails its case without special logic.
- Diagnostics in `tests.ts` outside any case range fail the Compiles group with a "test file does not compile" note, which usually means the solution exports the wrong name.

### Runtime tests

- The sandbox prelude defines `test(name, fn)`, `test.skip`, and `expect(value)` with `toBe`, `toEqual` (structural; arrays, plain objects, Map, Set, Date), `toBeCloseTo`, `toThrow(message?)`, `toBeInstanceOf`, `toContain`, `toHaveLength`, `toBeUndefined`, `toBeNull`, `resolves`, `rejects` and `.not`.
- Tests are collected while `tests.ts` evaluates and run one at a time, each in a try/catch with a 1 s timeout. The solution module's top-level code runs once, when the test file imports it.
- Each result streams to the UI: name, status, message, expected and actual (serialized like console output), duration. The Tests tab shows them as they arrive.
- The harness is about 150 lines of our own code. No test framework runs in the browser.

### Rules

| Rule id | Detects | On by default |
| --- | --- | --- |
| `ts-directive` | `@ts-ignore`, `@ts-nocheck`, or `@ts-expect-error` outside `tests.ts` | always; cannot be turned off |
| `explicit-any` | `SyntaxKind.AnyKeyword` anywhere | `type-challenge` |
| `implicit-any` | diagnostic codes 7006 and 7031 (only reachable when a lesson turns `noImplicitAny` off) | off |
| `as-unknown-as` | an `as` expression whose operand is an `as unknown` expression | off |
| `non-null-assertion` | `x!` | off |
| `angle-cast` | `<T>x` | off |
| `eval` | calls to `eval` or `new Function` | always |
| `no-skipped-tests` | `test.skip` in `tests.ts` | always |

ts-ls walks each user file's `SourceFile` with `ts.forEachChild` and returns every hit with file, line and the rule's message. Exercises list rule ids in `forbid`.

### Verdict

```ts
type ExerciseResult = {
  compiles:  { ok: boolean; diagnostics: Diag[] };
  typeCases: { ok: boolean; cases: { name: string; ok: boolean; diagnostics: Diag[] }[] };
  runtime:   { ok: boolean; tests: { name: string; status: 'pass' | 'fail' | 'timeout' | 'skip';
                                      message?: string; expected?: string; actual?: string; ms: number }[] };
  rules:     { ok: boolean; hits: { rule: string; file: string; line: number; message: string }[] };
  passed: boolean; // all four ok
};
```

`:test` runs Compiles first and stops there if it fails, because the other groups mean nothing on code that doesn't compile. The Tests tab shows four rows with a check or a cross, expandable with `Enter`, navigable with `j`/`k`; `Enter` on a diagnostic, a failed test or a rule hit moves the cursor to it. A passed exercise plays no sound and shows no confetti. It shows "Passed" and the `:next` hint.

## 6. Web app

### Pages

| Route | Page |
| --- | --- |
| `/` | Roadmap |
| `/m/:module` | Module: its lessons in order |
| `/l/:lesson` | Lesson: theory and practice, first unfinished exercise selected |
| `/l/:lesson/:exercise` | Same page with that exercise selected; the URL always reflects the selection |
| `/repl` | Standalone REPL with scratch buffers |
| `/settings` | Settings (§7) |
| `/progress` | Progress overview, export, import, reset |

Deep links work on the droplet through the nginx SPA fallback (§10).

### Roadmap

- Tiers are horizontal bands from top (Orientation) to bottom (Expert). Modules are cards in their band, in `roadmap.yaml` order.
- A card shows the title, lessons complete out of total, minutes remaining and a progress ring. States: not started (muted), in progress (accent ring), complete (filled).
- Prerequisite edges are SVG curves between cards. An edge between neighbours in the same band is implied and not drawn, to keep the map readable.
- A "Continue" bar at the top names the last touched exercise and opens it with `c` or `Enter`.
- A module whose prerequisites are not complete shows "Recommended first: …" on its card and on its page. It still opens.
- Keys: `j`/`k` move between cards in reading order, `h`/`l` within a band, `Enter` opens, `c` continues.

### Module page

The module's summary, prerequisites with their state, then its lessons in order: state, title, minutes, objectives on expand. `j`/`k`/`Enter`.

### Lesson page

- Two panes. Left: theory, a scrollable MDX page with the objectives at the top and the `:done` button at the end. Right: practice, with the exercise strip at the top (one chip per exercise with its state), the prompt, the editor with its file tabs, and the output pane below.
- The split defaults to 40/60 and can be dragged; `:layout` switches to one pane full width. The layout choice is remembered.
- The exercise header shows the kind, minutes, hints used and whether the solution was viewed.
- `predict` exercises replace the editor with the snippet, the options (`j`/`k`, `Enter`) and, after answering, the explanation.
- Theory keys when focused: `j k gg G Ctrl-d Ctrl-u` scroll, `Enter` on a code block runs Open in REPL, `j`/`k` and `Enter` answer a Check yourself question when one has focus, `:done` marks the theory read.

### Global keys

These fire only when the editor does not have focus. When it does, every key is Vim's, and the ex commands in §4 are the way to reach app actions.

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

Conflict rule: no global key fires while the editor is focused, so nothing can shadow a Vim key. `Ctrl-h/j/k/l` reach the editor as Vim mappings instead (§4), and `Ctrl-p` opens the palette from normal mode only; in insert mode it stays completion.

### Command palette

`Ctrl-p` outside the editor or in normal mode. One list: lessons by title and tags, exercises by title, ex commands by name. `Enter` runs; `Esc` closes and restores focus.

### Theme and type

Light and dark, following the system by default, switchable with `:set bg=`. One monospace face for the editor and code, self-hosted with `@fontsource` (JetBrains Mono, to confirm at F1), one sans face for prose. Minimal chrome: no sidebar on the lesson page, a one-line header with the lesson path and the compiler status chip.

## 7. Progress and settings

### Store

Dexie database `ts-dojo`, version 1:

| Table | Key | Fields |
| --- | --- | --- |
| `lessons` | `id` | `state`, `theoryReadAt`, `completedAt`, `lastOpenedAt`, `lastExerciseId`, `layout`, `questions` (question id → answer index, correct, at) |
| `exercises` | `id` | `lessonId`, `state` (`untouched` / `in-progress` / `passed`), `passedAt`, `attemptsToPass`, `hintsUsed`, `solutionViewed`, `files` (name → text), `updatedAt`, `predictAnswer` |
| `attempts` | `++id`, index `exerciseId` | `at`, `passed`, `groups` (four booleans and counts), `ms`, `files` |
| `buffers` | `name` | `text`, `updatedAt` (the `/repl` scratch buffers) |
| `meta` | `key` | `schemaVersion`, `contentVersion`, `lastLessonId`, `importedAt` |

Settings are one JSON object in `localStorage` under `ts-dojo:settings`: `vimrc`, `relativeNumbers`, `fontSize`, `theme`, `defaultTimeoutMs`, `compilerDefaults`, `layout`.

Writes: exercise files are autosaved 500 ms after the last keystroke; an attempt row is written on every `:run` and `:test`, and rows beyond the newest 20 per exercise are pruned on write.

### Export and import

- `:export` or the button on `/progress` downloads `ts-dojo-progress-<date>.json`: `schemaVersion`, `contentVersion`, `exportedAt`, every row of `lessons`, `exercises` and `buffers`, the newest 5 attempts per exercise, and `settings`.
- Import on `/progress` reads a file, shows what it would change (lessons, exercises, attempts, buffers, settings) and applies on confirmation. Rows merge by id and the newer `updatedAt` wins; attempts append; a passed exercise never becomes unpassed.
- Reset scopes: one exercise (files only, by `:reset`), one lesson, one module, everything. Each asks for a confirmation; "everything" asks to type the word `reset`.

### Content versions

- Lesson and exercise ids are stable. A rename goes into `content/renames.yaml` (`old: new`) and the store applies it when it opens. The lint fails on a rename whose target doesn't exist.
- A removed lesson keeps its rows; they are ignored and listed on `/progress` under "orphaned".
- `contentVersion` is the content tree's hash at build time, recorded in exports so a mismatch can be shown on import.

## 8. Curriculum

74 core lessons and 6 optional ones (opt), about 28 hours of core work. Minutes are theory plus core exercises. Every lesson follows §1. The compiler is 6.0.3; lessons that describe TypeScript 7 behaviour say so with a `ts7` callout. Module prerequisites are in parentheses.

### Tier 0: Orientation

**M00 Orientation** (none)

| # | Lesson | Min |
| --- | --- | --- |
| 0.1 | Why TypeScript, and what the compiler does: erasure, no runtime types, `tsc` vs bundlers, where TS 7 fits | 10 |
| 0.2 | The dojo: roadmap, lessons, exercises, how passing works, hints and solutions | 10 |
| 0.3 | Vim in this app: the shipped vimrc, ex commands, `K`, `]d`, `gd`, `^?` | 15 |

### Tier 1: Foundations

**M01 Types and inference** (M00)

| # | Lesson | Min |
| --- | --- | --- |
| 1.1 | Annotations and inference: when to write a type and when not to | 15 |
| 1.2 | Primitives, literal types and widening: `let` vs `const`, `as const` preview | 15 |
| 1.3 | Arrays, tuples, objects and `readonly`; optional properties | 20 |
| 1.4 | `any`, `unknown`, `never` and `void`: what each allows | 20 |

**M02 Functions** (M01)

| # | Lesson | Min |
| --- | --- | --- |
| 2.1 | Parameter and return types; optional, default and rest parameters | 20 |
| 2.2 | Function types, callbacks and contextual typing | 20 |
| 2.3 | `void` returns, `undefined` vs `void`, and the callback return rule | 15 |

**M03 Unions and narrowing** (M02)

| # | Lesson | Min |
| --- | --- | --- |
| 3.1 | Union and literal types | 15 |
| 3.2 | `null`, `undefined` and `strictNullChecks` (this lesson turns the flag off, then on) | 15 |
| 3.3 | Narrowing: `typeof`, truthiness, equality, `in`, `instanceof` | 20 |
| 3.4 | Control-flow analysis: assignments, early returns, closures, and what breaks narrowing | 20 |
| 3.5 | Discriminated unions and exhaustiveness with `never` | 20 |

**M04 Object types, interfaces and classes** (M03)

| # | Lesson | Min |
| --- | --- | --- |
| 4.1 | `type` vs `interface`, and intersections | 20 |
| 4.2 | Structural typing and excess property checks | 20 |
| 4.3 | Index signatures and `Record` | 15 |
| 4.4 | Enums vs `as const` unions | 15 |
| 4.5 | Classes I: fields, constructors, `public`/`private`/`protected`, `readonly`, `implements`, abstract classes | 25 |

### Tier 2: Intermediate

**M05 Generics** (M04)

| # | Lesson | Min |
| --- | --- | --- |
| 5.1 | Generic functions and inference | 20 |
| 5.2 | Constraints and defaults | 20 |
| 5.3 | Generic interfaces, type aliases and classes | 20 |
| 5.4 | `keyof` constraints and typed property access | 20 |
| 5.5 | When generics hurt: over-generic code and the return-type-only smell (opt) | 15 |

**M06 Type operators and utility types** (M05)

| # | Lesson | Min |
| --- | --- | --- |
| 6.1 | `keyof`, `typeof` and indexed access types | 20 |
| 6.2 | Utility types I: `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record` | 20 |
| 6.3 | Utility types II: `Exclude`, `Extract`, `NonNullable`, `ReturnType`, `Parameters`, `Awaited`, `InstanceType`, `ConstructorParameters` | 20 |
| 6.4 | Rebuilding the utilities: a first look at mapped and conditional types | 20 |

**M07 Guards, assertions and exhaustiveness** (M06)

| # | Lesson | Min |
| --- | --- | --- |
| 7.1 | User-defined type guards (`is`) and inferred type predicates | 20 |
| 7.2 | Assertion functions (`asserts`) | 15 |
| 7.3 | Exhaustive `switch`, `assertNever`, `satisfies` and `as const` for config | 25 |
| 7.4 | Narrowing pitfalls: callbacks, mutation, array methods and `filter` | 15 |

**M08 Functions and classes II** (M07)

| # | Lesson | Min |
| --- | --- | --- |
| 8.1 | Overloads, and when a union or a generic is better | 20 |
| 8.2 | `this` parameters, `this` types, callable and constructable types | 25 |
| 8.3 | Classes II: generic classes, `override`, accessors, static blocks, parameter properties | 20 |
| 8.4 | Mixins (opt) | 15 |

**M09 Modules, declarations and async** (M08)

| # | Lesson | Min |
| --- | --- | --- |
| 9.1 | ESM in TypeScript: `import type`, `export type`, `verbatimModuleSyntax`, `isolatedModules` | 20 |
| 9.2 | Declaration files and `declare`: ambient types and globals | 20 |
| 9.3 | Typing async code: `Promise`, `Awaited`, async iterators | 20 |
| 9.4 | Errors: `unknown` in `catch`, Result-style returns | 15 |

### Tier 3: Advanced type system

**M10 Mapped types** (M09)

| # | Lesson | Min |
| --- | --- | --- |
| 10.1 | Mapped types, homomorphism, and the `+`/`-` modifiers for `readonly` and `?` | 25 |
| 10.2 | Key remapping with `as` and template literals | 20 |
| 10.3 | Mapping over unions, tuples and arrays | 20 |

**M11 Conditional types** (M10)

| # | Lesson | Min |
| --- | --- | --- |
| 11.1 | Conditional types and assignability | 20 |
| 11.2 | `infer` | 20 |
| 11.3 | Distributive conditional types, and how to stop distribution | 20 |
| 11.4 | Recursive conditional types and the patterns: `Flatten`, `DeepPartial`, `DeepReadonly`, `UnionToIntersection` | 30 |

**M12 Template-literal and tuple types** (M11)

| # | Lesson | Min |
| --- | --- | --- |
| 12.1 | Template literal types, the intrinsics, and parsing strings with `infer` | 30 |
| 12.2 | Variadic tuple types | 20 |
| 12.3 | Tuple manipulation: `Head`, `Tail`, `Last`, `Length`, `Reverse`, `Includes` | 25 |
| 12.4 | Recursion limits, tail recursion and accumulators | 20 |

**M13 Type-level programming track** (M12)

| # | Lesson | Min |
| --- | --- | --- |
| 13.1 | type-challenges, easy set (13 challenges) | 45 |
| 13.2 | Medium set I | 60 |
| 13.3 | Medium set II | 60 |
| 13.4 | Hard set, selected (opt) | 60 |
| 13.5 | Extreme set, selected (opt) | 60 |

**M14 The edges of the type system** (M11)

| # | Lesson | Min |
| --- | --- | --- |
| 14.1 | Assignability, variance, and `in`/`out` annotations | 25 |
| 14.2 | `const` type parameters and `NoInfer` | 20 |
| 14.3 | Branded, nominal and phantom types; `unique symbol` | 20 |
| 14.4 | Declaration merging, namespaces, module and global augmentation | 20 |
| 14.5 | Decorators: the TS 5 standard decorators (opt) | 20 |

### Tier 4: Expert

**M15 Type-safe API design** (M13, M14)

| # | Lesson | Min |
| --- | --- | --- |
| 15.1 | Builders and fluent chains | 25 |
| 15.2 | Typed event emitters and pub/sub | 25 |
| 15.3 | `pipe`, `compose` and inference-driven signatures | 30 |
| 15.4 | Typed routes and path parameters | 25 |

**M16 Tooling and configuration** (M09)

| # | Lesson | Min |
| --- | --- | --- |
| 16.1 | tsconfig: the strict family, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, and what each catches | 25 |
| 16.2 | Module resolution: `bundler`, `node16`/`nodenext`, `paths`, `.js` extensions in imports | 20 |
| 16.3 | Project references, `isolatedDeclarations`, `erasableSyntaxOnly` and Node's type stripping | 20 |
| 16.4 | TypeScript 6 and 7: the new defaults, the deprecations, the native compiler (theory, `ts7`) | 15 |
| 16.5 | Authoring `.d.ts` for a JavaScript library | 25 |

**M17 Types at the boundary** (M09, M11)

| # | Lesson | Min |
| --- | --- | --- |
| 17.1 | Parse, don't validate | 20 |
| 17.2 | Zod and Valibot: schema inference, transforms, branded output (Zod pre-bundled) | 25 |
| 17.3 | Typing `fetch`, JSON and environment variables | 20 |
| 17.4 | TypeScript with React: props, generic components, discriminated props, hooks (React's types pre-bundled) | 30 |

**M18 Capstones** (M15, M16, M17)

| # | Lesson | Min |
| --- | --- | --- |
| 18.1 | A type-safe router | 45 |
| 18.2 | A query builder | 45 |
| 18.3 | A typed state store with typed actions | 45 |
| 18.4 | A type-level JSON parser (opt) | 60 |
| 18.5 | Type performance clinic: deep instantiation, `--generateTrace`, measuring | 30 |

Content waves (§11): F11 ships M00–M04 (20 lessons), F12 M05–M09 (19 core, 2 opt), F13 M10–M14 (18 core, 3 opt), F14 M15–M18 (17 core, 1 opt).

## 9. Performance, offline and reliability

### Budgets

Measured at F15 on Kim's laptop in Chrome and recorded in `docs/progress.md`.

| What | Budget |
| --- | --- |
| Cold load, app shell interactive | under 2 s on broadband |
| Cold load, compiler `ready` | under 5 s; the editor is usable before that, with the "compiler loading" chip |
| Warm load (service worker), compiler `ready` | under 1.5 s |
| Diagnostics for a 200-line file, `es2025` lib, warm | under 300 ms p95 after typing stops |
| Quick info | under 100 ms |
| Run of a trivial file, worker spawn included | under 150 ms |
| ts-ls worker memory, steady | under 250 MB |
| Total precache | under 15 MB raw |

### Warm-up

The ts-ls worker starts on app load and opens an empty project with the default options, so the first lesson's diagnostics are immediate. The libs for `es2025` load then; DOM loads on first use.

### Offline

`vite-plugin-pwa` in `generateSW` mode precaches the app, the worker chunk and `public/ts/6.0.3/**`. After one online visit, every page, lesson, diagnostic and run works offline. Updates: the service worker fetches new assets in the background and the app shows "Reload for the new version". It never reloads by itself mid-exercise.

### Staleness and failure

- Replies carry file versions; stale ones are dropped (§2).
- If the ts-ls worker crashes, the app restarts it, re-opens the project and shows a banner for 5 s. Edits are never lost: the editor is the source of truth and files are autosaved.
- The sandbox cannot freeze the page: a tight loop is terminated at the deadline. A memory blow-up can still crash the tab; §13 lists that as a risk, not something v1 prevents.
- Output caps (§4) stop a `console.log` in a loop from freezing the output pane.
- Autosave every 500 ms idle; an attempt row before the sandbox starts; the exercise's files restored on return.

## 10. Deploy

The plinth pattern: a static build, no process on the droplet, nginx from disk.

| Item | Value |
| --- | --- |
| Host path | `/var/www/ts-dojo`, owned by `www-data` |
| Process | none |
| nginx | `/etc/nginx/sites-available/ts-dojo`, from `deploy/nginx/ts-dojo.conf` |
| TLS | certbot, webroot method against `/var/www/certbot` |
| DNS | Namecheap, A record `dojo` pointing at the droplet |
| Deploy | `deploy/deploy.sh`, by hand from the workstation, `TS_DOJO_HOST` required |

### nginx differences from `plinth.conf`

- `location / { try_files $uri /index.html; }` because the app has a client-side router. `/assets/` and `/ts/` keep `try_files $uri =404`.
- `location /ts/ { types { text/plain ts; } ... }` with a one-year immutable cache. nginx's `mime.types` maps `.ts` to `video/mp2t`. The worker reads the files as text either way, but the right type keeps `gzip_types` and any proxy honest.
- `index.html`, `sw.js` and `manifest.webmanifest` are `no-cache`. Everything under `/assets/` is immutable.
- `gzip_static on`, and `deploy.sh` precompresses `js`, `css`, `html`, `svg`, `json` and `d.ts` with `gzip -9`. The worker chunk is about 9 MB raw; brotli measured 1.5 MB, so expect about 2 MB gzipped (estimate).
- Headers repeated per location, as the plinth file explains. Add `Content-Security-Policy: default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'`, so the blob-URL modules and workers work and nothing else loads.

### First deploy (from the hub runbook)

1. Add the A record at Namecheap.
2. Install the HTTP-only bootstrap vhost (`hub-bootstrap.conf` as the template), probe the ACME path, then `certbot certonly --webroot -w /var/www/certbot -d dojo.kimnejudne.dev`.
3. Install `ts-dojo.conf`, `nginx -t && systemctl reload nginx`, copy the installed file back into `deploy/nginx/`.
4. Run `deploy/deploy.sh` (copied from `portfolio/plinth/deploy/deploy.sh`): typecheck, lint, content lint, build, check `dist/index.html`, precompress, back up the current site to `/var/backups/ts-dojo-<UTC>.tar.gz`, `rsync -az --delete`, `chown`, `nginx -t`, reload, curl checks, print the rollback command.
5. Write `deploy/README.md` with the table above and sections for Deploying, Rollback, Caching, DNS/TLS and nginx.

Never `scp` a whole vhost over one certbot has edited.

## 11. Phased roadmap

Estimates assume Claude writes code and content with Kim reviewing, in the job-search workflow: plan mode per feature, the §12 criteria listed first, one commit per feature.

**Prep (one evening)**

- Vim spike: a Vite page with CodeMirror and `@replit/codemirror-vim`, run through the §4 checklist; record pass, workaround or gap per item, and which `Ctrl` keys Chrome lets the page intercept, in a tab and in an installed PWA window.
- Copy `typescript@6.0.3`'s `lib.*.d.ts` and record the sizes; confirm `knownLibFilesForCompilerOptions` for the default options returns only ES files.
- Add the DNS A record for `dojo` at Namecheap.

> **Gate:** every P item passes or has a working mapping, and the W list is written down.

**v1 (about six weekends)**

- Weekend 1: F1 scaffold, F2 language-service worker.
- Weekend 2: F3 editor, F4 sandbox, F5 standalone REPL.

> **Gate:** the REPL works: Vim checklist, diagnostics, `^?`, run, kill, clipboard.

- Weekend 3: F6 content pipeline, F7 verification, F8 lesson page, with three fixture lessons.

> **Gate:** one lesson works end to end.

- Weekend 4: F9 roadmap and progress, F10 settings, F15 offline and deploy.

> **Gate:** deployed at dojo.kimnejudne.dev; offline works.

- Weekends 5–6: F11, Tier 0 and 1 content (20 lessons).

> **Gate (v1):** §12 passes, and Kim completes Tier 0 and Tier 1 on the deployed site without a mouse.

**v1.1 (one weekend each)**

- F12 Tier 2 content, then F13 Tier 3, then F14 Tier 4.
- Inspector line: an input under the console that evaluates an expression against the last run's module scope and shows the value and its type.
- `:diff`: the solution as a diff against Kim's files.

**Phase 2 (when wanted)**

- A review queue: exercises failed or solved with the solution come back after a week.
- npm imports in the REPL with `@typescript/ata` for types (online only), through `esm.sh` or a pre-bundled allowlist.
- The TypeScript 7 WASM language service once the official Playground work lands; it needs cross-origin isolation, which nginx can provide with headers.
- Sync between devices through a small endpoint on the droplet, only if Kim actually uses two machines.

## 12. v1 acceptance criteria

v1 is done when every box below is checked, in CI, in Playwright or by hand in Chrome as noted, and the v1 gate in §11 passes.

### Prep

- [ ] The §4 Vim checklist has a recorded result for every item: pass, workaround (with the mapping), or gap.
- [ ] `public/ts/6.0.3/` holds every `lib.*.d.ts` from `typescript@6.0.3`, and §2's sizes are confirmed or corrected.
- [ ] `dojo.kimnejudne.dev` resolves to the droplet.

### F1. Scaffold

- [ ] `pnpm dev`, `build`, `preview`, `typecheck`, `lint`, `format:check`, `test --run` and `test:e2e` exist and pass on a clean clone with Node 24 and pnpm 12.
- [ ] GitHub Actions runs typecheck, lint, format check, unit tests and build on every push and pull request.
- [ ] `tsconfig.json` has every flag listed in §2.
- [ ] Every route in §6 renders a placeholder, in light and dark, and `?` opens the help overlay.
- [ ] shadcn is initialised with `base-nova` and the Button, Dialog, Tabs, Tooltip, Command and Sheet primitives.

### F2. Language-service worker

- [ ] The worker reports `ready` with `tsVersion` `6.0.3`, and no request leaves the origin (Playwright network log).
- [ ] `openProject` with `lib: ["es2025"]` fetches only ES lib files; with `libs: ["dom"]` it also fetches `lib.dom.d.ts`, once.
- [ ] `getDiagnostics` on a 200-line fixture returns in under 300 ms p95 after warm-up, measured by a Vitest benchmark on the core module.
- [ ] `getQuickInfo` returns the display string and docs for an identifier; `getTwoslashQueries` returns one entry per `^?` with the right line and text, and an error entry when the query points at whitespace.
- [ ] `emit` returns JavaScript with an inline source map for every file and elides type-only imports.
- [ ] A reply with an older `version` than the file's current one is dropped by the client (unit test).
- [ ] `lintAst` reports every rule in §5 on a fixture, with file and line.
- [ ] `runTypeTests` groups diagnostics into cases as §5 describes, including the TS2578 case.

### F3. Editor

- [ ] Every P item in the §4 checklist passes in Chrome; every W item has its mapping or definition applied by default.
- [ ] The shipped vimrc applies; `imap jk <Esc>` works; a bad vimrc line is reported with its number and skipped, and the good lines still apply.
- [ ] Every ex command in §4 does what its row says, including `:w` running the code and `:set rnu` persisting.
- [ ] Squiggles and gutter marks appear within 300 ms of typing stopping; `]d` and `[d` move between diagnostics; `K` shows quick info at the cursor; `gd` jumps to a definition in another file.
- [ ] A `//   ^?` line shows the queried type under it and updates on edit.
- [ ] Completions open on typing and `Ctrl-Space`; `Ctrl-j`/`Ctrl-k` and `Tab`/`Shift-Tab` move; `Enter` or `Ctrl-y` accept; `Esc` closes and returns to normal mode.
- [ ] `"+y` and `"+p` use the system clipboard over HTTPS and on localhost.
- [ ] Multi-file: tabs, `:b`, `:ls`, `gt`, `gT`; a lesson `.d.ts` is read-only and marked.
- [ ] Editing works before the compiler is ready, with the status chip showing.

### F4. Sandbox runner

- [ ] `console.log` of a string, a nested object, a Map, a class instance and an Error renders readably with its source line.
- [ ] `while (true) {}` is terminated at the deadline, the page stays responsive throughout (Playwright keeps typing during the run), and the status reads "killed after 5 s".
- [ ] A thrown error shows the message and the TypeScript file and line; `Enter` on it moves the cursor there.
- [ ] Two files importing each other without a cycle run in the right order; a cycle falls back to CommonJS and still runs (fixtures for both).
- [ ] Top-level `await` works in a single-file run.
- [ ] Output stops at 500 entries or 200 KB with one truncation line.
- [ ] A pending `setTimeout` after the entry settles shows "still running (1 timer)"; `:kill` ends it.

### F5. Standalone REPL

- [ ] `/repl` opens the last buffer; `:e name` creates or switches; `:ls` lists; `:bd` deletes after confirmation.
- [ ] A buffer survives a reload, autosaved within 1 s of the last keystroke.
- [ ] Open in REPL from a theory block creates a buffer with the snippet and focuses the editor in normal mode.

### F6. Content pipeline

- [ ] `pnpm content:lint` fails on each §3 condition, proven by one fixture per condition.
- [ ] Every shipped solution passes its own exercise and every starter fails it, checked in Node with the same core modules the app uses.
- [ ] A `ts twoslash` block renders its `^?` results at build time; the browser loads no worker for theory.
- [ ] `ts run` blocks have Run and Open in REPL; `ts run errors` blocks show their diagnostics.
- [ ] Three fixture lessons (one per editor kind, plus a `predict`) exist under `content/` and render.

### F7. Exercise verification

- [ ] For a `type-challenge` fixture, each `cases` element is its own case with pass or fail, and an unused `@ts-expect-error` fails its case.
- [ ] For an `implement` fixture, every runtime test reports pass or fail with expected and actual; a 1 s hang reports `timeout`.
- [ ] `forbid: [explicit-any]` fails a solution with `any` and names the line; without the rule the same solution passes.
- [ ] A `@ts-ignore`, `@ts-nocheck` or `@ts-expect-error` in a non-test user file always fails, and so does `eval`.
- [ ] A `fix` exercise passes only when every file has zero diagnostics.
- [ ] Compiles failing stops the other groups, with the reason shown.
- [ ] The Tests tab shows the four groups; `j`/`k` move, `Enter` expands or jumps to the source.

### F8. Lesson page

- [ ] Theory and practice side by side; `Ctrl-h/j/k/l`, `1`/`2`/`3` and `Esc` move focus as §4 and §6 say.
- [ ] With the editor focused in normal mode, `g r`, `g n`, `] e` and `?` do nothing app-level (Playwright).
- [ ] `:done` with Check yourself questions unanswered jumps to the first one and says how many remain; once all are answered correctly, `:done` marks theory read; passing every required exercise then completes the lesson, and the module page and the roadmap show it.
- [ ] `:hint` reveals hints in order and records the count; `:sol` opens the solution read-only and records it; `:reset` restores the starter after confirmation.
- [ ] `:next` and `:prev` move between exercises and across lesson boundaries; the URL reflects the current exercise; a direct link to `/l/<lesson>/<exercise>` opens it.
- [ ] Files are autosaved per exercise and restored on return, including after a reload mid-edit.
- [ ] A `predict` exercise answers with `j`/`k`/`Enter`, shows the explanation and records the answer.

### F9. Roadmap, modules and progress

- [ ] The roadmap renders every tier and module from `roadmap.yaml` with prerequisite edges and progress rings; `j`/`k`/`h`/`l`/`Enter`/`c` work without a mouse.
- [ ] Continue opens the last touched exercise.
- [ ] A module with unmet prerequisites shows "Recommended first" and still opens.
- [ ] `/progress` shows per-module counts, hints used and solutions viewed; `:export` downloads the JSON in §7; import previews and merges as §7 says; each reset scope works with its confirmation.
- [ ] Progress survives a reload and a content deploy; a `renames.yaml` entry migrates an id (fixture rename).

### F10. Settings

- [ ] vimrc, relative numbers, font size, theme, default timeout and compiler defaults are editable and apply without a reload.
- [ ] Settings are included in export and restored by import.

### F11. Content wave 1 (Tier 0 and 1)

- [ ] M00 to M04 exist as §8 lists them: 20 lessons, each with the §1 structure, at least two exercises (one in M00), at least one `predict`, hints on every editor exercise, and at least one `ts twoslash` block.
- [ ] `pnpm content:lint` passes for the whole tree.
- [ ] Kim completes Tier 0 and Tier 1 on the deployed site without a mouse (by hand; the v1 gate).

### F12–F14. Content waves 2–4

- [ ] F12: M05 to M09, 19 core lessons and the two optional ones, to the same rules as F11, lint passing.
- [ ] F13: M10 to M14, 18 core lessons and three optional, with the type-challenges sets crediting their source.
- [ ] F14: M15 to M18, 17 core lessons and one optional; Zod and React's types pre-bundled for 17.2 and 17.4.

### F15. Offline, performance and deploy

- [ ] After one online load, with the network off: the app opens, a lesson loads, diagnostics and a run work (Playwright with `offline: true`).
- [ ] Every budget in §9 is measured and recorded in `docs/progress.md`; any miss has a note.
- [ ] `deploy/deploy.sh` ships `dist/` to `/var/www/ts-dojo`; HTTPS answers with a valid certificate; HTTP redirects. (droplet)
- [ ] `/l/<lesson>` loads directly; `/ts/6.0.3/lib.es2025.d.ts` is served precompressed as `text/plain`; `/assets/*` is immutable; `index.html` and `sw.js` are `no-cache`. (droplet)
- [ ] The CSP in §10 is present and nothing in the app is blocked by it (no CSP errors in the Playwright console).
- [ ] `deploy/README.md` exists with the §10 table and the Deploying, Rollback, Caching, DNS/TLS and nginx sections.

### v1 gate

- [ ] Kim completes Tier 0 and Tier 1 at dojo.kimnejudne.dev without a mouse, and every blocking bug found on the way is fixed.

## 13. Open questions and risks

### Risks

| Risk | Mitigation |
| --- | --- |
| **TypeScript 6.0.3 is the end of the JavaScript compiler.** No new syntax or lib updates reach the in-browser checker, and 7.1's API will be new and native-only. | Pin `~6.0.3`. Keep the checker behind the §2 protocol so it can be swapped. Follow the Playground's WASM work; it needs SharedArrayBuffer, so cross-origin isolation headers on nginx. Mark TS 7 differences with `ts7` callouts. |
| **Vim fidelity gaps.** `@replit/codemirror-vim` is the CodeMirror 5 engine, not Vim, and Chrome reserves `Ctrl-n`, `Ctrl-t` and `Ctrl-w`. | The Prep spike runs the §4 checklist before anything else is built. Gaps are filled with mappings and definitions, listed in `?`, or accepted. The engine is small and MIT, so a fix can be contributed. |
| **Cold start and payload.** About 9 MB of compiler JavaScript to parse, plus up to 2.9 MB of libs. | Precache with the service worker, start the worker on load, keep one service alive, default to no DOM lib, show the loading chip. |
| **Runaway code.** `terminate()` stops loops, but a memory blow-up can crash the tab, and the worker shares the app's origin (storage, fetch). | Fresh worker per run, hard deadline, output caps, CSP with `connect-src 'self'`. If it bites, nest the worker in a sandboxed iframe later. |
| **Modules without a bundler.** Cycles, type-only imports, extensionless specifiers, top-level await ordering. | The resolver mirrors `moduleResolution: bundler`; `transpileModule` elides type-only imports; cycles fall back to CommonJS; a fixture suite of multi-file exercises runs in CI. |
| **Content volume.** 74 core lessons and about 220 exercises are most of the work. | Four waves, one template, a lint that proves every exercise is solvable, and v1 ships with Tier 0–1 only. |

### Open questions (not blocking)

- Write `docs/progress.md` and `CLAUDE.md` now, as job-search has, or at F1?

## Sources

Checked on 17 October 2026.

- TypeScript 7.0 announcement (native compiler, no JavaScript API): https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- TypeScript 6.0 announcement and release notes (last JavaScript release, new defaults): https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ and https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- TypeScript releases: https://github.com/microsoft/TypeScript/releases
- `@typescript/vfs` 1.6.5 API: https://cdn.jsdelivr.net/npm/@typescript/vfs@1.6.5/dist/index.d.ts
- `@replit/codemirror-vim`: https://github.com/replit/codemirror-vim
- CodeMirror 5 Vim mode feature list (the engine codemirror-vim uses): https://codemirror.net/5/demo/vim.html
- CodeMirror 6 changelog: https://codemirror.net/docs/changelog/
- Monaco Editor releases (0.57.0 bundles TypeScript 5.9): https://github.com/microsoft/monaco-editor/releases
- monaco-vim issues (maintenance, clipboard register, dot-repeat, macros): https://github.com/brijeshb42/monaco-vim/issues
- twoslash: https://github.com/twoslashes/twoslash
- type-challenges utilities (MIT): https://github.com/type-challenges/type-challenges/blob/main/utils/index.d.ts
- `@ts-expect-error` and TS2578: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html
- Dynamic `import()` support in workers: https://github.com/mdn/browser-compat-data/blob/main/javascript/operators/import.json
- Import maps in workers, still a draft: https://github.com/whatwg/html/pull/10858
- TypeScript Playground WASM draft (TS 7 in the browser): https://github.com/microsoft/TypeScript-Website/pull/3653
- val-town/codemirror-ts (archived; reference for the CodeMirror and worker glue): https://github.com/val-town/codemirror-ts
- esbuild releases (esbuild-wasm size; rejected): https://github.com/evanw/esbuild/releases
- TypeHero (AGPL; studied, not copied): https://github.com/typehero/typehero
- Kim's conventions: `job-search-automation/docs/spec.md`, `portfolio/plinth/deploy/deploy.sh`, `portfolio/plinth/deploy/nginx/plinth.conf`, `portfolio/hub/deploy/README.md`, `poke-project/components.json`, `online-voting/tsconfig.app.json`.
