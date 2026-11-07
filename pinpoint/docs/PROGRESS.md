# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**New dependencies:** each with a one-line reason, or none
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

## Kim checks

Things only Kim can do: real devices, real accounts and keys, live third-party services, and reviewing content. Unattended sessions add a line here instead of blocking. Format: `- [ ] Fnn: exact steps · what to look for`. Kim ticks them off.

<!-- entries below, newest first -->

## F08 — Category store (read) and dev fixture (2026-11-07)
**What changed:**
- `server/categoryStore.ts`: `loadCategoryStore({dataDir, production})` reads `DATA_DIR/categories.json` through `categoriesFileSchema` (missing file = no categories; a bad file throws `Invalid <path>: …`, and `index.ts` awaits it at top level, so the server stops). `CategoryStore.summaries()` → `CategorySummary[]` (id, name, emoji, box, labelStyle, `counts[level] = {city, landmark}` for published levels only), `get(id)` → the live, visible `Category` with places. Hidden and draft-only categories are invisible to both.
- `server/fixtures/dev-world.json`: "World (dev)" (`world-dev`, 🌍, `cityCountry`), 15 cities per level, two-decimal coordinates, placeholder Wikidata ids. Served in memory when the file holds no categories and `NODE_ENV !== 'production'`; read at runtime, so it is not in `dist/`.
- `GET /api/categories` in `server/http.ts` (`categories` option on `createApp`, empty by default).
**Decisions:** DECISIONS 16 (missing file, live-visible rule, counts, fixture details, landmarks deferred to M6).
**New dependencies:** none.
**Notes for next session:** The VIP lobby feature fills `vip.categories` in `views.ts` from `store.summaries()` (pass the store into `toView`) and applies the World-first default; New game snapshots `store.get(id).live[level].places` filtered by kind (`city` for Name, `landmark` for Picture). The admin write feature extends `CategoryStore` (it keeps the full list, drafts and hidden included, in `categories`). Picture mode (M6) adds 15 landmarks per level with generated placeholder photos to the fixture.
**How to try it:** `npm test` (server/categoryStore.test.ts 5 tests, server/http.test.ts 2 new). `npm run dev`, then `curl -s localhost:3010/api/categories` → one "World (dev)" with 15 cities per level. With `NODE_ENV=production` and no file it returns `[]`; a broken `categories.json` stops the server naming the path. No UI, no Kim checks.

## F07 — Socket gateway and lobby views (2026-11-07)
**What changed:**
- `server/sockets.ts` (adapted from Buzzr): `attachSockets(httpServer, {rooms, publicUrl, clock, trustProxy, roomLookupLimiter, playerJoinLimit, setTimer})` → `{io, dispatch, closeRooms}`. Every payload goes through `clientEventSchemas` in `handle()` (ack `{ok}` / `{ok: false, error}`; a missing ack or garbage cannot throw). Sockets join `room:<code>` plus `room:<code>:screen` or `room:<code>:player:<id>`; `dispatch` reduces, stores, sends every socket a fresh `state`, then runs effects (`fx` to Screens or one player, `schedule` → timeout → `{type: 'timer', at, timer, round, game, epoch}`, `kicked` → emit and disconnect). Handlers now: `screen:join`, `player:join`, `player:rename`, `player:leave` (sockets unjoined, may rejoin as new), `vip:kick`, and disconnect (`screen:leave`, or `player:connection false` once the player's last socket drops).
- Limits: new-player joins 30 per IP per minute (known key not counted; IP via `proxy-addr` with the same `trust proxy` as `req.ip`), `screen:join` in the shared `roomLookupLimiter` (created once in `index.ts`, also passed to `createApp`), `vip:*` 10 per second per socket, `maxHttpBufferSize` 16 KB (disconnect).
- `server/views.ts`: `toView(room, role, playerId, {now, publicUrl})` builds the lobby ScreenView (join URL `PUBLIC_URL/play/CODE`) and PlayerView field by field with `serverNow`; totals and competition ranks from `game.played`; the VIP's view adds `{categories: [], players, controls}`; `vipControls(phase, paused, rematchCounting)` is the spec's table. Round, reveal, standings, finale and `myResult` are null for now (`shortcut:` comment).
- `index.ts` wires the gateway and `startRoomSweeper(..., gateway.closeRooms)` → `room:closed {reason: 'expired'}` then disconnect. `ServerToClientEvents` in `shared/types.ts`, `ClientToServerEvents` in `shared/schemas.ts`.
**Decisions:** DECISIONS 15 (gateway refusal texts, wall-clock `now`, refused joins still count, WebSocket only, lobby controls).
**New dependencies:** `socket.io` (the stack's realtime layer); `proxy-addr` + `@types/proxy-addr` (the socket join limit needs the client IP exactly as Express's `req.ip` computes it behind Caddy; already a transitive Express dependency); `socket.io-client` (dev: the gateway tests now, the client later).
**Notes for next session:** Register new events with `handle(socket, '<event>', …)`; VIP events go through `asVip` (limiter + `by` from the socket), player events through `asPlayer`. Not registered yet: `player:practice`/`aim`/`lockIn` (need their per-socket limiters: aim dropped silently, lockIn 2/s, practice 1 per 2 s per player) and every `vip:*` except kick. The categories feature fills `vip.categories` in `views.ts` and must pass the category store into `toView`. F10+ fill `round`/`reveal`/…: extend `views.test.ts` into the spec's full leak test (coordinates, Wikidata id, country, fact, photo id, Commons file, Picture-mode name) when `round` first carries a prompt. The credits route must use the same `roomLookupLimiter` from `index.ts`. Errors are logged by message only.
**How to try it:** `npm test` (server/sockets.test.ts 13 tests over a real Socket.IO server, server/views.test.ts 5). Manual: `npm run build && PORT=3011 PUBLIC_URL=http://localhost:3011 npm start`, `curl -s -X POST localhost:3011/api/rooms`, then a `socket.io-client` script emitting `screen:join {code}` receives a ScreenView. No UI yet, so no Kim checks (the tests use a real local Socket.IO server).

## F06 — Reducer: lobby, players and VIP (2026-11-07)
**What changed:**
- `server/reducer.ts`: pure `reduce(room, action, now) → {room, effects, error?}` (structuredClone; a refusal returns the given room, no effects and the spec's text from `ERRORS`). Actions: `player:join` (first free `PALETTE` colour, name unique ignoring case, unique emoji, 12-player cap, kicked ids refused; a known key reconnects to the same id keeping its name and emoji; `waiting` in GUESSING/REVEAL/SCOREBOARD/FINAL), `player:rename` (LOBBY only), `player:leave`, `player:connection {playerId, connected}` (`connectedSince`), `vip:kick` (VIP only, not self; `kickedIds`, effect `kicked`), `screen:join`/`screen:leave` (`screenCount` 0…4), `timer`. Effects: `schedule {at, timer, round, game, epoch}`, `fx` to `'screens'` or `{playerId}`, `kicked`.
- `playerIdentity(code, key)`: id = first 16 chars of base64url SHA-256 of code + key; `keyHash` = hex SHA-256 of the key; the key is never stored.
- VIP: the first player; on the VIP's disconnect `vipAwayUntil = now + VIP_AWAY_MS` and `vipGone` is scheduled; succession goes to the connected player with the earliest `connectedSince` on leave, on `vipGone`, or on any connect once the deadline has passed; with nobody connected `vipId` stays until someone connects. A move emits `fx vipNow` to the new VIP. Every timer is checked against round, game and `timerEpoch` (`isStale`).
- `Room.vipAwayUntil` added to `shared/types.ts` and `createRoom`.
**Decisions:** DECISIONS 14 (error texts, `vipAwayUntil` and the echoed `at`, ties, VIP leaving with nobody connected, no toast on a fresh join, FINAL joiners wait, timers are not activity).
**New dependencies:** none.
**Notes for next session:** The gateway dispatches `{type: 'timer', ...scheduleEffect}` (all fields, including `at`) and computes `playerIdentity` itself to map the socket to the id; `by` must come from the socket, never the payload. Features that bump `timerEpoch` (F20 pause, F24 rematch) or change round/game must re-schedule `vipGone` at `vipAwayUntil` while it is set, or a pending succession is lost. `removePlayer` removes only the player: F15 adds the `allLocked` re-check after a leave, kick or disconnect in GUESSING, F22 removes the kicked player's round rows (see the `shortcut:` comment). Views must build `PublicPlayer` field by field (`keyHash` never leaves the server).
**How to try it:** `npm test` (server/reducer.lobby.test.ts, 28 tests). No UI yet.

## F05 — HTTP server, rooms and codes (2026-11-07)
**What changed:**
- `server/codes.ts`: 4-letter codes from `ROOM_CODE_ALPHABET` (no I, L, O), retried on collision and on Buzzr's blocked-word list (copied), up to `ROOM_CODE_MAX_ATTEMPTS` (100).
- `server/rateLimit.ts`: Buzzr's sliding-window limiter with an injectable clock; every limit uses `RATE_LIMITS`.
- `server/roomStore.ts`: `createRoom(code, now, rngState)` (empty LOBBY, default settings), in-memory `RoomStore`, `startRoomSweeper` deleting rooms idle 3 h (`ROOM_IDLE_TTL_MS`, swept every 5 min); wired in `server/index.ts`.
- `server/http.ts`: `POST /api/rooms` → 201 `{code}` (10 per IP per hour → 429); `GET /api/rooms/:code/exists` → `{exists, phase, full}` (shared `roomLookupLimiter`, 30 per IP per minute → 429); CSP, `Referrer-Policy`, `nosniff` on every response; one log line per request with `key=` redacted (not `/healthz`); a JSON error handler that logs only the redacted URL; the SPA fallback now passes `root` so it works under a dot directory (the worktree lives in `~/.cache`).
**Decisions:** DECISIONS 13 (new room's empty `categoryId` and defaults, full CSP, log format, error replies).
**New dependencies:** none.
**Notes for next session:** The credits route and `screen:join` must reuse the same `roomLookupLimiter` instance: create it in `index.ts`, pass it to `createApp` and to the socket gateway. `startRoomSweeper`'s `onExpired` is a no-op for now; the socket gateway should disconnect a swept room's sockets and the photo feature should drop its tokens there. The seed for `createRoom` comes from the injected `rng` (`Math.random` by default; not a secret).
**How to try it:** `npm test` (server/codes.test.ts, rateLimit.test.ts, roomStore.test.ts, http.test.ts); `npm run build && PORT=3011 npm start`, then `curl -si -X POST localhost:3011/api/rooms` and `curl -s localhost:3011/api/rooms/<CODE>/exists`.

## F04 — Scoring module (2026-11-07)
**What changed:**
- `shared/scoring.ts`: `basePoints(d, S)` (`FALLOFF` 8, 1000 when `d ≤ b`, else `floor`), `points(base, multiplier)` (`Math.round` after the multiplier), `escalation(rounds)` (multipliers per round − 1), `levelPlan(choice, rounds)` (Mixed thirds with `easy = hard = round(N / 3)`; a fixed level fills every round), `replan(old, played, fresh)` (the recompute for unplayed rounds, for levels and multipliers alike), `competitionRanks(totals)` (1, 2, 2, 4), `ordinal` and `rankText(rank, of, shared)` ("3rd of 8", "=2nd of 8").
**Decisions:** none new.
**New dependencies:** none.
**Notes for next session:** The reducer calls `replan(game.levelPlan, played.length, levelPlan(choice, n))` and the same with `escalation`, where the count is rounds already revealed (a skipped round is not played); round results keep their own `multiplier` and `points`, so played rounds never change. The round-count refusal (too few unused places at a level for the new plan) needs the pool and belongs to the reducer. `rankText`'s `shared` flag is the caller's: true when another player has the same rank. `competitionRanks` returns ranks only; the `joinedAt` display order for ties is the caller's.
**How to try it:** `npm test` (shared/scoring.test.ts, 15 tests).

## F03 — Geo module (2026-11-07)
**What changed:**
- `shared/geo.ts`: `haversineKm` (R = 6371.0088 km), `regionScale` (`S` = √(h × w) capped at 20,000), `bullseyeRadius` (0.01 × S), `boxContains` (edges included; `lng` or `lng + 360` in [west, east]), `mercatorCentre` (half way in Mercator x and y, longitude wrapped into [−180, 180)), `clampBounds` (box padded 25% each side, latitude clamped to ±`MAX_LAT`) and `geodesic` (64 segments, 65 points, both ends included).
- `normalizeLng` moved from `shared/schemas.ts` to `shared/geo.ts`; `schemas.ts` re-exports it.
**Decisions:** DECISIONS 12 (clamp latitude limit, continuous longitudes, antipodal geodesic, where `normalizeLng` lives).
**New dependencies:** none.
**Notes for next session:** `geodesic(a, b)` returns longitudes continuous from `a.lng`, so its last point may be `b.lng ± 360`; the reveal line should start at the pin or target that is drawn on the same world copy. `clampBounds` is for every box; the World category skips the horizontal clamp in the client (`worldCopyJump`). `mercatorCentre(box)` is the unlocked player's default aim (Points formula). The admin's S ≥ 150 km check can use `regionScale`. Scale and bullseye are unrounded; round only for display.
**How to try it:** `npm test` (shared/geo.test.ts, 24 tests).

## F02 — Shared types, schemas and constants (2026-11-07)
**What changed:**
- `shared/types.ts`: every Data model type (stored categories, Room state) plus the role views (`ScreenView`, `PlayerView`, `PublicPlayer`, prompts, reveal, standings, final passes, awards, `CategorySummary`), `fx` payloads and `Ack`.
- `shared/schemas.ts`: one zod schema per client event in `clientEventSchemas` (with `ClientPayload<E>`), the coordinate rule (`lat` within ±85.0511, `lng` finite and wrapped into [−180, 180) by `normalizeLng`), names (trimmed 1–16, no invisible characters), room codes (trimmed, upper-cased), the 21-char `playerKey`, every admin HTTP body and route parameter, and `categoriesFileSchema` for `categories.json`.
- `shared/constants.ts`: tokens, palette (the spec's list, untested until `palette.test.ts`), 24 emoji, room-code alphabet, settings menus and defaults, the eight timers plus the reveal timeline numbers, `RATE_LIMITS` (the limits table), player/screen caps, socket size, field limits, `MIN_PLACES_TO_OFFER`.
- Path alias `#shared/*` (package.json `imports`); `server/env.ts` and `shared/schemas.test.ts` use it. `npm start` and the deploy kit's Dockerfile CMD now pass `--conditions=dist`.
**Decisions:** DECISIONS 9 (limits the spec leaves open, `photoCandidate` = Commons file name), 10 (alias via Node subpath imports with a `dist` condition), 11 (views are types, not schemas; their layout is a first cut).
**New dependencies:** none.
**Notes for next session:** The built server needs `node --conditions=dist`; without it `#shared/*` points at the `.ts` sources and Node fails (F60's Dockerfile must keep the kit's CMD). The alias is proven in tsx (`server/env.ts` via `npm run dev`/tests), Vitest, tsc under both bundler (`tsconfig.json` includes `shared/*.test.ts`) and NodeNext resolution, the built server (`PORT=3011 npm start`), and a throwaway client import in a `vite build`; no committed client file imports `#shared` yet. `ScreenView.reveal.results` carries every row from REVEAL start because all pins drop at once; the views feature must still keep `myResult` until the reveal reaches the player. `photoSchema.author` may be empty: the credit builder must handle it. The box's S ≥ 150 km check belongs to the admin box editor.
**How to try it:** `npm test` (shared/schemas.test.ts, 25 tests); `npm run build && PORT=3011 npm start`, then `curl -s localhost:3011/healthz`.

## F01 — Project skeleton, tooling and CI (2026-11-07)
**What changed:**
- One npm package (no workspace): Express 5 server (`server/http.ts` `createApp()` with `/healthz`, `dist/client` with an SPA fallback that never swallows `/api`, `/socket.io` or `/tiles`; `server/index.ts` stops on SIGTERM within 3 s), `server/env.ts` parsing the spec's Environment table with zod (blank = unset; `TRUST_PROXY` as off, hop count, boolean or trust string), `.env.example` with every variable empty.
- React 19 + Vite client: a placeholder landing page ("PINPOINT" in flap cells, the one-liner) on the DESIGN.md tokens, defined in Tailwind 4 `@theme static` as `--color-*` with DESIGN.md-name aliases in `:root` (DECISIONS 8); JetBrains Mono 800 (latin) and Inter variable self-hosted via Fontsource; `.board-face` utility class; amber `:focus-visible` ring; SVG favicon.
- Tooling from Sketchy: tsconfigs (client/shared bundler; node for server/shared/scripts; build emits `dist/server`, `dist/shared`), eslint flat config, prettier; Playwright harness `scripts/playtest/` (one context per role; devices tv, tv 720p, laptop, Pixel 7, iPhone 13, small phone 360×640, large phone 430×932; default URL `http://localhost:5180`).
- Root `../.github/workflows/ci.yml`: `pinpoint-changes` and `pinpoint` jobs appended from `docs/deploy-kit/ci-jobs.yml` (format, lint, typecheck, test, build); nothing else changed.
**Decisions:** DECISIONS 4 (container data at `/data`), 5 (dev ports 3010/5180), 8 (token names). `.env.example` is written by shell: the `Read(./.env.*)` deny rule also blocks the Write tool on it, so sessions cannot edit it; ask Kim when a variable is added.
**New dependencies:** express, zod (env and later every schema; spec). Dev: react, react-dom, vite, @vitejs/plugin-react, tailwindcss + @tailwindcss/vite (tokens; spec), @fontsource/jetbrains-mono + @fontsource-variable/inter (self-hosted fonts; spec), typescript, tsx, concurrently, vitest, eslint + @eslint/js + typescript-eslint + eslint-plugin-react-hooks + globals + eslint-config-prettier, prettier, @types/node@24, @types/express, @types/react, @types/react-dom, playwright (playtest harness). Client libraries live in devDependencies, as in Sketchy: they are bundled at build time.
**Notes for next session:** npm's allowScripts blocked esbuild's postinstall (a binary check only); tsx, Vite and Vitest all work. Imports use relative paths with `.js` (`../shared/constants.js`) as in Sketchy; no path alias yet (F02 may add one if it pays). `shared/constants.ts` holds only the ports for now. Playwright uses its cached Chromium (falls back to `/usr/bin/chromium`).
**How to try it:** `npm run dev`, open http://localhost:5180 (phones on the LAN: `http://<laptop IP>:5180`); `curl -s localhost:5180/healthz` → `{"ok":true}`. `npm run playtest -- scripts/playtest/smoke.ts` with the dev server running. `npm run build && PORT=3010 npm start` serves the built app.

