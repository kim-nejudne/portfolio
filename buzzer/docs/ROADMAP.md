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

- [ ] F35 Answer timer: server and phone setting
  - Spec: Game flow and state machine (Transitions); Data model (`RoomSettings`, `Room`); Host remote (Settings tab); see DECISIONS, Proposed spec changes (answer timer)
  - Depends: F34
  - Done when:
    - `RoomSettings.answerSeconds` is one of `ANSWER_SECONDS_CHOICES` (0, 3, 5, 7, 10; 0 = off, the default), zod-validated in room creation and `host:settings`
    - Entering BUZZED with `answerSeconds > 0` sets `Room.answerTimer {seconds, endsAt, up: false}` and schedules an `answerTimeUp` timer action carrying `questionIndex`, `openingCounter` and `at`
    - A fresh `answerTimeUp` (BUZZED, no pending reopen, `answerTimer.endsAt === at`, same index and counter) sets `up: true` and emits `fx {kind: 'timeUp', playerId}` for the winner; the host still judges, nothing is judged automatically
    - `answerTimer` is cleared by a judgement (both results), reveal, reopen, kick of the winner, next, prev, end and undo; a stale `answerTimeUp` returns the same room object
    - A settings change during a countdown applies from the next buzz, not to the running timer
    - Screen, Host and Player views carry `answerTimer {seconds, up}` or null; `endsAt` never leaves the server
    - The host remote's Settings tab has an "Answer time" stepper (Off, 3, 5, 7, 10 s)
  - Tests: new `server/reducer.timer.test.ts` (start, off, time up, every stale case including undo then wrong again, mid-countdown settings change); schema, views, settings-merge and constants tests; `HostControls.test.tsx` for the stepper; `npm run smoke:docker`

- [ ] F36 Answer countdown and time's-up on the devices
  - Spec: UI spec by view (Player view, Screen view, Host remote); Tech stack and architecture (sounds); see DECISIONS, Proposed spec changes (answer timer)
  - Depends: F35
  - Done when:
    - A shared countdown hook counts whole seconds down from `answerTimer.seconds`, restarts on a new question or opening, stops at 0, and shows "Time's up!" once the view says `up`
    - Screen: a large countdown beside the winner banner, then "Time's up!", a red flash and a new `timeUp` sound
    - Winner's phone: "You're first! Answer now" with the seconds left, then "Time's up!"; other phones unchanged
    - Host remote: a countdown beside Correct / Wrong, then a "Time's up" badge and a vibration
    - With the timer off, every view looks as before
  - Tests: countdown hook tests with fake timers; `buzzerState`, `sounds`, `Screen`, `Host` and `Play` tests; `/playtest` with a 3 s timer

- [ ] F37 Settings in the Screen lobby
  - Spec: UI spec by view (Screen view: Lobby; Screen host controls); see DECISIONS, Proposed spec changes (lobby settings)
  - Depends: F35
  - Done when:
    - On a Screen that holds the hostToken, the lobby shows the room settings beside Start: auto-open buzzers, answer time, wrong-answer penalty, scoreboard every N
    - The panel reuses the remote's `HostSettings` controls and sends `host:settings`; a failed ack shows the Screen's toast
    - A Screen without the hostToken shows no settings
    - Space still starts the game while a settings control has focus
  - Tests: `Screen.test.tsx` (panel only with the hostToken, a toggle sends `host:settings`); `/playtest`: set auto-open and a 3 s answer time in the lobby, start, and check the buzzers open with no host action

## Bugs

## Backlog (not scheduled)

- Add a favicon. The browser requests `/favicon.ico` and gets a 404 (seen in the F03 playtest).
- Optional `PUBLIC_URL` setting for the join QR and URL, so a Screen opened at `localhost` still shows an address phones can reach. F08 only shows a note (F08 decision).
- Rate-limit `GET /api/rooms/:code/exists`. Without a limit, the 23⁴ room codes can be enumerated cheaply, and the answer shows each room's phase. The spec sets no limit (F06 review).
- Host remote game-over state in FINAL: the remote keeps showing the last question with no primary button (F16 playtest). No feature names a host final view; the Players list still shows the scores.
- Measure the 150 ms collection window in monotonic time (from the first buzz's `receivedAt`), so a late-firing timer cannot stretch it. Today the window lasts until `windowClosed` arrives (F14 decision).
- Tell the player when a buzz was ignored. A player who joined during the current opening can press BUZZ!, but the server ignores the buzz silently and the phone stays on "Buzzed…" (F17 decision). A `canBuzz` field in `PlayerView` would let the phone show "Get ready…" instead.
- Move the socket test harness (`start`, `connect`, `record`, `flush`, `openTable`) into `server/test/`. `sockets.test.ts`, `sockets.buzz.test.ts` and `sockets.host.test.ts` each have their own copy (F21).
- Keep the host's Players list in a stable order. It is ranked by score, so the row under the thumb moves after a ± tap (F22 playtest). Needs join order or a stable index in `HostView`.
- Arrow-key navigation between the host remote's tabs (WAI-ARIA tabs pattern). Tapping works; the keyboard can only Tab through them (F22 review).
- Replace the `emit` cast in `client/src/pages/Host.tsx` `send` with a typed helper. Socket.IO's typed `emit` cannot take a generic event name (F22 review).
- Preview: a "Show answer" toggle that previews the REVEAL layout too. F27 previews only the question as first shown.
- "Reconnecting…" indicator on the Screen while the socket is down. F33's connection dot covers Player and Host; the Screen still shows its last snapshot, and the Host still lists players as online while its own socket is down (F32 playtest).
- Faster connection-dot reaction to a silent drop (airplane mode): the dot waits for Socket.IO's heartbeat, up to about 45 s with the defaults. Options: a shorter `pingInterval`/`pingTimeout`, or the browser's `offline` event (F33).
- Slimmer runtime image: client-only libraries (React, Dexie, Howler, dnd-kit, qrcode.react…) are in `dependencies`, so `npm ci --omit=dev` ships them in the 266 MB image although the server never loads them (F34).
- A deploy workflow for buzzr like `deploy-poketrack.yml` (build on the runner, ship, health-gate, roll back). F34 deploys by hand from the README (F34).
- Hover states for the mouse-driven views (the Screen host bar, Sets, SetEditor). Buttons have no `hover:` style today; only the "Back" links do (pointer-cursor fix).
