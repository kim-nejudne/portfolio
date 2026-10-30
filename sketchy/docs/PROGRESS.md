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

- [ ] F07: on the laptop plugged into the TV, open `/`, tap **Start**, join two phones by typing the code at `/` (the phone page itself is F08, so join from Node or wait for F08), Start a game · from the sofa (≈ 5 m) the code, timer, blanks, names and the revealed word are readable, and the drawing square fills the TV's height

- [ ] F08: on an iPhone (Safari) and a budget Android (Chrome), join a game with `npm run dev` + `npm run lan`, start with 3 players, and on the drawer's phone: pinch, double-tap and drag down from the top of the pad while drawing · the page never zooms, scrolls or pull-to-refreshes, a second finger or palm leaves no line, and the pad, word bar and both toolbar rows fit with nothing cut off
- [ ] F08: on a guesser's phone, type a wrong guess and tap ➤, then lock the phone for 10 s, unlock, and pull down to refresh · the keyboard stays up after ➤ and the box stays above it; after unlocking and after the refresh the phone comes back to the same game as the same player (no name step, same points)
- [ ] F09 (M1 acceptance): `npm run dev`, then `npm run lan CODE` after starting a game on the laptop (Screen on the TV); join from 3 real phones on the same Wi-Fi, Start, and play a full cycle (each phone draws once; guess each other's drawings) · every player gets exactly one drawing turn, each stroke appears live on the TV within a blink, correct guesses show ✓ and points on the Screen and the guesser's phone, and the game ends at Final scores. Then open `http://<laptop>:5173/dev/bots/CODE` in a laptop tab before Start, spawn 2 bots and play again · bots join, guess random words in the feed, and draw the house doodle on their turn

<!-- entries below, newest first -->

## F09 — Dev tool: fake players (2026-10-30)
**What changed:**
- `server/http.ts`: dev-only `GET /api/dev/rooms/:code/word` → `{turnId, word}` (`DevWordResponse` in `shared/types.ts`), registered only with `createApp({dev: true})`. `server/env.ts` `devToolsEnabled(NODE_ENV)` is true only for `development`, which `npm run dev` now sets on the server command; unset, `production` or anything else → 404 (fails closed).
- `client/src/dev/bots.ts`: `createBot` is a real player socket (`player:join` with fixed key `sketchy-dev-bot-0000k`, name "Bot k", rejoins on reconnect, 5 s ack timeout with retry). It opens `/ink` only after the join. It auto-guesses decoy Tagalog words every 3–8 s while it may guess. `guessRight()` fetches the dev word and drops it if the turn moved on; the panel never shows the word. `draw()` plays the scripted doodle through `inkSender`: one step per 20 ms, held while paused, stopped when the turn ends, auto once per turn when drawing. `leave()` = `player:leave` + close both sockets. `client/src/dev/doodle.ts`: a house, door and sun as pen steps ≤ 24 grid units. `client/src/dev/fakeSocket.ts`: a test double, adapted from Buzzr.
- `client/src/pages/DevBots.tsx` at `/dev/bots/:code`, registered in `App.tsx` only when `import.meta.env.DEV` (lazy chunk). Spawn N (1–10), Remove all, toggles "Guess random words by themselves" / "Draw the doodle on their turn" (both on), "Everyone: random guess" / "Everyone: guess right". Per bot: status, role, last message, and Guess / Guess right / Draw. No new dependencies.

**Decisions:** DECISIONS 31–32. The dev endpoint is opt-in on `NODE_ENV=development`, stricter than the roadmap's `!== 'production'`: both reviewers flagged that as failing open. Bots: fixed keys, decoy words, the doodle script, no pings and no word choosing. Reviews:
- spec-checker: PASS WITH FIXES. Applied: the M1 Kim check, DECISIONS rows, and the production-bundle grep as evidence.
- secrets-fairness: PASS WITH FIXES. No leak paths. Applied: fail-closed gate with a test, and a comment on the LAN trade-off.
- mobile-ux: PASS WITH FIXES. Same gate finding; the join budget is unaffected.

**Notes for next session:**
- F44's join rate limit must leave room for up to 9 bots from one address (the Vite proxy makes them all localhost).
- F18: bots don't choose words. If CHOOSING waits on the drawer, a bot drawer relies on the 12 s auto-pick, or add `drawer:choose` to the bot then.
- F13: bots don't send `ping`. If fairness needs RTT samples to accept guesses, add pings to the bot as Buzzr's did.
- F51: the Dockerfile should set `NODE_ENV=production` for the client anyway; the dev endpoint stays off without it.
- In production, `/dev/bots/CODE` falls back to `index.html` and matches no route (blank page), as other unknown paths do until a 404 page exists.

**How to try it:** `npm run dev`, open http://localhost:5173 on the laptop and tap **Start**, then open http://localhost:5173/dev/bots/CODE in another tab. Spawn 3 and press Start on the Screen. Bot 1 draws the house on the Screen and the others guess random words. Press "Everyone: guess right" to end the turn. Automated: `npm run playtest -- .playtest/F09/scenario.ts` (gitignored; 6 steps). It creates a room, checks the dev endpoint (404 unknown, null in the lobby), spawns 3 bots that appear in the lobby, and starts the game. It then checks that the bot's doodle reaches the Screen canvas and the word is not in the Screen DOM before the reveal. Finally, guess right gives "✓ got it" and the reveal shows points for both guessers and the drawer. Production: `npm run build`, then `grep -r api/dev dist/client` finds nothing, and `/api/dev/...` answers 404 with `NODE_ENV` set to production or unset. Unit: `server/http.dev.test.ts`, `server/env.test.ts`, `client/src/dev/{bots,doodle}.test.ts`, `client/src/pages/DevBots.test.tsx`.

## F08 — Player page v0 (2026-10-30)
**What changed:**
- `pages/Play.tsx` at `/play/:code`: the name step (`JoinForm`), then the latest `state`. `{playerKey, name}` is kept per room in `localStorage` (`lib/playerIdentity.ts`, `sketchy:player:<CODE>`, key from `crypto.getRandomValues`, no nanoid), so every connect (a refresh, a re-scan, a dropped socket) re-sends `player:join` silently (5 s ack timeout, retried while connected). `lib/phone.ts` `joinOutcome` maps the answer: in; `roomNotFound` → "This game has ended"; `kicked` → "You were removed from this game"; `nameTaken`/`nameOfDisconnected`/`roomFull`/other → back to the name step with a message. A malformed code ends at once. The `/ink` socket (`auth: {code, playerKey}`) opens only after a successful join and is closed on any refusal, kick, `room:closed` or Leave. `fx yourTurn` vibrates 200 ms.
- `PhoneLobby`: "You're in, Jun!", their colour, "Waiting for 👑 Mika to start" (the crown holder reads "You have the 👑. Start the game on the Screen…"), Who's here with "(you)", two-tap Leave (`LeaveButton`, 4 s to confirm).
- Drawer (`DrawerTurn` + `DrawPad`): 56 px bar with the word at 16 px, `◔ m:ss`, "1 of 2 got it" and the latest wrong guess ("Ana: payong", `•••` when masked); the square pad sized by `drawerPadSize` = min(w − 8, h − 56 − 96 − 16) from the safe-area box; two 48 px rows (the selected black-pen swatch, "Colours, sizes, eraser and undo are coming soon"). Pad: Pointer Events, first pointer only (`createPointerGate`) with capture, `pointercancel`/`lostpointercapture` end the stroke, coalesced points behind a feature check, rect read once per stroke, one `inkSender` per `turnId` (flush on `visibilitychange`/`pagehide`, end + dispose on unmount), local strokes drawn with the Screen's `drawStroke`, backing store `side × DPR` ≤ 2048, a pause ends the stroke in hand. `useDrawLock`: body `position: fixed; inset: 0; overflow: hidden`, viewport meta swapped to `maximum-scale=1, user-scalable=no` and restored, `gesturestart`/`gesturechange` and multi-touch `touchmove` cancelled.
- Guesser (`GuesserTurn`): clock and "✏️ Mika drawing" (or "Mika is choosing a word…"), blanks with `(5, 4)` and an `img` label "8 letters to guess", the guess box near the top (`autocomplete`/`autocorrect`/`autocapitalize` off, `spellcheck=false`, `enterkeyhint=send`, keeps focus after each send), own misses "zzzz ✗", "✓ You got it! +N" without the word, "👀 Watch the Screen", "+N this turn". `PhoneStandings`: REVEAL "It was…" + word + "+N this turn" (drawer: "+N for your drawing" when > 0), SCOREBOARD "#2 of 4" + points, FINAL "You finished #1 of 3", points, "See the gallery on the Screen". Paused overlay; "Reconnecting…" badge at the bottom. Phone strings added to `lib/copy.ts`. No new dependencies.

**Decisions:** DECISIONS 29–30 (join answers and identity storage; drawer/guesser v0 scope: black pen, reserved toolbar rows, no Change name, own misses from the `wrong` fx, ink not buffered while `/ink` is down). Reviews: spec-checker PASS WITH FIXES (added `joinOutcome`/pointer-gate unit tests and render tests, Kim checks, DECISIONS); secrets-fairness PASS WITH FIXES (no leaks; applied: close and rebuild the `/ink` socket on refusal/kick/end/leave, drop batches while `/ink` is down); mobile-ux PASS WITH FIXES (applied: badge off the drawer's clock, armed Leave and placeholder contrast, blanks `role="img"` label via copy, `mousedown` focus guard, DrawerTurn stays mounted for all of DRAWING, a pause ends the stroke, rect cached per stroke).

**Notes for next session:**
- F09: fake players can join through the same `player:join`; `inkSender` has no DOM dependency for a bot drawer.
- F12: a drawer who refreshes mid-turn gets a blank pad and a new sender with `seq` from 1; the drawer's own `ink:snapshot` should refill `DrawPad` (it keeps its strokes in a local list per `turnId`). `sendInk` drops batches while `/ink` is disconnected; resend them from kept batches.
- F15: `lastGuess.text === null` shows `•••`; misses on the phone come from the local `wrong` fx queue (oldest unanswered guess) until `me.guesses` exists; replace them then.
- F18: the drawer's CHOOSING shows "Your turn to draw! Get ready…"; put the three word cards there (`view.secret.choices`). F21: the upcoming drawer's cards during REVEAL go in `PhoneStandings`.
- F25: the crown holder's lobby is the plain lobby plus one line; build the host lobby there. F26/F27: Change name and the doodle pad go in `PhoneLobby`. F42: `nameOfDisconnected` currently reads as a taken name (`joinOutcome`).
- F32: the two toolbar rows are placeholders sized by `DRAWER_TOOL_ROW_PX`; swatches must become ≥ 44 px hit areas; colour/size go through `DrawPad`'s `PEN_COLOR`/`DEFAULT_INK_SIZE`. Wake Lock and "Turn your phone upright" too (F32/F37).
- `Play` is in the main chunk (104 KB gz with Landing and socket.io-client); F39 measures the join budget.

**How to try it:** `npm run dev`, open http://localhost:5173 on a laptop and tap **Start**; on phones on the same Wi-Fi run `npm run lan CODE` for the join URL (or type the code at `/`). Automated: `npm run playtest -- .playtest/F08/scenario.ts` (gitignored; a TV Screen plus phones at 360×560, 390×664 and 412×780, all real pages, 10 steps): join via `/` and the name step; taken name refused; two-tap Leave clears the identity; refresh rejoins without the name step; Start → drawer word at 16 px, `touch-action: none`, body fixed, viewport locked, guessers see timer/blanks and no word in their DOM; the pad equals the formula with no scroll or overflow at all three sizes; a stroke reaches the Screen's canvas and the pad; wrong guess "zzzz ✗" with focus kept and shown on the drawer's bar; right guess "✓ You got it! +N" with no word, kept across a refresh; REVEAL on all phones with "+N for your drawing"; three turns to FINAL with "You finished #n of 3"; unknown and malformed codes end. Unit: `client/src/lib/{phone,playerIdentity}.test.ts`, `client/src/components/phone/phoneViews.test.tsx`.

## F07 — Screen page v0 (2026-10-30)
**What changed:**
- `pages/Landing.tsx`: **Join a game** (code auto-uppercased to the code alphabet, 4 letters, `GET /api/rooms/:code/exists`, then `/play/:code`; "No game with that code" / "That game is full") and **Start a game on this screen** (`POST /api/rooms`, token saved, opens `/screen/:code`). `lib/api.ts`, `lib/hostTokens.ts` (`sketchy:hostToken:<CODE>`), `lib/socket.ts` (WebSocket-only main and `/ink` sockets, `autoConnect: false`), all ported from Buzzr; no zod in the client.
- `pages/Screen.tsx` (lazy chunk, 18 KB gz): `screen:join` with the stored token on every connect (5 s ack timeout, retry; a refused token is forgotten and the Screen rejoins plain; unknown/malformed code or `room:closed` → "This game has ended"). `/ink`: `ink:hello {code}` on every connect, `ink:turn` clears, `ink:batch` appends. Landscape only: `ScreenLobby` (Join at host, big code, `/play/CODE` URL, chips with initial avatars and 👑, "👑 Mika is hosting" + Start with the token, "Waiting for 👑 Mika to start" without, "Need 2 players" / "Better with 3+", settings summary), `ScreenTurn` (square `InkCanvas` left, sidebar with ticking `◔ m:ss` timer (orange in the last 10 s), blanks with `(5, 4)`, Round/Turn, "✏️ Mika is drawing", players in order with ✏️/✓/+points, last 4 feed lines; CHOOSING overlay "Mika is choosing a word…"; REVEAL: "It was…", the word ≥ 12 vh, Got it chips in order with points, Almost, "+N for Mika's drawing" only when > 0, "Nobody got it!"), `ScreenStandings` (SCOREBOARD "Round n of N done" and FINAL "Final scores" with medals and shared ranks). Footer strip `host · CODE` always.
- `lib/ink.ts`: v0 action stack (`createInkPicture`, `applyInkOps`, `visibleStrokes`), `createScreenInk` (turn tracking), and the shared `drawStroke` (round caps/joins, quadratic curves through midpoints, incremental from a point index) + `redrawPicture`. `components/screen/InkCanvas.tsx`: largest square in its box, backing store `side × DPR` ≤ 2048, repaint on resize, new points drawn on the next frame.
- `lib/screen.ts` (`wordLengths`, `formatClock`, `rankPlayers`), `lib/useCountdown.ts`, `lib/copy.ts` (English table + `translator`), theme in `index.css` (`--font-display` rounded system stack). No new dependencies.

**Decisions:** DECISIONS 25–28 (client-side display ranks; v0 ink stack and turn tracking on the Screen; join/token/ended handling, copy table, no font yet; two columns above six players, REVEAL word fit, blanks floor, reconnecting badge). Reviews: spec-checker and secrets-fairness passed with fixes (applied: any join refusal ends the page, a mangled token falls back, join ack timeout, F12 note); mobile-ux found clipping at 10 players (fixed and covered by `layout.ts`), plus safe areas, `overscroll-behavior: none`, `touch-action: manipulation`, `theme-color`, a double-tap guard on Start, and contrast tweaks.

**Notes for next session:**
- F08: reuse `lib/api.ts` (`roomExists`), `lib/socket.ts` (`createSocket`, `createInkSocket({code, playerKey})`), `lib/copy.ts` (add phone strings to `EN`), `lib/useCountdown.ts` and `lib/screen.ts` (`wordLengths`, `formatClock`) for the guesser's timer and blanks. `drawStroke` in `lib/ink.ts` is the one renderer for the drawer's pad too (keep a local `InkStroke` per stroke and call it with `fromPoint`).
- F11: replace the picture/action stack in `lib/ink.ts` with `shared/ink.ts`; keep `drawStroke`, `redrawPicture` and `createScreenInk`'s turn rule.
- F12: a Screen loaded mid-turn only shows strokes begun after it joined; snapshots fix it. No `seq` checks on the Screen yet.
- F20 rematch: `createScreenInk` assumes turn ids only grow (they do: `turnCounter` survives games); keep it that way.
- F33: portrait layout; the sidebar is `min-w-[28vw] flex-1` beside an `aspect-square h-full max-w-[72vw]` box. F34: "Jun got it!" banner, bubbles. F35: reveal pop and Next line. F37: QR (leave room right of the code), tap-to-start, wake lock, connection dot. F39: self-hosted font. F24: the control bar; the lobby's Start is the only host control so far.
- The feed is shown raw as the server sends it (unmasked until F15), so don't play a real game on v0.
- The canvas square is the main area's height minus 2vmin padding and the footer strip (≈ 985 of 1080 px); F33 may tighten it. CHOOSING shows "Mika is choosing a word…" over the canvas with the sidebar clock; the spec's countdown ring is for F21/F33.

**How to try it:** `npm run dev`, open http://localhost:5173 on a laptop, **Start** → lobby at `/screen/CODE`. Players: until F08 the phone page is a placeholder, so run the playtest: `npm run playtest -- .playtest/F07/scenario.ts` (gitignored; Screen in Chromium at 1920×1080 plus a tablet Screen at 1180×820, three Node socket players, the drawer sending a stroke over `/ink`). It checks, in 9 steps: Start → `/screen/:code` with the token stored; lobby code, URL, chips, host line, Start disabled below 2; a tokenless Screen (with a stale token) shows "Waiting for 👑 Mika to start" and no Start; Drawing timer ticks, blanks count, the word is nowhere in either Screen's DOM; ink appears on both canvases; ✓ +points and a wrong guess; Reveal word, Got it, drawer line, drawing kept; next turn clears the canvas, "Nobody got it!", Final ranking with 🥇; unknown and malformed codes → "This game has ended". `npm run playtest -- .playtest/F07/layout.ts` checks the landing page fits 360×560 with no scroll, the lobby's Start stays on screen at 740×360, and with 10 players nothing is clipped in the lobby, the drawing sidebar (TV and 1180×820 tablet) or the Final ranking. Unit tests: `client/src/lib/{ink,screen,copy}.test.ts`.

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
