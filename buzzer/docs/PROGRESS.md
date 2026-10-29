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

## F53 — Set category and difficulty fields (2026-10-29)
**What changed:**
- `QuestionSet` has optional `category` (1–40, trimmed by the schema; `SET_CATEGORY_MAX`) and `difficulty` (`'easy' | 'medium' | 'hard'`; `DIFFICULTIES` in `shared/constants.ts`). `questionSetSchema`, and so the set file schema, room creation and new game, accept both and still accept sets without them. `schemaVersion` stays 1.
- All 60 starter sets in `shared/starterSets/*.json` carry `category` (the title before " – ", e.g. "Philippine TV & Pop Culture") and `difficulty` (the id's level), right after `title`. Only those 120 lines changed.
- Set editor: **Category (optional)** with a `<datalist>` of the categories this browser's sets use, trimmed on blur; **Difficulty (optional)** select (None, Easy, Medium, Hard). Both autosave like the title; blank or None removes the key. Helpers `withCategory`, `withDifficulty`, `categoriesInUse`, `DIFFICULTY_LABELS` in `client/src/lib/setEditor.ts`.
- Export writes both, import keeps both, Duplicate copies both (it already spread the source; now tested).
- Tests: `schemas.test.ts` +4, `starterSets.test.ts` +2 (and the key order), `importExport.test.ts` +3, `db.test.ts` +1, `setEditor.test.ts` +3, `SetEditor.test.tsx` +4. 1255 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F53 (trim on blur and removing blank keys; the datalist and where labels live; no Dexie backfill for already-seeded starters).

**Notes for next session:**
- Browsers seeded before F53 keep stored starter copies without the two fields. F53 adds no Dexie upgrade, since F54 stops storing built-ins. F54's v3 clean-up must compare such a copy as if it had the bundled category and difficulty; the F54 roadmap bullet now says so.
- Playtest (Playwright, 390×844), 6 of 6 steps passed on a fresh database: starter fields shown in the editor, the datalist held the 20 starter categories, Category and Difficulty survived a reload, Duplicate copied them, export wrote them (category trimmed), re-import kept them. No console errors. Trim-on-blur was added after the playtest (review should-fix), covered by `SetEditor.test.tsx`.
- Nothing shows category or difficulty outside the editor yet: the set list (F55) and the Screen title card come later.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, open any set (or **New set**).
2. Type a category: the suggestions list the categories already in use. Pick a difficulty. Wait for **Saved**, reload: both are still there.
3. Back on `/sets`, **Export JSON** the set: the file has `category` and `difficulty`. **Import JSON** it back, and **Duplicate** it: both keep the fields.
4. A browser seeded before today shows starters without the fields; a fresh profile (or deleting the `buzzr` IndexedDB) shows them.

## F52 — Screen fixes from the backlog (2026-10-29)
**What changed:**
- Reveal fit:
  - `useShrinkToFit` takes `max: number | 'css'`. With `'css'`, it clears its inline size and caps at the size the classes give, so it only ever shrinks.
  - `ScreenQuestion` puts the length-step class (F18) on the text row, which is `overflow-hidden` and has the hook (min 12 px). The `h1` inherits the size.
  - It runs in every question phase. It refits on resize (the answer, the scorer pill or the banner appearing) and on a new question.
- `PairHostPhone` builds its QR from `joinPageOrigin(useJoinOrigin())`, like the join QR. A Screen on `localhost` now hands the phone `http://<LAN-IP>:5173/host/:code#t=…`. The Host remote's Pair button gets the same.
- `HOVER` is on Pair host phone and its Hide button, the lobby's Start game, and the HostSettings switches and steppers.
- Tests:
  - `useShrinkToFit.test.tsx` +4 (`'css'`: keeps the class size, shrinks under it, fresh cap on refit, refit on resize).
  - `PairHostPhone.test.tsx` +2 (LAN origin with the page port; page origin when null).
  - `Screen.test.tsx` +3 (LAN pairing link, lobby and dialog hover, the text row fitted by measurement). 1238 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F52 (measured question fit; pairing origin).

**Notes for next session:**
- Playtest (Playwright):
  - Plain Screen: Animals – Easy Q1 at REVEAL showed both lines above the answer at 1920×1080, 1366×768 and 1280×720.
  - Hosting Screen (bar shown), Ana judged correct: at 1920×1080 the full step (≈92 px) would not fit above the answer and the scorer pill. The row shrank to 70 px (49 px at 1366×768, 47 px at 1280×720), and the question then fits on one line. The row's scrollHeight equals its clientHeight, so nothing is clipped.
  - Pill bottom is 25–42 px above the bar top.
  - Pairing QR decoded to the LAN address. No console errors.
  - Screenshots are in `.playtest/F52/`.
- The question text can step down when the answer appears (the card loses height). That is the fit working, not a flicker.
- `docs/PROGRESS.md`: the `<!-- entries below -->` marker had drifted below F35, so `roadmap.mjs next` showed F35 as newest. It is back under the template.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and choose **Host this set** on Animals – Easy, then **Use this device as the Screen**. Join from a phone.
2. In the lobby, hover Pair host phone, Start game and the settings: each shows the ink border. Open **Pair host phone** and scan it with a phone: it opens `http://<LAN-IP>:5173/host/…`.
3. Start, buzz on Q1 and judge Correct. At 1280×720 (devtools), the question stays whole above LION and the scorer pill.

## F51 — Host remote link after room creation (2026-10-29)
**What changed:**
- `RoomCreated.tsx` has a third button, **Use this phone as the host remote**. It navigates to `/host/:code`. `hostSet` has already saved the hostToken, so the remote joins with the stored token and no pairing hash.
- The button shows on both **Host a game** (landing page) and `/sets` **Host this set**, since both render `RoomCreated`.
- Tests: `Landing.test.tsx` +1 and `Sets.test.tsx` +1 (the button, the `/host/WXYZ` route, the token still stored), and `Host.test.tsx` +1 (a stored token with no hash sends `host:join` and renders Host controls). 1229 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-29 for F51 covers the button's style and placement.

**Notes for next session:**
- Playtest (Playwright, 390×844), 5 of 5 steps passed. I created a room from Host a game, opened `/screen/:code` in a second tab and tapped the new button. It went to `/host/:code` with no `#t=`, joined as host and showed the answer. Start, Open buzzers and Reveal from the remote all reached the Screen. `/sets` Host this set showed the three buttons. No console errors.
- Not exercised: judging a buzz. The scripted DOM `.click()` on BUZZ doesn't fire `pointerdown`. F51 doesn't touch buzzing.
- A `node dist/server/index.js` in `buzzer/` has been running since 2026-10-27. It isn't from this session, so I left it alone.

**How to try it:** `npm run dev`.
1. On a phone, open `http://<laptop-LAN-IP>:5173`, tap **Host a game**, pick a set and tap **Create room**.
2. Tap **Open the Screen on another device**, then open the URL it shows on the laptop.
3. On the phone, tap **Use this phone as the host remote**. Host controls appear without pairing. Join from another phone and run a question.

## F50 — New game: picker on the Screen and the remote (2026-10-29)
**What changed:**
- `api.ts`: `replaceSet(code, hostToken, body)` (`PUT /api/rooms/:code/set`, JSON, Bearer). A 409 throws `NewGameTakenError` ("A new game has already been set up."); other errors carry the server's message.
- `hostRoom.ts`: `gatherImages` (playable check, each image once, 50 MB) and `uploadImages` are shared by `hostSet` and the new `hostNextSet(code, hostToken, set, keepScores)`: checks, then the PUT, then the uploads. An upload failing after the PUT throws `SetImagesError`; `uploadSetImages` retries only the uploads.
- New `components/NewGamePicker.tsx`: a modal over the page (portal to body). It lists this browser's saved sets newest first (seeding the starters on a fresh phone), marks drafts "Not playable yet", has **Keep scores** (default off), **Start new game** ("Starting new game…" while it runs), the error inline, **Retry images** after an upload failure, and Cancel / Esc. A 409 toasts and closes. It closes itself if the room leaves FINAL before this device sent anything.
- Screen: **New game** in the host bar in FINAL only (never without the token). The bar and shortcuts unmount while the picker is open. Remote: **New game** on the Game over card. Both keep the picker's state above the phase switch, so it survives the LOBBY snapshot during uploads.
- Tests: `api.test.ts` +5, `hostRoom.test.ts` +7, new `NewGamePicker.test.tsx` (11), `Screen.test.tsx` +3, `Host.test.tsx` +2. 1226 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-29 for F50 cover:
- drafts pickable and marked
- where the picker's state lives, its self-close, and the button-label progress
- `SetImagesError` and **Retry images**
- the 409 toast
- the Screen bar button, the bar unmounting under the picker, and the picker's sizing

**Notes for next session:**
- Playtest (Playwright, Screen at 1920×1080, remote, one Player), room SGRA:
  - The Screen offered New game in FINAL. With Keep scores off it went back to the lobby with the same code and player, the phone showed score 0 and "Waiting for the host", and Start game played question 1 of 10.
  - The remote's New game with Keep scores on kept 100. Start game played question 1, and the Screen text had no answer before reveal.
  - A Screen without the token showed no New game.
  - The first layout check found the list running past the dialog, then a horizontal overflow at 390 px and a squashed button. Both were fixed and rechecked at 1920×1080 and 390×844.
- Not run live: the 409 race (two devices pressing at once). Unit tests cover it.
- Deviations: the tabs shared one browser context, and the game reached FINAL through End game after Q1 rather than a 1-question set.
- The DECISIONS "Proposed spec changes" entry for new game still needs to go into SPEC.md (Kim's edit).

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and host a set. Pair a phone as Host, and join from another phone.
2. Start, play a question, then **End game**.
3. On the Screen, move the mouse and click **New game** in the bar. Pick a set, leave **Keep scores** off, then **Start new game**. Every device shows the lobby with the same code and players, with scores at 0.
4. Start game and play. End again, then use **New game** on the remote's Game over card with **Keep scores** on. Scores carry over.

## F49 — New game: server (2026-10-29)
**What changed:**
- Shared: `NewGameBody {set, keepScores}`, `NewGameResponse {ok: true}`, `newGameBodySchema` (with the type-equality check).
- Reducer: `host:newGame {set, keepScores}`, FINAL only (else `WRONG_PHASE_ERROR`). Returns LOBBY with the new set, `questionIndex` −1, the per-question fields, `judgements` and `showScoreboard` cleared. Players (disconnected too), `kickedIds`, `settings`, code and `openingCounter` stay. Scores go to 0 through `applyJudgement` unless `keepScores`. No effects.
- HTTP: `PUT /api/rooms/:code/set` in `server/http.ts`. 404 / 401 before the body is read, then `express.json` at `CREATE_ROOM_BODY_MAX_BYTES` (413), zod (400), dispatch (409 outside FINAL), then `images.deleteRoom(code)` and 200 `{ok: true}`.
- Gateway: `attachSockets` returns `{io, dispatch}` (new `Gateway`, `Dispatch` types). `index.ts` passes `dispatch` to `createApp`, bound late. The socket test harness mounts `createApp` the same way and exposes `base` and `images`.
- Tests:
  - New `server/reducer.newgame.test.ts` (27): full reset, kept fields, keepScores both ways, disconnected and kicked players, rejection from the six other phases, no undo across games, start/end on the new set, stale `windowClosed` / `reopen` / `answerTimeUp` in the lobby and on question 0.
  - New `server/http.newgame.test.ts` (13): each status, the 1 MB limit at the edge, racing PUTs (200 + 409), old images freed and only new ones uploadable, images kept on refusal, all four socket roles (Screen, hosting Screen, Host, Player) get LOBBY with the new count, scores on every device, no new-set answers or notes in Screen/Player frames (through `host:start`).
  - `schemas.test.ts` +3. 1198 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-29 for F49 on the route's check order, the error mapping, the gateway's return shape and the default `dispatch`. The two earlier F49 rows (HTTP not socket; what resets) were followed as written.

**Notes for next session:**
- No UI yet. F50 adds the picker on the Screen (when it holds the hostToken) and the remote, then re-uploads the new set's images with the existing route after the PUT succeeds.
- The client must send `Content-Type: application/json`; express ignores other bodies, which then fail zod with 400.
- No playtest: server-only feature. Socket coverage is in `http.newgame.test.ts`.
- The DECISIONS "Proposed spec changes" entry for new game still needs to go into SPEC.md (Kim's edit).

**How to try it:** `npm run dev`. Host a set at `http://localhost:5173/sets`, join a phone, Start, then End game on the remote. Copy the Screen's localStorage value `buzzr:hostToken:CODE`, then:
`curl -i -X PUT localhost:3000/api/rooms/CODE/set -H "Authorization: Bearer TOKEN" -H 'Content-Type: application/json' -d @set.json` with `{"set": <exported set JSON>, "keepScores": false}`. Every device returns to the lobby. A second identical request answers 409.

## F48 — Seed starter sets into My sets (2026-10-29)
**What changed:**
- `client/src/lib/db.ts`:
  - `version(2)`, same stores. `populate` (fresh browser) adds the sample at `now`, then the 60 `STARTER_SETS` at `now - 1 - i`.
  - The v1 → v2 `upgrade` adds each starter whose id is not stored at `oldest - 1 - i` (`oldest`: smallest stored `updatedAt`, or now). Own sets stay on top and unchanged.
  - Both chained on Dexie promises, no native `await`. `STARTER_SETS` is a static import, so the data lives in the lazy `db` chunk.
- Build: main `index` chunk 438.92 kB before and after; `db` chunk 112.74 → 286.57 kB (41.83 → 90.27 kB gzip).
- Tests:
  - `db.test.ts` +5: fresh 61 in order with stamps; v1 with two user sets; empty v1 stamped from now; v1 holding a starter id keeps it; a deleted starter is not re-added (fresh and after upgrade). The sample-seed, delete-sample, order, and duplicate tests now include the starters.
  - `Sets.test.tsx` +1: **Host this set** on Animals – Hard sends its 15 questions at 300 points. Count and order expectations take the 60 starters; the empty-state tests clear the table.
  - `Landing.test.tsx`: the picker lists all 62, the newest own set checked.
  - 1155 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F48 cover the populate/upgrade stamping (including the 1 ms gap a skipped id leaves) and the bundle sizes.

**Notes for next session:**
- Playtest (Playwright), all pass:
  - Upgrade path (old profile with a v1 database): 62 sets, own Untitled set first, sample, then the starters 1 ms apart. A deleted Animals – Easy stayed deleted after reload.
  - Fresh profile: 61 cards, sample first, Words & Language – Hard last. **Host a game** preselects the sample.
  - Animals – Easy hosted as room, one Player buzzed, C judged Correct: Screen showed "+100", scoreboard 100, N went to Question 2 / 15.
- Found, not fixed (Backlog): the Screen's question card clips a two-line question at REVEAL.
- The DECISIONS "Proposed spec changes" entry for starter sets is still pending Kim's edit of SPEC.md.
- Browsers keep IndexedDB per origin: the deployed site and `localhost:5173` seed separately.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`: the sample, then Animals – Easy … Words & Language – Hard. An existing profile keeps its own sets above them.
2. **Host this set** on any starter, **Use this device as the Screen**, join from a phone, and play a question: Correct scores 100, 200 or 300 by level.
3. Delete a starter and reload: it stays gone.

## F47 — Starter set data (2026-10-29)
**What changed:**
- `shared/starterSets/<slug>.json`: 20 categories × Easy/Medium/Hard × 15 questions, 60 sets and 900 questions. They were written in Claude Desktop and copied from `~/Downloads/buzzr-starter/`, with the 39 review fixes in `~/Downloads/buzzr-starter-fixes.json` applied by a one-off scratchpad script. The script is not in the repo.
  - Each file is an array of 3 sets in the set file shape, so it also imports through Import JSON.
- `shared/starterSets/index.ts` exports:
  - `STARTER_CATEGORIES`: 20 slugs in list order.
  - `StarterCategory`.
  - `STARTER_SETS`: the 60 sets, parsed with `questionSetSchema.array()` at module load.
- Config:
  - `resolveJsonModule` in `tsconfig.json` and `tsconfig.node.json`.
  - `tsconfig.build.json` excludes `shared/starterSets`, so `dist/shared` has no question data.
  - No new dependency.
- `shared/starterSets.test.ts` (7 tests):
  - order and count;
  - schema parse unchanged, with 15 questions each;
  - key order;
  - titles, points and question ids by level;
  - 900 unique ids and no pictures;
  - `createRoomBodySchema` accepts every set;
  - spot-checks of 4 fixes.

**Decisions:** DECISIONS rows dated 2026-10-29: "starter plan" (content and review), and F47 (file layout, parse instead of cast, the tsconfig changes).

**Notes for next session:**
- F48 seeds these into Dexie. Import `STARTER_SETS` statically into `client/src/lib/db.ts`: it is already a lazy chunk, and the upgrade transaction cannot await a dynamic import.
- Nothing imports the data yet, so the client bundle is unchanged (main `index` 438.9 kB, `db` 112.7 kB). Record F48's sizes against these.
- Only 4 of the 39 fixes are asserted in tests. The review recomputed all 39 against the originals and found 0 differences.
- Known level miss, left as is: `ph-pop-culture-hard-01` (Cardo Dalisay) is easy for Hard. No verified replacement.

**How to try it:** `npx vitest run shared/starterSets.test.ts`. To see the content in the app before F48, Import JSON does not take an array. Copy one set object out of a file into its own `.json` and import that on `/sets`.

## F46 — Slim runtime image and CI job (2026-10-28)
**What changed:**
- `package.json`: `dependencies` is now only what `dist/server` imports: express, proxy-addr, socket.io and zod.
  - react, react-dom, react-router, dexie, howler, `@dnd-kit/core`, `@dnd-kit/sortable`, qrcode.react, zustand, socket.io-client and nanoid moved to `devDependencies`. Versions are unchanged; the lockfile only gained `dev: true` flags.
  - The Dockerfile is unchanged apart from a comment: its prod-deps stage already ran `npm ci --omit=dev`.
- **Image: 266 MB to 245 MB.** `node_modules` inside it went from 41 MB to 18 MB. The `node:24-slim` base is 230 MB, so that is most of what is left. The README's Docker section records this.
- Root `.github/workflows/ci.yml` (outside `buzzer/`):
  - New `buzzer-changes` job: diffs `buzzer/` and `ci.yml` against the PR base or the push's `before`.
  - New `buzzer` job, run only when that says changed: Node 24, `npm ci`, format:check, lint, typecheck, test, build.
- Tests: new `server/dependencies.test.ts` (3). It scans the non-test sources under `server/` and `shared/`, and fails if `dependencies` misses a server import or lists a package the server does not import. A probe file in `server/` that imported nanoid turned it red. 1138 tests in total. No new dependency.

**Decisions:** two DECISIONS rows dated 2026-10-28 for F46:
- what `dependencies` holds, nanoid's move, and the reversed F34 row
- the change gate in `ci.yml`, and why there is no `paths` filter or smoke test there

**Notes for next session:**
- `npm run smoke:docker` printed PASS on the new image (`buzzr:smoke`, 245 MB).
- **The CI job has not run on GitHub yet**: nothing was pushed. `actionlint` (Docker `rhysd/actionlint`) passes the new jobs. Its only finding is an existing SC2086 in the hub `axe` step. The gate script was run locally against four cases: a change, no change, an all-zero base, and a manual run. The job's steps were run locally from a clean `npm ci`.
- On the first push that touches `buzzer/`, check the Actions tab: "buzzer changed?" should print `changed=true`, and "build buzzer" should be green.
- `deploy-buzzer.yml` still runs its own checks job on pushes to main. It has no build step, but its Docker build covers one.

**How to try it:**
1. `npm run smoke:docker` prints `PASS`. `docker images buzzr` shows `smoke` at 245 MB.
2. `npm test -- server/dependencies.test.ts`. Add `import 'react';` to any server file and it fails.
3. After a push or a PR touching `buzzer/`, the CI workflow shows "build buzzer".

## F45 — Socket test harness and typed host emit (2026-10-28)
**What changed:**
- New `server/test/sockets.ts`, the gateway harness shared by the four `server/sockets*.test.ts` files.
  - It exports `TestClient`, `TOKEN`, `start`, `stopAll`, `record`, `recordStates`, `nextState`, `flush`, `screenJoin`, `hostJoin`, `playerJoin`, `openTable` and `serverDisconnect(h, client)`.
  - `start({room, fakeMonotonic, playerJoinLimit})`: `room: null` starts with no rooms, as after a restart. The harness exposes `io`, `rooms`, `connect`, `advance` and `advanceMono`. `advanceMono` throws unless the monotonic clock is fake.
  - `stopAll` closes every gateway and client. Each file calls it from `afterEach`.
- The four test files keep only what is theirs:
  - fake timers and the console spy (buzz, host)
  - `buzz` and `sampleRtt` (buzz)
  - `buzzedTable` (host)
  - `midGame` and a `start` wrapper (reconnect)
  - `nextFx`, `TOKEN_HASH` and `SECRETS` (sockets)
- `client/src/lib/useHostCommand.ts`: the `emit.bind(...) as` cast is gone. `emitHost` takes a `HostEmitter` interface, and the `GameSocket` is assigned to it structurally.
- Tests: 1135 before and after (54 socket tests before and after). No test was changed, and there is no new dependency.

**Decisions:** two DECISIONS rows for F45:
- which clocks and limits `start` fakes or exposes, and why
- how `HostEmitter` stays type-checked with no cast

**Notes for next session:**
- No behaviour change, so no playtest.
- The review raised two should-fix points. Neither was changed:
  - `start` has no option for the clock's start time, and no test needs one.
  - `record<T>` keeps its `as T`, which the old copies already had.
- `sockets.test.ts` still has a deliberate `as` cast on `emitWithAck` for its unknown-event test.

**How to try it:** `npm test`. Typecheck with `npm run typecheck`.

## F44 — Favicon and hover states (2026-10-28)
**What changed:**
- `client/public/favicon.svg`: a round buzz-red button (`--color-buzz` fill, `--color-buzz-edge` rim, a soft highlight) on a rounded `--color-bg` square. `client/index.html` links it with `rel="icon" type="image/svg+xml"`.
- Hover:
  - `@utility hover-tint` in `index.css`: an 8% ink wash as `background-image`, so solid buttons keep their colour.
  - New `client/src/lib/hover.ts`: `HOVER = 'not-disabled:hover:border-ink not-disabled:hover:hover-tint'`.
  - Added to the Screen host bar (`barButton`, the shortcuts sheet's Close, the Show controls pill), Sets (`smallButton`, Import JSON, New set, Room created's two buttons) and SetEditor (`smallButton`, Add question, the Preview bar).
  - `ConfirmButton`'s armed button keeps its red border under hover (`not-disabled:hover:border-red-400!`).
- `vite.config.ts`: `test.css.include` lets `*.css?raw` imports through (Vitest blanked them).
- Tests:
  - New `client/src/favicon.test.ts` (2): the icon link, and the SVG colours equal the `index.css` tokens.
  - New `client/src/test/hover.ts`: `buttonsWithoutHover(root)`.
  - `Screen.test.tsx` +1 (bar with Correct/Wrong and a disabled Undo, the shortcuts sheet, Show controls), `Sets.test.tsx` +1 (list and Room created), `SetEditor.test.tsx` +1 (editor and Preview). Removing `HOVER` from `barButton` fails the Screen test.
  - 1135 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-28 for F44 cover:
- favicon colours from the `index.css` theme tokens, not `shared/constants.ts` (which has only the player palette)
- the tint as an image layer
- the extra buttons covered (Room created, Preview, shortcuts sheet, Show controls) and the armed Confirm's red
- the Vitest `?raw` CSS setting

**Notes for next session:**
- The tests check class strings only. That the classes compile was checked by hand in `dist/client/assets/*.css`: both rules are `:not(:disabled):hover` inside `@media (hover:hover)`, and `favicon.svg` is copied into `dist/client`.
- Playtest (Playwright, Screen at 1920×1080, 7 of 7 steps passed):
  - `/favicon.svg` 200. No console errors on `/`, `/screen/:code`, `/sets` and the SetEditor, and no `/favicon.ico` request (headless Chromium may not fetch icons at all, so that part is weak).
  - Hover turned the border from `edge` to `ink` and added the tint on every enabled host-bar, Sets and SetEditor button. Start game stayed yellow under the tint. Disabled ↑/↓ and the stepper's "−" did not change.
  - Touch was not emulated; the `@media (hover:hover)` wrapper is in the built CSS.
- The Screen lobby's own controls (Pair host phone, side-panel Start game, settings switches and steppers) have no hover yet: Backlog.

**How to try it:** `npm run dev`, then on the laptop with a mouse:
1. Open `http://localhost:5173/sets`: the tab shows the red buzzer icon. Hover New set, a card's Open or Delete: ink border and a faint tint. Tap Delete, then hover Confirm: the border stays red.
2. Open a set: hover Add question, Preview, and the Preview bar's buttons. The disabled ↑ on question 1 does not change.
3. Host the set, use this device as the Screen: hover the host bar's buttons. On a phone, nothing changes on tap.

## F43 — Preview: show answer (2026-10-28)
**What changed:**
- `previewView(set, index, reveal = false)` in `client/src/lib/setEditor.ts`. With `reveal`, the view is phase REVEAL with `question.answer`, `scorerId: null` and no players. Host notes are never copied.
- `QuestionPreview`: a **Show answer** toggle (`aria-pressed`) first in the bottom bar, also on the `A` key.
  - On, the preview draws the Screen's own reveal layout (answer card, no scorer chip).
  - Previous and Next (buttons and ←/→) turn it off. Closing unmounts it, so it is off on the next opening.
  - A blank answer (after trimming) disables the button, and `A` does nothing.
  - `A` is ignored on key repeat and with Ctrl, Meta or Alt.
  - Pressed style: accent border, text and a faint accent tint. The bar's base button class is split so the border colours do not conflict.
  - The key listener now goes through `useEffectEvent` and subscribes once.
- Tests:
  - New `client/src/components/QuestionPreview.test.tsx` (7): starts off, the button shows the reveal (answer, no notes, no scorer) and hides it, the `A` key with case, modifiers and repeat, reset on Previous/Next by button and arrow, arrows at the ends leave it on, reset after close and reopen, and the disabled toggle for a blank answer.
  - `setEditor.test.ts` +1: the reveal variant.
  - 1130 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-28 for F43 covers the blank-answer rule, the key filtering, arrows at the ends, and the no-scorer reveal view.

**Notes for next session:**
- Playtest (Playwright, set editor at 390×844 and 1920×1080), 8 of 8 steps passed: toggle present and `false`, click on, `A` both ways, the reveal layout with "Jupiter" and no scorer chip, reset on Next, reset on Previous, reset on close and reopen, and disabled with `A` inert on a blank answer.
- The playtest noted the pressed state was clear only from its yellow text: the accent border lost to `border-edge`. Fixed after the playtest (accent border and tint). Not re-screenshotted.
- The DECISIONS "Proposed spec changes" backlog entry already carries the F43 spec text.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, open a set and tap **Preview** on a question.
2. Tap **Show answer** or press `A`: the answer appears as at reveal. Press `A` again to hide it.
3. Turn it on, then press → or **Next →**: the next question opens with the answer hidden. Close and reopen: also hidden.
4. Clear a question's answer and preview it: **Show answer** is disabled.

## F42 — Join address and room-check limit (2026-10-28)
**What changed:**
- Server:
  - New `GET /api/config` → `{joinOrigin}`. It returns `PUBLIC_URL` when set. Otherwise, when `req.hostname` is loopback, it returns `http://<first private IPv4>` (no port). Otherwise null.
  - `server/env.ts`: `parsePublicUrl` (a bare http(s) origin, or start-up throws) and `lanAddress(interfaces)` (10/8, 172.16/12, 192.168/16; skips `docker*`, `br-*`, `veth*`). `createApp` takes `publicUrl` and an injectable `interfaces`.
  - `GET /api/rooms/:code/exists` is limited by `ROOM_CHECK_RATE_LIMIT` (30/min per `req.ip`). Past the limit it answers 429 `{ok: false, error: ROOM_CHECK_RATE_LIMITED_ERROR}`.
- Client:
  - `useJoinOrigin` fetches the config once per Screen mount.
  - `joinPageOrigin` gives a port-less origin the page's port when the protocols match. The QR, the join URL and the bottom strip all use it.
  - The localhost note shows only once the server has answered null.
  - `roomExists` throws the server's error message. On the 429, `/play/:code` shows "Slow down" with "Too many tries. Wait a minute and try again."
- Deploy:
  - `compose.deploy.yaml` sets `PUBLIC_URL=https://buzzr.kimnejudne.dev`.
  - `docker-smoke.sh` passes it and checks `/api/config`.
  - The README env table has a `PUBLIC_URL` row.
- Tests:
  - `http.test.ts` +6: config for PUBLIC_URL, loopback, non-loopback and no LAN; the 31st check gets 429 and the window slides; forwarded IP.
  - `env.test.ts` +6.
  - `joinUrl.test.ts` +3.
  - `Screen.test.tsx` +3 (the old note test is replaced by 4 in "join address").
  - `api.test.ts` +3 and `Play.test.tsx` +1.
  - 1122 tests in total. No new dependency.

**Decisions:** the seven DECISIONS rows dated 2026-10-28 for F42 cover:
- `PUBLIC_URL` validation
- what counts as a loopback Host, the LAN pick, and a spoofed Host
- the port rule's protocol match
- the fetch-once behaviour and no note while loading (supersedes the F08 join-QR row)
- Docker needing `PUBLIC_URL` for a LAN
- the room check counting every request, and the "Slow down" title
- the pairing QR going to Backlog

**Notes for next session:**
- Playtest (Playwright, dev server):
  - `/api/config` gave `http://192.168.1.235` for loopback, null for `example.com` and for the LAN host, and `PUBLIC_URL` when set. A bad `PUBLIC_URL` stops the server.
  - Calls 1–30 of `/exists` answered 200, then 429 with the message. The join flow from `/` reached `/play/ABCD`, which showed "Slow down…".
  - The Screen lobby at `localhost:5173` read "Join at 192.168.1.235:5173/play/TEDN", in the strip too, with no localhost note.
- The 429 shows on `/play/:code`, not on the Landing code form: Landing only navigates, and the check runs on `/play`.
- Before the config answers, the QR briefly encodes the page origin. That is a few ms on localhost; review flagged it as a Should-fix, and it was not changed.
- Backlog: the pairing QR (`PairHostPhone`) still uses the page origin.
- `npm run smoke:docker` prints PASS, including the new `/api/config` check.
- The spec's proposed text for F42 is in DECISIONS → Proposed spec changes; SPEC.md is unchanged.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and host a set. The Screen lobby shows `Join at <LAN-IP>:5173/play/<CODE>` and no localhost note. Scan the QR with a phone on the same Wi-Fi: it opens the join page.
2. `curl -s localhost:3000/api/config` returns the LAN origin. `curl -s -H 'Host: example.com' localhost:3000/api/config` returns null.
3. `for i in $(seq 31); do curl -s -o /dev/null -w '%{http_code} ' localhost:3000/api/rooms/ABCD/exists; done` ends in 429. A phone opening `/play/ABCD` within that minute shows "Slow down".

## F41 — Connection awareness (2026-10-28)
**What changed:**
- `lib/ping.ts`: `keepPinging` takes `onAck` and `onLost`. `onLost` fires once when a ping is due and the previous `PINGS_LOST` (2) are unanswered. Any ack resets the count and calls `onAck`. A reconnect starts afresh.
- `lib/useRoomSocket.ts`: pings for every role (Screen, Host, Player); `attach`/`AttachSocket` removed and `Play.tsx` no longer attaches its own ping. One `linkDown` (disconnect, lost pings, window `offline`) sets `connecting` (red stays red) and starts the 5 s offline clock if not running; `linkUp` (connect, any ack) sets `connected`. `online` does nothing.
- Screen: new `components/ReconnectingBanner.tsx`, a 3.2vw amber "Reconnecting…" bar fixed across the top while `connection === 'offline'`; the stage stays underneath.
- Host Players tab: "status unknown", dimmed, on every row while the remote's own `connection` is not `connected`.
- Tests: new `useRoomSocket.test.tsx` (10: pings on every page, two misses then 5 s, one miss is nothing, late ack, ack from offline, `offline` event, `online` no-op, disconnect keeps the clock, red stays red, unmount). `ping.test.ts` +3, `Screen.test.tsx` +1 (banner at 4999/5000 ms, snapshot kept, gone on connect), `HostControls.test.tsx` +3. 1100 tests in total. No new dependency, no server change.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F41 cover: every role pinging (Kim's choice), when a silence counts as lost and what counts as an ack, the shared `linkDown` clock, the banner's placement, and "status unknown".

**Notes for next session:**
- Playtest (Playwright; Screen 1920×1080, Host, two Players): server killed, no banner at ~2 s, banner by ~8 s with the lobby underneath; Host Players tab "status unknown" for both players; restart cleared the banner (then "This game has ended", as F32). Host context set offline: "status unknown" within 300 ms, back to "online · 0 ms" within 4 s of going online.
- Not seen live: the two-missed-acks path (a killed server closes the socket at once). Unit tests cover it. Check on a real phone by walking out of Wi-Fi range.
- The banner covers the top of the lobby title and QR while it shows. Intended (DECISIONS F41); revisit if it bothers on the TV.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, pair a phone as Host, join from another phone.
2. Stop the server (Ctrl-C). After 5 s the Screen shows "Reconnecting…" across the top; the Host's Players tab says "status unknown"; the phone dots go amber then red.
3. On a phone, toggle airplane mode: its dot turns amber at once (browser `offline`).

## F40 — Host remote: game over, stable order, tab keys (2026-10-28)
**What changed:**
- Server: `hostView` ranks the players, then sends them in join order (`joinedAt`, then id). Each row keeps its `rank`. Screen and Player views stay ranked. `HostView.players` has a comment saying so.
- Host remote (`Host.tsx`):
  - In FINAL the Game tab shows a new `GameOverCard` in place of the question card: "Game over", then each player's ordinal rank, colour dot, name and score, sorted by `rank` with ties in join order. "No players" when empty. Show/Hide scoreboard stays in the secondary actions.
  - Tabs follow the WAI-ARIA pattern: roving `tabIndex`, and the tablist's `onKeyDown` (`tabForKey`) handles ←/→ (wrapping), Home and End. Each key selects the tab, shows its panel and focuses it.
- Tests: `views.test.ts` +3 (join order with rank; order kept after two score changes while the Screen re-ranks and the Player's rank updates; id tie-break). `Host.test.tsx` +10 (tab order, ←/→, wrap, Home/End, other keys; FINAL card, shared rank, no players, scoreboard toggle, no card before FINAL). 1083 tests in total. No new dependency.

**Decisions:** one DECISIONS row dated 2026-10-28 for F40 covers the card layout, the tie order, the id tie-break and where the keys are handled. The three "backlog plan (F40)" rows were Kim's choices.

**Notes for next session:**
- Playtest (Playwright; Screen at 1920×1080, Host and two Players at 390×844), every step passed:
  - Tab keys: roving `tabIndex`, → / ← with wrap both ways, Home / End.
  - After Correct for Bob and ± on both players, the Host list stayed Ann, Bob while the Screen scoreboard showed Bob 300, Ann 200.
  - FINAL: "Game over" with "1st Ann 300" and "1st Bob 300" (shared rank). Show/Hide scoreboard toggled.
- The Players tab still shows no rank, only the order. The roadmap asked for `rank` in the view, not on the row.
- The ± buttons still work in FINAL (F22), so a correction after the game re-ranks the card live.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, and pair a phone as Host. Join from two phones.
2. On the Host, open Players, then tap +100 on the second player a few times: the rows never move. The Screen scoreboard re-ranks.
3. End the game: the Game tab shows "Game over" and the ranking.
4. With a keyboard (laptop browser), focus the Game tab and press →, ←, Home and End.

## F39 — Buzz eligibility and monotonic window (2026-10-28)
**What changed:**
- Shared:
  - `Room.windowStartedAt: number | null` holds the monotonic `receivedAt` of the opening's first buzz. `UndoPoint` stores it alongside the buzzes.
  - `PlayerView.canBuzz: boolean`.
- Server:
  - `fairness.ts` gains two helpers:
    - `inWindow(buzz, start)` uses raw `receivedAt ≤ start + 150`, inclusive. With a null start, every buzz counts.
    - `rankOpening` ranks the in-window buzzes, then the late ones.
  - Reducer:
    - New exported `canBuzz(room, playerId)`: OPEN or COLLECTING, and the player is eligible. A BUZZED press from an eligible player is still recorded as a late "also buzzed".
    - The first buzz sets `windowStartedAt`. Every route that empties `buzzes` clears it. Judge snapshots it and undo restores it.
    - `windowClosed` picks its winner from in-window buzzes only. If a kick leaves only late buzzes, it reopens the buzzers.
  - `views.ts`: `canBuzz` comes from the reducer. The `alsoBuzzed` list and the `fx buzz` gaps use `rankOpening`.
- Client: in OPEN and COLLECTING, `buzzerState` shows a grey, disabled button reading "Get ready… you can buzz from the next question" when `canBuzz` is false and the player is neither locked out nor already buzzed. While it shows, the phone sends no buzz (`live: false`).
- The DECISIONS F14 row "window stays open until `windowClosed` arrives" is marked superseded.
- Tests:
  - New `server/reducer.window.test.ts` (17):
    - the start is set and kept
    - a buzz at exactly +150 ms counts, and the next millisecond does not
    - a late-timer buzz with a lower `adjustedTime` loses
    - a kick that leaves only late buzzes reopens the buzzers
    - a null start counts every buzz
    - the start is cleared on reveal, next, auto-open next, FINAL, prev, reopen and three kick routes, and restored on undo
  - `views.test.ts` +12: a `canBuzz` table checked against what the reducer counts.
  - `fairness.test.ts` +4, `buzzerState.test.ts` +3 and `Play.test.tsx` +1 (grey button, and no buzz from pointerdown or Space).
  - Client fixtures derive `canBuzz` from phase, lockout and hasBuzzed unless a test overrides it.
  - 1070 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F39 cover:
- one `canBuzz` for both the view and the reducer, with BUZZED false
- when the late-joiner label shows
- where `windowStartedAt` is cleared, `host:end` keeping it, and undo restoring it
- the inclusive window, and the in-window-then-late order
- why only a kick lets the cut change the winner, the anchor staying on the first buzz after a kick, and the reopen

**Notes for next session:**
- Without a kick, a late buzz can never beat the first buzz: its adjusted time is always above `windowStartedAt`. The cut matters for the also-buzzed order and when the first buzzer is kicked mid-window. That is how the tests show it.
- Playtest (Playwright; Screen, Host remote, 4 Players at 390×844):
  - A player who joined during OPEN got the grey label, and a forced click sent no buzz.
  - Players who joined late got a normal BUZZ! on the reopen after Wrong.
  - The answer did not leak.
  - The COLLECTING frame (150 ms) was too short to catch in the UI. Unit tests cover the label in COLLECTING.
  - `favicon.ico` 404 (F44).
- No gateway-level late-timer test. The gateway's `receivedAt` source is unchanged, and the reducer tests cover the rule.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, and pair a phone as Host. Join from one phone and start.
2. Open the buzzers. Join from a second phone now: it shows "Get ready… you can buzz from the next question" on a grey button, and tapping it does nothing.
3. Buzz from the first phone and mark it Wrong. After the reopen, the second phone shows BUZZ!.

## F38 — Screen lobby fit (2026-10-28)
**What changed:**
- **Pair host phone** opens a dialog instead of growing the lobby:
  - It is a portal on `body` with `role="dialog"` and `aria-modal`. It holds a large QR (`min(58vh, 45vw)` on the Screen), "Hides in N s" and Hide (with an Esc hint on fine pointers).
  - It closes on Hide, Esc, the 60 s deadline, or a host joining. Hide takes focus and Tab stays on it. Focus returns on close. Esc is caught in the capture phase, so the page behind it never sees that press.
  - The remote uses the same dialog (qr `min(70vw, 20rem)`).
- Host joined, end to end:
  - New server→client event `host:paired` (empty payload). `host:join` sends it to the Screen and host rooms with `socket.to(...)`, so the joiner never gets it, and a refused token sends nothing.
  - `roomStore.hostJoins` counts it. `PairHostPhone` records the count when it opens and closes when the count moves.
- Lobby fit:
  - New `client/src/lib/useShrinkToFit.ts`. The chip list (`flex-1 min-h-0`) takes the column's leftover height. The hook binary-searches the list's font size, from the old 2.44 / 1.56 cqw down to a floor of 8 px, until the chips fit. It refits on resize (ResizeObserver), on `document.fonts.ready` and on a change of names. Chip padding and gap are now in `em`.
  - Past 20 players: room code `clamp(3rem, 12cqw, 24vh)`, join QR `min(30vh, 22cqw)`.
  - **Pair host phone** moved under the join QR. The lobby has `pb-[2vh]` above the strip.
- `HostSettings` takes `compact`, and the Screen's Game setup panel uses it. The remote's rows are unchanged.
- Tests:
  - New `PairHostPhone.test.tsx` (6): the dialog, focus and Tab, Esc not reaching the page, a host join, a join while closed, and the deadline.
  - New `useShrinkToFit.test.tsx` (5): full size, shrink to half a pixel, the floor, refit on content change and on resize. Layout is faked, because jsdom has none.
  - `Screen.test.tsx`: the pairing block was rewritten for the dialog (8 tests). It adds a dialog over the lobby, Esc not starting the game, a `host:paired` close, and Space starting the game with the dialog open.
  - `sockets.test.ts` +2: who gets `host:paired`, and none on a wrong token.
  - `HostControls.test.tsx` +1: compact and regular sizes.
  - 1033 tests in total. No new dependency.

**Decisions:** the six DECISIONS rows dated 2026-10-28 for F38 cover:
- the `host:paired` event and who receives it
- a reconnecting remote also closing the QR
- the remote getting the dialog
- the dialog's focus, Esc and shortcuts behind it
- how the chips are fitted, and the many-player header
- the compact sizes

**Notes for next session:**
- Measured with Playwright, 50 players (my own script plus `/playtest`). Every chip's bottom was at or above the list bottom and the strip top:
  - Plain Screen, short names, with the localhost note: chip font 19.0 / 13.2 / 12.7 px at 1920×1080 / 1366×768 / 1280×720. 0 hidden.
  - Hosting Screen, short names: 17.3 / 12.2 / 11.4 px. 0 hidden.
  - Long names (`Bartholomew 01`…) on the LAN URL: 0 hidden at all six combinations. The tightest was the hosting Screen at 1280×720, with the last chip at 590 against the list bottom at 591.
  - The ~5 px chip/footer overlap is gone. The list now ends 22 px (1920×1080) above the strip.
  - Game setup at 1280×720: `scrollHeight` 555 = `clientHeight` 555, so all four rows and Start game show without scrolling.
- `/playtest` F38: 7 of 7 steps passed.
  - The dialog closed when a second tab opened the pairing URL.
  - Esc left the room in LOBBY, and Space went to "Question 1 of 10".
  - The chip-list box was identical before and during the dialog.
  - The remote's Settings tab at 375 px looked normal.
  - The 60 s close was checked only by unit tests.
- At 1280×720 with long names and the panel, the chips are about 10 px. They fit, but they are hard to read from 5 m. Only a full room on a 720p Screen gets that small.
- The other Screen shortcuts (C, X, N…) still act behind the dialog. In LOBBY that only matters for S, F, H and ?.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://<LAN-IP>:5173/sets` → **Host this set** → **Use this device as the Screen**. Add bots from `/dev/bots/<CODE>` (up to 50).
2. Resize the window to 1280×720: every chip stays above the bottom strip, and Game setup shows all its rows and Start game.
3. Click **Pair host phone**: a dialog with a big QR. Esc or Hide closes it. Open it again and scan it with a phone: it closes as the phone joins.
4. Press Space: the game starts.

## F37 — Settings in the Screen lobby (2026-10-28)
**What changed:**
- On a Screen whose hostToken the server accepted, the lobby has a "Game setup" panel on the right:
  - a **Start game** button (Space)
  - the remote's `HostSettings`, unchanged: wrong-answer penalty, auto-open buzzers, answer time, scoreboard every N
- It is not on a plain Screen, or on one whose stale token fell back to a plain join. It goes away when the game starts.
- `HostSettings` takes `HostView | ScreenView`. It reads only `settings`, which the ScreenView already carried.
- The Screen page owns one `useHostCommand` and one `Toast` in the new `ScreenStage`. The bar, the shortcuts and the panel share them. `ScreenHostControls` now takes `command`, not `send`.
- Lobby sizing: the main column is an `@container`, with sizes in `cqw` (N vw ÷ 0.9). A plain Screen looks exactly as before. Beside the panel, the code, URL, QR and chips shrink instead of wrapping.
- Tests: `Screen.test.tsx` +6 (`lobby settings`):
  - the panel shows only with an accepted token
  - it leaves at start
  - a toggle and the stepper send `host:settings` with one key
  - a refusal toasts and releases the lock
  - the lobby Start sends `host:start`
  - Space on a focused switch sends only `host:start` and blurs it
- 1016 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-28 for F37 cover:
- the panel with its own Start game, and showing it only with `canHost`
- the shared lock and toast
- Space while a control has focus (the existing blur)
- the `cqw` sizing, and the panel staying in rem

**Notes for next session:**
- Playtest (Playwright; a Screen that created the room, plus one Player): 4 of 4 flow steps passed.
  - I turned on auto-open and set 3 s in the lobby.
  - With "More answer time" focused, Space started the game without changing the value.
  - The buzzers opened with no host action. The Player saw 3, 2, then "Time's up!".
  - The no-token case and the failed-ack toast are covered by unit tests only.
- Layout, measured at 1920×1080, 1366×768 and 1280×720:
  - The first version wrapped the join URL and hid the room code's 4th letter. With `cqw`, the code and URL stay on one line at all three sizes, and a plain Screen is unchanged.
  - Backlog: at 1280×720 the panel scrolls about 67 px, and "Scoreboard every" is below the fold.
  - Backlog, not caused by F37: with **Pair host phone** open, the player chips are pushed below the footer.
- The Start game button now appears twice in the lobby, in the panel and on the auto-hiding bar. This is intended.
- The DECISIONS "Proposed spec changes" entry for lobby settings is already in SPEC.md and can be pruned.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and host a set. Choose **Use this device as the Screen**, then Click to start. Join from a phone at `http://<LAN-IP>:5173/play/<CODE>`.
2. In the lobby's right panel, turn on **Auto-open buzzers** and set **Answer time** to 3 s.
3. Press Space (or **Start game**). The buzzers open by themselves. Buzz from the phone: the 3 s countdown runs on the Screen and the phone.
4. Open `/screen/<CODE>` in a private window: there is no panel.

## F36 — Answer countdown and time's-up on the devices (2026-10-28)
**What changed:**
- New `client/src/lib/useAnswerCountdown.ts`:
  - `useAnswerCountdown(view)` returns `{secondsLeft, up}` or null.
  - It is keyed by question index and opening counter, so it restarts on a new question or opening. It reads `Date.now()` every 250 ms and stops at 0. `up` comes from the view.
  - `countdownText` and `TIME_UP_LABEL` ("Time's up!") come from the same file.
- Winner's phone: `buzzerState` takes the countdown. The winner gets "You're first! Answer now" with a big `secondsLeft` number, then "Time's up!". Other phones are unchanged.
- Screen:
  - A `Countdown` box sits beside the winner's banner. At time up it turns red and reads "Time's up!".
  - `ScreenFlash` flashes red on `fx timeUp`.
  - New `timeUp` sound: `client/public/sounds/timeUp.wav`, made by `scripts/make-sounds.mjs`. The other WAVs regenerate byte-identical. `soundForFx` now always returns a sound.
- Host remote:
  - An "Answer time" row directly above Correct / Wrong, then a red "Time's up" badge.
  - `useVibrateOnTimeUp` in `Host.tsx` calls `navigator.vibrate([200, 100, 200])` on each fresh `fx timeUp`.
- Tests:
  - New `useAnswerCountdown.test.ts` (10, fake timers).
  - `buzzerState` +3, `sounds` (timeUp mapped), `Screen` +4 (+ timeUp in the sound test), `Host` +5 and `Play` +2.
  - `Play.test.tsx` now restores real timers after each test.
  - 1010 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-28 for F36 cover:
- how the countdown starts, ticks, stops at 0, and defers to the server's `up`; a late joiner counts from the full time
- the Host countdown in its own row above Correct / Wrong (too narrow for a middle column at 375 px)
- the vibration pattern, only for events after mount, Host only
- the sound's design, and reusing the red flash

**Notes for next session:**
- Playtest (Playwright; Screen, Host remote, two Players in separate contexts; answer time 3 s), 6 of 6 steps passed:
  - The winner's phone counted 3, 2, 1, then "Time's up!". The other phone stayed "Ann buzzed first".
  - The Screen counted beside the banner, then showed a red "Time's up!" box. The `timeUp` flash fired once, and `/sounds/timeUp.wav` served 200 (not heard).
  - The Host counted 3, 2, 1, then the badge. A stubbed `navigator.vibrate` got `[200,100,200]` once.
  - The next question restarted at 3 on all three devices.
  - With the timer set back to Off, every view looked as before.
  - No answer text before reveal.
- Not checked: the reduced-motion tint, the sound by ear, and a real phone's vibration.
- The F35 DECISIONS row saying `timeUp` is silent "until F36" is now history; the F36 sound row supersedes it.
- With the timer on, F37 (settings in the Screen lobby) is the last roadmap feature.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, and click **Click to start** on the Screen. Pair a phone as Host, and join from one or two more phones.
2. On the Host phone, open Settings and set **Answer time** to 3 s.
3. Start, open the buzzers and buzz. The Screen shows 3, 2, 1 beside the winner's name, then "Time's up!" with a red flash and the new sound. The winner's phone counts down too; the Host phone counts above Correct / Wrong, then shows "Time's up" and vibrates (Android Chrome; iOS has no vibration).
4. Judge as usual. Set Answer time back to Off: no countdown anywhere.


## F35 — Answer timer: server and phone setting (2026-10-28)
**What changed:**
- Shared:
  - `RoomSettings.answerSeconds` (`AnswerSeconds`: 0, 3, 5, 7 or 10; default 0 = off).
  - `ANSWER_SECONDS_CHOICES` in `constants.ts`.
  - `roomSettingsSchema` takes `z.literal(ANSWER_SECONDS_CHOICES)`, so room creation and `host:settings` both validate it. It is required in the create body.
  - `Room.answerTimer {seconds, endsAt, up}`.
  - `answerTimer {seconds, up} | null` on Screen, Host and Player views. `endsAt` never leaves the server.
  - New `fx {kind: 'timeUp', playerId}`.
- Reducer:
  - `windowClosed` starts the timer when `answerSeconds > 0`, and schedules `answerTimeUp {questionIndex, openingCounter, at}`.
  - A fresh `answerTimeUp` sets `up: true` and emits `fx timeUp`. Fresh means BUZZED, no pending reopen, not already up, `endsAt === at`, and the same index and counter. Nothing is judged.
  - The timer is cleared by both judgements, reveal, reopen (`openBuzzers`), kick of the winner, next, prev (`clearedQuestion`), end and undo.
  - The settings merge takes the new key. A running timer is untouched.
- Client:
  - The Settings tab has an "Answer time" stepper: Off, 3, 5, 7, 10 s.
  - `soundForFx` returns null for `timeUp`, and `useScreenSounds` skips it. The sound comes in F36.
- `scripts/docker-smoke.sh` builds its room body from `DEFAULT_SETTINGS`, so a new settings key cannot 400 it again.
- Tests:
  - New `server/reducer.timer.test.ts` (31): start, off, each choice, time up, judging after time up, every clear, every stale case (including undo then wrong again, a mismatched `at`, and a repeat), and a settings change mid-countdown in both directions.
  - `sockets.buzz.test.ts` +2: the timer fires through the gateway to all four sockets, and an invalid `answerSeconds` is refused.
  - `views.test.ts` +3, `schemas.test.ts` +2, `constants.test.ts` +1, `HostControls.test.tsx` +9 and `sounds.test.ts` +1. Settings expectations were extended with the new key.
  - 987 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F35 cover:
- what makes `answerTimeUp` fresh, and undo returning without a timer
- a disconnecting winner, or a kick of another player, leaving the timer running
- settings applying from the next buzz
- views without `endsAt`, with devices counting down locally
- the required create key, and the silent `timeUp` until F36

**Notes for next session:**
- Playtest (Playwright; Screen, Host remote, one Player), 7 of 7 steps passed:
  - The stepper runs Off → 10 s and stops at both ends.
  - `answerTimer` reaches all three roles, then `up: true` and `fx timeUp`. The Player still shows "You're first! Answer now".
  - A change from 5 s to 3 s mid-countdown applied from the next buzz.
  - Wrong, Correct and Undo cleared the timer.
  - No websocket frame carried `endsAt`.
- No device shows the countdown yet. That is F36.
- `npm run smoke:docker` prints PASS. It had failed with 400s until the smoke body included the new key.
- The DECISIONS "Proposed spec changes" entry for the answer timer is already in SPEC.md (commit 7d45855). It can be pruned when convenient.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, and pair a phone as Host. Join from another phone.
2. On the Host phone, open Settings and set **Answer time** to 3 s.
3. Start, open the buzzers and buzz. In devtools, the Socket.IO frames show `answerTimer {seconds: 3, up: false}`, then after 3 s `up: true` and an `fx timeUp`. Correct / Wrong still work.

## F34 — Dockerfile and deploy guide (2026-10-28)
**What changed:**
- `Dockerfile` with four stages on `node:24-slim`: deps, build, prod-deps and runtime.
  - It runs `node dist/server/index.js` as the `node` user, with `NODE_ENV=production`, on `PORT` 3000.
  - It has a `HEALTHCHECK` on `/healthz`.
  - The image is 266 MB. `.dockerignore` keeps the context small.
- Deploy target, chosen by Kim: the droplet at `buzzr.kimnejudne.dev`.
  - `deploy/compose.deploy.yaml` runs the container on `127.0.0.1:3005` with `TRUST_PROXY=1`, `IMAGES_MAX_MB=200` and `mem_limit: 384m`.
  - `deploy/nginx/buzzr.conf` sends everything to Node. `/socket.io/` gets the WebSocket upgrade, a 120 s read timeout and no buffering. `client_max_body_size` is 2m.
  - `deploy/nginx/buzzr-bootstrap.conf` is the HTTP-only vhost used for the first certbot run.
- New `README.md`: dev commands, Docker, env vars, and the droplet runbook (DNS, bootstrap, ACME probe, cert, ship image, compose, vhost, routine deploy, rollback, health checks).
- Server:
  - New `server/env.ts`: `parseTrustProxy` (moved from `index.ts`, unchanged) and `parseImagesMaxBytes` for the new `IMAGES_MAX_MB` env var.
  - `index.ts` exits on SIGTERM and SIGINT, so `docker stop` is immediate.
- Tests:
  - New `server/env.test.ts` (7).
  - New `scripts/docker-smoke.sh` (`npm run smoke:docker`). It builds and runs the image with the compose file's env, then checks:
    - `/healthz` 200
    - `/` and `/play/ABCD` serve the client
    - a Socket.IO WebSocket connects
    - the 11th room from one forwarded IP gets 429 and another IP gets 201
    - the process runs as `node`
    - `docker stop` takes under 5 s
  - 938 tests in total. No new dependency.

**Decisions:** the six DECISIONS rows dated 2026-10-28 for F34 cover:
- the droplet target, port 3005, and shipping the image (this resolves open question #1)
- nginx proxying everything, the WebSocket headers, the body size, and `http2` on nginx 1.24
- `TRUST_PROXY=1` and the right-most-XFF reasoning
- `IMAGES_MAX_MB`, and its 200 MB value on the droplet
- the SIGTERM exit
- the image keeping client libraries (Backlog if size matters)

**Notes for next session:**
- **Not deployed yet.** Step 1 (the Namecheap A record `buzzr`) is Kim's. Then follow README → Deploy → First deploy. Nothing was changed on the droplet; I only made a read-only check of its memory, ports and vhosts.
- **Not done: the spec's manual acceptance checklist on real devices**, including mobile data, and the F33 Wake Lock check over HTTPS. Both need the deploy.
- Checked locally with `nginx:1.24` (the droplet's version) in front of the image, using a dummy cert:
  - `nginx -t` passes for both vhosts.
  - `/healthz` answers 200 over HTTP/2, and HTTP gets a 301 to HTTPS.
  - The WebSocket upgrade answers 101.
  - A 1.4 MB image upload gets 201.
  - Rate limit: 10 rooms, then 429, even with a different spoofed XFF each time. A second source address (127.0.0.2) still got 201.
- The droplet had about 730 MB available, with swap in use (656 MB). Watch `docker stats` after the first real game with photos.
- A deploy ends every live game (rooms are in memory). The README says to deploy only between games.
- The local Docker uses the legacy builder (no buildx), so the `# syntax=` line is ignored. It does no harm.

**How to try it:**
1. `npm run smoke:docker` prints `PASS`.
2. Or by hand: `docker build -t buzzr . && docker run --rm -p 3000:3000 buzzr`, then open `http://localhost:3000` (Screen) and `curl -i http://localhost:3000/healthz`.
3. Deploy: README.md → Deploy → First deploy, steps 1–8. Then run the SPEC manual checklist with the laptop on the TV, a Host phone, and players on Wi-Fi and on mobile data.

## F33 — Device polish and feedback (2026-10-28)
**What changed:**
- Wake Lock: new `client/src/lib/useWakeLock.ts`, used by the Player's buzzer screen.
  - It requests `navigator.wakeLock.request('screen')` on mount and again on each return to the page.
  - It skips a request while it still holds a lock or one is pending, and releases on unmount.
  - Where the API is missing or refuses, it does nothing.
- Connection dot: new `components/ConnectionDot.tsx`, in the Player's colour bar and beside the code on the Host remote.
  - `roomStore` gains `connection` (`connected` / `connecting` / `offline`).
  - `useRoomSocket` sets it on `connect` and `disconnect`. It turns `offline` after `OFFLINE_AFTER_MS` (5 s) down.
  - Green, amber and red come from `win`, the new `--color-warn` token and `buzz`. Each state has an aria-label: Connected, Reconnecting… or Offline.
- Toasts: a refused `player:buzz` now shows its reason in the shared toast. Host and Screen controls already toasted.
- Empty states: "No players yet" on the Scoreboard overlay, and "No bots yet" on `/dev/bots`. Every other list already had one (see DECISIONS).
- Tests:
  - New `useWakeLock.test.ts` (7): hold and release, re-acquire on visible, no double lock while holding or pending, a lock granted after unmount is released, no API, and retry after a refusal.
  - `Play.test.tsx` +4: the buzz-refusal toast, no toast on ok, the dot's green, amber, red and green again, and the wake lock on the buzzer screen.
  - `Host.test.tsx` +1 (the dot), `Screen.test.tsx` +1 (empty scoreboard) and `DevBots.test.tsx` +1.
  - 931 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F33 cover:
- what each dot colour means, and the 5 s threshold
- where the dot sits, and the warn token
- the wake lock's lifetime, and why it needs HTTPS
- which failed acks toast and which keep their page
- the empty-state audit

**Notes for next session:**
- Playtest (Playwright; Screen, Host and Players at 390×844):
  - `navigator.wakeLock.request` ran on the Player's buzzer screen.
  - Host and Player dots were green ("Connected"). After the server was killed, the Host's dot was red ("Offline").
  - "Start game" with no players toasted "Wait for at least one player to join". A taken name showed "That name is taken" on the form.
  - The Host Players tab and the Screen lobby showed their empty states.
- Not seen live: amber (the sampling every 1.5 s did not land in the 5 s window), green again after a reconnect, and the wake lock re-acquired after a real tab switch. Unit tests cover all three.
- **Not done: the manual check on a real phone.** Wake Lock needs HTTPS, so on `http://<LAN-IP>:5173` the phone can still sleep. Check it on the F34 deploy: the screen should stay on while the buzzer shows.
- A silent drop (airplane mode, Wi-Fi out of range) is noticed only by Socket.IO's heartbeat, which is up to about 45 s with the defaults (`pingInterval` 25 s, `pingTimeout` 20 s). Until then the dot stays green. A closed connection (server down, page reloaded) turns it amber at once. Shorter heartbeat or the browser's `offline` event: Backlog.
- After a server restart, the dot does go green on reconnect, but the rejoin is refused and the page shows "This game has ended" (F32). Green-again only shows after a network blip.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and tap **Host this set**. Pair a phone as Host and join from another phone.
2. Both phones show a green dot: in the Player's top bar, and beside the room code on the Host.
3. Stop the server (Ctrl-C): both dots turn amber, then red after 5 s. (A restart ends the game, as in F32.)
4. On the deployed HTTPS URL, leave the Player phone idle on the buzzer: the screen stays on.

## F32 — Reconnects and room lifecycle (2026-10-28)
**What changed:**
- Server:
  - Every successful `*:join` also joins the Socket.IO room `room:<code>` (`anyRoom`).
  - New `closeRooms(io, codes, reason)` in `server/sockets.ts` sends `room:closed {reason}` to that room, then disconnects its sockets.
  - `index.ts` now attaches the gateway before the sweeper. `onExpired` frees images, then calls `closeRooms(…, 'expired')`.
  - New shared constants: `ROOM_NOT_FOUND_ERROR`, `GAME_ENDED_ERROR` and `ROOM_EXPIRED_REASON`. The gateway and the reducer use them in place of string literals.
- Client:
  - `useRoomSocket` turns `room:closed` into "This game has ended". It does the same for a "Room not found" rejoin once the page has had a `state` (a server restart mid-game).
  - On a first load, "Room not found" also becomes "This game has ended" when the device was in the room: a Screen with a stored token, any Host page, or a Player with a stored identity.
  - Play no longer sends a saved player back to the name form on "Room not found". A new player whose room vanished between the check and the join sees "Room not found".
  - The Host's Players tab greys the name line of an offline player (`opacity-40`). The ± and Kick buttons stay at full strength. The Screen's chips and ranking already greyed offline players.
- Tests:
  - New `server/sockets.reconnect.test.ts` (6):
    - a player rejoins with their score and lockout
    - an offline player stays listed on Screen and Host
    - a refreshed Screen and Host get the latest snapshot, and the token Screen can send host actions again
    - the host can judge a buzz winner who has disconnected
    - expiry sends `room:closed` to all three roles and disconnects them, but not a stranger
    - after a restart, every role is told "Room not found"
  - `Play.test.tsx` +3 (one test replaced): a refresh into an ended room, a rejoin after a restart, `room:closed`, and a new player whose room vanished.
  - `Host.test.tsx` +3: ended on "Room not found", `room:closed`, and a silent rejoin with the stored token. The "other join errors" test now uses "Already joined".
  - `Screen.test.tsx` +5: ended with a stored token, after a snapshot, and on `room:closed`; greyed chips and scoreboard rows.
  - `HostControls.test.tsx` +1: the greyed name line.
  - 917 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F32 cover:
- `closeRooms`, `anyRoom` and the 'expired' reason
- when "Room not found" reads as "This game has ended", and when it stays "Room not found"
- clearing the Player identity but keeping the hostToken
- leaving the backgrounded-phone case to Socket.IO's reconnection, with no indicator
- the shared error constants

**Notes for next session:**
- Playtest (Playwright; room TFMM; Screen, Host remote from the stored token, Pia and 2 bots):
  - Refreshing the Screen, the Host and Pia mid-game each came back on the same question and score.
  - Closing Pia's tab greyed her row on the Host as "offline". Reopening `/play/TFMM` rejoined her with 100.
  - Killing and restarting the server showed "This game has ended" with Back to start on all three devices within 8 s.
- The playtest flagged `/play/ZZZZ` and `/screen/ZZZZ`, which show "Room not found". That is intended (see DECISIONS). `/host/ZZZZ` with no token shows "Not authorised", as before.
- Not checked live: expiry by the 3-hour timeout. `closeRooms` is covered by the server test, and `room:closed` by each page's test.
- While the server is down, every device shows its last snapshot with no hint. A "Reconnecting…" indicator is in Backlog.
- The playtest saw "Another connection wants to delete database 'buzzr'". Its source was not traced. It is probably the playtest's own IndexedDB reset across shared-context tabs.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and tap **Host this set**. Use the laptop as the Screen. Pair a phone as Host, and join from another phone.
2. Start the game, buzz, and judge. Then refresh the Screen, the Host phone and the Player phone. Each returns to the same question and score with no prompt.
3. Lock the player's phone. The Screen and the Host show them greyed or "offline". Unlock it: they come back.
4. Stop the server (Ctrl-C) and start `npm run dev` again. All three devices show "This game has ended" with **Back to start**.

## F31 — Sounds and animations (2026-10-28)
**What changed:**
- Sounds:
  - Five self-made WAVs in `client/public/sounds/`: buzz, correct, wrong, join and fanfare.
  - They come from the new `scripts/make-sounds.mjs`, which synthesises them from plain waveforms. Run `node scripts/make-sounds.mjs` to remake them.
  - `client/public/sounds/README.md` lists each file, what plays it and its source.
  - `eslint.config.js` now gives `scripts/**` Node globals.
- `client/src/lib/sounds.ts`:
  - Howler loads through a dynamic import, as its own 36 KB chunk. `preloadSounds` warms it when the Screen mounts.
  - `startSounds` creates the Howls and resumes a suspended AudioContext.
  - `playSound` is silent before start and logs `[sound] <name>` in DEV.
  - `soundForFx` maps each fx kind to a sound.
- Screen:
  - **Click to start** (`components/StartOverlay.tsx`) covers every page load except an error page.
  - The click enters fullscreen (new `lib/fullscreen.ts`, now shared with the F key) and starts the sounds.
  - Keys pressed on the overlay never reach the host shortcuts.
  - After the click, `useScreenSounds` plays each new fx sound, and the fanfare on the change into FINAL.
- Reduced motion: the Player's open-buzzer pulse is now `motion-safe:`. F24 already handled the chip pop-in, the +points float, the flash and the scoreboard FLIP.
- Tests:
  - New `sounds.test.ts` (6, with Howler mocked): the fx-to-sound map, a file for every sound, silence before start, load once and resume, play only the named sound plus the log line, and a Howler failure.
  - `Screen.test.tsx` gains 9:
    - the overlay's click, focus and fullscreen
    - keys swallowed behind it
    - no overlay over an error
    - each fx sound
    - silence before the click and no replay
    - an fx arriving with the first state
    - the fanfare once
    - no fanfare on a load into FINAL, before or after the click
  - `renderScreen` now presses Click to start by default (`{ start: false }` opts out).
  - The `Play.test.tsx` pulse assertion now checks the `motion-safe:` guard.
  - 899 tests in total.
- New dependencies:
  - `howler`: the spec names Howler.js for sound.
  - `@types/howler` (dev): its types.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F31 cover:
- the self-made WAVs and the script that makes them
- wrong.wav as the "buzz sound" for Wrong
- Screen-only, lazy Howler, the fanfare trigger and the DEV log
- the overlay: on every load, fullscreen first, keys swallowed, no replay
- the reduced-motion scope

**Notes for next session:**
- Playtest (Playwright; a Screen with the token, a Host remote, Ann and 2 bots), all passed:
  - All five `/sounds/*.wav` returned 200.
  - The Screen logged `[sound]` join ×3, buzz, correct, buzz, wrong, then fanfare after End game.
  - Click to start closed and set `document.fullscreenElement`.
  - A lobby chip had `animation-name: pop-in`. With `reducedMotion: reduce` emulated, it had `none`.
- Not checked live: the +points float and the scoreboard FLIP under reduced motion. Their guards are in place and are unit-tested from F24.
- Nobody listened to the sounds. The playtest checked that the right ones fired. Their levels were balanced by measurement (ffmpeg `volumedetect`), not by ear. Remake them with the script if one sounds wrong on a TV.
- The playtest saw a dev-only warning on first load: "WebSocket is closed before the connection is established" (StrictMode remount). Only the favicon 404 showed as an error (pre-existing).
- The F29 and F30 entries sat above the `<!-- entries below, newest first -->` marker, so `roadmap.mjs next` showed F28 as the newest. The marker now sits right under the template. Add new entries directly below it.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and tap **Host this set** on the sample. Use the laptop as the Screen.
2. The Screen shows **Click to start**. Click it: the window goes fullscreen.
3. Join from phones at `http://<LAN-IP>:5173`. Each new chip pops in with a blip.
4. Run a question: a buzz rings in, C plays the correct arpeggio, and X plays the wrong buzzer. End the game: the fanfare plays.
5. Turn on reduced motion in the OS: chips and the phone's BUZZ! button stop animating.

## F30 — Image upload, serving and preload (2026-10-28)
**What changed:**
- Server:
  - New `server/imageStore.ts` keeps images in memory per room and image id. It holds up to 50 MB per room and 500 MB in total (`GLOBAL_IMAGES_MAX_BYTES`, DECISIONS #12, now enforced).
  - The sweeper's new `onExpired` callback frees a deleted room's images (wired in `index.ts`).
  - `POST /api/rooms/:code/images/:imageId`, in this order:
    - The room, the Bearer hostToken, an `imageId` the room's set uses, and the content type are all checked before the body is read.
    - `express.raw` then reads the body, up to 1.5 MB.
    - Errors: 404, 401, 404, 415, 400 (empty), 413 (image too big or room over 50 MB), 507 (global cap).
  - `GET` serves an image with its type, `Cache-Control: public, max-age=31536000, immutable` and `nosniff`.
- Client:
  - `hostSet` loads each referenced blob once and refuses a missing image or a total over 50 MB before it creates the room. Then it uploads each image with `uploadImage` (`api.ts`).
  - `ScreenView.nextImageId` is new. `usePreloadImage` preloads the next image on the Screen and, from `nextQuestion`, on the Host.
  - The Host's question card shows the image thumbnail (this resolves the F10 TODO).
  - `IMAGE_TYPES` moved to `shared/constants.ts`.
- Sample set: question 4 has a hexagon picture, and question 7 is image-only (the flag of Japan, which replaces the diamond question). The PNGs are made with ImageMagick and embedded in `client/src/lib/sampleImages.ts`. They are seeded in Dexie's `populate` hook.
- Tests:
  - New `http.images.test.ts` (10): auth, 404s, 415, exactly 1.5 MB vs 1 byte more, empty body, 50 MB then the 51st MB, 507, and GET headers, bytes and 404s.
  - New `imageStore.test.ts` (5) and `usePreloadImage.test.ts` (2).
  - Existing files gained tests: `hostRoom.test.ts` 5, `api.test.ts` 2, `Host.test.tsx` 2, `Screen.test.tsx` 1, `views.test.ts` 1, `roomStore.test.ts` 1 (sweep frees images) and `db.test.ts` 1 (seeded PNGs).
  - New helper `client/src/test/nodeBlob.ts` (from SetEditor.test). It lets jsdom tests store blobs in fake-indexeddb.
  - 884 tests in total. No new dependency.

**Decisions:** the six DECISIONS rows dated 2026-10-28 for F30 cover:
- the image store and cleanup
- the upload checks, their order and status codes
- the GET cache header
- `hostSet`'s pre-checks and what happens to the room after a failed upload
- preload, `nextImageId` and the Host thumbnail
- the sample pictures, and why an already-seeded browser keeps the old sample

**Notes for next session:**
- Playtest (Playwright; Screen at 1920×1080; Host and one Player at 390×844), all passed:
  - Create room sent `POST /api/rooms`, then both sample image uploads with `Bearer <hostToken>`, each 201.
  - No token or a bad token gets 401. On :3000, 1.6 MB gets 413 and 1.4 MB gets 201.
  - GET returned `public, max-age=31536000, immutable` and `image/png`.
  - At question 3, Screen and Host had already fetched `sample-img-hexagon`. Moving to question 4 made no new image request, and the image was already loaded.
  - Question 7 shows only the flag (1728×568) with no text, and "Japan" appears nowhere on the Screen. The Player shows no image.
  - Only the favicon 404 showed in the console (pre-existing).
- Not checked live: the 50 MB room cap, because the sample room has 2 image ids. `http.images.test.ts` covers it.
- An oversized upload through the Vite dev proxy (:5173) shows as 502 with `write EPIPE` in the dev log. The server answers 413 before it has read the whole body, and the proxy is still writing. The server on :3000 returns the right 413. The editor never stores an image over 1.5 MB, so the app itself doesn't hit this.
- A browser that seeded the sample before F30 keeps the text-only sample. Delete the `buzzr` IndexedDB in DevTools (Application › IndexedDB) to reseed it.

**How to try it:** `npm run dev`.
1. If this browser already had Buzzr, delete the `buzzr` IndexedDB first.
2. On the laptop, open `http://localhost:5173/sets` and tap **Host this set** on the sample. Open the Screen at 1920×1080. Pair a phone as Host and join from another phone.
3. Play to question 4: the hexagon appears at once beside the text. On the Host phone, the card shows the thumbnail.
4. Question 7 is the flag alone, filling the Screen.

## F29 — Image pipeline in the editor (2026-10-28)
**What changed:**
- `client/src/lib/imagePipeline.ts`:
  - `fitWithin` holds the size maths: longest side 1600 px, aspect kept, never enlarged, at least 1 px.
  - `shrinkImage(file, codec)` refuses types other than PNG, JPEG, WebP and GIF, and then decodes the file. It draws the image at the fitted size and writes WebP at 0.8, or JPEG over white when the browser cannot write WebP. A result over 1.5 MB is refused, and the decoded frame is freed afterwards.
  - The browser codec uses `createImageBitmap` (which gives a GIF's first frame) and a canvas. It is injected so tests run without a canvas.
- Set editor: each card has an **Image (optional)** block under the question text.
  - Empty: an **Add image** picker. Full: a thumbnail with **Remove**.
  - A file dropped on the card, or an image pasted while focus is in it, becomes the card's image and replaces any image already there.
  - "Shrinking image…" shows while it works, and a refusal shows its reason.
  - An image no question uses any more is deleted after the next save without it. A shared image (from Duplicate) is kept while either question uses it.
- Other changes:
  - `db.ts` gains `addImage` and `deleteImages`.
  - `lib/setEditor.ts` gains the pure `setQuestionImage` and `unusedImageIds`.
  - `useStoredImageUrl` moved out of `QuestionPreview` into `lib/useStoredImageUrl.ts`, and the thumbnail uses it too.
- Tests:
  - New `imagePipeline.test.ts` (11): the size maths, WebP at 0.8, the JPEG fallback, the four types, refused types, the 1.5 MB limit and its edge, undecodable files, and the frame being freed.
  - New `useStoredImageUrl.test.tsx` (2).
  - `setEditor.test.ts` gains 3. `db.test.ts` gains 1.
  - `SetEditor.test.tsx` gains 7: pick, drop, paste (and text paste left alone), refusal, image-only question, Remove after save, and delete with a shared duplicate.
  - 854 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-28 for F29 cover:
- the pipeline: always redraw, JPEG over white, and checking only the result against 1.5 MB
- the editor block: card-wide drop and paste, replacing an image, and a text paste winning
- when an unused blob is deleted

**Notes for next session:**
- Playtest (Playwright, `/sets/:id` only), all passed:
  - A pasted 3200×2000 noise PNG (22.0 MB) showed a 1600×1000 thumbnail. It was stored as one `image/webp` blob of 782,226 bytes.
  - Remove cleared the thumbnail and its button.
  - A dropped GIF was accepted as a still.
  - A text file was refused ("Use a PNG, JPEG, WebP or GIF image.").
  - A 1600×1600 noise PNG was refused with the 1.5 MB message, and nothing was stored.
  - An image-only question survived a reload, and Preview showed its image.
- Not checked: the file-picker button in a real browser, an animated GIF, and the JPEG fallback in Safari. The last two rely on `createImageBitmap` and `toBlob`.
- `SetEditor.test.tsx`: fake-indexeddb clones with Node's `structuredClone`, which drops a jsdom Blob. The test's mocked `shrinkImage` therefore returns a Node Blob (`process.getBuiltinModule('node:buffer')`).
- F30: hosting must upload each `imageId` blob. The stored blobs are already at most 1.5 MB, in WebP or JPEG.

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets` and open a set.
1. Tap Add image on a card and choose a photo. A thumbnail appears.
2. Copy an image (in a browser, use "Copy image"). Click in a card and paste.
3. Drag an image file onto another card.
4. Clear a card's question text. With an image, the card shows no error. Tap Preview to see it as the Screen would.
5. Tap Remove. The upload area returns.
## F28 — Import and export JSON (2026-10-28)
**What changed:**
- `client/src/lib/importExport.ts`:
  - `exportSetFile` builds one JSON file: the set's fields plus `images`, each referenced image once as a base64 data URL. It refuses a draft (`checkPlayable`'s reason), a missing image, or an image type import would refuse.
  - `parseSetFile` never throws. It reports invalid JSON, then validates with zod (`setFileSchema`), then checks each `imageId` is in the file. Errors read "<path>: <message>" ("Question 3 › answer: …"), capped at 10 plus "…and N more."
  - Also `exportFileName` (title slug), `blobToDataUrl`, `dataUrlToBlob` and `IMPORT_FILE_MAX_BYTES` (201 MB).
- `db.ts`: `importSet` stores the parsed set and its blobs in one transaction under fresh set and image ids, stamped now.
- `/sets`:
  - **Import JSON** sits beside New set and opens a hidden file input. Success shows "Imported “<title>”." and the new card. A bad file shows "Couldn't import <file>:" and a list of errors. A file over the size cap is refused before it is read.
  - Each card gains **Export JSON**, which downloads `<slug>.json` through an object URL.
- Tests: new `importExport.test.ts` (12). It covers the round trip with PNG and GIF bytes (every byte value) and the shared image id, plus the malformed files: not JSON, not an object, schema errors with paths, and missing, unsupported and oversized images. It also covers the error cap, the draft and type refusals, and the file name. `Sets.test.tsx` gains 5: export download, draft export, import success, the import error list and the size cap. 830 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-28 for F28 cover:
- the file format
- export refusing drafts
- the import checks, the error format and the size cap
- fresh ids on import

**Notes for next session:**
- Playtest (Playwright, `/sets` only). Pass: export of a 3-question set, re-importing that file, and the errors for invalid JSON (`{not json`), `{"title":5}` and a file with one empty question.
- Not checked in a browser: a set with images, because the editor cannot add one before F29. `importExport.test.ts` covers the image round trip.
- F29: the stored blob must keep a PNG, JPEG, WebP or GIF `type`, or Export JSON refuses it.
- F30: an imported set's images are ordinary stored blobs, so uploading them at hosting needs nothing special.

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets`.
1. Tap Export JSON on the sample. `sample-general-knowledge.json` downloads.
2. Tap Import JSON and choose that file. A second "Sample: General Knowledge" card appears.
3. Edit the file so `"title": ""`, then import it again. The page lists "Title: Too small: …".

## F27 — Reorder, preview and print sheet (2026-10-28)
**What changed:**
- Drag reorder in the set editor. Each card has a ⠿ handle (`useSortable`) that drags by pointer or by keyboard: Space or Enter, then ↑/↓, then Space or Enter (Escape cancels). Screen-reader announcements name the question positions. A drop goes through the new pure `reorderQuestions` and the same autosave path as ↑/↓, which stay.
- **Preview** on each card opens `components/QuestionPreview.tsx`, a full-window dialog.
  - It renders the Screen's own `ScreenQuestion` from `previewView(set, index)`: QUESTION phase, buzzers locked, with no answer or notes in the view.
  - It has Previous/Next, ←/→, Escape and Close.
  - Focus moves in and is restored on close. The editor behind is `inert` and stops scrolling.
  - `ScreenQuestion` gains an optional `imageSrc`, and `db.getImage` feeds it a stored blob.
- **Print answer sheet** (link at the top of the editor) opens `/sets/:setId/print` (`pages/AnswerSheet.tsx`, a lazy chunk).
  - A black-on-white table of #, Question, Answer and Notes.
  - The Print button calls `window.print()`. Controls are `print:hidden`, rows avoid page breaks, and `body` prints white.
  - The tab title names the printout.
- Tests:
  - `setEditor.test.ts` gains 3 (reorder, the preview view, a leak check).
  - `SetEditor.test.tsx` gains 5: the handle's role and instructions, a keyboard drag with mocked rects that saves `b,a,c`, the preview's content, its keys and focus, and the print link. The save indicator is now queried by the name "Save status".
  - New `AnswerSheet.test.tsx` (5). `App.test.tsx` gains the print route.
  - 813 tests in total.
- New dependencies: `@dnd-kit/core` and `@dnd-kit/sortable`. The spec names `@dnd-kit` for the drag handle. They load only in the editor chunk.

**Decisions:** the DECISIONS rows dated 2026-10-28 for F27 cover:
- the dnd-kit setup: handle only, the keyboard sensor, and the "Save status" name
- Preview as a full-window dialog built on `ScreenQuestion`
- the print page, its route and styling, and points left off

**Notes for next session:**
- Playtest (Playwright, one 1280×900 tab, a 3-question set), all passed:
  - A mouse drag of Q3's handle above Q1 reordered the list.
  - Keyboard Space, ↓, Space moved Q1 down one place. The order survived a reload.
  - Preview showed "Question 1 of 3", the text and "Buzzers locked", and not the answer. The screenshot matches the Screen's layout.
  - Under print media, the print page showed no links or buttons, a white background and black text, with rows in the new order.
- Not checked: a touch drag on a real phone (the handle has `touch-none`), and page breaks on a long set.
- Two quick clicks on Add question gave one card in the playtest. The first card pushes the button down, so the second click lands on the new card. This is layout, not a lost click.
- F29: the image picker goes in `QuestionCard`. Preview already shows a stored blob through `getImage` and `imageSrc`. The print sheet marks image-only questions "(picture question)".

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets` and open a set.
1. Drag a card by its ⠿ handle. Or focus the handle and press Space, ↓, Space. Reload: the order stays.
2. Tap Preview on a card. Step with ←/→ and close with Escape.
3. Tap Print answer sheet, then Print. The browser's print preview shows only the table.

## F26 — Set editor (2026-10-28)
**What changed:**
- `/sets/:setId` is now the editor (`pages/SetEditor.tsx`, a lazy route chunk, keyed by `setId`). It replaces the placeholder.
  - Title field, then a card per question: Question, Answer, Host notes (optional) and Points.
  - Text fields have `maxLength` and an `n/max` counter. Inline errors show after a field is left: title, answer and question text required, the length limits, and the points range.
  - Per card: ↑/↓, Duplicate (copy below) and Delete (tap twice). **Add question** appends and focuses a new card; at 100 questions Add and Duplicate are disabled with a message.
  - Status line: Saving… / Saved / Couldn't save.
- `lib/autosave.ts`: `Autosaver` (500 ms debounce, no overlapping writes, a failed value kept for retry) and `useAutosave`, which also flushes on unmount and `pagehide`.
- `lib/setEditor.ts`: pure edits (`addQuestion`, `moveQuestion`, `duplicateQuestion`, `removeQuestion`) and checks (`questionErrors`, `titleError`, `parsePoints`).
- `lib/db.ts`: `saveSet` writes the set and stamps `updatedAt`.
- `Placeholder` now serves only unknown routes, without route params.
- Tests: new `autosave.test.ts` (7, fake timers), `setEditor.test.ts` (12) and `SetEditor.test.tsx` (13). `db.test.ts` gains 1 (`saveSet`). `App.test.tsx` checks `/sets/:setId` without IndexedDB. 799 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-28 for F26 cover:
- autosave: whole-set writes, flushing on leave, and failure and retry
- errors shown after blur, `maxLength`, and empty notes removed
- points: only a valid number is saved
- the question actions, the cap, a missing set, and what F27 and F29 own

**Notes for next session:**
- Playtest (Playwright, one 390×844 tab), all passed:
  - New set opens the editor with "Saved".
  - The fields, counters and the blank-question error work.
  - "Saving…" turns to "Saved" within 750 ms.
  - Move up, Duplicate, and Delete (with Cancel and Confirm) work.
  - After a reload, the title, both questions, answer, notes and points were all still there.
  - At 100 questions, Add question is disabled and the cap message shows.
- Only the favicon 404 showed in the console (pre-existing).
- `SetEditor.test.tsx` uses `vi.useFakeTimers({ shouldAdvanceTime: true })`, because Dexie and fake-indexeddb also schedule with `setTimeout`. Tests that jump past the debounce use `advanceTimersByTimeAsync`.
- F27: add the `@dnd-kit` handle beside the ↑/↓ buttons in `QuestionCard`, and feed `moveQuestion` (or an `arrayMove`) through the same `changeQuestions`. Preview and Print can read the editor's `set` state.
- F29: the image goes in `QuestionCard`. `questionErrors` already accepts an image-only question. Deleting a question should also delete its blob.

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets` and tap New set (or Open on the sample). Edit the title and questions, watch the status go from Saving… to Saved, then reload the page: the edits stay. Use ↑/↓, Duplicate and Delete on the cards.

## F25 — Saved sets and the set list (2026-10-28)
**What changed:**
- `client/src/lib/db.ts`: a Dexie database `buzzr` with `sets` and `images` (blob) tables.
  - The sample set is seeded once, on first visit, in `populate`.
  - Helpers: `listSets` (last edited first), `getSet`, `createSet`, `duplicateSet` (copies image blobs under new ids), `deleteSet` (removes the set's images) and `copyTitle`.
- `/sets` (`pages/Sets.tsx`, a lazy route chunk):
  - Cards show title, "N questions" and "Last edited <date>".
  - Card actions: Open (to `/sets/:id`, still a placeholder until F26), Duplicate, Delete (tap twice) and Host this set.
  - **New set** saves an "Untitled set" draft and opens it. The page also has an empty state and a load-error state.
- **Host a game** on `/` opens a set picker (newest preselected), then **Create room**. Both paths use `hostSet` in `lib/hostRoom.ts`. Its `checkPlayable` refuses a draft with a readable reason before any request.
  - The "Room created" panel moved to `components/RoomCreated.tsx`, shared by `/` and `/sets`.
  - Label helpers are in `lib/setLabels.ts`.
- Tests:
  - New: `db.test.ts` (10, `fake-indexeddb`), `Sets.test.tsx` (11), `hostRoom.test.ts` (6).
  - `Landing.test.tsx` now covers the picker: list order, pick, the no-sets state, draft refusal and Cancel.
  - `App.test.tsx` checks `/sets` without IndexedDB.
  - 767 tests in total.
- New dependencies:
  - `dexie`: the spec's stack table names it for sets and image blobs.
  - `fake-indexeddb` (dev): the roadmap names it for `db.test.ts`.

**Decisions:** the DECISIONS rows dated 2026-10-28 for F25 cover:
- the DB layout and seed-once
- Duplicate, Delete and New set
- the picker, `hostSet` and draft refusal (this supersedes the F08 sample-set row)
- the image-upload gap (F30), with Import and Export left to F28
- the code split that keeps Dexie off the players' bundle

**Notes for next session:**
- Playtest (Playwright, one 390×844 tab), all passed:
  - First visit seeds the sample.
  - Duplicate adds "(copy)", and Host this set on the copy gives "Room created" with a code.
  - The Host a game picker lists both sets.
  - Delete confirms, then removes the set. With every set gone the page shows the empty state, and it stays empty after a reload (no re-seed).
- Only the favicon 404 showed in the console (pre-existing).
- F26 replaces the `/sets/:setId` placeholder. Read and write through `db.ts`, and bump `updatedAt` on save so the list order follows edits. Drafts may stay unplayable: `checkPlayable` guards hosting.
- F30 must upload images in `hostSet` (see the `SPEC-QUESTION` there). The DB layout is fixed; any change needs a Dexie `version(2)`.
- Dexie is in its own chunk (`db-*.js`, 100 kB). Keep `lib/db.ts` out of static imports on Play and Screen paths.

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets`. Duplicate the sample, then tap Host this set and choose Use this device as the Screen. Or, on `/`, tap Host a game, pick a set and tap Create room. To see the empty state, delete every set.

## F24 — Screen and player result states (2026-10-28)
**What changed:**
- Screen judged states:
  - `fx` events now reach the room store (`fx: {fx, seq}`), and `useRecentFx` holds each one for 1.5 s.
  - `ScreenFlash` flashes the Screen green or red.
  - At REVEAL, `ScreenQuestion` shows the answer under the question and "<name> ✓", and "+100" floats up beside the name.
  - While a wrong winner waits for the reopen, their banner is grey and struck through. A grey "locked out" row then stays for the rest of the question.
- `ScreenResults.tsx`:
  - The `Scoreboard` overlay opens in the order it last showed, then slides into the current ranking after 800 ms. The slide is a FLIP animation from `lib/useFlip.ts` and is skipped under `prefers-reduced-motion`.
  - `FinalResults` shows a podium (ties share a step) and the full ranking beside it.
  - `lib/results.ts` holds `ordinal`, `signedPoints`, `podiumSteps` and `replayOrder`.
- Server: `ScreenView` and `HostView` gain `scorerId`, the player judged correct on the current question (`server/views.ts`).
- Player: `buzzerState` adds three states:
  - `out`: ✕, "Locked out this round".
  - `revealed`: the answer, plus "+100" or "−100".
  - `final`: "2nd of 5" and the score, in place of the button.
  - The `kicked` event and a refused rejoin both show "Removed by host".
- Tests: new `results.test.ts` (11) and `useFlip.test.tsx` (4). `buzzerState.test.ts` gains 7, `Screen.test.tsx` 20 (judged, reveal, scoreboard, final, ties) and `Play.test.tsx` 5. `views.test.ts` gains 5 for `scorerId`. 736 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-28 for F24 cover:
- `scorerId`, and what the flash, float and greyed chip show
- the answer shown only when the view carries it
- the scoreboard replay order
- no overlay over FINAL
- the podium for ties
- the 8 vh reserved for the host bar
- the Player result states, the penalty display and the kick page

**Notes for next session:**
- Playtest (Playwright; Screen with the token at 1920×1080).
  - Run 1, with bots: wrong answer (red flash, greyed banner), correct answer (green flash, "+100", answer, "Bot 2 ✓"), scoreboard (S) with tied ranks, a player locked out, a player's reveal "+100", and FINAL via End game. The podium showed ties at 1st and at 3rd, and the phone showed "1st of 4 / 100 points".
  - Run 2, with 2 players and a paired Host remote: all 10 questions to FINAL with N/R, with the podium and the full ranking above the bar. Kick from the Players tab showed "Removed by host" on the kicked phone.
  - Fixed after the playtests: content under the host bar, "+100" over the answer, and the scoreboard covering FINAL.
  - The scoreboard's reorder animation was checked only in unit tests (DOM order with fake timers, FLIP transforms with mocked rects), not by eye.
- F31 (sounds and animations) can hang sounds off `useRoomStore((s) => s.fx)`. The flash, float, FLIP and reduced-motion handling are already in place, so F31 needs the Howler sounds and the Click to start overlay.
- The penalty "−100" sits in red under the answer on the phone. The Screen shows no float for a penalty.

**How to try it:** `npm run dev`.
1. On the laptop, Host a game, then Use this device as the Screen.
2. Join 2–3 players from phones at `http://<LAN-IP>:5173`, or open `/dev/bots`.
3. Run a question with Space, then judge with X (wrong) and C (correct).
4. Press S for the scoreboard, then play on to FINAL (or End game).
5. Kick a player from a paired host phone's Players tab.

## F23 — Screen host controls and shortcuts (2026-10-27)
**What changed:**
- A Screen whose `screen:join` with the hostToken was acked gets `ScreenHostControls` (`client/src/components/ScreenHostControls.tsx`).
  - A bar along the bottom edge with Primary (or Correct / Wrong / "Reopening buzzers…"), Skip, Previous, Undo, Scoreboard, End game (click twice), Fullscreen, Shortcuts and Hide controls. Each button shows its key.
  - The bar hides 3 s after the last pointer move and stays up while hovered. H collapses it; while collapsed, mouse movement shows a small "Show controls" button.
  - The keys Space, C, X, R, N/→, ←, S, U, F, H and `?` work, and the `?` help overlay closes with Esc.
- `client/src/lib/hostControls.ts` holds `primaryFor`, `UNREVEALED`, `inGame`, the `SHORTCUTS` table and the pure `shortcutFor(key, view)`. The remote's `PrimaryAction` and `SecondaryActions` now import the same rules.
- `canJudge` and `canUndo` moved into the shared view fields, so `ScreenView` has them. `useHostCommand` accepts either view, and `useSendHost` moved out of `Host.tsx` into `client/src/lib/useHostCommand.ts`.
- Tests: new `client/src/lib/hostControls.test.ts` (23). `Screen.test.tsx` gains 26 host-control tests: token gating, auto-hide with fake timers, hover, H, help, every key, modifier keys, the lock, the toast, End game, fullscreen, and an answer search with the bar and help open. `views.test.ts` now checks both flags on host and Screen views. 685 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F23 cover the flags on `ScreenView`, gating on an acked token, keys following the button rules (Space does nothing in BUZZED; N/→ from REVEAL only), the hover and collapse behaviour, End game without a key, and the shared lock.

**Notes for next session:**
- Playtest (Playwright; Screen with the token at 1920×1080, 1 Player): the bar shows, auto-hides at 3 s and returns on mouse move. Space, C, X, U, R, →, ←, N, H, F and `?`/Esc all acted. The answers never appeared in the Screen's text after any key. A full game to FINAL was not finished on screen, because S and R change state the Screen does not draw yet (the scoreboard overlay and the answer at REVEAL are F24). After ←, N does nothing until reveal, by design.
- F24 should check that its reveal answer and scoreboard overlay sit above the bar's `absolute bottom-0` position, or move the bar.
- A dropped socket leaves the bar up; a press then toasts "Not connected".

**How to try it:** `npm run dev`. On the laptop, Host a game, then Use this device as the Screen. Join a player at `http://<LAN-IP>:5173` from a phone or second tab. On the Screen, press `?` for the keys, then run the game with Space, C/X, R, N, ←, U and S. Leave the mouse still for 3 s to see the bar hide; press H to toggle it.

## F22 — Host remote: judging, secondary actions, tabs (2026-10-27)
**What changed:**
- `HostView` gains `canJudge` and `canUndo`. Both come from predicates exported by `server/reducer.ts`, which `hostJudge` and `hostUndo` also use. `views.test.ts` checks the flags against `reduce()` in 11 room states.
- The host remote has three tabs: Game, Players (n) and Settings (`client/src/pages/Host.tsx`).
  - Game: the question card, then `PrimaryAction`. In BUZZED it shows Correct / Wrong side by side, or a disabled "Reopening buzzers…" during the 1.5 s wait. Below it, `SecondaryActions`: Skip question (`host:reveal`), Undo last judgement (enabled by `canUndo`), Previous question, Show/Hide scoreboard, and End game (tap twice to confirm).
  - Players (`HostPlayers.tsx`): score, "online · N ms" or "offline", −/+ the current question's points (`host:adjustScore`), and Kick (tap twice to confirm).
  - Settings (`HostSettings.tsx`): penalty and auto-open switches, and a stepper for scoreboard every N (0 = Never, up to `SCOREBOARD_EVERY_MAX`). Each sends only its own key.
- `client/src/lib/useHostCommand.ts` holds one lock for the whole remote. A press disables every button until the next snapshot or a rejection; a rejection shows the toast. `ConfirmButton.tsx` is the tap-twice button.
- Tests: new `client/src/components/HostControls.test.tsx` (29). `Host.test.tsx` covers tabs, Correct / Wrong, the shared lock and the reopen wait. `views.test.ts` gains 12. 636 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F22 cover the two view flags, Skip = `host:reveal`, which actions show in which phase, tap-twice confirmation for Kick and End game, the ± step and when it hides, the shared lock, and the RTT display.

**Notes for next session:**
- Playtest (Playwright; 1 Screen, Host and 3 Players): a 3-question game run from the remote alone. It covered a wrong answer with the penalty off and on, then a correct answer, an undo back to BUZZED, ±100, a kick (3 players to 2), all three settings (kept across a host reload; auto-open worked on Q2 and Q3), Previous, and End game. The answer never appeared on the Screen or the phones. The playtest found raw float RTT values; they are now rounded.
- Left for F24: the Screen does not render the scoreboard overlay yet. The Show scoreboard toggle and `scoreboardEvery` only flip `showScoreboard`. The Player FINAL and "Removed by host" states are also F24. The host FINAL view is still in Backlog.
- Backlog additions: a stable host Players order, arrow keys for the tabs, and a typed replacement for the `emit` cast in `Host.tsx`.

**How to try it:** `npm run dev`. On the laptop, Host a game, then Use this device as the Screen. Scan Pair host phone with a phone (or open the `/host/<code>#t=…` link). Join 2–3 players at `http://<LAN-IP>:5173`, then run the game from the phone using the Game, Players and Settings tabs.

## F21 — Gateway: remaining host events (2026-10-27)
**What changed:**
- `server/sockets.ts` wires `host:judge`, `host:undo`, `host:adjustScore`, `host:settings` and `host:kick`. They go through `asHost`, so they need `canHost`: a host socket, or a Screen holding the token. They also get the zod parse and guarded ack from `handle`. Every host event in the spec is now wired.
- `host:kick` works like this after the reducer accepts it:
  - The gateway emits `kicked {}` to every socket in `room:<code>:player:<id>`.
  - Then it calls `disconnectSockets()` without closing the transport. The client sees `io server disconnect` and does not reconnect.
  - The kicked player gets no final `state` and no `fx`. A rejoin with the same id fails with `PLAYER_KICKED_ERROR` (F05).
- `fx correct` and `fx wrong` come from the reducer's effects (F19) through the existing `runEffects`. `fx join` was already emitted and tested (`sockets.test.ts`).
- Tests: new `server/sockets.host.test.ts` (12):
  - Rejection from a player and from a plain Screen.
  - A Screen holding the token can judge, adjust and kick, and still gets only ScreenView.
  - An invalid payload and an unknown settings key are rejected.
  - `fx correct` reaches all 4 sockets.
  - Judge wrong, then reopen at exactly 1.5 s with fake timers. The locked-out player's buzz is ignored.
  - Undo cancels the pending reopen.
  - Adjust and settings.
  - The kick flow: `kicked`, disconnect, no state, and the rejoin refused. Also two sockets for one player, an unknown player, and kicking the unjudged winner, which reopens the buzzers.
  - 589 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-27 for F21 covers the order of `kicked` and the disconnect, and why the transport stays open until the disconnect packet.

**Notes for next session:**
- F22 (host remote) can now send every host event. As noted in F20, no view says whether undo is available yet. Add `HostView.canUndo` server-side rather than deriving it in the client.
- The Player client must handle `kicked` by showing "Removed by host" and must not retry the join. The socket closes right after.
- `sockets.test.ts`, `sockets.buzz.test.ts` and `sockets.host.test.ts` each have a copy of the start/connect harness (see Backlog).

**How to try it:** `npx vitest run server/sockets.host.test.ts`. There are no Host remote buttons until F22.

## F20 — Reducer: undo, score adjust, kick, settings, final ranking (2026-10-27)
**What changed:**
- `server/reducer.ts` gains four host actions. The zod schemas existed since F02.
  - `host:undo` works in OPEN, COLLECTING, BUZZED or REVEAL. It reverses the last judgement of the current question: the score delta, the lockout and the judgement record. It returns to BUZZED with the buzzes and winner as judged, and newer buzzes are discarded. There is one level per question; otherwise it fails with "Nothing to undo".
  - `host:adjustScore {playerId, delta}` works in any phase.
  - `host:kick {playerId}` works in any phase. It removes the player, adds the id to `kickedIds`, and drops their buzzes, lockout and undo point. An unjudged winner's buzz is discarded and the buzzers reopen, or the room goes to REVEAL if nobody else is eligible. A kick that empties the COLLECTING window also reopens.
  - `host:settings` works in any phase and merges the keys that are set.
- `Room.undo: UndoPoint | null` (`shared/types.ts`). `host:judge` sets it; entering a question, FINAL via next, and the undo itself clear it.
- The `reopen` timer action now carries `at` and is ignored unless `at === room.reopenAt`. This fixes the F19 note: after undo and a second wrong judgement, the first timer no longer reopens early. `openingCounter` never moves backwards.
- `applyJudgement` takes `'adjust'`: score only, with no judgement and no lockout. It stays the only score writer, now used by judge, adjust and undo.
- Tests:
  - New `server/reducer.undo.test.ts` (19): exact restore after a correct answer, after a wrong answer during the wait, after wrong then reopen, and after the last wrong one. Also one level only, stale timers after undo, and the phase guard.
  - New `server/reducer.admin.test.ts` (42).
  - `server/ranking.test.ts` gains 4 tie cases.
  - The judge tests' `reopen` helper now carries `at`.
  - 577 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F20 cover the following:
- They resolve open questions 6 (an undo snapshot) and 10 (kicking the winner).
- They record the `at` match on `reopen` and the monotonic counter.
- They record the `'adjust'` score change, and that adjust, kick and settings work in every phase.
- They record that a settings change applies the next time the setting is read.

**Notes for next session:**
- F21 must wire `host:undo`, `host:adjustScore`, `host:kick` and `host:settings` in `server/sockets.ts`, as well as `host:judge`, with `canHost` and the zod schemas. On kick, the gateway emits `kicked` to the player's socket(s) and disconnects them. The reducer emits no effect for this; the gateway reads it from the action.
- No view shows whether undo is available yet. F22's Undo button needs it, for example `HostView.canUndo = room.undo !== null && phase in OPEN…REVEAL`, so the client does not derive the rule (DECISIONS F02).
- The ± buttons send the question's `points` as `delta`; the server accepts any integer within ±100000.

**How to try it:** `npx vitest run server/reducer.undo.test.ts server/reducer.admin.test.ts server/ranking.test.ts`. There is no socket path or UI until F21 and F22.

## F19 — Reducer: judging, lockout and reopen (2026-10-27)
**What changed:**
- `server/reducer.ts` handles `host:judge {result}`, accepted only in BUZZED:
  - Correct: the winner gets the question's points, the room moves to REVEAL, and the reducer emits `fx correct {playerId, points}`.
  - Wrong: the winner is locked out, loses the points if `wrongPenalty` is on, and the reducer emits `fx wrong`.
  - If anyone is still eligible, the room stays in BUZZED with `reopenAt = now + 1500` and schedules `reopen`. Otherwise it moves to REVEAL.
  - A second judge of the same buzz is rejected: "Not allowed in this phase" after a correct answer, "Already judged" while a reopen is pending.
- New timer action `reopen {questionIndex, openingCounter}` (part of `TimerAction`). It opens a new opening and keeps `lockedOut`. It is a no-op unless the room is in BUZZED with a reopen pending, on the same question and opening.
- New exported `applyJudgement(room, playerId, result, pointsDelta)` is the only score writer. `Room` gains `reopenAt: number | null`, which `host:reveal`, `host:next` and `host:prev` clear.
- Tests: `server/reducer.judge.test.ts` (34 tests). They cover phase rejection, double judging, correct, wrong with the penalty on and off, negative scores, last eligible → REVEAL, a disconnected winner, and the reopen with stale cases after reveal, next, prev and end. 512 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F19 resolve open questions 5 (the wait stays in BUZZED with `reopenAt`) and 9 (eligible means connected and not locked out, checked at judge time). They also record that a judged buzz keeps `winnerId` and `buzzes` into REVEAL, and the `applyJudgement` signature.

**Notes for next session:**
- `host:judge` is not wired in `server/sockets.ts` yet; that is F21. The gateway's `schedule` already runs `reopen` through the generic `TimerAction`, so F21 needs the handler (`canHost`, zod `host:judge`) and the `sockets.host.test.ts` reopen-after-1.5 s test.
- F20 undo: undoing a wrong answer during the wait must clear `reopenAt`. If the host then judges wrong again, the first `reopen` timer still matches index and counter and would reopen early. Guard it, for example by comparing `now >= room.reopenAt` or by putting `at` on the action.
- No view exposes `reopenAt` yet. During the wait, Screen and players still see BUZZED with the winner, and `lockedOut` includes them.

**How to try it:** `npx vitest run server/reducer.judge.test.ts`. There is no UI or socket path until F21 and F22.

## F18 — Screen question and buzz views (2026-10-27)
**What changed:**
- New `client/src/components/ScreenQuestion.tsx` renders the Screen from QUESTION to REVEAL:
  - "Question N of M", the question text, and the image (`object-contain`, beside the text or alone).
  - A status pill: "Buzzers locked" (grey) or "Buzzers OPEN" (red, pulsing, through COLLECTING too).
  - In BUZZED, the pill is replaced by the winner's name in a giant banner in their colour, with "also buzzed" names in their colours and gaps such as "+0.12 s".
- New `client/src/lib/screenQuestion.ts`: `formatGap`, `questionTextClass` (5 length steps in `min(vw, vh)`, one step down with an image) and `buzzersOpen`. `client/src/lib/api.ts` gains `imageUrl(code, imageId)`.
- `Screen.tsx`: FINAL shows "Game over" until F24. No Screen component renders an answer.
- Tests: 8 in `screenQuestion.test.ts`, 10 new in `Screen.test.tsx`. These include a DOM test that feeds an answer in QUESTION, OPEN, COLLECTING and BUZZED views and checks `innerHTML`. 478 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F18 cover:
- Length-step shrinking instead of measuring the box.
- In BUZZED, the banner replaces the status line and the question stays.
- REVEAL and FINAL placeholders until F24.
- The image URL ahead of F30.

**Notes for next session:**
- Playtest (2026-10-27, `PORT=3100 npm start`, because PokéTrack held :3000). All bullets passed at 1920×1080:
  - Q1 showed locked, then OPEN with the colour change.
  - On Q2, three players buzzed at once. The banner showed "Ann" in her colour, and below it "also buzzed Bob +0.00 s, Cy +0.00 s".
  - The answers ("Jupiter", "Oxygen") were absent from the Screen's `innerText` and `outerHTML` before reveal.
  - The players were 3 browser contexts, not `/dev/bots`, which the production build doesn't serve. The near-simultaneous clicks gave 0.00 s gaps. Non-zero gaps are covered by unit tests only.
- The sample set has no long question and no image, so shrinking and the image area were checked in unit tests only. F30 adds the sample images. Check the layout then.
- F24: add the answer under the question at REVEAL in `ScreenQuestion`, replace the `TODO(F24)` FINAL placeholder in `Screen.tsx`, and grey out locked-out players.

**How to try it:** `npm run dev`, then Host a game on `http://localhost:5173`; the Screen opens at `/screen/<CODE>`. Join 2–3 players from `/play/<CODE>` (phones on `http://<LAN-IP>:5173`) or spawn bots at `/dev/bots/<CODE>`. Pair the host remote, then Start game ("Buzzers locked") and Open buzzers ("Buzzers OPEN"). Buzz from several players: the Screen shows the winner's banner and the "also buzzed" gaps.

## F17 — Player buzzer screen (2026-10-27)
**What changed:**
- The Player view's `Buzzer` in `client/src/pages/Play.tsx` is now live. It is a whole-viewport circle that fires on `pointerdown` and on Space (no key repeat). A press shows "Buzzed…" and calls `navigator.vibrate(30)` before it sends `player:buzz`. A rejected ack frees the button.
- New `client/src/lib/buzzerState.ts` maps the `PlayerView` to the look and label: Lobby, Get ready…, BUZZ! (red, pulsing), Buzzed…, You're first! Answer now (green), "<Name> buzzed first" (dim).
- The button and page use `touch-none`, `select-none` and `[-webkit-touch-callout:none]`, and the button blocks the context menu.
- New `client/src/lib/ping.ts` (`keepPinging`): pings every `PING_INTERVAL_MS` while connected and acks every `pong`. `useRoomSocket` takes an optional `attach(socket)` that runs before `connect()`; the Player page attaches the pinger. `dev/bots.ts` now reuses `keepPinging`, with its tests unchanged.
- `index.css`: theme tokens `buzz`, `buzz-edge`, `win`, `win-edge` and the `animate-buzz-pulse` animation.
- Tests: 8 in `buzzerState.test.ts`, 5 in `ping.test.ts`, 13 new in `Play.test.tsx`. 460 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F17 cover:
- Pings start on the socket's connect, not on page load.
- The optimistic press lasts the whole opening; only a rejected ack frees it.
- Locked out, REVEAL and FINAL stay "Game in progress" until F24.

**Notes for next session:**
- Playtest (2026-10-27, `PORT=3100 npm start` because a PokéTrack dev server held :3000): 3 players at 375 px. Lobby, Get ready, BUZZ! and pointerdown all passed. The winner's tab went green and the other two showed "Ben buzzed first". A Space buzz on the next question passed. Computed `touch-action` and `user-select` were `none`. The client sent `ping` every 2 s and acked every `pong`. "Buzzed…" was too brief to see on localhost; the unit test covers it.
- `vite.config.ts` proxies to `DEFAULT_PORT` only, so `npm run dev` cannot move off :3000.
- The host remote shows no RTT, so a phone's `rttMs` is only visible in tests and `/dev/bots`.
- F24 replaces the `TODO(F24)` branches in `buzzerState.ts`.
- A buzz the server ignores silently leaves "Buzzed…" up for the opening (Backlog: `canBuzz`).

**How to try it:** `npm run dev`, Host a game on `http://localhost:5173`, then join two or three phones at `http://<LAN-IP>:5173/play/<CODE>`. From the host remote, Start game, then Open buzzers. Tap one phone: it turns green, and the others show its name. On a desktop tab, Space buzzes.

## F16 — Host remote primary action (2026-10-27)
**What changed:**
- New `client/src/components/PrimaryAction.tsx` is the remote's full-width primary button. Its label and event follow the phase:
  - LOBBY: Start game.
  - QUESTION: Open buzzers.
  - OPEN, COLLECTING and BUZZED: Reveal answer.
  - REVEAL: Next question, or Show final results on the last question.
  - FINAL: no button.
- After a press, the button stays disabled until a new `state` arrives or the ack is a rejection.
- New `client/src/components/Toast.tsx` (`useToast`, `Toast`, `TOAST_MS` = 3 s). A rejected ack shows the server's error as a toast.
- `useRoomSocket` now returns a ref to the open socket. `Host.tsx` sends through it, and a null socket is rejected locally as "Not connected".
- Tests: 10 new ones in `Host.test.tsx` cover labels and events per phase, the cycle, a double tap, and the toast and its timer. 1 new one in `sockets.buzz.test.ts`: two host sockets send `host:next` at once, one is ok, the other gets "Not allowed in this phase", and every device ends on question 2. 434 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F16 cover:
- The label map, with BUZZED on Reveal answer until F22.
- Start game stays enabled with no players, so the server's error comes back as a toast.
- The disable-until-snapshot rule, which needs no timer.
- The toast's length and the offline buffering.

**Notes for next session:**
- F22 replaces the BUZZED entry in `BY_PHASE` (`TODO(F22)`) with Correct / Wrong. Reuse `useToast` and the `send` pattern for the secondary actions, and widen `PrimaryEvent`/`send` to take a payload (`host:judge {result}`).
- Playtest result (2026-10-27): start, open, reveal and next across all 10 questions passed. Show final results passed. Two host tabs pressing Reveal at once passed: the loser got the toast and both tabs matched. The Screen only shows "Game in progress" until F18, so "Screen follows" could not be seen there.
- In FINAL, the remote keeps showing the last question. A game-over state for the remote is in the Backlog.

**How to try it:** `npm run dev`, then Host a game on `http://localhost:5173`. Use **Pair host phone** (or a phone on `http://<LAN-IP>:5173`) to open the remote. Join one player from `/play/<CODE>` or `/dev/bots/<CODE>`, then drive the game from the remote. For the toast, open the remote in two tabs: once one tab has pressed Reveal answer, press it in the other before that tab updates. Alternatively, press Start game with no players.

## F15 — Gateway: effects runner, ping and buzz (2026-10-27)
**What changed:**
- `server/sockets.ts` runs the reducer's new effects:
  - `schedule` runs `setTimeout(() => dispatch(code, action), at − now)`. Pending timers are cleared when the HTTP server closes.
  - `log` prints one `[buzz] {…}` JSON line per counted buzz.
  - `dispatch` skips the store and the broadcast when `reduce` returns the same room.
- New gateway option `monotonic` (default `performance.now()`). It supplies the buzz `receivedAt` and times RTT.
- New handlers:
  - `player:buzz`: joined players only, 5/s per socket (`BUZZ_RATE_LIMIT`, "Too many buzzes").
  - `ping`: 5/s per socket (`PING_RATE_LIMIT`). It answers `pong {t}` with an ack. The server times emit → ack, keeps the samples on `socket.data`, and writes the median into the player's `rttMs`. That write sends no broadcast and stamps no activity.
  - `host:start/open/reveal/next/prev/end/scoreboard`, gated by `canHost` ("Only the host can do that").
- `shared/types.ts`: `pong` now has an ack. `client/src/dev/bots.ts` acks it.
- New constants: `NOT_HOST_ERROR`, `BUZZ_RATE_LIMITED_ERROR`, `PING_RATE_LIMIT`, `PING_RATE_LIMITED_ERROR` and `PONG_ACK_TIMEOUT_MS`.
- 15 new tests in `server/sockets.buzz.test.ts` (fake `setTimeout`, injected monotonic clock) and 1 in `bots.test.ts`, 420 in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F15 cover:
- How the server times RTT (the `pong` ack, resolving the F12 note). This is also a proposed spec change.
- Where the RTT samples live, with no broadcast and no activity stamp.
- How timers are scheduled and cleared.
- Skipping the broadcast for ignored actions, and the log format.
- The auth errors for host and buzz events.
- The ping rate limit, a spec gap.

**Notes for next session:**
- F17's player client must ping every `PING_INTERVAL_MS` and **ack every `pong`**. Without the ack the server gets no sample and `rttMs` stays 0, which means no latency correction. This is now a Done-when bullet on F17.
- `HostView.players[].rttMs` is a raw median in fractional ms, so clients should round it.
- `host:judge/undo/adjustScore/kick/settings` are still unwired (F19–F21). F19's `reopen` effect goes through the same `schedule` path, so no gateway change is needed.
- `sockets.buzz.test.ts` has its own harness. `flush(c)` sends `screen:join` ("Already joined") as a side-effect-free round trip. Use it before recording, because a broadcast to other sockets can land after the sender's ack.

**How to try it:** `npx vitest run server/sockets.buzz.test.ts`. In the app, `npm run dev`: create a room, open `http://localhost:5173/dev/bots/<CODE>` (F11), spawn bots, then use the host remote to start and open. The bots' buzzes now get a winner `fx` and the server prints `[buzz]` lines. Player buzz UI arrives in F17/F18.

## F14 — Reducer: buzz collection and window close (2026-10-27)
**What changed:**
- `server/reducer.ts` adds two actions:
  - `player:buzz {playerId, receivedAt}`. `receivedAt` is the gateway's monotonic time.
  - `windowClosed {questionIndex, openingCounter}`, a new `TimerAction`.
- `Effect` gains `schedule {at, action}` and `log {questionIndex, openingCounter, buzz}`.
- Buzz behaviour by phase:
  - The first counted buzz in OPEN goes to COLLECTING and schedules `windowClosed` at `now + 150`.
  - COLLECTING adds the buzz to the window.
  - BUZZED records a late buzz for the also-buzzed list. It never changes the winner.
  - Every counted buzz emits a `log` effect.
  - `windowClosed` checks COLLECTING, the index and the counter. It ranks with `rankBuzzes`, sets `winnerId`, moves to BUZZED and emits `fx buzz` with `buzzGaps`.
- Ignored buzzes and stale timers return ok with the same `room` object and no effects. `reduce` leaves `lastActivityAt` unstamped for them. Ignored buzzes are: wrong phase, locked out, already buzzed this opening, or joined this opening.
- New `Player.joinedAtOpening` field: the `openingCounter` at join, kept on reconnect. It implements "can buzz from the next opening".
- `toView`'s `alsoBuzzed` is now filled in. The winner stays first, and every other buzz is ranked with its gap to the winner.
- 36 new tests in `reducer.buzz.test.ts` and 3 in `views.test.ts`, 404 in total.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F14 cover:
- Open question 4 (late buzzes in BUZZED), now resolved.
- `joinedAtOpening`.
- Silent ignores that return the same room. An unknown player id fails with "Unknown player".
- The `schedule` and `log` effects.
- The window lasts until the timer fires. Measuring it in monotonic time is in the Backlog.

**Notes for next session:**
- F15 wires `player:buzz` in `sockets.ts`:
  - Dispatch `{type: 'player:buzz', playerId, receivedAt: performance.now()}`.
  - In `runEffects`, `schedule` should run `setTimeout(() => dispatch(code, effect.action), effect.at - clock())`, and `log` should print the buzz.
  - `runEffects` currently has no case for either, so both are silently dropped.
  - `dispatch` can skip `broadcast` when `result.room === room`, which is an ignored action.
  - Clear pending timers when a room closes.
- F19's `reopen` joins `TimerAction`. While BUZZED has a pending reopen, decide whether late buzzes still record for the old opening. They currently would.
- Kicking a player (F21) during COLLECTING: `rankBuzzes` sorts a departed player last, but a lone departed buzzer would still become `winnerId`.

**How to try it:** `npx vitest run server/reducer.buzz.test.ts server/views.test.ts`. Nothing is visible in the app until F15/F18.

## F13 — Reducer: question flow (2026-10-27)
**What changed:**
- `server/reducer.ts` accepts seven new actions. They are named like their socket events, and `host:scoreboard` carries `show`.
  - `host:start`: LOBBY with at least 1 player, to QUESTION 0.
  - `host:open`: QUESTION to OPEN. It clears `buzzes` and adds 1 to `openingCounter`.
  - `host:reveal`: QUESTION, OPEN, COLLECTING or BUZZED to REVEAL. It drops the buzzes and the winner, and keeps the lockouts.
  - `host:next`: REVEAL to the next QUESTION, or to FINAL after the last question.
  - `host:prev`: any question phase or REVEAL to QUESTION index − 1. It is rejected at index 0.
  - `host:end`: any phase to FINAL.
  - `host:scoreboard`: any phase. It sets the overlay.
- `enterQuestion` resets `buzzes`, `winnerId` and `lockedOut`. With `autoOpenBuzzers` on, it goes straight to OPEN (start, next and prev). `host:next` sets `showScoreboard` when the finished question number is a multiple of `scoreboardEvery`.
- A wrong phase fails with the exported `WRONG_PHASE_ERROR` ("Not allowed in this phase"). No effects are emitted, and there is no socket wiring yet.
- There are 64 new tests in `reducer.flow.test.ts`, 365 in total. They cover each transition row, plus a table-driven test that every unlisted phase rejects each action and leaves the room unchanged.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F13 cover:
- Open questions 7 (when the overlay hides) and 8 (prev onto an answered question), now resolved.
- Auto-open on every entry to QUESTION. The start rule counts disconnected players.
- FINAL clears the per-question state. Reveal keeps lockouts. End and scoreboard work in every phase.
- One wrong-phase error. Stale timers are guarded by phase + index + counter.

**Notes for next session:**
- F14's `windowClosed` must check that the phase is COLLECTING, as well as `questionIndex` and `openingCounter`. F19's `reopen` must check BUZZED with a pending reopen. Only an opening bumps the counter, so after `prev`/`next` back to the same question the counter alone does not prove an effect is fresh.
- F15/F21 wire these through `sockets.ts` `dispatch` (host token check, zod parse, ack).
- F19 adds the reopen wait (open question 5). `host:reveal` and `host:prev` from BUZZED with a pending reopen then need to clear it.

**How to try it:** `npx vitest run server/reducer.flow.test.ts`. Nothing is visible in the app until F15/F16.

## F12 — Fairness: latency and ranking (2026-10-27)
**What changed:**
- `server/fairness.ts`, pure functions with no clock or socket:
  - `addRttSample(samples, rttMs)` keeps the newest `RTT_SAMPLES` (10) and drops negative or non-finite samples.
  - `medianRtt(samples)` returns 0 with no samples. With an even count, it takes the mean of the two middle samples.
  - `oneWayMs(rtt) = rtt / 2`.
- `makeBuzz(playerId, receivedAt, rttMs)` → `Buzz` with `adjustedAt = receivedAt − min(oneWay, MAX_LATENCY_CORRECTION_MS)`. A negative or non-finite RTT counts as 0.
- `rankBuzzes(buzzes, players)` puts the winner first. It sorts by `adjustedAt`, then `receivedAt`, then `joinedAt`. A buzz from a player who has left sorts after the rest of its tie. `buzzGaps(ranked)` returns `BuzzGap[]` (`adjustedAt` gap to the winner, in rank order, winner excluded).
- There are 21 new tests in `fairness.test.ts`, 301 in total.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F12 cover:
- Open question 16 (no correction before the first sample), now resolved, and the even-count median.
- Pure functions only. F15 picks where the samples live.
- Departed players in ties, and raw-ms gaps that clients format.

**Notes for next session:**
- F15 wires this up. On each RTT sample: `samples = addRttSample(samples, rtt)`, then `player.rttMs = medianRtt(samples)`. The samples need a home: a `Player.rttSamples` field that views never copy, or a gateway map cleared when a player or room goes. The reducer then builds buzzes with `makeBuzz(id, receivedAt, player.rttMs)`, where `receivedAt` comes from `performance.now()` in the gateway.
- The spec's ping shape is `ping {t}` → `pong {t}`. That pair lets the client measure RTT, but not the server. F15 has to decide how the server gets a sample, for example from the client's measured RTT or from a server-initiated ping.
- Late buzzes in BUZZED (DECISIONS #4) still go through `rankBuzzes`/`buzzGaps`. They can never outrank the announced winner only because the reducer keeps `winnerId` fixed, so F14/F15 must not re-pick the winner from a re-rank.

**How to try it:** `npx vitest run server/fairness.test.ts`. Nothing is visible in the app until F15.

## F11 — Dev tool: fake players (2026-10-27)
**What changed:**
- `client/src/dev/bots.ts`: `createBot({code, index, onChange})`. Each bot is its own `createSocket()` that joins as `bot-<n>` / "Bot <n>" on every connect, pings every `PING_INTERVAL_MS` while connected, and has `buzz(delayMs)`. A buzz shows its ack, or "No reply in 2 s". Also `buzzDelay` (0–300 ms) and `clampBotCount` (1–50).
- `client/src/dev/DevBots.tsx` at `/dev/bots/:code`: a count input (default 8), **Spawn** (grows or shrinks the set to N), **Remove all**, **Buzz all (random 0–300 ms)**, and one row per bot with status, RTT and the last message.
- `App.tsx` registers the route only when `import.meta.env.DEV` and lazy-loads the page. After `npm run build`, `grep -rE "dev/bots|Buzz all|Bots for|bot-" dist/client` finds nothing.
- There are 27 new tests, 280 in total: `bots.test.ts` (17), `DevBots.test.tsx` (7), `App.test.tsx` (2: the route in dev, "Page not found" with `DEV=false`) and `sockets.test.ts` (1: 20 joins from one IP at once under the default limit).

**Decisions:** the DECISIONS rows dated 2026-10-27 for F11 cover:
- The client-only route gated on `import.meta.env.DEV`.
- Fixed bot ids, so a re-spawn reconnects. No dev-specific join limit.
- The 2 s buzz-ack timeout, and pinging only while connected.

**Notes for next session:**
- F15 adds the `ping`→`pong` handler and `player:buzz`. The bots' RTT column then fills in, and their buzz rows show real acks instead of "No reply in 2 s".
- One `/dev/bots` tab per room. Two tabs would drive the same `bot-<n>` players.
- `vi.stubEnv('DEV', false)` plus `vi.resetModules()` and a dynamic `import('./App.js')` is how the production-route test sees the build flag.
- The playtest saved no screenshot, because no step failed. Its evidence: 8 bots joined and the Screen showed "8 players" with chips Bot 1–8; 20 bots joined with no limit error; Buzz all gave "No reply in 2 s" on every row.

**How to try it:** Run `npm run dev`. On the laptop, open `http://<LAN-IP>:5173`, click **Host a game**, then **Use this device as the Screen**. In another tab, open `http://<LAN-IP>:5173/dev/bots/CODE`, set the count and click **Spawn**. Chips appear on the Screen. **Buzz all** sends a buzz from every bot (the server ignores it until F15). `npm run build && npm start`, then `/dev/bots/CODE` shows "Page not found".

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
