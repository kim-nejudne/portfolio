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

- [ ] F09: open https://pinpoint.kimnejudne.dev/ on a laptop (≥ 768 px wide) and on a phone · the two cards **Join a game** and **Show a game on this screen** read as equal weight (side by side on the laptop, stacked on the phone, no sideways scroll); press **Show** on the laptop and click the overlay · the TV-style lobby fills the window letterboxed, the browser goes fullscreen (not on iPhone) and the laptop does not dim or sleep while the lobby is open
- [ ] F10: with a game showing on the laptop (https://pinpoint.kimnejudne.dev, **Show**, click the overlay), join from two real phones: phone A scans the lobby QR, phone B opens https://pinpoint.kimnejudne.dev/ and types the code · each phone reaches its lobby ("Waiting for ★ … to start", or "You're the VIP ★" for the first) in under 15 s from opening the camera or browser; on phone B the first phone's emoji is greyed out; pull-to-refresh on either phone rejoins straight to the lobby without the form; both tiles appear on the TV
- [ ] F12: with a game showing on the laptop (https://pinpoint.kimnejudne.dev, **Show**, click the overlay), join from a real phone (iPhone Safari and an Android Chrome if you have both). In the lobby, pinch and pan the practice map under the amber crosshair, try + and −, then tap **Lock in** · the map moves smoothly with no page zoom, text selection or long-press menu, the crosshair stays at the centre, the attribution "© OpenStreetMap contributors © CARTO" is readable in the bottom-right corner, the phone shows "N km from 0°, 0°" (about 0 km when aimed at the Gulf of Guinea) with **Try again** for 3 s, and that player's tile wiggles on the TV; locking in again within 2 s shows "Slow down"
- [ ] F13: with a game showing on the laptop (https://pinpoint.kimnejudne.dev, **Show**, click the overlay), join from a real phone (about 360 px wide) as the first player · the settings card sits above the practice map, readable without zooming: category cards with emoji, name and "Easy n · Medium n · Hard n", the Mode, Difficulty, Rounds and Timer rows each fit on one line with 48 px buttons, and Start ▶ is full width and enabled; tap Hard, 15 rounds and 45 s · the laptop's row under the tiles reads "<CATEGORY> · NAME · HARD · 15 ROUNDS · 45 S" at once; any greyed option still shows its label and the reason under it; close the laptop tab, press **Show** again for a new room and join it from the same phone · the new room starts with Hard, 15 rounds and 45 s. Once there are more than 8 categories, type in the search box with the keyboard up · the cards filter and the page does not jump
- [ ] F18: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones, start a 5-round World game and let each round run out (phones have no guessing UI until F19, so everyone scores at the region centre) · Intro reads "ROUND 1/5 · NOW BOARDING" (round 4 adds "×1.5 BONUS ROUND", round 5 "×2 FINAL ROUND"); Guessing shows the city in amber flaps, the timer counting down and turning red with "FINAL CALL" for the last 5 s; Reveal shows the name and fact on top, the real CARTO map on the left fitted around the pins and the amber target (not over-zoomed for a close guess), coloured lines and rail rows ticking in; the scoreboard and "FINAL STANDINGS" rows are readable from across the room at 1280 × 720 and 1920 × 1080
- [ ] F19: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones and start a 5-round Name game (a regional category, not World) · during the intro each phone shows "Round 1 of 5" over a map of the region that does not move when dragged; in guessing the city name and timer sit in the top bar, the map pans and pinches under the crosshair and stops hard a little past the region's edges; Lock in on one phone shows the "Boarding · Locked in" card with the timer, the other phone's emoji under "Still guessing" and a small map with your pin at the zoom you locked at; at the reveal each phone stays face down and flips to its result (distance, points, multiplier on rounds 4–5, total, CLOSEST/BULLSEYE when earned) only when the TV's rail reaches that player; the scoreboard adds the rank and "Next: Round N of 5"; the final shows your place and points. Join a third phone mid-game · it shows "Next departure"
- [ ] F20: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones and start a 5-round Name game. Mid-guess, close the laptop's tab · after about 3 s both phones' maps are covered by "Waiting for the Screen…", the timer stops and Lock in can't be pressed, and the ★ top bar stays visible above the cover. Reopen the Screen (**Show** with the same code, click the overlay) · the cover gives way to a big 3-2-1 on the phones, then the timer continues from where it stopped and Lock in works. (The VIP's Pause button arrives with F21; repeat then for the TV banner "Delayed · the VIP paused the game" along the bottom and the red "Delayed" gate label.)
- [ ] F21: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones and start a 5-round Name game. On the VIP's phone tap ★ in each of INTRO, GUESSING, REVEAL and SCOREBOARD · the drawer slides up from the bottom only when ★ is tapped, never by itself; it shows Pause, Skip round and End game (plus Next in REVEAL and SCOREBOARD; no Skip on the scoreboard); a tap outside it closes it. Tap Skip round once and wait 3 s · it reads "Tap again to skip" ("Tap again to void this round" in REVEAL), then goes back to "Skip round". Tap it twice · a new place appears with the same round number on the TV. Pause from the drawer · the TV shows the red "Delayed" banner. Tap End game twice · both phones and the TV go to the final; ending in round 1's intro shows "No rounds played"
- [ ] F22: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from three real phones (A first, so A is VIP, then B and C) and start a 5-round game. On phone A during guessing tap ★, then **Kick** next to C, then **Tap again to kick** · C's phone shows "You were removed from this game" with **Back to Pinpoint**, pull-to-refresh on C shows it again, C's tile leaves the TV, and if A and B had locked in the reveal starts within a second or two. Then on phone A tap ⋯ → **Leave game** · within a second B shows the amber-bordered toast "You're the VIP now ★" at the top for about 3 s, B's top bar gains the ★ button, and the ★ badge sits on B's row of the TV standings board
- [ ] F25: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones (A first, the VIP, then B) and start a 5-round Name game. In round 1's guessing, pan B's map somewhere, then pull-to-refresh B · B comes back to the guessing map with the crosshair where it was and Lock in still works. Lock in on A, then refresh A · A shows the "Boarding · Locked in" card and keeps the ★. Refresh the laptop tab (click the overlay again) · the TV returns to the same round and timer, both tiles on it. In round 2 lock B's screen and leave it in a pocket for 20 s, then unlock · B reconnects to the current view; while away B's TV tile was greyed, and if B missed round 2 the reveal rail shows "—" for B and the scoreboard keeps B's row greyed with B's total. Finally restart the app on the droplet (or wait 3 h) and refresh each device · TV and both phones show "This game has ended" with a link home
- [ ] F26: on a laptop run `npm run dev`, open http://localhost:5180, **Show**, click the overlay; join from one phone on the same Wi-Fi (or a second browser window) as the VIP, then open http://localhost:5180/dev/bots/<CODE>?count=4 in another tab · the tab shows `{"code":…,"bots":["Bot 1",…,"Bot 4"]}` and four bot tiles appear on the TV; start a 5-round game · in every round the bots' tiles show LOCKED IN at scattered moments before the timer, their pins land inside the category's region at the reveal, and the game runs to the final standings with you as the only human
- [ ] F28: on the laptop run `npm run dev`, open http://localhost:5180, **Show**, click the overlay, and fill the TV view on a real TV; join from two real phones, add bots with http://localhost:5180/dev/bots/CODE?count=6, play a 5-round game to the end · on the TV the podium rises 3rd, 2nd, 1st in about 3 s, the passes fill a 4-wide grid from 5 s and the award cards follow from 8 s, one every 2.5 s, all readable from across the room and nothing under the join strip; each phone shows its own pass (colour stripe, "1st of 8", points, best round, "Avg … km") and only its own awards; refreshing the TV mid-finale replays the staging (DECISIONS 36) and still looks right

<!-- entries below, newest first -->

## F29 — Category store writes and publish rules (2026-11-07)
**What changed:**
- `server/categoryStore.ts`: `CategoryStore` gains admin writes: `list`, `find`, `create` (slug id, made unique with `-2`), `saveDraftLevel` (for generation), `updateMeta`, `editPlace`, `removePlace`, `setReviewed`, `publish`, `setHidden`, `setEmoji` and `remove`.
  - Changes run one at a time through a queue. Each one writes `categories.json` (temp file, flushed, then renamed; schema-checked first) before it takes effect.
  - Each change replaces the category with a new object, so a running game's read never changes.
  - Refusals throw `CategoryStoreError` with an HTTP `status` (404, 400 or 409) for the admin routes (F32–F34).
  - Rules:
    - Save box refuses `S < 150` km (`MIN_SCALE_KM` in `shared/constants.ts`).
    - A live category's meta goes into `draftMeta`.
    - A label-style change rewrites only `autoDisplayName` cities (`autoDisplayName()` is exported for Locate).
    - Edits to a level with no draft fork it from live.
    - A moved pin must stay in the box and becomes `coordsSource: 'admin'`.
- `publishProblems(c)` lists why Publish would refuse; F33's button can use it. Publish refuses while:
  - a draft level is unreviewed;
  - a place that would be live lies outside the draft box or has no coordinates;
  - a landmark has no photo;
  - there is nothing to publish.

  It makes every draft live at once and returns the level count.
- `cleanUpPhotos` runs at start when the file loaded with at least one category. It logs "Photos: deleting N unreferenced file(s)", then deletes `photos/*.webp` files no live or draft place names.
- The dev fixture is never written: admin writes in development save a file without it.

**Decisions:** DECISIONS 37 (queue and atomic write, error statuses, draft forking, meta into `draftMeta`, auto display name form and its 40-character fallback, create's unchecked box, slug ids, the fixture, the clean-up scope).

**New dependencies:** none.

**Tests:** `npx vitest run server/categoryStore.test.ts` (25 tests). They cover:
- the atomic write (no temp left; a failed rename changes nothing in memory and the queue goes on) and concurrent changes in order;
- unique slugs;
- a box at 144.6 km refused, and one of 150 km or more taken;
- `draftMeta` until Publish;
- the label-style rewrite only for automatic city names, with live-only levels following on Publish, and the 40-character fallback;
- edits forking the draft;
- the pin outside the box refused;
- landmark photo and name;
- remove and reviewed;
- each publish gate, and all drafts published at once;
- hide, show, emoji and delete;
- a game snapshot (`snapshotPool` and the read object) unchanged by edit, meta, publish and hide while the next read sees the change;
- the fixture never written;
- photo clean-up deleting 2 orphans after the log line, and deleting nothing for a missing, empty, unparsable or invalid file.

**Playtest:** none (no UI; F32–F34 add the admin pages and routes).

**Notes for next session:** the admin HTTP routes map `CategoryStoreError.status` straight to the response with `{error: message}`; anything else is a 500. `create` does not check the 150 km rule (DECISIONS 37); the generation pipeline should clamp or refuse a tiny writer box.

## F28 — Finale on the Screen and phones (2026-11-07)
**What changed:**
- `server/views.ts`: `finalView` builds the finale in FINAL with at least one played round, from `game.played` only. It has the podium (held ranks 1–3, tied players on one step), a pass per player in standings order (`rank`, `total`, plus F27's `passStats`) and `travelAwards`. The ScreenView carries it as `final`. The PlayerView gets a new `final: {pass, awards}` with only the viewer's own pass and the awards they share in. Zero rounds gives `final: null` ("No rounds played").
- `shared/types.ts`: `FinalPass` (`bestRound` string, `avgKm`), `Award` and `AwardId` (moved from `shared/awards.ts`, which re-exports them) and `FinalView`. The unused draft `AwardKind` and `creditsUrl` are gone; F50 adds the credits line.
- `client/src/components/ScreenFinale.tsx` (new): stages the podium (2nd · 1st · 3rd; 3rd at 0.6 s, 2nd at 1.8 s, 1st at 3.0 s), the passes in a 4-wide grid from 5.0 s, 150 ms apart, and the award cards (static flap title, winners, stat) from 8.0 s, one per 2.5 s. Everything then stays. Timing runs from the moment the Screen shows FINAL, and a mid-finale view change keeps it. `.finale-in` rises in over 600 ms; reduced motion gives a 150 ms fade. The awards list is `aria-live`.
- `client/src/pages/Screen.tsx` routes FINAL to `ScreenFinale`; `ScreenStandings` is now SCOREBOARD-only. The rematch 3-2-1 still sits over the finale.
- `client/src/components/PlayGame.tsx`: the phone's FINAL card is the player's pass (emoji, name, colour stripe, "1st of 4", points, best round, "Avg … km") plus "Your travel awards".

**Decisions:** DECISIONS 36 covers:
- staging from the Screen's own arrival in FINAL, so a refresh replays it;
- held ranks only on the podium, and a 4+ tie on one step clipping;
- the short place `name` in passes and awards;
- the PlayerView `final` field;
- the deferrals: fanfare F56, credits line F50, BoardingPass and flaps F53/F54.

**New dependencies:** none.

**Tests:** `npx vitest run server/views.test.ts client/src/pages/Screen.test.tsx client/src/pages/Play.test.tsx`
- `views.test.ts`, "finale views" (4 players, 5 rounds):
  - podium `[1: P1]`, `[2: P2, P3]` with no 3rd step;
  - passes in rank order, and the best round "Round 5 · Testville · 2,000" from the ×2 round;
  - awards Pilot "5 bullseyes", Lost Luggage, and a shared Frequent Flyer;
  - no coordinates, Wikidata id, country or fact in any finale JSON;
  - each phone gets its own pass and only its awards;
  - zero rounds gives `final` null on both views.
- The leak test now also asserts `final` is null and that `awards`, `bestRound` and `avgKm` are absent before FINAL. The 2-player standings test checks two steps and no awards.
- `Screen.test.tsx`, "Screen finale" (fake timers):
  - every stage boundary at 1 ms (1799/1800 and so on);
  - the shared 2nd step;
  - passes 150 ms apart and awards 2.5 s apart, all still shown after 60 s;
  - the 2-player podium (two steps, no awards column) and the 3rd step at 0.6 s;
  - a player joining mid-finale doesn't restart the clock;
  - "No rounds played";
  - the rematch 3-2-1 over the finale.
- `Play.test.tsx`: the phone's pass text, its colour stripe and its awards; no awards section without awards.

**Playtest** (Mika as VIP, bots, the Screen), no console errors:
- 0 rounds shows "No rounds played".
- With 4 players, the steps, passes and awards appear at the spec's times.
- The phone shows its own pass and only its award.
- 2 players show two steps and no awards.
- 12 players at 1920 × 1080 and 1280 × 720: three rows of passes fit above the join strip.
- Not driven live: a shared podium step (unit test).

**Notes for next session:**
- On the 284 px wide passes, "Round 1 · Paris · 259" wraps the points onto a second line. F54's BoardingPass can tidy this, for example by putting the points on their own aligned row.
- `.playtest/F28/` has the scenarios (`scenario.ts`, `finale12.ts`).


## F27 — Travel awards (2026-11-07)
**What changed:**
- `shared/awards.ts` (new), pure logic for the finale; nothing is wired into a view yet (F28):
  - `travelAwards(playerIds, rounds)`: Pinpoint Pilot, Lost Luggage, Frequent Flyer, Smooth Landing in that order. Eligible after half the played rounds rounded up (missed rounds don't count, at least 1). Each award goes to the best-ranked player who has not won yet; players tied on its stat share it (in standings order). Pilot needs a bullseye. At most 3; none with fewer than 3 players in `playerIds`. Each `Award` is `{id, title, playerIds, stat}`, with stats "2 bullseyes", "4,812 km from Lima", "18,204 km in total".
  - `passStats(playerId, rounds)`: `bestRound` ("Round 7 · Osaka · 960", highest points, earliest on a tie) and the unrounded `avgKm` over played rounds; both null without a played round.
- `formatKm` moved from `client/src/lib/format.ts` to `shared/geo.ts` (the client re-exports it), so award stats print distances as the reveal rail does.

**Decisions:** DECISIONS 35 covers ties against "always yields 3": ties are shared among new winners only, so a shared award can use up every eligible player and fewer than 3 awards follow. It also covers the at-least-one-round eligibility, the stat texts and the best-round tie.

**New dependencies:** none.

**Tests:** `npx vitest run shared/awards.test.ts client/src/lib/format.test.ts`
- Each award with its stat text; Pilot skipped without a bullseye; the singular "1 bullseye".
- No repeat winner: a player who leads on several stats wins once, and the next best non-winner takes the rest.
- Shared ties in standings order; the stat place from the earliest round.
- Eligibility at 3 of 5 rounds: a late joiner and a player who missed 3 rounds get nothing.
- 2 players → none. A third player who never played still lets the other two win.
- No played rounds → none.
- 500 seeded random games of 3–8 players: no repeats, at least 3 winners, and 3 awards unless every player already won (always 3 when nothing is shared). All-tied 3 players → one shared award.
- `passStats`: best round, earliest on a tie, "1,499" with a comma; the average skips missed rounds; null without a played round.

**Playtest:** none (no UI; pure logic).

**Notes for next session (F28):**
- Build `AwardRound[]` from `game.played` only (revealed rounds), with `placeName` set to the name the reveal showed. `playerIds` is the final standings in standings order.
- Send awards and pass stats only in FINAL, and add `awards`, `bestRound` and `avgKm` to `server/views.test.ts`'s leak test.
- A phone gets `passStats` for its own id only, unless Role views says otherwise.
## F26 — Dev tool: fake players (2026-11-07)
**What changed:**
- `server/devBots.ts` (new): `spawnBots` joins one Socket.IO player per identity, one at a time. Each GUESSING round a bot aims at a uniform point of its view's `region.box` (`randomPointIn`, wrapping a box past 180°) and locks in there after a random share of up to 90% of the time left. A refused lock-in (paused meanwhile) plans again on the next GUESSING state; waiting players sit the round out. `botIdentities` picks "Bot N" names and emoji free in the room, within `MAX_PLAYERS`.
- `server/http.ts`: `createApp({devTools})` mounts `GET /dev/bots/:code?count=N` (default 3, `DEFAULT_BOT_COUNT` in `shared/constants.ts`): `{code, bots}`, 404 for an unknown room, 409 when no bot could join. `devBots.js` is loaded by a dynamic import, so production never loads `socket.io-client`. `/dev/*` otherwise answers a JSON 404 and the SPA fallback skips `/dev/`.
- `server/index.ts` passes `devTools: !env.production`; the dev fixture was already production-gated in `loadCategoryStore` (F08).
- `vite.config.ts` proxies `/dev` to the dev server, so http://localhost:5180/dev/bots/CODE works.

**Decisions:** DECISIONS 34 (server-side bots over Socket.IO, the GET with `?count=`, names and emoji, aim and lock-in timing, rematches, a refresh adding a new batch).

**New dependencies:** none (`socket.io-client` was already installed for the client and the socket tests).

**Tests:** `npx vitest run server/devBots.test.ts server/http.test.ts`
- `http.test.ts`, "dev tools": with `parseEnv({NODE_ENV: 'production'})` wired as `index.ts` does (and a client dir, so the SPA fallback is in play), `/dev/bots/ABCD` and `/dev/anything` are JSON 404s and `/api/categories` is `[]` (no fixture); in development the route is mounted ("No such room.") and the fixture is served.
- `devBots.test.ts`: the route joins Bot 1–3 with distinct emoji next to the human, 409 for a full room, 404 for an unknown one; with a real gateway and hand-fired timers, three bots aim inside the box as GUESSING opens, schedule their lock-ins under the 30 s timer, lock in at their aims when fired, and do it again in round 2; `botIdentities` skips taken names and emoji and stops at the cap; `randomPointIn` stays in the box and wraps the antimeridian.

**Playtest** (Mika as VIP, the Screen, 3 bots), no console errors: unknown room 404; `?count=3` spawned Bot 1–3 onto the Screen lobby; in round 1 the bots locked in on their own and the round revealed with their pins without the human locking in, then moved to round 2; `?count=50` respected the cap; a production server answered `/dev/bots/ABCD` with 404. A live smoke of `dist/` with `NODE_ENV=production` gave the same 404 and `[]` categories.

**Notes for next session:** each call spawns a new batch and the earlier batch keeps playing (DECISIONS 34); a per-room registry that stops the old batch would be the upgrade if that gets in the way.

## F25 — Reconnects and drop-outs end to end (2026-11-07)
**What changed:**
- The reconnect mechanics were already in place (F06 join/leave and VIP away, F10 stored key, F15 `everConnected` and `allLocked`, F17 `myAim`, F19 `initialCentre`). This feature proves them end to end and closes one gap.
- `client/src/components/ScreenGame.tsx`: a disconnected player's row on the standings board (SCOREBOARD and FINAL) is greyed (`opacity-40 grayscale`, DESIGN's disconnected state) and keeps their score, with an `sr-only` "(disconnected)" for screen readers. The tile was already greyed.

**Decisions:** DECISIONS 33 (greying on the standings board only, not the reveal rail; the whole row dims; the sr-only cue).

**New dependencies:** none.

**Tests:** `npx vitest run server/sockets.test.ts client/src/pages/Play.test.tsx client/src/pages/Screen.test.tsx`
- `sockets.test.ts`, "socket gateway: reconnects":
  - the VIP (with an aim) and a locked-in player drop mid-GUESSING, show greyed on the Screen, rejoin with their keys: the VIP keeps the ★ (the stale `vipGone` does nothing) and `myAim`, the other keeps `myLock`, and the VIP can still lock in;
  - a Screen refreshed during REVEAL gets the same round and reveal back;
  - everyone gone in GUESSING: no `allLocked`, `guessUp` still scores the aim and the opening centre, a player absent all round is missed (no position, 0 points), and the SCOREBOARD keeps all three, disconnected, with their totals;
  - after a restart (empty room store) both `screen:join` and `player:join` get "This game has ended".
- `Play.test.tsx`: a refresh mid-guessing reopens the crosshair on `myAim` and Lock in sends it; a refreshed locked-in phone shows the Locked-in card.
- `Screen.test.tsx`: a disconnected player's standings row is greyed with their score. The missed-round "—" stays covered by F18's rail test ("🐸Ivy—"); room-gone on each role by the existing Screen and Play tests.

**Playtest** (Mika as VIP, Ana, Ben, the Screen), no console errors: Ana offline 2.5 s and reloaded mid-guessing, back to guessing; Ben locked in and reloaded, Locked-in card; the Screen reloaded mid-round and in REVEAL, back to the same view; the VIP reload kept the ★; Ana scored while offline; an unknown code showed "This game has ended" with a link on the Screen and a phone. Not driven in the browser (unit tests): the kept aim, the "—" of a missed round, a real restart.

**Notes for next session:** none.

## F24 — Rematch and back to lobby (2026-11-07)
**What changed:**
- `server/reducer.ts`:
  - `vip:rematch` (FINAL, no countdown, VIP) checks the same settings against the live category the gateway passes in, sets `rematchAt = now + 3 s` and schedules `rematchGo`. Nothing is reset yet.
  - `vip:rematchCancel` clears it and bumps `timerEpoch`.
  - `rematchGo` clears the countdown. With a connected player, and the category still live and big enough, it starts a **New game** with the same players and settings (`newGame`, then `bumpEpoch`, which re-sets a pending `vipGone` for the new game number, then `openRound(1)`). With nobody connected, or the category gone, it only clears the countdown.
  - `vip:backToLobby` (FINAL) clears the game and the countdown (epoch bump), keeps players, settings and `placeUsage`, and clears `waiting`.
  - `archiveGame` adds `{number, revealedPhotoIds}` to `previousGames` at the rematch's New game and at Back to lobby (empty until Picture mode's tokens, F48).
  - Places across games needed no new code: `pickPlace` already prefers places without a `placeUsage` entry, and game numbers keep rising (DECISIONS 23).
- `server/sockets.ts`: `vip:rematch` shares Start's handler (the live category of `settings.categoryId`). `vip:rematchCancel` and `vip:backToLobby` join the plain VIP actions. A `rematchGo` timer is dispatched with the live category read when it fires.
- **Client:**
  - `PausedOverlay` now takes `countdownAt` and a `label`, so the rematch reuses the resume 3-2-1 ("Rematch in 3"). It sits over the final view on the Screen (`Screen.tsx`) and on the phone (`PlayGame.tsx`, where the final card is inert under it).
  - `VipDrawer.tsx` draws **Rematch** (primary, `min-h-16 text-2xl`, one tap, the drawer stays open), **Back to lobby** (two taps: "Tap again to go to the lobby") and, while counting, only **Cancel**. The F21 `shortcut:` comment is gone.
  - `Play.tsx` closes the drawer when the countdown ends.

**Decisions:** DECISIONS 32 covers:
- the live category, read at the tap and again at `rematchGo`;
- the refusal texts;
- no Screen needed for a Rematch;
- the epoch bumps;
- `waiting` cleared in the lobby;
- the `previousGames` entries;
- the drawer staying open for Cancel;
- the armed label.

**New dependencies:** none.

**Tests:** `npx vitest run server/reducer.vip.test.ts server/sockets.test.ts client/src/components/VipDrawer.test.tsx client/src/pages/Play.test.tsx client/src/pages/Screen.test.tsx`
- `reducer.vip.test.ts`, "vip:rematch and vip:backToLobby":
  - rematch timing, with nothing reset and a second rematch refused;
  - refusals: from a non-VIP, outside FINAL, with a gone category and on a pool shortfall;
  - `rematchGo` into a New game (same players and settings, game number + 1, `previousGames`);
  - cancel, after which the `rematchGo` in flight is ignored;
  - nobody connected, and a category taken down meanwhile;
  - a VIP who dropped during the countdown, still replaced in the new game;
  - back to lobby: keeps players, settings and placeUsage, clears `waiting`, cancels a countdown;
  - placeUsage: after five of six Easy places were used, both a rematch and a lobby Start draw the sixth.
- `sockets.test.ts`: rematch refused while guessing; then rematch, cancel, rematch, `rematchGo` into a New game with the store's category; back to lobby refused from a non-VIP, then allowed.
- `VipDrawer.test.tsx`, "VipDrawer Rematch and Back to lobby": the FINAL list and only Cancel while counting; Rematch keeping the drawer open; Back to lobby taking two taps.
- `Play.test.tsx`: the 3-2-1 over an inert final, Cancel in the open drawer, the drawer closing at the new game's INTRO.
- `Screen.test.tsx`: the 3-2-1 over the final standings.

**Playtest** (Mika as VIP, Ana, the Screen), all passed with no console errors:
- FINAL drawer: Rematch, Back to lobby and Kick;
- "Rematch in N" on all three, with the drawer showing Cancel;
- Cancel cleared it everywhere, and no game started;
- a full rematch started a new game on both phones;
- Back to lobby took two taps and kept "5 ROUNDS · 30 S".

Not driven in the browser (covered by reducer tests): placeUsage across games, `previousGames`, and a rematch with nobody connected.

**Notes for next session:**
- The `shortcut:` comment in `VipDrawer.tsx` is closed: every drawer control is drawn.
- F48: `archiveGame` already reads `photoTokens[*].revealed`, but nothing sets `revealed` yet: set it in `startReveal` when tokens arrive, and test a game archived with a revealed token.

## F23 — Between-round settings (2026-11-07)
**What changed:**
- `server/reducer.ts`: `vip:roundSettings {timerSeconds?, rounds?}`, at SCOREBOARD only, checked against `room.vipId`, refused while paused (`ERRORS.paused`; F20 and F21's carried-over note is now closed). A total at or below the rounds played is refused (`roundsPlayed`). A changed total re-plans the levels with the existing `replan` (played rounds keep theirs) and checks the unplayed rounds against the unused places of the game's snapshot, refusing with the level named: "Japan · Medium has 4 cities left; the rest of the game needs 5." Multipliers needed no new code: `openRound` already takes `escalation(settings.rounds)`, and played rounds carry their own multiplier and points. The timer applies at the next GUESSING.
- `server/placePicker.ts`: `restShortfall` (unused places per level); `shared/placeCheck.ts`: `placeShortfall` now goes through `planShortfall(c, mode, plan, rest)`, which has the "left; the rest of the game needs" wording.
- `server/sockets.ts`: the `vip:roundSettings` handler (schema already existed), rate-limited as a VIP action.
- `client/src/components/VipDrawer.tsx`: the **Round settings** section on SCOREBOARD, Timer 20/30/45 s and Rounds 5/10/15 with the lobby's `Segmented` (now exported from `VipLobby.tsx`, with a `disabled` prop). Counts at or below the rounds played are disabled with "N rounds already played" under them. Each tap sends one change, the drawer stays open, the options are disabled while sending, and a refusal shows under the section. `Play.tsx` passes `settings` and the played count (the SCOREBOARD header's round number).

**Decisions:** DECISIONS 31: the refusal texts, the pool check for every difficulty, the drawer staying open, the gate label (the scoreboard keeps the played round's multiplier; the recomputed one shows from the next INTRO), and no saving to the remembered lobby settings.

**New dependencies:** none.

**Tests:** `npx vitest run server/reducer.vip.test.ts server/sockets.test.ts client/src/components/VipDrawer.test.tsx client/src/pages/Play.test.tsx`
- `reducer.vip.test.ts` "vip:roundSettings": 5 → 10 after 4 played keeps round 4 (×1.5, its points) unchanged, re-plans rounds 5–10, the Screen header reads 5/10 ×1 and 8/10 ×1.5, the new 45 s timer applies, and the game ends after 10 with multipliers 1,1,1,1.5,1,1,1,1.5,1.5,2; 10 → 5 refused at 5 played and allowed at 4; the Mixed refusal (5 of 10 played → 15 needs 5 Medium, 4 left) leaves the room untouched; a timer-only change; refusals outside SCOREBOARD, while paused and from a non-VIP.
- `sockets.test.ts`: an invalid total is refused by the schema, and `notNow` while guessing.
- `VipDrawer.test.tsx` "VipDrawer Round settings": shown on SCOREBOARD only with the current values pressed; counts disabled at or below the played count with the reason; one change per tap, the drawer staying open, options disabled while sending, a refusal under the section. The SCOREBOARD per-phase button list now includes the six segments (fixture update for the new section).
- `Play.test.tsx`: the ★ at the scoreboard after round 5 disables "5" and sends `{rounds: 15}`.

**Playtest** (VIP on a small phone, Ana on a Pixel 7, the Screen; 5 rounds Mixed 20 s), all passed with no console errors: no Round settings in GUESSING or REVEAL; at the first scoreboard 45 s and 10 pressed with the drawer open; the Screen reading "Round 2/10" and the timer starting at 45; rounds 2–5 at x/10; after round 5 "5" disabled with "5 rounds already played". The SCOREBOARD still auto-advances after 6 s while the VIP is in the drawer (spec timing). The pool refusal was not driven in the browser (reducer tests).

**Notes for next session:**
- The `shortcut:` in `VipDrawer.tsx` now names only Rematch, Back to lobby and Cancel (F24); the F21 and F22 notes that list Round settings are superseded.

## F22 — Kick, players list and VIP hand-off UI (2026-11-07)
**What changed:**
- The server side already existed: `vip:kick` (F06) removes the player, their aims, locks and result rows in every round, adds them to `kickedIds` and sends `kicked`; `removePlayer` re-checks `allLocked` (F15); `succeed` sends `fx vipNow` to a new VIP (F06). The kicked screen and the refused rejoin were F10's.
- `client/src/components/VipDrawer.tsx`: the **Players** section, drawn where the server lists `kick` (INTRO, GUESSING, SCOREBOARD, FINAL; not REVEAL). One row per player but the VIP (emoji, name, dimmed when disconnected) with its own two-tap **Kick** ("Tap again to kick", announced as "Tap again to kick Ana"), sending `vip:kick {playerId}`. "No other players" when alone. The sheet now scrolls (`max-h-[85dvh]`). `tap()` is generalised to a key and an emit, so the controls and the rows share the arm, send and refusal path.
- `client/src/pages/Play.tsx`: `VipToast`, "You're the VIP now ★" for 3 s on `fx vipNow`, `--board-panel` with a 1 px amber border at the top of the phone (z 1300). The ★ button is hidden in LOBBY (the server's lobby controls include `kick`, which would now draw it). At the final the ★ now shows, with Players.
- `client/src/components/ScreenGame.tsx`: the ★ (`aria-label="VIP"`) follows the name on the standings rows. The tile badge already followed `isVip`.

**Decisions:** DECISIONS 30: no ★ drawer in the lobby (lobby kick is in the Backlog), the Players list's order, dimming and empty state, a kick closing the drawer, the toast's placement, and the ★ on standings rows only (not the reveal rail).

**New dependencies:** none.

**Tests:** `npx vitest run server/reducer.vip.test.ts client/src/components/VipDrawer.test.tsx client/src/pages/Play.test.tsx client/src/pages/Screen.test.tsx`
- `reducer.vip.test.ts` "vip:kick mid-game": a kick in GUESSING of the only unlocked player schedules `allLocked`, and the reveal scores only the VIP; a kick at SCOREBOARD drops their played-round rows, their standings row and their tile from the Screen view, and their rejoin is refused with "You were removed from this game". (`reducer.game.test.ts` already covered the GUESSING row removal.)
- `VipDrawer.test.tsx` "VipDrawer Players": the list per phase (none in REVEAL), the two-tap kick arming only its row and sending the id, "No other players".
- `Play.test.tsx`: the toast for exactly 3 s on `fx vipNow`; the ★ and a two-tap kick at the final. The kicked screen and refused rejoin stay covered by F10's "shows the kicked screen with a link home" and "shows a refused rejoin of a kicked player as the kicked screen".
- `Screen.test.tsx`: the ★ moves from Mika's to Sam's standings row and tile when `isVip` moves. The F18 standings row text now includes Mika's ★ (fixture change, not a loosened check).

**Playtest** (four phones and the Screen), all passed with no console errors: two-tap kick of Cy; Cy's phone shows the removal and still does after a reload and rejoin; Cy gone from the Screen; ★ on Mika's tile; Mika's Leave game gives Ana the toast and the ★ button; the ★ on Ana's tile, then on her standings row after her Next. `allLocked` after a kick was not driven in the browser (reducer tests).

**Notes for next session:**
- F21's note "Players (F22) not drawn yet" is closed; the `shortcut:` in `VipDrawer.tsx` now names only Round settings (F23) and Rematch, Back to lobby and Cancel (F24).
- F24: Rematch is drawn above Players at the final; the ★ already shows there.

## F21 — VIP drawer: Next, Skip round and End game (2026-11-07)
**What changed:**
- `server/reducer.ts`: `vip:next`, `vip:skipRound` and `vip:end`, each checked against `room.vipId`.
  - **Next:** REVEAL ends at once (`endReveal`: every row revealed, the round played) into SCOREBOARD, or FINAL after the last round; SCOREBOARD opens the next round. Refused while paused with "The game is paused".
  - **Skip round** (INTRO, GUESSING, REVEAL): bumps `timerEpoch` (new `bumpEpoch`, which `addReason` now shares and which re-schedules a pending `vipGone`), then **open round** with the same number. The voided round is dropped and its place stays in `usedPlaceIds`. "No spare places left at Hard" comes from `openRound`. A pause stays on.
  - **End game** (INTRO to SCOREBOARD): an unrevealed round is voided (`current = null`); a round in REVEAL counts as played (`endReveal(…, final)`). Lifts a pause and clears `screenAwayUntil`.
  - New error `notNow`: "You can't do that now".
- `server/sockets.ts`: the three handlers, rate-limited as VIP actions (the schemas already existed).
- **Client:** `client/src/components/VipDrawer.tsx` is new. It is a bottom sheet on `--board-panel` with a 16 px top radius, above the paused overlay (z 1150/1160). It draws the server's `vip.controls` for Next, Pause/Resume, Skip round and End game.
  - Two-tap confirms ("Tap again to skip", "Tap again to void this round" in REVEAL, "Tap again to end the game") reset after 3 s, and the armed label is announced.
  - An action that lands closes the drawer; a refusal shows inside it. "…" shows while sending.
  - It closes on an outside tap and on Escape, and focus goes back to ★.
- `Play.tsx` TopBar: the amber ★ button (48 px) shows only for the VIP when the drawer has controls. It closes the ⋯ menu and vice versa. The drawer is keyed on the phase, so a new phase starts disarmed.
- **Final with 0 rounds:** the Screen shows "No rounds played" instead of the board; the phone's pass shows it instead of the rank.

**Decisions:** DECISIONS 29 covers:
- the `notNow` text;
- skip keeping a pause, end lifting it;
- the epoch bump on skip;
- End game taking two taps in every phase;
- drawing only the controls whose actions exist (no ★ in LOBBY or FINAL until F22–F24);
- "No rounds played" on both finals.

**New dependencies:** none.

**Notes for next session:**
- `VipDrawer.tsx` has a `shortcut:` comment: Players (F22), Round settings (F23), Rematch, Back to lobby and Cancel (F24) are not drawn yet. Add each to `CONTROLS` with its feature. Once F24 draws Rematch, the ★ shows at the final too, including after "No rounds played".
- F23's `vip:roundSettings` must refuse with `ERRORS.paused` while paused (spec Transitions).
- F48: on skip and on end, drop the voided round's entry from `room.photoTokens`, so its photo stops being served. The drawer's Skip round should read "Skip round (photo missing)" when the photo is gone (spec Provider outages). The credits feature should decide whether a round skipped during REVEAL (its photo was shown) is credited.
- The drawer does not trap Tab: focus can reach the page behind the backdrop. Escape works from anywhere.

**How to try it:** `npx vitest run server/reducer.vip.test.ts client/src/components/VipDrawer.test.tsx server/sockets.test.ts client/src/pages/Play.test.tsx client/src/pages/Screen.test.tsx`. The tests cover:
- **Reducer** (16 tests):
  - next from REVEAL (all revealed, stale reveal timers ignored), from the last REVEAL to FINAL, and from SCOREBOARD to the next round;
  - next refused while paused, in INTRO/GUESSING and from a non-VIP;
  - skip in INTRO, GUESSING and REVEAL: same number, level and multiplier, a fresh place, voided results and locks, both places used, and the old timers stale;
  - skip keeping a pause, re-scheduling `vipGone`, the exhausted Hard pool refusal leaving the room untouched, and the refusal in SCOREBOARD;
  - end in INTRO, GUESSING (voided), REVEAL (played) and SCOREBOARD, while paused (lifted), and its refusals.
- **Gateway:** next refused while guessing, skip refused from a non-VIP, skip then end over sockets.
- **Drawer:** controls per phase and pause state, one-tap send and close, a refusal shown, Escape and outside tap, the two-tap confirms and their 3 s reset.
- **Pages:** ★ opens the drawer (not on its own), Resume sends and closes, focus returns, no ★ for non-VIPs or in the lobby; "No rounds played" on the phone and the Screen.

The playtest used Mika as VIP on a small phone, Ana on a Pixel 7 and the Screen, in a 5-round 20 s game. These passed, with no console errors:
- the drawer closed on arrival, and no ★ for Ana;
- the GUESSING controls;
- the Skip round arm and its 3 s reset;
- skip starting a fresh round;
- REVEAL's controls and Next to the scoreboard;
- the SCOREBOARD controls and Next to the next round's guessing;
- End game's two taps to FINAL.

One step was marked failed, by the probe, not the app: the round number. The phone shows no "Round N" text during guessing; the screenshot shows the next round running. Not seen in the playtest, but covered by reducer tests: the exhausted pool, end from INTRO, and "No rounds played".

## F20 — Pause and resume (2026-11-07)
**What changed:**
- `server/reducer.ts`: `vip:pause` / `vip:resume` and the `screenAway` reason.
  - **Pausing:** the first reason turns `Room.phaseTimers` into `paused.remainingMs` and bumps `timerEpoch`, so every timer in flight goes stale.
    - `Room.phaseTimers` is new: every phase timer's deadline, keyed `revealStep:k` per step, cleared on each phase change.
    - A pending `vipGone` is re-scheduled with the new epoch.
  - **While paused:** a phase timer that comes due (`allLocked` after a disconnect) is only stored, with its full delay. Aims and lock-ins are refused, as before.
  - **Resuming:** clearing the last reason sets `resumeAt` and schedules `resumeGo`. `resumeGo` restarts every stored timer at `now + remaining` and moves `endsAt` forward by `now − since`.
  - **Screen away:** a Screen count of 0 in a timed phase sets `Room.screenAwayUntil` (new) and schedules `screenGone`. If no Screen is back when it fires, the room pauses with `screenAway`; a Screen joining clears it.
  - `screenGone` and `resumeGo` are guarded by their exact `at`.
- `server/sockets.ts`: the `vip:pause` and `vip:resume` handlers, rate-limited as VIP actions.
- `server/views.ts` and `shared/types.ts`: `PausedView.since`.
- **Client:** `client/src/components/PausedOverlay.tsx` is new. It is an 85% `--board-bg` overlay showing the message, or the 3-2-1 in one 240 × 160 flap with a 200 px glyph.
  - **Screen:** the gate label already read "Delayed" in red. The timer stops at `endsAt − since`. A `--delayed` banner, "Delayed · the VIP paused the game", runs along the bottom above the join strip, then the overlay shows the 3-2-1.
  - **Phone:** `PlayGame` wraps every game phase, `inert` while paused, so the overlay covers everything under the top bar: "Delayed · the VIP paused the round" or "Waiting for the Screen…", then the 3-2-1. Both timers stop at `since`.
  - `StartOverlay` now sits above both overlays (z 1200).

**Decisions:** DECISIONS 28 covers:
- pausing only in the four timed phases, and the refusal texts;
- `phaseTimers` and `screenAwayUntil`, and the `at`-match guards;
- a new reason during the 3-2-1 cancels it;
- `PausedView.since`;
- the banner's place and no banner for `screenAway`;
- the phone overlay under the top bar.

**New dependencies:** none.

**Notes for next session:**
- F21 and F23 must refuse `vip:next` and `vip:roundSettings` with `ERRORS.paused` while `room.paused` is set. Those actions don't exist yet, so this Done-when part is carried over to them.
- `vip:skipRound` and `vip:end` must still work while paused (spec Transitions). A phase change while paused already empties `remainingMs` (`enterPhase`), and new phase timers are only stored until the resume. F21 should decide whether skip or end also lifts the pause.
- There is no Pause button yet: the VIP drawer is F21. The playtest drove `vip:pause` from a second socket with the VIP's key.
- The F18 and F19 `shortcut:` comments about the timer counting while paused are gone.

**How to try it:** `npx vitest run server/reducer.pause.test.ts server/sockets.test.ts client/src/pages/Screen.test.tsx client/src/pages/Play.test.tsx`. The tests cover:
- **Reducer** (17 tests):
  - pausing in INTRO, GUESSING, REVEAL (the held step, every remaining step and `revealDone`) and SCOREBOARD;
  - stale timers ignored, and aims and lock-ins refused, through the 3-2-1 too;
  - `endsAt` and `guessUp` moved by the pause, and `allLocked` both held and coming due while paused;
  - the refusals;
  - `screenAway`: set after 3 s, a Screen back in time, a stray second leave not moving the deadline, never in LOBBY or FINAL;
  - both reasons, where only the last one clearing resumes;
  - a pause during the 3-2-1;
  - a VIP who disconnects while paused is replaced and the new VIP resumes;
  - `vipGone` re-scheduled by the epoch bump.
- **Gateway:** pause and resume over sockets, then a Screen disconnect pausing with `screenAway`.
- **Screen:** "Delayed" in red, the timer frozen while the clock moves, the banner, then 3-2-1 → 2; no banner for `screenAway`.
- **Phone:** the cover messages, Lock in disabled, the covered content `inert`, the frozen timer, the top bar outside the overlay, the 3-2-1, and back to play.

The playtest used the Screen, the VIP and a phone. It passed:
- the VIP pause on the phone and on the Screen (the timer held at 20);
- aims and lock-ins refused;
- the 3-2-1, after which the timer resumed at 20;
- `screenAway`, by closing the Screen tab, then the Screen coming back and the countdown running.

There were no console errors. Not seen in the playtest:
- the gate label's colour (covered by unit tests);
- pauses in INTRO, REVEAL and SCOREBOARD (reducer tests).

## F19 — Phone game views (plain) (2026-11-07)
**What changed:**
- `client/src/components/PlayGame.tsx`, routed from Play.tsx for every phase after LOBBY:
  - **Intro:** one map per round on the region box, `inert`, with a centred "Round 3 of 10" card (and "×1.5 Bonus round" / "×2 Final round"). The prompt bar reads the gate label. The same map carries into GUESSING (keyed on the round number).
  - **Guessing:** the prompt bar (name, or a plain thumbnail in Picture mode) with the timer from `endsAt` (red in the last 5 s), the map clamped to `clampBounds(box)` with `maxBoundsViscosity: 1.0` (World: no clamp, `worldCopyJump`), the crosshair and Lock in. Lock in sends once and stays disabled until the ack; a refusal shows over the map. A refreshed participant's map opens on `myAim`.
  - **Locked in:** a pass "Boarding · Locked in" with the timer, the still-guessing emoji ("Everyone has locked in" when none) and a 180 px non-interactive mini map with the player's pin at the zoom they locked in at.
  - **Reveal/Scoreboard:** a face-down card until `myResult` arrives, then the result pass: distance, base points, multiplier above ×1, round points, total, and BULLSEYE / CLOSEST stamps. On the scoreboard it adds the rank and "Next: Round N+1 of T". Missed (or no row on the scoreboard): "Missed this round · 0".
  - **Waiting:** "Next departure · You're in from round N+1. You start at 0." ("from the next game" past the last round). **Final:** own rank and points.
- `MapView`: `maxBounds`, `initialCentre`, `onAim` (one send per 250 ms on `move`, plus every `moveend`, from `getCenter().wrap()`), and `onLockIn` now also gets the zoom. `useLeafletMap`: `maxBounds` option.
- `server/views.ts` / `shared/types.ts`: `myResult` is a `MyResult`, with `closest` and `totalAfter` added.
- `RevealMap.pinIcon` is exported and takes a size (32 px on the phone). `shared/constants.ts`: `AIM_THROTTLE_MS`, `WORLD_ID`. `ordinal` now comes from `shared/scoring.ts` (the client copy is gone).

**Decisions:** DECISIONS 27 covers:
- `closest` and `totalAfter` on `myResult`;
- the rank only from the scoreboard, and World with no `maxBounds`;
- the intro layout, the aim and lock-in behaviour, and the mini map's zoom after a refresh;
- the waiting copy, and the stamp colour on passes.

**New dependencies:** none.

**Notes for next session:**
- Remaining `shortcut:` comments in PlayGame.tsx:
  - F20: the timer keeps counting while paused. Lock in is already disabled while `paused`, but there is no overlay yet.
  - F49: the Picture prompt is a plain thumbnail.
  - F54: plain passes and a plain face-down card, with no flip. F57: the prompt name wraps at 20 px rather than shrinking. F28: the final shows only the own standing, no awards.
- Unlocked players are scored at their last aim (F16), so "Missed this round" appears only for a participant who never connected during GUESSING. A missed row arrives at SCOREBOARD.
- The locked-in zoom lives only in the client. After a refresh the mini map uses the region box's fit.

**How to try it:** `npx vitest run client/src/pages/Play.test.tsx server/views.test.ts`. The new tests cover:
- the intro (inert map, multiplier, padded `maxBounds`);
- the same map kept into guessing, with the prompt and timer;
- World with no clamp;
- the aim throttle with fake timers (5 moves → 1 send, 200 ms → still 1, 250 ms → 2, `moveend` → 3), and no aim in the intro;
- lock-in once, then the locked card with the timer, the still-guessing emoji and a mini map at the zoomed-in lock zoom;
- a refused lock-in;
- face down until `myResult`, then the pass (Closest, ×1.5, total, no rank);
- the scoreboard pass with Bullseye, rank and next round;
- the missed card, the waiting card (both copies) and the final;
- `closest` and `totalAfter` in `views.test.ts`.

The playtest drove a 5-round Name game with three phones, a late joiner and the Screen. Intro, guessing, locked-in card, result card, scoreboard, waiting card and final all passed, with no console errors. Two of its checks failed for reasons that match the spec:
- an aim gap of 165 ms, which is `moveend` following a throttled `move`;
- no "Missed" card, because idle players score at their aim.

The flip timing against the TV is a Kim check.

## F18 — Screen game views (plain) (2026-11-07)
**What changed:**
- `client/src/components/ScreenGame.tsx`, with Screen.tsx routing on the phase:
  - **Intro:** the gate label at the centre ("Round 3/10 · Now boarding"), plus the "×1.5 Bonus round" / "×2 Final round" row on boosted rounds.
  - **Guessing, Name mode:** the gate label top left; the timer top right in whole seconds from `endsAt` on the server clock, red with "Final call" in the last 5 s (`FINAL_CALL_MS`); the display name in 22-cell prompt flaps; player tiles that turn amber with "Locked in".
  - **Reveal:** a band with the name in flaps (after the target lands) and the fact; the map on the left (1340 px) and the rail on the right (580 px).
    - Rail rows: rank chip, emoji, name, distance, points or "×1.5 → 1,218", and the BULLSEYE / CLOSEST / NOT LOCKED IN tags. Missed players come last with "—".
  - **Scoreboard and Final:** rank, emoji tile, name in flaps, round points, total and ▲/▼ movement.
- `client/src/components/RevealMap.tsx`: a non-interactive Leaflet map (the new `interactive: false` option of `useLeafletMap`).
  - It is fitted once to the target and every pin with 80 px padding, never past zoom 11.
  - Pins show from the start, the target from `target`, and a geodesic line for each of the first `revealedCount` rows.
  - Pins are built as DOM elements (no HTML strings) and moved to the target's side of the antimeridian.
- `client/src/components/PlayerTile.tsx`: moved out of Screen.tsx. It gains `lockedIn`, which is guessing only and reserves its label row so tiles never shift.
- `client/src/lib/format.ts`: `flapRows`, `gateLabel`, `multiplierRow` and `formatMovement`. `client/src/lib/useServerNow.ts` re-reads the server clock every 250 ms. `shared/constants.ts`: `FINAL_CALL_MS`.

**Decisions:** DECISIONS 26 covers:
- gate label text, the intro's multiplier row, and the timer's rounding;
- the 22-cell wrap, the band before the target lands, and when missed rows show;
- the rank chip, the boosted points' end state, and the fit including the target from the start;
- rail rows shrinking to 64 px so 12 fit.

**New dependencies:** none.

**Notes for next session:**
- F19 can reuse `gateLabel`, `flapRows`, `useServerNow`, `FINAL_CALL_MS` and `formatKm`.
- Remaining `shortcut:` comments:
  - F20: a paused round's timer keeps counting (`ScreenGuessing`). Stop it while `gate` is `delayed`, and add the banner.
  - F49: the Picture prompt shows a placeholder line; the reveal band's thumbnail and credit are also missing.
  - F54: pins are plain circles anchored at their centre, and the target does not pulse.
  - F53: flaps are static. F55 adds the scoreboard slide. F28 adds the finale.
- A missed row shows on the rail only once every scored row is in. A missed participant is one who never connected during GUESSING; an unlocked player is scored at their aim.

**How to try it:** `npx vitest run client/src/pages/Screen.test.tsx client/src/lib/format.test.ts`. The new tests cover:
- Intro with and without the multiplier row;
- Guessing: gate label, flaps, locked-in tiles, no map;
- the timer from `endsAt` with a 2.5 s clock offset (12 → 5 red "Final call" → 0);
- Reveal: pins first, then the name, fact and target, then rail rows in order with lines, tags, and the missed row last;
- the fit (80 px, zoom 11), the 22-cell wrap, and "+points" at ×1;
- Scoreboard and Final rows with movement;
- format helpers.

Two of my own test fixtures were wrong ("Santiago de Compostela," is 23 cells, and a ×1 single row is also Closest); I corrected the expectations, not the code.

The playtest drove a 5-round game: the Screen at 1920 × 1080, the VIP on a phone, and two socket bots. Intro, the Guessing timer and Final call, Reveal (band, 3 pins and the target, lines 1→3, rail in order), Scoreboard and Final all passed with no console errors. Not seen in the playtest: a "—" row and a boosted intro (both covered by unit tests).


## F17 — Game views and the leak test (2026-11-07)
**What changed:**
- `server/views.ts` fills the game phases of `toView`:
  - `round` (both roles, INTRO on; the last played round in SCOREBOARD and FINAL): number, total (`settings.rounds`), multiplier, `endsAt`, and the prompt. Name mode gives `{kind: 'name', displayName}`. Picture mode gives `/api/photos/<token>` (phones also get `…/thumb`) and a credit that always hides the author until F48.
  - Screen: `gate` (`nowBoarding` / `boarding` / `delayed` when paused) and `lockedIn` ids. Phone: `myLock`, the new `myAim` (own aim only, for the reconnect rule) and `stillGuessing` emoji (INTRO and GUESSING only).
  - `reveal` (Screen, REVEAL only): name, display name, fact, position, full credit and photo URL in Picture mode, every result row, `revealStage`, `revealedCount`.
  - `standings` (SCOREBOARD and FINAL): rank order, round points, total and movement since the last board (0 on the first).
  - `myResult`: in REVEAL only once `revealedCount` is past the viewer's index; from SCOREBOARD on, the viewer's row of the last played round (the missed row included).
  - `final` stays null until F27/F28 (`shortcut:` comment).
- `shared/types.ts`: `PlayerView.round.myAim`.
- `server/sockets.ts`: a SPEC-QUESTION comment on the lock-in's state broadcast (unchanged behaviour).

**Decisions:** DECISIONS 25: the round header past REVEAL, gate, standings order and movement, `myResult` timing, `stillGuessing`, `myAim`, the lock-in's role-filtered state broadcast, and the fail-safe guessing credit until F48.

**New dependencies:** none.

**Notes for next session:**
- F18 and F19 render from these fields. Use `closestIds(reveal.results)` for CLOSEST, show the first `revealedCount` rows on the rail, and put missed rows (`distanceKm === null`) last with "—".
- The phone's "Next: Round N+1 of T" in SCOREBOARD is `round.number + 1` of `round.total`.
- `toView` throws if a round's place is missing from `game.pool`. The reducer never allows that, but the throw would stop a broadcast.
- An aim still sends no state, so `myAim` arrives with the next broadcast (a rejoin always sends one).
- F48 must replace the guessing-credit shortcut with the author rule. The leak test bans 'Jane Doe' before REVEAL in Picture mode, so the F48 fixture needs an author that shares a word with the answer to stay banned, plus one that doesn't for the shown case.
- F20 (pause) gets `gate: 'delayed'` for free.

**How to try it:** `npx vitest run server/views.test.ts server/sockets.test.ts`. The new tests are:
- the leak test, in Name and Picture mode: every Screen, player and VIP view in LOBBY, INTRO, GUESSING, and GUESSING with an aim and two locks. It checks the target's lat and lng at 1–4 decimals (signed and unsigned), `lat,lng`, the Wikidata id, country id and name, fact, place ids, photo id, Commons file, and in Picture mode the name and author. It also checks other players' aims and locks, and proves the fixture is live by finding the secrets once the round reveals;
- own aim and lock only;
- header, gate, prompt and region from INTRO, with the VIP controls;
- lock-ins in GUESSING; the Picture prompt and thumb; Delayed while paused;
- REVEAL: the answer and every row on the Screen, and each player's result appearing exactly at their step, the missed one from SCOREBOARD;
- standings with movement 0 then ▲1 / ▼1, through to FINAL;
- socket: aim and lock-in send other devices only `fx lockedIn` (Screen) and position-free state.

There is no UI yet, so there are no Kim checks.

## F16 — Reducer: scoring, reveal, scoreboard and final (2026-11-07)
**What changed:**
- `shared/scoring.ts`: `revealStepMs(n)` gives STEP `= clamp(round(7500 / n), 600, 1800)`, with n = 0 giving 1800. `closestIds(results)` gives every scored player tied at the smallest distance, which is the **Closest** tag. Closest is derived, not stored.
- `server/reducer.ts`, timers now go through `timer()`, keyed on phase and timer name:
  - `guessUp`, or `allLocked` (re-checked when it fires), runs `startReveal`. It scores every participant:
    - a locked player at their lock;
    - an unlocked one at their last aim, else at `mercatorCentre(game.box)`, with `lockedIn: false`;
    - a participant never connected during GUESSING scores 0 with a null position.
  - `startReveal` sorts the scored rows by distance descending, ties by `joinedAt`, then puts the missed rows after them. It enters REVEAL and schedules `revealTarget` (+1.5 s), `revealStep k` (+3 s + k × STEP, with `k` carried on the timer) and `revealDone` (+3 s + n × STEP + 1.5 s).
  - `revealTarget` sets `revealStage` to `target`. `revealStep k` sets it to `lines`, with `revealedCount = k + 1`.
  - `revealDone` sets the stage to `done` and every row to revealed, pushes the round into `game.played` and sets `current` to null. It then goes to SCOREBOARD (`scoreboardDone` in 6 s), or to FINAL after round `settings.rounds`.
  - `scoreboardDone` opens round last + 1, and waiting players come in at that point.
  - In SCOREBOARD and FINAL, timers carry the last played round's number.
  - Bug fix: `vipGone` no longer checks the round number, only its exact `at`, the game and the epoch. Before, a VIP who dropped mid-game was never replaced once the next round opened.
- `server/sockets.ts` passes `k` back with the timer.

**Decisions:** DECISIONS 24: missed rows go after the scored ones and are never a step; Closest is derived; `k`; when a round counts as played; timer round numbers in SCOREBOARD and FINAL; `vipGone` ignores the round number.

**New dependencies:** none.

**Notes for next session:**
- F17 and later views:
  - Use `closestIds` for the Closest tag.
  - Show only rows below `revealedCount` on the rail, and show a player's `myResult` only past their index. Missed rows become visible at `revealDone`.
  - Extend `server/views.test.ts` with REVEAL at `revealedCount` 0 and at k.
  - Totals change only when the round enters `played` at `revealDone`.
- F21 adds `vip:next` in REVEAL (set `revealedCount` to all, then call `endReveal`) and in SCOREBOARD (open the next round). Neither is handled yet.
- F20 must keep `k` when it re-schedules `revealStep`, and must re-schedule `vipGone` on an epoch bump.
- F24's Back to lobby clears the game, so a pending `vipGone` from the game no longer matches on game number and must be re-scheduled.
- A leave during REVEAL shrinks `results`. Later `revealStep` timers clamp `revealedCount` to the scored rows. There is no test for this yet.

**How to try it:** `npx vitest run server/reducer.game.test.ts shared/scoring.test.ts`. The new tests cover:
- time-up scoring at the lock, at the aim, at the centre, and a missed participant, with the reveal schedule for n = 3;
- reveal order and tied Closest players through `allLocked`, with a late `guessUp` ignored;
- `allLocked` ignored after a reconnect;
- n = 0, where only the target is revealed and the reveal is done at 4.5 s;
- the stage and count advancing, then SCOREBOARD, the next INTRO with the waiting player let in, and round 1's timers stale in round 2;
- a full 5-round game to FINAL (multipliers 1, 1, 1, 1.5, 2; totals 6500 and a shared rank 2 in `toView`);
- `vipGone` across rounds;
- STEP for n = 1, 8, 12 and 0.

There is no UI yet, so there are no Kim checks.

## F15 — Reducer: start, intro and guessing (2026-11-07)
**What changed:**
- `server/reducer.ts`:
  - `vip:start {category}`: VIP and LOBBY only. It needs a connected player, a Screen, a live category and `poolShortfall` to pass. It then runs **New game** (number, category name, emoji, box, `regionScale`, label style, `snapshotPool`, `levelPlan`) and **Open round** (`pickPlace` on `levelPlan[n − 1]`, `rngState`, `usedPlaceIds`, `placeUsage`, the multiplier from `escalation(settings.rounds)`, waiting players let in, INTRO, `introDone` in `INTRO_MS`).
  - `introDone` in INTRO → GUESSING: `startedAt`, `endsAt`, the participants (non-waiting players in join order), `everConnected`, and `guessUp` at `endsAt + GRACE_MS`.
  - `player:aim` stores the aim with no effects. `player:lockIn` stores `{lat, lng, at}` once and sends `fx lockedIn` to the Screens.
  - `allLocked` (at least one connected participant, and every connected one locked) is scheduled in `ALL_LOCKED_MS` when it turns true, on a lock-in, a disconnect, a kick or a leave.
  - A reconnect during GUESSING adds the player to `everConnected`. Kick and leave remove the player's rows from every round.
- `server/sockets.ts`: handlers for `vip:start` (passes `categories.get(room.settings.categoryId)`), `player:aim` (8 per second per socket; over the limit it is dropped with an ok ack, and there is never a state broadcast via `dispatch(…, false)`) and `player:lockIn` (2 per second per socket, "Slow down").
**Decisions:** DECISIONS 23: the refusal texts and their order, the game number across Back to lobby, `allLocked` needing a connected participant, and the aim ack and no broadcast.
**New dependencies:** none.
**Notes for next session:**
- F16 handles `guessUp` and `allLocked` in GUESSING. Today the `timer` case ignores them (the `shortcut:` comment), so a game stays in GUESSING.
- The `allLocked` handler must re-check `allLocked(d)` and ignore the timer when it is false. A reconnect does not cancel a pending one, and a duplicate can be scheduled after a reconnect.
- F16's Open round for round 2 onwards reuses `openRound(d, n, now, fx)`, which already lets waiting players in. The reducer test for "waiting players join at the next Open round" belongs with F16's full-game test, because nothing reaches round 2 yet.
- F20 bumps `timerEpoch`. F48 adds `photoToken` and the missing-photo drop before `snapshotPool` (both `shortcut:` comments).
- The client still shows the bare phase name after Start: the views are F17 and F18/F19.
**How to try it:** `npx vitest run server/reducer.game.test.ts`, 20 tests:
- start runs New game and Open round;
- refusals: no Screen, no connected player, too few places (named), no category, non-VIP, outside LOBBY;
- introDone → GUESSING with clock, participants, everConnected and guessUp;
- a reconnect adds to everConnected;
- the aim is silent;
- the lock is final and goes to Screens only;
- outside GUESSING and while paused;
- allLocked after the last lock, ignoring the disconnected, after the only unlocked player disconnects, is kicked or leaves, and not when everyone disconnects;
- stale round, game and epoch timers ignored, and introDone ignored in GUESSING;
- a join in INTRO plays and a join in GUESSING waits.

`server/sockets.test.ts` adds:
- Start over a real socket with and without a Screen;
- aims produce no events and 9+ per second are dropped;
- the lock-in limit and `lockedIn` to Screens only.

No UI and no Kim checks.

## F14 — Place picker (2026-11-07)
**What changed:**
- `server/placePicker.ts` (new, pure): `mulberry32(state) → {value, state}`; `snapshotPool(category, mode, plan)` deep-copies the live places of the mode's kind for every level in the plan (the future `game.pool`); `pickPlace(levelPool, usedPlaceIds, placeUsage, rngState) → {place, rngState} | null` skips used places, prefers places with no `placeUsage` entry, then the lowest game number, and breaks ties with one PRNG draw; `poolShortfall(categoryName, pool, mode, difficulty, rounds)` gives the Start and Rematch refusal on the snapshot ("Japan · Hard has 8 landmarks; this game needs 10.") through `shared/placeCheck.ts` `placeShortfall`.
- Nothing calls it yet: no reducer, gateway or UI change.
**Decisions:** DECISIONS 22: one PRNG draw per pick; no entry counts as game −∞; the caller chooses the level and records the pick; snapshot is a deep copy of the mode's kind; the check runs on the snapshot and ignores `placeUsage`.
**New dependencies:** none.
**Notes for next session:** F15 (New game / rounds) builds `levelPlan` with `shared/scoring.ts`, calls `snapshotPool` (in Picture mode, the gateway first drops places whose photo file is missing and passes the filtered category or pool in the action), refuses with `poolShortfall` when it returns text, then per round calls `pickPlace(game.pool[levelPlan[n − 1]], game.usedPlaceIds, room.placeUsage, room.rngState)` and stores the new `rngState`, appends to `usedPlaceIds` and sets `placeUsage[id] = game.number`. A Skip picks again the same way. Reuse `mulberry32` from here rather than adding a third copy (`server/codes.test.ts` has its own). The mid-game round-count refusal ("fewer unused places left than remaining rounds") is the round-count feature's, built on the same pool and `usedPlaceIds`.
**How to try it:** `npx vitest run server/placePicker.test.ts` (12 tests: mulberry32 pure step; snapshot keeps the mode's kind per needed level and ignores later edits; no repeat across 10 draws on a pool of 6 then null; unused first; then LRU; deterministic for a seed and ties vary across seeds; returned state advances; refusals for a single level, Mixed 10 (3 · 4 · 3), earlier-used places still available and drawable, singular noun). No UI and no Kim checks.

## F13 — VIP lobby settings and category picker (2026-11-07)
**What changed:**
- `shared/placeCheck.ts` (new): `placeShortfall(category, mode, difficulty, rounds)` returns null or the spec's refusal ("Japan · Hard has 8 landmarks; this game needs 10.", singular "1 landmark"), checking each level's share of `levelPlan` (Mixed 5 = 2 · 1 · 2). `categoryOffered` (some level has `MIN_PLACES_TO_OFFER` places in the mode) and `levelCount` are exported too. The lobby uses it now; F15's Start and F24's Rematch must call it for their refusals.
- Reducer `vip:settings` (VIP only, LOBBY only): rejects a `categoryId` not in `liveIds` ("That category is not available"), else merges into `room.settings`. The gateway handles `vip:settings` through `asVip` and passes `categories.summaries()` ids. `attachSockets` takes `categories` (a `CategoryStore`, wired in `server/index.ts`).
- Views: `categoryName` and `hasCategories` in every role, and `vip.categories` (the live list) and `vip.screenCount` in the VIP's. `ViewContext` carries `categories`.
- `client/src/components/VipLobby.tsx` (new): the settings card above the practice map. It has category cards (emoji, name, per-level counts in the mode, greyed "Not enough cities yet"), a search box over 8 categories, Mode, Difficulty, Rounds and Timer segmented controls (unavailable ones disabled, with their reasons under them), and Start ▶ with its reason (no destinations, "Open the Screen first", "Pick a category", the place count). Every tap sends `vip:settings`; the card renders only the server's settings. Refusals show in red under Start.
- `client/src/lib/vipSettings.ts` (new): the remembered settings under `pinpoint:vipSettings`, validated field by field on read. `initialSettings` keeps the remembered category only while it is live, else World (id `world`) or the first by name. The card applies them once per mount when the room has no live category, and saves the room's settings whenever they name a live category.
- `lib/format.ts` `settingsLine(view)` gives "WORLD · NAME · MIXED · 10 ROUNDS · 30 S", with no category segment before one is picked, plus `NO_DESTINATIONS`. The Screen lobby shows the row under the tiles (40 px board face) and the phone shows it under the waiting line. With no live category both show "No destinations yet. Check back soon." as body text. The VIP phone shows that line only in the card, and its "You're the VIP ★" line is replaced by the card.
**Decisions:** DECISIONS 21: `vip:settings` checks only the category; the new view fields; the greying rules and reason order; World is id `world`; when the remembered settings are applied and saved; Start sends `vip:start` with no handler yet; the surfaces inside the card; no text on `--amber-dim`.
**New dependencies:** none.
**Notes for next session:** F14's `server/placePicker.ts` can reuse `placeShortfall` for its refusal text instead of a second copy. F15 adds the `vip:start` gateway handler and reducer case: Start ▶ already emits `vip:start {}` and shows a refused ack under the button. Until then a tap does nothing. `vip:settings` stores any mode, difficulty and round count for a live category, so Start must run `placeShortfall`. The ★ VIP drawer button is F21's. Review items left: the reason lines mount and unmount under their controls (a small layout shift), and Difficulty and Rounds reasons do not repeat the option name (the text names the level and the count already). Leak test: when it gains category fixtures, avoid a category named like one of its places.
**How to try it:** `npm test` (shared/placeCheck.test.ts 4: single level, Mixed shares, singular noun, offering; server/reducer.lobby.test.ts `vip:settings` 3: stores, unknown or hidden category rejected, VIP and lobby only; server/views.test.ts category fields per role; server/sockets.test.ts `vip:settings` over a real socket against the dev fixture; client/src/components/VipLobby.test.tsx 12: World first, first by name, remembered settings applied and saved, a dead remembered category and junk ignored, a set-up room left alone, taps and refusal, greyed rounds with reasons, greyed category, levels and Mixed in Picture mode, Start reasons and `vip:start`, empty state, search over 8; Screen.test.tsx settings row and empty line; Play.test.tsx no-destinations line on a non-VIP phone). `npm run dev`, then **Show** on http://localhost:5180 and join at http://<laptop-ip>:5180/play/CODE from a phone. The first phone gets the card with World (dev) picked, and changes appear on the Screen's row. Playtest: `.playtest/F13/scenario.ts` (defaults, World preselected, Screen row, Start enabled once a Screen is open, changes reach the Screen, remembered settings in a new room, no card on a second phone) and `picture.ts` (Picture mode greying on the fixture, which has no landmarks).

## F12 — Crosshair map and practice (2026-11-07)
**What changed:**
- `client/src/lib/tiles.ts`: `loadTileConfig` fetches `/api/config` once per page into the `useTiles` Zustand store. `shouldUseFallback`/`createTileWatch` hold the switch rule: 4 or more CARTO tile errors in the last 10 s with no CARTO tile loaded in that window. One page-wide watch (`reportTileLoad`/`reportTileError`) flips `fallback`, so every map on the page moves to the fallback until a reload. `currentLayer` picks CARTO, or the fallback when switched or when there is no key.
- `client/src/lib/useLeafletMap.ts` (Leaflet directly, no react-leaflet) returns a callback `ref`, the `map`, the current `layer` and `fallback`. Maps are built once per element and fitted to the `box`, with `maxZoom` 13, `worldCopyJump` optional, and Leaflet's zoom and attribution controls off. The tile layer gets `maxNativeZoom` from the config, `keepBuffer: 1` and `updateWhenZooming: false`. CARTO tile load and error events feed the watch.
- `components/MapView.tsx` puts the map in a container with `role="application"` and "Map. Pan to aim the crosshair.", where Enter on the focused map locks in. It adds `Crosshair` (44 px amber cross, 8 px gap, 2 px `--board-bg` outline, `pointer-events: none`), + and − buttons at 48 px on the right edge, the "Simplified map" badge on the fallback, and an 11 px attribution line that is always visible. **Lock in** (64 px, full width minus 16 px) sends `map.getCenter().wrap()`. The optional `result` prop takes Lock in's place.
- In the phone lobby (`pages/Play.tsx`), "Practice: find 0°, 0°" and `PracticeMap` add `MapView` on `WORLD_BOX` (unclamped, `worldCopyJump`). Lock in emits `player:practice`. The result line "1,240 km from 0°, 0°" (`lib/format.ts` `formatKm`, one decimal under 10 km) or a refusal shows with **Try again** for 3 s.
- `pages/Screen.tsx`: `fx practice` wiggles that player's tile for 600 ms. CSS `tile-wiggle` rotates ±8°; with reduced motion it shows a 600 ms amber outline instead.
- Server: the reducer's `player:practice` (LOBBY only, and the sender must be a player) sends `fx practice {playerId}` to Screens and `fx practiceResult {distanceKm}` to that player only. Nothing is stored. The gateway limits it to 1 per 2 s per player (`practiceLimiter`, keyed by code and player, "Slow down"). New constants in `shared/constants.ts`: `WORLD_BOX`, `PRACTICE_TARGET`, `MAP_MAX_ZOOM`, `TILE_ERROR_LIMIT`, `TILE_ERROR_WINDOW_MS`, `PRACTICE_RESULT_MS`.
**Decisions:** DECISIONS 20: the limit lives in the gateway and runs before the reducer; the World box; the 3 s result and Try again; the attribution line and when the badge shows; the literal 4-error switch (a phone at world zoom that requests only 3 CARTO tiles stays blank until the player zooms or pans); and the wiggle.
**New dependencies:** `leaflet` and `@types/leaflet` (dev, like the other client libraries Vite bundles): the stack's map library, used directly as the spec asks (no react-leaflet).
**Notes for next session:** `useLeafletMap` builds the map once per element, so a new box needs a new `MapView` (key it on the round). F13 puts the VIP settings card above the practice map in `Lobby`. The round map (F14 onwards) adds `maxBounds` from `clampBounds` with `maxBoundsViscosity: 1`, `minZoom` fitting the padded box, the `player:aim` throttle on `move`/`moveend`, and the Screen-size attribution (16 px); `MapView` is phone-only for now. Review items left: the Screen tile keeps its `tile-wiggle` class after the animation until the next fx, so a remount replays it; Leaflet's own pan and zoom animation ignores reduced motion; the phone page has no `h1`.
**How to try it:** `npm test` (client/src/lib/tiles.test.ts 4 tests on the switch rule; client/src/components/MapView.test.tsx 4: crosshair and zoom buttons, Lock in and Enter send the centre, the CARTO-to-fallback switch with badge and attribution, fallback without a key; Play.test.tsx practice flow; Screen.test.tsx wiggle; server/reducer.lobby.test.ts practice effects and refusals; server/sockets.test.ts 1 per 2 s per player). Run `npm run tiles:fallback` once, then `npm run dev`. Click **Show** on http://localhost:5180, then join on a phone on the same Wi-Fi at http://<laptop-ip>:5180/play/CODE, pan, and press Lock in. Playtest: `.playtest/F12/scenario.ts` (map UI, practice result and wiggle, 3 s clear, Try again and the rate limit, pan and lock in, and the tile-error switch after a zoom with an unreachable CARTO host).

## F11 — Map config and fallback tiles (2026-11-07)
**What changed:**
- `GET /api/config` (`server/http.ts`, built by `tileConfig` in `server/fallbackTiles.ts`): `{tiles, fallbackTiles}` as `ConfigResponse`/`TileLayerConfig` in `shared/types.ts`. `tiles` is CARTO `dark_nolabels` with `PINPOINT_CARTO_KEY` URL-encoded into `?key=` (maxNativeZoom 20, "© OpenStreetMap contributors © CARTO"), or null without the key. `fallbackTiles` is `/tiles/fallback/{z}/{x}/{y}.png` (maxNativeZoom 6, "Made with Natural Earth"). `Cache-Control: no-store`, since the body carries the key. `index.ts` passes `env.cartoKey` in as the `cartoKey` option.
- `GET /tiles/fallback/:z/:x/:y.png` serves `{z}/{x}/{y}.png` from `fallbackTilesDir` (default `server/assets/fallback-tiles`, relative to the working directory) with `Cache-Control: public, max-age=2592000, immutable`. A valid address with no file gets the shared `water.png`. Anything outside zoom 0–6 or the zoom's grid, or anything that isn't digits, is a 404, as is any request when nothing has been rendered. A read error other than not-found goes to the error handler instead of quietly serving sea.
- `npm run tiles:fallback` (`scripts/render-fallback-tiles.ts`) renders `world-atlas` `countries-10m.json` with `topojson-client`, `d3-geo` (Web Mercator) and `@resvg/resvg-js` in the spec's colours: water `#0A0B0D`, land `#17181B`, coastline mesh `#3A3D44` at 1 px, country-border mesh `#4A4E57` at 0.75 px. The output is 3,295 tiles plus one `water.png` (22 MB, about 6 minutes) in the gitignored `server/assets/fallback-tiles/`.
**Decisions:** DECISIONS 19 (CARTO maxNativeZoom and attribution, the tiles folder and its layout, the water fallback, the render shortcuts, Docker layer advice).
**New dependencies (all dev):** `world-atlas` (the Natural Earth 10m TopoJSON the spec names), `topojson-client` (TopoJSON to GeoJSON and meshes), `d3-geo` (Web Mercator projection and clipping to SVG paths), `@resvg/resvg-js` (SVG to PNG without a browser), and `@types/topojson-client` and `@types/d3-geo` for their types.
**Notes for next session:** F12 (MapView) reads `/api/config`; use `tiles ?? fallbackTiles`, plus the client switch after 4 errors in 10 s. Run `npm run tiles:fallback` once in a fresh worktree, or the fallback route returns 404s. F60's Dockerfile must render the tiles in the build stage, in a layer that depends only on the script and the lockfile (it takes 6 minutes), and copy `server/assets/fallback-tiles/` to the runtime image at the same path relative to `WORKDIR`. Gotchas: resvg loads system fonts by default, which costs about 6 s per tile, so it is turned off; d3's resampling runs before the clip, so it is turned off too. A few Maldives islets in the 10m data are wound inside out and get reversed.
**How to try it:** `npm test` (server/http.test.ts: config with and without the key, key never logged, three-tile fixture, cache headers, water fallback, 404s out of range and when nothing is rendered; scripts/render-fallback-tiles.test.ts: zoom 0 is a 256 × 256 PNG, open sea returns null). Then run `npm run tiles:fallback`, then `npm run dev`. `curl -s localhost:3010/api/config` gives `tiles: null`, or the CARTO URL when `PINPOINT_CARTO_KEY=x` is in the environment. Open http://localhost:3010/tiles/fallback/0/0/0.png (the world) and …/6/33/22.png (Switzerland). There is no UI yet and there are no Kim checks (the real CARTO key is already DECISIONS 6's F60 check).

## F10 — Player join and lobby (2026-11-07)
**What changed:**
- `pages/Play.tsx` replaces the placeholder. **Join form**: name (16 max), a 6 × 4 grid of radio emoji (taken ones disabled at 30%, first free pre-selected), **Join** (shows "Join…" until the taken list arrives). Refusals come back inline under the name with the fields kept ("That name is taken", "That emoji is taken", "This game is full (12 players)", the join limit). **Phone lobby**: top bar (emoji, name, "0 · 1st of 3", connection dot green/amber/red with "Reconnecting"/"Offline" text, ⋯ menu with **Change name** in LOBBY only and **Leave game**), "Waiting for ★ Mika to start" (the VIP sees "You're the VIP ★"), and the read-only settings row "NAME · MIXED · 10 ROUNDS · 30 S". Full-screen **kicked** ("You were removed from this game") and **room gone** ("This game has ended") screens link home. Wake Lock while in the room. Other phases show the bare phase name (`shortcut:` comment).
- `lib/playerIdentity.ts` (ported from Sketchy): `newPlayerKey` (21 characters from `crypto.getRandomValues`), `savePlayer`/`loadPlayer`/`clearPlayer` under `pinpoint:player:CODE`. A stored identity rejoins silently. The identity is saved on the join's `{ok: true}` and after a rename, and cleared on Leave game or a refused stored rejoin. The device keeps one key across retries.
- `lib/roomStore.ts` gains `connection`. `useRoomSocket` sets it on `connect`/`disconnect` (`socket.active` decides amber or red), maps `kicked` to `KICKED_ERROR`, and returns its socket ref for page events. `FakeSocket` has `connected` and `active`.
- `GET /api/rooms/:code/exists` also returns `takenEmoji`. `KICKED_ERROR` is in `shared/constants.ts` (the reducer uses it).
**Decisions:** DECISIONS 18 (`takenEmoji`, which refusals go back to the form, storage timing, Leave without a confirm, name-only rename, dot colours, category segment and VIP card deferred to F13).
**New dependencies:** none.
**Notes for next session:** F12 puts the practice map into `Lobby` in `Play.tsx`. F13 replaces the VIP's "You're the VIP ★" with the settings card, adds the category name to `settingsLine` (and the Screen's row), and adds the ★ VIP drawer button to `TopBar`. Later phases replace the phase-name placeholder in `PlayerRoom`. The aria-live announcements are still to come with the round phases. Review items left: Leave game has no two-tap confirm and no destructive border (it sits in a menu), and the rename form opens inline under the top bar rather than as a sheet.
**How to try it:** `npm test` (client/src/pages/Play.test.tsx 14 tests: join form and taken emoji, join and storage, name taken, full, silent rejoin, refused stored identity, rename, menu outside lobby, leave, kicked, kicked rejoin, room gone, connection dot, ordinals; client/src/lib/playerIdentity.test.ts 3; server/http.test.ts exists with `takenEmoji`). `npm run dev`, then **Show** on http://localhost:5180 on a laptop, and on a phone on the same Wi-Fi open http://<laptop-ip>:5180/play/CODE. Playtest: `.playtest/F10/scenario.ts` (8 steps, all pass: form, join and storage, taken emoji and name, refresh rejoin, rename on phone and Screen, 13th player full, leave, unknown code).

## F09 — Landing page and Screen lobby (2026-11-07)
**What changed:**
- Client routing (`client/src/App.tsx` `AppRoutes`, `BrowserRouter` in `main.tsx`): `/` Landing, `/screen/:code` Screen, `/play/:code` a placeholder for F10. `client/src/lib/`: `socket.ts` (WebSocket-only `createSocket`), `roomStore.ts` (Zustand: `view`, `clockOffset = serverNow − Date.now()`, `error`, `fx`; `serverNow()`), `useRoomSocket.ts` (joins on every connect; `state`/`fx`/`room:closed` into the store; a refused join's text becomes `error`), `useWakeLock.ts`, `fullscreen.ts`, `audio.ts` (all adapted from Buzzr).
- `pages/Landing.tsx`: wordmark flaps, the line, **Join a game** (letters only, upper-cased, 4 max; `GET /api/rooms/:code/exists`; "No game with that code") and **Show a game on this screen** (`POST /api/rooms` → `/screen/:code`) with the hint; `md:grid-cols-2`, no admin link.
- `pages/Screen.tsx`: a 1920 × 1080 stage scaled by `stageScale` and letterboxed; **Click to start** overlay (`StartOverlay`: unlocks audio, fullscreen, Wake Lock); lobby with the room code in 200 px flaps, the QR (`qrcode.react`, the view's `joinUrl` = `PUBLIC_URL/play/CODE`), the join URL, player tiles (emoji, 4 px colour border, name, ★ VIP; disconnected dimmed, waiting dashed) or "Waiting for the first player: they'll be the VIP", the 48 px join strip; any refused join or `room:closed` shows the text ("This game has ended") with a link home. `components/SplitFlap.tsx` is static (F53 animates it).
- `RoomExistsResponse` moved from `server/http.ts` to `shared/types.ts`; `GAME_ENDED_ERROR` in `shared/constants.ts` (the gateway's `roomGone`).
**Decisions:** DECISIONS 17 (code input, full rooms pass the landing, error texts, stage scaling brought forward from F55, audio unlock until F56, static flaps, settings row deferred).
**New dependencies:** `react-router` (the stack's routing), `zustand` (the stack's snapshot store), `qrcode.react` (the roadmap's QR to `/play/:code`), `jsdom` + `@testing-library/react` + `@testing-library/dom` (dev: the stack's component tests; `@testing-library/dom` is the React library's peer). All client libraries are devDependencies like React, since Vite bundles them.
**Notes for next session:** F10 replaces `pages/Play.tsx` and reuses `useRoomSocket` with a `player:join` `JoinRoom`; add a `kicked` listener there (the Screen never gets one). `client/src/test/fakeSocket.ts` drives pages in tests (`makeSocket` prop). The Screen renders only the bare phase name outside LOBBY (`shortcut:` comment) until the round features land. The VIP lobby feature adds the settings departures row under the tiles. F55 keeps its stage-scale and keys tests; `stageScale` is exported from `Screen.tsx`. F56 replaces `lib/audio.ts` with Howler's unlock.
**How to try it:** `npm test` (client/src/pages/Landing.test.tsx 8 tests, Screen.test.tsx 9: lobby with 0 and 3 players, VIP star, ended on `room:closed` and on a refused join, clock offset, overlay fullscreen, Wake Lock and audio, stage scale). `npm run dev`, open http://localhost:5180 on a laptop, press **Show**, click the overlay; in a phone browser on the same Wi-Fi open http://<laptop-ip>:5180 and type a wrong code ("No game with that code"). Playtest: `.playtest/F09/scenario.ts` (8 steps, all pass, including no sideways scroll at 360 px).

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

