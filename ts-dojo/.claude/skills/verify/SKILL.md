---
name: verify
description: Re-checks an already built ts-dojo feature (Prep, F1–F15) without changing code — runs typecheck, lint, format:check and the tests, has the acceptance-reviewer agent grade every §12 criterion, and reports criterion by criterion (met with evidence, not met, needs Kim) against the ticks in docs/progress.md. Use when Kim asks "is F3 really done?", after a refactor or a dependency bump, before a deploy, or via /verify <id>.
argument-hint: "[F3]"
---

# Verify a feature

Feature: `$0`. When empty, verify the most recently committed feature (`git log --oneline` shows `F<n>: ...`).

This skill changes nothing: no code, no docs, no ticks. It reports.

1. Read the feature's `###` block in docs/spec.md §12 and its section in docs/progress.md, noting which boxes are ticked and what the notes claim.
2. Run the checks and keep the output:

   ```
   pnpm typecheck && pnpm lint && pnpm format:check && pnpm test --run
   ```

   Add `pnpm test:e2e` when the feature has Playwright criteria and `pnpm content:lint` for F6 and F11–F14. A missing script is reported, not worked around.
3. Launch the `acceptance-reviewer` subagent (Agent tool, `subagent_type: "acceptance-reviewer"`) with the feature id. Ask it to run the checks itself as well.
4. Report, criterion by criterion, in the reviewer's order:
   - **Met**: the test name and `file:line` for the code and the test.
   - **Not met**: what is missing or wrong.
   - **Weak test**: the test exists but wouldn't fail if the behaviour broke; what it should assert.
   - **Needs Kim**: the exact manual or droplet check.
5. Compare with docs/progress.md: list every ticked box the reviewer did not grade MET, and every MET criterion left unticked. Propose the edits; don't make them.
6. End with one line: `F<n>: VERIFIED` when every criterion is met or needs Kim and all checks passed, else `F<n>: NOT VERIFIED — <first thing to fix>`. If Kim wants the fixes, that is `/feature F<n>` or a normal session, not this skill.
