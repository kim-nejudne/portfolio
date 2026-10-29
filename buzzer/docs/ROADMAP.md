# Roadmap

Status: [ ] todo · [~] in progress · [x] done · [!] blocked (see note)

Change markers with `node .claude/scripts/roadmap.mjs mark`. A done item collapses to one line; its details are in PROGRESS.md and git history.

## M1 — Skeleton

- [x] F01 Project skeleton and tooling

- [x] F02 Shared types, schemas and constants

- [x] F03 Landing page and route shell

## M2 — Rooms and joining

- [x] F04 Room codes and RoomStore

- [x] F05 Reducer foundation: lobby, players, toView

- [x] F06 Room creation over HTTP

- [x] F07 Socket gateway: joins and state broadcast

- [x] F08 Host a game and the Screen lobby

- [x] F09 Player join flow

- [x] F10 Host pairing and host remote shell

- [x] F11 Dev tool: fake players

## M3 — Buzzer core

- [x] F12 Fairness: latency and ranking

- [x] F13 Reducer: question flow

- [x] F14 Reducer: buzz collection and window close

- [x] F15 Gateway: effects runner, ping and buzz

- [x] F16 Host remote primary action

- [x] F17 Player buzzer screen

- [x] F18 Screen question and buzz views

## M4 — Host controls and scoring

- [x] F19 Reducer: judging, lockout and reopen

- [x] F20 Reducer: undo, score adjust, kick, settings, final ranking

- [x] F21 Gateway: remaining host events

- [x] F22 Host remote: judging, secondary actions, tabs

- [x] F23 Screen host controls and shortcuts

- [x] F24 Screen and player result states

## M5 — Question editor and images

- [x] F25 Saved sets and the set list

- [x] F26 Set editor

- [x] F27 Reorder, preview and print sheet

- [x] F28 Import and export JSON

- [x] F29 Image pipeline in the editor

- [x] F30 Image upload, serving and preload

## M6 — Polish

- [x] F31 Sounds and animations

- [x] F32 Reconnects and room lifecycle

- [x] F33 Device polish and feedback

## M7 — Deploy

- [x] F34 Dockerfile and deploy guide

## M8 — Host options

Kim's request of 2026-10-28: the host can let players buzz as soon as a question appears, and can give the buzz winner a fixed time to answer. Proposed spec wording is in DECISIONS, Proposed spec changes (answer timer, lobby settings). Auto-open buzzers already exists (F13); F37 makes it reachable without a paired phone.

- [x] F35 Answer timer: server and phone setting

- [x] F36 Answer countdown and time's-up on the devices

- [x] F37 Settings in the Screen lobby

## M9 — Backlog

Kim's review of 2026-10-28: every Backlog item is scheduled here, grouped by area. The choices are in DECISIONS rows dated 2026-10-28 marked "backlog plan". Proposed spec wording is in DECISIONS, Proposed spec changes (backlog). The old "deploy workflow" item was already done (`deploy-buzzer.yml`) and became the CI job in F46.

- [x] F38 Screen lobby fit

- [x] F39 Buzz eligibility and monotonic window

- [x] F40 Host remote: game over, stable order, tab keys

- [x] F41 Connection awareness

- [x] F42 Join address and room-check limit

- [x] F43 Preview: show answer

- [x] F44 Favicon and hover states

- [x] F45 Socket test harness and typed host emit

- [x] F46 Slim runtime image and CI job

## M10 — Starter sets

Kim's request of 2026-10-29: 60 built-in sets (20 categories × Easy, Medium, Hard, 15 questions each) for Filipino game nights, written in Claude Desktop and reviewed in Claude Code. The choices are in the DECISIONS row dated 2026-10-29 marked "starter plan". Proposed spec wording is in DECISIONS, Proposed spec changes (starter sets).

- [x] F47 Starter set data

- [x] F48 Seed starter sets into My sets

## M11 — New game

Kim's request of 2026-10-29: after a game ends, the host picks another set and starts a new game in the same room. The choices are in the DECISIONS row dated 2026-10-29 marked "new game plan". Proposed spec wording is in DECISIONS, Proposed spec changes (new game).

- [x] F49 New game: server

- [x] F50 New game: picker on the Screen and the remote

## M12 — Audit fixes

Kim's request of 2026-10-29: schedule every finding of the product audit (M12–M23). The choices are in the DECISIONS rows dated 2026-10-29 marked "audit plan". Proposed spec wording is in DECISIONS, Proposed spec changes (audit). M12 takes the three Backlog bugs and the missing host-remote link.

- [x] F51 Host remote link after room creation

- [x] F52 Screen fixes from the backlog

## M13 — Set library

Built-in sets move out of My sets into a read-only library, and every set picker gets search, categories and difficulty (DECISIONS, audit plan).

- [x] F53 Set category and difficulty fields

- [ ] F54 Built-in sets library
  - Spec: Question editor and images (Set list `/sets`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F53
  - Done when:
    - `shared/builtInSets.ts` exports `BUILT_IN_SETS` (`SAMPLE_SET` then `STARTER_SETS`), read from the bundle and never written to IndexedDB. New browsers no longer seed them
    - Dexie `version(3)` deletes each stored set whose id is a built-in id and whose title, category, difficulty and questions deep-equal the bundled set (a copy seeded before F53 has neither field: compare it as if it had the bundled ones, DECISIONS F53). An edited copy stays in My sets under a fresh id, so no stored id collides with a built-in one. The sample's seeded images are deleted with it when no other set uses them
    - `/sets` has two tabs, **Built-in** and **My sets** (My sets first when it has any set, else Built-in). Built-in cards offer **Host this set** and **Duplicate to My sets** only; My sets keeps every current action
    - **Host a game** and the **New game** picker list My sets and then the built-ins. Hosting the sample uploads its images from `sampleImages()` (`client/src/lib/sampleImages.ts`), not IndexedDB
  - Tests: `db.test.ts` (v3 upgrade from a v2 database: untouched starters and sample removed, edited ones kept with new ids, the host's own sets untouched; fresh database holds no built-ins), `hostRoom.test.ts` (built-in sample images), `Sets.test.tsx` (tabs, built-in actions), `NewGamePicker.test.tsx`

- [ ] F55 Set browser: search, categories and difficulty
  - Spec: Question editor and images (Set list `/sets`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F54
  - Done when:
    - `client/src/lib/setFilter.ts` filters sets by a search string (title and category, case- and accent-insensitive), by difficulty chips (any of Easy, Medium, Hard, None) and groups them by category (sets without one under "Other"), keeping each list's order
    - A shared `SetBrowser` component (search box, difficulty chips, grouped list, single selection or action buttons) replaces the flat lists in `HostGame`, `NewGamePicker` and both `/sets` tabs
    - With the 61 built-ins, typing "anim" and choosing Easy leaves one set; a phone at 375×667 shows the search box and chips without scrolling the picker
    - Keyboard: the search box is first in tab order; Enter on a single result selects it
  - Tests: `setFilter.test.ts` (search, accents, chips, grouping, order), `SetBrowser.test.tsx`, updated `Landing.test.tsx`, `NewGamePicker.test.tsx` and `Sets.test.tsx`. `/playtest`: pick Animals – Easy by search on a phone-sized tab and on the Screen's New game picker

- [ ] F56 Set preview before hosting
  - Spec: Question editor and images (Set list `/sets`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F55
  - Done when:
    - Every set in `SetBrowser` has a **Preview** action that opens a read-only list of its questions with answers, host notes, points and image thumbnails
    - Preview never shows on the Screen: it is offered on `/sets`, **Host a game** and the remote's New game picker, not in the Screen's New game picker (the Screen is public)
    - From the preview the host can pick the set (pickers) or host it (`/sets`)
  - Tests: `SetPreview.test.tsx` (content, images, pick), `NewGamePicker.test.tsx` (no Preview on the Screen)

## M14 — Mixed games

- [ ] F57 Game builder
  - Spec: Question editor and images (Set list `/sets`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F55
  - Done when:
    - `client/src/lib/gameBuilder.ts` builds a playable `QuestionSet` from picks of `{category, difficulty, count}` over the given sets: questions drawn without repeats, shuffled with an injectable random source, each keeping its points, image and notes. Title "Mixed: <categories>", category "Mixed", no difficulty. A pick asking for more than exist takes all and reports the shortfall
    - **Build a game** on `/sets`, **Host a game** and the remote's New game picker: add rows (category select, difficulty select, count 1–15), see the total, then **Host** (or **Start new game**) or **Save to My sets**
    - The result passes `checkPlayable` and the 100-question limit; an image question carries its image (`hostSet` uploads it)
  - Tests: `gameBuilder.test.ts` (draws, no repeats, seeded shuffle, shortfall, limit, images), `GameBuilder.test.tsx`. `/playtest`: build 3 categories × 3 questions, host it, play two questions

## M15 — Lobby and phone

- [ ] F58 Landing explainer and host-first layout
  - Spec: UI spec by view (Landing page `/`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F51
  - Done when:
    - Under the logo, one line says what Buzzr is ("A game-show buzzer: questions on the TV, buzzers on your phones")
    - **Host a game** is a filled button of equal weight to **Join**; while the set picker is open it replaces the Join card instead of opening below it, and Cancel brings Join back
    - At 375×667 the Join card and Host a game fit without scrolling
  - Tests: `Landing.test.tsx` (explainer, picker replaces Join, Cancel). `/playtest`: phone-size screenshot

- [ ] F59 Practice buzz and who's here: server
  - Spec: UI spec by view (Player view); Realtime events and HTTP API; see DECISIONS, Proposed spec changes (audit)
  - Depends: F52
  - Done when:
    - `player:practice {}` is accepted in LOBBY only (any other phase is rejected), rate-limited with `player:buzz`'s limiter, changes no room state and emits `fx {kind: 'practice', playerId}` to Screen, Host and Players
    - `PlayerView.lobby` lists every player's `{id, name, color, connected}` in LOBBY and is `null` in every other phase
  - Tests: `reducer.lobby.test.ts` (practice in LOBBY, rejected elsewhere, no state change), `sockets.test.ts` (fx reaches all roles, rate limit), `views.test.ts` (lobby list only in LOBBY), `schemas.test.ts`

- [ ] F60 Practice buzz and who's here: devices
  - Spec: UI spec by view (Player view, Screen view); see DECISIONS, Proposed spec changes (audit)
  - Depends: F59
  - Done when:
    - In LOBBY the phone's buzzer is live in a muted colour with the label "Tap to test your buzzer": a press vibrates, animates and sends `player:practice`
    - Below it, "Who's here" lists the players with their colours (the phone's own name first)
    - On `fx practice` the Screen lobby chip of that player pops and a short sound plays (`join` sound at lower volume, or a new `practice` sound in `client/public/sounds`)
  - Tests: `Play.test.tsx` (test buzz, list), `buzzerState.test.ts`, `Screen.test.tsx` (chip pop), `sounds.test.ts`. `/playtest`: two players test-buzz in the lobby

- [ ] F61 Leave, rename and outcome haptics on the phone
  - Spec: UI spec by view (Player view); Realtime events and HTTP API; see DECISIONS, Proposed spec changes (audit)
  - Depends: F60
  - Done when:
    - `player:rename {name}` in LOBBY only, with the join's name rules and duplicate check ("That name is taken"); every view shows the new name
    - `player:leave {}` removes the player from the room in any phase (not a kick: the same device may rejoin as new); the phone clears its stored identity for the room and returns to the join form
    - The phone's top bar opens a small menu with **Change name** (LOBBY only) and **Leave game** (with confirm)
    - The phone vibrates on correct (two short), wrong and lockout (one long) where `navigator.vibrate` exists
  - Tests: `reducer.lobby.test.ts` (rename rules, leave in each phase, winner leaving mid-BUZZED behaves as a kick), `sockets.test.ts`, `Play.test.tsx` (menu, rename, leave, vibrate calls), `playerIdentity.test.ts`

## M16 — Screen and pace

- [ ] F62 Screen sound: mute and volume
  - Spec: UI spec by view (Screen view, Screen host controls); see DECISIONS, Proposed spec changes (audit)
  - Depends: F52
  - Done when:
    - The Screen has a sound button (on the host bar and in the lobby corner for a token-less Screen) cycling Sound on, Quiet (40 %), Muted; the `M` key does the same and is listed on the `?` overlay
    - The level is kept in localStorage per device and applied through Howler's global volume before the first sound
  - Tests: `sounds.test.ts` (levels, persisted), `hostControls.test.ts` (`m` shortcut), `Screen.test.tsx` (button, label)

- [ ] F63 Buzz time limit: server
  - Spec: Game flow and state machine (Transitions); Data model (`RoomSettings`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F52
  - Done when:
    - `RoomSettings.buzzSeconds: 0 | 5 | 10 | 15 | 20 | 30` (default 0 = off), in `DEFAULT_SETTINGS`, the create body and `host:settings`
    - Each opening (first open and every reopen after a wrong answer) with `buzzSeconds` > 0 sets `Room.buzzTimer {seconds, endsAt}` and schedules `buzzTimeUp {questionIndex, openingCounter, at}`
    - A fresh `buzzTimeUp` in OPEN goes to REVEAL with no points and emits `fx {kind: 'buzzTimeUp'}`; a stale one (moved on, COLLECTING, judged, other opening) is ignored. The first buzz clears the timer
    - Views carry `buzzTimer {seconds} | null` without `endsAt`
  - Tests: new `server/reducer.buzztimer.test.ts` (start, reopen restarts, buzz clears, time up to REVEAL, every stale case), `sockets.buzz.test.ts` (fires through the gateway), `views.test.ts`, `schemas.test.ts`

- [ ] F64 Buzz time limit: devices
  - Spec: UI spec by view (Screen view, Player view, Host remote); see DECISIONS, Proposed spec changes (audit)
  - Depends: F63
  - Done when:
    - The Settings tab and the Screen lobby settings have a "Buzz time" stepper: Off, 5, 10, 15, 20, 30 s
    - While OPEN with a buzz timer, the Screen shows a countdown ring around "Buzzers open", the phone shows the seconds under its button and the remote shows them beside the primary action (`useAnswerCountdown` reused or generalised)
    - On `fx buzzTimeUp` the Screen plays the time's-up sound and moves to the reveal
  - Tests: `HostControls.test.tsx` (stepper), `Screen.test.tsx`, `Play.test.tsx`, `useAnswerCountdown.test.ts`. `/playtest`: 5 s limit, nobody buzzes, reveal arrives

- [ ] F65 Standings: rank on the phone and a Screen rail
  - Spec: UI spec by view (Player view, Screen view); Data model (`RoomSettings`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F64
  - Done when:
    - The phone's top bar shows the rank beside the score ("3rd of 8"; equal scores share a rank) from the existing `me.rank` and `playerCount`, from the first question on
    - `RoomSettings.showStandings: boolean` (default true), toggled in the Settings tab and the lobby settings
    - When on, the Screen shows a slim rail of the top 5 (rank, colour, name, score) along the right edge in QUESTION, OPEN, COLLECTING, BUZZED and REVEAL at 1280×720 and up, never covering the question card; it reorders with `useFlip`
  - Tests: `Play.test.tsx` (rank label, ordinal suffixes), `reducer.admin.test.ts` (setting), `Screen.test.tsx` (rail on and off, top 5). `/playtest`: 6 bots, rail at 1920×1080 and 1280×720

- [ ] F66 Screen polish
  - Spec: UI spec by view (Screen view); see DECISIONS, Proposed spec changes (audit)
  - Depends: F65
  - Done when:
    - The Screen lobby shows the join address once (the header strip, or the body's QR block, not both)
    - The FINAL podium for one or two players shows only their steps, centred, with no empty step
    - After **New game** (and at the first Start game), the Screen shows a 3-second title card with the set's title, category and difficulty before question 1
    - `ScreenView.hostDevices` counts the connected host sockets (remotes, not the Screen itself); while it is above 0, the Screen lobby collapses its settings panel behind a **Settings** button
  - Tests: `ScreenResults` tests (1 and 2 players), `Screen.test.tsx` (one join line, title card, settings collapse), `views.test.ts` (`hostDevices`), `sockets.host.test.ts` (count on pair and disconnect)

## M17 — Host depth

- [ ] F67 Half points and custom score adjust
  - Spec: Game flow and state machine (Scoring rules, Transitions); UI spec by view (Host remote, Screen host controls); see DECISIONS, Proposed spec changes (audit)
  - Depends: F66
  - Done when:
    - `host:judge` accepts `result: 'half'`: the winner gets `Math.round(points / 2)`, the room goes to REVEAL as for correct and emits `fx {kind: 'correct', playerId, points}` with the half points; undo reverses it
    - The remote's judging panel has **Half** between Correct and Wrong; the Screen has the `V` key (listed on `?`)
    - The Players tab's +/− buttons keep the question's value, and a **Custom** field adjusts by any integer within the existing ±100000 limit
  - Tests: `reducer.judge.test.ts` and `reducer.undo.test.ts` (half), `schemas.test.ts`, `HostControls.test.tsx`, `hostControls.test.ts` (`v`)

- [ ] F68 Undo every judgement of the question
  - Spec: Reconnects, security and edge cases (Edge cases: Undo); Game flow and state machine (Transitions); see DECISIONS, Proposed spec changes (audit)
  - Depends: F67
  - Done when:
    - `Room.undo` becomes a stack of the current question's `UndoPoint`s; each `host:undo` reverses the newest judgement (points, lockout) and returns to BUZZED with that winner, until the stack is empty
    - The stack clears on next, prev, end and new game, as the single point does today; `canUndo` is true while the stack has entries
  - Tests: `reducer.undo.test.ts` (three wrong then correct, undo four times, each state exact; stale reopen after undo ignored)

- [ ] F69 Read-aloud mode (no TV)
  - Spec: UI spec by view (Host remote); Roles and devices; see DECISIONS, Proposed spec changes (audit)
  - Depends: F51
  - Done when:
    - `RoomCreated` offers **Run from this phone (no TV)**, which opens `/host/:code?read=1`
    - In read-aloud layout the remote shows the join code and QR in LOBBY, the question in large type to read out, the answer below a tap-to-show cover, and the same controls; the winner's name is large after a buzz
    - The remote's header has a toggle between the normal and read-aloud layouts, kept in sessionStorage
  - Tests: `Host.test.tsx` (layout, cover, toggle, lobby QR), `Landing.test.tsx`. `/playtest`: run two questions with no Screen tab open

- [ ] F70 Pairing PIN
  - Spec: Roles and devices (Creating and joining a room, step 3); Realtime events and HTTP API (HTTP); Security; see DECISIONS, Proposed spec changes (audit)
  - Depends: F52
  - Done when:
    - The pairing dialog shows a 6-digit PIN beside the QR. `POST /api/rooms/:code/pairing` (Bearer hostToken) creates it: valid 60 s, single use, stored hashed
    - `POST /api/rooms/:code/pair {pin}` returns `{hostToken}` for a valid PIN, 401 otherwise, and is rate-limited (5 per minute per IP and per room); after 5 wrong PINs the PIN is revoked
    - `/host/:code` without a token shows a PIN entry instead of "Not authorised"
  - Tests: `server/http.pair.test.ts` (each status, expiry, single use, limits, revoke), `PairHostPhone.test.tsx`, `Host.test.tsx` (PIN entry joins)

- [ ] F71 False start: server
  - Spec: Buzzer fairness and timing; Game flow and state machine (Transitions); Data model (`RoomSettings`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F63
  - Done when:
    - `RoomSettings.falseStartMs: 0 | 500 | 1000` (default 0)
    - With it on, a `player:buzz` in QUESTION records a false start for that player (once per question) and emits `fx {kind: 'falseStart', playerId}`; when the buzzers open, that player's buzzes are ignored until `falseStartMs` after the opening (monotonic clock)
    - Off, early presses are ignored as today; a reopen after a wrong answer clears false starts
    - `PlayerView.falseStart: boolean` for this question
  - Tests: `reducer.buzz.test.ts` and `reducer.window.test.ts` (penalty window, once per question, reopen clears, off), `sockets.buzz.test.ts`, `views.test.ts`

- [ ] F72 False start: devices
  - Spec: UI spec by view (Player view, Screen view, Host remote); see DECISIONS, Proposed spec changes (audit)
  - Depends: F71
  - Done when:
    - With the setting on, the phone's button takes presses in QUESTION; a false start shows "Too early!" in amber until the penalty ends after opening
    - The Screen shows a small "Too early" tag on that player's chip; the Settings tab and lobby settings have a "False start" stepper: Off, 0.5 s, 1 s
  - Tests: `buzzerState.test.ts`, `Play.test.tsx`, `HostControls.test.tsx`. `/playtest`: press early, then try to buzz at once after opening

- [ ] F73 Settings presets
  - Spec: UI spec by view (Host remote, Settings tab); see DECISIONS, Proposed spec changes (audit)
  - Depends: F72
  - Done when:
    - The Settings tab and the Screen lobby settings show two presets above the switches: **Party** (auto-open on, no penalty, answer off, buzz time off, false start off) and **Competitive** (penalty on, answer 5 s, buzz time 10 s, false start 0.5 s); each sends one `host:settings`
    - A preset is marked active while the settings match it
  - Tests: `HostControls.test.tsx` (each preset's payload, active mark)

## M18 — Players and sharing

- [ ] F74 Avatars: server
  - Spec: Data model (`Player`); Realtime events and HTTP API (`player:join`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F61
  - Done when:
    - `AVATARS` in `shared/constants.ts`: 24 emoji. `player:join` takes optional `avatar` (one of them); `Player.avatar?: string`; a reconnect keeps the stored one
    - Every view's player entries and `me` carry `avatar`
  - Tests: `reducer.lobby.test.ts`, `schemas.test.ts` (unknown avatar rejected), `views.test.ts`, `constants.test.ts`

- [ ] F75 Avatars: devices
  - Spec: UI spec by view (Player view, Screen view, Host remote); see DECISIONS, Proposed spec changes (audit)
  - Depends: F74
  - Done when:
    - The join form has an avatar grid (optional, remembered with the name on the device)
    - The avatar replaces the initial in the phone's top bar, the Screen lobby chips, scoreboard, standings rail, podium and the remote's Players tab; without one, the initial shows as now
  - Tests: `Play.test.tsx`, `Screen.test.tsx`, `playerIdentity.test.ts`. `/playtest`: three players with avatars, lobby and final

- [ ] F76 Session totals: server
  - Spec: Data model (`Room`); Game flow and state machine (Transitions: new game); see DECISIONS, Proposed spec changes (audit)
  - Depends: F61
  - Done when:
    - `Room.session {gameNumber, totals: Record<playerId, number>}`: `gameNumber` starts at 1 and `host:newGame` adds 1; on reaching FINAL each player's game score is added to `totals` once (an undo after FINAL is impossible; `host:end` counts as FINAL)
    - `keepScores` does not change totals; a player who leaves keeps their total; Screen and Host views carry `session` with ranked totals from game 2 on
  - Tests: `reducer.newgame.test.ts` (two and three games, keepScores on and off, late joiner), `views.test.ts`

- [ ] F77 Session totals: devices
  - Spec: UI spec by view (Screen view Final, Host remote, Player view); see DECISIONS, Proposed spec changes (audit)
  - Depends: F76
  - Done when:
    - From game 2 the Screen's FINAL has a **Tonight** panel ranking the totals beside the game ranking, and the header reads "Game N"
    - The remote's Game over card and the phone's final state show the player's total and night rank too
  - Tests: `ScreenResults` tests, `Host.test.tsx`, `Play.test.tsx`. `/playtest`: two games, totals add up

- [ ] F78 Results card
  - Spec: UI spec by view (Screen view Final, Host remote, Player view); see DECISIONS, Proposed spec changes (audit)
  - Depends: F77
  - Done when:
    - `client/src/lib/resultsCard.ts` draws a 1080×1350 PNG on a canvas: Buzzr logo, set title, date, podium and the ranking (top 10), and the night totals from game 2; no room code
    - **Share results** on the remote's Game over card and the phone's final state uses `navigator.share` with the file where supported, otherwise downloads `buzzr-results.png`; the Screen's host bar offers the download
  - Tests: `resultsCard.test.ts` (layout inputs, top 10 cut, no code in the drawn text), `Host.test.tsx` and `Play.test.tsx` (share and fallback)

## M19 — Editor

- [ ] F79 Bulk paste questions
  - Spec: Question editor and images (Set editor); see DECISIONS, Proposed spec changes (audit)
  - Depends: F53
  - Done when:
    - The set editor has **Paste questions**: a text area that takes one question per line as `Question | Answer | points` or tab-separated cells (a spreadsheet paste); points optional (default 100)
    - A preview lists the parsed questions and each bad line with its reason (missing answer, over the length limits, points not an integer); **Add N questions** appends the good ones, within the 100-question limit
  - Tests: `bulkPaste.test.ts` (both formats, quotes and stray spaces, bad lines, limit), `SetEditor.test.tsx`

- [ ] F80 Export all and import many
  - Spec: Question editor and images (Set list `/sets`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F79
  - Done when:
    - **Export all** on My sets writes one file `{sets: [...]}` of every playable set with images embedded, named `buzzr-sets-<date>.json`; drafts are listed as skipped
    - Import accepts a single-set file or a many-set file; each set is imported or reports its own errors
    - My sets shows "Last export: <date>" (localStorage), or "Never exported" with a hint that sets live only in this browser
  - Tests: `importExport.test.ts` (many-set round trip, mixed valid and invalid, size limit), `Sets.test.tsx`

## M20 — Teams

- [ ] F81 Teams: server
  - Spec: Game flow and state machine (Scoring rules); Data model; Realtime events and HTTP API; see DECISIONS, Proposed spec changes (audit)
  - Depends: F75
  - Done when:
    - `RoomSettings.teams: 0 | 2 | 3 | 4` (default 0); `TEAMS` (names and colours) in `shared/constants.ts`; `Player.team: number | null`
    - Turning teams on or a new player joining assigns the smallest team (lowest index on a tie); `host:setTeam {playerId, team}` moves a player in LOBBY or between questions
    - Team score is the sum of its members' scores (`server/ranking.ts` ranks teams; equal scores share a rank). Players still buzz and are judged alone
    - Views carry `teams: {index, name, color, score, rank, memberIds}[]` when on
  - Tests: `reducer.teams.test.ts` (assign, balance, move, settings off and on, scoring, ranking), `ranking.test.ts`, `views.test.ts`, `schemas.test.ts`

- [ ] F82 Teams: Screen and phone
  - Spec: UI spec by view (Screen view, Player view); see DECISIONS, Proposed spec changes (audit)
  - Depends: F81
  - Done when:
    - With teams on, the Screen lobby shows one column per team; the scoreboard, standings rail and FINAL rank teams first (team podium, then players)
    - The phone's top bar shows the team name and colour; its final state shows the team's rank
  - Tests: `Screen.test.tsx`, `ScreenResults` tests, `Play.test.tsx`. `/playtest`: 2 teams × 3 bots

- [ ] F83 Teams: host controls
  - Spec: UI spec by view (Host remote, Screen view Lobby); see DECISIONS, Proposed spec changes (audit)
  - Depends: F82
  - Done when:
    - The Settings tab and lobby settings have a "Teams" stepper (Off, 2, 3, 4)
    - The Players tab groups players by team with a team select per player (sends `host:setTeam`)
  - Tests: `HostControls.test.tsx`, `Host.test.tsx`

## M21 — Answer modes

- [ ] F84 Multiple choice: data and editor
  - Spec: Data model (`Question`); Question editor and images (Set editor); see DECISIONS, Proposed spec changes (audit)
  - Depends: F80
  - Done when:
    - `Question.mode?: 'buzz' | 'choice' | 'typed'` (absent = buzz) and `choices?: string[]` (2–4, each 1–80 characters) with `correctChoice?: number`; the schema requires both for choice questions and sets `answer` to the correct choice's text
    - The editor has a mode select per question; Choice shows 2–4 choice fields with a correct-answer radio; import and export keep them
  - Tests: `schemas.test.ts` (valid, missing correct, out of range, answer derived), `SetEditor.test.tsx`, `importExport.test.ts`

- [ ] F85 Multiple choice: server
  - Spec: Game flow and state machine (Transitions); Data model; Realtime events and HTTP API; see DECISIONS, Proposed spec changes (audit)
  - Depends: F84
  - Done when:
    - Phase `ANSWERING`: `host:open` on a choice question goes QUESTION → ANSWERING and schedules `answeringClosed` after `RoomSettings.choiceSeconds` (5–30, default 10)
    - `player:answer {choice}` in ANSWERING records one answer per player (changeable until it closes); when all connected players answered or time is up the room goes to REVEAL and each correct player gets the points (penalty setting applies to wrong answers)
    - Screen and Player views carry `choices` but never `correctChoice` before REVEAL; at REVEAL they carry it and the answer counts per choice. Host view carries everything
    - `host:reveal` during ANSWERING closes it early and scores; undo is not offered for choice questions
  - Tests: `reducer.choice.test.ts` (each transition, timing, change of answer, all answered, stale close, scoring, penalty), `views.test.ts` (no `correctChoice` before REVEAL, serialised check as the spec's answer test), `sockets.test.ts`

- [ ] F86 Multiple choice: devices
  - Spec: UI spec by view (Screen view, Player view, Host remote); see DECISIONS, Proposed spec changes (audit)
  - Depends: F85
  - Done when:
    - Screen: the choices as 2–4 coloured tiles (A–D) under the question, a countdown and "N of M answered"; at REVEAL the correct tile lights and each shows its count
    - Phone: big lettered buttons with the choice text; the picked one stays marked; at REVEAL "Correct! +100" or the right answer
    - Remote: answer progress and the per-choice tally; the primary action reads **Close answers** during ANSWERING
  - Tests: `Screen.test.tsx`, `Play.test.tsx`, `Host.test.tsx`, `hostControls.test.ts`. `/playtest`: a mixed set with buzz and choice questions

- [ ] F87 Typed answers: data, editor and server
  - Spec: Data model (`Question`); Game flow and state machine (Transitions); Realtime events and HTTP API; see DECISIONS, Proposed spec changes (audit)
  - Depends: F86
  - Done when:
    - Editor: mode **Typed** uses the existing answer and host notes (alternatives, one per line)
    - A typed question runs ANSWERING with `player:answer {text}` (1–80 characters, trimmed); the host view groups answers by normalised text (case, accents, spaces) and pre-marks groups equal to the answer or an alternative
    - `host:markTyped {groups}` in ANSWERING or after it closes sets which groups are correct; `host:reveal` scores them and goes to REVEAL. Players never see other players' answers before REVEAL
  - Tests: `reducer.typed.test.ts` (grouping, pre-marks, mark, score, close by time and by all answered), `views.test.ts` (no answers or groups in Screen and Player views before REVEAL), `schemas.test.ts`

- [ ] F88 Typed answers: devices
  - Spec: UI spec by view (Screen view, Player view, Host remote); see DECISIONS, Proposed spec changes (audit)
  - Depends: F87
  - Done when:
    - Phone: a text input with **Send** (editable until it closes); then "Answer sent"
    - Remote: the groups with counts and a correct checkbox each (pre-marked ones ticked), then **Reveal and score**
    - Screen: countdown and "N of M answered"; at REVEAL the answer and the names of the players who got it
  - Tests: `Play.test.tsx`, `Host.test.tsx`, `Screen.test.tsx`. `/playtest`: three players type variants of one answer

## M22 — Category board

- [ ] F89 Category board: server
  - Spec: Game flow and state machine; Data model; Realtime events and HTTP API; see DECISIONS, Proposed spec changes (audit)
  - Depends: F88
  - Done when:
    - `QuestionSet.board?: {columns: {title, questionIds: [easy, medium, hard]}[]}` (2–6 columns); the schema checks every id exists once
    - Phase `BOARD`: Start game and Next go to BOARD instead of the next question; `host:pick {questionIndex}` in BOARD goes to QUESTION for an unused tile; the question then plays as usual; after the last tile Next goes to FINAL
    - `Room.usedQuestionIds`; views carry the board with used tiles; `host:prev` returns to BOARD and frees nothing
  - Tests: `reducer.board.test.ts` (pick, used tiles, finish, prev, invalid picks), `schemas.test.ts`, `views.test.ts`

- [ ] F90 Category board: builder and devices
  - Spec: UI spec by view (Screen view, Host remote); Question editor and images (Set list); see DECISIONS, Proposed spec changes (audit)
  - Depends: F89, F57
  - Done when:
    - The game builder has **Board** mode: choose 2–6 categories; it draws one Easy, Medium and Hard question per category into a board set (points 100/200/300 from the starters)
    - Screen: the board grid (category titles, point tiles; used tiles dimmed); a picked tile zooms into the question
    - Remote: the same grid to pick from in BOARD; the Screen's host bar uses arrow keys and Enter to pick
  - Tests: `gameBuilder.test.ts` (board mode), `Screen.test.tsx`, `Host.test.tsx`. `/playtest`: a 3 × 3 board, play three tiles

## M23 — Taglish

- [ ] F91 Taglish copy
  - Spec: UI spec by view (Player view, Screen view); Data model (`RoomSettings`); see DECISIONS, Proposed spec changes (audit)
  - Depends: F88
  - Done when:
    - `client/src/lib/copy.ts` holds every player-phone and Screen game-state string in English and Taglish (drafted by Claude, listed in the PROGRESS entry for Kim to review)
    - `RoomSettings.copy: 'en' | 'taglish'` (default 'en'), set in the Settings tab and lobby settings; the phone and Screen read it from their view
    - Landing, set pages and the remote stay English
  - Tests: `copy.test.ts` (both tables have the same keys, no empty strings), `buzzerState.test.ts`, `Play.test.tsx` and `Screen.test.tsx` in Taglish

## Bugs

## Backlog (not scheduled)
