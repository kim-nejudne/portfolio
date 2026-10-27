# Set up this repo for feature-by-feature building

You are preparing this repository so I can build the app described in the spec, **one feature per fresh session**. My loop will be:

```
/clear
/next-feature
(I test what you built)
/clear
/next-feature
...
```

Each feature must survive a `/clear`. So everything the next session needs has to live in files, not in conversation memory: the plan, progress, decisions, and conventions.

**In this session, only set up the workflow. Do not implement any app feature, and do not scaffold the app.** Feature F01 will do the scaffolding later.

Work through the steps below in order. Read each file you are told to read in full. When this prompt gives exact content (settings, frontmatter, formats), use it as written. Where it describes content, write it yourself, concise and specific to this project.

---

## Step 0: Read the spec and lock its location

1. The spec is a Markdown file in `docs/`. If it isn't already named `docs/SPEC.md`, rename it with `git mv` (run `git init` first if needed). Everything below refers to `docs/SPEC.md`.
2. Read `docs/SPEC.md` completely before writing anything else.
3. While reading, collect real problems: contradictions, gaps, and choices the spec leaves open that will matter during the build. You will log them in Step 3.

## Step 1: Git basics

- `git init` if this isn't a repo yet.
- Create `.gitignore` with: `node_modules/`, `dist/`, `coverage/`, `.env`, `.env.*`, `.DS_Store`, `.claude/settings.local.json`, `.claude/spec-unlocked`, `.playtest/`, `*.log`.

## Step 2: `docs/ROADMAP.md`, the feature queue

Break the spec's "Milestones and acceptance criteria" into **20–35 small features**, grouped under milestone headings. This file is the single source of truth for what to build next.

**How to slice features:**
- Each feature fits in one session: roughly 10 or fewer files changed and about 600 or fewer lines.
- Prefer vertical slices that produce something visible or testable end to end.
- Every feature is independently verifiable. Logic features name the unit tests that prove them. UI features name a playtest or manual check.
- Order the features so the app runs after every one.
- Put the server core early (reducer, state machine, fairness, role-filtered views) and test it heavily.
- F01 must set up the tooling the hooks depend on. It defines these npm scripts at the repo root:
  - `dev` (server + Vite with proxy)
  - `typecheck`
  - `lint`
  - `format` / `format:check` (Prettier)
  - `test` (`vitest run`)
  - `build`

  It also installs Prettier and ESLint.
- Include the dev "fake players" tool early, since it makes every later feature testable by one person.

**Exact format.** Hooks parse this file, so keep the checkbox lines exactly like this:

````markdown
# Roadmap

Status: [ ] todo · [~] in progress · [x] done · [!] blocked (see note)

## M1 — Skeleton

- [ ] F01 Monorepo skeleton and tooling
  - Spec: Tech stack and architecture; Milestones 1
  - Depends: none
  - Done when:
    - `npm run dev` serves the client and `/healthz` returns 200
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass
  - Tests: one smoke test per package

- [ ] F02 ...
````

Rules:
- Use IDs `F01`, `F02`, and so on. When a feature gets split mid-build, use `F07a`/`F07b`.
- `Spec:` names the spec section headings to read. Never paste spec text into the roadmap.
- `Done when:` contains concrete, checkable statements, not vague goals.
- End the file with two empty sections: `## Bugs` (IDs `B01`…, same line format) and `## Backlog (not scheduled)`.

## Step 3: `docs/PROGRESS.md` and `docs/DECISIONS.md`

**`docs/PROGRESS.md`** is the handoff log. Newest entry goes at the top, under a line `<!-- entries below, newest first -->`. Each entry uses this template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

Start the log with no entries.

**`docs/DECISIONS.md`** has three sections:
- `## Open spec questions`: log every problem you found in Step 0 here, each with your recommended answer.
- `## Decisions made`: date, feature ID, decision, reason.
- `## Proposed spec changes`: wording for the owner to apply. Only the owner edits SPEC.md.

## Step 4: `CLAUDE.md` and path-scoped rules

**Root `CLAUDE.md`**, under about 80 lines. Every line should be something you would get wrong without it. Include:
- **One paragraph on what the app is.** Then the read order: `docs/ROADMAP.md`, the latest `docs/PROGRESS.md` entry, only the cited sections of `docs/SPEC.md`, then `docs/DECISIONS.md`.
- **Commands**, with a note that F01 creates them: `npm run dev | test | typecheck | lint | format | build`.
- **Architecture invariants:**
  - The server is the only source of truth.
  - Game logic is a pure `reduce(room, action, now) → {room, effects}` in `server/`.
  - Clients render the latest role-filtered snapshot and contain no game logic.
  - Answers and host notes never reach Screen or Player sockets before reveal.
  - Every inbound payload is zod-validated.
  - Shared types live in `shared/`.
- **Working rules:**
  - One feature per session.
  - Never edit `docs/SPEC.md`.
  - Record spec gaps in DECISIONS.md and with `// SPEC-QUESTION:` comments.
  - Logic ships with tests.
  - Justify any new dependency in one line.
  - One commit per feature.
  - Never weaken or skip tests to get green.
- **Finishing:** when a feature is done, stop and tell me to `/clear`.

**`.claude/rules/`** holds conventions that load only when Claude works on matching files. Each file starts with `paths:` frontmatter:
- **`server.md`** (`paths: ["server/**", "shared/**"]`):
  - Reducer purity: no I/O, timers, or `Date.now()` inside; time is passed in as `now`.
  - Effects are returned, not performed.
  - Use monotonic server time for buzzes.
  - Views are built only through `toView()`.
  - Apply the rate limits and size limits from the spec.
  - Use the `add-game-action` skill whenever an event or action is added or changed.
- **`client.md`** (`paths: ["client/**"]`):
  - Render from the snapshot store only.
  - Buzzer fires on `pointerdown`.
  - Player colours come from `shared/constants`.
  - The Screen view uses viewport units and is legible from 5 m.
  - Layouts are mobile-first for Player and Host.
  - Never put answer text into any Screen component before reveal.
- **`tests.md`** (`paths: ["**/*.test.ts", "**/*.test.tsx"]`):
  - Use Vitest.
  - Keep tests deterministic: inject `now` and use fake timers, never sleep.
  - Each test proves one behaviour from a "Done when" bullet or spec rule.

## Step 5: Skills (`.claude/skills/<name>/SKILL.md`)

Create these skills. For `next-feature`, use the content exactly as given. For the others, use the given frontmatter and write the body from the description.

### 5a. `next-feature`: the main loop (exact content)

````markdown
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
- Run `git status --short` and `git log --oneline -5`.
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
One commit for the feature: `feat(F07): <title>`. Do not push.

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
````

### 5b. `verify`: full check suite

Frontmatter:

```yaml
---
name: verify
description: Run the full check suite (format check, lint, typecheck, unit tests, build) and report results. Use before every commit and whenever asked to check the project.
allowed-tools: Bash(npm run *) Bash(npm test *) Bash(npm test)
---
```

Body:
- Run these stages in order: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- If a stage fails, report it, fix it, and re-run from that stage.
- End with a five-row pass/fail table.
- If the scripts don't exist yet (before F01), say so and stop.

Because this is a project skill named `verify`, Claude Code will also run it automatically before commits.

### 5c. `review-feature`: independent review in a forked subagent

Frontmatter:

```yaml
---
name: review-feature
description: Independent review of uncommitted changes for the in-progress roadmap feature against docs/SPEC.md. Use after a feature is implemented and verified, before committing.
context: fork
agent: spec-reviewer
background: false
---
```

The body must stand alone, because the forked agent can't see the conversation. It should tell the agent to:
1. Find the `[~]` feature in `docs/ROADMAP.md` and read its entry and the spec sections it cites.
2. Read the changes: `git diff HEAD` plus untracked files from `git status --short`.
3. Check four areas:
   - **Done when:** every bullet is met, with evidence.
   - **Spec conformance:** event names, payload shapes, phases, limits, timings.
   - **Invariants:** no answer leaks, reducer purity, server authority, zod validation, rate limits.
   - **Tests and quality:** tests would actually fail if the code broke, spec edge cases are covered, and the code is clear.
4. Output, in this order:
   - Verdict: `PASS`, `PASS WITH FIXES`, or `FAIL`
   - **Must-fix** items, each with `file:line`, why, and the fix
   - **Should-fix** items
   - A ✔/✘ checklist of the Done-when bullets
5. Never edit files.

### 5d. `playtest`: drive the real app in a browser

Frontmatter:

```yaml
---
name: playtest
description: Drive the running app in real browser tabs (Screen, Host, Players) to check a feature end to end. Use after UI features pass unit tests.
argument-hint: "[feature id]"
context: fork
agent: playtester
background: false
---
```

The body should tell the agent to:
- Read the feature's entry in ROADMAP.md.
- Derive 3–8 concrete user steps from its "Done when" bullets.
- Run them as the `playtester` agent describes.
- Return pass/fail per step, any console errors, and screenshot paths.

### 5e. `fix-bug`: reproduce, fix, log

Frontmatter:

```yaml
---
name: fix-bug
description: Reproduce and fix a bug I describe, with a regression test, then log and commit it.
argument-hint: "<what went wrong, steps, which device>"
disable-model-invocation: true
---
```

The body should cover:
1. **Orient:** run the same uncommitted-changes check as next-feature.
2. **Log:** add `- [~] B0N <title>` under `## Bugs`.
3. **Reproduce:** write a failing test, or a playtest repro for UI-only bugs. If you can't reproduce it, ask me at most 2 questions.
4. **Fix:** fix the root cause minimally, then run `verify`. Run `review-feature` if the change is non-trivial.
5. **Close out:** mark `[x]`, add a PROGRESS entry, commit `fix(B0N): …`, hand off the same way as next-feature, and stop.

### 5f. `add-feature`: plan a new idea without building it

Frontmatter:

```yaml
---
name: add-feature
description: Turn a new idea or change request into roadmap features and a proposed spec change, without implementing anything.
argument-hint: "<the idea>"
disable-model-invocation: true
---
```

The body should:
- Classify the idea as new, a change to the spec, or a contradiction of it.
- Ask me up to 3 clarifying questions.
- Write proposed spec wording under `## Proposed spec changes` in DECISIONS.md, and tell me to apply it to SPEC.md myself.
- Insert new feature entries into ROADMAP.md, with deps and Done-when, in the right order.
- Commit with `docs: plan <idea>`.
- Never write app code.

### 5g. `add-game-action`: checklist Claude loads on its own

Frontmatter:

```yaml
---
name: add-game-action
description: Checklist for adding or changing a game action or socket event end to end. Use whenever work adds or changes a client→server event, a reducer action, or a server→client payload.
---
```

The body is a short ordered checklist:
1. Types in `shared/types.ts`
2. zod schema in `shared/schemas.ts`
3. Reducer case and its phase guard
4. Reducer tests, including invalid-phase rejection
5. Socket handler: auth check, rate limit, ack `{ok, error}`
6. `toView()` filtering and a leak test
7. Client store and UI wiring
8. Update the events table in CLAUDE.md, if it lists events

## Step 6: Subagents (`.claude/agents/`)

### `spec-reviewer.md`

```yaml
---
name: spec-reviewer
description: Strict reviewer that checks code changes against docs/SPEC.md and the roadmap feature's Done-when criteria. Read-only.
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
memory: project
---
```

The body describes a senior engineer persona. It should say:
- **Be strict:** the spec and the Done-when bullets are the contract.
- **Focus on what matters most for this app:**
  - Answer leakage to Screen/Player
  - Buzz fairness and ordering
  - Phase guards and stale timers
  - Reconnect correctness
  - Input validation
- **Use Bash only to read:** `git diff`, `git status`, and running tests. Never change files.
- **Keep project memory:** record recurring issues and check that memory at the start of each review.

### `playtester.md`

```yaml
---
name: playtester
description: Drives the running app in real browser tabs with Playwright to check a feature end to end (Screen, Host remote, several Players). Does not modify source code.
tools: Read, Grep, Glob, Bash, mcp__playwright__*
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
---
```

The body should tell the agent to:
1. **Start the app if needed:** check `http://localhost:<port>/healthz`. If the app isn't running, start `npm run dev` in the background and wait for health.
2. **Set up a game:**
   - Create a room via the UI using the built-in sample set.
   - Open the Screen in one tab, the Host remote in another, and 2–3 Players in more tabs at `/play/<code>`. Use the dev fake-players tool when more players are needed.
3. **Run the given steps.** Save screenshots to `.playtest/<feature-id>/`.
4. **Report:** pass/fail per step, console errors, and screenshot paths.
5. **Clean up:** stop the dev server if you started it.
6. **Never** edit source files.

## Step 7: Hooks (Node scripts, so no `jq` dependency and they work on Windows too)

Write these four scripts in `.claude/hooks/` as `.mjs` files.

**Requirements for every script:**
- Read the JSON input from stdin.
- Never crash: wrap everything in try/catch and exit 0 on unexpected errors.
- Finish in under a few seconds, except the Stop hook.
- Normalise paths: convert backslashes to `/`, and make absolute paths relative to `process.env.CLAUDE_PROJECT_DIR`.

1. **`session-context.mjs`** (SessionStart; fires on startup, resume, `/clear`, and after compaction). Print plain text of 30 lines or fewer to stdout, which becomes Claude's context:
   - Roadmap counts: done / total
   - Any `[~]` or `[!]` items
   - The first `[ ]` item
   - The newest PROGRESS.md entry, at most 15 lines
   - Git branch, uncommitted file count, and last commit
   - The line: `Workflow: /next-feature builds the next feature. Also: /fix-bug, /add-feature, /verify, /playtest.`

   Parse roadmap lines with `^\s*- \[( |~|x|!)\] ([FB]\d+[a-z]?)\s+(.*)$`. Handle missing files and a missing git repo gracefully.

2. **`protect-files.mjs`** (PreToolUse on `Edit|Write`). Read `tool_input.file_path`. Block, with exit code 2 and a reason on stderr:
   - `docs/SPEC.md`, unless the file `.claude/spec-unlocked` exists. Message: "SPEC.md is owner-controlled. Propose changes in docs/DECISIONS.md. Only the user may unlock it by creating .claude/spec-unlocked; never create that file yourself."
   - Any `.env` / `.env.*` file
   - `package-lock.json` (it should only change through npm)
   - Anything inside `.git/`

3. **`format-file.mjs`** (PostToolUse on `Edit|Write`). If the file ends in `.ts`, `.tsx`, `.js`, `.mjs`, `.json`, `.css`, or `.md`, and `node_modules/.bin/prettier` exists, run Prettier on that one file. Always exit 0.

4. **`stop-typecheck.mjs`** (Stop). Exit 0 immediately in any of these cases:
   - `stop_hook_active` is true
   - There is no `package.json`, or it has no `typecheck` script
   - `git status --porcelain` shows no changed `.ts`/`.tsx` files

   Otherwise run `npm run typecheck`. On failure, print the last 40 lines of output to stderr, plus "Fix these type errors before finishing.", and exit 2.

Then create **`.claude/settings.json`** with exactly this (merge if one exists):

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)", "Bash(npm test)", "Bash(npm test *)",
      "Bash(npx vitest *)", "Bash(npx tsc *)", "Bash(npx prettier *)", "Bash(npx eslint *)",
      "Bash(git status)", "Bash(git status *)", "Bash(git diff)", "Bash(git diff *)",
      "Bash(git log *)", "Bash(git add *)", "Bash(git commit *)", "Bash(git mv *)",
      "Bash(node .claude/hooks/*)"
    ],
    "ask": [
      "Bash(npm install *)", "Bash(git push *)", "Bash(git reset *)",
      "Bash(git checkout *)", "Bash(git clean *)"
    ],
    "deny": ["Read(./.env)", "Read(./.env.*)"]
  },
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-context.mjs\"" } ] }
    ],
    "PreToolUse": [
      { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/protect-files.mjs\"" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/format-file.mjs\"" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/stop-typecheck.mjs\"", "timeout": 120 } ] }
    ]
  }
}
```

## Step 8: `docs/WORKFLOW.md` (for me, the human)

A one-page cheat sheet in plain language:
- The `/clear` → `/next-feature` loop
- What each skill does, with an example of each: `/next-feature F07`, `/fix-bug "the buzzer stays red after reveal on iPhone"`, `/add-feature "teams mode"`
- How to unlock the spec: `touch .claude/spec-unlocked`, then delete it afterwards
- How to test on real phones: same Wi-Fi, use the laptop's LAN IP, and Vite must listen on `0.0.0.0`
- What to do when a feature is marked `[!]`

## Step 9: Test the setup

1. Pipe sample JSON into each hook and confirm its exit code and output. For example:
   - `echo '{"tool_input":{"file_path":"docs/SPEC.md"}}' | node .claude/hooks/protect-files.mjs` should exit 2.
   - The same with `client/src/App.tsx` should exit 0.
   - `session-context.mjs` should print the roadmap summary.
   - `stop-typecheck.mjs` should exit 0, since there's no package.json yet.
2. Check that every SKILL.md and agent file starts with `---` on line 1 and that its YAML parses.
3. Commit everything: `chore: set up Claude Code workflow (roadmap, skills, agents, hooks)`.

## Step 10: Report back, then stop

Tell me:
- **Files created:** a table of path and purpose
- **Roadmap:** the number of features per milestone, and the first 5 feature titles
- **Spec questions:** the top issues you logged, each with your recommended answer
- **What I should do next:**
  1. Review `docs/ROADMAP.md` and `docs/DECISIONS.md`.
  2. Restart Claude Code so the new settings, hooks, skills and agents load, and trust the folder when asked.
  3. Run `/hooks`, `/skills` and `/agents` to confirm everything loaded.
  4. Run `/clear`, then `/next-feature`.

Do not start F01.
