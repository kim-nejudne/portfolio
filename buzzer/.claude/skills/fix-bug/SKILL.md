---
name: fix-bug
description: Reproduce and fix a bug I describe, with a regression test, then log and commit it.
argument-hint: "<what went wrong, steps, which device>"
disable-model-invocation: true
---

# Fix a bug

Bug report: $ARGUMENTS

## 1. Orient
- Run `node .claude/scripts/roadmap.mjs next`. It prints roadmap status, open bugs and the newest 3 PROGRESS entries. Do not read `docs/ROADMAP.md` or `docs/PROGRESS.md` whole.
- Run `git status --short -- .` and `git log --oneline -5 -- .`.
- If there are uncommitted changes, STOP. List them and ask me whether to resume, commit, or discard. Never discard on your own.

## 2. Log
- Under `## Bugs` in `docs/ROADMAP.md`, add `- [~] B0N <short title>` with the next free number. Indent the report, the device, and `Spec:` with the sections it touches. Find the section with `grep -n '^## Bugs' docs/ROADMAP.md` and Read only from there.
- Read spec context with `node .claude/scripts/spec.mjs B0N` (or `spec.mjs "<Heading>"`), never SPEC.md whole.

## 3. Reproduce
- Logic bug: write a failing Vitest test that shows it. Run it and confirm it fails for the reported reason.
- UI-only bug: run the `playtest` skill with repro steps, and confirm the failure.
- If you can't reproduce it, ask me at most 2 questions (AskUserQuestion), then try again. Still no repro: run `node .claude/scripts/roadmap.mjs mark B0N '!' "<what you tried>"`, and stop.

## 4. Fix
- Fix the root cause with the smallest change that does it. Do not refactor around it.
- The regression test must now pass. Run the `verify` skill until it is green.
- If the change touches the reducer, views, gateway or more than a few lines, run the `review-feature` skill and fix its Must-fix items.

## 5. Close out
- Add a PROGRESS.md entry at the top (`## B0N — Title (YYYY-MM-DD)`, same template). Read only the top of the file to place it.
- Run `node .claude/scripts/roadmap.mjs mark B0N x` (collapses the entry).
- Commit only `buzzer/` files: `fix(buzzer): B0N <title>`. Do not push.
- Hand off as `next-feature` does: what was fixed, how to try it, decisions, then **Run `/clear`, then `/next-feature`.** Stop.
