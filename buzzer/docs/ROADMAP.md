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

- [x] F54 Built-in sets library

- [x] F55 Set browser: search, categories and difficulty

- [x] F56 Set preview before hosting

## M14 — Mixed games

- [x] F57 Game builder

## M15 — Lobby and phone

- [x] F58 Landing explainer and host-first layout

- [x] F59 Practice buzz and who's here: server

- [x] F60 Practice buzz and who's here: devices

- [x] F61 Leave, rename and outcome haptics on the phone

## M16 — Screen and pace

- [x] F62 Screen sound: mute and volume

- [x] F63 Buzz time limit: server

- [x] F64 Buzz time limit: devices

- [x] F65 Standings: rank on the phone and a Screen rail

- [x] F66 Screen polish

## M17 — Host depth

- [x] F67 Half points and custom score adjust

- [x] F68 Undo every judgement of the question

- [x] F69 Read-aloud mode (no TV)

- [x] F70 Pairing PIN

- [x] F71 False start: server

- [x] F72 False start: devices

- [x] F73 Settings presets

## M18 — Players and sharing

- [x] F74 Avatars: server

- [x] F75 Avatars: devices

- [x] F76 Session totals: server

- [x] F77 Session totals: devices

- [x] F78 Results card

## M19 — Editor

- [x] F79 Bulk paste questions

- [x] F80 Export all and import many

## M20 — Teams

- [x] F81 Teams: server

- [x] F82 Teams: Screen and phone

- [x] F83 Teams: host controls

## M21 — Answer modes

- [x] F84 Multiple choice: data and editor

- [x] F85 Multiple choice: server

- [x] F86 Multiple choice: devices

- [x] F87 Typed answers: data, editor and server

- [x] F88 Typed answers: devices

## M22 — Category board

- [x] F89 Category board: server

- [x] F90 Category board: builder and devices

## M23 — Taglish

- [x] F91 Taglish copy

## M24 — Responsive layout

Source: the UX audit in `docs/ux/` (start with `README.md` and `00-foundations.md`). Each feature closes the audit issue IDs it lists. Check every feature at the audit's device matrix (375×667, 667×375, 820×1180, 1024×768, 1440×900, 1920×1080) with `/playtest` screenshots, and keep phone layouts at least as good as today.

- [x] F92 Responsive foundations

- [x] F93 Landing and host picker on every screen

- [x] F94 Set library grid

- [x] F95 Set editor toolbar and outline

- [x] F96 Player phone: landscape and short screens

- [x] F97 Player on tablet and desktop

- [x] F98 Host remote on the phone

- [x] F99 Host remote dashboard on tablet and desktop

- [x] F100 Screen legibility on any display

- [x] F101 Screen host bar and overlays

## M25 — Import

- [x] F102 Import a bare array of sets

## M26 — Super-admin

- [x] F103 Built-in sets on the server

- [x] F104 Client reads built-ins from the server

- [x] F105 Admin login

- [x] F106 Admin import, delete, hide sample, export

- [x] F107 Edit built-ins with draft and publish

## M27 — AI categories

- [x] F108 Draft-only built-in sets

- [x] F109 Question generator

- [x] F110 Generation and category API

- [x] F111 Admin dashboard

- [x] F112 Deploy config for generation

## M28 — Generation review flow

- [x] F113 Job cancel and replacement jobs

- [x] F114 Reviewed flag and question routes

- [x] F115 Generation page and progress

- [x] F116 Category review and publish

- [x] F117 Level review list

- [x] F118 Replace and add a question

## M29 — Admin redesign

Source: the admin audit in `docs/ux/07-admin.md` (issues `ADM-01`–`ADM-08`, target layouts, device matrix as `docs/ux/README.md`).

- [x] F119 Admin shell and panes

- [x] F120 Category list and merged category page

- [x] F121 Overview panel, search and filters

- [x] F122 Level review layout and sticky footer

- [x] F123 Duplicate and long-text warnings

- [x] F124 Preview on Screen

- [x] F125 Review keyboard shortcuts

- [x] F126 Hide a category

- [x] F127 Generation history log

- [x] F128 History page and spend tiles

## M30 — Set picker

- [x] F129 Category emoji: server and generation

- [x] F130 Category emoji: admin picker

- [x] F131 Set picker category cards

## M31 — Hallmark redesign

Source: `design.md` (the locked Squeeze system) and `docs/ux/08-hallmark-redesign.md` (the read, the picks, per-feature targets and **How each M31 feature runs**). Kim chose this on 2026-11-16: replace Prime Time, every surface, full depth. Content, routes, handlers and `data-testid`s stay. No game logic changes. Every feature runs Hallmark's `sloplint --kept` against `.hallmark/before.json` and the device matrix in `docs/ux/README.md`.

- [x] F132a Squeeze foundations

- [x] F132b Squeeze fonts
  - Spec: `design.md` Tokens; DECISIONS 2026-10-28 (self-hosted fonts)
  - Depends: F132a
  - Split from F132 on 2026-11-16: the unattended run may not `npm install` (ask-only in `.claude/settings.json`).
  - Done when:
    - Kim runs `npm install -D @fontsource/gabarito @fontsource/manrope`.
    - `client/src/main.tsx` imports `@fontsource/gabarito/800.css`, `@fontsource/manrope/500.css` and `@fontsource/manrope/700.css` in place of the `shortcut:` comment.
    - `/playtest` shows `document.fonts` holding Gabarito 800 and Manrope 500 and 700 on / and /screen, with no request to a third-party host.
  - Tests: existing suites green.

- [x] F133 Floor sweep

- [x] F134 Landing and join

- [x] F135 Player phone

- [x] F136 Screen lobby and chrome

- [x] F137 Screen game

- [x] F138 Host remote

- [x] F139 Set library and pickers

- [x] F140 Set editor and answer sheet

- [x] F141 Admin

- [x] F142 Redesign sweep and handoff

## M32 — Overprint redesign

Source: `design.md` (the locked Overprint system), `docs/ux/09-overprint-redesign.md` (the picks, the buzzer's states, per-feature targets and **How each M32 feature runs**) and the mocks in `.hallmark/mocks/overprint/`. Kim chose this on 2026-11-16: Overprint over Werkstatt and Paste-up, every surface, full depth, and the phone buzzer as the red Lit dome (variant E). Content, routes, handlers and `data-testid`s stay. No game logic changes. Every feature runs Hallmark's `sloplint --kept` against the record F143 takes, and the device matrix in `docs/ux/README.md`. Kim answers `09` § Open before launch; unanswered items take their defaults.

- [x] F143 Overprint foundations

- [x] F143b Overprint fonts

- [x] F144 Landing and join

- [x] F145 Player phone and the Lit buzzer

- [x] F146 Screen lobby and chrome

- [x] F147 Screen game

- [x] F148 Host remote

- [x] F149 Set library and pickers

- [x] F150 Set editor and answer sheet

- [x] F151 Admin

- [x] F152 Redesign sweep and handoff

## M33 — Live review fixes

Source: `docs/ux/10-live-review-fixes.md` (every finding from the 2026-11-17 UI/UX and QA review of the live site, with files, viewports, screenshots under `.playtest/review-2026-11-17/`, and **How each M33 feature runs**). Kim put every finding on the roadmap on 2026-11-17. `design.md` stays locked. Content, routes, handlers and `data-testid`s stay. Only F161 changes game logic.

- [x] F153 Screen names in full

- [x] F154 Screen game details

- [ ] F155 Screen lobby fit
  - Spec: `10` § F155; mock `.hallmark/mocks/overprint/index.html` (Screen lobby)
  - Done when:
    - The lobby join URL breaks only at "/" at 1024×768, 1280×720, 1280×800, 1440×900, 1920×1080 and 667×375; `ScreenChrome` and `RoomCreated` join URLs break the same way.
    - The players pass is content height with 2 players and still fits 5 and 20 players with the existing "+N more".
    - An orange player's chip is visible on the orange pass.
    - Showing and hiding the host control bar does not move Start game or Pair host phone (measured `getBoundingClientRect` before and after).
    - The pairing dialog's Hide button clears the ScreenChrome bar at 1690×1185 and 1280×720 (or PROGRESS says it did not reproduce).
  - Tests: `Screen.test.tsx` green; a test for the URL's break points if it is a pure helper.

- [ ] F156 Settings type and states
  - Spec: `10` § F156; `design.md` Rules, Controls
  - Done when:
    - Settings labels and steppers compute to Archivo Narrow 600; stepper values to the figure style (Anybody 900, 150%); "Settings ▾" is not set in Anybody. No element asks for an Archivo weight that is not installed.
    - The chosen language and preset read as selected (`aria-pressed`, flooded) at 4.5:1 or better, on the Screen lobby and the host remote.
  - Tests: `HostSettings` and `Host.test.tsx` green, updated only where they assert `disabled` on the chosen option (switch them to `aria-pressed`).

- [ ] F157 Host remote fixes
  - Spec: `10` § F157; `design.md` Controls, Danger
  - Done when:
    - The judge panel shows a 16-character name in full at 375×667.
    - END GAME's label measures at least 4.5:1.
    - sloplint `--render` on `/host/<code>` (PIN entry) and `/admin` reports no unwaived 39b; PROGRESS says whether the controls were resized or waived, and why.
    - The host tab requests `/favicon.svg` at most once per real icon change over a full game (resource timing), or PROGRESS says it did not reproduce.
  - Tests: `Host.test.tsx` and the admin suites green.

- [ ] F158 Phone lobby, join and Landing fit
  - Spec: `10` § F158; `09` § The buzzer; `docs/ux/README.md` matrix
  - Done when:
    - On the phone lobby the buzzer, its drop included, clears the "Who's here" ink bar at 375×540, 375×568, 375×600, 375×667 and 390×844.
    - JOIN is on the first screen of `/play/<code>` at 375×667.
    - The room code in "Join room" is not letter-spaced.
    - At 667×375, Landing shows Host a game without scrolling past the whole join field.
  - Tests: `Play.test.tsx` and `Landing.test.tsx` green.

- [ ] F159 Phone game polish
  - Spec: `10` § F159; `09` § The buzzer (state table); `design.md` Rules
  - Depends: F158
  - Done when:
    - The top bar's score, avatar initial and rank compute to Anybody 900, wide; a score of -999 with a 16-character name keeps the name, room and score on one line each at 375.
    - The idle (drained) status line does not tell the player to tap; "Tap to buzz in" shows only when live. English and Taglish.
    - A buzzer reveal shows the word Correct or Wrong with the points, and no buzzer is drawn in `revealed`.
    - The Leave confirm's Cancel reads "Huwag na" in Taglish and "Cancel" in English, and every `ConfirmButton` caller gets the room's language.
    - New strings are listed in PROGRESS, English and Taglish, for Kim to review.
  - Tests: `buzzerState.test.ts`, `Play.test.tsx` and the `ConfirmButton` tests green; a test for the Taglish Cancel and for `BUZZER_LOOK.revealed` being `null`.

- [ ] F160 Meta lines and picker details
  - Spec: `10` § F160; `design.md` Rules
  - Done when:
    - No rendered line joins three or more items with middle dots, in the files `10` § F160 lists (grep `·` in client/src to find any it missed); the set preview's meta line does not repeat its heading.
    - The host picker at 1280 has no split underline and no dashed border.
    - The pairing dialog's QR has no white plate, matching the lobby QR.
  - Tests: the suites of every touched component green, updated where they assert the old strings.

- [ ] F161 Final results survive a leave
  - Spec: `10` § F161; DECISIONS F61
  - Done when:
    - In FINAL, `player:leave` unjoins the device as F61 does, but the player keeps their place and score in the room, so the Screen's podium and ranking, the other phones' rank lines and the remote's Game over standings do not change.
    - In every other phase, leave behaves as before.
    - A DECISIONS row (2026-11-17, Kim) supersedes F61 for FINAL only.
    - `/playtest`: three players finish a game, the winner leaves, and the Screen and the other phones still show the same podium.
  - Tests: reducer tests for leave in FINAL (standings unchanged) and in another phase (removed, as before); gateway test that the leaving socket is unjoined in FINAL.

- [ ] F162 Live review sweep
  - Spec: `10` § F162, § How each M33 feature runs
  - Depends: F153, F154, F155, F156, F157, F158, F159, F160, F161
  - Done when:
    - sloplint `--render --kept` is clean or waived on every route.
    - `/playtest` at the `docs/ux/README.md` matrix plus 375×540 passes, with 16-character names on the Screen and host and Taglish on every phone state.
    - `buzzers.html` variant E's cap offsets match `design.md` (14/11/2).
    - PROGRESS lists every `10` finding as fixed, waived (with reason) or moved to Backlog.
  - Tests: `buzzer:verify` green.

## Bugs

- [x] B01 Room created cramped on /sets at desktop

## Backlog (not scheduled)

- (F152 finish review) The disabled primaries (Join on the phone, Pair on the remote, Join on Landing) empty to a 2px ink-2 outline as `design.md` Controls says, which the review read as another field under the name or PIN box. Kim to judge: a dimmed ink block would read as the action still.
- (F153) Team names still truncate on the Screen (the standings rail's team rows, the scoreboard's team tiles). F153 covered player names only; teams could take the same wrap rule.
- (F153) The Screen name fit estimates width from the character count. A name of wide letters (W, M) wraps to a second line instead of stepping down further; a measured fit would keep it on one line.
- (F152 finish review) Landing at 1440: the orange pass holds Host a game and Question sets at its foot with ~180px of empty orange above them, as the approved mock. Composition.
- (F152 finish review) The two phone forms (`/play` join, `/host` pairing) are bare stock with outlines and no pass or ink bar, so they carry the least Overprint of any screen. Composition.
- (F152 finish review) The remote's pairing PIN placeholder "000000" is at display size in `text-muted`, so it can read as a typed PIN. A lighter tone would fall under 4.5:1; a shorter or different placeholder is a copy change for Kim.
- (F142 finish review) The room code as Gabarito tiles beyond Landing: the phone's "Join room" head, the remote's "Room DBPA." line and the Screen board's corner still set it as plain text. Composition, not a defect.
- (F142 finish review) Landing at 1440: the join tiles and Host a game sit ~180px apart with the right ~40% empty. Close the gap or stack them as at 375.
- (F142 finish review) The Screen's start gate is bare text on felt at TV size; Prime Time showed the lobby (code, QR) behind a scrim. Render the lobby behind the gate.
- (F142 finish review) A lone built-in set with no difficulty (the sample, "Sample: General Knowledge") shows only as the "Other" row with a "None" tile, so its title is not on /sets. Show the set's title when a row holds one set with no level.
- (F142 finish review) Disabled primaries (Join, Sign in) sink to the dark felt (`disabled:bg-bg-deep`), which the review read as heavier than the peach action. Kim to judge; `design.md` names no disabled state.
- (F139) /sets filters in the URL (`?q=&level=`), so a reload or a shared link keeps the search and chips, and the Built-in catalogue's chosen level per row survives a visit to the editor. They have only ever been component state (DECISIONS F139).
- (F138) Remote at `lg` (F99 layout): with an open Settings disclosure and no players, the Players pane shrinks to a strip with its own scroll arrows, so "No one has joined yet." is hidden (seen in the F138 playtest at 1440×900). Give the Players pane a minimum height, or let Settings take only the space left.
- (F135) Phone choice reveal on a landscape phone (667×375): the check and "Your pick" squeeze the picked tile's text ("Canberr a"). It was there before F135; the tile could drop the check when the badge shows (seen in `.playtest/F135/667x375-11-choice-reveal.png`).
- (F131) `SetBrowser`'s `mode="select"` (one radio per set) has no caller left now that both pickers use `CategoryPicker`; remove it and its tests, or keep it for a future picker.
- (F131) Remember the picker's last level across visits (localStorage), so a host who always plays Hard gets Hard from a card's body on the next game.
- Category emoji (F130): a **Remove** in the picker that sends `{emoji: null}` (the route already takes it), and arrow-key moves through the grid.
- History page (F128): `/admin/history` shows the newest 50 jobs (the route's default). A **Show more** that asks for `?limit=500`, or paging by `endedAt`, would reach older lines. A filter by outcome or kind could follow.
- Generation history: `generation-history.jsonl` grows without bound and every `GET /api/admin/history` reads and parses it all. At a few lines a day that is years away from mattering; a cap (keep the newest N lines) or monthly rotation with stored totals would bound it (F127).
- Pairing PIN: **Hide** (or a host joining) could revoke the room's PIN on the server, so a closed dialog's PIN stops working at once instead of at its 60 s. Needs a `DELETE /api/rooms/:code/pairing` (F70).
- False start: a vibration of its own on the phone's `fx falseStart` (the press gives only the 30 ms tap today), if the spec's vibrate list grows to include it (F72).
- Avatars: show the avatar on the Screen's buzz banner, "also buzzed" list and Too early chips, and on the remote's Game over standings (F75 covered only the Done-when surfaces). A way to change the avatar after joining would need a `player:avatar` event like `player:rename` (F74, F75).
- Teams: the results card image (F78) and the remote's Game over standings could rank teams first too, and scoreboard player rows could carry a team mark beside their own colour dot (F82).
- Bundle: the main `index` chunk passed Vite's 500 kB warning (501.6 kB, 150.7 kB gzip) with F83. Lazy-load a page that only one device opens (the editor at `/sets`, or the results card renderer) to get back under it (F83).
- Choice questions: the Print answer sheet could list the choices with the correct one marked (F84 prints the correct choice as the answer only), and the editor could warn about two choices with the same text.
- Choice questions: a "Choice time" stepper (5–30 s) in Settings for `choiceSeconds`, settable over `host:settings` only today; the Screen lobby's settings column is full at 1280×720, so it needs a squeeze or a fold (F85, F86). The Screen could play the correct or wrong sound at a choice reveal (no `fx` is sent then), and the remote could name who picked what from `choice.answers` (F86).
- Typed questions: a group's shown spelling breaks a tie by code point, so "PARIS" beats "paris" on the remote; prefer the spelling closest to the answer, or the first typed (F87, F88). Marking from the Screen's keyboard (it shows no groups, so Reveal and score uses the pre-marks there), and the correct and wrong sounds at a typed reveal (F88).
- Category board: the set editor keeps a set's `board`, so deleting a question that sits on a tile leaves a board the schema refuses at Host time. The editor could show the board, drop it with a warning, or refuse to delete a tile's question (F89). A `BOARD` → FINAL Next once every tile is used, if End game proves too hidden (F89).
- Category board: the phone still reads "Question 9 of 9" (set order) on a board set, and shows nothing in BOARD; it could name the tile ("Animals · 200") as the Screen and remote do, from a board-tile field on `PlayerView` (F90). A tile-reveal sound on the pick (F90).
- Taglish: the phone's results card image (`resultsCard.ts`) is still drawn in English; server errors in toasts stay English (they would need an error code per message); the join form and "Joining…" stay English, since the language arrives with the first snapshot — `GET /api/rooms/:code/exists` could return it (F91). Kim to review the drafted Taglish strings in `client/src/lib/copy.ts`.
- Tests: one full `npm test` run in a few fails a single client test with `expect(document.title).toBe('Buzzr')` (seen in F84, F85, F87 and F92; the next run passes). Some suite leaves `document.title` set for the next file in the same worker; reset it in the shared jsdom setup, or find the page that changes it on unmount.
- Responsive (F92 leftovers): the hand-written filled and outline buttons on SetEditor and PasteQuestions (Sets moved in F94) and the hand-written `CARD`s on Host, HostBoard, TypedMarking, ReadAloud and PasteQuestions should move to `BUTTON_PRIMARY`, `BUTTON_OUTLINE` and `CARD` as F94, F95 and F98 lay those pages out again. The editor's drag handle, ↑/↓ buttons, correct-choice radio and the join form's avatar cells are still under 44px (EDT and PLY features).
- Responsive (F93): RoomCreated is top-aligned on a tall window. Landing centres only its hero and cards, so at 1440×900 the created room leaves the lower half empty. Centring it too would need Landing to tell the picker (top-aligned) from the created room.
- Responsive (F93): the search box placeholder is Bungee (`INPUT`), and is cut short at 375px ("SEARCH TITLE OR CATEG…"). A shorter placeholder or a DM Sans one for search would fix it (F94 touches `SetBrowser` on `/sets`).
- Responsive (F94): the `⋯` and Backup menus always open below. On the last card near the window's foot the menu runs past it and the page scrolls; flipping above when there is no room would avoid that. The `docs/ux/02` sketch also puts the tabs on the search row at `xl`, which would need SetBrowser to take a toolbar slot; F94 left them on their own row (7 cards still show at 1440×900).
- Responsive (F99, HST-11): keyboard shortcuts on a laptop remote. On `pointer-fine` at `lg`, the remote accepts the Screen's keys (Space, C, V, X, R, N, ←, S, U), routed to the same `host:*` actions, with key hints on the buttons as on the Screen bar. Reuse the Screen's key map (`shortcutFor` in `ScreenHostControls.tsx`); do not write a second one. The keys are off while typing in an input. Done when: at 1440×900, Space opens buzzers and C, V and X judge, with the existing `host:*` events.
- Responsive (F100): the lobby's join block (title, URL, room code, QR) is sized from its column's width, capped by height. On a short, wide hosting Screen (2560×1080 with Game setup and the host bar's fixed 8vh reserve) 50 players get two rows of chips and "+29 more". F101's measured bar reserve gives some back. Fitting the join block to a share of the height would give the rest.
- Responsive (F100): on a phone used as a hosting Screen, the stacked lobby scrolls. The chips and their "+N more" can sit below the fold, under Game setup's Start button. It is graceful, not designed (SCR-08).
- Generation (F113): store a category's guidance with its sets (or in the built-in file), so replacements and regenerates keep it across restarts. Today it lives in memory and a regenerate has none.
- Generation (F113): abort the SDK's in-flight request on a cancel (the generator already takes an `AbortSignal`), so a cancel stops spending at once rather than after the current call.
