# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

<!-- entries below, newest first -->

## F10 — Host pairing and host remote shell (2026-10-27)
**What changed:**
- `client/src/components/PairHostPhone.tsx`: a **Pair host phone** button. It shows a QR to `/host/:code#t=<hostToken>` (`pairUrl` in `lib/joinUrl.ts`) with "Hides in N s", hides at a 60 s deadline (`PAIRING_QR_TTL_MS`), and has a **Hide** button. The token is never printed as text.
- `Screen.tsx` lobby: shows the button only when `loadHostToken(code)` is set (DECISIONS #14).
- `client/src/pages/Host.tsx` at `/host/:code`, replacing the placeholder:
  - The token comes from the hash (`tokenFromHash` in `lib/hostTokens.ts`) or from storage. The hash is stripped at once, and the token is stored only after `host:join` succeeds.
  - With no token: "Not authorised", and no socket is opened. A rejected token is cleared (only if it is the stored one; a different stored token is tried next) and ends at "Not authorised".
  - Remote: code and title, a question card (in the lobby, "Up first: question 1 of N" from `nextQuestion`) with the answer and notes in an accent box, **Pair host phone** in the lobby, and a live player list with colour dot, score and "offline".
- `INVALID_HOST_TOKEN_ERROR` in `shared/constants.ts` replaces the string in the server and the Screen.
- There are 28 new tests, 253 in total: `Host.test.tsx` (20), Screen pairing (5), `tokenFromHash` (2) and `pairUrl` (1). `App.test.tsx` now expects "Not authorised" at `/host/ABCD`.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F10 cover:
- Open question 14, now resolved.
- The deadline-based QR expiry and the Hide button.
- Hash over stored token, storing only after acceptance, and the fallback on rejection.
- "Not authorised" without a socket, and the shared error constant.
- Hash-only navigation in an open tab.
- `nextQuestion` in the lobby card; the image (F30) and the primary action (F16) wait.

**Notes for next session:**
- F16 adds the primary action where `Host.tsx` has `TODO(F16)`, below the question card. F22 adds the tabs and secondary actions.
- `HostConnected` is keyed by token, so a token change opens a fresh socket.
- Tests that start on a `#t=` URL must `await flushNavigation()` (an `act` flush) before acking a join that remounts. Otherwise React Router's pending transition hangs the test until it times out.
- Pairing tests mock `qrcode.react` to expose the QR value as `data-value`.

**How to try it:** Run `npm run dev`. On the laptop, open `http://<LAN-IP>:5173`, click **Host a game**, then **Use this device as the Screen**, then **Pair host phone**. Scan the QR with a phone: it opens the remote with the first question's answer, and players appear there as they join. The QR hides after 60 s. `/host/CODE` on a device with no token shows "Not authorised". Screenshot: `.playtest/F10/4-host.png`.

## F09 — Player join flow (2026-10-27)
**What changed:**
- `client/src/pages/Play.tsx` at `/play/:code`:
  - It checks `GET /api/rooms/:code/exists` (`roomExists` in `lib/api.ts`). An unknown or malformed code shows "Room not found" with a link home.
  - Name form: 1–16 characters (`maxLength`, then `playerNameSchema`, which trims). Join stays disabled for a blank name. Server refusals, such as "That name is taken", show on the form.
  - The join goes through `useRoomSocket` with `player:join`. The identity is stored only once the join succeeds. A stored identity rejoins on load and on every reconnect, without the form.
  - Lobby: a slim top bar in the player's colour with name and score, and a grey disabled round button, "You're in! Waiting for the host". Other phases show "Game in progress" until F17.
- `client/src/lib/playerIdentity.ts`: `newPlayerId` (nanoid), and save, load and clear `{playerId, name}` under `buzzr:player:<CODE>`.
- `PLAYER_KICKED_ERROR` in `shared/constants.ts` is now used by the reducer and by the Player view.
- `client/src/test/fakeSocket.ts`: the `FakeSocket` moved out of `Screen.test.tsx` and is shared.
- There are 29 new tests, 225 in total: `Play.test.tsx` (19), `playerIdentity.test.ts` (6) and `roomExists` in `api.test.ts` (4). `App.test.tsx` now expects the real Player page.

**Dependencies:**
- `nanoid`: the spec's `playerId` generator. `crypto.randomUUID` is unavailable on plain-http LAN pages, which are not a secure context.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F09 cover:
- nanoid over `randomUUID`.
- The storage key.
- `exists` first, and clearing a stale identity.
- Storing only after the join succeeds, with one id per visit.
- Refusals back to the form, except a kick.
- The "Game in progress" stand-in.

**Notes for next session:**
- F10 (the Host remote) can follow the same page shape: a `Step` union, then a room component that calls `useRoomSocket` with its own `join`.
- F17 replaces the `Buzzer` label switch in `Play.tsx` (`TODO(F17)`). Keep the colour bar, and add `pointerdown` and Space.
- Players in tabs of one browser share `localStorage`, so they share an identity per room. Playtests need one browser context per player.
- Wake Lock and the connection dot belong to F33, not F17.

**How to try it:** Run `npm run dev`. On the laptop, open `http://<LAN-IP>:5173`, click **Host a game**, then **Use this device as the Screen**. Scan the QR with phones (or open `/play/CODE` in separate browser profiles) and enter names. Chips appear on the Screen. Reload a phone and it stays the same player. A duplicate name shows "That name is taken". `/play/ZZZZ` shows "Room not found". Screenshot: `.playtest/F09/lobby-player.png`.

## F08 — Host a game and the Screen lobby (2026-10-27)
**What changed:**
- `client/src/components/HostGame.tsx`, shown on the landing page:
  - **Host a game** posts `SAMPLE_SET` with `DEFAULT_SETTINGS` through `createRoom` (`client/src/lib/api.ts`) and stores the token with `saveHostToken`.
  - It then shows the code, **Use this device as the Screen** (which goes to `/screen/CODE`) and **Open the Screen on another device** (which shows the Screen URL and the code).
- `client/src/pages/Screen.tsx` at `/screen/:code`:
  - It joins with the stored token, if this device has one. A stale token is dropped and the Screen rejoins without it.
  - Lobby: the set title, "Join at <url>", the huge code, the QR to `/play/CODE` (`qrcode.react`) and colour chips that pop in. Chips shrink above 20 players. Running on localhost shows a note.
  - A bottom strip always shows the code and "Join at <url>".
  - Errors show their message with a link home. Phases other than LOBBY show "Game in progress".
- Client plumbing:
  - `lib/roomStore.ts`: a Zustand store `{view, error}`.
  - `lib/useRoomSocket.ts`: `useRoomSocket(code, join, makeSocket?)` joins on every `connect`, so a reconnect rejoins, and resets the store on unmount.
  - `lib/hostTokens.ts`: save, load and clear.
  - `lib/joinUrl.ts`: `joinUrl`, `displayUrl` and `isLoopbackHost`.
- There are 27 new tests, 196 in total.
  - `Screen.test.tsx` uses a fake socket: the join payload with and without a token, the stale-token rejoin, the reconnect rejoin, the lobby code, URL and QR, live chips, the strip in the lobby and in a game, errors, a malformed code and the disconnect on unmount.
  - Landing gains 5 Host a game tests.
  - The new lib tests cover api, hostTokens and joinUrl.
- `.gitignore` now ignores `graphify-out/`.

**Dependencies:**
- `zustand`: the spec's client-state store. It holds the latest snapshot, which pages render.
- `qrcode.react`: the spec's QR library, used for the join QR now and the pairing QR in F10.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F08 cover:
- The sample set until F25.
- The Screen choice shown on the landing page.
- The localStorage key.
- The join URL from the page origin, with the localhost note. A `PUBLIC_URL` item is in the Backlog.
- The stale-token rejoin.
- The store and hook shape.
- Pair and Start deferred.
- The chip scaling.

**Notes for next session:**
- F09 and F10 should reuse `useRoomSocket` with their own `join`. A component reads `useRoomStore` and narrows on `view.role`.
- F10 adds **Pair host phone** to the Screen lobby, shown only when `loadHostToken(code)` is set (DECISIONS #14). It also adds Start (F16/F23).
- In dev, open the app at the laptop's LAN address, not `localhost`, or the QR points phones at `localhost`.
- In dev, StrictMode mounts twice, so the browser logs one "WebSocket is closed before the connection is established" warning per Screen load. It is harmless.
- The playtest joined players by socket script, because `/play` is still a stub (F09). Node `socket.io-client` needed `transports: ['websocket']` against `127.0.0.1:5173`.

**How to try it:** Run `npm run dev`. On the laptop, open `http://<LAN-IP>:5173`, click **Host a game**, then **Use this device as the Screen**. The lobby shows the code, the QR and the URL. Join players with a `socket.io-client` script (`player:join {code, playerId, name}`) or, after F09, from phones. Chips appear live. Screenshots: `.playtest/F08/`.

## F07 — Socket gateway: joins and state broadcast (2026-10-27)
**What changed:**
- `server/sockets.ts`: `attachSockets(httpServer, {rooms, clock, trustProxy, playerJoinLimit})` is WebSocket only, with `maxHttpBufferSize` set to 100 KB.
  - `handle(socket, event, fn)` parses with `clientPayloadSchemas[event]`, tolerates a missing ack and turns a throw into "Server error".
  - `dispatch(code, action)` runs `reduce`, stores the result, broadcasts and then runs the effects. `broadcast(room)` sends `toView` per role to `room:<code>:screen`, `room:<code>:host` and each `room:<code>:player:<id>`. `fx` goes to all of them.
  - `screen:join` (optional token, which sets `socket.data.canHost`), `host:join` (`verifyHostToken`) and `player:join` (per-IP limit for new ids only) are handled. A disconnect marks the player disconnected unless another socket holds the same id.
- `server/index.ts` passes `rooms`, `Date.now` and `trustProxy` to the gateway.
- `client/src/lib/socket.ts`: `createSocket(url?)` is typed, uses `transports: ['websocket']` and sets `autoConnect: false`. Nothing calls it yet.
- There are 16 new tests, 169 in total. `server/sockets.test.ts` uses real socket.io clients on an ephemeral port: bad tokens, Screen with a token gets no answers, notes or hash, the fresh state per role, reconnect, the reconnect race, validation, the 100 KB close, the join limit and `lastActivityAt`. `client/src/lib/socket.test.ts` covers the transport. Two mutations of the gateway were each caught.

**Dependencies:**
- `socket.io-client`: the official client for the Socket.IO server, used by the browser and by the real-client gateway tests.
- `proxy-addr` and `@types/proxy-addr`: Express already ships `proxy-addr` for `req.ip`. Importing it directly lets the socket join limit resolve the client IP with the same `TRUST_PROXY` rule.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F07 cover:
- Open questions 2 and 3, now resolved.
- `proxy-addr` for the IP.
- One join per socket.
- Joins bumping `lastActivityAt`.
- The disconnect race.
- State going out before the ack, and the error messages.

**Notes for next session:**
- F08 and later host events: check `socket.data.canHost` (true for host sockets and for a Screen that sent a valid token). Send them through `dispatch`.
- Extend the Screen-with-token leak test once host actions change state. Add an `fx` leak check when `fx buzz` and `fx correct` land (F12 and later).
- `player:*` events must use `socket.data.playerId`, never a playerId from the payload.
- `ping`, `player:buzz` and scheduled effects are F15. `runEffects` switches on `effect.type`, so add the cases there.
- `room:closed` and `kicked` are not emitted yet. The sweeper deletes rooms silently.

**How to try it:** Run `npx vitest run server/sockets.test.ts`. Or run `npm run build && PORT=3917 npm start`, `POST /api/rooms` with `SAMPLE_SET`, and connect a `socket.io-client` with `transports: ['websocket']`. `host:join {code, hostToken}` acks `{ok: true}` and delivers a HostView.

## F06 — Room creation over HTTP (2026-10-27)
**What changed:**
- `server/http.ts`: `createApp({clientDir, rooms, clock, rng, trustProxy})`.
  - `POST /api/rooms` checks the per-IP limit (10/h, 429), parses JSON up to 1 MB (413), validates with `createRoomBodySchema` (400 with a `z.prettifyError` message naming the field) and draws a code with `createRoomCode` (503 if none is free). It stores `createRoom(...)` with only the token hash and answers 201 `{code, hostToken}`.
  - `GET /api/rooms/:code/exists` answers `{exists, phase}` in any case, with `phase: null` for unknown or malformed codes.
  - Every error body is `{ok: false, error}`. An error handler maps body-parser failures to 400 and 413.
- `server/hostToken.ts` holds `generateHostToken` (32 CSPRNG bytes, base64url), `hashHostToken` (SHA-256 hex) and `verifyHostToken` (constant-time digest compare). `server/rateLimit.ts` holds `createRateLimiter({max, windowMs}, clock)`, a sliding window per key.
- `shared/sampleSet.ts` holds `SAMPLE_SET`: 10 text-only general-knowledge questions with ids `sample-q1`…`sample-q10`.
- `server/index.ts` passes the store, `Date.now` and `TRUST_PROXY` to `createApp`. `shared/types.ts` gains `RoomExistsResponse` and `HttpErrorBody`.
- There are 28 new tests, 153 in total, in `http.test.ts`, `hostToken.test.ts`, `rateLimit.test.ts` and `sampleSet.test.ts`.

**Dependencies:** none.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F06 cover:
- The status codes and the error shape.
- Every create attempt counting against the limit.
- `trust proxy` off unless `TRUST_PROXY` is set.
- `exists` always answering 200.
- The hash format and the compare.
- The text-only sample set.

**Notes for next session:**
- F07 must authorise `host:join` and `screen:join` with `verifyHostToken(token, room.hostTokenHash)`, not a string compare.
- Reuse `createRateLimiter` for `player:buzz` (per socket) and `player:join` (per IP, DECISIONS #3).
- `server/index.ts` still has `TODO(F07)`: pass `rooms` to `attachSockets`.
- F34 must set `TRUST_PROXY` behind a proxy; I added that to its Done-when. Rate-limiting `exists` is in the Backlog.
- Nothing in the client calls these endpoints yet. **Host a game** (F08) will post `SAMPLE_SET` or a saved set.

**How to try it:** Run `npm test` (`server/http.test.ts` and the others above). Or run `npm run dev` and then:
`curl -s -XPOST localhost:3000/api/rooms -H 'content-type: application/json' -d '{"set":{},"settings":{}}'`, which gives a 400 listing the bad fields. Then `curl -s localhost:3000/api/rooms/ABCD/exists`.

## F05 — Reducer foundation: lobby, players, toView (2026-10-27)
**What changed:**
- `server/reducer.ts` holds:
  - `reduce(room, action, now)`, which returns `{ok: true, room, effects}` or `{ok: false, error}`. It never mutates its input and sets `lastActivityAt = now` on every successful action.
  - The `Action` union, which so far has `player:join {playerId, name}` and the internal `player:disconnect {playerId}`. `Effect` is `{type: 'fx', fx}` for now.
  - `player:join`, which checks in this order: kicked id, known id (reconnect: `connected: true`, with name, score and colour kept), FINAL, 50 players, then a case-insensitive name match. A new player gets the least-used palette colour and triggers `fx join`.
- `server/room.ts` holds `createRoom({code, hostTokenHash, set, settings, now})`, which builds a fresh LOBBY room. F06 should use it.
- `server/ranking.ts` holds `rankPlayers`. It sorts by score, highest first, then by join order. Ties share a rank (1, 1, 3).
- `server/views.ts` holds `toView(room, role, playerId?)`, with an overload per role.
  - The Screen view builds the question field by field. The answer is included in REVEAL only.
  - The host view gets the full current and next question, the buzzes, the judgements and each player's RTT.
  - The player view gets `me`, rank, `hasBuzzed`, `lockedOut`, the winner's name and `pointsThisQuestion`. It never gets question text.
- Test fixtures live in `server/test/rooms.ts`: `makeRoom`, `makePlayer`, `makeSet`, `makeQuestion` and `withPlayers`. `tsconfig.build.json` excludes `server/test`.
- There are 50 new tests, 125 in total, across `reducer.lobby.test.ts`, `views.test.ts` (the leak test) and `ranking.test.ts`. The leak test fails if `screenQuestion` spreads the question; I checked this by mutating it.

**Dependencies:** none.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F05 cover:
- `now` is wall-clock time.
- The result shape.
- The order of the join checks.
- A reconnect ignores the name it sends.
- The duplicate-name rule.
- Colour reuse.
- Competition ranking.
- No answer in FINAL. This departs from the spec's literal wording, because `host:end` can reach FINAL from an unrevealed question.
- The view defaults.

**Notes for next session:**
- `alsoBuzzed` is `[]`, marked `TODO(F12, F14)`.
- F14 needs a way to know that a player "joined during the current opening". `Player` has only `joinedAt`, so F14 may need to record the opening a player joined in.
- No action is phase-gated yet; only the unknown-action rejection is tested. F13 adds the table-driven wrong-phase tests.
- `player:disconnect` also bumps `lastActivityAt`.
- The reducer expects the name to be trimmed and parsed by zod already.
- `toView(room, 'player', id)` throws for an unknown id. The gateway must only build views for joined players.
- Under `noUncheckedIndexedAccess`, `room.players[id]` and `PLAYER_PALETTE[i]` can be `undefined`. Use `?.` in tests.

**How to try it:** Run `npm test` (`server/reducer.lobby.test.ts`, `server/views.test.ts` and `server/ranking.test.ts`). There is no UI or socket yet.

## F04 — Room codes and RoomStore (2026-10-27)
**What changed:**
- `server/codes.ts` holds:
  - `generateRoomCode(rng)`, which makes one 4-letter draw from `ROOM_CODE_ALPHABET`.
  - `isBlockedCode(code)`, a substring match against `BLOCKED_WORDS`.
  - `createRoomCode(isTaken, rng = Math.random)`, which retries collisions and blocked words. It throws after `ROOM_CODE_MAX_ATTEMPTS` (100) draws.
  - The `Rng` type, `() => number` in [0, 1).
- `server/roomStore.ts` holds:
  - A synchronous `RoomStore` interface: `get`, `has`, `set` (keyed by `room.code`), `delete` (returns a boolean), `size` and `sweep(now)`. `sweep` deletes rooms with `now - lastActivityAt >= ROOM_IDLE_TTL_MS` and returns their codes.
  - `InMemoryRoomStore`, the Map-backed implementation.
  - `startRoomSweeper(store, clock, intervalMs = ROOM_SWEEP_INTERVAL_MS)`, an unref'd interval that returns a stop function.
- `shared/constants.ts` gains `ROOM_SWEEP_INTERVAL_MS` (60 s) and `ROOM_CODE_MAX_ATTEMPTS` (100).
- `server/index.ts` creates the store and starts the sweeper with `Date.now`. The store is not yet passed to the HTTP or socket layers (`TODO(F06, F07)`).
- There are 19 new tests, 75 in total. `codes.test.ts` covers the alphabet, seeded collision retry, the blocklist and exhaustion. `roomStore.test.ts` covers get/set/delete, 3 h − 1 ms against exactly 3 h, idleness measured from last activity, and the sweeper on fake timers.

**Dependencies:** none.

**Decisions:** DECISIONS rows dated 2026-10-27 for F04 cover:
- The blocklist contents and substring matching.
- `Math.random` for codes and the 100-draw cap.
- Expiry at exactly 3 h, on wall-clock time, with a 60 s sweep.
- The synchronous `RoomStore`.

**Notes for next session:**
- Write `createdAt` and `lastActivityAt` with `Date.now` (wall clock), not `performance.now`. The sweeper compares them against `Date.now`. Buzz times are the only values on the monotonic clock.
- F06 calls `createRoomCode((code) => rooms.has(code))` and turns the exhaustion error into an error response.
- Whatever handles an event must bump `lastActivityAt`, or rooms expire mid-game after 3 h.
- The store keeps nothing but rooms. Images are still to come.

**How to try it:** Run `npm test` (`server/codes.test.ts` and `server/roomStore.test.ts`). There is no UI or endpoint yet.

## F03 — Landing page and route shell (2026-10-27)
**What changed:**
- Tailwind v4 through `@tailwindcss/vite`. `client/src/index.css` holds the theme in `@theme`: `bg`, `surface`, `edge`, `ink`, `muted`, one `accent` (#ffc400) with `accent-ink`, and a `font-display` stack. Use them as `bg-surface`, `text-accent`, `font-display` and so on.
- React Router 8 (`react-router`, declarative `<Routes>`). `App.tsx` exports `AppRoutes` (the route table, mountable in a `MemoryRouter`) and `App` (wraps it in `BrowserRouter`). The routes are `/`, `/play/:code`, `/screen/:code`, `/host/:code`, `/sets`, `/sets/:setId` and a `*` "Page not found". All but `/` render `pages/Placeholder.tsx`.
- `pages/Landing.tsx`: **Join a game** with a code input, **Host a game** and a **My question sets** link to `/sets`. The input runs every change through `normalizeRoomCode`. Join is disabled until `isCompleteRoomCode`, and submitting navigates to `/play/<CODE>`.
- `lib/roomCode.ts`: `normalizeRoomCode` (upper case, room-code alphabet only, at most 4) and `isCompleteRoomCode` (uses the shared `roomCodeSchema`). There are 22 new tests, 56 in total.

**Dependencies:**
- `react-router` (runtime): the spec's stack names React Router.
- `tailwindcss` and `@tailwindcss/vite` (dev): the spec's stack names Tailwind CSS; the Vite plugin is Tailwind v4's build integration.

**Decisions:** DECISIONS rows dated 2026-10-27 for F03 cover the theme tokens living in CSS, the inert **Host a game** button, the input dropping characters outside the alphabet, and the catch-all route.

**Notes for next session:**
- Import router APIs from `react-router` (v8 has no `react-router-dom`).
- To test a page that navigates, mount it in a `MemoryRouter` with a `*` route that prints `useLocation().pathname`. `Landing.test.tsx` shows the pattern.
- `client/src/lib/roomCode.ts` imports `shared/schemas`, so zod ships in the client bundle (about 346 kB JS before gzip in total).
- **Host a game** has a `TODO(F08)` and no handler.
- The playtester's Playwright MCP writes `.playwright-mcp/`. It is now in `.gitignore` and `.prettierignore`.

**How to try it:** Run `npm run dev`, then open http://localhost:5173 on a phone (`http://<LAN-IP>:5173`) or a 375 px-wide browser window. Type `ab1cd` into the code box: it shows `ABCD`. Tap **Join** to land on `/play/ABCD`. **My question sets** opens `/sets`.

## F02 — Shared types, schemas and constants (2026-10-27)
**What changed:**
- `shared/types.ts` has every Data model type, plus:
  - `Role`, `BuzzGap`, `RankedPlayer` and `ScreenQuestion`.
  - `ScreenView`, `HostView` and `PlayerView`, each tagged by `role`, and their union `View`.
  - `Ack<T>` and `Fx`.
  - `ClientPayloads` and the typed Socket.IO maps `ClientToServerEvents` and `ServerToClientEvents`.
  - `CreateRoomBody` and `CreateRoomResponse`.
- `shared/schemas.ts` has:
  - `questionSetSchema` and `createRoomBodySchema`.
  - `clientPayloadSchemas`, one schema per client→server event. It uses `satisfies` over `ClientEvent`, so a missing event fails typecheck.
  - The building blocks `idSchema`, `roomCodeSchema`, `hostTokenSchema` and `playerNameSchema`.
  - `SchemaTypeChecks`, a compile-time assertion that the schemas and `types.ts` agree in both directions.
- `shared/constants.ts` has:
  - `PLAYER_PALETTE` (12 colours), `ROOM_CODE_ALPHABET` and `DEFAULT_SETTINGS`.
  - Every spec limit, plus those from DECISIONS #3, #11 and #12: sizes, timings and rate limits as `{max, windowMs}`.
- There are 34 tests, 30 of them new across `schemas.test.ts` and `constants.test.ts`.

**Dependencies:** `zod` 4 (runtime). The spec's stack names it for payload validation.

**Decisions:** DECISIONS rows dated 2026-10-27 for F02 cover:
- Open questions 11 and 13, now resolved.
- Ranges for points, score deltas, `scoreboardEvery` and ids.
- The schema validating only a *playable* set.
- Trimming and upper-casing room codes.
- Rejecting invisible characters in names.
- Strict versus stripping object schemas.
- First-cut view shapes and binary byte units.

Open questions 2, 3 and 12 now note which part F02 adopted.

**Notes for next session:**
- Zod 4 API: use `z.int()`, `z.strictObject()` and `z.string().toUpperCase()`. Schemas output trimmed or upper-cased strings, so handlers should use the parsed value, not the raw payload.
- A client that emits `player:buzz` with only an ack callback sends no payload. `emptySchema` rejects `undefined`. The socket handler should default a missing payload to `{}` before parsing.
- The view fields are a first cut. Extend them in `types.ts` when `toView` lands (for example, undo availability). Keep answers and notes out of Screen and Player views.
- `shared/constants.ts` imports `RoomSettings` from `types.ts` as a type only. There is no runtime cycle.

**How to try it:** Run `npm test` and `npm run typecheck`. There is no UI.

## F01 — Project skeleton and tooling (2026-10-27)
**What changed:**
- One ESM `package.json` with `dev`, `build`, `start`, `test`, `typecheck`, `lint`, `format`, `format:check`. The `dev` script runs `concurrently` with `tsx watch server/index.ts` (:3000) and `vite` (:5173, `0.0.0.0`). Vite proxies `/api`, `/healthz` and `/socket.io` (ws).
- `server/http.ts` has `createApp({clientDir?})`, with `GET /healthz` returning `{ok:true}` and an SPA fallback. `server/sockets.ts` attaches Socket.IO with websocket only and no handlers yet. `server/index.ts` wires them together.
- `client/` is a Vite root holding `index.html`, `src/main.tsx` and `src/App.tsx` (an H1 placeholder that F03 replaces). `shared/constants.ts` holds `APP_NAME` and `DEFAULT_PORT`.
- There are 4 tests: `/healthz`, the SPA fallback (which never swallows `/api` or `/socket.io`), App rendering under jsdom, and the shared constants.

**Dependencies:**
- Runtime: express, socket.io, react and react-dom, all from the spec's stack.
- Dev:
  - tsx runs the TypeScript server with watch.
  - concurrently gives one `npm run dev` command.
  - vitest, jsdom and @testing-library/react run the tests, with jsdom and Testing Library covering the client test.
  - eslint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, globals and eslint-config-prettier handle lint.
  - prettier, typescript, vite, @vitejs/plugin-react and @types/* make up the rest of the toolchain.

**Decisions:** DECISIONS rows dated 2026-10-27 for F01 cover open question 15 (resolved), the tsconfig split and `.js` imports, prod-only static serving with the fallback, the websocket-only server, Prettier ignoring `docs/` and `.claude/`, and no supertest with `@types/node@24`.

**Notes for next session:**
- `client/src` imports shared code as `../../shared/x.js`. Server and shared files also use `.js` extensions, which NodeNext requires.
- Vitest runs in the node environment by default. Client tests start with `// @vitest-environment jsdom` and use `afterEach(cleanup)`.
- On `npm run dev`, Vite may log one `http proxy error: /healthz ECONNREFUSED` if something probes it before the server is listening. That is harmless.
- npm 12 blocks esbuild's postinstall script. tsx and Vite work without it.

**How to try it:**
- Run `npm run dev`, then open http://localhost:5173 to see the "Buzzr" heading. `curl localhost:5173/healthz` returns `{"ok":true}`. Phones can use `http://<LAN-IP>:5173`.
- Run `npm run build && npm start`, then open http://localhost:3000 and http://localhost:3000/play/ABCD. Both show the app.
