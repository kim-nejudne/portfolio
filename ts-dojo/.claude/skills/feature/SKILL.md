---
name: feature
description: Builds one ts-dojo feature (Prep, F1–F15) end to end in this repo's workflow — reads the spec sections it depends on, enters plan mode with the §12 criteria first, implements test-first, runs typecheck, lint, format:check and the tests, has the acceptance-reviewer agent grade it, updates docs/progress.md, commits once, and ends with the "For Kim" checklist. Use when Kim says "build F3", "start the next feature", "do the scaffold", "implement the sandbox runner", or invokes /feature <id>.
argument-hint: "[F3]"
---

# Build a feature

Feature: `$0`. When empty, use the current feature: the first section in docs/progress.md with an unchecked item not tagged `(by hand)` or `(droplet)`.

Build order (§11): Prep → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F15 → F11 → F12 → F13 → F14. If `$0` is not the current feature, say which one is and ask before going on.

## 1. Orient

1. Read CLAUDE.md; the feature's section in docs/progress.md plus "Deviations", "Spec questions" and "For Kim"; the feature's `###` block in docs/spec.md §12; and every spec section in the table at the end of this file.
2. Verify that what the spec names for this feature exists as written: `pnpm view <pkg> versions` for a version, the package's `.d.ts` (in `node_modules` or on jsdelivr) for an API. A mismatch goes in the plan as a question, never patched around.
3. For worker or protocol work load the `ts-worker` skill; for editor, keys or vimrc work load `vim`; for content waves use `/module` and `/lesson`.

## 2. Plan (plan mode)

Call EnterPlanMode. The plan opens with the feature's §12 criteria copied verbatim, in order. Under each criterion: the files to create or change; the Vitest or Playwright test that proves it (test name and file), or `For Kim: <exact manual check>` when it can't be automated; and the steps. Then: the spec sections relied on, the version and API checks from step 1.2, dependencies to add (only what this feature needs), risks, and anything that can't be done as the spec says (what, why, proposed alternative). Call ExitPlanMode and wait. Don't start before approval.

## 3. Build, test-first

For each criterion: write the failing test, make it pass, tidy. Keep to the layout in CLAUDE.md. Never simplify, skip or substitute what the spec names; when blocked, stop and report (what, why, alternative) instead of improvising. A deviation Kim accepts goes under "Deviations" in docs/progress.md at once. Playwright flows go through the `e2e-writer` agent when they are more than a line or two.

## 4. Check

```
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test --run
```

Plus `pnpm test:e2e` when any criterion is proven by Playwright, and `pnpm content:lint` for F6 and F11–F14. `pnpm format` fixes formatting. Fix until everything is green.

## 5. Review

Launch the `acceptance-reviewer` subagent (Agent tool, `subagent_type: "acceptance-reviewer"`) with the feature id and ask it to run the checks itself. Fix every NOT MET and WEAK TEST, repeat step 4, and launch it again until it reports PASS. For F15 also run `spec-checker` over the diff.

## 6. Record

In docs/progress.md: tick exactly the criteria the reviewer graded MET; leave NEEDS KIM items unticked and add each, with the reviewer's exact check, under "For Kim" prefixed with the feature id; add notes under the feature (decisions, measured numbers, what is left for later features); update "Deviations" and "Spec questions". At F15, fill the "Measured budgets" table.

## 7. Commit

One commit, `F<n>: <title>` with the §12 title (`F3: Editor`; `Prep: Vim spike and lib files` for Prep). Body: the satisfied criteria one per line, then the reviewer's verdict line. The pre-commit hook runs the checks again. Never push; Kim pushes.

## 8. Hand over

End with the "For Kim" checklist for this feature: each manual or droplet check as numbered steps with the expected result, then the open spec questions.

## Spec sections per feature

| Feature | Read |
| ------- | ---- |
| Prep | §4 Browser-reserved keys, Vim checklist, Mappings and the vimrc; §2 Compiler assets and options; §11 Prep and its gate |
| F1 | §2 Stack, `tsconfig.json`, Repository layout, Build; §6 Pages, Theme and type |
| F2 | §2 Components, Workers and protocol, Compiler assets and options; §5 Type cases, Rules; §9 Budgets, Warm-up, Staleness and failure |
| F3 | §4 all; §6 Global keys, Command palette; §2 Editor |
| F4 | §4 Running and the output pane, Multi-file exercises; §2 sandbox worker; §5 Runtime tests; §9 Staleness and failure |
| F5 | §4 What "REPL" means here; §6 `/repl`; §7 `buffers` |
| F6 | §3 all; §1 Lesson anatomy; §2 Content registry, Build; §8 for the three fixture lessons |
| F7 | §5 all; §1 Exercise kinds, Hints, solutions, reset, attempts; §4 Running and the output pane (Tests tab) |
| F8 | §6 Lesson page, Global keys, Focus; §1 Completion, Hints; §4 Focus and panes, Ex commands; §7 Store |
| F9 | §6 Roadmap, Module page, `/progress`; §7 all; §3 `roadmap.yaml`, `renames.yaml` |
| F10 | §7 Settings; §4 Mappings and the vimrc; §6 Theme and type |
| F11–F14 | §8 the wave's modules; §1; §3 Content lint; the `lesson` and `module` skills |
| F15 | §9 all; §10 all; §12 F15 |
