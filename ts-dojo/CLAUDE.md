# ts-dojo

One static web app at dojo.kimnejudne.dev that teaches TypeScript from the first annotation to type-level programming: 19 modules in five tiers, every lesson a theory page plus exercises that pass or fail by the compiler and by tests, never by eye. Exercises are solved in a REPL: CodeMirror 6 with `@replit/codemirror-vim`, the real `typescript@6.0.3` in a Web Worker over `@typescript/vfs` for diagnostics, quick info, `^?` queries, emit and AST rules, and a fresh sandbox worker per run, terminated at a deadline. Content ships with the app from `content/`, is validated with Zod at build time and proven solvable by `pnpm content:lint`. Progress lives in Dexie and exports to JSON. No backend, no accounts, offline after the first load, static files behind nginx on Kim's droplet. Never Vercel.

**docs/spec.md is the source of truth.** Read the sections a task touches before planning it: §1 learning model, §2 architecture, §3 content model, §4 REPL and Vim, §5 verification, §6 pages and keys, §7 store, §8 curriculum, §9 budgets, §10 deploy, §11 build order, §12 acceptance criteria. Claude never edits it; a proposed change goes under "Spec questions" in docs/progress.md and the work continues with the spec as written.

## Stack (spec §2)

Vite · React 19 · TypeScript strict `~6.0.3` (one compiler checks the app and runs inside it) · Tailwind 4 · shadcn `base-nova` (Base UI, `rsc: false`) · react-router 7 · Dexie · MDX (`@mdx-js/rollup`, `yaml`, `zod`) · `@codemirror/*` 6.x with `@replit/codemirror-vim` 6.4.0 · `@typescript/vfs` 1.6.5 · `twoslash` 0.3.9 with shiki · `vite-plugin-pwa` 2.0.0 · Vitest · Playwright · ESLint 9 flat with typescript-eslint, react-hooks, jsx-a11y · Prettier (`singleQuote`) · pnpm 12 · Node 24.

Versions and APIs in the spec are as of 17 October 2026. Before relying on one, verify the version exists (`pnpm view <pkg> versions`) and that the API the spec names is in the package's `.d.ts`; report a mismatch instead of substituting.

## Layout (spec §2)

- `content/` lessons and exercises (§3); `public/ts/6.0.3/` the `lib.*.d.ts` files copied by `scripts/copy-ts-libs.ts`.
- `src/app/` routes, layout, keyboard map, palette, theme; `src/components/ui/` shadcn; `src/pages/` roadmap, module, lesson, repl, settings, progress.
- `src/content/` Zod schemas, loaders, registry types, MDX components; `src/editor/` CodeMirror setup, vim config and vimrc parser, TS extensions, `^?` widgets.
- `src/workers/ts-ls/` and `src/workers/sandbox/`: pure cores (`core.ts`, `prelude.ts`) that also run in Node, plus thin worker adapters; `src/protocol/` the message types both sides import.
- `src/verify/` verdicts, case grouping, rule ids; `src/store/` Dexie schema, queries, export/import, migrations, settings.
- `scripts/` copy-ts-libs, content-lint; `deploy/` nginx conf, deploy.sh, README; `docs/` spec, progress; `e2e/` Playwright.

## Scripts (spec §2 Build)

`pnpm dev` · `build` · `preview` · `typecheck` · `lint` · `format` · `format:check` · `test` (`pnpm test --run` for one pass) · `test:watch` · `test:e2e` · `content:lint`. pnpm only: npm, npx and yarn are blocked by a hook.

## Workflow

- One feature per session, in §11 order: Prep, F1–F10, F15, then F11–F14. docs/progress.md holds every §12 criterion in that order; the SessionStart hook prints the current feature. `/feature <id>` runs the whole loop.
- Every feature starts in plan mode. The plan opens with that feature's §12 criteria copied verbatim, each mapped to files, tests and steps. Wait for approval.
- A feature is done only when every §12 criterion is met and proven by a Vitest or Playwright test where it can be automated, and the `acceptance-reviewer` agent agrees. "By hand" and "(droplet)" criteria go on the "For Kim" checklist in docs/progress.md; never claim them.
- Test-first: write the test that proves a criterion, then the code that passes it.
- One commit per feature: `F<n>: <title>`, with the satisfied criteria in the body. The pre-commit hook runs typecheck, lint, format:check and tests first. Never push without asking.
- Never silently simplify, skip or substitute anything the spec names (library, version, flag, key, limit). If it can't be done as written, stop and say what, why, and the proposed alternative. What Kim accepts goes under "Deviations" in docs/progress.md.
- Conventions from Kim's other repos (job-search-automation, plinth, hub, poke-project, online-voting): ask for the file rather than invent the convention.
- Never touch DNS, the droplet, certbot or server nginx. Write the configs and scripts; Kim runs them.

## Tools

Skills (`/name`, or on their own when the description matches):

- `/feature F3`: builds one feature end to end; plan mode first, acceptance-reviewer before the commit, "For Kim" checklist at the end.
- `/verify F3`: re-checks a built feature criterion by criterion without changing code.
- `/lesson m03-unions/03-narrowing`: everything needed to write one lesson to spec, with a complete worked example in `reference/`.
- `/module m03-unions`: module.yaml plus every lesson in order through content-author, then content-reviewer.
- `ts-worker`: the §2 protocol, `@typescript/vfs` setup, lib loading and default compiler options, for worker and UI code.
- `vim`: the §4 checklist, the shipped vimrc, the ex command table and the focus rules, for editor and keyboard work.

Agents (Agent tool, `subagent_type`):

- `acceptance-reviewer`: grades a feature's §12 criteria with evidence; read-only, runs the pnpm checks itself.
- `spec-checker`: finds contradictions with the spec in a diff or a set of files; read-only.
- `content-author`: writes one lesson and its exercises to the lesson skill.
- `content-reviewer`: reviews lessons for accuracy, template, progression, hints and tricks; read-only.
- `e2e-writer`: writes Playwright tests for the §4 and §6 keyboard flows.

Hooks (`.claude/settings.json`, scripts in `.claude/hooks/*.mts`, Node 24, each with a header comment):

- SessionStart prints the current feature, its unchecked criteria and `git status --short`.
- A Bash guard blocks npm, npx and yarn, ssh, certbot, scp and rsync to a remote host, running deploy.sh, force pushes, and shell writes to docs/spec.md.
- An Edit/Write guard blocks docs/spec.md and points to "Spec questions" in docs/progress.md; a deny rule in settings.json backs it up (and answers first for the Edit tool).
- `git commit` first runs typecheck, lint, format:check and `test --run`, skipping scripts that don't exist yet, and blocks the commit on a failure.
- Prettier formats every edited `.ts .tsx .mts .cts .mdx .yaml .yml .json` file once it is installed; never `.md`.
- Stop runs `pnpm typecheck` when `src/`, `content/` or `scripts/` changed and sends Claude back on a failure, once per stop.

rtk: Kim's user-level hook rewrites some commands (`git`, `cat`, `grep`, `curl`, ...) to `rtk ...` to save tokens; use `rtk proxy <cmd>` when raw output is needed.
