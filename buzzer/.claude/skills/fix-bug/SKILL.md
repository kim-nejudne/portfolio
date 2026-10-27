---
name: fix-bug
description: Reproduce and fix a bug I describe, with a regression test, then log and commit it.
argument-hint: "<what went wrong, steps, which device>"
disable-model-invocation: true
---

# Fix a bug

Bug report: $ARGUMENTS

## 1. Orient
- Read `docs/ROADMAP.md` and the newest 3 entries of `docs/PROGRESS.md`.
- Run `git status --short -- .` and `git log --oneline -5 -- .`.
- If there are uncommitted changes, STOP. List them and ask me whether to resume, commit, or discard. Never discard on your own.

## 2. Log
- Under `## Bugs` in `docs/ROADMAP.md`, add `- [~] B0N <short title>` with the next free number. Indent the report, the device, and `Spec:` with the sections it touches.

## 3. Reproduce
- Logic bug: write a failing Vitest test that shows it. Run it and confirm it fails for the reported reason.
- UI-only bug: run the `playtest` skill with repro steps, and confirm the failure.
- If you can't reproduce it, ask me at most 2 questions (AskUserQuestion), then try again. Still no repro: mark it `[!]` with what you tried, and stop.

## 4. Fix
- Fix the root cause with the smallest change that does it. Do not refactor around it.
- The regression test must now pass. Run the `verify` skill until it is green.
- If the change touches the reducer, views, gateway or more than a few lines, run the `review-feature` skill and fix its Must-fix items.

## 5. Close out
- Mark the bug `[x]` in ROADMAP.md.
- Add a PROGRESS.md entry at the top (`## B0N — Title (YYYY-MM-DD)`, same template).
- Commit only `buzzer/` files: `fix(buzzer): B0N <title>`. Do not push.
- Hand off as `next-feature` does: what was fixed, how to try it, decisions, then **Run `/clear`, then `/next-feature`.** Stop.
