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

- [ ] F126 Hide a category
  - Spec: DECISIONS Proposed spec changes (Admin redesign, 2026-11-03)
  - Depends: F120
  - Done when:
    - The built-in file gains an optional `hiddenCategories: string[]` (category keys as `categoryKey`), defaulting to `[]`, so the live `built-in-sets.json` loads unchanged (as `unreviewed`, F114)
    - `PUT /api/admin/categories/:name/hidden` `{hidden: boolean}` (zod-validated, `requireAdmin` and `requireWrite`, modelled on `/sample-hidden`) answers `{name, hidden}`; 404 for an unknown category. Deleting a category drops its key
    - `GET /api/built-in-sets` leaves out the live sets of a hidden category; drafts, review and publishing are unaffected, and publishing a hidden category keeps it hidden. `AdminCategory.hidden` reports it. A room already hosting one of its sets plays on
    - Client: **Hide from hosts** / **Show to hosts** on the category page, before Delete; a Hidden badge in the list and the Hidden chip (F121)
    - No new dependency
  - Tests: `builtInStore.test.ts` (a file without the field loads; set and clear), `http.admin.test.ts` (route, validation, 404, built-ins filtered, delete clears), `AdminCategory.test.tsx`

- [ ] F127 Generation history log
  - Spec: DECISIONS Proposed spec changes (Admin redesign, 2026-11-03)
  - Depends: F113
  - Done when:
    - `server/generate/history.ts` appends one JSON line per ended job (done, failed or cancelled, including a queued job cancelled at once) to `DATA_DIR/generation-history.jsonl`: `{endedAt, startedAt, kind, category, levels: [{difficulty, count}], saved, costUsd, outcome, error?}`. Never the guidance, a note or a key. A write failure logs a warning and never fails the job
    - `GET /api/admin/history?limit=` (default 50, at most 500, zod-validated, admin-only) answers `{entries (newest first), totals: {todayUsd, last30DaysUsd, allTimeUsd, jobs}}`, with the day in UTC. A corrupt line is skipped and counted in a warning
    - `GENERATE_FAKE=1` jobs are logged too (cost 0), so the page can be playtested
    - No new dependency
  - Tests: `history.test.ts` (append, read, totals across UTC days, corrupt line, write failure), `http.generate.test.ts` (each outcome logged once, the route, limit validation, admin only)

- [ ] F128 History page and spend tiles
  - Spec: DECISIONS Proposed spec changes (Admin redesign, 2026-11-03)
  - Depends: F127, F121
  - Done when:
    - `/admin/history` inside `AdminLayout`, full width with no list pane: the totals as tiles (today, 30 days, all time, jobs), then the entries: a table at `lg`+ (when, category, kind, levels, saved, cost, outcome) and stacked rows on a phone. A failed row shows its error; a category that still exists links to its page. Empty: "No generations yet."
    - The header's **History** link shows. The overview (F121) gains Spend today and Last 30 days tiles
    - No new dependency
  - Tests: an `AdminHistory` test (table and rows, empty, error), the overview tiles; playtest at 375×667 and 1440×900

## Bugs

- [x] B01 Room created cramped on /sets at desktop

## Backlog (not scheduled)

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
