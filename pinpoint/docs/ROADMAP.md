# Roadmap

Status: [ ] todo · [~] in progress · [x] done · [!] blocked (see note)

Change markers with `node .claude/scripts/roadmap.mjs mark`. A done item collapses to one line; its details are in PROGRESS.md and git history. Each `Spec:` line cites headings of `docs/spec.md` in `spec.mjs` form: `Heading (Subheading, Subheading)`. A `Gate:` line holds an item out of the queue until Kim approves and runs `roadmap.mjs ungate <ID>`; nothing else removes it.

M1 delivers the thinnest playable game: a Screen and phones in a room, the crosshair map, and a full Name-mode game from lobby to plain final standings on the dev fixture category, with the reducer, scoring and the leak test in place. M2 gives the VIP their controls and makes reconnects and drop-outs sturdy. M3 adds the finale. M4 is the category store and the admin's review tools, M5 Claude generation, M6 Picture mode with Commons photos. M7 is the departures-board look, motion and sound. M8 ships it: an end-to-end smoke, the Docker image, the deploy workflow, then the gated hub spoke. The app stays runnable after every feature.

## M1 — Playable core (Name mode)

- [x] F01 Project skeleton, tooling and CI

- [x] F02 Shared types, schemas and constants

- [x] F03 Geo module

- [x] F04 Scoring module

- [x] F05 HTTP server, rooms and codes

- [x] F06 Reducer: lobby, players and VIP

- [x] F07 Socket gateway and lobby views

- [x] F08 Category store (read) and dev fixture

- [x] F09 Landing page and Screen lobby

- [x] F10 Player join and lobby

- [x] F11 Map config and fallback tiles

- [x] F12 Crosshair map and practice

- [x] F13 VIP lobby settings and category picker

- [x] F14 Place picker

- [x] F15 Reducer: start, intro and guessing

- [x] F16 Reducer: scoring, reveal, scoreboard and final

- [x] F17 Game views and the leak test

- [x] F18 Screen game views (plain)

- [x] F19 Phone game views (plain)

## M2 — VIP controls and sturdiness

- [x] F20 Pause and resume

- [x] F21 VIP drawer: Next, Skip round and End game

- [x] F22 Kick, players list and VIP hand-off UI

- [x] F23 Between-round settings

- [x] F24 Rematch and back to lobby

- [x] F25 Reconnects and drop-outs end to end

- [x] F26 Dev tool: fake players

## M3 — Finale

- [x] F27 Travel awards

- [x] F28 Finale on the Screen and phones

## M4 — Category store and admin review

- [x] F29 Category store writes and publish rules

- [x] F30 Admin access

- [x] F31 Admin layout and dashboard

- [x] F32 Category page: box editor and label style

- [x] F33 Category page: levels, publish, hide and delete

- [x] F34 Level review: cards, edit, remove and reviewed

- [x] F35 Wikimedia client and fake

- [x] F36 Resolver

- [x] F37 Add by name

## M5 — Generation

- [x] F38 Anthropic client, pricing and history

- [x] F39 Writer

- [x] F40 Checker

- [x] F41 Generation pipeline per level

- [x] F42 Jobs, queue and limits

- [x] F43 Generate page

- [x] F44 Replace and Add a place

- [x] F45 History page and dashboard spend

## M6 — Picture mode

- [x] F46 Commons photos and metadata stripping

- [x] F47 Sign check

- [x] F48 Picture rounds: tokens and photo serving

- [x] F49 Picture mode on the Screen and phones

- [x] F50 Credits page

- [x] F51 Swap photo and landmark review

## M7 — Look and sound

- [x] F52 Palette colour-blindness test

- [x] F53 Split-flap component

- [x] F54 Boarding passes, markers and reveal motion

- [x] F55 Screen polish

- [x] F56 Sounds

- [x] F57 Phone polish and accessibility

## M8 — Ship

- [x] F58 End-to-end smoke game

- [x] F59 Docker image and smoke test

- [x] F60 Deploy workflow to pinpoint.kimnejudne.dev

- [ ] F61 Hub spoke
  - Spec: Overview
  - Depends: F60
  - Done when:
    - `CASE-STUDY.md` in `pinpoint/`, in the shape of the siblings' case studies, passing `../hub/scripts/case-study/policy.mjs`
    - Pinpoint's entry in `../hub/src/spokes.ts`, its crop in `../hub/public/crops/` (900 × 600, `.png` and `.avif`), the `../.github/workflows/deploy-hub.yml` paths line, and anything else `../hub/README.md` lists for a new spoke; the hub's own checks pass
    - Kim check: the crop and the case study read well on the live hub
  - Gate: Kim approves adding Pinpoint to the public hub

## Bugs

## Backlog

- Run `npm run e2e` in CI: a job in `../.github/workflows/ci.yml` (a root file F58 may not touch) with `npx playwright install --with-deps chromium` (F58 review).
- Sounds: in a full room, cap or thin the reveal's thuds (12 pins 60 ms apart overlap), and fade the flap clatter out over ~40 ms instead of a hard stop (F56 ui review; the F56 Kim check listens for both).
- Idle-crosshair mitigation (spec review finding 1, kept as written by Kim on 2026-11-07): score an unlocked crosshair only if the map moved.
- State and province borders and lakes in the fallback tiles.
- Voluntary VIP hand-over and "Rejoin as" from another phone (Out of scope for v1).
- A Players list (Kick) in the VIP's lobby: the server already accepts `vip:kick` in LOBBY and lists `kick` in the lobby controls, but the spec draws the drawer only from INTRO (DECISIONS 30).
- Admin: share one `GET /api/admin/categories` read between the list pane and the overview from 1024 px (today each reads it, two requests per page move; F31 UI review).
- Phone photo viewer: a focus trap inside the dialog (Tab can reach the top bar behind it; focus already returns to the thumbnail on Close), and `zoomAnimation: false` under `prefers-reduced-motion` (F49 UI review).
- Screen Picture guessing: compact tile names truncate at 128 px, so two long names can look alike; two-line names need ~28 px the 1080 layout doesn't have (F49 UI review, DECISIONS 57).