---
name: add-feature
description: Turn a new idea or change request into roadmap features and a proposed spec change, without implementing anything.
argument-hint: "<the idea>"
disable-model-invocation: true
---

# Plan a new feature (no code)

Idea: $ARGUMENTS

1. **Read** `docs/ROADMAP.md`, `docs/DECISIONS.md`, and the `docs/SPEC.md` sections the idea touches, including "Out of scope for v1".
2. **Classify** the idea and say which it is:
   - **new**: the spec doesn't cover it
   - **change**: it alters something the spec defines
   - **contradiction**: it conflicts with a **[decided]** item or an architecture invariant. Name the conflict.
3. **Clarify:** ask me up to 3 questions with AskUserQuestion, only where the answer changes the plan.
4. **Propose spec wording:** add it under `## Proposed spec changes` in `docs/DECISIONS.md`. Give the date, the target section, and the exact text to add or replace. Tell me to apply it to `docs/SPEC.md` myself. Never edit SPEC.md.
5. **Schedule:** insert new feature entries into `docs/ROADMAP.md` in the right milestone and order. Use the exact line format, `Spec:`, `Depends:`, concrete `Done when:` bullets and `Tests:`. Use the next free ID, or a letter suffix (`F21a`) to slot between existing features. Each must fit one session (≤ ~10 files, ~600 lines).
6. **Commit** only `buzzer/docs/`: `docs(buzzer): plan <idea>`. Do not push.
7. Report the new IDs and where they sit, then stop.

Never write app code, tests, or config in this skill.
