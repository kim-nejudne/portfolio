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

- [ ] F09 Landing page and Screen lobby
  - Spec: Landing page `/`; Screen view `/screen/:code`; Creating and joining a room
  - Depends: F07, F08
  - Done when:
    - `/` shows the wordmark, the line, **Join a game** (code input, auto-uppercase, unknown code "No game with that code") and **Show a game on this screen** with its hint; side by side from 768 px, stacked below; no link to `/admin`
    - Show creates a room and opens `/screen/:code`; the **Click to start** overlay unlocks audio, requests fullscreen where supported and a Wake Lock
    - The Screen lobby shows the room code, the QR to `/play/:code` (`qrcode.react`, `PUBLIC_URL`), the join URL, player tiles (emoji, colour border, name, ★ on the VIP) and "Waiting for the first player: they'll be the VIP"; the 48 px join strip along the bottom; "This game has ended" when the room is gone
    - `client/src/lib/socket.ts` and a Zustand store hold the latest snapshot and the server clock offset
  - Tests: client/src/pages/Landing.test.tsx — both actions, uppercase, unknown code; client/src/pages/Screen.test.tsx — lobby with 0 and 3 players, VIP star, ended state
  - Kim check: open `/` on a laptop and a phone; the two choices read as equal weight

- [ ] F10 Player join and lobby
  - Spec: Player view `/play/:code`; Creating and joining a room; Reconnects
  - Depends: F09
  - Done when:
    - `/play/:code` shows the join form (name, 6 × 4 emoji grid with taken ones disabled, Join) with the errors "That name is taken" and "This game is full (12 players)"
    - Name, emoji and a device-made 21-character `playerKey` are stored per room code in `localStorage`; a refresh rejoins silently with the same id
    - The phone lobby shows the top bar (emoji, name, connection dot, ⋯ menu with Change name and Leave game), "Waiting for ★ Mika to start" and the read-only settings row; kicked and room-gone states
  - Tests: client/src/pages/Play.test.tsx — join, taken name, refresh rejoin with the stored key, rename, leave, kicked screen
  - Kim check: join from two real phones, one by QR and one by typed code, each in under 15 s

- [ ] F11 Map config and fallback tiles
  - Spec: Map tiles; Realtime events and HTTP API (HTTP); Provider outages
  - Depends: F05
  - Done when:
    - `GET /api/config` returns `{tiles, fallbackTiles}`; `tiles` is the CARTO `dark_nolabels` template with `PINPOINT_CARTO_KEY` filled in, or null when the key is unset; the key appears in no log line
    - `npm run tiles:fallback` renders zoom 0–6 from `world-atlas` 10m TopoJSON (land, coastlines, country borders in the spec's colours) with `topojson-client`, `d3-geo` and `@resvg/resvg-js` into `server/assets/fallback-tiles/` (gitignored), writing one shared all-water tile
    - `GET /tiles/fallback/:z/:x/:y.png` serves them with `Cache-Control: public, max-age=2592000, immutable`, falling back to the all-water tile, and 404 outside zoom 0–6
  - Tests: server/http.test.ts — config with and without the key (key never logged), tile route against a three-tile fixture directory, headers, out-of-range 404; scripts/render-fallback-tiles.test.ts — one tile renders as a 256 × 256 PNG

- [ ] F12 Crosshair map and practice
  - Spec: Map tiles; Player view `/play/:code`; Screen view `/screen/:code`; Transitions; Look and tokens
  - Depends: F10, F11
  - Done when:
    - `client/src/lib/tiles.ts` reads `/api/config`; 4 or more CARTO tile errors within 10 s with no CARTO tile loaded switch every map on the page to the fallback with a "Simplified map" badge; the attribution is always visible
    - `useLeafletMap` and `MapView` (no react-leaflet) with `keepBuffer: 1`, `updateWhenZooming: false`, max zoom 13, `maxNativeZoom` from config; `Crosshair` fixed at the centre; + and − 48 px buttons
    - The lobby practice map on the World box (unclamped) with Lock in: `player:practice` (1 per 2 s) gives the phone "1,240 km from 0°, 0°" for 3 s and **Try again**, and the Screen wiggles that player's tile; nothing is stored
  - Tests: client/src/lib/tiles.test.ts — the error-window switch rule; server/reducer.lobby.test.ts — practice effects and its rate limit; client/src/components/MapView.test.tsx — crosshair present, Lock in sends the map centre
  - Kim check: on a real phone, pinch and pan the practice map under the crosshair and lock in

- [ ] F13 VIP lobby settings and category picker
  - Spec: VIP controls; Place selection; Mixed difficulty; Transitions
  - Depends: F12
  - Done when:
    - The VIP's lobby shows the settings card above the practice map: category cards (emoji, name, per-level counts in the chosen mode, search box over 8), Mode (default Name), Difficulty (default Mixed), Rounds (5/10/15, default 10), Timer (20/30/45, default 30), Start ▶ disabled with "Open the Screen first", "Pick a category", or the place-count reason
    - Unavailable combinations are greyed with the reason (`MIN_PLACES_TO_OFFER` 5; Mixed per level share); with no live category: "No destinations yet. Check back soon." on the VIP card, non-VIP phones and the Screen's settings row
    - `vip:settings` validates against the live category list; the Screen shows the settings row ("WORLD · NAME · MIXED · 10 ROUNDS · 30 S"); the VIP's last settings are remembered in `localStorage` and applied to the next room they lead; World first when it exists
  - Tests: server/reducer.lobby.test.ts — settings validation and rejection of unknown categories; client/src/components/VipLobby.test.tsx — defaults, greyed reasons, empty state, remembered settings

- [ ] F14 Place picker
  - Spec: Place selection; Mixed difficulty
  - Depends: F04
  - Done when:
    - `server/placePicker.ts` is pure with a seeded `mulberry32` (state in `room.rngState`): snapshot pool per level, never a used place within a game, prefers places with no `placeUsage` entry then least recently used, ties by the PRNG; the enough-places check returns the exact refusal ("Japan · Hard has 8 landmarks; this game needs 10")
  - Tests: server/placePicker.test.ts — no repeat across skips, unused first, then LRU, determinism for a seed, refusal messages for single levels and Mixed

- [ ] F15 Reducer: start, intro and guessing
  - Spec: Transitions; Phases; Scheduled timers; Place selection; Escalation; Points formula
  - Depends: F07, F13, F14
  - Done when:
    - `vip:start` (≥ 1 connected player, ≥ 1 Screen, place check passes) runs **New game** and **Open round**; INTRO schedules `introDone`; GUESSING sets `startedAt`, `endsAt`, `participants`, `everConnected` and schedules `guessUp` at `endsAt + GRACE_MS`
    - `player:aim` stores the aim silently; `player:lockIn` stores a final lock (second rejected), emits `fx lockedIn {playerId}` to Screens only, and schedules `allLocked` when every connected participant has locked in
    - Timers carry round, game number and `timerEpoch`; stale ones are ignored; late joiners are `waiting` and join at the next **Open round**; joins in INTRO play that round
    - Socket limits: `player:aim` 8 per second (dropped silently), `player:lockIn` 2 per second
  - Tests: server/reducer.game.test.ts — start refusals (no Screen, no player, too few places), intro → guessing on the timer, lock-in once, allLocked scheduling (including after a disconnect or kick), stale timer ignored, waiting players

- [ ] F16 Reducer: scoring, reveal, scoreboard and final
  - Spec: Transitions; Reveal timeline; Points formula; Ranking and ties; Scheduled timers
  - Depends: F15
  - Done when:
    - `guessUp` or `allLocked` scores the round: locked players at their lock, unlocked participants at their last aim or the box's Mercator centre ("Not locked in"), missed participants 0 with null position; results in reveal order (distance descending, ties by `joinedAt`), **Closest** for every player tied at the smallest distance
    - REVEAL schedules `revealTarget` (1.5 s), `revealStep k` (3 s + k × STEP, `STEP = clamp(round(7500 / n), 600, 1800)`) and `revealDone`; `revealStage` and `revealedCount` advance
    - REVEAL → SCOREBOARD (6 s) → next INTRO; after the last round → FINAL; totals derive from `game.played`
  - Tests: server/reducer.game.test.ts — time-up scoring at the aim and at the centre, missed rounds, reveal order and Closest ties, STEP for n = 1, 8, 12 and 0, a full 5-round game to FINAL with totals and ranks

- [ ] F17 Game views and the leak test
  - Spec: Role views; Security; Reconnects
  - Depends: F16
  - Done when:
    - ScreenView and PlayerView cover INTRO, GUESSING, REVEAL, SCOREBOARD and FINAL as Role views lists, including `region: {box, scale}` from INTRO; the player's own result appears only once `revealedCount` reaches them; the VIP's view adds the allowed controls per phase
    - `views.test.ts` serialises every view (Screen, player, VIP) in LOBBY, INTRO and GUESSING for a fixture round and finds none of the target's latitude or longitude (1–4 decimals, as numbers, strings and `lat,lng`), Wikidata id, country or fact, nor another player's aim or lock; the fixture uses integer `now` values and coordinates with no coincidental matches
    - A socket integration test shows `player:aim` and `player:lockIn` produce no broadcast except `fx lockedIn {playerId}`
  - Tests: server/views.test.ts — the leak test and the own-result timing; server/sockets.test.ts — no position leaves the server before REVEAL

- [ ] F18 Screen game views (plain)
  - Spec: Screen view `/screen/:code`; Reveal timeline; Look and tokens
  - Depends: F17, F12
  - Done when:
    - Intro shows the gate label ("ROUND 3/10 · NOW BOARDING") and the multiplier row on boosted rounds; Guessing (Name) shows gate label, timer from `endsAt` with the clock offset (red and "Final call" in the last 5 s), the city name and tiles that turn "LOCKED IN"; no map
    - Reveal: top band with name and fact, a non-interactive map (fits target and pins with 80 px padding, max zoom 11) with pins, target marker and geodesic lines per step, and the rail rows (distance with one decimal under 10 km, points, multiplier, BULLSEYE / CLOSEST / NOT LOCKED IN tags, missed last with "—")
    - Scoreboard rows with rank, emoji, name, round points, total and movement (▲2 / ▼1); Final shows plain standings (the finale comes in M3)
    - Plain styling with the tokens is fine; flaps and motion come in M7
  - Tests: client/src/pages/Screen.test.tsx — each phase renders from a fixture view; the reveal rail fills in order as `revealedCount` grows; the timer counts from `endsAt`

- [ ] F19 Phone game views (plain)
  - Spec: Player view `/play/:code`; Reveal timeline; Look and tokens
  - Depends: F17, F12
  - Done when:
    - Intro: "Round 3 of 10" (and multiplier) over the map already fitted to the region box, not interactive; Guessing: prompt bar (name and timer), map clamped to the padded box (`maxBoundsViscosity: 1.0`, World unclamped horizontally with `worldCopyJump`), crosshair, Lock in; `player:aim` throttled to one per 250 ms on `move` plus `moveend`, from `getCenter().wrap()`
    - Locked in: "Boarding · Locked in" card with the timer, emoji still guessing and a frozen 180 px mini map; Reveal: face-down card, then the result card (distance, base points, multiplier, round points, total, rank, BULLSEYE / CLOSEST) when the Screen reaches this player; "Missed this round · 0"
    - Scoreboard: card stays with "Next: Round 4 of 10"; Waiting: "Next departure" card; Final: own standing
  - Tests: client/src/pages/Play.test.tsx — aim throttling (fake timers), lock-in once, the flip only when the view carries the result, waiting card, missed card
  - Kim check: play a 5-round Name game with a laptop and two phones; the result flips on each phone only when the TV reaches that player

## M2 — VIP controls and sturdiness

- [ ] F20 Pause and resume
  - Spec: Pausing; Scheduled timers; Screen view `/screen/:code`; Player view `/play/:code`
  - Depends: F19, F18
  - Done when:
    - `vip:pause` and the `screenAway` reason (no Screen for 3 s in a timed phase) store every pending timer's remaining time and bump `timerEpoch`; while paused, `player:aim`, `player:lockIn`, `vip:next` and `vip:roundSettings` are rejected
    - Clearing the last reason sets `resumeAt` (3 s countdown) and `resumeGo` restarts the timers with their remaining time, moving `endsAt` forward by the paused duration; a paused REVEAL holds its step, a paused SCOREBOARD holds the board
    - Screen: gate label "Delayed" in `--delayed`, stopped timer, banner "Delayed · the VIP paused the game", 3-2-1; phones: map covered by "Delayed · the VIP paused the round" or "Waiting for the Screen…", Lock in disabled
  - Tests: server/reducer.pause.test.ts — pause in each timed phase, both reasons, resume only when all clear, remaining time preserved, stale timers ignored, VIP disconnect while paused

- [ ] F21 VIP drawer: Next, Skip round and End game
  - Spec: VIP controls; Transitions; Provider outages
  - Depends: F20
  - Done when:
    - The ★ button opens a bottom drawer (never by itself) with the controls per phase from the VIP controls table; two-tap confirms reset after 3 s
    - `vip:next` jumps REVEAL to SCOREBOARD/FINAL (all revealed) and SCOREBOARD to the next round; `vip:skipRound` voids the round, keeps the round number, draws a fresh place at the same level, and is refused with "No spare places left at Hard"; `vip:end` voids an unrevealed round and goes to FINAL ("No rounds played" with 0 rounds)
  - Tests: server/reducer.vip.test.ts — next from REVEAL and SCOREBOARD, skip in INTRO/GUESSING/REVEAL (voided results, same number, fresh place, exhausted pool), end in each phase; client/src/components/VipDrawer.test.tsx — controls per phase, two-tap confirm

- [ ] F22 Kick, players list and VIP hand-off UI
  - Spec: VIP controls; VIP; Edge cases
  - Depends: F21
  - Done when:
    - The drawer's Players list kicks with two taps; a kicked player sees "You were removed from this game" and cannot rejoin; their rows leave the round and the board, and `allLocked` is re-checked
    - The new VIP's phone shows the toast "You're the VIP now ★"; the ★ badge moves on the Screen tile and board row
  - Tests: server/reducer.vip.test.ts — kick mid-round removes results and triggers allLocked; client/src/pages/Play.test.tsx — toast on `fx vipNow`, kicked screen

- [ ] F23 Between-round settings
  - Spec: VIP controls; Escalation; Mixed difficulty
  - Depends: F21
  - Done when:
    - On SCOREBOARD the drawer's Round settings change the timer (20/30/45) and total rounds (5/10/15; counts at or below rounds played disabled); multipliers and the Mixed plan are recomputed for unplayed rounds only; a change the pool cannot fill is refused naming the level
    - The gate label shows the recomputed multiplier from the next round
  - Tests: server/reducer.vip.test.ts — 5 → 10 keeps round 4's points and boosts 8–10, 10 → 5 refused at or below played, Mixed refusal with too few unused places

- [ ] F24 Rematch and back to lobby
  - Spec: Transitions; Place selection; VIP controls
  - Depends: F21
  - Done when:
    - `vip:rematch` (place check passes) sets `rematchAt` and schedules `rematchGo` (3 s); `vip:rematchCancel` clears it; `rematchGo` with a connected player starts a **New game** with the same players and settings, preferring places not yet used in the room; with nobody connected it just clears the countdown
    - `vip:backToLobby` clears the game, keeps players, settings and `placeUsage`, and cancels a countdown; `previousGames` keeps revealed photo ids for credits
    - The Screen and phones show the 3-2-1 over the final view; the drawer shows Cancel while counting
  - Tests: server/reducer.vip.test.ts — rematch, cancel, rematch with nobody connected, back to lobby keeps usage; placeUsage prefers unused places across games

- [ ] F25 Reconnects and drop-outs end to end
  - Spec: Reconnects; Edge cases
  - Depends: F22
  - Done when:
    - A participant who reconnects during GUESSING plays the rest of the round with their earlier aim kept; a locked-in one sees the Locked-in card; a disconnected player stays greyed on the board with their score; missed rounds show "—"
    - Refreshing the Screen, the VIP phone and a player phone mid-round returns each to the right view, score and VIP status (within `VIP_AWAY_MS`)
    - A server restart or expired room shows "This game has ended" with a link home on every role
  - Tests: server/sockets.test.ts — disconnect and reconnect mid-GUESSING keeps the aim, a Screen refresh during REVEAL, everyone disconnected in GUESSING still scores at time-up
  - Kim check: refresh the TV, the VIP phone and a player phone mid-round in a real game; background a phone for 20 s and return

- [ ] F26 Dev tool: fake players
  - Spec: Dev tools
  - Depends: F25
  - Done when:
    - `/dev/bots/:code` spawns N simulated players over Socket.IO who aim at random points within the game's region and lock in at random times, so one person can play a full game on one computer
    - `/dev/*` and the dev fixture are mounted only when `NODE_ENV !== 'production'`
  - Tests: server/http.test.ts — with `NODE_ENV=production`, `/dev/bots/ABCD` is 404 and the dev fixture is not loaded; server/devBots.test.ts — bots join and lock in within the timer

## M3 — Finale

- [ ] F27 Travel awards
  - Spec: Travel awards; Ranking and ties
  - Depends: F16
  - Done when:
    - `shared/scoring.ts` (or `shared/awards.ts`) computes the awards in order (Pinpoint Pilot, Lost Luggage, Frequent Flyer, Smooth Landing): eligibility at half the played rounds rounded up, the no-repeat winner rule, shared ties, at most 3, none with fewer than 3 players in the final standings; each with its stat text ("4,812 km from Lima")
    - Best round ("Round 7 · Osaka · 960") and average distance over played rounds per player
  - Tests: shared/awards.test.ts — each rule, no repeat winner, shared ties, eligibility, 2 players → none, a 3-eligible game always yields 3

- [ ] F28 Finale on the Screen and phones
  - Spec: Finale; Player view `/play/:code`; Role views
  - Depends: F27, F24
  - Done when:
    - The FINAL ScreenView carries podium, passes and awards; the Screen stages them (podium 3rd at 0.6 s, 2nd at 1.8 s, 1st at 3.0 s; passes from 5.0 s, 150 ms apart, in a grid up to 4 × 3; awards from 8.0 s, one per 2.5 s); shared ranks share a step; 1–2 players show only their steps; "No rounds played" with 0 rounds
    - Each phone shows its own pass (name, emoji, colour stripe, rank, total, best round, average distance) and its awards
  - Tests: client/src/pages/Screen.test.tsx — finale stages with fake timers, shared podium step, 2-player podium, no awards under 3 players; server/views.test.ts — finale data in the view

## M4 — Category store and admin review

- [ ] F29 Category store writes and publish rules
  - Spec: Stored categories; Category page `/admin/categories/:id`; City display text
  - Depends: F08
  - Done when:
    - `server/categoryStore.ts` writes `categories.json` atomically (temp file, then rename), keeps live and draft levels and `draftMeta`, and exposes create, update meta (box with `S ≥ 150` km, label style rewriting automatic display names), place edit/remove, mark reviewed, publish (all drafts at once; refused while a draft level is unreviewed, a place lies outside the box, lacks coordinates, or a landmark lacks a photo), hide/show, delete, emoji
    - At start, photo files that no live or draft place references are deleted, after logging the count, and never when the file failed to load or holds no categories
    - A running game keeps its snapshot; the next game sees the new live data
  - Tests: server/categoryStore.test.ts — atomic write, publish gates, label-style rewrite only for `autoDisplayName`, box below 150 km refused, photo clean-up guard, a game snapshot unchanged by an edit

- [ ] F30 Admin access
  - Spec: Admin access; Realtime events and HTTP API (HTTP); Security
  - Depends: F05
  - Done when:
    - `npm run admin:hash` writes `scrypt$N$r$p$salt$hash`; with `ADMIN_PASSWORD_HASH` unset or blank every `/api/admin` route is 404 and `/admin` says admin is not configured
    - Login (5 per IP per minute), logout and session as Buzzr's: 12 h in-memory sessions stored as SHA-256 hashes, cookie `pinpoint_admin` (HttpOnly, `SameSite=Strict`, path `/api/admin`, Secure over HTTPS); writes need a JSON body and a same-origin `Origin`
  - Tests: server/http.admin.test.ts — 404 without a hash, login, wrong password, rate limit, cookie flags, cross-origin write refused, session expiry with a fake clock

- [ ] F31 Admin layout and dashboard
  - Spec: Admin; Admin dashboard `/admin`; Look and tokens
  - Depends: F29, F30
  - Done when:
    - Lazy-loaded admin routes (nothing admin in the `/play` bundle) with the header (**Pinpoint Admin**, History, session end, Logout; ⋯ menu below 1024 px) and from 1024 px a list pane plus the open page, after Buzzr's admin redesign
    - The list: a row per category (emoji, name, level dots, counts "Cities 15/15/12 · Landmarks 15/14/15", badges), attention first, search and filter chips, **Add category**; the overview with counts and what needs review (limits and spend arrive with M5)
  - Tests: client/src/pages/Admin.test.tsx — list ordering, filters, empty state, sign-in flow; a bundle check that the play entry has no admin module

- [ ] F32 Category page: box editor and label style
  - Spec: Category page `/admin/categories/:id`; Distance and region scale; City display text
  - Depends: F31, F12
  - Done when:
    - A Leaflet box editor with a rectangle and draggable corner handles, numeric south/west/north/east fields (2 decimals), every place as a dot (cities round, landmarks square), the readout "Scale 1,605 km · Bullseye 16 km", places outside the box listed and flagged; **Save box** refuses `S < 150` km and on a live category saves into the draft meta
    - Label style City / City, Country via `PUT /api/admin/categories/:id/meta`
  - Tests: client/src/pages/AdminCategory.test.tsx — numeric edits update the readout, a small box refused, outside places flagged; server/http.admin.test.ts — meta route validation

- [ ] F33 Category page: levels, publish, hide and delete
  - Spec: Category page `/admin/categories/:id`; Realtime events and HTTP API (HTTP)
  - Depends: F32
  - Done when:
    - Levels show live and draft counts per mode, state and review mark, with Review (Regenerate and Generate appear in M5)
    - **Publish ‹name›** is enabled only under the store's gates and returns to `/admin` with "‹name› is live: 3 levels published."; **Hide from hosts** / **Show to hosts**; **Delete** confirmed by typing the name; the emoji picker (grid plus free field, Buzzr's `emojiSchema`)
    - A hidden category leaves the lobby list; a game already using it plays on
  - Tests: server/http.admin.test.ts — publish refusals, hide, delete, emoji validation; client/src/pages/AdminCategory.test.tsx — publish button states, typed-name delete

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
