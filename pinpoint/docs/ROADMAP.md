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

- [ ] F55 Screen polish
  - Spec: Screen view `/screen/:code`; Look and tokens
  - Depends: F54
  - Done when:
    - Every Screen size from the spec's table at 1920 × 1080, scaled by `min(100vw / 1920, 100vh / 1080)` and letterboxed; tiles pop in and wiggle on practice; LOCKED IN amber fill; Final call state; scoreboard rows slide 600 ms with movement arrows; keys `M`, `F`, `?`
  - Tests: client/src/pages/Screen.test.tsx — scale factor at 1280 × 720 and 1920 × 1080, keys; scripts/playtest scenario screenshots the Screen at both sizes with no horizontal scroll

- [ ] F56 Sounds
  - Spec: Sound and haptics; Screen view `/screen/:code`
  - Depends: F55
  - Done when:
    - `scripts/make-sounds.mjs` (adapted from Buzzr's) synthesises `flap.wav`, `chime.wav`, `tick.wav`, `thud.wav` and `fanfare.wav` (mono 16-bit, under 400 KB together) into `client/public/sounds/` with a README naming each as self-made
    - `client/src/lib/sounds.ts` (Howler) plays them on the Screen only: flap with each flap-in, chime at GUESSING, tick each of the last 5 s, thud per pin, fanfare with the 1st podium step; `M` cycles Sound (100%), Quiet (40%), Muted, stored on the device
  - Tests: client/src/lib/sounds.test.ts — triggers per phase with a mocked Howler, mute cycle persisted
  - Kim check: listen to every sound on the TV; nothing is harsh or too loud at Sound

- [ ] F57 Phone polish and accessibility
  - Spec: Player view `/play/:code`; Sound and haptics; Look and tokens
  - Depends: F54
  - Done when:
    - Vibration on Lock in (30 ms) and at the 5 s warning (`[60, 40, 60]`); Wake Lock while the room is open; no page zoom, selection or long-press on the map; connection dot states; toasts; every tap target ≥ 48 px; the prompt bar shrinks 20 → 14 px then wraps
    - A polite `aria-live` region announces phase changes, lock-in and the own result; the map has `role="application"` and its label; keyboard panning on and Enter locks in
  - Tests: client/src/pages/Play.test.tsx — vibration calls, aria-live text, Enter locks in; scripts/playtest scenario at 360 × 640 and 430 × 932 with no horizontal scroll
  - Kim check: play a round on an iPhone (Safari) and an Android phone (Chrome) on mobile data

## M8 — Ship

- [ ] F58 End-to-end smoke game
  - Spec: Tech stack and architecture (intro); Automated tests (Vitest); Manual acceptance checklist
  - Depends: F57, F51, F26
  - Done when:
    - `npm run e2e` (Playwright, Chromium) starts the built server with `GENERATE_FAKE=1` and the dev fixture, opens a Screen and two player contexts, plays a 5-round Name game to the finale, and asserts the reveal reached both phones and the network log of each page carries no target coordinates before REVEAL
  - Tests: e2e/game.spec.ts — as above

- [ ] F59 Docker image and smoke test
  - Spec: Milestones and acceptance criteria (Environment); Map tiles; Tech stack and architecture
  - Depends: F58
  - Done when:
    - `Dockerfile` (from `docs/deploy-kit/Dockerfile.node`): multi-stage, the build stage runs `npm run tiles:fallback` into the image, runs as a non-root user (uid 1000), `HEALTHCHECK` on `/healthz`, `DATA_DIR=/app/data`, stops on SIGTERM in under 5 s; `.dockerignore` keeps `.data/` and the gitignored tiles out of the context
    - `scripts/docker-smoke.sh` builds the image and runs it with the settings in `deploy/compose.deploy.yaml` (port `127.0.0.1:3009` → 3000, `mem_limit`, `TRUST_PROXY: '1'`, `--max-old-space-size=192`), checking `/healthz`, the main page, `/api/config`, `/api/categories`, room creation and a fallback tile; wired as `npm run smoke:docker`
    - `scripts/smoke.sh <base URL>` checks the paths listed in Milestones item 10 (with `SMOKE_EXPECT_TILES=1` requiring non-null tiles without printing the URL)
    - `mem_limit` in `deploy/compose.deploy.yaml` is set from a measured peak (a 12-bot game plus one photo swap) plus headroom and fits the droplet's free memory (DECISIONS row)
  - Tests: scripts/smoke.test.ts — the tiles check passes and fails as expected without printing the URL

- [ ] F60 Deploy workflow to pinpoint.kimnejudne.dev
  - Spec: Milestones and acceptance criteria (Environment); Manual acceptance checklist
  - Depends: F59
  - Done when:
    - `../.github/workflows/deploy-pinpoint.yml` from `docs/deploy-kit/deploy.yml`, keeping its job names (`checks`, `droplet`), step names and the `ABORT: N live connection(s) after 10 min` line, which `scripts/autopilot.sh` matches; path-filtered to `pinpoint/**`
    - The workflow runs the checks, builds and smoke-tests the image on the runner, ships it with `docker save | ssh docker load` as the `deploy` user, waits for live connections to drain, re-points `IMAGE_TAG`, waits for health, rolls back on failure, then runs `scripts/smoke.sh https://pinpoint.kimnejudne.dev`
    - `README.md` has the runbook: deploy, rollback (`workflow_dispatch` with a tag), port 3009, env vars (names only), data dir and backups, admin hash, break-glass manual steps; the root `../README.md` lists Pinpoint like its siblings
    - `docs/deploy-kit/` is deleted (its files now live in place)
    - Kim check: set `PINPOINT_CARTO_KEY` (restricted to the site) and `WIKIMEDIA_CONTACT` in `/opt/pinpoint/.env`, restart, and see CARTO tiles on a phone
    - Kim check: open https://pinpoint.kimnejudne.dev on a laptop on the TV and four phones; play a 10-round Mixed game; rounds 8–10 show ×1.5, ×1.5, ×2
    - Kim check: run a backup restore drill on the droplet
    - Kim check: generate, review and publish the launch categories (Milestones item 11)

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

- Idle-crosshair mitigation (spec review finding 1, kept as written by Kim on 2026-11-07): score an unlocked crosshair only if the map moved.
- State and province borders and lakes in the fallback tiles.
- Voluntary VIP hand-over and "Rejoin as" from another phone (Out of scope for v1).
- A Players list (Kick) in the VIP's lobby: the server already accepts `vip:kick` in LOBBY and lists `kick` in the lobby controls, but the spec draws the drawer only from INTRO (DECISIONS 30).
- Admin: share one `GET /api/admin/categories` read between the list pane and the overview from 1024 px (today each reads it, two requests per page move; F31 UI review).
- Phone photo viewer: a focus trap inside the dialog (Tab can reach the top bar behind it; focus already returns to the thumbnail on Close), and `zoomAnimation: false` under `prefers-reduced-motion` (F49 UI review).
- Screen Picture guessing: compact tile names truncate at 128 px, so two long names can look alike; two-line names need ~28 px the 1080 layout doesn't have (F49 UI review, DECISIONS 57).