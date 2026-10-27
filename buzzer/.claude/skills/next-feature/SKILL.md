---
name: next-feature
description: Build the next feature from docs/ROADMAP.md end to end — plan, implement, test, review, log, commit. Run in a fresh session after /clear.
argument-hint: "[feature id, e.g. F07 — optional]"
disable-model-invocation: true
---

# Build the next roadmap feature

Requested feature: $ARGUMENTS (if empty, pick the next eligible one).

## 1. Orient
- Read `docs/ROADMAP.md` and the newest 3 entries of `docs/PROGRESS.md`.
- Run `git status --short -- .` and `git log --oneline -5 -- .` (scoped to `buzzer/`; the git root is the portfolio monorepo).
- If there are uncommitted changes, STOP. List them and ask me whether to resume, commit, or discard. Never discard on your own.
- If a feature is marked `[~]`, it is unfinished from an earlier session. Resume it instead of starting another.

## 2. Pick
- Use the requested ID, or else the first `[ ]` feature whose `Depends` are all `[x]`.
- If nothing is eligible, tell me why (done, or what blocks it) and stop.
- Change its marker to `[~]` in ROADMAP.md.

## 3. Load context
- Read only the `docs/SPEC.md` sections the feature cites.
- Read the relevant entries in `docs/DECISIONS.md` and the existing code you will touch.
- For broad code searches, use the Explore subagent so file dumps stay out of this conversation.

## 4. Plan
Post a plan of 15 lines or fewer: files to touch, approach, tests to write, and how each "Done when" bullet will be proven.
- If a choice is genuinely mine (ambiguous spec, a UX trade-off, a significant new dependency), ask with AskUserQuestion, at most 3 questions. Otherwise pick the simplest option that meets the spec, log it in DECISIONS.md, and continue without waiting.
- If the feature is too big for one session, split it in ROADMAP.md (F07a/F07b), tell me, and build only the first part.

## 5. Implement
- For pure logic, write the tests first. Work in small steps and keep the app runnable.
- Follow `CLAUDE.md` and `.claude/rules/`. Use the `add-game-action` skill when adding or changing an event or action.
- Stay in scope. Put ideas and nice-to-haves under `## Backlog` in ROADMAP.md, not in the code.

## 6. Verify
- Run the `verify` skill and fix until every stage is green.
- If the feature has UI, run the `playtest` skill with the feature ID. If Playwright is unavailable, write exact manual test steps instead.
- Check every "Done when" bullet and note the evidence for each (test name, playtest step, command output).
- If the same failure survives 3 genuine fix attempts, stop. Mark the feature `[!]` with a note and report what you tried.

## 7. Review
- Run the `review-feature` skill.
- Fix every Must-fix, then re-run `verify`.
- Fix small Should-fix items now. Move larger ones to Backlog.

## 8. Record
- In ROADMAP.md, set the feature to `[x]`.
- Add a PROGRESS.md entry at the top, using the template.
- Add any new decisions to DECISIONS.md.
- Update CLAUDE.md only if commands or invariants changed.

## 9. Commit
One commit for the feature: `feat(buzzer): F07 <title>`. Stage with `git add -- .` from `buzzer/` only. Do not push.

## 10. Hand off, then stop
Reply with:
- What was built (2–4 bullets)
- How to try it: exact commands, URLs, and which devices to use
- Decisions you made, and anything you need from me
- The next feature's ID and title
- The line: **Run `/clear`, then `/next-feature`.**

Do not start the next feature.

## Never
- Edit `docs/SPEC.md`
- Disable, skip, or weaken tests or checks
- Commit with failing checks
- Build more than one feature
- Stage or commit files outside `buzzer/`
