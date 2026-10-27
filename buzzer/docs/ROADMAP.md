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

- [ ] F10 Host pairing and host remote shell
  - Spec: Creating and joining a room (step 3); Roles and devices; UI spec by view (Host remote: top)
  - Depends: F08
  - Done when:
    - **Pair host phone** on a host-holding Screen shows a QR to `/host/:code#t=<hostToken>` for 60 s, then hides it
    - `/host/:code` reads the token from the hash, stores it, strips the hash from the URL, and sends `host:join`
    - The remote shows the lobby player list and the current question, answer and notes box
    - Opening `/host/:code` without a valid token shows "Not authorised" and nothing secret
  - Tests: playtest — pair a second tab via the QR URL; it receives HostView; a tab with a wrong token gets no answer text

- [ ] F11 Dev tool: fake players
  - Spec: Milestones and acceptance criteria (Dev tool: fake players)
  - Depends: F07
  - Done when:
    - `/dev/bots/:code` exists only when `NODE_ENV !== 'production'` (route not registered and code tree-shaken in the production build)
    - Spawns N bot players (each a real socket, with ping) with a count input
    - A "buzz all with random 0–300 ms delays" button sends `player:buzz` from every bot (acks show errors until F15)
    - Dev rate limits do not block 20 bots joining at once
  - Tests: playtest — 8 bots join, Screen shows 8 chips; production build has no `/dev` route

## M3 — Buzzer core

- [ ] F12 Fairness: latency and ranking
  - Spec: Buzzer fairness and timing; Edge cases (two buzzes inside the window)
  - Depends: F02
  - Done when:
    - `server/fairness.ts` keeps a rolling median RTT of the last 10 samples and one-way = RTT / 2
    - `adjustedAt = receivedAt − min(oneWay, 150)`; ranking by `adjustedAt`, then `receivedAt`, then `joinedAt`
    - Computes per-buzz gaps to the winner for the "also buzzed" list
  - Tests: `fairness.test.ts` — median with <10 and >10 samples, cap at 150 ms, slow player beats fast player when corrected, all three tie-breaks

- [ ] F13 Reducer: question flow
  - Spec: Game flow and state machine (Transitions: start, open, reveal, next, prev, end; scoreboard overlay); Data model (RoomSettings)
  - Depends: F05
  - Done when:
    - `host:start` (≥1 player), `host:open`, `host:reveal`, `host:next`, `host:prev`, `host:end`, `host:scoreboard` follow the transitions table
    - `autoOpenBuzzers` opens buzzers on entering QUESTION; `scoreboardEvery` sets `showScoreboard` on `host:next`
    - Every action not listed for the current phase is rejected
  - Tests: `reducer.flow.test.ts` — one test per transition row, plus a table-driven test that every other phase rejects each action

- [ ] F14 Reducer: buzz collection and window close
  - Spec: Game flow and state machine (OPEN → COLLECTING → BUZZED; scheduled effects); Buzzer fairness and timing (Rules)
  - Depends: F12, F13
  - Done when:
    - First valid `player:buzz` in OPEN moves to COLLECTING and returns a `windowClosed` effect for `now + 150` carrying question index and opening counter
    - Buzzes count only in OPEN/COLLECTING, once per player per opening, never from locked-out players or players who joined during the current opening
    - `windowClosed` ranks buzzes, sets `winnerId`, moves to BUZZED and emits `fx buzz` with gaps; a stale `windowClosed` is a no-op
    - Every buzz is logged with receive time, one-way latency and adjusted time
  - Tests: `reducer.buzz.test.ts` — window timing, duplicate press, early press ignored, stale effect ignored after `host:reveal`

- [ ] F15 Gateway: effects runner, ping and buzz
  - Spec: Buzzer fairness and timing; Realtime events and HTTP API (ping, player:buzz, host:start/open/reveal/next/prev/end, fx); Security (rate limits)
  - Depends: F07, F14
  - Done when:
    - Scheduled effects run on server timers using a monotonic clock (`performance.now()`), and feed back through `reduce`
    - `ping {t}` → `pong {t}` updates the player's RTT
    - `player:buzz` limited to 5 per second per socket; host flow events wired with token checks
    - `fx` events reach Screen, Host and Players
  - Tests: `sockets.buzz.test.ts` — two clients buzz 20 ms apart, winner announced once; 6th buzz in a second rejected; fake timers for the window

- [ ] F16 Host remote primary action
  - Spec: UI spec by view (Host remote: primary action button)
  - Depends: F10, F15
  - Done when:
    - Full-width primary button cycles Start game → Open buzzers → Reveal answer → Next question → Show final results by phase
    - A rejected ack shows a brief toast
    - Two host tabs acting at once: the stale one gets a toast, state stays consistent
  - Tests: playtest — drive start/open/reveal/next from the remote while a Screen tab follows

- [ ] F17 Player buzzer screen
  - Spec: UI spec by view (Player view: buzzer screen and states up to "Someone else won"); Buzzer fairness and timing (Client-side speed)
  - Depends: F09, F15
  - Done when:
    - Whole-viewport circular button fires on `pointerdown` and Space; instant pressed state and `navigator.vibrate(30)` before the server replies
    - States: Lobby, Get ready, BUZZ!, Buzzed…, You're first!, "<Name> buzzed first"
    - No zoom, text selection or long-press menu on the button
  - Tests: playtest — 3 players, open buzzers, one presses; that phone shows green, others show the winner's name

- [ ] F18 Screen question and buzz views
  - Spec: UI spec by view (Screen view: Question, Buzzed); Buzzer fairness and timing (gap to second place)
  - Depends: F08, F15
  - Done when:
    - "Question N of M", auto-shrinking question text, image area (contained), "Buzzers locked" / "Buzzers OPEN" with a colour change
    - Winner banner in the player's colour; "also buzzed" names with "+0.12 s" gaps
    - The Screen DOM never contains the answer before REVEAL
  - Tests: playtest with bots — "buzz all" shows a winner and gaps; DOM text search for the answer before reveal finds nothing

## M4 — Host controls and scoring

- [ ] F19 Reducer: judging, lockout and reopen
  - Spec: Game flow and state machine (BUZZED rows); Scoring rules; Edge cases (everyone locked out, host judges twice, winner disconnects); Out of scope (Teams: `applyJudgement()`)
  - Depends: F14
  - Done when:
    - `host:judge` accepted only in BUZZED and only once per buzz
    - Correct: winner + points, REVEAL, `fx correct`. Wrong: lockout, penalty if on, `fx wrong`, `reopen` effect at `now + 1500`, or REVEAL when nobody is eligible
    - All score changes go through one `applyJudgement()`; stale `reopen` is a no-op
  - Tests: `reducer.judge.test.ts` — lockout, penalty on/off and negative scores, last eligible wrong → REVEAL, double judge rejected, disconnected winner can be judged

- [ ] F20 Reducer: undo, score adjust, kick, settings, final ranking
  - Spec: Game flow and state machine (undo, end); Scoring rules (final ranking); Edge cases (undo, kicked player); Host remote (Players tab, Settings tab)
  - Depends: F19
  - Done when:
    - `host:undo` reverses the last judgement of the current question exactly (score and lockout) and returns to BUZZED with that winner; one level per question
    - `host:adjustScore`, `host:kick` (id added to `kickedIds`), `host:settings` with zod-validated partials
    - Final ranking sorts by score with shared ranks for ties
  - Tests: `reducer.undo.test.ts` (restores exactly after correct and after wrong-then-reopen), `reducer.admin.test.ts`, `ranking.test.ts`

- [ ] F21 Gateway: remaining host events
  - Spec: Realtime events and HTTP API (host:judge, undo, adjustScore, kick, settings, scoreboard; kicked; fx)
  - Depends: F15, F20
  - Done when:
    - All remaining host events are wired with token checks and acks
    - A kicked player's socket receives `kicked` and is disconnected; rejoining with the same id fails
    - `fx correct`, `fx wrong` and `fx join` are emitted
  - Tests: `sockets.host.test.ts` — kick flow, judge wrong then reopen after 1.5 s (fake timers)

- [ ] F22 Host remote: judging, secondary actions, tabs
  - Spec: UI spec by view (Host remote)
  - Depends: F16, F21
  - Done when:
    - Correct / Wrong side by side in BUZZED; secondary actions Skip, scoreboard toggle, Undo, Previous, End game
    - Players tab with scores, connection status, ± by question value, Kick
    - Settings tab: penalty, auto-open, scoreboard every N
  - Tests: playtest — run a 3-question game from the remote only, with one wrong answer, one undo and one kick

- [ ] F23 Screen host controls and shortcuts
  - Spec: UI spec by view (Screen host controls)
  - Depends: F22
  - Done when:
    - Bottom control bar appears only when this device holds the hostToken; auto-hides after 3 s idle
    - All keys in the shortcut table work; `?` shows the help overlay; F toggles fullscreen; H toggles the bar
    - The answer is never rendered on the Screen before reveal, even with host controls
  - Tests: playtest — run a full game from the keyboard only; DOM search for answer text before each reveal

- [ ] F24 Screen and player result states
  - Spec: UI spec by view (Screen view: Judged, Reveal, Scoreboard, Final; Player view: locked out, revealed, game over)
  - Depends: F18, F21
  - Done when:
    - Screen: green/red flash, "+100" float, greyed chip on wrong, answer under the question at REVEAL
    - Scoreboard overlay with animated reordering; Final shows a top-3 podium then full ranking
    - Player: Locked out, answer + "+100" at reveal, final rank and score, "Removed by host" when kicked
  - Tests: playtest with bots — full game to FINAL; ties share a podium rank

## M5 — Question editor and images

- [ ] F25 Saved sets and the set list
  - Spec: Question editor and images (intro, Set list); Tech stack and architecture (Browser storage)
  - Depends: F08
  - Done when:
    - Dexie DB `src/lib/db.ts` stores sets and image blobs; the sample set is seeded on first visit
    - `/sets` cards show title, question count, last edited; Open, Duplicate, Delete (confirm), **Host this set**; **New set**
    - **Host a game** lets the host pick any saved set
    - Empty state when no sets exist
  - Tests: `db.test.ts` with `fake-indexeddb`; playtest — duplicate and host a set

- [ ] F26 Set editor
  - Spec: Question editor and images (Set editor)
  - Depends: F25
  - Done when:
    - Title and question cards (text, answer, host notes, points) with spec limits and inline errors
    - Autosave debounced 500 ms with a "Saved" indicator; up/down, duplicate and delete per question; 100-question cap
  - Tests: unit test for the debounce with fake timers; playtest — edit, reload, changes persist

- [ ] F27 Reorder, preview and print sheet
  - Spec: Question editor and images (Set editor: reorder, Preview, Print answer sheet)
  - Depends: F26
  - Done when:
    - Drag handle reorder with `@dnd-kit`, keyboard accessible
    - **Preview** shows a question as the Screen renders it
    - **Print answer sheet** page lists number, question, answer, notes and prints cleanly
  - Tests: playtest — drag reorder persists; print preview check

- [ ] F28 Import and export JSON
  - Spec: Question editor and images (Set list: Import/Export; Images: export embeds base64)
  - Depends: F26
  - Done when:
    - **Export JSON** downloads one file with images as base64 data URLs
    - **Import JSON** validates with zod and lists readable errors (path + message)
  - Tests: `importExport.test.ts` — round-trip equality including images; three malformed files give readable errors

- [ ] F29 Image pipeline in the editor
  - Spec: Question editor and images (Images); Edge cases (question with only an image)
  - Depends: F26
  - Done when:
    - Pick, drag-and-drop and clipboard paste; PNG/JPEG/WebP/GIF accepted (GIF → first frame)
    - Resized to longest side 1600 px, WebP (JPEG fallback) at 0.8; files still >1.5 MB rejected with a message
    - Thumbnail with Remove; image-only questions allowed
  - Tests: unit test for the size maths; playtest — paste a large PNG, it stores under 1.5 MB

- [ ] F30 Image upload, serving and preload
  - Spec: Question editor and images (Images: upload, serve, preload, 50 MB); Realtime events and HTTP API (HTTP image routes)
  - Depends: F06, F29
  - Done when:
    - Room creation uploads each image to `POST /api/rooms/:code/images/:imageId` with the Bearer token; 1.5 MB per image, 50 MB per room
    - `GET` serves images with a long cache header; Screen and Host preload the next question's image
    - The sample set gains its 2 images; image-only questions render large with no text block
  - Tests: `http.images.test.ts` — auth required, size limits, 51st MB rejected; playtest — images appear instantly on next

## M6 — Polish

- [ ] F31 Sounds and animations
  - Spec: Tech stack and architecture (Sound); UI spec by view (Screen view: Click to start, Judged, chips pop in)
  - Depends: F24
  - Done when:
    - Howler plays buzz, correct, wrong, join and final fanfare from `client/public/sounds/` (royalty-free or self-made; sources listed)
    - Screen's **Click to start** overlay unlocks audio and enters fullscreen
    - Chip pop-in, +points float and scoreboard reordering animate; `prefers-reduced-motion` respected
  - Tests: playtest — sounds fire on fx events (console log hook); reduced-motion check

- [ ] F32 Reconnects and room lifecycle
  - Spec: Reconnects, security and edge cases (Reconnects; phone backgrounded)
  - Depends: F24
  - Done when:
    - Every role auto-reconnects and re-renders the latest snapshot; Host and Screen rejoin silently from `localStorage`
    - Disconnected players stay greyed out in lists
    - Room expiry and server restart show "This game has ended" with a link home (`room:closed` or unknown room)
  - Tests: `sockets.reconnect.test.ts`; playtest — refresh Screen, host and player mid-game; each returns to the right state and score

- [ ] F33 Device polish and feedback
  - Spec: UI spec by view (Player view: Wake Lock, connection dot); Milestones and acceptance criteria (6. Polish)
  - Depends: F32
  - Done when:
    - Screen Wake Lock on the Player view (re-acquired on visibility change)
    - Green/amber/red connection dot on Player and Host
    - Error toasts for every failed ack; empty states everywhere a list can be empty
  - Tests: playtest on a phone viewport; manual check on a real phone

## M7 — Deploy

- [ ] F34 Dockerfile and deploy guide
  - Spec: Tech stack and architecture (Deploy); Milestones and acceptance criteria (7. Deploy; Manual acceptance checklist)
  - Depends: F33
  - Done when:
    - Multi-stage Dockerfile builds and runs the single Node process serving client and sockets
    - README gives step-by-step deploy instructions for the chosen host (see DECISIONS: deploy target), including WebSocket proxying
    - The deploy sets `TRUST_PROXY` for the reverse proxy, so per-IP rate limits see client IPs (DECISIONS F06)
    - `docker build` and `docker run` work locally and `/healthz` returns 200 from the container
  - Tests: container smoke check; the full manual acceptance checklist run on real devices

## Bugs

## Backlog (not scheduled)

- Add a favicon. The browser requests `/favicon.ico` and gets a 404 (seen in the F03 playtest).
- Optional `PUBLIC_URL` setting for the join QR and URL, so a Screen opened at `localhost` still shows an address phones can reach. F08 only shows a note (F08 decision).
- Rate-limit `GET /api/rooms/:code/exists`. Without a limit, the 23⁴ room codes can be enumerated cheaply, and the answer shows each room's phase. The spec sets no limit (F06 review).
