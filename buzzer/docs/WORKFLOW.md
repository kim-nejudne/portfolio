# Workflow cheat sheet

## The loop

```
/clear
/next-feature        ← Claude builds, tests, reviews, logs and commits one feature, then stops
(you try it)
/clear
/next-feature
…
```

Each session starts clean. Everything Claude needs lives in files:

- `docs/ROADMAP.md`: the feature queue
- `docs/PROGRESS.md`: what happened last
- `docs/DECISIONS.md`: open questions and choices made
- `CLAUDE.md`: the project rules

A hook prints a short status (done count, next feature, last entry, git state) at the start of every session.

Commits stay local. Push yourself when you're happy: `git push` from the portfolio root.

## Commands

| Command | What it does | Example |
| --- | --- | --- |
| `/next-feature [id]` | Builds the next eligible feature, or the one you name. It plans, implements, runs verify and playtest, gets a review, logs, makes one commit, and stops. | `/next-feature F07` |
| `/fix-bug "<report>"` | Logs a `B..` item, reproduces it with a failing test, fixes the root cause, verifies, commits and stops. | `/fix-bug "the buzzer stays red after reveal on iPhone"` |
| `/add-feature "<idea>"` | Plans an idea without building it. It writes proposed spec wording in DECISIONS.md and adds roadmap entries. | `/add-feature "teams mode"` |
| `/verify` | Runs format check, lint, typecheck, tests and build, then prints a pass/fail table. | `/verify` |
| `/playtest [id]` | Opens Screen, Host and Player tabs in a Playwright browser, runs the feature's checks, and saves screenshots to `.playtest/`. | `/playtest F09` |

Claude also uses `review-feature` (an independent read-only review) and `add-game-action` (the checklist for new events) on its own.

## Changing the spec

Only you edit `docs/SPEC.md`. A hook blocks Claude from touching it. To apply a proposed change from `docs/DECISIONS.md`:

```
touch .claude/spec-unlocked     # unlock
# edit docs/SPEC.md (yourself, or ask Claude to apply a specific proposal)
rm .claude/spec-unlocked        # lock again
```

Also answer the **Open spec questions** in DECISIONS.md. Claude follows the recommended answer until you say otherwise.

## Testing on real phones

1. Put the laptop and the phones on the same Wi-Fi.
2. Find the laptop's LAN IP: `ip -4 addr` on Linux, `ipconfig getifaddr en0` on macOS.
3. Run `npm run dev`. Vite listens on `0.0.0.0`, which F01 sets up.
4. On each phone, open `http://<LAN-IP>:5173`. Join with the room code, or scan the Screen's QR code. The QR code must use the LAN IP, not `localhost`, so open the Screen on the laptop via the LAN IP too.
5. Some browser features (Wake Lock, vibration on some phones) need HTTPS and won't work over plain LAN HTTP. Test those on the deployed URL.

Guest Wi-Fi networks often block device-to-device traffic. If a phone can't load the page, try a phone hotspot instead.

## When a feature is marked `[!]`

Claude stopped after 3 failed fix attempts on the same problem. Read the note under the item in ROADMAP.md and the newest PROGRESS entry. Then do one of these:

- **Give it what it needs:** a decision, a fixed environment, or a missing tool. Then run `/next-feature F12` to retry it.
- **Split or descope it:** run `/add-feature "split F12: …"`, or edit its Done-when bullets yourself.
- **Leave it for later:** change `[!]` back to `[ ]` and move it lower in the list. Note that features depending on it won't start.
