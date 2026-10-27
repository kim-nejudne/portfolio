---
name: verify
description: Run the full check suite (format check, lint, typecheck, unit tests, build) and report results. Use before every commit and whenever asked to check the project.
allowed-tools: Bash(npm run *) Bash(npm test *) Bash(npm test)
---

# Verify

Run from `buzzer/`. First check that `package.json` exists and defines `format:check`, `lint`, `typecheck`, `test` and `build`. If it doesn't (before F01 lands), say "verify: scripts not set up yet (F01 creates them)" and stop.

Run these stages in order:

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

If a stage fails, report the shortest decisive error lines, fix the cause, and re-run from that stage. Fix the code, never the check: do not skip, disable or loosen a test or a lint rule to get green. For a format failure, run `npm run format`, then re-check.

End with this table:

| Stage | Result |
| --- | --- |
| format:check | pass / fail |
| lint | pass / fail |
| typecheck | pass / fail |
| test | pass / fail (N passed) |
| build | pass / fail |
