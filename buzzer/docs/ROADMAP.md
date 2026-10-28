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

- [ ] F44 Favicon and hover states
  - Spec: none (polish)
  - Depends: F37
  - Done when:
    - `client/public/favicon.svg` (a round BUZZ-red button on a dark base, colours from `shared/constants.ts`) is linked from `client/index.html`; no `/favicon.ico` 404 in the browser console on any page
    - Every enabled button on the Screen host bar, Sets and SetEditor has a hover style (`not-disabled:hover:border-ink` plus a faint background tint); disabled buttons have none; touch devices are unaffected
  - Tests: an `index.html` check that the icon link exists; `/playtest`: console has no 404, hover screenshot of the host bar and Sets

- [ ] F45 Socket test harness and typed host emit
  - Spec: none (code health)
  - Depends: F37
  - Done when:
    - `server/test/sockets.ts` holds the shared harness (`start` with options for the clock, the monotonic clock and limits; `connect`, `record`, `flush`, `openTable`, `recordStates`, `nextState`, `screenJoin`, `playerJoin`, `hostJoin`, `serverDisconnect`); the four `server/sockets*.test.ts` files import it and keep no copies
    - The `emit` cast in `client/src/lib/useHostCommand.ts` is replaced by a typed helper with no `as`
    - The test count is unchanged and every test still passes; no behaviour change
  - Tests: the existing suite (same count before and after); typecheck

- [ ] F46 Slim runtime image and CI job
  - Spec: Tech stack and architecture (deploy)
  - Depends: F37
  - Done when:
    - Client-only libraries (react, react-dom, react-router, dexie, howler, @dnd-kit/*, qrcode.react, zustand, socket.io-client) are in `devDependencies`; `dependencies` holds only what `dist/server` imports
    - `npm run smoke:docker` passes and the new image size is recorded in PROGRESS and the README
    - The root `.github/workflows/ci.yml` has a `buzzer` job (format:check, lint, typecheck, test, build) on pull requests and pushes touching `buzzer/**`. This file is outside `buzzer/`: ask Kim before staging it
  - Tests: `npm run smoke:docker`; `npm run build`; CI job run on a push

## Bugs

## Backlog (not scheduled)

- Pairing QR uses `joinOrigin` too: a Screen on localhost hands a phone an unreachable `/host/:code` link (F42). Pass the join origin to `PairHostPhone`.
