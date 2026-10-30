# Roadmap

Status: [ ] todo · [~] in progress · [x] done · [!] blocked (see note)

Change markers with `node .claude/scripts/roadmap.mjs mark`. A done item collapses to one line; its details are in PROGRESS.md and git history. Each `Spec:` line cites headings of `docs/spec.md` in `spec.mjs` form: `Heading (Subheading, Subheading)`.

M1 is the **thinnest playable version**: at the end of it a real group can play one full cycle on a laptop Screen and their phones, with one pen colour, a hard-coded word list and exact-match guesses. Every later milestone makes it fairer, safer, prettier or sturdier, and the game stays playable after every feature. The **Barkada night release** after M9 is the version Kim brings to a real barkada night.

## M1 — Thin slice

- [x] F01 Project skeleton and tooling

- [x] F02 Shared types, schemas and constants

- [x] F03 Rooms, codes and RoomStore

- [x] F04 Reducer v0: lobby and a basic turn

- [x] F05 Views and socket gateway

- [x] F06 Ink relay v0

- [x] F07 Screen page v0

- [x] F08 Player page v0

- [x] F09 Dev tool: fake players

## M2 — Fair and secret

- [x] F10 Secrecy leak tests

- [x] F11 Ink codec and action stack

- [x] F12 Ink sequence, resend and snapshots

- [x] F13 Latency-corrected scoring

- [x] F14 Guess matching

- [x] F15 Near-miss feedback and the guess feed

- [x] F16 Ink delay debug overlay

## M3 — Game shape

- [x] F17 Word packs and loader

- [x] F18 Deck and word choice

- [x] F19 Hints and early end

- [x] F20 Cycles, scoreboard and final

- [x] F21 Overlapped choosing

- [x] F22 Settings and presets

- [x] F23 Late join and turn order

## M4 — Host and onboarding

- [x] F24 Screen host controls and shortcuts

- [x] F25 Host crown and the host lobby

- [x] F26 How to play and first-turn captions

- [x] F27 Lobby doodles

- [x] F28 Pause, skip, kick and end

- [x] F29 Rematch, back to lobby and the night's totals

## M5 — Drawing tools

- [ ] F30 Colours, sizes and eraser
  - Spec: Canvas and drawing tools (Tools, Rendering); UI by role and phase (Drawer phone)
  - Depends: F11
  - Done when:
    - Two toolbar rows: 8 colour swatches (40 px, 44 px hit area); one size button cycling S/M/L, Eraser, Undo, Clear; quadratic smoothing on drawer and Screen via one shared `drawStroke`
  - Note (F27): the lobby `DoodlePad` has only the black pen at M and ↶ Undo; give it the same tools if they fit (the server already takes `c`, and a doodle's clear doesn't free its 20 KB, DECISIONS 50)

- [ ] F31 Undo and clear
  - Spec: Canvas and drawing tools (Tools); Drawing data protocol (Ops and encoding)
  - Depends: F30, F12
  - Done when:
    - Undo back to empty; Clear undoable; the Screen redraws on `u` and `c`
  - Tests: property test — random op sequences give identical action stacks on drawer, server and Screen models

- [ ] F32 Draw pad hardening
  - Spec: Canvas and drawing tools (Canvas model, Stopping scroll and zoom); UI by role and phase (Drawer phone)
  - Depends: F30
  - Done when:
    - Device-pixel-ratio sizing; coalesced events; first pointer only; `pointercancel`; Wake Lock while drawing; "Turn your phone upright"
    - No scroll and no overflow at 360 × 560, 390 × 664 and 412 × 780 with both toolbar rows; checked on a budget Android and an iPhone (Manual playtest checklist, drawing items)

## M6 — Screen and phone polish

- [ ] F33 Responsive Screen layouts
  - Spec: UI by role and phase (Screen)
  - Depends: F20
  - Done when:
    - Landscape and portrait layouts with the largest square canvas (near-square uses landscape with the minimum sidebar); portrait priority as specified; `/playtest` screenshots at 1920×1080, 1366×768, 820×1180, 1180×820, 390×844 and 844×390 show no overflow and legible text

- [ ] F34 Announcements, reactions and feed UI
  - Spec: Guess matching (After a correct guess, Guess feed and rude guesses); UI by role and phase (Screen, Guesser phone)
  - Depends: F15, F33
  - Done when:
    - "Jun got it!" in the sidebar or top bar, never over the drawing; ✓ chips in turn order with this turn's points and no totals; reactions (rate-limited) floating from chips; wrong-guess speech bubbles (≤ 3 at once, 2 s); feed list; blanks with letter counts on one line

- [ ] F35 The reveal
  - Spec: UI by role and phase (Screen); Data model (Role views)
  - Depends: F34
  - Done when:
    - The word as the largest text on screen with the reveal sting; "Got it" chips in corrected order; "Almost:" up to three close and wrong guesses; "Walang nakakuha! 😱" with no points rows when nobody got it; no "+0" rows

- [ ] F36 Drawer feedback
  - Spec: UI by role and phase (Drawer phone); Data model (Role views)
  - Depends: F15, F30
  - Done when:
    - The drawer's top bar shows the latest wrong guess with the feed's masking and "Bea is close!" in amber for 2 s; "Start with one big shape. Anything helps!" if the pad has no ink 10 s in
  - Tests: `views.test.ts` — the drawer's view carries the latest guess; guessers' views don't

- [ ] F37 QR, tap-to-start, wake lock and connection dot
  - Spec: Roles and devices (Creating and joining a room); UI by role and phase (Screen, Guesser phone)
  - Depends: F33
  - Done when:
    - Lobby QR to `/play/:code`; Tap-to-start overlay with fullscreen and Wake Lock on the Screen; "Keep this device plugged in" on tablet and phone Screens; Wake Lock on phones during a game; connection dot and auto-reconnect

- [ ] F38 Sounds
  - Spec: UI by role and phase (Screen)
  - Depends: F34
  - Done when:
    - Screen sounds for join, your turn, correct, last 10 s, time up, reveal, final; Sound on / Quiet / Muted with `M`; phones vibrate on "your turn" only; Howler is a lazy chunk

- [ ] F39 Join budget
  - Spec: Tech stack and architecture (Performance budget); Test plan (Manual playtest checklist)
  - Depends: F37, F38
  - Done when:
    - `/play` and `/` ship ≤ 120 KB gzipped JS and ≤ 30 KB CSS and fonts; Screen, Howler, QR, gallery and DevBots are lazy chunks; no zod in the client bundle; one subset font with `font-display: swap`; WebSocket-first transport
    - Name field usable ≤ 5 s after scanning on "Slow 4G" with 4× CPU slowdown
  - Tests: `bundle.test.ts` — fails when the built player chunks exceed the budget

## M7 — Resilience

- [ ] F40 Drawer away
  - Spec: Game flow and state machine (Pausing); Reconnects, security and edge cases (Edge cases)
  - Depends: F28, F12
  - Done when:
    - `player:visibility` and disconnects schedule `drawerAwayCheck`; after 2 s still away sets `drawerAway`, with a "Mika's phone reconnecting…" badge before that; 30 s limit skips the turn; the pad is restored on return
  - Tests: `reducer.away.test.ts` — a 1 s blip pauses nothing

- [ ] F41 Screen away and too few players
  - Spec: Game flow and state machine (Pausing); Reconnects, security and edge cases (Edge cases)
  - Depends: F28
  - Done when:
    - `screenAway` after 3 s without a Screen in CHOOSING or DRAWING; `fewPlayers` below 2 connected; combined reasons resume only when all clear
  - Tests: `reducer.away.test.ts`

- [ ] F42 Rejoin by name from another phone
  - Spec: Roles and devices (Creating and joining a room); Reducer actions and effects (Actions); Reconnects, security and edge cases (Reconnects)
  - Depends: F25
  - Done when:
    - Joining with a disconnected player's name asks "Are you Jun? · Rejoin as Jun / Pick another name"; rejoining hands over pid, score and crown; the Screen shows "Jun is back (new phone)"; connected players' names stay blocked
  - Tests: `reducer.join.test.ts`

- [ ] F43 Reconnect every role
  - Spec: Reconnects, security and edge cases (Reconnects); Drawing data protocol (Reconnects and snapshots)
  - Depends: F40, F41
  - Done when:
    - Refreshing the Screen, the drawer and a guesser mid-turn each return to the right state, score, crown and drawing
  - Tests: `sockets.reconnect.test.ts`

- [ ] F44 Rate limits and limits
  - Spec: Reconnects, security and edge cases (Security); Drawing data protocol (Limits)
  - Depends: F43
  - Done when:
    - Every limit in Security and Limits is enforced with a friendly message on the client
  - Tests: `rateLimit.test.ts` cases for guesses, reactions, joins, ink

## M8 — Language and content

- [ ] F45 Taglish copy
  - Spec: UI by role and phase (Look and feel); Settings
  - Depends: F34
  - Done when:
    - Every phone and Screen string in `copy.ts` in English and Taglish, including the How to play strip, captions and awards; `copy` set in the lobby; Kim has reviewed the Taglish (logged in PROGRESS)
  - Tests: `copy.test.ts` — both tables have the same keys

- [ ] F46 Full family word packs
  - Spec: Words (Word pack format, Word selection)
  - Depends: F17
  - Done when:
    - ≥ 200 English and ≥ 200 Taglish/Filipino family words across difficulties 1–3, every one drawable; alternates for common spellings; glosses for `tl` difficulty 2–3; `npm run packs:check` passes; Kim has reviewed them

- [ ] F47 Spicy pack
  - Spec: Words (Word pack format)
  - Depends: F46
  - Done when:
    - "Pang-inuman" pack with ≥ 60 words (including `tagay`, `jowa`, `hangover`, `pulutan`, `inuman`, `sabit`, `lasing`), `rating: 'spicy'`, only dealt with `spicy` on; Kim has reviewed it

- [ ] F48 Custom words
  - Spec: Words (Custom words, Word selection)
  - Depends: F18, F25
  - Done when:
    - Lobby box on the token Screen and the crown phone; limits; one custom word in each set of three choices while any remain; never in a view except as a count
  - Tests: `reducer.customwords.test.ts`

## M9 — Gallery and awards

- [ ] F49 Gallery on the Screen
  - Spec: Drawing data protocol (Server relay and ink log, Reconnects and snapshots); UI by role and phase (Screen)
  - Depends: F29, F31
  - Done when:
    - FINAL lists every drawing; `ink:get` fetches each frozen log (Screen sockets only); the room memory cap drops the oldest with "Drawing not kept"
  - Tests: `inkGateway.test.ts` — a player socket's `ink:get` is refused

- [ ] F50 Tonight's awards
  - Spec: UI by role and phase (Screen, Guesser phone); Data model (Room state)
  - Depends: F49
  - Done when:
    - `TurnSummary` records correct times, close and wrong counts; entering FINAL computes the six awards, at most one per player, lowest-ranked first, skipping any nobody qualifies for
    - The Screen shows one card per award after the podium; each phone's FINAL leads with that player's award
  - Tests: `awards.test.ts`

## Barkada night release

The first real barkada night needs everything in M1–M9. The review's must-haves for that night: private guessing (F08, F10, F15, F18, F26), the frozen-drawer fixes (F18, F36), onboarding and lobby doodles (F26, F27), the host lobby (F25), the shorter game (F21, F22), the drawer layout (F08, F32), the reveal (F35), no running ranks (F20, F34), awards (F50), rejoin by name (F42), plus the gallery, custom words, the spicy pack, phone and tablet Screens and sounds. Play it on the LAN, or on the deployed URL after M10.

## M10 — Deploy

- [ ] F51 Docker image and smoke test
  - Spec: Tech stack and architecture; Ported from Buzzr
  - Depends: F44
  - Done when:
    - Dockerfile ported; `npm run smoke:docker` builds, runs and checks `/healthz`, the client and a WebSocket (including `/ink`)
    - The container listens on 3000 and binds `127.0.0.1:3006` on the host (PokéTrack has 3004, Buzzr 3005); 3006 confirmed free on the droplet (`ss -ltn`, 2026-10-30)
    - `mem_limit` set from the peak memory measured in a 10-player game with a full gallery, plus headroom; it must fit in the droplet's ~700 MB free alongside Buzzr's `384m`

- [ ] F52 Deploy to sketchy.kimnejudne.dev
  - Spec: Overview (Scope decisions); Ported from Buzzr
  - Depends: F51
  - Done when:
    - DNS already done: Namecheap A record `sketchy` → `165.245.189.5` (Oct 30, 2026)
    - `deploy/compose.deploy.yaml` and the nginx vhost (WebSocket upgrade for `/socket.io`, covering the `/ink` namespace; TLS via certbot) for `sketchy.kimnejudne.dev`; separate container, port and env from Buzzr
    - `.github/workflows/deploy-sketchy.yml` modelled on `deploy-buzzer.yml`, keeping its job names (`checks`, `droplet`), step names (`typecheck`, `lint`, `format check`, `tests`, `build and smoke-test the image`) and the `ABORT: N live connection(s) after 10 min` message, which autopilot matches on: runs only on pushes touching `sketchy/`; checks on the runner; ships the verified image over ssh as the unprivileged `deploy` user; keeps the previous release for rollback; smoke checks the live URL (`/healthz`, the client, both Socket.IO namespaces)
    - Rooms live in memory, so the deploy waits until no game is live, with a `force` input to override (as Buzzr's "wait for live games" step)
    - `sketchy/README.md` runbook: deploy, rollback, port, env and the break-glass manual steps
    - Root `README.md`: a Sketchy row in the table and "Three" becomes "Four"; no hub link yet (see Backlog)
    - Autopilot push and deploy: already in `scripts/autopilot.sh` (it pushes and watches `deploy-sketchy.yml` once nothing is left to build)
    - Droplet root setup done in the bootstrap (2026-10-30): `/opt/sketchy` (root:deploy, sticky) with `.env` (`IMAGE_TAG=`), the nginx vhost and the certbot certificate; the live vhost is committed at `deploy/nginx/sketchy.conf` (with `sketchy-bootstrap.conf`); keep them in step with the box
    - The full Manual playtest checklist passes on the deployed URL with phones on mobile data

## Bugs

## Backlog

- Server-wide cap on live rooms (503 past it), so many addresses creating rooms can't grow memory for 3 h each (F03 review).
- PNG download of a gallery drawing: 1024 × 1024 plus a caption band "tsinelas · by Mika · Sketchy", saved as `sketchy-<code>-<nn>-<word>.png` (deferred by the spec review: people photograph the TV).
- `drawer:choose` with an optional `turnId`, refused when it doesn't match the open choice, so a late duplicate tap from one CHOOSING can't pick the next `upcoming` deal when the sole connected player draws back-to-back (F21 review).
- The next drawer's phone: a one-line "It was {word}" strip above the "You draw next!" cards, and focus moved to the cards' heading on mount and to the "Get ready" line after a tap (F21 review).
- A per-socket rate limit on `host:settings` (host-only and a cheap merge, but each one broadcasts every view) (F22 review).
- A permanently mounted `role="status"` region on the Screen and phone for the pause reason, so "Paused" is announced reliably rather than mounting with its text; and a way out (Leave) for a guesser stuck in a long `drawerAway`/`fewPlayers` pause (F28 review).
- Screen: dim the Tonight rows of players who have left; on a 4:3 Screen the host bar wraps to two rows and covers the Tonight strip until it auto-hides; the rematch countdown should use the same permanently mounted status region as "Paused" (F29 review).
- Per-socket cap on all `player:*` events in the gateway, so refused actions (empty guesses, `alreadyGuessed`) can't be spammed at the reducer's clone cost (F14 review).
- Case study and the kimnejudne.dev hub link, after the Barkada night (as Buzzr: live first, listed on the hub once its case study is written).
