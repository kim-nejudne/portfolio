# ts-dojo — Case Study

**A TypeScript course that the compiler grades.** Nineteen modules in five
tiers, from the first type annotation to type-level programming, and every
exercise passes or fails by the real compiler and a test runner, never by eye.
It runs entirely in the browser, works offline after the first visit, and can
be driven end to end from the keyboard.

Live at [dojo.kimnejudne.dev](https://dojo.kimnejudne.dev). No account; progress
stays in the browser and exports to JSON.

Vite · React 19 · TypeScript 6 · CodeMirror 6 · Web Workers · self-hosted, static

## The short version

**What it is** A course I wrote the specification for and use myself: 80
lessons (74 core, 6 optional) and 342 exercises across 19 modules. Each
lesson is theory, then exercises solved in a REPL with Vim keybindings, live
diagnostics, hover types and twoslash `^?` queries from `typescript@6.0.3`
running in a Web Worker. Code runs in a fresh sandbox worker per run, killed at
a deadline.

**The hardest problem** Putting a real compiler in a page and keeping it fast
and offline. TypeScript 7 is a native Go program with no JavaScript API, so 6.0.3
is the last build that can run in a browser at all. Its library files had to be
resolved the way the compiler resolves them, because the API meant for it
cannot return an ES-only set.

**What the scaffold missed** Exercises you could pass without solving them.
Double assertions, a plain `as`, and an `any` leaking out of `JSON.parse` all
compiled and passed the runtime tests. A REPL buffer could also import a type
helper it was meant to write. The verifier now walks the AST with the type
checker to close each of these.

**How it was proven** 1,194 unit tests and 31 Playwright spec files. A content
lint proves every one of the 342 exercises solvable from its own solution. A
keyboard-only walk through Tiers 0 and 1 runs against the live site. Every
performance budget is measured, and the one it misses is published, not
rounded.

---

## Where this started, plainly

The code was written by an AI. I wrote a technical specification on 17 October
2026: the learning model, the architecture, the content format, the REPL's Vim
behaviour, the verification rules, the budgets and a numbered list of
acceptance criteria. Claude Code, Anthropic's coding agent, then built it from
that spec one feature per session, in the order the spec set. Each feature
started as a plan I approved, and a separate reviewing agent graded it against
the spec's criteria before it was committed. Every commit is co-authored by the
model but the last one, and the history says so.

What I did was decide. Wherever the spec turned out to be wrong, or silent, the
build stopped and asked, and the answer is written down: `docs/progress.md`
has a Deviations section listing everything that was built differently from the
spec, with the reason and the date I accepted it, and a Spec questions section
for everything still open. That file is the honest record of where a generated
build needed a human, and it is longer than the spec.

---

## 1. The compiler has to be in the page

The whole premise is that the lessons are graded by the same compiler they
teach. That rules out a server and pins the version: `typescript@~6.0.3`, the
last JavaScript build, in a Web Worker over `@typescript/vfs`. Behaviour that
exists only in TypeScript 7 is taught as theory and marked as such.

The first surprise came before any feature was built. The spec said the worker
should fetch exactly the set `knownLibFilesForCompilerOptions` returns. The
preparatory spike showed that function cannot return an ES-only set: it is a
prefix slice of a fixed list, 101 names including the DOM for the defaults. So
the worker resolves libraries the way the compiler does, by following the
`/// <reference lib="…" />` directives from each `lib` entry. That comes to 76
files for `es2025`, plus `lib.dom.d.ts` only for a lesson that asks for it.

The editor went the same way. Monaco with `monaco-vim` was rejected in the spec
for its missing clipboard register and its dot-repeat and macro bugs.
CodeMirror 6 with `@replit/codemirror-vim` was checked item by item against a
Vim checklist before anything was built on it.

## 2. Passing is not the same as solving

An exercise passes when its files compile with zero diagnostics, its runtime
tests pass, its type cases hold, and it uses none of its forbidden constructs.
The fourth rule turned out to carry the weight.

Partway through the content, known tricks were passing exercises: `as Rgb` in
one lesson, `admin as Member` in another, an untyped `let data` holding
`JSON.parse`, and `globalThis as object as {…}`. Every one of them compiles and
passes its runtime tests, and none of them is a solution. The original rule
only caught `x as unknown as T`. The rules as built catch every double
assertion. They add an opt-in `type-assertion` rule that still allows
`as const`, and an `any-expression` rule that uses the type checker to flag an
`any` where it first appears. Each trick was then run once through the real
verdict to confirm that it fails.

A second hole was subtler. A reviewing agent asked whether a solution could
merge a `declare module '@dojo/type-utils'` block into the ambient scope and
hand itself a helper it was meant to write. It could, and it compiled. That is
now an always-on rule.

The same agent found that the first declaration of `setTimeout` gave a
callback parameter a silent `any`, unlike the DOM's. I chose DOM's `Function`
handler instead, so an unannotated callback is an error here exactly as it is in
a browser project.

## 3. Proving every exercise can be solved

A course with one unsolvable exercise is broken in a way nobody finds until
they are stuck on it. The worker's cores, the language service and the sandbox
prelude, are pure modules that also run in Node. So `pnpm content:lint` runs
every exercise's solution through the same verdict the browser gives, and fails
the build if any does not pass. It ran on every content wave and on every
deploy.

## 4. Budgets, including the one it misses

Measured with Playwright in headless Chrome against an emulated 50 Mbit/s link,
then against the live site:

- Compiler ready from cold: median 1,147 ms against a 5 s budget.
- Diagnostics on a 200-line file: p95 210 ms against 300 ms, most of it the
  editor's own 200 ms lint delay.
- A run, including spawning a fresh sandbox worker: p95 19.7 ms against 150 ms.

The precache does not fit. The budget is 15 MB; the pre-bundled Zod and React
types pushed it past that before Tier 4's lessons were written, and the
finished course precaches 17,439,897 bytes. That is recorded as a miss with
its reason, not hidden by moving the budget.

## 5. What it is not

It is a single-user app with no backend, no accounts and no sync, by design.
It has no phone layout either, because the lesson page needs two panes side by
side. Three of the Vim spike's items, browser-reserved keys in a tab and in an
installed window and the terminal clipboard round trip, are deferred rather
than claimed.
