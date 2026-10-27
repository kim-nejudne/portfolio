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
