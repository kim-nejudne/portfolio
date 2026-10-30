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

- [ ] F104 Client reads built-ins from the server
  - Spec: Set list `/sets`; DECISIONS Proposed spec changes (Super-admin, 2026-10-30)
  - Depends: F103
  - Done when:
    - `client/src/lib/builtInSets.ts` fetches `/api/built-in-sets` once per page load, with a `useBuiltInSets()` hook (loading, error, Retry)
    - The sample comes first unless `sampleHidden`
    - The Built-in tab, the editor's category suggestions, `listHostableSets`, `duplicateBuiltIn`, **Host a game** and the **New game** picker use the server's list instead of `BUILT_IN_SETS`
    - A failed fetch shows "Couldn't load the built-in sets." with Retry; My sets still work
    - The Dexie v3 clean-up still compares stored copies against the bundled starters
    - A My set and a built-in with the same id both list and host correctly (rows keyed by source and id)
  - Tests: `builtInSets.test.ts`, `db.test.ts`, `Sets.test.tsx`, `NewGamePicker.test.tsx`, `GameBuilder.test.tsx` as touched

- [ ] F105 Admin login
  - Spec: Security; HTTP; DECISIONS Proposed spec changes (Super-admin, 2026-10-30)
  - Depends: F103
  - Done when:
    - `ADMIN_PASSWORD_HASH` (`scrypt$N$r$p$salt$hash`) is parsed in `env.ts`; a malformed value stops the server
    - `npm run admin:hash` (`scripts/admin-hash.mjs`, `node:crypto`) reads a password without echo and prints the hash
    - Unset, every `/api/admin/*` route returns 404
    - `POST /api/admin/login {password}`: constant-time scrypt check, 5 tries per IP per minute, sets `buzzr_admin` (HttpOnly, SameSite=Strict, Path=/api/admin, Max-Age 12 h, Secure when `req.secure`)
    - Sessions are 32 random bytes held in memory as SHA-256 hashes with an expiry; a restart logs out
    - `GET /api/admin/session` (200 `{expiresAt}` or 401) and `POST /api/admin/logout`
    - Admin writes require a JSON content type and a same-origin `Origin`
    - `/admin` page: password form, wrong-password and rate-limit errors, signed-in state with Logout and a link to Question sets; nothing links to it
    - `useAdminSession()` for later features
  - Tests: `server/admin.test.ts`, `server/http.admin.test.ts` (404 unset, wrong password, rate limit, expiry, cookie flags, Origin), `server/env.test.ts`, `client/src/pages/Admin.test.tsx`

- [ ] F106 Admin import, delete, hide sample, export
  - Spec: Set list `/sets`; HTTP; DECISIONS Proposed spec changes (Super-admin, 2026-10-30)
  - Depends: F104, F105
  - Done when:
    - `POST /api/admin/built-in-sets/import` takes a single set, `{sets}` or a bare array (as F102), up to `ADMIN_IMPORT_MAX_BYTES` (2 MB); each good set goes live at once, replacing a set with its id or appending; a set with an `imageId` or past `BUILT_IN_SETS_MAX` (500) is rejected; it returns `{added, replaced, rejected}`
    - `DELETE /api/admin/built-in-sets/:id` removes the live set and its draft
    - `PUT /api/admin/sample-hidden {hidden}`
    - `GET /api/admin/built-in-sets/export` downloads `buzzr-built-ins-YYYY-MM-DD.json` as `{sets: [...]}`, which re-imports as is
    - Signed in, the Built-in tab shows **Import to built-ins** (with a result line), **Export built-ins**, **Hide sample** / **Show sample**, and per set **Delete** with confirm; the list refreshes after each
    - Signed out, the tab looks as in F104
  - Tests: `server/http.admin.test.ts` (add vs replace, image and limit rejections, 401 without a session, export round trip), `Sets.test.tsx` (admin toolbar)

- [ ] F107 Edit built-ins with draft and publish
  - Spec: Set editor; DECISIONS Proposed spec changes (Super-admin, 2026-10-30)
  - Depends: F106
  - Done when:
    - `draftSetSchema` in `shared/schemas.ts`: the set shape with incomplete fields allowed, bounded lengths, no `imageId`
    - `GET|PUT|DELETE /api/admin/built-in-sets/:id/draft` and `POST /api/admin/built-in-sets/:id/publish`; GET falls back to the live set; publish validates with `questionSetSchema` and replaces the live set
    - `SetEditor` takes a store (IndexedDB or the admin draft API); `/admin/sets/:setId` opens a built-in for the signed-in admin only
    - In admin mode the editor hides picture controls and shows **Publish** and **Discard draft**; publish errors name the bad fields
    - Signed in, a built-in card has **Edit** and a "Draft" badge while a draft exists
    - A draft never appears in `GET /api/built-in-sets`
  - Tests: `server/http.admin.test.ts` (draft round trip, publish validation, discard, draft hidden from the public list), `shared/schemas.test.ts`, `SetEditor.test.tsx` (admin mode)

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
