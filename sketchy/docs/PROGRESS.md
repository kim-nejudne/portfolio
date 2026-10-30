# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

## Kim checks

Things only Kim can do: real phones and devices, mobile data, and reviewing Taglish, word packs and lists. Unattended sessions add a line here instead of blocking. Format: `- [ ] Fnn: exact steps · what to look for`. Kim ticks them off.

- [ ] F03: read `BLOCKED_WORDS` in `server/codes.ts` (DECISIONS 14) · add any Tagalog or Taglish word of ≤ 4 letters from `ABCDEFGHJKMNPQRSTUVWXYZ` (no I, L, O) that would embarrass a host on the TV, and drop any entry that blocks a harmless code for no reason (e.g. `PUKE`, `PWET` are mild)

<!-- entries below, newest first -->

## F06 — Ink relay v0 (2026-10-30)
**What changed:**
- `server/inkGateway.ts`: `attachInkGateway(io, {rooms, monotonic})` → `{ink, onInk}` on the `/ink` namespace (same engine: WebSocket only, 100 KB frames). A phone connects with handshake `auth: {code, playerKey}`; the middleware hashes the key and binds the socket to its pid (refused with `invalidPayload` / `roomNotFound` / `notPlayer`). A Screen connects with no auth and sends `ink:hello {code}` to join `ink:<code>:screen`, the only `/ink` room; a phone's hello acks `ok` and joins nothing. `ink:batch` is zod-checked, rate-limited (40/s per player), then relayed unchanged to `ink:<code>:screen` only if it comes from the current drawer, in DRAWING, not paused, for `room.turn.id`; otherwise it's dropped with `notJoined` / `notDrawer` / `wrongPhase` / `paused` / `staleTurn` / `rateLimited` (the ack is optional). `inkOpen` → `ink:turn {turnId}` to Screens so they clear; `inkClose`/`inkReset` are no-ops in v0. `ink:sync`, `ink:get`, `doodle:batch` answer `notAvailable`.
- `server/index.ts` wires `onInk` into `attachSockets`. `shared/types.ts`: `InkAuth`, `InkClientToServerEvents`, `InkServerToClientEvents`, new `GatewayError`s `notDrawer`, `staleTurn`, `rateLimited`. `shared/schemas.ts`: `inkAuthSchema` (strict).
- `client/src/ink/inkSender.ts`: the drawer's per-turn batcher. `toGrid(px, sizePx)` onto 0–1023; `begin`/`move`/`end` build `b`/`p`/`e` with relative points; flushes every 50 ms while ops are pending and at once on stroke end; ≤ 200 points per `p`, ≤ 4 KB per batch; `seq` and strokeIds from 1; no-op after `dispose`. Not wired to a socket yet (F08). No new dependencies.

**Decisions:** DECISIONS 22–24 (handshake auth for phones, open Screens as the spec allows; relay event names, error codes, check order and v0 limits; the sender's shape and its caller contract).

**Notes for next session:**
- F07 Screen: connect `io(base + '/ink', {transports: ['websocket']})` and send `ink:hello {code}` on every connect (including reconnects); clear on `ink:turn`; append each `ink:batch` (ignore a batch whose `turnId` isn't the latest `ink:turn`). A Screen that loads mid-turn sees a blank canvas until the next turn (snapshots are F12).
- F08 drawer pad: connect `/ink` with `auth: {code, playerKey}` (the same key as `player:join`), make one `createInkSender({turnId, send: (b) => inkSocket.emit('ink:batch', b)})` per turn (turnId from the view), `dispose()` it when the turn ends. Feed `toGrid(e.clientX - rect.left, rect.width)` (CSS px, not `canvas.width`); call `flush()` on `visibilitychange`/`pagehide` and `end()` on `pointercancel`. `getCoalescedEvents()` behind a feature check.
- F09 bot drawer can use `inkSender` too (it has no DOM dependency).
- F11: move the codec into `shared/ink.ts` and add the radial filter and RDP in `inkSender` before ops are pushed; the server should clamp accumulated points.
- F12: `seq` checks and `ink:resend`, the InkStore and its caps, `ink:sync`/`ink:hello` snapshots (Screens and the current drawer only), the 20-invalid-batches disconnect (count is not kept yet), `inkClose`/`inkReset` handling, freeing ink in the sweeper's `onExpired` (`index.ts` SPEC-QUESTION). Resends of kept batches must stay under the 40/s limit, which counts per player. `closeRooms` does not disconnect `/ink` sockets yet.
- `keyHash` lookups (here and `player:join`) are plain string compares of SHA-256 digests; fine, but switch both to `timingSafeEqual` if F44 tightens it.

**How to try it:** `npm test` (`server/inkGateway.test.ts`, `client/src/ink/inkSender.test.ts`, `shared/schemas.test.ts`). No UI yet (F07/F08), so no playtest. Live: `npm run build && PORT=3917 NODE_ENV=production node dist/server/index.js`; create a room with `curl -X POST localhost:3917/api/rooms`, then from Node connect a token Screen (`screen:join`) and an `/ink` socket that sends `ink:hello {code}`, join two players and give each an `/ink` socket with `auth: {code, playerKey}`, `host:start`; the Screen's `/ink` socket gets `ink:turn {turnId: 1}`, the first joiner's `ink:batch [1,1,[["b",1,0,1,10,10],["e",1]]]` acks `ok` and arrives at the Screen, and the second player's acks `notDrawer`.

## F05 — Views and socket gateway (2026-10-30)
**What changed:**
- `server/views.ts`: `toView(room, viewer, now)` builds `ScreenView` / `PlayerView` field by field (types in `shared/types.ts`: `TimerView`, `PlayerChipView`, `TurnView`, `SecretView`, `HostBlockView`, …, `ServerToClientEvents`). The word, gloss and choices only go into the drawer's own `secret` (current drawer in CHOOSING/DRAWING, `upcoming` drawer in REVEAL/SCOREBOARD); alternates go nowhere; the word goes public once the turn has ended and the phase is REVEAL or later. Everyone gets `mask` (`maskWord`), timers as `remainingMs`, and this turn's points; totals and ranks only in SCOREBOARD/FINAL. The `host` block goes to a token Screen and the crown holder.
- `server/sockets.ts`: `attachSockets(httpServer, {rooms, clock, monotonic, scheduler, onInk})` → `{io, dispatch}`. WebSocket only, `pingInterval`/`pingTimeout` 5000, 100 KB frames. Every event goes through zod → auth → `reduce` (monotonic `now`) → store with `lastActivityAt = clock()` → per-socket `state` → effects (`schedule` via the scheduler, `fx` to `room:<code>:screen` / `room:<code>` / `room:<code>:player:<pid>`, `kick`, ink effects handed to `onInk`). `screen:join` (a valid token makes it a host Screen; counts `screens`), `player:join` (SHA-256 `playerKey` → `keyHash`, acks `{pid}`), `ping` → `pong {t}`, every `player:*`, `drawer:choose` and `host:*` event. Disconnects dispatch `sys:screens` / `sys:disconnected`; `closeRooms` sends `room:closed {reason: 'expired'}` and is wired to the sweeper in `index.ts`.
- `Ack` errors are now a closed `AckError` (`ReduceError` + `GatewayError`); bad payloads answer `invalidPayload` without echoing. New constants `SOCKET_PING_INTERVAL_MS`, `SOCKET_PING_TIMEOUT_MS`.
- New deps: `socket.io` (the spec's realtime stack, as in Buzzr) and `socket.io-client` (dev: socket integration tests; the client uses it from F07).

**Decisions:** DECISIONS 20–21 (`toView` signature with `now` and the Screen token flag; array mask; `customWordCount`; reveal rule; inline shared ranks until F20; own-guess history waits for F15; closed ack codes; refused bad token; `lastActivityAt` on every accepted action; `room:<code>` all-sockets room; `room:closed` on expiry).

**Notes for next session:**
- F06: pass `onInk` to `attachSockets` and handle `inkOpen`/`inkClose`/`inkReset` there; share the `rooms` store. Ink must go only to `ink:<code>:screen`.
- F07/F08: the client must connect with `transports: ['websocket']` (the server accepts nothing else). A Screen with a stale token gets `badHostToken` and should retry `screen:join` without it. `state` arrives before the join ack on the same socket.
- F13: the `ping` handler only answers `pong`; add RTT samples per socket and pass the real `oneWayMs` in `player:guess` (now 0).
- F15: `PlayerView` has no "own last 5 guesses" yet; add per-player guess results to the turn and a `me.guesses` field. `guessFeed: 'masked'` is not applied in v0 (`off` is, in the view).
- F44: no join, guess, reaction or host-action rate limits in the gateway yet. Buzzr computes the client IP with `proxy-addr` and Express's compiled `trust proxy` fn; `TRUST_PROXY` is already parsed in `index.ts`.
- `closeRooms` does not cancel a swept room's pending timers; they fire into `roomNotFound` harmlessly.

**How to try it:** `npm test` (`server/views.test.ts`, `server/sockets.test.ts`). No UI yet (F07/F08), so no playtest. Live: `npm run build && PORT=3917 NODE_ENV=production node dist/server/index.js`, `curl -X POST localhost:3917/api/rooms` for a code, then from Node `io('http://localhost:3917', {transports: ['websocket']}).emitWithAck('player:join', {code, playerKey: 'x'.repeat(21), name: 'Kim'})` → `{ok: true, pid}` and a `state` with `role: 'player'`, `phase: 'LOBBY'`.

## F04 — Reducer v0: lobby and a basic turn (2026-10-30)
**What changed:**
- `server/reducer.ts`: pure `reduce(room, action, now) → {ok, room, effects} | {ok: false, error}` working on a `structuredClone`. Handles `player:join` (new / same-key reconnect / `kicked` / `roomFull` / case-insensitive `nameTaken` / `nameOfDisconnected` and `takeOver` → `fx rejoined`; first joiner crowned), `player:leave` (crown to the earliest connected joiner; drawer leaving → REVEAL as `skip`), `host:start` (≥ 2 connected, turn order by `joinedAt`), `player:guess`, `host:skip`, `host:next` (REVEAL), `timer` (`drawUp`, `allGuessed`, `revealDone`; mismatched `turnId`/`timerEpoch` → `staleTimer`), `sys:connected/disconnected/screens`. Every other action answers `notAvailable`.
- Turns go straight to DRAWING: 3 seeded-random words from `server/words.v0.ts` (20 frozen English words), the first one is the word; effects `fx yourTurn`, `inkOpen`, `drawUp` at `endsAt + GRACE_MS`. REVEAL awards the drawer half, pushes a `TurnSummary` to `history`, `inkClose`, `fx turnEnd`, `revealDone` in 8 s with auto-advance. After the last drawer in the order → FINAL. Every phase change bumps `timerEpoch`.
- `server/scoring.ts`: `guesserPoints(T, t)` and `drawerPoints(points[])`, fed uncorrected `t = receivedAt − clockStart`.
- `shared/types.ts`: closed `ReduceError` union; payload-less actions fixed to `Record<never, never>` (they couldn't be built before). Test fixtures in `server/test/rooms.ts`. No new dependencies.

**Decisions:** DECISIONS 16–19 (result and error shape, host check on the crown, seeded pids, v0 shortcuts and where each later feature picks them up, the `NoPayload` type fix).

**Notes for next session:**
- F05: the reducer never touches `lastActivityAt` (it's wall-clock; `now` is monotonic). The gateway must set `room.lastActivityAt = Date.now()` on every accepted action, or live rooms expire 3 h after creation. Drop `staleTimer` results silently (no broadcast, no log).
- F05 `toView` is the only barrier: `turn.word`, `turn.choices`, `history[].word` of the current turn, `closeGuesses` are server-only before REVEAL. Leak-test Screen, guesser and crown views mid-DRAWING.
- F13: replace the `receivedAt > endsAt` cut-off with corrected time ≤ `endsAt` (guesses inside the 300 ms grace are `tooLate` in v0), and give `correct` a stable order (corrected time, then arrival).
- F15: v0 sends every wrong guess raw to the Screen via `fx wrongGuess` and `feed`, so a near miss would show on the TV. Don't play a real game on v0.
- F18 replaces `startDrawing`'s deal with CHOOSING and the deck; F20 replaces `advance`'s single cycle; F23 appends mid-game joiners to `turnOrder` (`leave` already keeps `turnIndex` pointing at the turn just played). When pausing lands, the `timer` handler relies on pause bumping `timerEpoch`.
- F19: `allGuessed` is checked on a correct guess and on a guesser leaving, not on a disconnect yet.

**How to try it:** `npm test` (`server/reducer.lobby.test.ts`, `server/reducer.turn.test.ts`, `server/scoring.test.ts`, `shared/types.test.ts`). No UI or sockets yet (F05).

## F03 — Rooms, codes and RoomStore (2026-10-30)
**What changed:**
- Ported from Buzzr (credited at the top of each file): `server/codes.ts` (plus Tagalog blocked words), `hostToken.ts`, `rateLimit.ts`, `roomStore.ts` (`InMemoryRoomStore`, `startRoomSweeper`: 3 h idle TTL, swept every minute), `env.ts` (`parseTrustProxy`).
- `server/rng.ts`: mulberry32 with the state in `Room.rngState`: pure `nextRandom(state) → [value, state]` and `createRng(state)` with `next`, `int(n)`, `shuffle` and `.state` to store back. `server/room.ts`: `createRoom` (the full spec Room in LOBBY, partial settings over `DEFAULT_SETTINGS`, `newSeed()` from `crypto.randomInt`).
- `server/http.ts`: `POST /api/rooms` (10 per IP per hour, zod-checked, 201 `{code, hostToken}`, stores only the SHA-256 hash), `GET /api/rooms/:code/exists` → `{exists, phase, full}` (60 per IP per minute), JSON errors under `/api`. `server/index.ts` wires the store, the sweeper and `TRUST_PROXY`, and closes the server on shutdown.
- New constants: `ROOM_SWEEP_INTERVAL_MS`, `ROOM_CODE_MAX_ATTEMPTS`, `CREATE_ROOM_BODY_MAX_BYTES`, `ROOM_CHECK_RATE_LIMIT`; new type `HttpErrorBody`. No new dependencies.

**Decisions:** DECISIONS 13–15 (the `exists` limit; Tagalog code words that the I/L/O-free alphabet can actually spell; HTTP error shapes, 503, body cap, `TRUST_PROXY` parsing, seed source).

**Notes for next session:**
- F04/F05: `lastActivityAt` is only set at creation. The gateway/reducer must bump it on every action, or a live room expires 3 h after it was made. Pass `onExpired` to `startRoomSweeper` once the InkStore exists (F11/F12) so a swept room frees its ink.
- The reducer draws randomness with `const rng = createRng(room.rngState); …; rngState: rng.state`. Never import `room.ts` (`newSeed`) or `codes.ts` (`Math.random` default) from the reducer.
- F51/F52 deploy: set `TRUST_PROXY=1` in the container env, or every phone behind nginx shares 127.0.0.1 and one rate-limit bucket (10 rooms per hour for the whole site).
- `createApp` takes `rooms`, `clock`, `rng` and `trustProxy`; F05 should share the same `rooms` store with the socket gateway.

**How to try it:** `npm test` (`server/http.rooms.test.ts`, `rng.test.ts`, `codes.test.ts`, `hostToken.test.ts`, `rateLimit.test.ts`, `roomStore.test.ts`, `room.test.ts`, `env.test.ts`). Live: `npm run dev`, then `curl -X POST localhost:3000/api/rooms -H 'content-type: application/json' -d '{"settings":{"drawSeconds":60}}'` → `{"code":"MEHH","hostToken":"…"}`; `curl localhost:3000/api/rooms/MEHH/exists` → `{"exists":true,"phase":"LOBBY","full":false}`.

## F02 — Shared types, schemas and constants (2026-10-30)
**What changed:**
- `shared/types.ts`: the Room model as in the spec (`Room`, `Turn`, `Player`, `WordEntry`, `CorrectGuess`, `FeedItem`, `TurnSummary`, `Award`, `Paused`, `RoomSettings`), reducer `Action` (client actions carry `by: Sender`; `sys:*` and `timer` don't), `TimerName`, `Effect` and `Fx`, `ClientPayloads`/`ClientToServerEvents`/`Ack`, the ink op and batch tuples with `/ink` client payloads, and the HTTP bodies and responses.
- `shared/schemas.ts` (zod): `clientPayloadSchemas` for every main-namespace event and `inkPayloadSchemas` for every `/ink` event (`ink:batch` with the 4 KB cap, `ink:hello`, `ink:sync`, `ink:get`, `doodle:batch` with the 20 KB cap), `createRoomBodySchema`, `roomSettingsSchema` and the strict `partialSettingsSchema`. Both maps are `satisfies`-checked against `types.ts`, and `SchemaTypeChecks` asserts settings, ops and batches agree both ways.
- `shared/constants.ts`: every timing, limit and rate limit from the spec, the 8 drawing colours, eraser index, canvas colour, 12 player colours, reactions, settings choices, `DEFAULT_SETTINGS`, `PRESETS` (Quick, Classic, Barkada Night) and `MID_GAME_SETTINGS`.
- New dep: `zod` (runtime payload validation, the spec's stack; same major as Buzzr).

**Decisions:** DECISIONS 7–12 (id formats; the 12 player colours; trimming and strict settings; ink schema bounds and byte caps in the schema; the `exists` response shape; effect/fx shape and which types wait for F05/F06/F11).

**Notes for next session:**
- Handlers use `clientPayloadSchemas[event].safeParse(payload)` and `inkPayloadSchemas[...]`; schemas trim names and guesses and upper-case room codes, so use the parsed value.
- `ServerToClientEvents` and the `ScreenView`/`PlayerView` types are not written yet: F05 adds them with `toView`. The ink action-stack type and `ink:snapshot`/`ink:state`/`ink:resend`/`doodle` server payloads come with F06/F11/F12.
- The schema rejects off-grid `b` points; clamping accumulated `p` points to the grid belongs in the codec (F11) and relay (F12).
- Review follow-ups: `Ack.error` is still a free string; when F05 writes the handlers, consider a closed union of error codes so no handler can echo a word or guess in an error. Never log `host:customWords` payloads or their `ZodError` input (custom words are never logged).
- `shared/types.test.ts` holds `@ts-expect-error` checks for fx targets; the typecheck enforces them.
- `constants.test.ts` pins every fixed number from the spec; change both if a playtest retunes one (e.g. `DRAWER_SHARE`).

**How to try it:** `npm test` (`shared/schemas.test.ts`, `shared/constants.test.ts`); `npm run typecheck` fails if a schema and its type drift apart.

## F01 — Project skeleton and tooling (2026-10-30)
**What changed:**
- One `package.json` (npm, Node 24, ESM) with `dev`, `build`, `start`, `test`, `typecheck`, `lint`, `format`, `format:check`, `lan`, `playtest`; TypeScript (client `tsconfig.json`, server/scripts `tsconfig.node.json`, prod build `tsconfig.build.json`), ESLint flat config, Prettier, Vite + React + Tailwind 4, Vitest.
- `server/http.ts` (`createApp`: `GET /healthz` → `{ok: true}`, built client with SPA fallback in production), `server/index.ts`, `server/lan.ts` (`lanAddress`, ported from Buzzr's `env.ts`); placeholder `Landing`, `Play`, `Screen` pages (Screen is a lazy chunk, per the performance budget) and a favicon.
- `npm run lan [CODE] [--port N]` prints the Screen URL and the join URL with terminal QR codes; `npm run playtest -- <scenario.ts>` runs a Playwright scenario with one isolated context per role (`scripts/playtest/harness.ts`, `run.ts`, `smoke.ts`: Screen + 3 phones).
- CI: `sketchy-changes` + `sketchy` jobs in `../.github/workflows/ci.yml` (npm ci, format check, lint, typecheck, test, build), gated on changes like Buzzr's.
- New deps (one line each): `express` (HTTP server, spec stack); `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `react-router`, `tailwindcss`, `@tailwindcss/vite` (client stack, as Buzzr); `typescript`, `tsx`, `vitest`, `eslint` + `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-config-prettier` + `globals`, `prettier` (tooling, as Buzzr); `concurrently` (server + Vite in one `npm run dev`); `playwright` (playtest harness); `qrcode` (terminal QR for `npm run lan`); `@types/*` for the above.

**Decisions:** DECISIONS 4–6 (lan Screen URL is `/`; plain-Playwright harness in Chromium with device emulation; only F01's deps installed, SPA fallback never covers `/api/` or `/socket.io/`).

**Notes for next session:**
- The first unattended attempt was blocked only because `npm install` needed approval; this run installed it and finished the work.
- npm 12 blocks esbuild's postinstall (`allowScripts`); Vite and Vitest work without it (the platform binary comes from an optional dependency). CI's `npm ci` on Node 24 is unaffected.
- Playtests: start `npm run dev` first; `run.ts` checks `/healthz` and exits 2 if the app is down. Scenarios live in `.playtest/<ID>/scenario.ts` and import `../../scripts/playtest/harness.js`. The harness falls back to `/usr/bin/chromium` when Playwright's own browser isn't downloaded.
- `server/index.ts` has no Socket.IO yet; F03/F05 attach the main namespace and `/ink` to its `httpServer`.
- Review follow-ups for later features: close the HTTP/Socket.IO server in `shutdown` once rooms exist; keep the SPA fallback off `/socket.io/` (both namespaces share it); `overscroll-behavior: none`, `touch-action` and base colours/`theme-color` arrive with the play UI.

**How to try it:**
- `npm run dev`, then open http://localhost:5173/ (and `/play/ABCD`, `/screen/ABCD`); `curl localhost:5173/healthz` → `{"ok":true}`.
- `npm run lan -- ABCD`: scan the join QR with a phone on the same Wi-Fi → "Play ABCD".
- `npm run build && npm start` → http://localhost:3000/ serves the built client.
- With `npm run dev` running: `npm run playtest -- scripts/playtest/smoke.ts` → `PASS`.
