---
name: lesson
description: Everything needed to write one ts-dojo lesson to spec — the §1 theory order and frontmatter, the §3 file layout and exercise.yaml fields, the fence meta strings, the MDX components, the four exercise kinds with their §5 pass rules, the forbid rule ids, the §3 lint conditions, the §2 default compiler options and the §8 curriculum entry — plus a complete worked example lesson with one exercise of each kind under reference/. Use when writing, fixing or reviewing any lesson or exercise under content/, when pnpm content:lint fails, or via /lesson <lesson-id>.
argument-hint: "[m03-unions/03-narrowing]"
---

# Write a lesson

Lesson: `$0`, a lesson id `<module-id>/<NN-slug>` such as `m03-unions/03-narrowing`. The reference under [reference/content/modules/m03-unions/](reference/content/modules/m03-unions/) is a complete lesson (3.5, *Discriminated unions and exhaustiveness with `never`*) with one exercise of each kind. Copy its shape.

## 1. The §8 entry

docs/spec.md §8 is the curriculum. Find the lesson's row: the module (`M03 Unions and narrowing (M02)` gives the title and the prerequisite modules), the lesson number and title (`3.3 Narrowing: typeof, truthiness, equality, in, instanceof`), the minutes, and `(opt)` for optional lessons, which set `optional: true` in the frontmatter. The folder is `NN-<slug>` with `NN` the lesson number, two digits; the slug is short and stable. Ids already fixed by the spec: modules `m01-types`, `m02-functions`, `m03-unions`, `m04-objects`; lessons `m03-unions/01-union-and-literal-types`, `02-null-undefined-strict`, `03-narrowing`. Everything else is chosen the first time a module is written and never renamed afterwards (§7: a rename goes through `content/renames.yaml`). Lessons that teach TypeScript 7 behaviour (16.4, parts of 16.1–16.3) say so with a `ts7` callout; the compiler in the app is 6.0.3.

## 2. Files (spec §3)

```
content/modules/m03-unions/
  module.yaml                                   see the module skill
  05-discriminated-unions/
    lesson.mdx
    exercises/
      01-handle-the-new-shape/                  kind: fix
        exercise.yaml
        starter/index.ts
        solution/index.ts                       same file names as starter/
        tests.ts
      02-describe-the-events/                   kind: type-challenge
        exercise.yaml  starter/  solution/  tests.ts
      03-what-is-left/                          kind: predict
        exercise.yaml                           no starter, solution or tests
      04-largest-shape/                         kind: implement
        exercise.yaml  starter/  solution/  tests.ts
        types/*.d.ts                            optional, read-only in the project
```

Exercise folders are `NN-<slug>` in order of difficulty. The exercise id is `<lesson id>/<folder>`.

## 3. lesson.mdx

Frontmatter (§1), then the body in this order (§1): **Concept**, **Examples**, **Pitfalls**, **Check yourself**, **Further reading**. Practice is the `exercises/` folder, not part of the file.

| Field | Meaning |
| --- | --- |
| `id` | `m03-unions/05-discriminated-unions`; equals the folder path; never renamed once progress exists |
| `title`, `minutes` | shown on the roadmap and module pages; `minutes` covers theory plus the non-challenge exercises |
| `objectives` | 2–5 lines, each starting with a verb |
| `prerequisites` | lesson ids; "recommended first", never a lock |
| `tags` | free text for the command palette |
| `ts7` | optional note when behaviour differs in TypeScript 7 |
| `optional` | `true` for a lesson §8 marks `(opt)`: tagged "optional" on the module page and `/progress`, counted on the roadmap card as "1 optional lesson", and left out of module completion and of the lesson counts (the lesson itself still completes as usual). Default `false`. A pre-F13 field, under Deviations in docs/progress.md |

- **Concept**: what it is and why it exists, in plain words, with the smallest example.
- **Examples**: runnable snippets (`ts run`, or `ts twoslash` when the point is an inferred type). Each gets Run and Open in REPL from the renderer.
- **Pitfalls**: the two or three mistakes people make, each with a failing snippet in `ts run errors`.
- **Check yourself**: one to three `<Predict>` questions. They count toward completion (§1), so each must be answerable from the theory above it.
- **Further reading**: handbook links.

Code fences carry a meta string (§3):

| Fence | Rendering | Lint |
| --- | --- | --- |
| ```` ```ts ```` | static, highlighted | — |
| ```` ```ts run ```` | Run and Open in REPL; output under the block | zero diagnostics |
| ```` ```ts run errors ```` | same, diagnostics expected and rendered inline | — |
| ```` ```ts twoslash ```` | `^?` queries and error markers pre-rendered at build time by twoslash; never runs in the browser | must render |

A `^?` query is a comment line `//  ^?` whose `^` sits under the identifier on the line above (any column inside the identifier works). Indent the comment like the code and put the `^` on the identifier's last characters.

MDX components (§3):

- `<Callout kind="tip" | "warn" | "ts7">…</Callout>`
- `<Predict id="unique-in-lesson" question="…" options={['a', 'b', 'c']} answer={1} explanation="…" />`, optionally `code="…"`. 2–5 options, exactly one correct, `answer` is the index. The props mirror the `predict` exercise fields; the answer is stored per lesson (§7).
- `<Key>gd</Key>` renders a keystroke chip.
- `<Lesson id="m03-unions/03-narrowing" />` links to a lesson and shows its state.

## 4. exercise.yaml

Editor kinds (`fix`, `implement`, `type-challenge`):

```yaml
id: m03-unions/01-union-and-literal-types/01-first-union
kind: implement                 # fix | implement | type-challenge | predict
title: Your first union
minutes: 5
challenge: false                # true: optional, never blocks completion
prompt: |                       # Markdown, shown above the editor (§1)
  Write ...
entry: index.ts                 # the file :run executes; tests import it
tests: tests.ts                 # optional for fix
compilerOptions: {}             # merged over the §2 defaults (below)
libs: [es2025]                  # add dom when the exercise needs it
forbid: [explicit-any]          # rule ids from §5 (below)
timeoutMs: 5000                 # optional run deadline; omit it to follow Kim's Settings default (5 s unless changed)
hints:                          # 1–3 for every editor exercise (lint)
  - A union lists the alternatives with a vertical bar.
  - The parameter type is `"on" | "off"`.
```

`starter/` and `solution/` hold the same file names. `types/*.d.ts` files are added to the project read-only. `predict` replaces the file fields with `code`, `question`, `options` (2–5), `answer` (an index) and `explanation`; see `03-what-is-left/exercise.yaml`.

Default compiler options for every exercise and REPL buffer (§2), overridden only by `compilerOptions`:

```json
{ "strict": true, "target": "es2025", "module": "esnext", "moduleResolution": "bundler",
  "lib": ["es2025"], "types": [], "skipLibCheck": true, "isolatedModules": true, "useDefineForClassFields": true }
```

`lib` is always explicit because TypeScript's default for `es2025` pulls in DOM. A lesson that teaches a flag overrides it here (`strictNullChecks: false` in 3.2, `noUncheckedIndexedAccess: true` in 16.1). `console` and timers are not in the ES lib: the app provides their declarations to every project (an F2/F4 decision logged under "Spec questions"), so examples and exercises use `console.log` and `setTimeout` freely but nothing from DOM unless `libs: [dom]`.

## 5. The four kinds and how they pass (§1, §5)

| Kind | The task | Pass rule |
| --- | --- | --- |
| `fix` | the starter has type errors; make it compile without changing the tests | zero diagnostics in every file; runtime tests pass if present; no forbidden construct |
| `implement` | write a function, class or type from a prompt | zero diagnostics; runtime tests pass; type cases pass if present; no forbidden construct |
| `type-challenge` | implement a type | every type case passes and every `@ts-expect-error` line errors; no forbidden construct |
| `predict` | no editor: read a snippet and pick the type or the output | the chosen option is the right one; the explanation shows either way |

Verification runs four groups (§5); a group the exercise doesn't define counts as passed, and **Compiles** runs first and stops everything if it fails.

- **Compiles.** Every user file has zero diagnostics except inside type-case ranges. `@ts-ignore`, `@ts-nocheck` and `@ts-expect-error` in any user file other than `tests.ts` always fail the exercise (as built, the always-on `ts-directive` rule fails the Rules group; see Spec questions, F11).
- **Type cases.** `tests.ts` imports from the solution's files and from `@dojo/type-utils` (type-challenges' utils, MIT): `Expect`, `Equal`, `NotEqual`, `IsAny`, `IsTrue`, `IsFalse`, `Alike`, `ExpectExtends`, `ExpectValidArgs`. A case is each element of a tuple type alias whose name starts with `cases`, named by a trailing `// name` comment (else `case N`), and each statement whose leading comment is `@ts-expect-error`. Write that directive bare (`// @ts-expect-error` alone on its line) and name the case with a trailing `// name` comment on the statement below it, as the reference's `02-describe-the-events/tests.ts` does. A case fails when any diagnostic falls in its range; an unused `@ts-expect-error` produces TS2578 inside the range, so a line that should error and no longer does fails by itself. Diagnostics in `tests.ts` outside any case fail Compiles with "tests.ts does not compile against your code; see its first diagnostic" (a wrong export name, or an implement starter that isn't generic yet when the prompt names that diagnostic).
- **Runtime tests.** The sandbox prelude defines `test(name, fn)`, `test.skip`, and `expect(value)` with `toBe`, `toEqual` (structural: arrays, plain objects, Map, Set, Date), `toBeCloseTo`, `toThrow(message?)`, `toBeInstanceOf`, `toContain`, `toHaveLength`, `toBeUndefined`, `toBeNull`, `resolves`, `rejects` and `.not`. They are globals in `tests.ts`, no import. Tests run one at a time, each with a 1 s timeout; the solution module's top-level code runs once when the test file imports it.
- **Rules** (`forbid`), checked by an AST walk of every user file:

| Rule id | Detects | Default |
| --- | --- | --- |
| `ts-directive` | `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` outside `tests.ts` | always on, can't be turned off |
| `explicit-any` | `any` anywhere | on for `type-challenge`, off otherwise |
| `implicit-any` | diagnostics 7006 and 7031 (only when a lesson turns `noImplicitAny` off) | off |
| `as-unknown-as` | any double assertion: `x as unknown as T`, `x as object as T`, `x as {} as T`, `<T><unknown>x` (an inner `as const` is fine) | off |
| `non-null-assertion` | `x!` | off |
| `angle-cast` | `<T>x` | off |
| `eval` | `eval` or `new Function` | always on |
| `no-skipped-tests` | `test.skip` in `tests.ts` | always on |
| `type-assertion` | a plain `x as T` or `<T>x` outside `tests.ts`; `as const` and `<const>x` are fine | off |
| `any-expression` | outside `tests.ts`, a used expression of type `any` where the `any` first appears: `JSON.parse(text)` used directly, `Object(x)`, `Reflect.get`, a `.catch((err) => err.message)` reason, an `Array.isArray(u)` element, a read of a variable holding an `any`. Fine when it flows straight into `unknown` (`const data: unknown = JSON.parse(text)`, `console.log(...)`, `JSON.parse(text) as unknown`) | off |

`type-assertion` and `any-expression` are the pre-F13 rules (under Deviations in docs/progress.md). Forbid them where the lesson is narrowing an `unknown` honestly or checking a shape with `satisfies`, so a cast or a library `any` can't skip it; `type-assertion` alone is forbidden in 3.1/03, 3.3/03, 3.4/04, 4.2/01, 7.3/02, 7.4/02 and 7.4/04; both rules in 1.4/01, 1.4/04, 5.5/01, 5.5/04, 7.1/02, 7.1/04, 7.2/01, 7.2/02, 7.2/04, 9.4/01, 9.4/03 and 9.4/04. Every shipped solution passes them.

Choose `forbid` so the exercise can't be passed by a trick the lesson doesn't teach, and write tests that fail on the shortcut too: a `never` check defeated with `as never` still fails the runtime test for the case it skipped. A rule id not in this table doesn't exist; a new rule is a spec question.

## 6. Lint: what makes a lesson fail (§3)

`pnpm content:lint` runs the same ts-ls core and sandbox prelude as the app, so a lesson passes there exactly when it passes in the browser. It fails on:

1. A schema error, a duplicate id, a prerequisite that doesn't exist, or a cycle in prerequisites.
2. A solution that does not pass its own exercise: a diagnostic, a failing type case, a failing runtime test or a forbidden construct.
3. A starter that already passes. For `fix`, a starter with no diagnostics.
4. A lesson with fewer than two exercises (one in M00), a module with fewer than three lessons, a non-`predict` exercise without hints, or more than three hints.
5. A `predict` exercise or an inline `<Predict>` with zero or more than one correct option, fewer than two options, or a missing or duplicate id.
6. A `ts run` block with diagnostics, or a `ts twoslash` block that fails to render.
7. A lesson id that does not match its folder, or a `renames.yaml` target that does not exist.

Walk this list before running the lint.

## 7. Writing rules

- **Accuracy first.** Every claim about compiler behaviour is true for TypeScript 6.0.3: compile the snippet before stating it. Quote error messages as the compiler prints them. Where TypeScript 7 differs, keep the 6.0.3 behaviour in the code and add `<Callout kind="ts7">`; cite only differences traceable to the TypeScript 6.0 and 7.0 release notes in the spec's Sources.
- **The reader is fluent in modern JavaScript.** "Basic" means TypeScript basics. Explain what TypeScript adds; never explain closures, promises, destructuring, modules, classes or array methods.
- **Progression.** Two to five exercises, easy to hard. The first is a near-copy of a theory example; the last combines the lesson with earlier material (say which lessons in the prompt or a comment). `challenge: true` only for extras beyond the §8 minutes.
- **Hints nudge.** One to three per editor exercise, each pointing at the next idea, never at the code.
- **Starters fail for the right reason.** `fix`: a diagnostic the prompt names. `implement`: compiles but fails the tests (stubs that throw), unless the prompt says the starter has errors. `type-challenge`: the cases fail and the `@ts-expect-error` lines report TS2578.
- **Minutes** cover theory plus the non-challenge exercises; the §8 row gives the target.
- **Plain prose.** Short sentences, the smallest example that shows the point, no filler.

### Traps found while writing F11 and F12

- **MDX.** A `{` in prose outside a code span is parsed as an expression and fails the lint; put error messages that contain object types in backticks. A `\"` inside a double-quoted `<Predict>` attribute breaks the parse; use a `{'…'}` expression.
- **Links exist at lint time.** A `<Lesson>` link or a `prerequisites` entry must name a lesson that already exists. Name a lesson not yet written in plain text and link it once it lands.
- **`ts run` fences** are one file under the §2 defaults. To show a flag or several files, use a `ts twoslash` block with `// @filename:` and `// @<flag>: …`.
- **`@ts-expect-error` cases.** Prettier can split a long statement under a bare directive, which moves the error off the covered line, so keep those statements short and format before the final lint. A call statement under the directive still runs when `tests.ts` loads; declare it inside an arrow function that is never called.
- **Name the failure.** A call written outside any case fails Compiles with the tests.ts note ("tests.ts does not compile against your code"). When callers holding a union must still work, write it as an `ExpectValidArgs` case.
- **`.d.ts` files.** With `skipLibCheck: true`, an editable `.d.ts` gets no diagnostics. Keep declarations the learner edits in `.ts` files, and use `types/*.d.ts` only for read-only ones.
- **Async tests.** Since the pre-F13 fixes, `await expect(p).rejects.toThrow('timeout')` checks the rejection reason's message (a string must be in it, a RegExp must match it), as Jest does. 9.3 and 9.4 were written before that and use `rejects.toBeInstanceOf(Error)`, which still works.
- **Timers.** `setTimeout` and `setInterval` take DOM's handler, `Function`, so `new Promise<void>((resolve) => setTimeout(resolve, ms))` compiles. A callback that takes arguments needs its parameters annotated (TS7006 otherwise, as with DOM).
- **What no rule catches:** a type written out by hand where the prompt asks to derive it, and a construct the prompt asks for (a parameter property, a call signature). A plain cast and a library `any` are caught only where the exercise forbids `type-assertion` and `any-expression`. Make the tests stop whatever skips the lesson's point, and accept the rest.

## 8. Procedure

1. Read the §8 row and its neighbours (the lessons before and after), the module's `module.yaml` and any sibling lessons, so the lesson covers exactly its topic.
2. Pick the examples, then the exercises (first near-copy, last combination), then the hints, then write the prose around them.
3. Write the files in the layout above. Verify each snippet, starter, solution and test by compiling it with the project's TypeScript 6.0.3 under the §2 defaults; run the runtime tests.
4. Walk the lint list in §6.
5. Run the lint: `pnpm content:lint <lesson-id>` (ids narrow the run: a module, lesson or exercise id; no id lints the whole tree). It prints one line per exercise (`ok m03-unions/03-narrowing/01-first-union [implement] solution passes (compiles types runtime rules); starter fails runtime`) and every failure with its §3 condition number and path.
6. Report the files written, the lint line per exercise, and anything the spec leaves open, for "Spec questions" in docs/progress.md.

## Reference files

- [reference/content/modules/m03-unions/module.yaml](reference/content/modules/m03-unions/module.yaml)
- [reference/content/modules/m03-unions/05-discriminated-unions/lesson.mdx](reference/content/modules/m03-unions/05-discriminated-unions/lesson.mdx)
- `exercises/01-handle-the-new-shape/` (fix), `02-describe-the-events/` (type-challenge), `03-what-is-left/` (predict), `04-largest-shape/` (implement), each with `exercise.yaml`, and `starter/`, `solution/`, `tests.ts` where the kind has them.

The reference is a copy of the shipped `content/modules/m03-unions/05-discriminated-unions`, taken on 22 October 2026 after F11's reviews. It teaches the inline `never` check and leaves `assertNever` to 7.3, as §8 names it there; its exercise minutes leave time for the theory inside the §8 row. It passes `pnpm content:lint`: every solution has zero diagnostics and passes its tests, every starter fails as its kind requires, and every `ts run` block is clean while every `ts run errors` block errors.
