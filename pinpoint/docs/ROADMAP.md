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

- [ ] F34 Level review: cards, edit, remove and reviewed
  - Spec: Level review `/admin/categories/:id/:level`; Realtime events and HTTP API (HTTP)
  - Depends: F33
  - Done when:
    - Cities and Landmarks tabs with a card per place: name, display name, country, Wikidata link, fact with a 90 counter, a 200 px mini map with the box and pin
    - Edit name, display name and fact; drag the pin (must stay inside the box; `coordsSource: 'admin'`); Remove (confirmed); the sticky footer with **Mark ‹level› reviewed**; keys J/K, E, Delete
    - Non-blocking warnings: within another place's bullseye radius, "Moved 23 km from Wikidata" after a pin drag, same display name as another place
  - Tests: client/src/pages/AdminLevel.test.tsx — edit, drag outside refused, remove, reviewed, keyboard moves, warnings; server/http.admin.test.ts — place PUT and DELETE validation

- [ ] F35 Wikimedia client and fake
  - Spec: Wikidata and Commons resolution; Generation pipeline
  - Depends: F29
  - Done when:
    - `server/generate/wikimedia.ts` behind an interface: `User-Agent: Pinpoint/1.0 (https://pinpoint.kimnejudne.dev; <WIKIMEDIA_CONTACT>)`, one request at a time at least 100 ms apart, `maxlag=5`, 429/503 retried 3 times honouring `Retry-After` else after 2, 5 and 10 s; refuses to run while `WIKIMEDIA_CONTACT` is unset
    - A fake client answers from `server/generate/fixtures/` (entities, search results, SPARQL answers, image info) in the shapes the APIs document, and serves generated placeholder images; `GENERATE_FAKE=1` selects it; no test opens a network connection
    - `scripts/record-wikimedia.ts <enwiki title>…` (Kim's tool) records real responses into the fixture folder
  - Tests: server/generate/wikimedia.test.ts — pacing and retries with a fake fetch and fake clock, User-Agent, contact required; the fake answers fixture queries

- [ ] F36 Resolver
  - Spec: Wikidata and Commons resolution; City display text
  - Depends: F35
  - Done when:
    - `server/generate/resolver.ts` resolves one item: enwiki lookup then `wbsearchentities` fallback (country and box filters, most sitelinks), P625 rank choice, the P17 country rule ("Disputed or unclear country"), the settlement type ASK and sovereign-state exclusion, box, landmark size (`(0.01 × S)²` km²), duplicates by Q-id, `displayName` by label style with the country short-name override table; each drop carries its reason
  - Tests: server/generate/resolver.test.ts — each step and drop reason against fixtures, antimeridian box, display names for both styles

- [ ] F37 Add by name
  - Spec: Level review `/admin/categories/:id/:level`; Realtime events and HTTP API (HTTP)
  - Depends: F36, F34
  - Done when:
    - `GET /api/admin/wikidata/search` (30 per minute) returns up to 7 candidates with description, country and coordinates; `add-by-id` runs Locate's checks (and Photos for landmarks once M6 lands), with the admin's typed fact; no LLM and no daily limit
    - **Add by name** at the bottom of each tab
  - Tests: server/http.admin.test.ts — search limit, add-by-id drop reasons; client/src/pages/AdminLevel.test.tsx — search, pick, fact, add
  - Kim check: on the live site, add one city by name to a test category and see it on the mini map at the right spot

## M5 — Generation

- [ ] F38 Anthropic client, pricing and history
  - Spec: Jobs and limits; Generation history `/admin/history`; Generation pipeline
  - Depends: F29
  - Done when:
    - `server/generate/anthropic.ts` passes `PINPOINT_ANTHROPIC_API_KEY` to the SDK explicitly (never `ANTHROPIC_API_KEY`), and never logs it; `pricing.ts` from Buzzr (web search $10 per 1,000; unknown model at the dearest price); `history.ts` appends one JSON line per ended job to `DATA_DIR/generation-history.jsonl` and sums today, 30 days and all time
    - A fake generator (`server/generate/fake.ts`) with writer, checker and sign-checker fakes; generation is off with its reason when the key is unset
  - Tests: server/generate/anthropic.test.ts — key passed explicitly, the default env var ignored, usage priced; server/generate/history.test.ts — append and totals

- [ ] F39 Writer
  - Spec: Generation pipeline; City display text
  - Depends: F38
  - Done when:
    - The Sonnet writer (structured output) takes name, guidance, level, box, count and the avoid list as data (Buzzr's `asData`), asks for `ceil(count × 1.25)` per mode, returns `name`, `country`, `enwiki`, `fact` (≤ 90), and on a new category's first level `box`, `emoji` and the proposed label style; level briefs and the compact-landmark and settlement rules are in the prompt
  - Tests: server/generate/generator.test.ts — prompt contains the data block, not instructions; schema rejects long facts; box and emoji only on the first level

- [ ] F40 Checker
  - Spec: Generation pipeline
  - Depends: F38
  - Done when:
    - The Haiku checker with web search (at most 10 searches per level) returns `ok`, `fix` (only `fact` and `displayName`) or `drop` with a reason per place, given its Wikidata id, description, country, coordinates and fact
  - Tests: server/generate/checker.test.ts — a fix cannot change coordinates or the item, drop reasons kept, search cap passed to the API

- [ ] F41 Generation pipeline per level
  - Spec: Generation pipeline; Wikidata and Commons resolution; City display text
  - Depends: F39, F40, F36
  - Done when:
    - One level runs Write → Locate → Check (→ Photos once M6 lands), then up to 2 top-up rounds for the shortfall; accepted places in the writer's order, trimmed to `count` per mode; saved short with "12 of 15 landmarks"; the label style set from Locate (one country → `city`); saved as an unreviewed draft
    - Wikidata failures end the level with "Wikidata isn't answering. Try again later."
  - Tests: server/generate/generator.test.ts — drops by reason, top-ups, trimming, saved short, label-style inference, Wikidata failure

- [ ] F42 Jobs, queue and limits
  - Spec: Jobs and limits; Realtime events and HTTP API (HTTP)
  - Depends: F41
  - Done when:
    - `server/generate/jobs.ts`: one generation at a time and only with no replacement queued or running; a FIFO queue for replacements and additions; cancel (queued at once, running before its next API call; counts toward the limit); `GENERATE_DAILY_LIMIT` (20 levels per UTC day) and `GENERATE_REPLACE_DAILY_LIMIT` (100) in memory; the `PHOTOS_MAX_MB` disk guard
    - Routes: generate, regenerate, jobs list, job progress, cancel
  - Tests: server/generate/jobs.test.ts — one at a time, queue order, cancel states, limits reset at UTC midnight with a fake clock, disk guard; server/http.admin.test.ts — routes and limits

- [ ] F43 Generate page
  - Spec: Generate page `/admin/generate`; Admin dashboard `/admin`
  - Depends: F42, F31
  - Done when:
    - The form (name 1–40, guidance ≤ 500, levels with places per mode 5–30, default 15); the progress view polling `GET /api/admin/jobs/:id` every second with steps Write, Locate, Check, Photos, Replace, stage text, checklist, places kept, cost and Cancel; leaving and returning resumes it
    - Done goes to the category page; failure or cancel names the level and why, with **Review what was saved** and **Try the rest again**; Regenerate and Generate on the category page; the "Generating ‹name›" banner
  - Tests: client/src/pages/AdminGenerate.test.tsx — validation, progress states, resume, failure actions
  - Kim check: with the real key on the live site, generate one small region's Easy level and review it

- [ ] F44 Replace and Add a place
  - Spec: Level review `/admin/categories/:id/:level`; Jobs and limits
  - Depends: F42, F34
  - Done when:
    - **Replace** with an optional note (≤ 200) and **Add a place** queue a one-place job through Write, Locate, Check (and Photos once M6 lands); a finished replacement swaps in with "Replaced · Undo" until the admin leaves the level; queue position ("Queued · 2nd") and Cancel per card; the footer shows replacements left today; key R
  - Tests: server/generate/jobs.test.ts — replace and add jobs; client/src/pages/AdminLevel.test.tsx — replace, undo, queued state

- [ ] F45 History page and dashboard spend
  - Spec: Generation history `/admin/history`; Admin dashboard `/admin`
  - Depends: F43
  - Done when:
    - `/admin/history` lists every ended job newest first (when, category, levels, saved per mode, drops by reason, cost, outcome) with spend today, 30 days and all time; the dashboard overview shows a running job, limits left today and spend
  - Tests: client/src/pages/AdminHistory.test.tsx — rows and totals; server/http.admin.test.ts — history route

## M6 — Picture mode

- [ ] F46 Commons photos and metadata stripping
  - Spec: Wikidata and Commons resolution; Generation pipeline; Stored categories
  - Depends: F41
  - Done when:
    - `server/photos.ts` and the resolver's photo step: up to 6 candidates (P18, `haswbstatement:P180` search, P373 category), the licence allow-list (CC0, PD mark, CC BY, CC BY-SA), longer side ≥ 800 px, author stripped of HTML (≤ 120); download the 1280 px thumbnail, re-encode with `sharp` to WebP q80 (≤ 1280) and a 480 px q75 thumb with all metadata stripped, as `DATA_DIR/photos/<nanoid>.webp` and `-thumb.webp`; other usable candidates' metadata kept for Swap photo; `sharp.concurrency(1)`
    - The dev fixture gains 15 landmarks per level with generated placeholder photos
  - Tests: server/photos.test.ts — a JPEG with GPS EXIF comes out with no EXIF, XMP or IPTC, sizes; server/generate/resolver.test.ts — candidate order, licence refusals, size floor

- [ ] F47 Sign check
  - Spec: Generation pipeline
  - Depends: F46
  - Done when:
    - The Haiku vision sign check runs on each candidate's 480 px thumbnail before it is accepted; flagged candidates are skipped; a landmark whose every candidate is flagged is dropped ("Every photo names the place"); its usage is priced; the fake sign checker flags fixture files whose name contains `sign`
  - Tests: server/generate/generator.test.ts — flagged candidate skipped, all flagged dropped, cost counted

- [ ] F48 Picture rounds: tokens and photo serving
  - Spec: Place selection; Role views; Security; Realtime events and HTTP API (HTTP); Photos and credits; Provider outages
  - Depends: F46, F17
  - Done when:
    - Picture mode in the reducer and views: a fresh 22-char `photoToken` per round, the prompt `{kind: 'picture', photoUrl, credit}` with the guessing-credit rule (author hidden when it contains a 4+ letter word from the name, display name or country, accent-insensitive); the gateway drops places whose photo file is missing at New game
    - `GET /api/photos/:token` and `/thumb` (120 per IP per minute): `image/webp`, `Cache-Control: private, max-age=600`, no `ETag`, `Last-Modified` or `Content-Disposition`; unknown or other-room tokens 404; `GET /api/admin/photos/:photoId` for admin pages
    - The leak test covers Picture mode (no name, photo id or Commons file before REVEAL)
  - Tests: server/http.test.ts — token routes, headers, 404 across rooms; server/views.test.ts — Picture-mode leak cases; shared/credits.test.ts — the credit rule with accents

- [ ] F49 Picture mode on the Screen and phones
  - Spec: Screen view `/screen/:code`; Player view `/play/:code`; Photos and credits; Provider outages
  - Depends: F48, F19, F18
  - Done when:
    - Screen: the photo contained in 1500 × 820 with a 2 px frame and the credit line; reveal top band with the 240 px thumbnail and full credit; phone: the 72 × 48 thumbnail in the prompt bar that opens full screen with pinch zoom and close
    - A failed image shows the "Photo unavailable" card, and the VIP drawer's Skip reads "Skip round (photo missing)"
    - The VIP lobby offers Picture mode with landmark counts
  - Tests: client/src/pages/Screen.test.tsx — picture prompt and credit; client/src/pages/Play.test.tsx — thumbnail viewer, photo-unavailable card

- [ ] F50 Credits page
  - Spec: Photos and credits; Realtime events and HTTP API (HTTP)
  - Depends: F48
  - Done when:
    - `GET /api/credits/:code` (in the shared 30-per-minute limit) and `/credits/:code` list the photos of revealed rounds in the room's current and previous games: thumbnail, place name, author, licence with link, Commons file page link; never an unrevealed round; "No photos revealed yet"; the finale shows "Photo credits: pinpoint.kimnejudne.dev/credits/ABCD" in Picture mode
  - Tests: server/http.test.ts — unrevealed rounds absent, previous games included; client/src/pages/Credits.test.tsx — list and empty state

- [ ] F51 Swap photo and landmark review
  - Spec: Level review `/admin/categories/:id/:level`; Wikidata and Commons resolution; Generation pipeline
  - Depends: F50, F47, F44
  - Done when:
    - Landmark cards show the 4:3 photo with its credit and **Swap photo** from the stored candidates (thumbnails from Commons in the admin's browser, "Couldn't load from Commons" per failed one); on pick the server downloads, strips and stores it and runs the sign check, showing a "Names the place" badge on a flagged candidate
    - Warnings "Photo under 1000 px", "Author credit will be hidden while guessing", "Check for signs naming the place"; **Preview** draws the place as the Screen's guessing prompt
    - Add by name, Replace and Add a place now run Photos for landmarks
  - Tests: client/src/pages/AdminLevel.test.tsx — swap flow, preview, warnings; server/http.admin.test.ts — swap route and disk guard
  - Kim check: on the live site, swap a landmark's photo and replace a place with a note, then publish

## M7 — Look and sound

- [ ] F52 Palette colour-blindness test
  - Spec: Look and tokens
  - Depends: F02
  - Done when:
    - `shared/palette.test.ts` simulates protanopia, deuteranopia and tritanopia (Machado 2009, severity 1.0) and asserts CIEDE2000 ΔE ≥ 8 between every pair under each, ≥ 15 with normal vision, ≥ 15 against `--amber`; if the spec's list fails, the palette is adjusted until it passes and the final list is recorded in DECISIONS
  - Tests: shared/palette.test.ts — as above, plus the colour maths against published reference values

- [ ] F53 Split-flap component
  - Spec: Look and tokens; Screen view `/screen/:code`; Landing page `/`
  - Depends: F18
  - Done when:
    - `SplitFlap` cycles 6–14 glyphs from `A–Z 0–9 ·-` at 70 ms per glyph, cells starting 25 ms apart, settling within 1.6 s; characters outside the set flip straight to themselves; seam and cell sizes per DESIGN.md; reduced motion is a 150 ms fade
    - Used for the wordmark, the lobby code (200 px), intro and gate labels, the Name-mode prompt (up to 22 cells × 2 rows), the reveal name, scoreboard names, award cards and every 3-2-1
  - Tests: client/src/components/SplitFlap.test.tsx — settles on the target with fake timers within 1.6 s, out-of-set characters, reduced motion

- [ ] F54 Boarding passes, markers and reveal motion
  - Spec: Look and tokens; Reveal timeline; Player view `/play/:code`; Finale
  - Depends: F53, F28
  - Done when:
    - `BoardingPass` per DESIGN.md (notches, tear line, colour stripe, stamps) for the phone result, locked-in, waiting and finale cards, with the 500 ms Y flip from the face-down card
    - `PinMarker` teardrops with emoji, the pulsing target marker, pin drop (450 ms, 4 px bounce, 60 ms stagger), line draw (400 ms along the geodesic), count-up (600 ms); all honour reduced motion
  - Tests: client/src/components/BoardingPass.test.tsx — variants and stamps; client/src/components/PinMarker.test.tsx — colour, emoji, tip anchor
  - Kim check: watch a reveal on the TV from across the room; pins, lines and rows are legible from 5 m

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
