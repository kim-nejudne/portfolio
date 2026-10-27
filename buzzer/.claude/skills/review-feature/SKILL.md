---
name: review-feature
description: Independent review of uncommitted changes for the in-progress roadmap feature against docs/SPEC.md. Use after a feature is implemented and verified, before committing.
context: fork
agent: spec-reviewer
background: false
---

# Review the in-progress feature

You cannot see the conversation that built this feature. Work only from the files. The project is `buzzer/`, a directory inside the `portfolio` git repository, so scope every git command with `-- .` from `buzzer/`.

## 1. Find the feature
- Find the line marked `[~]` in `docs/ROADMAP.md` (a feature `F..` or a bug `B..`). Read its whole entry: Spec, Depends, Done when, Tests.
- Read the `docs/SPEC.md` sections it cites under `Spec:`, and the related entries in `docs/DECISIONS.md`.
- If no item is `[~]`, say so and stop.

## 2. Read the changes
- `git diff HEAD -- .` for tracked changes.
- `git status --short -- .` and read every untracked file in full.
- Read surrounding code where you need context to judge a change.
- Run `npm test` to see the tests pass or fail yourself.

## 3. Check four areas
- **Done when:** every bullet is met. Name the evidence: a test name, a code path, or a command output.
- **Spec conformance:** event names, payload shapes, phases and transitions, limits, timings (150 ms window, 1.5 s reopen, 2 s ping, 3 h expiry).
- **Invariants:**
  - no answer or host-notes leak to Screen or Player views before reveal, including a Screen that holds the hostToken
  - reducer purity: no I/O, timers or clock reads inside `reduce`
  - server authority: no game logic on the client
  - zod validation on every inbound payload
  - rate and size limits
- **Tests and quality:** would each test actually fail if the code broke? Are the spec's edge cases covered? Is the code clear, and does it match the surrounding code?

## 4. Output, in this order
1. Verdict: `PASS`, `PASS WITH FIXES`, or `FAIL`
2. **Must-fix:** each with `file:line`, why it matters, and the fix
3. **Should-fix:** same format, lower stakes
4. A ✔/✘ checklist of the Done-when bullets, one line each, with the evidence

## 5. Never edit files
This review is read-only. Do not write, edit, stage or commit anything.
