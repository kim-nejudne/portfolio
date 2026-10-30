# Sketchy — Spec Review

Oct 30, 2026 · Review of `docs/spec.md` (Oct 30, 2026) from a party-game design point of view. No spec changes yet; each finding proposes the text the spec should say instead.

> **Applied Oct 30, 2026.** Kim accepted all 20 findings, and they are now in `docs/spec.md` and `docs/ROADMAP.md`, which was split out of the spec and renumbered. Kim's answers to the questions at the end:
>
> 1. The drawer's share stays at 50%, to be tuned after the first night.
> 2. The first joiner gets the crown. There is no "Scan to host" QR.
> 3. No "Letters!" reaction.
> 4. The iOS floor goes up to 16.4.
> 5. All six awards stay, Modern art included.
> 6. Late joiners in the last round only guess.
> 7. `guessFeed` keeps `'clean'`.
> 8. The spicy pack gains `pulutan`, `inuman`, `sabit` and `lasing`.

Ground rules agreed before writing:

- Items marked **[decided]** in the spec can be challenged. Findings that do so say **Reverses [decided]**.
- **Typing is the game.** Guesses stay private; the design should make typing, not shouting, the natural move.
- **Competition is softened.** Scores still decide the winner, but rank isn't on screen every turn.
- Target: a **~10-minute default game** that groups play two or three times a night.
- "First playable version" means **the version Kim brings to a real barkada night**, not the M1 dev slice. The gallery, custom words, the spicy pack, phone and tablet Screens and sounds are already must-haves.

## Verdict

The technical core is excellent. The secrecy model (only the drawer sees the word, only the Screen gets ink), the `/ink` channel with snapshots and resend, latency-corrected scoring with a grace window, the pure reducer with epoch-guarded timers, and automatic pauses are all better thought through than most shipped party games. The word packs have real local flavour, and the "everyone looks up at the Screen" decision is right for a living room.

The weak side is the room itself. The spec is written as if each player sits alone with their phone. Three risks to the game being fun:

1. **The living room breaks private guessing.** People shout answers and read each other's phones. The spec shows the word in large type on the drawer's phone and on every correct guesser's phone, and never tells anyone to type rather than say. Once one person says "TSINELAS!", speed scoring rewards whoever sits closest. (Findings 1, 3)
2. **Dead air, and the big moments are small.** Every turn starts with up to 10 s of "Mika is choosing…". The reveal, the biggest laugh, lasts 6 s and shows a points table. Wrong guesses, the main comedy, are small lines in a sidebar. The default game runs about 15 minutes. (Findings 6, 8, 9)
3. **First-timers freeze at the pad.** Nobody touches the draw pad before their turn. The first drawer gets two words they may not know, 10 s to pick, a toolbar they've never seen, and no way out. The room then stares at a blank white square for up to 80 s. (Findings 2, 3, 7)

## Walkthroughs

Short notes from each point of view. Numbers refer to the findings below.

**The person setting up the Screen.** Opens the site on the laptop, taps Start, taps through the overlay and plugs in the TV. Fine so far. Then they reach for their own phone, but whoever scans the QR first already holds the crown and doesn't know it (4). The token Screen offers nine settings with no hint that the defaults are fine (4). On a tablet or spare phone the lobby says "stay plugged in", which is good.

**A first-time player on a budget Android over mobile data.** Scans the QR. The spec sets no size or load-time target for the player page, so the 15-second join depends on luck (5). Name, one button, in: good. Then 1–3 minutes of a waiting screen with nothing to do (3). In turn 1 they see a guess box and blanks and work it out, but nothing tells them to type rather than shout, or that faster means more points (1, 3). If their phone dies and they borrow one, their own name is taken by their ghost (15).

**The drawer.** Vibrate, "Your turn!": good. Two words they may not recognise ("sungka", "salakot"), 10 s to choose (2). The word is printed in big letters that the next person on the couch can read (1). They see the toolbar for the first time with the clock running (3). On a 360 × 640 phone the pad and three toolbar rows don't fit under Chrome's address bar (7). They're looking down, so they never see the wrong guesses that would tell them what to fix (10). One Wi-Fi blip pauses the whole room (14). If nobody gets it, the TV shows "Mika ✏️ +0" (8).

**A guesser who keeps falling behind.** Their phone shows "You: 140 · 5th of 5" all game (12). Their funny wrong guesses scroll past in small sidebar text (9). The final screen lists them 5th with nothing else to take home (13). Things that already help: every correct guess is worth at least 100, hints arrive at 50% and 75% of the time, and near-miss toasts are private.

**The host who also plays.** Their phone shows the same lobby as everyone else, with a small 👑 Host button. Start is inside that drawer, so the room waits for a host who doesn't know they're hosting (4). Mid-game, skipping a stuck drawer means opening the drawer and tapping twice while also trying to guess: acceptable. "Kick" sits next to "Give crown" on the Screen's chip menu, one mis-tap away (20).

## Findings

Ordered by severity. Each finding names the spec section(s) it changes.

### Must fix before building

#### 1. Shouting and peeking break private guessing

- **Where:** Overview (Goals); Guess matching (After a correct guess); Data model (Role views); UI by role and phase (Screen, Drawer phone, Guesser phone); Open questions 3.
- **What happens in the room:** Jun figures it out and says "tsinelas!" out loud, or types it and his phone flashes a green "Nakuha mo! +270 · TSINELAS" that Ana, next to him, can read. Ana types it two seconds later and gets 265 points for sitting next to Jun. The drawer's "Draw: TSINELAS" header is just as readable from the next seat. The spec never tells players that guesses are typed, so first-timers assume shouting is the game.
- **Proposed change:**
  - Add a Goal: *"7. Guesses are private. The design makes typing, not saying, the obvious move: the rule is taught on the Screen, and no phone except the drawer's shows the word before the reveal."*
  - Role views: change the `word` during DRAWING row to ✗ for guessers in all cases. After a correct guess the phone shows *"✓ Nakuha mo! +270"* with no word; everyone sees the word at the reveal. This closes Open question 3 and simplifies the leak tests (no per-guesser exception).
  - Screen: during the first two turns of every game, a caption under the drawing reads *"Type your guess. Don't say it! 🤫"* (Taglish: *"I-type, 'wag isigaw! 🤫"*). It also appears in the lobby's How to play strip (finding 3).
  - Drawer phone: the word is large on the choosing cards and **small (≈ 16 px) in the top bar while drawing**, with the line *"Hold your phone close 🤫"* on the choosing screen. No extra taps.
  - Shouting stays undetectable and becomes a funny foul. No penalty mechanic.

#### 2. A frozen drawer has no way out

**Reverses [decided]:** "The drawer picks 1 of 2 words within 10 s."

- **Where:** Overview (Scope decisions: Word choice); Words (Word selection, Word pack format); Data model (Room state, Role views); UI by role and phase (Drawer phone); Reducer actions and effects (Actions).
- **What happens in the room:** A first-time drawer is dealt "sungka" and "harana". They don't know what a sungka looks like and can't think how to draw a serenade. They pick one at random at second 9 and stand there. Nobody can skip except the host, who doesn't realise they could. The room watches a blank square for 80 s, and the drawer feels stupid in front of their friends.
- **Proposed change** (no drawer skip; the host's Skip stays the only exit, as Kim decided):
  - Scope decisions, Word choice: *"The drawer picks 1 of 3 words within 12 s: one easy, one medium, one hard when the deck has them (three easy words under `difficulty: 'easy'`). If time runs out, the **easiest** word is picked, not a random one. No skips."*
  - `Turn.choices: [WordEntry, WordEntry, WordEntry]`; `drawer:choose {index: 0 | 1 | 2}`. Custom words: one of the three is custom while any remain.
  - Word pack format gains `gloss`: *"Optional, 1–40 characters, English. A plain description for the drawer only, e.g. `salakot` → `wide woven farmer's hat`. Required for `language: 'tl'` words of difficulty 2–3; the loader rejects a pack missing one."* The drawer's cards show the gloss under each word.
  - Role views and Security (Word secrecy): `gloss` joins `alt` as never sent to the Screen or guessers; the drawer gets it with `choices` and `word`. The leak tests cover it.
  - Drawer phone: if the pad has no ink 10 s into DRAWING, show *"Start with one big shape. Anything helps!"* above the pad. It disappears on the first stroke.

#### 3. Nobody explains the game, and the lobby is dead time

- **Where:** Roles and devices (Creating and joining a room); UI by role and phase (Screen lobby, Guesser phone lobby); Drawing data protocol (Why a separate channel); Open questions 9.
- **What happens in the room:** Players join and stare at "Waiting for 👑 Mika to start" for one to three minutes while the last friend finds the QR. Nobody has touched the draw pad. Nobody knows that faster guesses score more, that the drawer scores when people get it, or that guesses are typed.
- **Proposed change:**
  - Screen lobby: a **How to play** strip under the QR, three icons with at most six words each: *"1 · One person draws on their phone" "2 · Everyone else types guesses 🤫" "3 · Faster = more points"*. Same strip in the Taglish copy.
  - **Lobby doodle** (closes Open question 9): after joining, each non-host phone shows the draw pad with *"Doodle yourself while you wait!"* It's optional and never blocks anything. The doodle becomes that player's avatar on the Screen's chips for the night (lobby, sidebar, reveal, podium). It teaches the pad before anyone's first turn.
  - Drawing data protocol, add an exception: *"In LOBBY, `/ink` accepts `doodle:batch` from any joined player socket (same codec, sent on stroke end only, max 20 KB per player) and relays it to Screens only. Doodles never go to other phones. They are kept per player in InkStore for the session and dropped when the player leaves."*
  - Screen, first turn of each game: the caption from finding 1 reads *"Mika is drawing. Everyone else: type your guess on your phone 🤫"*.

#### 4. The crown holder doesn't know they're hosting

- **Where:** Roles and devices (Host crown); UI by role and phase (Screen lobby, Guesser phone lobby, Host controls).
- **What happens in the room:** Ana scanned first, so she has the crown. Her phone looks like everyone else's apart from a small 👑 Host button. The TV says "Waiting for 👑 Ana to start", and Ana, a first-timer, waits too. Start is hidden inside a drawer behind a button she has no reason to press. Meanwhile the person who set up the laptop, who knows the game, is still plugging in the HDMI.
- **Proposed change:**
  - Host controls, LOBBY row: *"On the crown holder's phone, the lobby view itself is the host view: a big **Start game ▶** (disabled with 'Need 2 players' below 2), above it 'You're the host 👑', and under it a one-line settings summary ('Classic · 60 s · 2 rounds · Mixed words · Change'). The controls drawer is used only once the game has started."* The crown holder still gets the doodle pad (finding 3), below Start.
  - When the crown moves, the new holder's phone shows a toast: *"You're the host now 👑"*.
  - Screen lobby, with the token: *"👑 Ana is hosting · tap a name to change"*.
  - Settings stay collapsed behind "Change". The defaults are good enough that most hosts never open them.

#### 5. The 15-second join has no budget behind it

- **Where:** Overview (Goals 1); Tech stack and architecture; Test plan (Manual playtest checklist).
- **What happens in the room:** A budget Android on mobile data scans the QR, and Chrome opens a cold tab. It then downloads, parses and runs React, React Router, Socket.IO, zod, Zustand, Tailwind CSS and a display font, then Socket.IO does a long-polling handshake before upgrading to WebSocket. Nothing in the spec stops the player bundle from also pulling in the Screen's Howler, QR code and gallery code. On a slow phone that can take most of the 15 seconds before the name field appears.
- **Proposed change:** add a **Performance budget** subsection under Tech stack:
  - *"`/play` and `/` together ship ≤ 120 KB of gzipped JavaScript and ≤ 30 KB of CSS and fonts. The Screen page, Howler, `qrcode.react`, the gallery and DevBots are separate lazy chunks that the player page never loads. The client doesn't bundle zod; schemas are checked on the server."*
  - *"Fonts: one subset weight (Latin), `font-display: swap`, preloaded."*
  - *"Socket.IO clients use `transports: ['websocket']` and fall back to polling only if the WebSocket fails."*
  - Test plan: *"From QR scan to a usable name field in ≤ 5 s, and to the lobby in ≤ 15 s including typing a name, on a budget Android over mobile data (or Chrome DevTools 'Slow 4G' with 4× CPU slowdown). Check it in CI with a bundle-size test."*

#### 6. The default game is too long and too full of waiting

- **Where:** Game flow and state machine (Phases, Transitions, Scheduled effects, Turn order); Scoring and timing (Timing and hints); Settings.
- **What happens in the room:** Each turn opens with up to 10 s of "Mika is choosing a word…" on the TV, then 80 s of drawing, though in a room most drawings are guessed in 20–40 s or not at all. The reveal, the moment people want to laugh at, gets 6 s before the room is waiting again. Five players take about 15 minutes per game, which is too long for a first game and makes a second one less likely.
- **Proposed change:**
  - Settings: `drawSeconds: 45 | 60 | 80 | 100`, **default 60**. Presets: Quick 45 s × 1 round (≈ 4–5 min), **Classic 60 s × 2** (≈ 10 min), Barkada Night 80 s × 3 (≈ 20 min). Hints stay at 50% and 75% (30 s and 45 s by default).
  - **Overlap choosing with the reveal.** Phases and Transitions: *"Entering REVEAL deals the next drawer's three words at once. The next drawer chooses on their phone while the Screen shows the reveal. REVEAL lasts 8 s. When it ends: if the next drawer has chosen, go straight to DRAWING; if not, the Screen shows 'Jun is choosing…' until they choose or 12 s have passed since the deal (auto-pick: the easiest word). `drawer:choose` is allowed from the next drawer during REVEAL and SCOREBOARD. `host:next` ends the reveal early, not the choice."* The same applies to SCOREBOARD. Only the very first turn of a game has a standalone CHOOSING.
  - Turn order, Game length: *"5 players × 2 rounds = 10 turns of about 8 s reveal + 0–4 s choosing wait + 30–60 s drawing, plus one scoreboard: about 10 minutes, at most 12."*
  - Fixed constants: reveal 8 s, choosing 12 s (from the deal).

#### 7. The drawer's phone doesn't fit on a budget Android

- **Where:** UI by role and phase (Drawer phone); Canvas and drawing tools (Canvas model, Tools); Build roadmap (F08, F29).
- **What happens in the room:** A common budget Android has a 360 × 640 CSS-pixel screen. Under Chrome's address bar about 360 × 560 is left. The wireframe stacks a header, a 360 px pad, three toolbar rows of 44 px and a status line: about 560 px with no margins. Eight 44 px swatches are 352 px wide with no gaps. In practice something overflows, the page scrolls, and the scroll lock fights it. A developer has to guess what to shrink.
- **Proposed change:** add a **Drawer layout** subsection under Drawer phone:
  - *"Minimum supported viewport: 360 × 560 CSS px. From top: a 56 px bar (word, small; timer; '2 of 4 got it'; one line of the latest guess, see finding 10), the pad, then exactly two toolbar rows of 48 px. Pad size = min(viewport width − 8, viewport height − 56 − 2 × 48 − 16)."*
  - *"Row 1: the 8 colour swatches, each a 40 px circle with a 44 px hit area. Row 2: one size button that cycles S/M/L (shown as a dot of that size), Eraser, Undo, Clear."*
  - Acceptance for F08 and F29: *"No scroll and no overflow at 360 × 560, 390 × 664 (iPhone with Safari bars) and 412 × 780."*

### Should fix

#### 8. The reveal buries the biggest laugh

- **Where:** UI by role and phase (Screen: Reveal; Guesser phone); Data model (Turn, Role views); Guess matching (Near misses).
- **What happens in the room:** The word appears and everyone shouts "TSINELAS?! Akala ko sapatos!" The TV shows the word in sidebar text and a points table, and the funniest near-misses have already vanished. When nobody got it, the table reads "Mika ✏️ +0", so a friend is publicly scored zero.
- **Proposed change:** Reveal on the Screen:
  - *"The drawing stays where it is. The sidebar shows 'It was…' and then the word as the largest text on screen (≥ 12 vh), with an entrance pop and the reveal sting."*
  - *"Below it: 'Got it' chips in order with points, then 'Almost:' up to three guesses. Close guesses come first, then the most recent wrong ones. Both are safe to show now that the word is public."*
  - *"If nobody got it, the headline is 'Walang nakakuha! 😱' / 'Nobody got it!' and no points rows are shown. A drawer line ('+320 for Mika's drawing') appears only when it's above 0."*
  - Data: `Turn.closeGuesses: FeedItem[]` (max 3, kept server-side, sent only in REVEAL and later).

#### 9. Wrong guesses are too small to be funny

- **Where:** Guess matching (Guess feed and rude guesses); UI by role and phase (Screen: Drawing).
- **What happens in the room:** Carlo guesses "kabaong" for a drawing of a tabo and it shows as a small line in the sidebar. Half the room doesn't see it before it scrolls away. On a phone used as the Screen there are two lines of feed.
- **Proposed change:** *"Each wrong guess also pops out as a speech bubble from the guesser's chip in their colour, at ≥ 5 vh, for 2 s, never over the drawing. At most three bubbles at once; extras go straight to the list. The sidebar list stays as the record."*

#### 10. The drawer can't see the guesses

- **Where:** Data model (Role views); UI by role and phase (Drawer phone).
- **What happens in the room:** Mika is looking down at her pad. Everyone is typing "sapatos", but the feed is only on the TV behind her, so she keeps adding detail to the wrong part of the drawing.
- **Proposed change:** Role views: *"The drawer's PlayerView gets the latest wrong guess and close-guess alerts during DRAWING (the drawer knows the word, so nothing leaks)."* Drawer phone: the top bar's second line shows the latest wrong guess (*"Bea: sapatos"*) and, for a close guess, *"Bea is close!"* in amber for 2 s. The same masking rules apply as on the Screen.

#### 11. Masking rude guesses kills the night's best laugh

**Reverses [decided]:** "Wrong-guess feed: on the Screen, filtered."

- **Where:** Guess matching (Guess feed and rude guesses); Settings; Reconnects, security and edge cases (Security).
- **What happens in the room:** In a barkada, the rude wrong guess is often the moment everyone remembers. "Carlo: •••" gets a smirk; the real word gets the room.
- **Proposed change:**
  - *"`guessFeed: 'all' | 'clean' | 'off'`, default **'all'**. 'all' masks only slurs and hate terms (`server/slurs.ts`, English and Tagalog, letter swaps as before). 'clean' also masks ordinary profanity (the current list) for family nights. 'off' hides the feed."* Changeable any time, `G` cycles it.
  - Edge cases, Rude guesses: rewrite to match. The room-code blocked list is unchanged.

#### 12. Running ranks make it feel like an exam

- **Where:** Data model (Role views); UI by role and phase (Screen: Drawing; Guesser phone); Edge cases.
- **What happens in the room:** Every turn the TV re-sorts the scoreboard while people draw, and each phone reminds its owner they're "5th of 5". The tense race the brief wants to avoid is on screen all game.
- **Proposed change:**
  - Screen during DRAWING: *"Players are listed in turn order (stable positions, ✏️ on the drawer) with ✓ and this turn's points (+270) after a correct guess. No totals or ranks."*
  - Phones during CHOOSING, DRAWING and REVEAL: *"+270 this turn"*, no rank. Role views: the "own score, rank" row applies only to SCOREBOARD and FINAL.
  - SCOREBOARD (after each round) and FINAL keep the full ranking, so people still know where they stand.

#### 13. Bad drawers and last place go home with nothing

- **Where:** Scoring and timing (Points); UI by role and phase (Screen: Final; Guesser phone); Data model (TurnSummary).
- **What happens in the room:** Bea can't draw and types slowly. She finishes 5th, listed below the podium, and her phone says "5th of 5". She was the funniest person in the room and nothing on screen says so.
- **Proposed change:** add **Awards** to FINAL:
  - *"After the podium, the Screen shows Tonight's awards, one card per award, computed from the game: 🎨 Picasso (most drawer points), ⚡ Bilis! (fastest correct guess), 🎯 Sharpshooter (most correct guesses), 😅 Malapit na! (most close guesses), 🤪 Most creative (most wrong guesses), 🖼️ Modern art (the drawing nobody got). Each player gets at most one award. Awards are assigned lowest-ranked player first where they qualify, and an award nobody qualifies for is skipped."*
  - Each phone's FINAL screen leads with that player's award, then their rank.
  - Data: `TurnSummary` gains `correct: {pid, elapsedMs}[]`, `close: Record<pid, number>` and `wrong: Record<pid, number>`.

#### 14. One network blip pauses the whole room

- **Where:** Game flow and state machine (Pausing); Reconnects, security and edge cases (Edge cases); Tech stack and architecture.
- **What happens in the room:** The drawer's phone switches from Wi-Fi to mobile data for a second, and every device shows "Paused" and a 3-2-1. That's six people interrupted for a hiccup the ink resend already handles. Going the other way, Socket.IO's defaults (`pingInterval` 25 s, `pingTimeout` 20 s) mean a phone that silently drops off may not count as disconnected for up to 45 s.
- **Proposed change:**
  - Pausing, `drawerAway`: *"Set only when the drawer has been disconnected or hidden for `DRAWER_AWAY_DEBOUNCE_MS` (2 s). During the debounce the clock keeps running and the Screen shows a small 'Mika's phone reconnecting…' badge."*
  - Tech stack: *"Socket.IO server `pingInterval: 5000`, `pingTimeout: 5000`, so a silent drop is detected within 10 s."*

#### 15. A dead phone locks a player out of their own name

- **Where:** Roles and devices (Creating and joining a room); Reconnects, security and edge cases (Reconnects); Reducer actions and effects (Actions: `player:join`).
- **What happens in the room:** Jun's budget phone dies at 4%. He borrows his sister's phone, scans the QR, types "Jun", and gets "Name taken" because his disconnected ghost keeps the name and score. The same happens when a QR opens in a different browser, which has its own `localStorage`.
- **Proposed change:** *"If a joining name matches a **disconnected** player (case-insensitive), the phone asks 'Are you Jun? · Rejoin as Jun / Pick another name'. Rejoining hands that pid, score and crown to the new device (the new `keyHash` replaces the old one). The Screen shows 'Jun is back (new phone)'. Names of connected players stay blocked."* Note: a kicked player is removed, so this doesn't bring them back.

#### 16. The Screen isn't glanceable enough

- **Where:** UI by role and phase (Screen: Drawing landscape, Drawing portrait); Data model (Role views: mask).
- **What happens in the room:** The "Jun got it!" banner runs across the top of the drawing for 2 s, so with four guessers the top of the drawing is covered for up to 8 s while others are still trying. Counting underscores from the sofa is hard ("_ _ _ _ _ _ _ _" — 7 or 8?). On a spare phone used as the Screen, the sidebar tries to fit timer, blanks, round info, five players and the feed.
- **Proposed change:**
  - *"'Jun got it!' appears in the sidebar (landscape) or the top bar (portrait), never over the drawing."*
  - *"Blanks show the letter count per word after them: `_ _ _ _ _   _ _ _ _  (5, 4)`. Blanks scale down to stay on one line."*
  - Portrait Screen priority: *"Always: timer, blanks, drawer name, player chips with ✓. Then the two latest guesses. Dropped in portrait: round and turn numbers."*

#### 17. Words and language need a pass

- **Where:** Words (Sample English words, Sample Taglish and Filipino words, Word pack format); Guess matching (Accepting a guess).
- **What happens in the room:** Most sample words are great to draw and very Pinoy: tsinelas, tabo, kilay, jeepney, halo-halo, rice cooker, electric fan, pimple. A few will stall a turn. *Hugot* is a feeling and can't be drawn. *Sinigang* looks like every other soup. *Shopping mall* is a box with a door. Some alternates players will actually type are missing.
- **Proposed change:**
  - Replace `hugot` with `bayanihan` (difficulty 3, gloss "neighbours carrying a house together"), `sinigang` with `fishball` (alt `fish ball`, difficulty 1), and `shopping mall` with `milk tea` (alt `milktea`, `boba`, difficulty 1).
  - Add alternates: `haunted house` + `horror house`; `graduation` + `toga`, `graduate`; `motorcycle` + `motorsiklo`; `kalabaw` + `water buffalo`; `traysikel` + `trike`; `pimple` + `zit`, `taghiyawat`.
  - Add `gloss` to every tl word of difficulty 2–3 (finding 2), e.g. `salakot` "wide woven farmer's hat", `sungka` "wooden board game with shells", `banig` "woven sleeping mat", `trumpo` "wooden spinning top".
  - Writing guide, add: *"`alt` lists every common spelling people type: ts/ch (tsinelas, chinelas), j/dy (jeep, dyip), e/i and o/u (lechon, litson), and the English name where barkadas use it. Every word must be drawable as a thing, a place or an action; no feelings or slang that only work as words."*
  - The English UI default and the Taglish copy examples read naturally. Add *"I-type, 'wag isigaw!"* and *"Walang nakakuha!"* to the Taglish table.

#### 18. Scope: what the first barkada night doesn't need, and what it does

- **Where:** Overview (Scope decisions); Settings; Reducer actions and effects (Actions); UI by role and phase (Host controls); Build roadmap.
- **What the first night doesn't need** (defer or simplify):
  - **PNG download** (F43). The gallery stays; people photograph the TV anyway. Defer.
  - **`host:preset` as a reducer action.** Presets can be a client-side shortcut that sends `host:settings`. That removes one action and its tests.
  - **Changing `copy` mid-game.** Make it lobby only, like every other setting except `guessFeed`.
  - **Near-square Screen as its own layout.** Specify it as "the landscape layout with the minimum sidebar width" with no separate acceptance item.
- **What it does need that the spec lacks:** a release line in the roadmap. Add a **Barkada night release** checkpoint after M9 listing the features required before the first real night: everything in findings 1–4, 6–8, 12–13 and 15, plus the existing gallery, custom words, spicy pack, phone and tablet Screens and sounds. Onboarding (finding 3) and the crown fix (finding 4) belong in M4, not after it.

#### 19. Gaps a developer would have to guess at

- **Where:** various; each item names its section.
- **Proposed text for each:**
  - Words (Word selection), contradiction: "Both dealt words go into `usedIds`" vs "the one not chosen goes back into the bottom of the deck". → *"Only the chosen word goes into `usedIds`; the unchosen words go to the bottom of the deck."*
  - Game flow (Turn order), late joiners: → *"A joiner is appended to this round's order if at least one turn remains after the current one. Otherwise they draw from the next round; in the last round they only guess. A join never makes the game longer than one extra turn."* (Kim may prefer otherwise; see Questions.)
  - Guesser phone, mid-game join: → *"A player who joins during DRAWING lands on the guess box with 'You're in! Mika is drawing. Type your guess.'"*
  - Scoring and timing (Timing and hints), early end: → *"A join during the 1.5 s `allGuessed` window doesn't cancel it."*
  - Edge cases, disconnected players: → *"Only `connected: false` greys a chip. `hidden` guessers look normal. A player skipped because they were disconnected draws again from the next round."*
  - Edge cases, kicked player: → *"The kicked phone shows 'You were removed from this game' and a link home."*

### Nice to have

#### 20. Kick and Leave are too easy to hit by accident

- **Where:** UI by role and phase (Screen lobby, Guesser phone lobby, Host controls).
- **What happens in the room:** On a touch Screen, "Kick" sits next to "Give host crown". One wrong tap and a friend can never rejoin this room from that phone. "Leave" on a phone mid-game silently throws away their score.
- **Proposed change:** *"Kick takes two taps ('Remove Jun?'). Leave takes two taps and, during a game, says 'Your points will be lost'."*

## Spec decisions I agree with

Checked and kept as they are:

- **Required Screen; no drawing on guessers' phones.** Everyone looks up at the same picture, which is the whole social point.
- **Private near-miss toasts.** "Malapit na!" on one phone builds tension without leaking anything.
- **Server-only matching with normalisation, filler words (`ang`, `mga`, `si`…) and the English plural rule.** Typing "ang tsinelas" should count.
- **Alternates across languages.** Guessing "slippers" for tsinelas counts. Right for Mixed rooms.
- **A 100-point floor for any correct guess.** Slow but right still matters, which protects slow typers.
- **The drawer earns half the guessers' total.** It rewards clear drawings over hard ones, scales with group size, and gives 0 only when nobody gets it.
- **Latency correction with a 250 ms cap and a 300 ms grace window.** Matters mainly at the buzzer, which is where a budget phone would otherwise lose.
- **Early end 1.5 s after everyone gets it.** Keeps the pace up.
- **Automatic pauses with a 3-2-1 resume and a 3 s Screen-away debounce.** Recovers for the people in the room, not just the sockets.
- **Minimal tools with an undoable Clear and no confirm dialog.** Right for non-gamers.
- **A square canvas on every device.** Simple, and the drawing looks the same everywhere.
- **Reactions instead of chat after a correct guess.** Correct guessers stay involved without being able to hint.
- **The guess box at the top with autocorrect and autocapitalise off.** Autocorrect would wreck Taglish guesses.
- **Custom words unfiltered and never logged.** The barkada typed them.
- **No drawer skip** (kept, with 1 of 3 and glosses making it fair).
- **Turn order by join order.** The first joiner, usually the most eager, draws first and shows everyone how it works.
- **Session totals across Play again.** Supports the play-it-twice night.
- **Blocked room-code words, including Tagalog.**
- **Spicy pack off by default.**

## Questions for Kim

1. **Drawer's share** (Open question 2). With ranks hidden during play, is 50% of the guessers' total still right, or tune it after the first night as planned?
2. **Who gets the crown.** The first joiner by default, with the token Screen able to move it (finding 4). Should the Screen also show a "Scan to host" QR so the person who set it up can claim the crown directly?
3. **"Letters!" reaction** (Open question 4). I'd leave it out: the "No letters" line, the host's Skip and the room's heckling are enough. Agree?
4. **iOS floor** (Open question 7). I'd raise it to iOS 16.4 (Screen Wake Lock) rather than build a "Turn off Auto-Lock" tip. Agree?
5. **Award tone.** Are the award names right, and is 🖼️ Modern art (the drawing nobody got) affectionate or too much for your groups?
6. **Late joiners in the last round.** Guess only (my proposal), or let them draw even if it adds a turn?
7. **`guessFeed: 'clean'`.** Worth keeping for family nights, or are 'all' and 'off' enough?
8. **Spicy pack examples.** Add more local drinking-night words (`pulutan`, `inuman`, `sabit`, `lasing`) alongside `tagay`, `jowa`, `hangover`?
