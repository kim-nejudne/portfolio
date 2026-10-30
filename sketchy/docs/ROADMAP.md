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

- [ ] F09 Dev tool: fake players
  - Spec: Ported from Buzzr; Test plan (Automated tests)
  - Depends: F07, F08
  - Done when:
    - `/dev/bots/:code` (only when `NODE_ENV !== 'production'`) adds N bots that guess random words; a dev-only `GET /api/dev/rooms/:code/word` lets a bot guess right on demand; one bot can draw a scripted doodle as the drawer
    - **M1 acceptance:** a laptop Screen and 3 real phones on the LAN play a full cycle; every player draws once; the drawing appears live on the Screen; correct guesses score

## M2 — Fair and secret

- [ ] F10 Secrecy leak tests
  - Spec: Data model (Role views); Reconnects, security and edge cases (Security)
  - Depends: F05, F06
  - Done when:
    - A scripted game visits every phase; every ScreenView, guesser PlayerView and crown PlayerView is serialised and checked: no word, alternate, gloss or choice before REVEAL, including for a guesser who already guessed correctly
    - A socket test confirms `/ink` events reach only Screen sockets (and the drawer's own snapshot)
  - Tests: `views.leak.test.ts`, `inkGateway.test.ts`

- [ ] F11 Ink codec and action stack
  - Spec: Drawing data protocol (Ops and encoding, Drawer client)
  - Depends: F06
  - Done when:
    - `shared/ink.ts`: encode/decode, delta encoding, 3-unit radial filter, RDP at ε = 1 keeping endpoints, action stack with `u` and `c`
    - Drawer, server and Screen all use it
  - Tests: `ink.test.ts` — round-trip, simplification keeps endpoints and stays within ε, undo/clear sequences, undo of a clear restores strokes

- [ ] F12 Ink sequence, resend and snapshots
  - Spec: Drawing data protocol (Server relay and ink log, Reconnects and snapshots, Limits)
  - Depends: F11
  - Done when:
    - `InkStore` per turn; `seq` checks with `ink:resend`; `ink:sync` and resend from the drawer's kept batches; `ink:hello` → `ink:snapshot` for Screens and the current drawer only; size caps and batch limits
  - Tests: `inkStore.test.ts`; `inkGateway.test.ts` — a Screen reconnecting mid-turn rebuilds the exact action stack; a dropped drawer resends without duplicates

- [ ] F13 Latency-corrected scoring
  - Spec: Scoring and timing (Points, Worked examples, Latency correction)
  - Depends: F04, F05
  - Done when:
    - `fairness.ts` ported (cap 250 ms); phones ping every 2 s; guesses carry `receivedAt` and `oneWayMs`; `scoring.ts` implements both formulas; 300 ms grace window
  - Tests: `scoring.test.ts` — all four worked examples exactly; cap applied; guess in the grace window accepted when corrected time ≤ `endsAt` and rejected otherwise; `fairness.test.ts` ported

- [ ] F14 Guess matching
  - Spec: Guess matching (Normalization, Accepting a guess, Near misses)
  - Depends: F04
  - Done when:
    - `match.ts` with `normalize`, `isCorrect`, `isClose`; English plural rule; the reducer uses it; rate limit 1 per 700 ms
  - Tests: `match.test.ts` — every row of the matcher table in Test plan

- [ ] F15 Near-miss feedback and the guess feed
  - Spec: Guess matching (After a correct guess, Guess feed and rude guesses); Data model (Role views)
  - Depends: F14
  - Done when:
    - `fx nearMiss` to the guesser only; close guesses kept in `closeGuesses` (max 3) and counted per player, never in a view before REVEAL
    - Feed in ScreenView without close or correct guesses; `guessFeed` `'all'` masks slurs (`slurs.ts`), `'clean'` also masks profanity (`profanity.ts`), `'off'` hides it
    - A correct guesser's phone shows ✓ and points, never the word
  - Tests: `reducer.guess.test.ts` — close guess not in the feed; masked guess shows `null` under each mode; `profanity.test.ts`

- [ ] F16 Ink delay debug overlay
  - Spec: Drawing data protocol (Delay budget); Test plan (Ink delay measurement)
  - Depends: F12, F13
  - Done when:
    - With `?debug=1` on the drawer and the Screen, batches carry the drawer's send time; `pong` carries server time; the Screen shows p50/p95 delay over the last 200 batches and each player's RTT
  - Tests: unit test of the clock-offset estimate

## M3 — Game shape

- [ ] F17 Word packs and loader
  - Spec: Words (Word pack format, Sample English words, Sample Taglish and Filipino words)
  - Depends: F02
  - Done when:
    - zod pack schema including `gloss` (required for `tl` words of difficulty 2–3); `data/packs/` loaded at start; an invalid pack stops the server with a readable error; the two sample packs (30 words each) ship
    - `npm run packs:check` validates every pack with the same schema and reports duplicate words across packs
  - Tests: `packs.test.ts` — valid packs load; duplicate ids, a long word, an unknown language and a missing required gloss each fail with a clear message

- [ ] F18 Deck and word choice
  - Spec: Words (Word selection); Game flow and state machine (Transitions); UI by role and phase (Drawer phone)
  - Depends: F17, F04
  - Done when:
    - CHOOSING phase: 3 choices (easy, medium, hard in Mixed; three easy in Easy), `drawer:choose {index: 0|1|2}`, `chooseUp` after 12 s picks the easiest; only the chosen word goes into `usedIds`, the others to the bottom of the deck; reshuffle when empty; the language and difficulty settings filter the deck
    - Drawer phone shows three word cards with their gloss and "Hold your phone close 🤫"; Screen and guessers show "Mika is choosing…"
  - Tests: `deck.test.ts` — no repeats until exhausted, choice levels, filters; `reducer.choosing.test.ts` — auto-pick is the easiest

- [ ] F19 Hints and early end
  - Spec: Scoring and timing (Timing and hints)
  - Depends: F18
  - Done when:
    - Hints at 50% and 75%, ⅓ cap, none under 4 letters; mask shows them; `allGuessed` ends the turn 1.5 s after the last eligible guesser; a join during that window doesn't cancel it
  - Tests: `reducer.hints.test.ts` — caps; disconnected players don't block early end

- [ ] F20 Cycles, scoreboard and final
  - Spec: Game flow and state machine (Phases, Turn order); UI by role and phase (Screen)
  - Depends: F18
  - Done when:
    - `cycles` setting; SCOREBOARD between cycles; `autoAdvance` and `host:next`; FINAL with shared ranks (ported `ranking.ts`)
    - Total scores and ranks appear only in SCOREBOARD and FINAL views; during a turn views carry this turn's points
  - Tests: `reducer.flow.test.ts` — 3 players × 2 cycles visits the right phases in order

- [ ] F21 Overlapped choosing
  - Spec: Game flow and state machine (Phases, Transitions, Scheduled effects); Data model (Room state, Role views)
  - Depends: F20
  - Done when:
    - Entering REVEAL deals the next turn as `upcoming`; its drawer chooses during REVEAL and SCOREBOARD; REVEAL lasts 8 s; at the end, a chosen word goes straight to DRAWING, otherwise CHOOSING until 12 s after the deal
    - The upcoming drawer leaving, kicked or disconnected discards the deal and deals the following player; `chooseUp` survives phase changes and pauses
    - The upcoming drawer's phone shows "You draw next! Pick a word" during the reveal
  - Tests: `reducer.overlap.test.ts` — choose during REVEAL then DRAWING at once; no choice → CHOOSING; auto-pick during SCOREBOARD; upcoming drawer leaves; `views.leak.test.ts` covers `upcoming`

- [ ] F22 Settings and presets
  - Spec: Settings; Reducer actions and effects (Actions)
  - Depends: F20
  - Done when:
    - `host:settings` with validation (`drawSeconds` 45/60/80/100, default 60); presets are a client-side shortcut sending `host:settings`; Screen lobby settings panel; only `guessFeed` changeable mid-game
  - Tests: `reducer.settings.test.ts`

- [ ] F23 Late join and turn order
  - Spec: Game flow and state machine (Turn order); Reconnects, security and edge cases (Edge cases); UI by role and phase (Guesser phone)
  - Depends: F21
  - Done when:
    - Mid-game joiners can guess at once and land on the guess box with "You're in! Mika is drawing. Type your guess."
    - A joiner is appended to this cycle if at least one turn remains after the current one, otherwise draws from the next cycle; in the last cycle they only guess
    - Disconnected players are skipped when their turn comes and draw again from the next cycle; leaving removes them from the order
  - Tests: `reducer.turnorder.test.ts`

## M4 — Host and onboarding

- [ ] F24 Screen host controls and shortcuts
  - Spec: UI by role and phase (Host controls)
  - Depends: F22
  - Done when:
    - Control bar (auto-hide) and every shortcut on the `?` overlay, only when the Screen holds the token; `G` cycles All → Clean → Off

- [ ] F25 Host crown and the host lobby
  - Spec: Roles and devices (Host crown); UI by role and phase (Screen, Host controls)
  - Depends: F24
  - Done when:
    - First joiner is crowned; `host:crown` from the Screen or the holder; the crown passes on leave or kick; crown actions authorised on the player socket
    - The crown holder's lobby is the host view: "You're the host 👑", big Start (disabled below 2 players), settings summary with Change; "You're the host now 👑" toast when the crown moves
    - Screen lobby with the token shows "👑 Mika is hosting · tap a name to change"
    - The phone's controls drawer per phase once the game has started
  - Tests: `reducer.crown.test.ts`; leak test covers the crown holder's view

- [ ] F26 How to play and first-turn captions
  - Spec: UI by role and phase (Screen); Overview (Goals)
  - Depends: F07
  - Done when:
    - Screen lobby shows the three-step How to play strip under the QR
    - First two turns of every game show the caption under the drawing ("Mika is drawing. Everyone else: type your guess on your phone 🤫", then "Type your guess. Don't say it! 🤫")

- [ ] F27 Lobby doodles
  - Spec: Drawing data protocol (Lobby doodles); Roles and devices (Creating and joining a room); UI by role and phase (Screen, Guesser phone)
  - Depends: F12, F08
  - Done when:
    - In LOBBY each phone shows the doodle pad under "Doodle yourself while you wait!"; `doodle:batch` accepted only in LOBBY, 20 KB per player, relayed to Screens only
    - The doodle is the player's avatar on every Screen chip for the session; a Screen joining later gets doodles in its snapshot; leaving drops it
  - Tests: `inkGateway.test.ts` — doodles never reach a phone; refused outside LOBBY; size cap

- [ ] F28 Pause, skip, kick and end
  - Spec: Game flow and state machine (Pausing, Transitions); Reducer actions and effects (Actions); UI by role and phase (Guesser phone, Host controls)
  - Depends: F25
  - Done when:
    - `host` pause reason with remaining-time restore and the 3-2-1 resume; `host:skip` in CHOOSING and DRAWING; kick (including the drawer); `host:end` from any game phase; points earned so far stay
    - Kick takes two taps ("Remove Jun?"); Leave takes two taps and mid-game says "Your points will be lost"; the kicked phone shows "You were removed from this game"
  - Tests: `reducer.pause.test.ts` — paused time doesn't count towards `t`; stale timers after pause are ignored; `reducer.host.test.ts`

- [ ] F29 Rematch, back to lobby and the night's totals
  - Spec: Game flow and state machine (Transitions, Scheduled effects, Turn order); UI by role and phase (Screen, Host controls)
  - Depends: F28
  - Done when:
    - Back to lobby: FINAL → LOBBY keeps players, settings, custom words, doodles and `usedIds`; `session.totals`; Tonight panel from game 2
    - Rematch: two taps, 3-2-1 countdown on every device, then CHOOSING with the next player in join order drawing first; Cancel leaves FINAL and the gallery untouched; fewer than 2 connected at the end of the countdown stays on FINAL with "Need 2 players"
  - Tests: `reducer.newgame.test.ts` — no word repeats across two games; `reducer.rematch.test.ts` — rotation over three rematches, including when last game's first drawer has left; cancel keeps scores and gallery; a stale `rematchGo` after cancel does nothing; fewer than 2 connected

## M5 — Drawing tools

- [ ] F30 Colours, sizes and eraser
  - Spec: Canvas and drawing tools (Tools, Rendering); UI by role and phase (Drawer phone)
  - Depends: F11
  - Done when:
    - Two toolbar rows: 8 colour swatches (40 px, 44 px hit area); one size button cycling S/M/L, Eraser, Undo, Clear; quadratic smoothing on drawer and Screen via one shared `drawStroke`

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
- Case study and the kimnejudne.dev hub link, after the Barkada night (as Buzzr: live first, listed on the hub once its case study is written).
