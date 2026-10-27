---
name: playtest
description: Drive the running app in real browser tabs (Screen, Host, Players) to check a feature end to end. Use after UI features pass unit tests.
argument-hint: "[feature id]"
context: fork
agent: playtester
background: false
---

# Playtest a feature

Feature: $ARGUMENTS. If empty, use the item marked `[~]` in `docs/ROADMAP.md`.

1. Run `node .claude/scripts/roadmap.mjs show <ID>` (or `roadmap.mjs next` to find the `[~]` item) and use its "Done when" and "Tests". Do not read ROADMAP.md whole.
2. Derive 3–8 concrete user steps from its "Done when" bullets. Each step needs an action and an observable expected result, for example "Player 2 taps the buzzer → Screen banner shows Player 2 in their colour".
3. Run the steps as your agent instructions describe: start the app if needed, set up a room, and open Screen, Host and Player tabs. Check with page text and accessibility snapshots. Take screenshots only for failed steps and for visual "Done when" bullets, saved into `.playtest/<feature-id>/`.
4. Return:
   - the step list, with pass or fail per step and a one-line reason for each failure
   - console errors per tab (verbatim, deduplicated)
   - the screenshot paths, if any

Do not edit source files. If a step cannot run because an earlier feature is missing, mark it "blocked" and say which feature it needs.
