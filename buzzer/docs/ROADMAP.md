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

- [ ] F92 Responsive foundations
  - Spec: UI spec by view; see `docs/ux/00-foundations.md`
  - Depends: F91
  - Done when:
    - FND-01 … FND-08 are closed
    - A `short` custom variant is in `index.css`. `.claude/rules/client.md` names the breakpoints and the device matrix
    - `components/PageShell.tsx` exists (narrow, content and wide widths) and `Placeholder` uses it
    - `lib/ui.ts` has `BUTTON_SMALL`, `BUTTON_DANGER` and `FIELD`. No local `smallButton`, `PREVIEW_BUTTON` or `field` copies remain
    - `LABEL` and every other Player, Host, Landing and set-page text is at least 14px
    - `HOVER` is on `BUTTON_SECONDARY` and on every remaining local button class
    - Delete, Kick and End game use `BUTTON_DANGER` and keep their confirm
    - `usePointerFine()` chooses the Tap or Click copy, with Taglish strings for every new `copy.ts` key
  - Tests: `PageShell.test.tsx`, `usePointerFine` test, `copy.test.ts` (new keys in both tables); the existing suites pass unchanged in behaviour

- [ ] F93 Landing and host picker on every screen
  - Spec: UI spec by view (Landing page); see `docs/ux/01-landing-and-hosting.md`
  - Depends: F92
  - Done when:
    - LND-01 … LND-08 are closed
    - At `md`, Join and Host are equal side-by-side cards
    - The picker has no inner scroll box. At `lg` it is two panes with a sticky summary and Create room; on phones it has a sticky bottom Create room bar
    - RoomCreated shows option cards ordered by pointer type
    - NewGamePicker scrolls at 667×375 and matches the picker at `lg`
    - GameBuilder actions are one row at `md`
  - Tests: `Landing.test.tsx`, `NewGamePicker.test.tsx`, `GameBuilder.test.tsx`, `SetBrowser.test.tsx` updated for the new structure

- [ ] F94 Set library grid
  - Spec: Question editor and images (Set list); see `docs/ux/02-set-library.md`
  - Depends: F92
  - Done when:
    - LIB-01 … LIB-08 are closed
    - `/sets` uses a wide shell with a card grid (`md:2`, `xl:3`)
    - Each card has Host and Preview visible, a title link, and a `⋯` menu with Delete last and in red
    - The header puts New set first, with a Backup menu holding Import JSON and Export all
    - Card actions give toast feedback
    - SetPreview is wider at `lg` and scrolls at short heights
    - AnswerSheet stacks into rows below `sm` and prints unchanged
  - Tests: `Sets.test.tsx`, `SetBrowser.test.tsx`, `SetPreview.test.tsx`; an AnswerSheet test for the stacked layout

- [ ] F95 Set editor toolbar and outline
  - Spec: Question editor and images (Set editor); see `docs/ux/03-set-editor.md`
  - Depends: F92
  - Done when:
    - EDT-01 … EDT-10 are closed
    - A sticky toolbar holds save status, Add, Paste, Preview and Print; on phones Add is a sticky bottom button
    - At `lg`, a sticky question outline jumps to and focuses a card. The cards stay one vertical list (record this in DECISIONS)
    - Card fields use a grid at `md`; the card header is one line at 375px; every icon button is at least 44px
    - Paste opens in view, side by side at `md`
    - QuestionPreview is letterboxed at 16:9, with Show answer as the primary
  - Tests: `SetEditor.test.tsx` (toolbar actions, outline jump, overflow menu reorder, delete), `QuestionPreview.test.tsx`

- [ ] F96 Player phone: landscape and short screens
  - Spec: UI spec by view (Player view); see `docs/ux/04-player.md`
  - Depends: F92
  - Done when:
    - PLY-01 … PLY-06 are closed
    - At 667×375, the lobby, open, won-with-countdown, locked, choice, typed, revealed and final states are fully reachable, with no clipping
    - The buzzer is at least 200px under `short:`
    - The rename overlay scrolls
    - Avatar cells are at least 44px at 320px
  - Tests: `Play.test.tsx` (short-layout classes present per state, Final scrolls, choices grid under `short`)

- [ ] F97 Player on tablet and desktop
  - Spec: UI spec by view (Player view); see `docs/ux/04-player.md`
  - Depends: F96
  - Done when:
    - PLY-07 … PLY-11 are closed
    - At `md`, a centred `max-w-2xl` shell contains the top bar, the stage and Who's here; at `lg` the shell is framed
    - The buzzer is 360–400px at 820×1180 and 1440×900
    - Choices are a 2×2 grid with the Screen's letter colours
    - The Click or Space copy and hint show on a fine pointer
    - Hover states are added and the menu is wider
    - The "whole viewport" spec note is recorded in DECISIONS
  - Tests: `Play.test.tsx` (pointer-fine copy, choice grid), `copy.test.ts`

- [ ] F98 Host remote on the phone
  - Spec: UI spec by view (Host remote); see `docs/ux/05-host-remote.md`
  - Depends: F92
  - Done when:
    - HST-01 … HST-08 are closed
    - The primary action, including the judging panel, sits in a sticky bottom bar, visible in every phase at 375×667
    - The tablist is sticky
    - End game is a separate danger row, and arming it does not reflow the tiles
    - Player rows show full names; Kick and team are in a `⋯` menu
    - Settings rows stack below about 384px
    - The read-aloud code fits at 320px
    - PIN entry is top-aligned on short screens
  - Tests: `Host.test.tsx` and `HostControls.test.tsx` (sticky bar holds the primary in each phase, End game confirm, kick through the menu), `PairHostPhone.test.tsx` if touched

- [ ] F99 Host remote dashboard on tablet and desktop
  - Spec: UI spec by view (Host remote); see `docs/ux/05-host-remote.md`
  - Depends: F98
  - Done when:
    - HST-09 and HST-10 are closed. HST-11 (keyboard shortcuts) is either done or moved to Backlog
    - At `lg`, the remote is a two-column dashboard (Game | Players and Settings) with no tabs
    - At `md`, it is a `max-w-2xl` column with one-line player rows
    - The phone layout is unchanged
    - The dashboard is recorded in DECISIONS
  - Tests: `Host.test.tsx` (all three panels present at `lg`; tabs present on phone), and the shortcut tests if HST-11 is done

- [ ] F100 Screen legibility on any display
  - Spec: UI spec by view (Screen view); see `docs/ux/06-screen.md`
  - Depends: F92
  - Done when:
    - SCR-01 … SCR-08 are closed
    - No Screen text renders below 14px at 1024×768, 820×1180 or 390×844
    - Lobby chips have a 14px floor with "+N more"
    - `zoom:2` needs a minimum height of 1440px
    - Pure-vw sizes are converted to `min(vw, vh)`
    - The scoreboard and final ranking fit 10 and 24 players at 720p and 1080p
    - Board tiles fit at 6 columns on 4:3
    - The lobby, image questions and Final stack in portrait
    - 1920×1080 is unchanged (screenshot comparison)
  - Tests: `Screen.test.tsx` and `ScreenResults.test.tsx` (floors present in the class strings, portrait stacking classes, chip overflow "+N more"), `useShrinkToFit.test.tsx` (new floor)

- [ ] F101 Screen host bar and overlays
  - Spec: UI spec by view (Screen host controls); see `docs/ux/06-screen.md`
  - Depends: F100
  - Done when:
    - SCR-09 … SCR-16 are closed
    - The host bar is one row with a More menu, and reserves its measured height only while visible
    - The help overlay fits at 720p and is a modal dialog
    - The lobby shows one Start game
    - The bar shows on `pointerdown`; there is no auto-hide and no key hints on a coarse pointer
    - A persistent shortcuts hint and shortcut feedback show
    - The Screen toast variant sits above the bar
    - A slim standings rail shows from 1024px wide or 600px tall
    - The board cursor follows focus
  - Tests: `Screen.test.tsx` and `HostControls.test.tsx` (More menu actions, single Start in lobby, coarse-pointer behaviour, help dialog semantics)

## Bugs

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
