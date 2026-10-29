# Roadmap

Status: [ ] todo · [~] in progress · [x] done · [!] blocked (see note)

Change markers with `node .claude/scripts/roadmap.mjs mark`. A done item collapses to one line; its details are in PROGRESS.md and git history.

## M1 — Skeleton

- [x] F01 Project skeleton and tooling

- [x] F02 Shared types, schemas and constants

- [x] F03 Landing page and route shell

## M2 — Rooms and joining

- [x] F04 Room codes and RoomStore

- [x] F05 Reducer foundation: lobby, players, toView

- [x] F06 Room creation over HTTP

- [x] F07 Socket gateway: joins and state broadcast

- [x] F08 Host a game and the Screen lobby

- [x] F09 Player join flow

- [x] F10 Host pairing and host remote shell

- [x] F11 Dev tool: fake players

## M3 — Buzzer core

- [x] F12 Fairness: latency and ranking

- [x] F13 Reducer: question flow

- [x] F14 Reducer: buzz collection and window close

- [x] F15 Gateway: effects runner, ping and buzz

- [x] F16 Host remote primary action

- [x] F17 Player buzzer screen

- [x] F18 Screen question and buzz views

## M4 — Host controls and scoring

- [x] F19 Reducer: judging, lockout and reopen

- [x] F20 Reducer: undo, score adjust, kick, settings, final ranking

- [x] F21 Gateway: remaining host events

- [x] F22 Host remote: judging, secondary actions, tabs

- [x] F23 Screen host controls and shortcuts

- [x] F24 Screen and player result states

## M5 — Question editor and images

- [x] F25 Saved sets and the set list

- [x] F26 Set editor

- [x] F27 Reorder, preview and print sheet

- [x] F28 Import and export JSON

- [x] F29 Image pipeline in the editor

- [x] F30 Image upload, serving and preload

## M6 — Polish

- [x] F31 Sounds and animations

- [x] F32 Reconnects and room lifecycle

- [x] F33 Device polish and feedback

## M7 — Deploy

- [x] F34 Dockerfile and deploy guide

## M8 — Host options

Kim's request of 2026-10-28: the host can let players buzz as soon as a question appears, and can give the buzz winner a fixed time to answer. Proposed spec wording is in DECISIONS, Proposed spec changes (answer timer, lobby settings). Auto-open buzzers already exists (F13); F37 makes it reachable without a paired phone.

- [x] F35 Answer timer: server and phone setting

- [x] F36 Answer countdown and time's-up on the devices

- [x] F37 Settings in the Screen lobby

## M9 — Backlog

Kim's review of 2026-10-28: every Backlog item is scheduled here, grouped by area. The choices are in DECISIONS rows dated 2026-10-28 marked "backlog plan". Proposed spec wording is in DECISIONS, Proposed spec changes (backlog). The old "deploy workflow" item was already done (`deploy-buzzer.yml`) and became the CI job in F46.

- [x] F38 Screen lobby fit

- [x] F39 Buzz eligibility and monotonic window

- [x] F40 Host remote: game over, stable order, tab keys

- [x] F41 Connection awareness

- [x] F42 Join address and room-check limit

- [x] F43 Preview: show answer

- [x] F44 Favicon and hover states

- [x] F45 Socket test harness and typed host emit

- [x] F46 Slim runtime image and CI job

## M10 — Starter sets

Kim's request of 2026-10-29: 60 built-in sets (20 categories × Easy, Medium, Hard, 15 questions each) for Filipino game nights, written in Claude Desktop and reviewed in Claude Code. The choices are in the DECISIONS row dated 2026-10-29 marked "starter plan". Proposed spec wording is in DECISIONS, Proposed spec changes (starter sets).

- [ ] F47 Starter set data
  - Spec: Question editor and images (Set list `/sets`); see DECISIONS, Proposed spec changes (starter sets)
  - Depends: F46
  - Done when:
    - The 20 files in `~/Downloads/buzzr-starter/` are copied to `shared/starterSets/<slug>.json` with the 39 entries of `~/Downloads/buzzr-starter-fixes.json` applied (listed fields replace the original; `hostNotes: null` removes the note). The one-off apply script stays in the scratchpad, not the repo. The JSON is generated data and does not count toward the session's line budget
    - Every question keeps the key order `id, text, answer, hostNotes?, points`; every set keeps `createdAt: 0`, `updatedAt: 0`, `schemaVersion: 1`
    - `shared/starterSets/index.ts` exports `STARTER_SETS: QuestionSet[]` (60 sets) in category order (`animals`, `movies`, `ph-history`, `world-history`, `science`, `religion`, `tech`, `comics`, `anime`, `video-games`, `food`, `ph-geography`, `world-geography`, `music`, `sports`, `ph-pop-culture`, `health`, `space`, `mythology`, `language`), Easy, Medium, Hard within each
    - JSON imports typecheck: `resolveJsonModule` in `tsconfig.json` if needed, justified in DECISIONS. No new dependency
    - Every applied fix is visible in the data (e.g. `space-easy-12` has no host note; `tech-medium-02` answers Xiaomi)
  - Tests: `shared/starterSets.test.ts`: 60 sets; each parses with `questionSetSchema` unchanged and has 15 questions; set ids are `starter-<slug>-<level>` and unique; question ids unique across all sets; points 100/200/300 by level; titles end "– Easy"/"– Medium"/"– Hard"; no `imageId`; each can create a room with `DEFAULT_SETTINGS` (`createRoomBodySchema`)

- [ ] F48 Seed starter sets into My sets
  - Spec: Question editor and images (Set list `/sets`); see DECISIONS, Proposed spec changes (starter sets)
  - Depends: F47
  - Done when:
    - `client/src/lib/db.ts` declares `version(2)` with the same stores. A fresh browser's `populate` adds the sample (stamped now, as today) and the 60 starters, stamped `now - 1 - i` in `STARTER_SETS` order, so `/sets` lists the sample, then Animals – Easy … Words & Language – Hard
    - The v1 → v2 `upgrade` adds every starter whose id is not already stored, stamped `oldest - 1 - i`, where `oldest` is the smallest stored `updatedAt` (or now when the list is empty). The host's own sets stay on top and **Host a game** still preselects the host's newest set
    - Seeding never re-runs: a deleted starter stays deleted after reload. Adds are chained on Dexie promises inside the transaction (no native `await`); the starter JSON is a static import into the lazy db chunk
    - `npm run build`: the player-facing main bundle does not grow (the data lands only in the chunk that holds `db.ts`); sizes recorded in DECISIONS
    - **Host this set** on a starter creates a room, and the Screen shows its questions with 100/200/300 points
  - Tests: `db.test.ts` (fake-indexeddb): a fresh database lists 61 sets in the stated order with the visit-time stamps; a v1 database holding two user sets upgrades to keep them first and unchanged, then the starters in order below the oldest; a v1 database with no sets gets the starters stamped from now; a deleted starter is not re-added on reopen. Update the existing "seeds the sample set" test. `/playtest`: `/sets` on a fresh profile, host a starter, play one question

## Bugs

## Backlog (not scheduled)

- Hover on the Screen lobby controls: Pair host phone, the side-panel Start game, the settings switches and steppers have no hover style (F44 covered the host bar only). Add `HOVER` from `client/src/lib/hover.ts`.
- Pairing QR uses `joinOrigin` too: a Screen on localhost hands a phone an unreachable `/host/:code` link (F42). Pass the join origin to `PairHostPhone`.
