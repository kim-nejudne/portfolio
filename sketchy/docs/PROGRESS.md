# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

## Kim checks

Things only Kim can do: real phones and devices, mobile data, and reviewing Taglish, word packs and lists. Unattended sessions add a line here instead of blocking. Format: `- [ ] Fnn: exact steps · what to look for`. Kim ticks them off.

- [ ] F03: read `BLOCKED_WORDS` in `server/codes.ts` (DECISIONS 14) · add any Tagalog or Taglish word of ≤ 4 letters from `ABCDEFGHJKMNPQRSTUVWXYZ` (no I, L, O) that would embarrass a host on the TV, and drop any entry that blocks a harmless code for no reason (e.g. `PUKE`, `PWET` are mild)

- [ ] F07: on the laptop plugged into the TV, open `/`, tap **Start**, join two phones by typing the code at `/` (the phone page itself is F08, so join from Node or wait for F08), Start a game · from the sofa (≈ 5 m) the code, timer, blanks, names and the revealed word are readable, and the drawing square fills the TV's height

- [ ] F08: on an iPhone (Safari) and a budget Android (Chrome), join a game with `npm run dev` + `npm run lan`, start with 3 players, and on the drawer's phone: pinch, double-tap and drag down from the top of the pad while drawing · the page never zooms, scrolls or pull-to-refreshes, a second finger or palm leaves no line, and the pad, word bar and both toolbar rows fit with nothing cut off
- [ ] F08: on a guesser's phone, type a wrong guess and tap ➤, then lock the phone for 10 s, unlock, and pull down to refresh · the keyboard stays up after ➤ and the box stays above it; after unlocking and after the refresh the phone comes back to the same game as the same player (no name step, same points)
- [ ] F09 (M1 acceptance): `npm run dev`, then `npm run lan CODE` after starting a game on the laptop (Screen on the TV); join from 3 real phones on the same Wi-Fi, Start, and play a full cycle (each phone draws once; guess each other's drawings) · every player gets exactly one drawing turn, each stroke appears live on the TV within a blink, correct guesses show ✓ and points on the Screen and the guesser's phone, and the game ends at Final scores. Then open `http://<laptop>:5173/dev/bots/CODE` in a laptop tab before Start, spawn 2 bots and play again · bots join, guess random words in the feed, and draw the house doodle on their turn

- [ ] F11: on a budget Android and an iPhone as the drawer (`npm run dev` + `npm run lan`), draw a fast circle, a slow wavy signature, a long straight line into a sharp corner, and a few single-tap dots, with the Screen on the TV next to the phone · the TV's lines follow the phone's closely (no visibly cut corners, no flat facets on curves, dots appear), and the pad stays smooth with no lag while drawing fast

- [ ] F12: `npm run dev` + `npm run lan`, laptop Screen on the TV, 3 real phones; start, and on the drawer's phone (a) draw half a picture, turn on airplane mode for 5 s, keep drawing two strokes, turn it off; (b) reload the drawer's page mid-turn and keep drawing; (c) reload the TV's tab mid-turn; (d) try (a) on mobile data instead of Wi-Fi · after each, within a couple of seconds the TV shows exactly the phone's picture (no missing, doubled or shifted strokes, strokes drawn offline appear), after (b) the phone's pad shows the drawing so far, and the TV never shows a half-old picture after its reload

- [ ] F13: after autopilot deploys, open https://sketchy.kimnejudne.dev on the laptop (Screen on the TV), join with one phone on mobile data and one on Wi-Fi, set the drawing time to the shortest and start; (a) on a turn neither of them draws, both type the word and tap ➤ at the same moment on a count of three; (b) next turn, the mobile-data phone types the word and taps ➤ just as the timer ring reaches 0 · in (a) both get the same points (within 5) and the order looks fair (the mobile-data phone is not always second); in (b) the guess counts ("You got it!" with about +100) rather than being refused; points always sit between 100 and 300 and the drawer gets half the total

- [ ] F14: `npm run dev` + `npm run lan`, laptop Screen, 3 real phones (an iPhone and a budget Android among the guessers); start, and as a guesser (a) type a wrong word and tap ➤ twice very fast (or tap ➤, retype and tap again at once); (b) type the word with a capital, an accent or "ang"/"the" in front (e.g. "Ang Mangga!"); (c) on a later turn type the word plus " ko" · (a) "Slow down" shows under the box for about a second and a half, the refused word is back in the box, and the keyboard never drops; (b) counts as "You got it!"; (c) shows nothing on the TV during the turn (no bubble, no feed line), and at the reveal the TV shows "Almost: … ko"

- [ ] F15: (1) read `server/slurs.ts` and `server/profanity.ts` (each entry is a whole word, `stem*` or `*part*`): add Tagalog/Taglish/Bisaya terms that are missing, and say whether to keep or drop "intsik", "bumbay" (left out) and "negro", "sex", "bobo", "tanga", "pepe", "kiki" (in); everyday or drawable words must not be listed (DECISIONS 38). (2) `npm run dev` + `npm run lan`, laptop Screen, 3 real phones; start, and as a guesser type the word plus " ko" (or the word with one letter changed) · "So close!" shows under the box on that phone only, the guess is listed as "… ≈", the TV shows nothing of it until "Almost:" at the reveal; a rude wrong guess shows as typed in the TV's sidebar (the `'clean'`/`'off'` switch needs F21's settings, so recheck it then)

- [ ] F16: after autopilot deploys, open `https://sketchy.kimnejudne.dev/screen/CODE?debug=1` on the laptop (Screen on the TV, Wi-Fi) and join 3 phones; the drawer's phone on 4G opens `/play/CODE?debug=1` (add `?debug=1` to the join URL before joining). Start, wait 10 s, then (a) read the overlay at the top left; (b) film the drawer's phone and the TV together in slow motion (240 fps), draw 10 quick strokes, and count frames from finger movement to the line appearing on the TV (1 frame ≈ 4.2 ms) · (a) the overlay lists every phone with an RTT in ms (not "–"), shows "clock offset: N ms", and after the strokes shows p50 near 70–150 ms and p95 under 300 ms; (b) the video's median delay is within about 30 ms of the overlay's "+ 25 ms flush wait" p50 (the spec's ground truth)
- [ ] F17: open `data/packs/en-everyday.json` and `data/packs/tl-pinoy-life.json` (30 words each, the spec's sample tables) and run `npm run packs:check` · every word drawable in 60 s on a phone? Taglish spellings and alternates are what a barkada types (tsinelas/chinelas, dyip/jeep, litson)? glosses short, plain English and right? difficulties fair (en has 4 hard, tl 5)?
- [ ] F18: `npm run dev` + `npm run lan`, laptop Screen on the TV, 3 real phones including a small one (≈ 360 × 640, e.g. an iPhone SE or a budget Android); start, and (a) on the drawer's phone read the three cards and tap the middle one; (b) on the next turn don't tap and let the 12 s run out; (c) look at the TV and a guesser's phone while someone is choosing; (d) play one turn with the language set to Taglish (once F22 adds the setting, or with a room created with `{"settings":{"words":"taglish"}}`) · (a) three cards Easy/Medium/Hard, easiest at the top, each word large and readable, Tagalog medium/hard words show their short English gloss, "Hold your phone close 🤫" and the "Tap one…" line fit with nothing cut off and no scrolling, and the tap moves straight to the draw pad with that word in the bar; a tap the instant the cards appear (e.g. a leftover tap) doesn't pick anything; (b) the easy word is picked and the pad opens by itself; (c) the TV and guessers show "Mika is choosing a word…" and never any of the three words; (d) all three choices are Tagalog words
- [ ] F19: `npm run dev` + `npm run lan`, laptop Screen on the TV, 3 real phones including a small one (≈ 360 × 560–640); (a) play a turn without guessing and watch the blanks on the TV and a guesser's phone at half time and three-quarter time; (b) next turn, have both guessers type the word; (c) on a third turn, one guesser gets it and the other locks their phone (or turns Wi-Fi off) · (a) one letter appears in the blanks at ~50% and a second at ~75% (only one for a 4–5 letter word, none for a 3-letter word), the same letters in the same places on the TV and every phone; (b) about 1.5 s after the last correct guess the turn ends and the TV and phones show "Everyone got it! 🎉" above "It was…", and on the small phone the reveal fits with no scrolling, even with a two-word answer; (c) the turn ends ~1.5 s after the first guesser got it, without waiting for the locked phone
- [ ] F20: `npm run dev`, laptop Screen on the TV (Start), then 10 players (3 real phones plus bots from `/dev/bots/CODE`); play a 2-round game; repeat the scoreboard part on a portrait tablet Screen · after round 1 the TV shows "Round 1 of 2 done" with all 10 players ranked in two columns and the "Next ▶" button in its own row above the footer, covering no score; each phone shows "#N of 10" and its total; tied players share a medal or number; after round 2 the TV shows "Final scores" with no Next button; during turns no phone or TV shows a total, only "+N this turn"
- [ ] F21: `npm run dev` + `npm run lan`, laptop Screen on the TV (Start), 3 real phones (one ≈ 360 × 560–640); play a 2-round game; (a) on turn 1, as soon as it ends, look at the next drawer's phone; (b) next drawer taps a card during the reveal; (c) on another turn the next drawer taps nothing; (d) on the last turn of round 1, the next round's first drawer picks during the scoreboard; (e) once, the next drawer locks their phone/turns Wi-Fi off during the reveal · (a) it buzzes and shows "You draw next! Pick a word", three cards and a ◔ countdown from about 12 s, while the TV and the other phones show the reveal and no card word; (b) the phone shows "✏️ You draw next! Get ready" and, when the reveal ends (8 s), the pad opens at once; (c) after the reveal the TV shows "… is choosing…" for about 4 s and then the easiest word is drawn; (d) the cards stay through "Round 1 of 2 done" and drawing starts right after the scoreboard; (e) when the reveal ends, the following player gets the cards instead; on the small phone the cards fit with no scrolling, and a tap that lands as the cards appear (mid-guess) doesn't pick a word
- [ ] F22: `npm run dev`, laptop Screen on the TV (Start), 2 phones joined; from the couch (about 3–5 m): click **Settings ⚙** (top right), pick Quick, then Barkada Night, then Drawing time 100 s, then Esc; then reopen it, pick Classic and press Done; also try it on a tablet Screen in portrait · every label and pressed (orange) button is readable from the couch; the panel fits the TV with no scrolling; the orange highlight moves to the tapped preset, and "Presets · Custom" appears once 100 s is hand-picked; after Esc the lobby line reads "80 s · 3 rounds · Mixed words" with no preset name, after Classic it reads "Classic · 60 s · 2 rounds · Mixed words"; Tab never reaches Start while the panel is open; on the tablet the panel scrolls and every button is easy to tap
- [ ] F23: `npm run dev`, laptop Screen (Start) with 2 phones joined via `npm run lan CODE`; once Ana is drawing, scan the join QR with a third phone (an iPhone and an Android if you have both) and join as a new name · the phone lands straight on the guess box with "You're in! Ana is drawing. Type your guess." under it; on Android the keyboard may pop up by itself, on iPhone the box is focused but the keyboard waits for a tap (expected); the line goes after the first guess; refreshing the page mid-turn does not bring it back; the new player draws later in the same round (after the original players), and with a long name (e.g. 14 letters, no spaces) the line wraps instead of running off a 360 px screen
- [ ] F24: `npm run dev`, laptop Screen on the TV with a keyboard (Start), 3 phones; also a tablet as the token Screen once · from the couch, the bar's buttons are readable; it hides 3 s after the mouse stops and returns on a mouse move (on the tablet, on a tap); `?` shows the 11 shortcuts and Esc closes it; Space starts, then during a reveal Space/N move on; `G` shows "Guess feed: Clean" (wrong guesses masked on the TV), then Off, then All; S once shows "Press S again to skip the turn" and nothing happens, S twice skips; `F` goes fullscreen and back; `M` shows "Sound: Quiet"; a second Screen opened from the join link (no token) shows no bar and ignores every key; with Wi-Fi off on the laptop, tapping Skip twice shows "Could not do that. Try again." and nothing skips after Wi-Fi returns; Pause/End/Rematch show "That's coming in a later update" until F28/F29
- [ ] F25: `npm run dev`, laptop Screen on the TV (Start), 3 real phones (an iPhone and an Android if you have both) via `npm run lan CODE` · the first phone shows "You're the host 👑", a big Start game (greyed with "Need 2 players" until a second phone joins) and "Classic · 60 s · 2 rounds · Mixed words" with Change; Change opens the settings with the players list at the bottom; on the TV, click another player's name → Give host crown: that phone shows "You're the host now 👑" (below the Host button, not covering it) and the TV reads "👑 Jun is hosting · tap a name to change"; start from the crown phone, then while someone draws tap 👑 Host: the sheet slides up with Pause, Skip turn, End game, Guess feed All/Clean/Off and the players, never the word; with the crown phone guessing and the keyboard up, the guess box stays visible under the Host bar; with the crown phone drawing, the sheet never opens by itself and the pad still fits; the crown holder leaving passes the crown (toast on the next phone)
- [ ] F26: `npm run dev`, laptop Screen on the TV in fullscreen (Start), 3 phones via `npm run lan CODE` · from across the room, the lobby's three How to play steps (✏️ 1 · One person draws on their phone, 📱 2 · Everyone else types guesses 🤫, ⚡ 3 · Faster = more points) are readable under the code; start: during the first turn the yellow "Mika is drawing. Everyone else: type your guess on your phone 🤫" sits under the drawing on two lines, readable at 5 m and not cut off once the host bar hides; turn 2 reads "Type your guess. Don’t say it! 🤫"; the drawing does not jump in size when the word is revealed; from turn 3 there is no caption and the drawing is a little taller. Also try a landscape tablet as the Screen
- [ ] F27: `npm run dev`, laptop Screen on the TV (Start), 3 real phones via `npm run lan CODE` (a small Android, an iPhone, one more) · each lobby shows "Doodle yourself while you wait!" with a white pad (on the host's phone below Start); draw a face with a finger: the stroke follows the finger, the lobby doesn't scroll, zoom or pull-to-refresh while drawing, and a thumb on the gutter beside the pad still scrolls the lobby; ↶ Undo takes the last stroke off the phone and the TV; within a second or two the face replaces that player's initial on the TV chip and is recognisable from the sofa; reload one phone: its pad still shows the face and the TV keeps it; start the game: the faces stay on the sidebar chips; a phone that leaves (Leave, two taps) disappears with its face. No phone ever shows anyone else's doodle

<!-- entries below, newest first -->

## F27 — Lobby doodles (2026-10-31)
**What changed:**
- **Server:**
  - `inkStore.ts`: a doodle log per player (`doodle`, `dropDoodle`, `doodles`), reusing the turn log's per-op caps with `doodleMax` (20 KB, the whole stack). A batch past the cap is refused **whole** (applied to a copy), so the phone can drop exactly that stroke. `reset` (Rematch, Back to lobby) now keeps doodles; `forget` drops them.
  - `inkGateway.ts`: `doodle:batch` from a handshake-bound player still in the room, LOBBY only. Order of checks: rate limit (the player's 40/s), `notJoined`, `notPlayer` (Screen, left or kicked), `roomNotFound`, `wrongPhase`, `inkFull`. Relayed to `ink:<code>:screen` only as `doodle {pid, ops}`; `sys:doodle` is dispatched when `hasDoodle` changes. A Screen's hello snapshot carries `doodles` (and is sent with `turnId: 0` when there is no turn yet); the drawer's own snapshot never does. Takes the new `dispatch` option (`server/index.ts`).
  - `reducer.ts`: `sys:doodle {pid, has}` (`has: true` LOBBY only, `false` any time; `unknownPlayer`). `player:leave` emits the new `doodleDrop {pid}` effect, which `sockets.ts` hands to the ink gateway.
  - `shared/types.ts`: the `doodleDrop` effect, the `doodle` server→client `/ink` event, `InkSnapshot.doodles?`.
- **Client (phone):**
  - `ink/doodle.ts`: the phone's doodle. One `doodle:batch` per finished stroke (RDP-simplified, and the pad keeps the simplified line), ↶ Undo as one `u`; a refused stroke is taken off, a refused undo put back, a timeout kept; undo waits for unanswered sends. Saved in sessionStorage per room and pid (checked by hand, no zod on `/play`).
  - `DoodlePad.tsx` in `PhoneLobby`: "Doodle yourself while you wait!" with ↶ Undo, a white square pad (≤ 38 dvh, 3 rem narrower than the column), "Your doodle is full. Looking good!". In the host lobby below Start and the summary; in the plain lobby under the waiting line, above Who's here. The lobby scroller is `overscroll-contain`.
  - `Play.tsx`: `sendDoodle` on the page's `/ink` socket (not buffered while it is down).
- **Client (Screen):**
  - `lib/doodles.ts`: the Screen's doodles by pid (snapshot, then relays) with per-pid versions, and `DoodleContext`.
  - `Avatar` (`PlayerChip.tsx`) draws the doodle when the chip has `hasDoodle` and the Screen holds it (rounded square, player colour border, lines 6× thicker); phones have no context and keep initials. Lobby chip avatars are now max(8 vmin, 40 px), sidebar and standings 1.5 em.
  - `lib/ink.ts`: `drawStroke`/`redrawPicture` take a `lineScale`.
- **Tests:**
  - `server/inkStore.test.ts` (+6): per-player stacks, the cap refusing a batch whole and undo freeing room, a clear not freeing room, `has` after undo and no-ops left out, reset keeps / drop / forget, rooms apart.
  - `server/reducer.doodle.test.ts` (new, 9): `hasDoodle` in every view, `has: true` refused in the five game phases while `false` is taken, unknown pid, leave emits `doodleDrop` in the lobby and mid-game, a disconnect keeps it.
  - `server/inkGateway.test.ts` (+6): relayed to both Screens and never to a phone (Ben's hello as a Screen included) or the main namespace; refused outside LOBBY, from a Screen and an unbound socket; the 20 KB cap (`inkFull`, not relayed, per player) and the schema's single-batch cap; a later Screen gets every doodle in its snapshot in the lobby and mid-game, the drawer's snapshot has none; leave drops it and refuses the old socket; `hasDoodle` false after undoing everything.
  - Client: `ink/doodle.test.ts` (new, 7), `lib/doodles.test.ts` (new, 3), `PlayerChip.test.tsx` (new, 4), `hostPhone.test.tsx` (+2, Undo in the button lists), `lib/ink.test.ts` (+1, the doodles-only `turnId: 0` snapshot).
- No new dependencies.

**Decisions:** DECISIONS 50 covers:
- what the 20 KB measures, and refusing a batch whole;
- who may doodle, and when `sys:doodle` is sent;
- the `doodleDrop` effect, and the snapshot shape;
- the pad's tools, Undo and timeouts;
- sessionStorage, placement and size;
- the avatars.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied:
  - this entry and the Kim check;
  - a comment on why `sys:doodle` is always accepted (same tick as the LOBBY check);
  - a test for the doodles-only `turnId: 0` snapshot on the Screen.
- **secrets-fairness: PASS WITH FIXES.** No leak found. Applied:
  - DECISIONS 50 notes that one `doodle:batch` may be 20 KB, not the turn batch's 4 KB (as DECISIONS 10 set);
  - F28's roadmap entry says kick must emit `doodleDrop`.
  - Not changed: the Screen keeps a departed player's doodle in memory until its next snapshot (the chip is gone; at most 20 KB a player).
- **mobile-ux: PASS WITH FIXES.** Applied:
  - ↶ Undo, so a slip or "full" isn't permanent;
  - an ack timeout keeps the stroke;
  - avatars grew to max(8 vmin, 40 px) in the lobby and 1.5 em in the sidebar and standings;
  - gutters beside the pad, and `overscroll-contain` on the lobby;
  - `role="img"` on the pad;
  - per-pid avatar redraws;
  - the in-hand-stroke-at-start case is documented.
  - Not changed: "full" isn't re-announced on repeats.

**Notes for next session:**
- **F28:** kick must emit `doodleDrop` (roadmap note).
- **F29:** keep each player's `hasDoodle` through the new-game reset (`inkReset` already keeps the doodles; roadmap note).
- **F30/F31:** the lobby pad may get the toolbar (roadmap note); a doodle's clear doesn't free its 20 KB.
- **F33:** the portrait strip's chips use `Avatar`, so they get doodles for free.
- **F45:** Taglish for `doodleYourself`, `doodlePad`, `doodleFull`, `doodleUndo`.
- Dev bots don't doodle (not needed; Backlog-worthy if wanted).

**How to try it:**
- Unit tests: `npx vitest run server/inkStore.test.ts server/reducer.doodle.test.ts server/inkGateway.test.ts client/src/ink/doodle.test.ts client/src/lib/doodles.test.ts client/src/components/screen/PlayerChip.test.tsx client/src/components/phone`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE`; doodle in each lobby and watch the TV chips.
- Automated, both passing (gitignored):
  - `npm run playtest -- .playtest/F27/scenario.ts`: a TV Screen, Ana (Pixel 7), Ben (iPhone 13), then a tablet Screen.
    - both pads show;
    - Ana's stroke becomes her chip avatar, and no phone frame mentions a doodle;
    - the late tablet Screen gets her doodle;
    - Ben's makes two avatars;
    - Ben leaves and his avatar goes.
  - `npm run playtest -- .playtest/F27/small.ts`: two 360×560 phones.
    - The host's and the guesser's pads are wholly on screen with ≥ 24 px gutters.
    - Two faces drawn, and the lobby didn't scroll; Undo removes the mouth.
    - A reload keeps the face on the pad and the TV.
    - Start keeps both faces in the sidebar.
  - No console errors.
  - Screenshots: `.playtest/F27/faces-screen.png`, `sidebar-screen.png`, `small-host-reloaded-Ana.png`.


## F26 — How to play and first-turn captions (2026-10-31)
**What changed:**
- **Client (Screen):**
  - `ScreenLobby` `HowToPlay`: the three steps under the join details (the QR comes with F37), on every Screen, each with an icon (`HOW_TO_PLAY` in `lib/screen.ts`).
  - `ScreenTurn` `Caption`: under the drawing in the game's first two turns. `turnCaption(view, t)` gives turn 1 "Mika is drawing. Everyone else: type your guess on your phone 🤫", turn 2 "Type your guess. Don’t say it! 🤫", in DRAWING only. `hasCaptionRow(turn)` keeps the row (empty) in CHOOSING and REVEAL of those turns, so the drawing keeps its size at the reveal. The row is max(9 vh, 44 px); the text is 3.5 vh, shrinking with the square's width (`5.5cqw`) so it stays on two lines.
  - `copy.ts`: `howToPlay`, `howToDraw`, `howToGuess`, `howToScore`, `captionFirstTurn`, `captionSecondTurn` (English; Taglish with F45).
- **Tests:**
  - `client/src/lib/screen.test.ts` (+6): the turn-1 caption with the drawer's name, turn 2's, none from turn 3, none outside DRAWING or with no turn, the row only in turns 1–2; three steps of at most six words, three icons.
  - `ScreenTurn.test.tsx` (+3): the caption after the canvas and before the sidebar on turns 1 and 2, none on turn 3, the row kept with no text in CHOOSING and REVEAL.
  - `ScreenSettings.test.tsx` (+1): the strip after the code on token and plain Screens.
- No new dependencies.

**Decisions:** DECISIONS 49: the strip's place until the QR, the caption's phase and row, the width-based shrink, the host bar overlap, and the F29 dependency.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: the F29 note that `TurnView.number` must restart at 1 in a new game (`history` is never cleared yet), with a test to add there; this entry; the Kim check. Taglish waits for F45.
- **mobile-ux: PASS WITH FIXES.** Applied: the caption shrinks with the square's width (a near-square Screen caps the square at 72 vw, which could have clamped the first caption's end); the F29 note. Checked rather than changed: the vertical budget (the square's height is relative to its column, not the viewport; the playtest measures 800×480). Not changed: the strip wrapping as 2 + 1 (the spec's sketch is 1 + 2; either reads fine), the `<ol>` with visible numbers, the host bar briefly over the caption (DECISIONS 49).

**Notes for next session:**
- **F27:** nothing new.
- **F29:** a new game must restart `TurnView.number` at 1 (roadmap note), or the captions only teach game 1.
- **F33:** the portrait Screen needs the caption under its square too (same `turnCaption`/`hasCaptionRow`).
- **F37:** put the QR above `HowToPlay` ("under the QR").
- **F45:** Taglish for the six F26 strings; the spec gives "I-type, 'wag isigaw! 🤫" for turn 2.

**How to try it:**
- Unit tests: `npx vitest run client/src/lib/screen.test.ts client/src/components/screen`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start): the strip is under the code. Add phones (`npm run lan CODE`) or bots (`/dev/bots/CODE`), start, and watch turns 1–3.
- Automated: `npm run playtest -- .playtest/F26/scenario.ts` (gitignored). A TV Screen plus Mika (Pixel 7), Ben (iPhone 13) and Cara (small phone). All steps pass:
  - the lobby's three steps;
  - turn 1's caption, measured at 1920×1080, 1180×820, 1024×768, 1000×880 and 800×480: two lines, not clamped, under the square and above the code strip;
  - turn 2's caption and not turn 1's; no caption on turn 3;
  - each turn's word (dev API) absent from the Screen and guessers' text.
  - No console errors. Screenshots: `.playtest/F26/lobby-screen.png`, `turn1-1000x880-screen.png`, `turn2-screen.png`, `turn3-screen.png`.

## F25 — Host crown and the host lobby (2026-10-30)
**What changed:**
- **Reducer:**
  - `host:crown {pid}` in any phase, from the token Screen or the crown holder. The reducer checks the crown again, so a stale flag gets `notHost`.
  - The target must be in the room (`unknownPlayer` otherwise). Giving the crown to its holder does nothing. The new holder gets `crowned`.
  - The heir rule moved into `passCrown`: the connected earliest joiner, else the earliest joiner. Leave uses it now; F28's kick will too.
- **Client (crown phone):**
  - **Host lobby** (`PhoneLobby`): "You're the host 👑", a big Start game (disabled with "Need 2 players" below 2 connected), and the summary line ("Classic · 60 s · 2 rounds · Mixed words") with **Change**.
  - Change opens the F22 `ScreenSettings` panel (it now takes `children`) with the players list below.
  - **Host drawer** (`HostDrawer.tsx`): once the game has started, a slim top bar with 👑 Host sits above the paused overlay. It opens a bottom sheet with each phase's controls (`drawerSections` in `lib/hostKeys.ts`), a guess feed All / Clean / Off row, and the players list in CHOOSING, DRAWING and FINAL. It never opens by itself and never shows the word.
  - **Toast** "You're the host now 👑" (`gainedCrown` in `lib/phone.ts`) when a view brings a host block the previous view lacked.
- **Client (shared and token Screen):**
  - `HostPlayerList`: Give host crown (not for the holder) and Kick in two taps ("Remove Jun?", `twoTap`); none on your own row. Kick answers "That's coming in a later update" until F28.
  - `lib/hostSend.ts` (`sendHost`, `useHostSender`): the send and the status line, shared by the drawer, the lobby and the list.
  - The control labels moved from `HostControls.tsx` to `lib/hostKeys.ts`.
  - The token Screen lobby reads "👑 Mika is hosting · tap a name to change". Its chips are buttons that open `PlayersDialog` for that player. Mid-game the bar gets **Players**, which opens the dialog for everyone.
  - `settingsLine` is the shared summary.
- **Tests:**
  - `server/reducer.crown.test.ts` (new, 20): first joiner crowned; Screen and holder give it; works in all six phases changing only the crown; refused for a non-holder, a plain Screen, a stale flag and an ex-holder; unknown pid; no-op to the holder; a disconnected target; host rights move (start); the host block moves and the holder's view is a plain view plus it; leave passes to the longest-connected (twice), mid-game too; it stays on disconnect and on takeover.
  - `views.leak.test.ts`: the Screen crowns a guesser mid-DRAWING who hasn't guessed, who then passes the crown on; every view and fx is audited.
  - `sockets.test.ts` (+1): `notHost` from a non-holder, `invalidPayload`, the holder passes it, both views update, `crowned` arrives once, the old holder's `host:start` gets `notHost`, and the Screen moves it back.
  - Client:
    - `hostPhone.test.tsx` (new, 12): host lobby, Start disabled (alone or with an offline second player), plain lobby, the Host button closed by default, the drawer per phase with no `qz` word, the players list rules, 44 px buttons.
    - `hostKeys.test.ts` (+6): `drawerSections`, `twoTap`.
    - `phone.test.ts` (+2): `gainedCrown`.
    - `ScreenSettings.test.tsx` (+3): the token line, chips as buttons, the dialog.
    - `HostControls.test.tsx` (+1): Players in the bar after the lobby.
  - The F22 `inPhase` helper moved to `server/test/rooms.ts`.
- No new dependencies.

**Decisions:** DECISIONS 48 covers:
- the crown in any phase, including to a disconnected player;
- the toast from the snapshots, so the first joiner gets none;
- the host lobby's layout, with Change reusing the F22 panel;
- who gets Give crown and Kick;
- the Host top bar above the paused overlay, costing the pad about 48 px;
- the Screen's chip dialog and the bar's Players button.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: F28's roadmap entry now notes that kicking the holder must call `passCrown`, with a test (the kick half of the first bullet lands with kick itself); this entry; the Kim check. Its "an offline second player keeps Start disabled" is covered by `hostPhone.test.tsx`.
- **secrets-fairness: PASS WITH FIXES.** Applied: the leak test also crowns the current drawer mid-DRAWING. The upcoming drawer holding the crown in REVEAL and SCOREBOARD was already audited, since Ben chooses with the crown. The drawer sheet's no-word test with a drawer-and-host view was already in `hostPhone.test.tsx`.
- **mobile-ux: PASS WITH FIXES.** Applied:
  - the player's view and the Host bar are `inert` behind the sheet. Play holds `open`, which resets when the crown goes or in LOBBY, so the sheet never reopens by itself;
  - the Screen bar is inert behind the Players dialog;
  - the toast sits below the Host bar and lets taps through;
  - the sheet has side safe-area insets;
  - "👑 Mika" on the chips.
  - Not changed: the players list scrolls inside the sheet at 360×560 (it is a modal), and the host lobby can scroll with many players (it is not a pad or guess screen). The guesser keeping the guess box usable with the keyboard up, 48 px lower, is a Kim check.

**Notes for next session:**
- **F27:** the doodle pad goes below Start in the host lobby too (spec: "The doodle pad sits below Start").
- **F28:**
  - `host:kick` is already sent by `HostPlayerList` (two taps), from the Screen chips, the bar's Players and the phone's Change and drawer;
  - kicking the holder must call `passCrown`;
  - the Host top bar is above the paused overlay (z-30), and the sheet (z-40) holds Resume.
- **F29:** the drawer already shows Rematch (two taps), Back to lobby and, during a countdown, Cancel.
- **F42:** a takeover keeps the crown (tested); the toast shows only if the crown moved meanwhile.
- **F45:** add the F25 strings (`youreHost`, `youreHostNow`, `change`, `hostButton`, `ctlPlayers`, `playersTitle`, `giveCrown`, `kick`, `kickConfirm`, `isHostingTapToChange`) to the Taglish table.
- **F48:** Add your own words goes into the Change panel (`ScreenSettings` `children`) and the token Screen's settings.

**How to try it:**
- Unit tests: `npx vitest run server/reducer.crown.test.ts server/views.leak.test.ts server/sockets.test.ts client/src/components/phone/hostPhone.test.tsx client/src/lib/hostKeys.test.ts client/src/components/screen`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE`.
  - The first phone gets the host lobby. Tap a name on the Screen and choose Give host crown.
  - Start from the crown phone, then tap 👑 Host for the drawer.
- Automated: `npm run playtest -- .playtest/F25/scenario.ts` and `.playtest/F25/drawer.ts` (gitignored). The setup is a TV Screen plus phones (a 360×560 small phone, a Pixel 7, an iPhone 13). All 14 steps pass:
  - lobby, `scenario.ts`:
    - the first joiner's host view with Start disabled alone and enabled at 2;
    - "👑 Ana is hosting · tap a name to change";
    - the Screen's chip → Give host crown → Ben's toast and both lobbies update;
    - the holder leaves → the heir's toast;
    - Change shows the settings and players;
  - in game, `drawer.ts`:
    - Start from the phone; only the holder has Host;
    - the drawer's pad fits 360×560 with the Host bar;
    - the sheet is closed until tapped, then shows the DRAWING controls with no word (checked against the dev word API);
    - Off pressed from the snapshot; Pause → "That's coming in a later update";
    - Kick → "Remove Ben?" lapses after 2 s;
    - Skip twice → REVEAL with Next, Pause, End game;
    - Next, then Give host crown from the drawer → Ben's toast, and Ana loses Host;
    - the Screen bar's Players → Give host crown back to Ana.
  - No console errors.
  - Screenshots: `.playtest/F25/C-drawer-ana.png`, `D-drawer-open-ana.png`, `H-toast-ben.png`, `I-screen-screen.png`, `5-change-ana.png`.

## F24 — Screen host controls and shortcuts (2026-10-30)
**What changed:**
- **Client (token Screen only):**
  - `lib/hostKeys.ts` (pure): `barControls(view)` per the spec's drawer table (CHOOSING/DRAWING Pause, Skip turn, Guess feed, End game; REVEAL/SCOREBOARD Next, Pause, End game; FINAL Rematch, Back to lobby, End game; a rematch countdown only Cancel; paused → Resume, no Next). `keyControl`/`pressKey` for Space, Esc, L L, P, S S, E E, N, G, F, M, `?`. `press` arms a two-press control (Skip, End, Rematch, Back to lobby) and sends on the second within 2 s (`CONFIRM_MS`). `controlEvent` maps a control to its `host:*` event; `G` sends `host:settings {guessFeed}` after the snapshot's (All → Clean → Off). `dialogKey` blocks shortcuts under a dialog. `SHORTCUTS` feeds the `?` overlay.
  - `lib/soundPref.ts`: Sound on / Quiet / Muted kept in localStorage (F38 plays at that level).
  - `components/screen/HostControls.tsx`: `HostControls` renders nothing without `view.host`. The bar (`role="group"`, "Host controls") sits along the bottom edge, shows on load, mouse movement, touch or Tab, and hides (`inert`) 3 s later unless keyboard focus (`:focus-visible`) is in it or `?` is open. The status line (always-mounted `role="status"`) sits above the bar's real height: "Press S again…", "Tap again to…", "Guess feed: Clean" (from the next snapshot), "Sound: Quiet", "That's coming in a later update" (`notAvailable`), "Could not do that. Try again." (offline or no ack; offline taps are never queued). A first press never carries into another phase or turn. Keys are ignored with modifiers, on repeat, while composing, in fields, and Space on a focused button keeps its click. `ShortcutsHelp`: the dialog lists all 11 keys; Esc, `?`, Close or the backdrop close it, Tab stays on Close, and its Esc doesn't reach the settings panel (capture + `stopImmediatePropagation`).
  - `Screen.tsx` mounts `HostControls`; F20's `NextButton` is removed (the bar's Next, `N` and Space replace it).
  - `copy.ts`: the bar, hint and shortcut strings (English; Taglish with F45).
- **Tests:**
  - `client/src/lib/hostKeys.test.ts` (new, 26): the bar per phase, paused and countdown; each control's event; G's cycle and payload from the snapshot, in every phase; Space per phase (Start, Next, Resume, a two-press Rematch, Cancel); Esc; S S within and outside 2 s, disarm by another key, re-arm; E E, L L, P, N with their phases; F, M, `?` local; an unmapped key keeps the arm; the overlay's 11 keys in order; two-tap vs one-tap controls; dialogs block keys.
  - `HostControls.test.tsx` (new, 10): nothing without the token in every phase; the bar's buttons per phase; "Tap again to…" labels; sound level and no Fullscreen without the API; every button 44 px; the overlay lists every key.
  - `ScreenStandings.test.tsx`: the NextButton tests went with the component; the bar tests cover Next (shown in REVEAL/SCOREBOARD, not while paused, not without the token).
- No new dependencies.

**Decisions:** DECISIONS 47: the token-only mount; auto-hide as "collapsible"; the bar's controls per phase (lobby has only the utilities, Start stays the lobby's); the Screen's players list with Kick left to F28 (roadmap note added); two presses within 2 s, End two presses on FINAL too; what disarms; keys only when their control is in the bar (G, F, M, `?` always); G's line from the snapshot; `M` as a stored preference; actions built later wired now and shown as "coming in a later update".

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: shortcuts blocked under the `?` overlay and the settings panel (`dialogKey`, with tests), this entry and the Kim check. Not changed: a successful send also clears a stale status line (low stakes).
- **mobile-ux: PASS WITH FIXES.** Applied:
  - Space no longer starts the game behind the settings panel (it focuses a div);
  - a clicked bar button no longer keeps the bar up (`:focus-visible` check at hide time, which also covers an unmounted focused button);
  - offline taps and keys show "Could not do that" instead of being buffered and replayed on reconnect;
  - the `?` dialog's Tab trap and its Esc kept from the settings panel;
  - tap hints and `M` announced in the status line; `saveSoundLevel` out of the state updater;
  - the status line above the bar's real height;
  - `role="group"` (no roving focus), the `contenteditable` selector, `isComposing`, the overlay's max width;
  - the Esc line notes Space also cancels (browsers keep Esc for leaving fullscreen).

**Notes for next session:**
- **F25:** the crown phone's drawer can reuse `barControls`/`controlEvent` from `lib/hostKeys.ts` (the spec gives the phone the same table, plus the players list).
- **F28:** pause, resume, skip and end are already sent by the bar and keys; add the players list with Kick (two taps) to the bar.
- **F29:** rematch, cancel and back to lobby are already wired (Space twice, Esc, L L).
- **F38:** read `loadSoundLevel()` from `lib/soundPref.ts`.
- **F45:** add the F24 strings to the Taglish table.

**How to try it:**
- Unit tests: `npx vitest run client/src/lib/hostKeys.test.ts client/src/components/screen`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE` or bots at `/dev/bots/CODE`. Press `?` for the shortcuts; move the mouse for the bar.
- Automated: `npm run playtest -- .playtest/F24/scenario.ts` (gitignored). A TV Screen, 3 phones and a plain Screen. All steps pass:
  - `?` lists every shortcut, Esc closes it;
  - Space and `G` do nothing behind the settings panel, whose Esc still closes it;
  - Space starts; the bar shows the DRAWING controls and hides after 3 s, also after a mouse click on it;
  - `G` gives Clean, Off, All;
  - `P` → "That's coming in a later update";
  - S then E then S doesn't skip, S S skips;
  - `M` cycles sound, `F` toggles fullscreen;
  - no phone has the bar; the plain Screen has no bar and its G/P/?/S S do nothing;
  - S S while drawing → REVEAL with Next, Pause, End game; `N` leaves REVEAL;
  - E E → "coming in a later update".
  - Screenshots: `.playtest/F24/3-hidden-screen.png`, `8c-reveal-bar-screen.png`.
  - Not run end to end: pause, end, rematch and back to lobby (F28/F29 build them server-side).

## F23 — Late join and turn order (2026-10-30)
**What changed:**
- **Reducer:** `join` calls the new `appendLateJoiner` for a new player (never a rejoin or a name takeover). The joiner is appended to `turnOrder` when a turn remains after the current one:
  - in CHOOSING/DRAWING, when a place remains after `turnIndex` (connected or not);
  - in REVEAL/SCOREBOARD, when an `upcoming` deal stands. If it is this cycle's, they go after it. If it is the next cycle's, `turnOrder` is already that cycle's, so they draw in it, once.
  - With no deal (the game's last REVEAL), and in LOBBY/FINAL, there is no append. The next cycle, if any, is built in join order with them in it; otherwise they only guess.
  - Disconnect skips and leave removals were already in place from F20/F21; F23 adds their tests. The old F04 SPEC-QUESTION is gone.
- **Client:**
  - `lib/phone.ts` `welcomeTurn(view)`: the turn a newly joined phone is welcomed into (a guesser in CHOOSING/DRAWING), else null.
  - `Play.tsx`: `freshJoin` is set only by the name step (`startJoin`) and cleared on a refused join. The first live view sets `welcomeTurnId`.
  - `GuesserTurn` `welcome` prop: in that turn's DRAWING, "You're in! Mika is drawing. Type your guess." sits under the guess box, the box takes focus, and it is linked by `aria-describedby`. The line wraps long names and goes after the first guess or a correct one.
  - `copy.ts`: `joinedMidGame` (English; Taglish with F45).
- **Tests:**
  - `server/reducer.turnorder.test.ts` (new, 18):
    - a joiner scores in the current turn, timed from the turn start (fewer points), at 0 and with no word in their view;
    - a LOBBY join is left to Start;
    - appended mid-cycle (DRAWING, CHOOSING), even when the places after are disconnected;
    - the cycle's last turn → the next cycle; the last turn of the last cycle → only guesses;
    - REVEAL with this cycle's deal → after it; REVEAL with the next cycle's deal and SCOREBOARD → in the next cycle, once; the game's last REVEAL → FINAL;
    - two joiners add at most one turn each a cycle;
    - a rejoin or a name takeover is not appended again;
    - a disconnected player is skipped (even if back before their place) and draws next cycle; a dealt player who disconnects is skipped at take-up; leavers, including a late joiner, are removed and never drawn.
  - `phoneViews.test.tsx` (+3): the welcome line under the box with `aria-describedby`; none for an existing player or once they got it; `welcomeTurn` for a guesser in CHOOSING/DRAWING, null for the drawer, REVEAL and LOBBY.
  - Updated for the new rule, with no checks dropped: the `reducer.flow` mid-game joiner now draws in both cycles. Both `views.leak` scripted games gain the joiner's cycle-1 turn (the reducer game plays it with a guess; the socket game deals and skips it). The `/ink` whole game now has the late joiner draw turn 4, and checks that they get only their own snapshot.
- No new dependencies.

**Decisions:** DECISIONS 46 covers:
- what "a turn remains" means in each phase (places counted connected or not; a standing deal between turns);
- no append with no deal;
- who gets the welcome and where it sits;
- the iOS focus limit.

Row 18 points to it. A mislabelled `TODO(F23)` for the pause in `views.leak.test.ts` now reads F28.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: a test for disconnected places after the current turn, the takeover note in DECISIONS 46, this entry and the Kim check.
- **secrets-fairness: PASS.** Applied: `freshJoin` cleared on a refused join, and DECISIONS 46 now notes the REVEAL-with-no-deal case. Not applied (cosmetic): hiding the welcome only after an `ok` ack.
- **mobile-ux: PASS WITH FIXES.** Applied:
  - `aria-describedby` on the box;
  - `break-words` on the line;
  - the iOS focus note in DECISIONS;
  - the `freshJoin` reset;
  - the test's turn id taken from the fixture.
  - The `Play.tsx` wiring (refresh shows no welcome) is in the Kim check, because the client tests have no DOM. A welcome during CHOOSING is not added: the spec names DRAWING.

**Notes for next session:**
- **F24:** nothing new.
- **F28:**
  - kick must remove the player from `turnOrder` the way `leave` does, `turnIndex` adjustment included;
  - `fewPlayers` may make the "disconnected places count" case rarer.
- **F42:** "Rejoin as Jun" goes through the name step, so it will set `freshJoin`. A welcome line there is harmless (DECISIONS 46).
- **F45:** add `joinedMidGame` to the Taglish table.

**How to try it:**
- Unit tests: `npx vitest run server/reducer.turnorder.test.ts server/reducer.flow.test.ts server/views.leak.test.ts server/inkGateway.test.ts client/src/components/phone`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), 2 phones via `npm run lan CODE` or bots at `/dev/bots/CODE`. While someone draws, join from another phone: it opens on the guess box with "You're in! … is drawing. Type your guess.", can guess right away, and draws after the original players this round.
- Automated: `npm run playtest -- .playtest/F23/scenario.ts` (gitignored). It runs a TV Screen, Ana, Ben and a late joiner, Cara, on a small phone. All steps pass:
  - Cara joins mid-DRAWING and sees the welcome line and the guess box;
  - the word is absent from the Screen and guesser DOM before the reveal;
  - the drawers go Ana, Ben, Cara (appended this cycle);
  - after Ben's browser closes, Ben is skipped.
  - No console errors.
  - Not covered here: the next-cycle, last-cycle and leave rules (all covered by the unit tests).

## F22 — Settings and presets (2026-10-30)
**What changed:**
- **Reducer:** `host:settings` (host only: a token Screen or the crown holder) merges a validated partial into `room.settings`, with no effects. Any setting in LOBBY; in every other phase (FINAL included) only `guessFeed`. A payload with a lobby-only key is refused whole with `wrongPhase`. An empty payload is a no-op. The gateway already zod-validated it (`partialSettingsSchema`, strict: `drawSeconds` must be 45/60/80/100).
- **Client:**
  - `lib/settings.ts`: `presetOf(settings)` is the preset whose `drawSeconds`/`cycles`/`hints` match, or null.
  - `ScreenSettings.tsx`:
    - `SettingsButton` ("Settings ⚙", top right of the token Screen's lobby).
    - `ScreenSettings`, mounted while open: it sends `host:settings`, handles Esc, and focuses the dialog.
    - `SettingsPanel` (presentational): the three presets with time, rounds and length; every setting as a row of `aria-pressed` buttons in the spec's order. Busy buttons use `aria-disabled` (focus stays) and ignore taps. A refusal shows "Could not change that. Try again." It is 1 column in portrait, 2 from 1:1 and 3 from 16:10, so it fits 1920×1080 without scrolling.
  - `ScreenLobby`: owns the open state; the lobby behind the panel is `inert`, and focus returns to the button on close. The summary line now leads with the active preset ("Classic · 60 s · 2 rounds · Mixed words", `presetSummary`).
  - `copy.ts`: the settings strings (English; Taglish with F45).
- **Tests:**
  - `server/reducer.settings.test.ts` (new, 21):
    - the defaults (60 s);
    - a partial merge, every drawing time, every setting at once, each preset's values;
    - an empty no-op, and a later start using the new drawing time;
    - the crown holder allowed; a plain Screen, a player and a stale `isHost` refused;
    - `guessFeed` accepted in CHOOSING, DRAWING, REVEAL, SCOREBOARD and FINAL with no phase or timer change;
    - every lobby-only key refused in each of those phases, plus a mixed payload;
    - a non-host refused mid-game;
    - a mid-turn switch to clean re-masking a feed guess already in the Screen view, and off emptying it.
  - `sockets.test.ts` (+1): `drawSeconds: 50` → `invalidPayload`; the token Screen's change reaches a phone's view; a plain Screen gets `notHost`.
  - `client/src/lib/settings.test.ts` (new, 4) and `ScreenSettings.test.tsx` (new, 5): every setting and value listed, the default highlights, "Custom", the error line, the button only on the token Screen, and the preset in the summary.
- No new dependencies.

**Decisions:** DECISIONS 45 covers:
- the phases;
- a mixed mid-game payload refused whole;
- FINAL counted as mid-game;
- presets shown by `drawSeconds`/`cycles`/`hints`;
- the panel's layout and behaviour;
- where the mid-game `guessFeed` controls land (F24, F25).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: DECISIONS 45, this entry and the Kim check. Its "DECISIONS 38 is the wrong citation" was checked: row 38 does define view-time masking, so the comment stands. The mid-game `guessFeed` UI is F24 (`G`, the control bar) and F25 (the crown drawer), so it is not in Backlog.
- **secrets-fairness: PASS.** No leak; the handler touches only `settings`. Optional: a rate limit on `host:settings` (host-only and cheap), added to Backlog.
- **mobile-ux: PASS WITH FIXES.** Applied:
  - the lobby `inert` behind the panel;
  - `aria-disabled` instead of `disabled`, so focus isn't dropped;
  - the error reset on reopen (the panel remounts);
  - "About 4–5 min" as in the spec;
  - "Game text" for `copy`, so it can't be confused with Words;
  - text at 3.2vmin, with legends at 80% and the preset lines at full opacity;
  - the 1:1 and 16:10 column breakpoints;
  - the summary as a copy template.

**Notes for next session:**
- **F24:** the `G` key and the control bar send `host:settings {guessFeed}`; the reducer already allows it in any phase.
- **F25:** the crown phone's "Change" can reuse `SettingsPanel` (it takes `settings`, `sending`, `error`, `onSend`, `onClose`). The phone's drawer needs only the `guessFeed` row.
- **F45:** add the settings strings to the Taglish table.
- **F48:** custom words go in this panel (the spec's "the settings and custom words").

**How to try it:**
- Unit tests: `npx vitest run server/reducer.settings.test.ts server/sockets.test.ts client/src/lib/settings.test.ts client/src/components/screen`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), then **Settings ⚙**. Pick a preset or any value; the highlight follows the server's snapshot, and the lobby line updates.
- Automated: `npm run playtest -- .playtest/F22/scenario.ts` (gitignored). It runs a TV Screen, 2 phones and a portrait phone Screen. All steps pass:
  - the 45/60/80/100 options with 60 s pressed;
  - 80 s applied through the snapshot;
  - Quick and Barkada Night become active;
  - the panel fits 1920×1080 without scrolling, with the lobby inert behind it;
  - hints off → "Custom";
  - Esc returns focus to the button;
  - the summary names the preset;
  - no Settings button after Start;
  - the portrait Screen's panel scrolls.
  - Screenshots: `.playtest/F22/panel-open-tv-screen.png`, `panel-open-portrait-portrait.png`. No console errors.
  - Not covered through the UI: the mid-game restriction, since no UI sends it yet (F24/F25); the unit tests cover it.


## F21 — Overlapped choosing (2026-10-30)
**What changed:**
- **Reducer:**
  - Entering REVEAL (`endTurn`) deals the next turn as `upcoming` (`dealUpcoming`): the next connected player in this cycle, else the first connected one of the next cycle, whose `turnOrder` is built at that deal. `room.cycle` moves on only at take-up. No turn left → no deal.
  - `setPhase(d, phase, fx)` now re-schedules `chooseUp` for the open choice (CHOOSING's or `upcoming`'s) on every phase change: same `dealtAt + 12 s`, the dealt turn's id, the new epoch. `deal()` no longer schedules or sets the phase; callers put the turn in `turn` (then CHOOSING) or `upcoming`.
  - `drawer:choose` and `chooseUp` act on `upcoming` in REVEAL/SCOREBOARD and only set its word (`setWord`). `startDrawing` no longer picks the word.
  - `afterReveal`: a deal of this cycle is taken up, otherwise the cycle ends (`endCycle`: SCOREBOARD or FINAL). `afterScoreboard`: take up, or `startCycle` with no deal.
  - `takeUp`: chosen → DRAWING at once (the clock starts then); unchosen → CHOOSING until 12 s after the deal; drawer gone or disconnected → `returnDealt` and a standalone CHOOSING for the following player (or the cycle ends). A discarded first deal of a new cycle starts that cycle afresh with `startCycle`.
  - New helpers: `joinOrder`, `nextConnected`, `openChoice`, `scheduleChooseUp` (for F28's `resumeGo`).
- **`server/deck.ts`:** `returnDealt(deck, choices, chosen)` returns an undrawn deal and un-uses a chosen word.
- **Views:** `SecretView.chooseTimer`, the upcoming drawer's time left on the choice (frozen while paused), null otherwise.
- **Client:**
  - `Play.tsx` shows `WordChoice` (`next`) to the upcoming drawer in REVEAL/SCOREBOARD: "You draw next! Pick a word", the `chooseTimer` countdown, armed after 700 ms (`NEXT_CHOICE_ARM_MS`). One element keyed by turn id stays mounted into CHOOSING.
  - Once a word is chosen, `PhoneStandings` shows "✏️ You draw next! Get ready" (emoji `aria-hidden`) without the word.
  - Dev bots choose for whatever `secret.turnId` has open choices.
- **Tests:**
  - `server/reducer.overlap.test.ts` (new, 25):
    - the deal, its `yourTurn` and `chooseUp`; `revealDone` at 8 s; a disconnected player skipped; the next cycle's deal and order; no deal after the last turn;
    - a choice in REVEAL then DRAWING at once (also via `host:next`); refusals;
    - no choice → CHOOSING with 4 s left and a re-scheduled auto-pick, REVEAL's schedule stale; choosing in CHOOSING;
    - the auto-pick in REVEAL, ignored once chosen, and across SCOREBOARD (re-scheduled, the old one stale, then DRAWING in cycle 2); a SCOREBOARD choice via `host:next`;
    - the drawer left (words back, the following player dealt), left after choosing (word un-used), disconnected (they draw next cycle), reconnected (the deal stands), nobody following → FINAL;
    - a discarded new-cycle deal → the next player, or FINAL with nobody;
    - the `chooseTimer` view and its pause freeze; a pause refusing the choice and the auto-pick while keeping the deal.
  - `deck.test.ts`: `returnDealt`.
  - `views.leak.test.ts`: the synthetic `upcoming` is gone. The scripted game now deals for real: unchosen during REVEAL then CHOOSING, chosen during REVEAL then DRAWING, chosen during SCOREBOARD, with a positive control that only the next drawer's view carries the three choices.
  - `phoneViews.test.tsx` (+3): the cards with the heading and countdown; "Get ready" without the word; no line for anyone else.
  - `bots.test.ts` (+1): a bot picks during REVEAL.
  - Updated for the new flow, with no checks dropped: `reducer.turn` (the REVEAL effects now include the deal; `revealDone` takes up a deal from the reveal), `reducer.flow` (SCOREBOARD re-schedules the next cycle's `chooseUp`; cycle 2's drawer is dealt at the reveal), `reducer.choosing` (the reshuffle tests now trigger at the skip's REVEAL deal), `views.test` (`chooseTimer: null`).
- No new dependencies.

**Decisions:** DECISIONS 44 covers:
- the next cycle's order built at the deal, with `cycle` moving on at take-up;
- `chooseUp` following the open choice;
- choose and the auto-pick for `upcoming`;
- leave and disconnect handled at take-up;
- a discarded new-cycle deal → `startCycle`;
- kick, end and pause left for F28;
- `chooseTimer`;
- the phone's cards replacing its reveal.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied:
  - the countdown on the upcoming cards (`chooseTimer`);
  - no second SCOREBOARD after a discarded new-cycle deal;
  - DECISIONS 44, this entry and the Kim check.
  - Kick is still `notAvailable` (F28).
- **secrets-fairness: PASS WITH FIXES.** No leak found. Applied: the `views.test` expectation, the `takeUp` cycle fix, and a phase guard on the upcoming `chooseUp`. To Backlog: an optional `turnId` on `drawer:choose`.
- **mobile-ux: PASS WITH FIXES.** Applied:
  - `choosingNext` limited to REVEAL/SCOREBOARD;
  - the 700 ms arm for the next drawer's cards;
  - the emoji `aria-hidden` and `rounded-2xl` on the pill;
  - a SPEC-QUESTION and a DECISIONS line on the cards replacing the phone's reveal.
  - To Backlog: an "It was…" strip and focus management.
  - Left for Kim: the pill with a long reveal word at 360 × 560.

**Notes for next session:**
- **F22+:** nothing new.
- **F23 (late joiners):** append to the current `turnOrder` only while it is this cycle's. Once a next-cycle `upcoming` exists, `turnOrder` is already the next cycle's, so a joiner appended then draws next cycle. That is right, and they must not be appended twice.
- **F28:**
  - `resumeGo` must move `dealtAt` (of `turn` in CHOOSING and of `upcoming` in REVEAL/SCOREBOARD) by the paused time, then call `scheduleChooseUp(d, fx)`.
  - Kick must follow `leave`: a kicked upcoming drawer is discarded at take-up.
  - `host:end` must `returnDealt` and clear `upcoming`.
- **F29 (rematch):** `upcoming` must be null in FINAL, as it is today; a new game starts with `startCycle`.
- **F24:** `host:next` in REVEAL/SCOREBOARD now takes up `upcoming` (`afterReveal`/`afterScoreboard`).

**How to try it:**
- Unit tests: `npx vitest run server/reducer.overlap.test.ts server/views.leak.test.ts server/deck.test.ts client/src/components/phone client/src/dev`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), 3 phones via `npm run lan CODE`, or bots at `/dev/bots/CODE`. When a turn ends, the next drawer's phone shows "You draw next! Pick a word" with a countdown during the reveal. Tap a card: the pad opens when the reveal ends. Leave it: after the reveal the TV shows "… is choosing…" until 12 s after the deal.
- Automated: `npm run playtest -- .playtest/F21/scenario2.ts` (gitignored), a Screen and 3 phones.
  - Passed:
    - the next drawer gets the cards and the heading during REVEAL, and no card word is on the Screen or the other phone;
    - a chosen word opens the pad 8.0 s after the reveal;
    - across a round boundary, the cards then "Get ready", then drawing after the scoreboard;
    - with no choice mid-round, CHOOSING then the auto-pick.
  - A disconnected next drawer's replacement is dealt at take-up, not during the reveal. That is by design (DECISIONS 44).
  - Not run: leave from the cards (no Leave button on them, as in CHOOSING), kick, and pause (F28). The unit tests cover leave and pause.
  - No console errors.


## F20 — Cycles, scoreboard and final (2026-10-30)
**What changed:**
- **Reducer:**
  - `advance` deals the next connected drawer in this cycle's `turnOrder` (`dealNext`). Past the last one the cycle is done: **SCOREBOARD** while `cycle < settings.cycles`, with `scoreboardDone` at +6 s under auto-advance, else **FINAL**. A skipped last CHOOSING takes the same path.
  - `startCycle` (from `host:start`, `scoreboardDone` and `host:next` in SCOREBOARD) bumps `cycle`, rebuilds `turnOrder` from every player in the room in join order, and deals. With nobody connected to draw it ends the game.
  - `host:next` now works in REVEAL and SCOREBOARD (host only, refused while paused).
  - `revealDone` and `scoreboardDone` are refused while paused, like the other timers.
- **`server/ranking.ts`:** ported from Buzzr (`rankPlayers`, players only): shared ranks (1, 1, 3), ties in join order.
- **Views:**
  - New `PlayerChipView.rank`; it and `score` are set only in SCOREBOARD and FINAL. `me.rank` comes from `rankPlayers`.
  - Chips mark no drawer in SCOREBOARD.
  - During a turn, views carry only this turn's points (unchanged, now tested across real phases).
- **Client:**
  - `ScreenStandings` orders by the server's `rank`. `rankPlayers` in `lib/screen.ts` now only sorts. Medals are `aria-hidden` with an `sr-only` rank.
  - New `NextButton.tsx`: the token Screen's "Next ▶" in REVEAL and SCOREBOARD, in its own row above the footer, hidden while paused. F24's control bar replaces it.
- **Tests:**
  - `server/reducer.flow.test.ts` (new, 19):
    - 3 players × 2 cycles visits CHOOSING/DRAWING/REVEAL ×3, SCOREBOARD, ×3, FINAL, and every player draws once a cycle in join order;
    - 1 cycle has no SCOREBOARD and 3 cycles have two;
    - totals carry across cycles;
    - `scoreboardDone` is scheduled at +6 s and starts cycle 2;
    - `host:next` from SCOREBOARD, stale timers after it, host-only, refused in other phases;
    - no auto-advance (no timers, `host:next` drives);
    - paused timers;
    - a disconnected drawer is skipped and draws next cycle, a mid-game joiner draws next cycle, a SCOREBOARD leaver is dropped;
    - a skipped last CHOOSING goes to SCOREBOARD or FINAL;
    - nobody connected ends the game.
  - `server/ranking.test.ts` (new, 7): ported from Buzzr.
  - `views.test.ts` (+4): no totals or ranks in CHOOSING/DRAWING/REVEAL for any viewer; shared ranks in SCOREBOARD and FINAL for every viewer; no drawer on the scoreboard; totals hidden again in cycle 2.
  - `views.leak.test.ts`: both scripted games now reach a real SCOREBOARD and play cycle 2, with the late joiner drawing in the reducer game. The visited phases include SCOREBOARD. The two short games use `cycles: 1`.
  - `ScreenStandings.test.tsx` (new, 5): shared-rank order and medals, the scoreboard title, and the Next button's visibility.
  - These older tests assumed one cycle and now set `cycles: 1` explicitly: `reducer.turn`, `reducer.choosing` (2) and the `inkGateway` whole game.
- No new dependencies.

**Decisions:** DECISIONS 43 covers:
- what ends a cycle;
- the per-cycle join-order rebuild;
- nobody connected → FINAL;
- `host:next` and paused timers;
- ranks on chips;
- the interim Next button;
- the F29 rotation note.

Rows 18, 20, 25 and 33 now point to it.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied:
  - DECISIONS 43 and the amended rows;
  - the F29 roadmap note;
  - a comment on the client's rank fallback.
  - Its NextButton-test item was already covered by `ScreenStandings.test.tsx`. Clicking it is covered by the playtest, because the client tests have no DOM.
- **secrets-fairness: PASS.** Applied: the `paused` guard on `revealDone`/`scoreboardDone`, with a test, and the everyone-disconnected-in-SCOREBOARD note in DECISIONS 43.
- **mobile-ux: PASS WITH FIXES.** Applied:
  - Next moved out of the overlay into its own row, hidden while paused;
  - a focus-visible outline, `min-w-11`, the ▶ `aria-hidden`, and a milder disabled state with `aria-busy`;
  - medals `aria-hidden` with an `sr-only` rank.
  - Left for Kim: the 10-player fit at 16:9 and 9:16.

**Notes for next session:**
- **F21:**
  - `endTurn` should deal `upcoming` with `dealNext`-style logic. Remember that at the end of a cycle the next cycle's order is built first (`startCycle` does this today at SCOREBOARD's end).
  - Taking up `upcoming` replaces `dealNext`/`startCycle`'s deal.
  - Every `setPhase` while a choice is open must re-schedule `chooseUp`.
- **F23:** a late joiner is appended to this cycle's `turnOrder` if a turn remains. `startCycle` already includes them from the next cycle.
- **F24:** replace `NextButton` with the control bar, the `N` key and Space.
- **F28:** `resumeGo` must re-schedule `revealDone`/`scoreboardDone` (both refuse while paused). `host:end` → FINAL.
- **F29:** rotate cycles 2+ of a rematch game (the SPEC-QUESTION in `startCycle`).
- **F50 awards:** compute them where `advance`/`startCycle` set FINAL.

**How to try it:**
- Unit tests: `npx vitest run server/reducer.flow.test.ts server/ranking.test.ts server/views.test.ts server/views.leak.test.ts client/src/components/screen`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), 3 phones via `npm run lan CODE` or bots at `/dev/bots/CODE`. Play three turns: the TV shows "Round 1 of 2 done" with ranked totals, and each phone shows "#N of 3". After 6 s (or "Next ▶"), round 2 starts with the first player drawing. After three more turns: "Final scores".
- Automated: `npm run playtest -- .playtest/F20/scenario.ts` (gitignored). It runs a Screen and 3 phones, and all steps pass:
  - the phases are in order (6 turns, one SCOREBOARD, FINAL);
  - no totals appear mid-turn;
  - "Round 1 of 2 done";
  - FINAL ranks on the Screen and the phones match;
  - the word is absent from the Screen and guesser DOM;
  - Next works in REVEAL and SCOREBOARD.
  - Not covered: the auto-advance timers on their own, and ties (both are covered by unit tests).
  - Screenshot: `.playtest/F20/final-screen.png`.

## F19 — Hints and early end (2026-10-30)
**What changed:**
- **`server/hints.ts` (new, pure):**
  - `letterIndexes` lists the NFC code-point positions of the letters and digits, the same ones `maskWord` blanks.
  - `hintCap` is ⅓ of the letters, rounded down, and 0 under 4 letters.
  - `hintCount` is `min(2, cap)`.
  - `pickHint` picks a random unrevealed letter with the room RNG, or null at the cap.
- **Reducer:**
  - **Start drawing** schedules `hint` timers at 50% and 75% of `drawSeconds`, as many as `hintCount` allows, and none with hints off.
  - `timer hint` appends one letter to `hintIndexes`, stores the RNG state and sends a letter-free `fx hint` to all. Past the cap it is a no-op. It is refused while paused.
  - `sys:disconnected` of a guesser in DRAWING who hasn't got the word re-runs the all-guessed check, so a disconnected player doesn't hold the turn open.
  - Once scheduled, `allGuessed` is never cancelled, by a join or a reconnect. It is refused while paused.
  - Every view already masks from `hintIndexes`, so the Screen and every phone show the same letters.
- **Client:**
  - "Everyone got it! 🎉" (🎉 `aria-hidden`) shows above "It was…" on the Screen reveal and the phone reveal when `endReason` is `allGuessed`.
  - The blanks' screen-reader labels name the hint letters ("6 letters to guess. Hints: b, a"). This uses the new `hintLetters` in `lib/screen.ts`.
  - `RevealPanel` and `Blanks` are exported for tests.
- **Tests:**
  - `server/hints.test.ts` (9): letter positions match the mask, NFC, the caps, the count, picks never a space or a repeat, determinism and coverage.
  - `server/reducer.hints.test.ts` (22):
    - scheduling at 50%/75%, following `drawSeconds`, one hint for 4–5 letters, none under 4 or with hints off;
    - a reveal that every view shows identically;
    - a second, distinct letter, and the ⅓ cap including a two-word word;
    - determinism, staleness after the turn ends, and no word in the fx;
    - early end 1.5 s after the last eligible guesser;
    - disconnected guessers not blocking it (before or after the guess, and everyone gone);
    - no schedule for an early, correct-guesser or drawer disconnect;
    - a join, a reconnect or a hint in the window not cancelling it;
    - refused while paused;
    - two players.
  - `sockets.test.ts`: the timers include the hints, and a hint timer through the gateway updates both masks and sends `fx hint`.
  - `views.leak.test.ts`: a real hint in the scripted game. The Screen and guesser masks show exactly the hinted positions, and no `qz` token leaks.
  - `ScreenTurn.test.tsx` (new, 4): the reveal banner, and the blanks' labels.
  - `phoneViews.test.tsx`: the hint letters and label on a guesser, and the phone banner.
  - `screen.test.ts`: `hintLetters`.
- No new dependencies.

**Decisions:** DECISIONS 42 covers:
- the meaning of "letter" and the cap;
- scheduling only the hints the cap allows;
- `hint`/`allGuessed` refused while paused;
- the disconnect re-check, the uncancellable window, and the everyone-disconnected case;
- the banner and the labels.

DECISIONS 18's "not yet on a disconnect (F19)" now points to it.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: DECISIONS 42, this entry, the F19 Kim check, and the leak harness checking that the masks show exactly the hinted letters. Kick during DRAWING is still `notAvailable` (F28). F28 must route kick through the same early-end check as `leave`.
- **secrets-fairness: PASS WITH FIXES.** Applied:
  - `allGuessed` is refused while paused, with a test;
  - the everyone-disconnected case is tested and recorded;
  - the pause comments now name F28.
  - Left: hints share `rngState` with the deck. This is deterministic and leaks nothing, but a hint changes the later deal order.
- **mobile-ux: PASS WITH FIXES.** Applied:
  - the hint letters in the blanks' aria-labels on the phone and the Screen;
  - the Screen banner at `max(5vmin,24px)`, matching "Nobody got it!";
  - 🎉 `aria-hidden`;
  - the phone banner and "It was…" grouped with no gap between them;
  - a Screen reveal render test.
  - Left for Kim: the 360 × 560 fit of the phone reveal with a two-word answer.

**Notes for next session:**
- **F28 (pause, kick):**
  - `resumeGo` must re-schedule the hints still to come (fire times are `clockStart + 0.5/0.75 × drawMs`, and `clockStart` moves), and re-run `checkAllGuessed`. `hint`, `allGuessed` and `chooseUp` all refuse while paused.
  - Kick in DRAWING must call `checkAllGuessed` as `leave` does.
  - Earlier notes and comments said F23 for pause re-scheduling. The roadmap gives pause and resume to F28, and the reducer comments now say F28.
- **F34:** `fx hint` has no client consumer yet. Its "letter pop animation" goes there.
- **F35:** the reveal's "Everyone got it! 🎉" line is in `RevealPanel` and `PhoneStandings`. Restyle it there.
- **F40:** a disconnecting drawer doesn't trigger the early-end check, which is deliberate. F40's drawer away takes over.

**How to try it:**
- Unit tests: `npx vitest run server/hints.test.ts server/reducer.hints.test.ts server/views.leak.test.ts server/sockets.test.ts client/src/components`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), 3 phones via `npm run lan CODE`. Choose a word and wait. At 0:30 left (60 s turn), a letter appears in the blanks on the TV and the guessers' phones, and a second at 0:15 for words of 6+ letters. Have every guesser type the word: 1.5 s later the reveal shows "Everyone got it! 🎉".
- Automated: `npm run playtest -- .playtest/F19/scenario.ts` (gitignored). It runs a Screen and 3 phones plus a late joiner, and all steps pass:
  - the word is absent from the Screen and guesser DOM;
  - an 8-letter word showed exactly 2 hints (`_a______`, then `_a___s__`) at ~50%/75%, identical on the Screen and the guessers;
  - one correct guesser didn't end the turn;
  - the second did, with the reveal 1.73 s after the last guess (1.5 s plus network);
  - a phone joining 0.95 s into the window didn't cancel it.
  - Short words and disconnects are covered by the unit tests only.

## F18 — Deck and word choice (2026-10-30)
**What changed:**
- **`server/deck.ts` (new, pure):**
  - `allowedWords` filters the packs by the `words`, `spicy` and `difficulty` settings.
  - `newDeck` builds a new game's deck: every allowed word not used yet this session, shuffled with the room RNG.
  - `drawChoices` deals the topmost easy, medium and hard word in Mixed, filling a missing level from the nearest one, or three easy in Easy, easiest first. It reshuffles every allowed word and clears `usedIds` when fewer than 3 are left.
  - `chooseWord` puts only the chosen word in `usedIds` and the other two at the bottom of the deck. `returnChoices` puts all three at the bottom.
  - `easiestIndex` is the auto-pick; a custom word counts as medium.
- **Reducer:**
  - A deal now goes LOBBY/REVEAL → **CHOOSING** with `fx yourTurn` and `chooseUp` at `dealtAt + 12 s`.
  - `drawer:choose {index}` (new error `notDrawer`) and `chooseUp` (the easiest) set the word and start drawing (`inkOpen`, `drawUp`). `chooseUp` is refused while paused.
  - `host:skip` or the drawer leaving during CHOOSING returns the words and deals the next drawer, with no reveal or points (FINAL if nobody is left).
  - `host:start` builds the deck and refuses with the new `notEnoughWords` when fewer than 3 words are allowed.
  - New Screen-only `fx wordsReshuffled`.
- **Packs reach rooms:**
  - `Room.packs` holds the loaded, frozen packs. `index.ts` → `createApp({packs})` → `createRoom({packs})`.
  - `reduce` passes them by reference and never clones them.
  - `deck.remaining` is now word ids.
  - `words.v0.ts` is deleted. Tests deal from `server/test/packs.ts`.
- **Client:**
  - `WordChoice.tsx` shows the drawer three cards (word large, level tag, 2-line gloss), "Your turn to draw! ◔ 10s", "Hold your phone close 🤫" and "Tap one. No letters or numbers in your drawing!".
  - A tap locks the cards until the ack; a refusal unlocks them. Taps in the first 400 ms are ignored.
  - Guessers and the Screen keep "Mika is choosing a word…".
  - The Screen shows "All words used, reshuffling" for 4 s on `wordsReshuffled`, never over a drawing.
- **Dev bots** pick a random card after 1.5 s when auto-draw is on. Their decoy guesses are now abstract Tagalog words, because the old ones (tsinelas, jeepney) are now pack words; a test checks this against the shipped packs.
- **Tests:**
  - `server/deck.test.ts` (21): the filters, the new deck, choice levels and nearest-level fill, no repeats until exhausted, reshuffle, choose and return, auto-pick.
  - `server/reducer.choosing.test.ts` (25):
    - the deal and its effects;
    - Easy, the language filter, used words left out, `notEnoughWords`, packs shared;
    - choose and its refusals;
    - the auto-pick at any position, custom words as medium, refused while paused, stale after a choice or skip;
    - skip and leave in CHOOSING;
    - reshuffle with one Screen fx;
    - ten chosen words with no repeats.
  - `sockets.test.ts`: the auto-pick through the gateway.
  - `views.leak.test.ts`: now a `qz` pack and the real CHOOSING, with choose, auto-pick and a guesser's refused choose, plus an abandoned deal through to FINAL.
  - `phoneViews.test.tsx`: the cards and the guesser's "is choosing".
  - `bots.test.ts`: the choice and the decoys.
  - Existing tests now choose after `host:start` (`dealt`/`choose`/`started` helpers in `server/test/rooms.ts`, `startTurn` in `inkGateway.test.ts`).
  - Mutation-checked: an auto-pick of index 0 fails 2 tests; putting all three words in `usedIds` fails 4.
- No new dependencies.

**Decisions:** DECISIONS 41 covers:
- the packs on the room, shared and not cloned;
- id-only `deck.remaining` (measured: 0.9 ms → 0.04 ms a clone at 700 words);
- the filter, deal order and nearest-level fill;
- "runs out" meaning fewer than 3 left;
- `notEnoughWords` and `notDrawer`;
- `wordsReshuffled`;
- CHOOSING skip and leave;
- the 400 ms tap guard;
- bot choosing and the new decoys.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: this entry, DECISIONS 41, the F18 Kim check, the reducer header rewrap, and the F23 SPEC-QUESTION on `chooseUp`. Not done: a Screen render test for the reshuffle notice, because `Screen.tsx` is socket-driven with no render harness; the Kim check covers it.
- **secrets-fairness: PASS WITH FIXES.** Applied: `chooseUp` refused while paused, and the leak audit for an abandoned deal → FINAL. Left:
  - a drawer who *disconnects* in CHOOSING is auto-picked after 12 s, as in DRAWING (F40's drawer away);
  - `drawer:choose` has no per-socket cap (the existing Backlog item for `player:*` caps covers it).
- **mobile-ux: PASS WITH FIXES.** Applied:
  - gloss `line-clamp-2` and `overflow-hidden`, the word size `clamp(1.25rem, 7vw, 1.75rem)`, cards capped at `max-h-48`;
  - the 400 ms ghost-tap guard;
  - the timer hidden when null, with an `aria-hidden` ◔;
  - a bold, full-contrast level tag;
  - the Screen notice at `max(4vmin, 20px)` and never over DRAWING.
  - Left: the next drawer choosing during REVEAL (F21), and a fallback "Get ready…" text that only shows if a CHOOSING view has no choices (it never should).

**Notes for next session:**
- **F19:** nothing new. Hints start from `startDrawing` in `reducer.ts` (schedule them next to `drawUp`).
- **F20:** `advance` deals with `deal()`; the next cycle's order is built before dealing. An abandoned deal leaves `room.turn` holding the unchosen turn in FINAL; views gate choices on phase, so keep that gate.
- **F21:**
  - deal `upcoming` with the same `drawChoices`;
  - `choose` must also accept the upcoming drawer in REVEAL/SCOREBOARD (currently `wrongPhase`);
  - `WordChoice` already takes any view with `secret.choices`, so render it during REVEAL/SCOREBOARD with "You draw next! Pick a word";
  - discarding `upcoming` uses `returnChoices`.
- **F23:** pausing in CHOOSING must re-schedule `chooseUp` for the remaining time on `resumeGo` (move `dealtAt` forward). `chooseUp` already refuses while paused.
- **F29 (Rematch):** call `newDeck(allowedWords(...), d.deck.usedIds, rng)` as `start()` does; `usedIds` survives.
- **F48 (custom words):** add them in `allowedWords` and make one of three a custom word while any remain. `easiestIndex` already treats `lang: 'custom'` as medium.

**How to try it:**
- Unit tests: `npx vitest run server/deck.test.ts server/reducer.choosing.test.ts server/views.leak.test.ts client/src/components/phone client/src/dev`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE`, or bots at `/dev/bots/CODE` (a bot drawer picks a word after 1.5 s). The drawer's phone shows three cards; tap one to draw. Leave them for 12 s and the easy word is picked. The Screen and guessers show "… is choosing a word…".
- Automated: `npm run playtest -- .playtest/F18/scenario.ts` (gitignored). It runs a Screen at 1920×1080 and 3 phones, and all steps pass:
  - the drawer gets 3 cards, Easy/Medium/Hard in order, with "Hold your phone close 🤫";
  - the Screen and both guessers show "Mika is choosing…";
  - none of the three words is in the Screen's or guessers' HTML;
  - tapping card 2 opens the pad and the Screen shows "Mika is drawing";
  - there are no console errors.
  - Screenshot: `.playtest/F18/cards-mika.png`.

## F17 — Word packs and loader (2026-10-30)
**What changed:**
- **`server/packs.ts` (new, server-only):**
  - `packFileSchema` (zod, strict objects): `schemaVersion: 1`; pack and word ids `[a-z0-9-]` up to 40 characters; `title` 1–40; `language` `en`/`tl`; `rating` `family`/`spicy`; `word` 1–30; `alt` 0–6 (defaults to `[]`); `difficulty` 1–3; `gloss` 1–40. It also refuses:
    - a duplicate word id in a pack;
    - a `tl` word of difficulty 2–3 with no gloss;
    - any word or alternate that keeps fewer than 3 letters once normalised (filler-only forms like "The", and the 1–2 letter forms F14 flagged).
  - `parsePack` returns a frozen `Pack` of `WordEntry`s with ids `<packId>/<wordId>` and `lang` from the pack. On failure it throws `PackError`, listing every problem on its own line as `file: words.3.gloss: message ("word")`.
  - `loadPacks(dir)` reads every `*.json` in name order. It refuses a missing or empty directory, bad JSON, and a pack id used twice.
  - `findDuplicateWords` matches main words by normalised form, across packs and within one. `findAltClashes` finds an alternate that equals another word.
  - `packsDirFor` finds `data/packs` from `server/` or from `dist/server`. `loadPacksForStart` returns the start summary or the "Sketchy can't start." message.
- **`server/index.ts`:** loads the packs before listening and prints "Loaded 2 word packs (60 words)". An invalid pack prints the message and exits 1. Turns still deal from `words.v0.ts`, because F18 builds the deck.
- **`data/packs/en-everyday.json` and `tl-pinoy-life.json`:** the spec's sample tables, 30 family words each, exactly as written. Word ids are slugs of the words.
- **`npm run packs:check`** (`scripts/packs-check.ts`, with an optional directory argument):
  - checks every pack with the same `loadPacks`;
  - prints each pack's language, rating, word count and easy/medium/hard split;
  - warns on alternate clashes;
  - exits 1 on an invalid pack or a duplicate word.
- `match.ts`: the F14 SPEC-QUESTION now says packs refuse filler-only words. Custom words still should.
- **Tests:** `server/packs.test.ts` (25):
  - the shipped packs load (30 en + 30 tl, no duplicates or clashes), spot-checked word by word, and all 18 `tl` medium/hard words carry glosses;
  - a duplicate word id, a duplicate pack id, a 31-character word, an unknown language and a missing gloss each fail with a message naming the file, field and word;
  - so do a bad id, rating, difficulty or schema version, more than 6 alternates, a long gloss, an empty pack, an unknown key (`glos`), a short or filler-only word or alternate, bad JSON, and an empty or missing directory;
  - every problem is listed;
  - duplicates and clashes are found;
  - both build layouts resolve to `data/packs`;
  - the start message is checked.
  - Mutation-checked: relaxing the gloss rule fails 3 tests.
- No new dependencies.

**Decisions:** DECISIONS 40 covers:
- the packs being server-only, with strict schemas and id formats;
- the 3-letter minimum per form;
- where the packs are found in a build;
- duplicates failing `packs:check` without stopping the server, and clashes only warning;
- the loaded packs not being dealt until F18.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: the F17 Kim check; the start path pulled into the tested `loadPacksForStart` and `packsDirFor`; a word-by-word spot-check of the shipped content. Not done: a warning for an alternate that repeats its own word, because the spec's own table has three (`milktea`, `fish ball`, `pan de sal`) and `acceptedForms` dedupes them.
- **secrets-fairness: PASS WITH FIXES.** Applied: the `findAltClashes` warning. Noted for F18: `PackError` messages quote words. They only go to the boot log and `packs:check` today. Never pass one to an ack, and add a leak-test line when packs reach rooms. `data/` is never served (`express.static` covers only `dist/client`).

**Notes for next session:**
- **F18:** the reducer can't read files, so the loaded `Pack[]` (from `loadPacksForStart` in `index.ts`) has to reach room creation, as the room's deck source or through the gateway's deps. Then delete `words.v0.ts` and move `views.leak.test.ts`'s mock to a fake pack. The deck filter maps `settings.words` (`en`/`taglish`/`mixed`) to the pack `language` (`en`/`tl`) and `settings.spicy` to `rating`.
- **F51:** the Docker image must copy `data/` next to `dist/`, because the production server reads `../../data/packs` from `dist/server`. With no packs it stops with a clear message, so it fails closed.
- **M8 packs** (≥ 200 family words per language, ≥ 60 spicy): run `npm run packs:check` after every edit, and use the `word-pack` skill.

**How to try it:**
- `npm run packs:check`: both packs are listed as valid.
- Unit tests: `npx vitest run server/packs.test.ts`.
- Break a pack (remove `gloss` from `bahay-kubo` in `data/packs/tl-pinoy-life.json`). `npm run packs:check` and `npm run dev` then both print `data/packs/tl-pinoy-life.json: words.1.gloss: required for 'tl' words of difficulty 2–3 ("bahay kubo")`, and the server exits. Undo the change afterwards.
- `npm start` (after `npm run build`) prints "Loaded 2 word packs (60 words)".
- No UI change, so there is no playtest.

## F16 — Ink delay debug overlay (2026-10-30)
**What changed:**
- **Shared:**
  - `pong` is now `{t, serverNow}`, where `serverNow` is the server's wall clock.
  - `InkBatch` takes an optional 4th element, `sentAt`. It is zod-checked as `number ≥ 0`.
  - New `debug:rtt {}` event. Its ack is `{rtt: {pid: medianMs}}`, typed by `ClientAckData`.
- **Server:**
  - `sockets.ts` stamps `serverNow` on every pong.
  - `debug:rtt` answers Screens only (`notScreen`/`notJoined`). It shares the ping limiter. It reads each connection's samples from an `rttBySocket` map that is cleared on disconnect, so pings still cause no broadcasts.
  - `inkStore` keeps `sentAt` when it relays a batch with its refused strokes trimmed.
- **Client:**
  - `lib/clock.ts` (new, pure):
    - `offsetSample` is `serverNow − (t + rtt/2)`;
    - `createClockOffset` takes the median of the last 10 samples and offers `toServer`;
    - `percentile` is nearest-rank;
    - `createDelayWindow` keeps the last 200;
    - `stampBatch`, `recordPaint` and `isDebug` are here too.
  - `keepPinging` has a new `onServerTime` hook.
  - **Drawer** (`/play/CODE?debug=1`): each batch goes out stamped with its send time in server time. Nothing is stamped before the first pong. A resend is stamped afresh, and the kept batch is never changed.
  - **Screen** (`/screen/CODE?debug=1`):
    - pings for its own offset;
    - records "send → paint" on the animation frame after each applied batch;
    - shows `DebugOverlay` at the top left: p50/p95 over the last 200 batches, the same plus the 25 ms average flush wait, its clock offset, and each player's RTT. RTTs are polled every 2 s.
  - Without `?debug=1`, nothing changes except the extra `serverNow` field.
- **Tests:**
  - `client/src/lib/clock.test.ts` (16): the offset estimate (formula, true offset at any symmetric RTT, median that ignores a lopsided trip, last 10 only, bad samples), percentiles, the 200 window, `stampBatch` and `recordPaint`.
  - `ping.test.ts`: the `onServerTime` hook.
  - `sockets.test.ts`: pong `serverNow`; `debug:rtt` medians, its refusals and its limit.
  - `inkGateway.test.ts`: `sentAt` relayed to Screens.
  - `inkStore.test.ts`: `sentAt` kept on a trimmed relay.
  - `schemas.test.ts`: `sentAt` and `debug:rtt` cases.
  - `DebugOverlay.test.tsx`: the readout.
- No new dependencies.

**Decisions:** DECISIONS 39 covers:
- the `sentAt` tuple element;
- `serverNow` sent always;
- the Screen pinging only in debug mode;
- paint timed on the rAF after the canvas's;
- `debug:rtt` as a pull, ungated, sharing the ping limit.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: DECISIONS 39, this entry and the F16 Kim check. The stamping and paint recording are now pure helpers with tests.
- **secrets-fairness: PASS.** It noted that `debug:rtt` is ungated in production, which DECISIONS 39 makes deliberate. The shared limiter is now explained in a comment. Left open: `sentAt` has no upper bound (it is only relayed, inside the 4 KB batch cap), and the `pingLimiter` key purge carried over from F13.
- **mobile-ux: PASS WITH FIXES.** Applied:
  - the p50/p95 headline is larger (`max(3.2vmin,16px)`, the rest `max(2.2vmin,13px)`);
  - the overlay is capped at 45 vh × 45 vw, with the RTTs as a wrapping row;
  - one `debug:rtt` request is in flight at a time, and none is sent while the page is hidden;
  - no sample is taken while the tab is hidden (throttled frames);
  - the offset shows in ms.
  - Not done: choosing samples by lowest RTT. The spec says the median of the last 10, and the bias is in Notes below.

**Notes for next session:**
- The overlay is the spec's delay-budget measurement. The ground truth (240 fps video) is a Kim check.
- **F33's Screen layout pass:** the overlay sits at the top left at `z-20`. Keep that corner free of anything important, or move the overlay.
- The offset assumes the server stamps `serverNow` halfway through the round trip. It actually stamps it on receipt, so asymmetric links bias the number by up to half the difference between the two legs.

**How to try it:**
- Unit tests: `npx vitest run client/src/lib/clock.test.ts client/src/lib/ping.test.ts server/sockets.test.ts server/inkGateway.test.ts server/inkStore.test.ts client/src/components/screen`.
- In the app: `npm run dev`, Screen at http://localhost:5173/screen/CODE?debug=1, phones at `/play/CODE?debug=1` (via `npm run lan CODE`; add `?debug=1`). Draw on the drawer's phone and watch the top-left overlay.
- Automated: `npm run playtest -- .playtest/F16/scenario.ts` (gitignored). It runs a debug Screen and 2 debug phones, and all 5 steps pass:
  - the overlay shows;
  - an RTT row appears per player, and its ms value arrives;
  - the clock offset shows in ms;
  - after 6 strokes, p50/p95 appear (loopback: 1/2 ms);
  - there are no console errors.

## F15 — Near-miss feedback and the guess feed (2026-10-30)
**What changed:**
- **`server/slurs.ts` and `server/profanity.ts` (new, pure):**
  - `slurs.ts` holds English and Tagalog slurs and hate terms. `profanity.ts` holds ordinary profanity, the matcher `hasListedWord`/`feedWords`, and `feedText(text, mode)`.
  - Entries: `word` is a whole word, `stem*` a prefix, `*part*` a part of a word.
  - Matching: NFKD, lowercase, digit look-alikes, and symbols read as letters only before a letter ("sh!t", not "hi!"). Letter runs are cut to two and to one, and the whole guess is also tried with its spaces removed ("f u c k", "puta ng ina").
  - A listed word masks the whole guess (`null` → `•••`). Slurs are masked in every mode, and profanity unless the mode is `'all'`.
- **Reducer:** `turn.feed` and `turn.closeGuesses` keep the text as typed. `FeedItem.text` is now `string` and server-only. The Screen's `wrongGuess` fx is masked by the mode, and under `'off'` it carries no text (for F34's "Bea is guessing…" pulse). The F14 SPEC-QUESTIONs are resolved.
- **Views:** `guessView` masks by the room's `guessFeed` when the view is built. That covers the feed, the reveal's `closeGuesses` and the drawer's `lastGuess`, so a mid-turn switch to `'clean'` masks what is already up. Under `'off'` the feed is empty, and anything still shown is masked as under `'clean'`.
- **Phone:**
  - A `nearMiss` fx shows "So close!" for 1.5 s in the guess box's note (re-announced on a repeat). A near-miss count drives it, and the note only fires on a change after the box mounts.
  - The phone's own list now shows a close guess as "tsinelas ko ≈" in amber, with screen-reader labels "(close)"/"(wrong)" behind the glyphs.
  - The `addOwnGuess` helper (`lib/phone.ts`) keeps the last 5 per turn. The `showNotice` timer is cleared on unmount.
  - The ✓ panel ("✓ You got it! +270", never the word) was already there. It is covered by `phoneViews.test.tsx`.
- **Tests:**
  - `server/profanity.test.ts` (38): look-alikes, trailing punctuation, each mode for rude, slur and everyday words (class, cocktail, shuttlecock, putahe, leche flan, Negros, shiitake, analysis, bitcoin…), stems and parts, letter runs, and the list format.
  - `server/reducer.guess.test.ts` (11): `nearMiss` only to the guesser, and the close guess in no view before REVEAL. Close guesses are masked at the reveal. The feed and the `wrongGuess` fx under `'all'`, `'clean'` and `'off'`. A slur is in no view under any mode. The drawer's latest guess is masked per mode. A mid-turn switch re-masks. A correct guess is never fed.
  - `phone.test.ts`: `addOwnGuess` (3).
  - `phoneViews.test.tsx`: the ≈ and ✗ marks and their labels.
  - Mutation-checked: leaving out masking in `guessView` fails 8 tests, and in the fx fails 3.
- No new dependencies.

**Decisions:** DECISIONS 38 covers:
- the list format and how matching works;
- whole-guess masking;
- masking at view time and in the fx at send time;
- what `'off'` does;
- the phone's note and the ≈ marks;
- the left-out words and the questions for Kim.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: DECISIONS 38, the SPEC-QUESTIONs in `views.ts` and `reducer.ts`, the F15 Kim check, this entry, and more negative cases. Accepted: "So close!" has no unit test, since the client has no DOM test environment. It is proven by the playtest instead.
- **secrets-fairness: PASS.** Noted for F34: `wrongGuess` arrives as `null` both when masked and under `'off'`, so the Screen must read `settings.guessFeed` to pick `•••` or "is guessing…". After a mid-turn mode change the bubbles (masked when sent) and the list (masked at view time) can briefly disagree, and switching `'off'` → `'all'` shows the guesses made while off. Both are accepted, since the setting may change any time.
- **mobile-ux: PASS WITH FIXES.** Applied: screen-reader labels for ≈/✗, the timer cleared on unmount, and an amber tint on close guesses. Open: fit at 360×560 with the keyboard up and 5 long guesses, which F14's list already had. It goes to F33/F34's layout pass.

**Notes for next session:**
- **F34:** render the `wrongGuess` fx: `text` is `null` under `'off'` ("Bea is guessing…" pulse), or `•••` otherwise. The sidebar keeps its 2–4 latest guesses (DECISIONS 28), and the spec's 8 come with F34.
- **F21 (settings) and the `G` key:** `guessFeed` changes need no extra work, because views re-mask on the next broadcast.
- **F36:** the drawer's `lastGuess` is already masked. "Bea is close!" needs a `closeAlert` fx from the close branch in `guess()`.

**How to try it:**
- Unit tests: `npx vitest run server/profanity.test.ts server/reducer.guess.test.ts client/src/lib/phone.test.ts client/src/components/phone`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE` or bots at `/dev/bots/CODE`. As a guesser, type the word with one letter changed: "So close!" shows under the box, the guess is listed with ≈, and the TV shows nothing until "Almost:".
- Automated: `npm run playtest -- .playtest/F15/scenario.ts` (gitignored). It runs a Screen at 1920×1080 and 3 phones (one at 360×560), and all steps pass:
  - "So close!" shows on the near-misser only and never on the Screen, the drawer or the other guesser;
  - a wrong guess shows in the Screen feed;
  - the word is in no Screen or guesser text before the reveal;
  - a correct guesser sees "✓ You got it! +290" without the word, and the Screen chip shows ✓;
  - there are no console errors.
  - The `'clean'`/`'off'` modes can't be switched in the UI until F21, so they are covered only by the unit tests.

## F14 — Guess matching (2026-10-30)
**What changed:**
- **`server/match.ts` (new, pure):**
  - `normalize` follows the spec's five steps: NFKD and strip marks, lowercase, everything but letters and digits to spaces, drop leading fillers repeatedly, drop the spaces.
  - `acceptedForms` normalises the word and each alternate, dedupes them and drops empty forms.
  - `isCorrect` accepts an accepted form, or for `lang: 'en'` a form plus `s`/`es`, alternates included.
  - `isClose`: Damerau–Levenshtein (optimal string alignment, by code point) of ≤ 1 for forms up to 6 letters and ≤ 2 from 7; or the guess contains a form; or the form contains a guess of at least 4 letters and 60% of its length.
  - `matchGuess` normalises once and returns `correct`/`close`/`wrong`. `guessRejection` returns `emptyGuess`/`guessTooLong`. `editDistance` is exported for tests.
- **Reducer `player:guess`:** `normalizeV0` is gone.
  - Refusal order: phase → paused → player → drawer → already got it → `tooLate` → `emptyGuess`/`guessTooLong` → `slowDown` (new `ReduceError` codes).
  - The 700 ms per-player limit uses `turn.lastGuessAt` (new `Turn` field) on arrival time. Only guesses that pass start it, and refused guesses aren't counted.
  - **Close guesses** get `fx nearMiss` to that phone only, are kept in `closeGuesses` (the last 3) and counted in `closeCount`, and never reach the feed or a Screen fx. This pulls the reducer half of F15's first bullet forward, because feeding "tsinelas ko" would show the word.
- **Phone:**
  - `guess()` in `Play` returns the ack.
  - `guessAnswer` (`lib/phone.ts`) maps `slowDown` to the "Slow down" note plus a restore.
  - `GuesserTurn` shows the note for 1.5 s in a polite live region under the box (no room taken while empty, cleared for 50 ms before a repeat so it is announced again). It puts the guess back if the box is still empty and keeps focus.
- **Tests:**
  - `server/match.test.ts` (35): every row of the spec's matcher table through `matchGuess`/`isCorrect`/`isClose`, plus empty and 41-character rows, normalisation (fillers, marks, emoji, digits, other scripts), plurals on alternates only for `en`, empty forms, and the distance and 60% boundaries.
  - `reducer.turn.test.ts` has 8 new tests: normalised and plural correct, alternates, close → `nearMiss` only with summary counts, last-3 close guesses, empty/too long refused uncounted, 699/700 ms, the window not restarted by refusals.
  - `views.leak.test.ts`: the pending `it.fails` near-miss test is now a plain `it`. The gateway run adds a near miss per turn, audited at every checkpoint, plus `closeGuesses` at REVEAL. Its fake monotonic clock steps past 700 ms between one guesser's guesses.
  - `phone.test.ts` covers `guessAnswer`.
  - Mutation-checked: dropping the limit, the plural rule, the 60% bound or the close branch each fails tests.
- No new dependencies.

**Decisions:** DECISIONS 37 covers:
- the normalisation details;
- empty forms dropped (filler-only words can't be guessed; SPEC-QUESTION);
- plurals on alternates;
- the optimal-string-alignment distance;
- the refusal order;
- the limit's place and window;
- close guesses held back now;
- the phone's note and restore.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: this entry. Accepted in DECISIONS 37: empty or too-long guesses are refused before the limit. A gateway-wide `player:*` cap went to the Backlog.
- **secrets-fairness: PASS.** It confirmed close guesses are held back and that the new codes carry no word. Noted for F17: forms of 1–2 letters make almost anything close. Noted for F15: never relax `close`, since `wrong` guesses reach the Screen as typed.
- **mobile-ux: PASS WITH FIXES.** Applied: no reserved space for the empty note, a repeat re-announced, refocus on restore. Accepted: a guess refused after the player typed again isn't restored (the note still shows).

**Notes for next session:**
- **F15:** the reducer already sends `nearMiss` and fills `closeGuesses`/`closeCount`. What's left:
  - "So close!" on the phone: reuse `GuesserTurn`'s note, with an `fx` listener in `Play` setting it;
  - masking per `guessFeed` for the feed, `wrongGuess` and `closeGuesses`;
  - the feed UI.
  - `wrong` guesses are safe on the Screen only because anything near the word is `close`. Keep `matchGuess` as the single gate.
- **F17:** `packs:check` should refuse words or alternates that normalise to nothing (filler-only) or to fewer than 3 letters. Custom words should be refused the same way.
- `Turn.lastGuessAt` is per turn. Rematch and turn starts get a fresh one.

**How to try it:**
- Unit tests: `npx vitest run server/match.test.ts server/reducer.turn.test.ts server/views.leak.test.ts client/src/lib/phone.test.ts`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE` or bots at `/dev/bots/CODE`.
  - "The TREE!" or "trees" counts for *tree*.
  - "tree ko" is silent on the TV until "Almost:" at the reveal.
  - Two fast guesses show "Slow down".
- Automated: `npm run playtest -- .playtest/F14/scenario.ts` (gitignored). It runs a Screen and 3 phones, and all 6 steps pass:
  - a filler, case and punctuation guess, and a plural, are correct;
  - a close guess stays off the Screen and shows at REVEAL;
  - "Slow down" appears and the text is restored;
  - "!!!" is refused silently;
  - the word is not in the Screen or guesser DOM;
  - there are no console errors.

## F13 — Latency-corrected scoring (2026-10-30)
**What changed:**
- `server/fairness.ts` (new): `addRttSample`, `medianRtt` and `oneWayMs` ported from Buzzr, plus `correctedAt(receivedAt, oneWayMs)`, which subtracts the one-way latency capped at `MAX_LATENCY_CORRECTION_MS` (250). Buzzr's buzz ranking and collection window are not ported.
- **Reducer `player:guess`:**
  - The guess is timed at `sentAt` = its corrected time.
  - `tooLate` when `receivedAt > endsAt + GRACE_MS` or `sentAt > endsAt`, before matching (300 ms grace window).
  - `elapsedMs = max(0, sentAt − clockStart)`.
  - `turn.correct` is kept in corrected-time order, so Example 4's Ana is listed first; the `correct` fx's `order` is the insertion position.
  - The stored `oneWayMs` is the measured value, cleaned of NaN and negatives.
- **Gateway (`server/sockets.ts`):**
  - `ping` → `pong {t}` with an ack; the server times the RTT sample from the emit to the ack (timeout 5 s).
  - Each connection keeps its last 10 samples; `player:guess` sends `oneWayMs = median / 2`.
  - `ping` limited to 5 per second per socket (`rateLimited`).
- **Shared:** `RTT_SAMPLES`, `PONG_ACK_TIMEOUT_MS` and `PING_RATE_LIMIT` in constants. In types, `pong` takes an ack, and `rateLimited` is no longer `/ink`-only.
- **Phones:** `client/src/lib/ping.ts` (new) `keepPinging` pings at once on connect and then every 2 s. It acks each `pong`, pauses while the page is hidden and pings at once when it shows. Its stop function removes its listeners. It is wired into `Play.tsx` and the dev bots (bots now ping; DECISIONS 32's "bots don't ping" is superseded). `FakeSocket` gains `off`.
- **Tests:**
  - `server/scoring.test.ts`: all four worked examples exactly through the reducer (270/225/145/0 + 320; 290/285/275/260 + 555 with `allGuessed` 1.5 s after Carlo; all 0; Ana 30.060 s and Bea 30.085 s, both 225, Ana listed and announced 1st). Also the cap, the floor at 0, the arrival-order tie, and the grace window: accepted at ≤ `endsAt` corrected (also exactly at it), rejected after it, the cap inside the window, rejected after `endsAt + 300`, and a late wrong guess neither fed nor counted.
  - `server/fairness.test.ts`: ported median tests plus `correctedAt` (cap, at and under the cap, bad latency).
  - `server/sockets.test.ts`: RTT timed from `pong` to ack → median 240 → `oneWayMs` 120 on the guess; an unacked pong gives no sample; the ping rate limit.
  - `client/src/lib/ping.test.ts` (6), plus a bot ping test.
  - `reducer.turn.test.ts`: two tests now expect the corrected time (their 40 ms latency used to be ignored).
  - Mutation-checked: removing the cap fails 3 tests and appending instead of ordering fails Example 4. The raw `endsAt + GRACE_MS` bound can't fail on its own, because the 250 ms cap is below the 300 ms window. It is kept as the spec's explicit limit.
- No new dependencies.

**Decisions:** DECISIONS 36 covers:
- the server-timed RTT (pong ack);
- per-connection samples;
- the ping limit;
- the hidden-page pause and the immediate ping;
- the `tooLate` rule before matching;
- corrected-time ordering and the fx `order`;
- the floor at 0;
- the uncapped stored `oneWayMs`.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: DECISIONS 36, this entry and the F13 Kim check.
- **secrets-fairness: PASS** (no leaks). Applied: `ack?.()`, and a note in DECISIONS 36 on inflated RTT from delayed acks, bounded by the cap. Not done: dropping `pingLimiter` keys on disconnect (they are swept every window anyway).
- **mobile-ux: PASS WITH FIXES.** Applied: an immediate ping on connect (a reconnected phone had no sample for 2 s), the pause while hidden, and the stop function removing its listeners, each with a test. Accepted: pings start before the join succeeds (harmless; the server keys samples by connection).

**Notes for next session:**
- **F14:** `match.ts` replaces `normalizeV0`. Keep the `tooLate` check before matching, and put the 700 ms guess rate limit in the gateway or reducer, next to the latency correction.
- **F23 (pause):** move `clockStart` (and `endsAt`) forward by the paused time. The correction already measures from `clockStart`.
- **The debug overlay feature:** RTT per player is still only in the gateway's closures. Surfacing it needs a gateway → Screen path that causes no broadcasts on every ping.
- The `correct` fx `order` may be stale if a later arrival slots in before it. Render the order from the view's `turn.correct`, as `views.ts` does.

**How to try it:**
- Unit tests: `npx vitest run server/scoring.test.ts server/fairness.test.ts server/sockets.test.ts client/src/lib/ping.test.ts`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE` or bots at `/dev/bots/CODE`. Points for a correct guess now run from the latency-corrected time.
- Automated: `npm run playtest -- .playtest/F13/scenario.ts` (gitignored). It runs a Screen and 3 phones and checks:
  - each phone's WebSocket sends `ping` every 2 s and gets `pong`;
  - a guess about 5 s in shows +285 on the phone and the Screen;
  - the word is absent from the Screen and guesser DOM;
  - there are no console errors.

## F12 — Ink sequence, resend and snapshots (2026-10-30)
**What changed:**
- **`server/inkStore.ts` (new): the InkStore.** It holds each room's latest turn log, live from `inkOpen` until `inkClose` freezes it, plus the frozen logs it keeps for the gallery (4 MB per room, oldest dropped first).
  - **Sequence:** a duplicate `seq` is ignored. A gap is dropped and asks for a resend, at most once a second per gap.
  - **Caps:** applied op by op, with the soft 200 KB cap on the visible picture (new strokes refused; undo and clear still work) and the hard 400 KB cap on the whole stack (only undo).
  - **Relay:** refused ops are left out of the relayed batch, which keeps its `seq`.
  - **Snapshots:** come from `stackOps`.
- **`server/inkGateway.ts`:**
  - **Batches:** they go through the store, in this order: rate limit → drawer, phase and turn checks → store → relay. A refused batch reaches neither the stack nor the Screens.
  - **Snapshots:** a Screen's `ink:hello` gets the latest turn's snapshot, and the current drawer's hello in DRAWING gets its own.
  - **Drawer sync:** `ink:sync` → `ink:state`. A gap gets `ink:resend {turnId, from}` and the `inkGap` ack. A full canvas gets the `inkFull` ack.
  - **Gallery:** `ink:get` serves frozen turns to Screens only (`notScreen`, `inkNotKept`).
  - **Invalid batches:** 20 in a turn disconnect the socket.
- **Drawer client:**
  - `drawerSync` also retries an unanswered hello or sync, resends 30 batches per sync, and resyncs after a `rateLimited` ack or when a pause lifts.
  - `inkSender` keeps every batch and has `held`/`start`/`hold`/`release`/`resendAfter`.
  - `client/src/ink/drawerSync.ts` (new) does hello → snapshot (adopted with strokeId renumbering via `mergeSnapshot`) on a fresh sender, and sync → state → resend of the unchanged kept batches on a reconnect.
  - `Play` routes `/ink` events to it through a `DrawerInkLink`.
  - `DrawPad` starts its sender held and merges the snapshot under its own strokes.
- **Screen:** `createScreenInk` applies batches in `seq` order, drops repeats, says hello again on the first gap and applies `ink:snapshot`.
- **Tests:**
  - `server/inkStore.test.ts` (16, including the action cap).
  - `server/inkGateway.test.ts` has 13 new tests (including the hello/sync/get rate limits). Among them: a Screen reconnecting mid-turn rebuilds the exact stack; a dropped drawer resends without duplicates; a drawer reload end to end through the real `inkSender` + `drawerSync`; gap/resend; sync refusals; `ink:get`; the soft cap over the wire; invalid-batch disconnects. The whole-game test now allows exactly the drawer's own snapshot.
  - `client/src/ink/drawerSync.test.ts` (13: hello/snapshot, reload renumbering, drop → sync → resend, `ink:resend`, retries, paced resends, rate-limited acks), plus new tests in `inkSender.test.ts` (4) and `lib/ink.test.ts` (5).
  - Mutation-checked: turning off strokeId renumbering or applying duplicates fails tests.
- No new dependencies.

**Decisions:** DECISIONS 35 covers:
- the visible-picture measure for the soft cap;
- refused ops stripped while the batch keeps its `seq`;
- `turnId` added to `ink:resend`;
- the resend-ask throttle;
- snapshots of a frozen latest turn for Screens;
- `ink:sync` allowed while paused;
- `ink:get` acks;
- invalid-batch counting;
- the held drawer sender and its unrenumbered resends.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied:
  - DECISIONS 35, superseding the F12 parts of 23 and 34;
  - `SPEC-QUESTION`s at the cap and strip sites and at the reducer's `hasInk`;
  - the F12 Kim check;
  - the end-to-end drawer-reload test through the real sender and sync;
  - the gateway opening a missing log on the drawer's hello.
- **secrets-fairness: PASS WITH FIXES** (no leaks or routing changes). Applied:
  - per-socket rate limits on hello, sync and get;
  - paced resends (30 per sync);
  - batch acks read for `rateLimited`;
  - hello and sync retries;
  - the action cap and the per-action overhead in the room budget.
  - Deferred to F32: showing `inkFull` and keeping undo in step after it. Noted: an unauthenticated socket may watch as a Screen (DECISIONS 22).
- **mobile-ux: PASS WITH FIXES.** Applied:
  - hello retry (the pad held forever on an unanswered hello);
  - a resync when a pause lifts and on a rate-limited ack (a lost last batch);
  - new tests for these.
  - The playtest's drawer-reload step then caught a real bug: `emit` detached from the timed socket in `Play`, now fixed.
  - Deferred: undo and clear before the snapshot (F32); an uncapped `kept`; strokes pending at the buzzer while offline (DECISIONS 35).

**Notes for next session:**
- **F32:** map the `inkFull` ack to "Canvas full: undo or clear to keep drawing" (the server dropped the new strokes but kept the batch's `seq`). The pad then differs from the server, so re-sync the pad: the simplest way is a fresh `ink:hello`, which only a not-started sender adopts, so add a `resync` path or a local pop. Undo and clear before the snapshot arrives (held sender) must pop local actions only.
- **Gallery (F-later):** `ink:get` → `{ok, turnId, actions}`. `inkNotKept` means "Drawing not kept"; `hasInk` in the reducer is still always `true` (SPEC-QUESTION at `server/reducer.ts`).
- **Rematch/Back to lobby:** emit `inkReset` from the reducer when those land; the store's `reset` is ready.
- **Bots:** they use an unheld sender with no resync; a bot that drops mid-turn leaves a gap until its next batch triggers `ink:resend`, which they ignore. Fine for dev.
- The first batch of every turn waits one `/ink` round trip for the (empty) snapshot. The pad draws at once.

**How to try it:**
- Unit tests: `npx vitest run server/inkStore.test.ts server/inkGateway.test.ts client/src/ink client/src/lib/ink.test.ts`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), and a drawer from `/dev/bots/CODE` or a phone via `npm run lan CODE`.
  - Reload the Screen tab mid-drawing: the drawing comes straight back.
  - On a phone drawer, reload mid-turn and keep drawing: the pad shows the drawing so far and the TV continues it.
- Automated: `npm run playtest -- .playtest/F12/scenario.ts` (gitignored, 9 steps). It runs a Screen and 3 phones and checks:
  - a Screen reload mid-turn restores the same ink;
  - the drawer offline → draws → back online shows the new stroke on the TV;
  - a second Screen reload matches the live canvas, so nothing was doubled;
  - a drawer reload restores its own pad, its next stroke reaches the TV, and a Screen snapshot then matches the live canvas;
  - guessers have no canvas;
  - the word is absent from the Screen and guesser DOM.

## F11 — Ink codec and action stack (2026-10-30)
**What changed:**
- `shared/ink.ts` (new) is the one codec and action stack for the drawer, the server and the Screen:
  - **Codec:** `encodeDeltas`/`decodeDeltas`. Decoding clamps each point to the grid and continues from the clamped point.
  - **Ops and batches:** `pointOps` (≤ 200 points per `p`), `strokeOps`, `stackOps` (ops that rebuild a stack exactly, for F12's snapshots), and `packBatches` (4 KB split, moved out of `inkSender`).
  - **Simplification:** `farEnough` (radial filter, `INK_RADIAL_MIN` = 3). `simplifyIndices`/`simplify` is an iterative RDP at `INK_RDP_EPSILON` = 1 that always keeps both ends, and also splits any span longer than `INK_SEGMENT_MAX` = 24 at its middle point.
  - **Action stack:** `createInkStack`, `pushStroke`, `popAction` (`u`), `pushClear` (`c`), `applyInkOps` (returns what to repaint), `visibleStrokes`.
- **Drawer:**
  - `client/src/ink/inkSender.ts` filters points as they arrive and simplifies the pending points from the last sent point at each flush. At `end` it adds the finger's last raw point.
  - It gains `undo()` and `clear()`, which end the stroke in hand and flush at once. There is no UI for them yet (F32).
  - `DrawPad` keeps its local picture in the shared stack and still draws every raw point.
- **Screen:** `client/src/lib/ink.ts` keeps only rendering and `createScreenInk`, on top of the shared stack (`InkPicture` = `InkStack` + `turnId`).
- **Server:**
  - `server/inkGateway.ts` applies each relayed batch to the room's turn stack (`turnInk(code)`). The stack starts on `inkOpen` (or a batch for a newer turn), is dropped on `inkReset`, and is dropped on expiry through `forget`, called from the sweeper in `server/index.ts`.
  - The batch is still relayed unchanged.
  - Past `INK_TURN_HARD_MAX_BYTES` (400 KB applied per turn) batches are refused with the new `inkFull` code and are neither applied nor relayed.
- **Tests:**
  - `shared/ink.test.ts` (new, 22 tests). The v0 stack tests moved here from `client/src/lib/ink.test.ts`, each with an equivalent.
  - `inkSender.test.ts`: radial filter, RDP per flush, the dot, undo/clear, the segment cap, and an end-to-end circle within 3 + ε of the drawn line.
  - `inkGateway.test.ts`: the server's stack equals what the Screen rebuilds through clamping, clear, undo and undo-of-clear, and `inkFull`.
- No new dependencies.

**Decisions:** DECISIONS 34 covers clamping on decode, the filter and RDP order, the end point, `INK_SEGMENT_MAX` (it keeps smoothed corners tight; the spec's midpoint quadratics would otherwise round them far more on the Screen than on the pad), one stack per room until F12, and the hard 400 KB ceiling. Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: DECISIONS 34, and a note that the sender test's bound is end to end.
- **secrets-fairness: PASS WITH FIXES.** No leaks or routing changes. Applied: the hard memory bound with a test (clear spam grew the stack without limit), and a comment on reused strokeIds in `popAction`.
- **mobile-ux: PASS WITH FIXES.** Applied: `INK_SEGMENT_MAX` with tests (corners after long simplified runs were cut on the Screen), an `F32:` note at the pad's stack, and wrapped comments. Deferred: per-frame `visibleStrokes` and per-event tuple allocations in `DrawPad` (cheap now; revisit with F32's undo/clear).

**Notes for next session:**
- **F12:** turn the gateway's `turns` map into the `InkStore`.
  - Keep the order: validate (`seq`, the 200 KB soft cap with undo/clear allowed) → apply → relay. A refused batch must reach neither the stack nor the Screens; add a test for that.
  - Freeze at `inkClose`, which does nothing now.
  - `stackOps(stack)` + `packBatches` give a snapshot's batches. The 400 KB `inkFull` ceiling stays as the hard bound above the soft cap.
  - The drawer's resend can reuse `packBatches` (kept batches).
- **F32:** wire undo/clear to `sender.undo()`/`clear()` and to `popAction`/`pushClear` on the pad's stack, then `repaint()` (the note is in `DrawPad`). Map the `inkFull` ack to "Canvas full" alongside F12's soft cap.
- The drawer's pad shows raw points and the Screen shows filtered ones (within 3 + 1 grid units, about 1.3 px on a 328 px pad).

**How to try it:** `npx vitest run shared/ink.test.ts client/src/ink server/inkGateway.test.ts`. In the app: `npm run dev`, then http://localhost:5173 on the laptop and tap **Start**. Open http://localhost:5173/dev/bots/CODE, spawn 2 bots and Start. Bot 1's house doodle appears on the Screen through the new filter and RDP. Or join from a phone (`npm run lan CODE`) and draw. Automated: `npm run playtest -- .playtest/F11/scenario.ts` (gitignored, 5 steps). It runs a Screen and 3 phones, checks that a drawer's drag, a second stroke and a tap-dot all add ink to the Screen canvas, that guessers have no canvas, and that the word is not in the Screen's or guessers' DOM.

## F10 — Secrecy leak tests (2026-10-30)
**What changed:**
- `server/views.leak.test.ts` (new):
  - **Marked words.** `vi.mock('./words.v0.js')` replaces the v0 words with `qz`-marked words (`qzwN`), alternates (`qzaN`/`qzbN`) and glosses (`qzgN`).
  - **The audit.** `audit(label, room, now, effects)` serialises the views of both Screens and every player, then checks each `qz` token against `allowedFor(room, audience)`. A viewer may see: the public word from REVEAL on (every past word in FINAL), the drawer's own choices, word and glosses in CHOOSING/DRAWING, and the `upcoming` drawer's in REVEAL/SCOREBOARD. Screens may also see close-guess text from REVEAL on. Alternates are never allowed. `fx` effects are checked per recipient; internal effects must be public-only.
  - **Scripted reducer game.** It runs: lobby, then turn 1 with a crowned drawer, a wrong guess, a right guess and a late joiner. Then REVEAL, and turn 2, where the crowned guesser guesses right and the crown passes on leave. Then turn 3 with the new crowned guesser right, and FINAL. CHOOSING (before and after choosing), SCOREBOARD, pause and resume, `upcoming` and close guesses are built by hand (`synth`). The test asserts that all six phases were audited. Positive controls (the drawer gets the word and gloss, the Screen gets the reveal, close guesses and the gallery, the upcoming drawer gets their cards) keep the check from passing vacuously.
  - **Alternates test.** A second test checks that no alternate reaches anyone, the drawer included, in any phase.
  - **Near-miss test (`it.fails`).** A real guess of the word plus "x" reaches the Screen's feed in DRAWING, because v0 feeds guesses raw (DECISIONS 18). F15 must turn this test into `it`.
  - **Socket-level game.** Three turns through the real `attachSockets`, with a Screen with the token, a Screen without it, 3 players and a late joiner. After a `ping` round trip on every socket, it checks every `state`, `fx` and ack each socket received, and every `console.*` line. It also covers refused guesses of the word (`drawerCannotGuess`, `alreadyGuessed`, too long → `invalidPayload`, `wrongPhase` in REVEAL). A one-off store failure during the right guess forces the gateway's logged error path, and the test checks the logged line doesn't contain the guess.
- `server/inkGateway.test.ts`: a new whole-game test. Two Screens (with and without the token), three drawers in turn, a crowned guesser and a late joiner. Every phone also sends `ink:hello`. Both Screens get every batch in order. No phone's `/ink` socket gets any event, the drawer included until F12's snapshot, and main sockets get only `state` and `fx`.
- No production code changed. No new dependencies.

**Decisions:** DECISIONS 33 covers the marker approach, the allow-list rules, and which hand-built state each later feature replaces. **Mutation-checked**: each of these deliberate leaks fails at least one test, and the files were restored afterwards:
- the word before REVEAL;
- secrets to a correct guesser;
- alternates to the drawer;
- close guesses before REVEAL;
- `upcoming` choices to everyone;
- the drawer's view sent to every phone by the gateway;
- phones joining `ink:<code>:screen` on hello;
- the gateway logging a failed event's raw payload.

Reviews:
- spec-checker: PASS WITH FIXES. Applied: DECISIONS 33, a `SPEC-QUESTION` at the `synth` note, and a header note that secrets must come from the mocked list and that logs are spied through `console.*`.
- secrets-fairness: PASS WITH FIXES. Applied:
  - the log check was vacuous (a clean game never logs), so a forced gateway failure now logs and is checked;
  - refused-guess acks;
  - the `it.fails` near-miss test;
  - the drawer's allow-list narrowed to the chosen word once there is one;
  - `TODO(F15/F18/F20/F21/F23)` at each `synth`;
  - a note not to batch actions between checkpoints;
  - Dee's `ink:hello` and the main-namespace event check.

**Notes for next session:**
- F15: flip `it.fails('keeps a near miss of the word off the Screen until REVEAL')` to `it`, and make close guesses real (drop the `synth close guess` step). Masked feed text must stay `qz`-free, and the leak test's `CLOSE_TEXT` rule (Screen only, from REVEAL) is the spec's.
- F17/F18: `words.v0.ts` goes away. Mock the pack loader/deck with `qz` words instead (keep `LEAK_WORDS`), and replace `synth CHOOSING` with `drawer:choose` and the auto-pick. The socket test then visits CHOOSING for real.
- F20: replace `synth SCOREBOARD`. F21: replace the `upcoming` synth (the roadmap says `views.leak.test.ts` covers `upcoming`). F23: replace the pause synth with `host:pause`/`host:resume`. F25/the crown feature: the leak test already covers the crowned guesser; extend with the `host` block's custom-word count if words get one.
- F12: the drawer's own snapshot will make the drawer's `ink.events` non-empty after a hello. Update the whole-game ink test to allow exactly the drawer's own `ink:snapshot` for the current turn and nothing for other phones. Cover `/ink` acks and `ink:get` (Screens only) there too.
- When a logger replaces `console.*`, spy on it in the socket leak test.

**How to try it:** `npx vitest run server/views.leak.test.ts server/inkGateway.test.ts` (3 + 1 expected fail, and 16 tests). To see the leak test bite, change `word: show && turn.word ?` to `word: turn.word ?` in `server/views.ts` `turnView` and rerun (2 failures), then revert.

## F09 — Dev tool: fake players (2026-10-30)
**What changed:**
- `server/http.ts`: dev-only `GET /api/dev/rooms/:code/word` → `{turnId, word}` (`DevWordResponse` in `shared/types.ts`), registered only with `createApp({dev: true})`. `server/env.ts` `devToolsEnabled(NODE_ENV)` is true only for `development`, which `npm run dev` now sets on the server command; unset, `production` or anything else → 404 (fails closed).
- `client/src/dev/bots.ts`: `createBot` is a real player socket (`player:join` with fixed key `sketchy-dev-bot-0000k`, name "Bot k", rejoins on reconnect, 5 s ack timeout with retry). It opens `/ink` only after the join. It auto-guesses decoy Tagalog words every 3–8 s while it may guess. `guessRight()` fetches the dev word and drops it if the turn moved on; the panel never shows the word. `draw()` plays the scripted doodle through `inkSender`: one step per 20 ms, held while paused, stopped when the turn ends, auto once per turn when drawing. `leave()` = `player:leave` + close both sockets. `client/src/dev/doodle.ts`: a house, door and sun as pen steps ≤ 24 grid units. `client/src/dev/fakeSocket.ts`: a test double, adapted from Buzzr.
- `client/src/pages/DevBots.tsx` at `/dev/bots/:code`, registered in `App.tsx` only when `import.meta.env.DEV` (lazy chunk). Spawn N (1–10), Remove all, toggles "Guess random words by themselves" / "Draw the doodle on their turn" (both on), "Everyone: random guess" / "Everyone: guess right". Per bot: status, role, last message, and Guess / Guess right / Draw. No new dependencies.

**Decisions:** DECISIONS 31–32. The dev endpoint is opt-in on `NODE_ENV=development`, stricter than the roadmap's `!== 'production'`: both reviewers flagged that as failing open. Bots: fixed keys, decoy words, the doodle script, no pings and no word choosing. Reviews:
- spec-checker: PASS WITH FIXES. Applied: the M1 Kim check, DECISIONS rows, and the production-bundle grep as evidence.
- secrets-fairness: PASS WITH FIXES. No leak paths. Applied: fail-closed gate with a test, and a comment on the LAN trade-off.
- mobile-ux: PASS WITH FIXES. Same gate finding; the join budget is unaffected.

**Notes for next session:**
- F44's join rate limit must leave room for up to 9 bots from one address (the Vite proxy makes them all localhost).
- F18: bots don't choose words. If CHOOSING waits on the drawer, a bot drawer relies on the 12 s auto-pick, or add `drawer:choose` to the bot then.
- F13: bots don't send `ping`. If fairness needs RTT samples to accept guesses, add pings to the bot as Buzzr's did.
- F51: the Dockerfile should set `NODE_ENV=production` for the client anyway; the dev endpoint stays off without it.
- In production, `/dev/bots/CODE` falls back to `index.html` and matches no route (blank page), as other unknown paths do until a 404 page exists.

**How to try it:** `npm run dev`, open http://localhost:5173 on the laptop and tap **Start**, then open http://localhost:5173/dev/bots/CODE in another tab. Spawn 3 and press Start on the Screen. Bot 1 draws the house on the Screen and the others guess random words. Press "Everyone: guess right" to end the turn. Automated: `npm run playtest -- .playtest/F09/scenario.ts` (gitignored; 6 steps). It creates a room, checks the dev endpoint (404 unknown, null in the lobby), spawns 3 bots that appear in the lobby, and starts the game. It then checks that the bot's doodle reaches the Screen canvas and the word is not in the Screen DOM before the reveal. Finally, guess right gives "✓ got it" and the reveal shows points for both guessers and the drawer. Production: `npm run build`, then `grep -r api/dev dist/client` finds nothing, and `/api/dev/...` answers 404 with `NODE_ENV` set to production or unset. Unit: `server/http.dev.test.ts`, `server/env.test.ts`, `client/src/dev/{bots,doodle}.test.ts`, `client/src/pages/DevBots.test.tsx`.

## F08 — Player page v0 (2026-10-30)
**What changed:**
- `pages/Play.tsx` at `/play/:code`: the name step (`JoinForm`), then the latest `state`. `{playerKey, name}` is kept per room in `localStorage` (`lib/playerIdentity.ts`, `sketchy:player:<CODE>`, key from `crypto.getRandomValues`, no nanoid), so every connect (a refresh, a re-scan, a dropped socket) re-sends `player:join` silently (5 s ack timeout, retried while connected). `lib/phone.ts` `joinOutcome` maps the answer: in; `roomNotFound` → "This game has ended"; `kicked` → "You were removed from this game"; `nameTaken`/`nameOfDisconnected`/`roomFull`/other → back to the name step with a message. A malformed code ends at once. The `/ink` socket (`auth: {code, playerKey}`) opens only after a successful join and is closed on any refusal, kick, `room:closed` or Leave. `fx yourTurn` vibrates 200 ms.
- `PhoneLobby`: "You're in, Jun!", their colour, "Waiting for 👑 Mika to start" (the crown holder reads "You have the 👑. Start the game on the Screen…"), Who's here with "(you)", two-tap Leave (`LeaveButton`, 4 s to confirm).
- Drawer (`DrawerTurn` + `DrawPad`): 56 px bar with the word at 16 px, `◔ m:ss`, "1 of 2 got it" and the latest wrong guess ("Ana: payong", `•••` when masked); the square pad sized by `drawerPadSize` = min(w − 8, h − 56 − 96 − 16) from the safe-area box; two 48 px rows (the selected black-pen swatch, "Colours, sizes, eraser and undo are coming soon"). Pad: Pointer Events, first pointer only (`createPointerGate`) with capture, `pointercancel`/`lostpointercapture` end the stroke, coalesced points behind a feature check, rect read once per stroke, one `inkSender` per `turnId` (flush on `visibilitychange`/`pagehide`, end + dispose on unmount), local strokes drawn with the Screen's `drawStroke`, backing store `side × DPR` ≤ 2048, a pause ends the stroke in hand. `useDrawLock`: body `position: fixed; inset: 0; overflow: hidden`, viewport meta swapped to `maximum-scale=1, user-scalable=no` and restored, `gesturestart`/`gesturechange` and multi-touch `touchmove` cancelled.
- Guesser (`GuesserTurn`): clock and "✏️ Mika drawing" (or "Mika is choosing a word…"), blanks with `(5, 4)` and an `img` label "8 letters to guess", the guess box near the top (`autocomplete`/`autocorrect`/`autocapitalize` off, `spellcheck=false`, `enterkeyhint=send`, keeps focus after each send), own misses "zzzz ✗", "✓ You got it! +N" without the word, "👀 Watch the Screen", "+N this turn". `PhoneStandings`: REVEAL "It was…" + word + "+N this turn" (drawer: "+N for your drawing" when > 0), SCOREBOARD "#2 of 4" + points, FINAL "You finished #1 of 3", points, "See the gallery on the Screen". Paused overlay; "Reconnecting…" badge at the bottom. Phone strings added to `lib/copy.ts`. No new dependencies.

**Decisions:** DECISIONS 29–30 (join answers and identity storage; drawer/guesser v0 scope: black pen, reserved toolbar rows, no Change name, own misses from the `wrong` fx, ink not buffered while `/ink` is down). Reviews: spec-checker PASS WITH FIXES (added `joinOutcome`/pointer-gate unit tests and render tests, Kim checks, DECISIONS); secrets-fairness PASS WITH FIXES (no leaks; applied: close and rebuild the `/ink` socket on refusal/kick/end/leave, drop batches while `/ink` is down); mobile-ux PASS WITH FIXES (applied: badge off the drawer's clock, armed Leave and placeholder contrast, blanks `role="img"` label via copy, `mousedown` focus guard, DrawerTurn stays mounted for all of DRAWING, a pause ends the stroke, rect cached per stroke).

**Notes for next session:**
- F09: fake players can join through the same `player:join`; `inkSender` has no DOM dependency for a bot drawer.
- F12: a drawer who refreshes mid-turn gets a blank pad and a new sender with `seq` from 1; the drawer's own `ink:snapshot` should refill `DrawPad` (it keeps its strokes in a local list per `turnId`). `sendInk` drops batches while `/ink` is disconnected; resend them from kept batches.
- F15: `lastGuess.text === null` shows `•••`; misses on the phone come from the local `wrong` fx queue (oldest unanswered guess) until `me.guesses` exists; replace them then.
- F18: the drawer's CHOOSING shows "Your turn to draw! Get ready…"; put the three word cards there (`view.secret.choices`). F21: the upcoming drawer's cards during REVEAL go in `PhoneStandings`.
- F25: the crown holder's lobby is the plain lobby plus one line; build the host lobby there. F26/F27: Change name and the doodle pad go in `PhoneLobby`. F42: `nameOfDisconnected` currently reads as a taken name (`joinOutcome`).
- F32: the two toolbar rows are placeholders sized by `DRAWER_TOOL_ROW_PX`; swatches must become ≥ 44 px hit areas; colour/size go through `DrawPad`'s `PEN_COLOR`/`DEFAULT_INK_SIZE`. Wake Lock and "Turn your phone upright" too (F32/F37).
- `Play` is in the main chunk (104 KB gz with Landing and socket.io-client); F39 measures the join budget.

**How to try it:** `npm run dev`, open http://localhost:5173 on a laptop and tap **Start**; on phones on the same Wi-Fi run `npm run lan CODE` for the join URL (or type the code at `/`). Automated: `npm run playtest -- .playtest/F08/scenario.ts` (gitignored; a TV Screen plus phones at 360×560, 390×664 and 412×780, all real pages, 10 steps): join via `/` and the name step; taken name refused; two-tap Leave clears the identity; refresh rejoins without the name step; Start → drawer word at 16 px, `touch-action: none`, body fixed, viewport locked, guessers see timer/blanks and no word in their DOM; the pad equals the formula with no scroll or overflow at all three sizes; a stroke reaches the Screen's canvas and the pad; wrong guess "zzzz ✗" with focus kept and shown on the drawer's bar; right guess "✓ You got it! +N" with no word, kept across a refresh; REVEAL on all phones with "+N for your drawing"; three turns to FINAL with "You finished #n of 3"; unknown and malformed codes end. Unit: `client/src/lib/{phone,playerIdentity}.test.ts`, `client/src/components/phone/phoneViews.test.tsx`.

## F07 — Screen page v0 (2026-10-30)
**What changed:**
- `pages/Landing.tsx`: **Join a game** (code auto-uppercased to the code alphabet, 4 letters, `GET /api/rooms/:code/exists`, then `/play/:code`; "No game with that code" / "That game is full") and **Start a game on this screen** (`POST /api/rooms`, token saved, opens `/screen/:code`). `lib/api.ts`, `lib/hostTokens.ts` (`sketchy:hostToken:<CODE>`), `lib/socket.ts` (WebSocket-only main and `/ink` sockets, `autoConnect: false`), all ported from Buzzr; no zod in the client.
- `pages/Screen.tsx` (lazy chunk, 18 KB gz): `screen:join` with the stored token on every connect (5 s ack timeout, retry; a refused token is forgotten and the Screen rejoins plain; unknown/malformed code or `room:closed` → "This game has ended"). `/ink`: `ink:hello {code}` on every connect, `ink:turn` clears, `ink:batch` appends. Landscape only: `ScreenLobby` (Join at host, big code, `/play/CODE` URL, chips with initial avatars and 👑, "👑 Mika is hosting" + Start with the token, "Waiting for 👑 Mika to start" without, "Need 2 players" / "Better with 3+", settings summary), `ScreenTurn` (square `InkCanvas` left, sidebar with ticking `◔ m:ss` timer (orange in the last 10 s), blanks with `(5, 4)`, Round/Turn, "✏️ Mika is drawing", players in order with ✏️/✓/+points, last 4 feed lines; CHOOSING overlay "Mika is choosing a word…"; REVEAL: "It was…", the word ≥ 12 vh, Got it chips in order with points, Almost, "+N for Mika's drawing" only when > 0, "Nobody got it!"), `ScreenStandings` (SCOREBOARD "Round n of N done" and FINAL "Final scores" with medals and shared ranks). Footer strip `host · CODE` always.
- `lib/ink.ts`: v0 action stack (`createInkPicture`, `applyInkOps`, `visibleStrokes`), `createScreenInk` (turn tracking), and the shared `drawStroke` (round caps/joins, quadratic curves through midpoints, incremental from a point index) + `redrawPicture`. `components/screen/InkCanvas.tsx`: largest square in its box, backing store `side × DPR` ≤ 2048, repaint on resize, new points drawn on the next frame.
- `lib/screen.ts` (`wordLengths`, `formatClock`, `rankPlayers`), `lib/useCountdown.ts`, `lib/copy.ts` (English table + `translator`), theme in `index.css` (`--font-display` rounded system stack). No new dependencies.

**Decisions:** DECISIONS 25–28 (client-side display ranks; v0 ink stack and turn tracking on the Screen; join/token/ended handling, copy table, no font yet; two columns above six players, REVEAL word fit, blanks floor, reconnecting badge). Reviews: spec-checker and secrets-fairness passed with fixes (applied: any join refusal ends the page, a mangled token falls back, join ack timeout, F12 note); mobile-ux found clipping at 10 players (fixed and covered by `layout.ts`), plus safe areas, `overscroll-behavior: none`, `touch-action: manipulation`, `theme-color`, a double-tap guard on Start, and contrast tweaks.

**Notes for next session:**
- F08: reuse `lib/api.ts` (`roomExists`), `lib/socket.ts` (`createSocket`, `createInkSocket({code, playerKey})`), `lib/copy.ts` (add phone strings to `EN`), `lib/useCountdown.ts` and `lib/screen.ts` (`wordLengths`, `formatClock`) for the guesser's timer and blanks. `drawStroke` in `lib/ink.ts` is the one renderer for the drawer's pad too (keep a local `InkStroke` per stroke and call it with `fromPoint`).
- F11: replace the picture/action stack in `lib/ink.ts` with `shared/ink.ts`; keep `drawStroke`, `redrawPicture` and `createScreenInk`'s turn rule.
- F12: a Screen loaded mid-turn only shows strokes begun after it joined; snapshots fix it. No `seq` checks on the Screen yet.
- F20 rematch: `createScreenInk` assumes turn ids only grow (they do: `turnCounter` survives games); keep it that way.
- F33: portrait layout; the sidebar is `min-w-[28vw] flex-1` beside an `aspect-square h-full max-w-[72vw]` box. F34: "Jun got it!" banner, bubbles. F35: reveal pop and Next line. F37: QR (leave room right of the code), tap-to-start, wake lock, connection dot. F39: self-hosted font. F24: the control bar; the lobby's Start is the only host control so far.
- The feed is shown raw as the server sends it (unmasked until F15), so don't play a real game on v0.
- The canvas square is the main area's height minus 2vmin padding and the footer strip (≈ 985 of 1080 px); F33 may tighten it. CHOOSING shows "Mika is choosing a word…" over the canvas with the sidebar clock; the spec's countdown ring is for F21/F33.

**How to try it:** `npm run dev`, open http://localhost:5173 on a laptop, **Start** → lobby at `/screen/CODE`. Players: until F08 the phone page is a placeholder, so run the playtest: `npm run playtest -- .playtest/F07/scenario.ts` (gitignored; Screen in Chromium at 1920×1080 plus a tablet Screen at 1180×820, three Node socket players, the drawer sending a stroke over `/ink`). It checks, in 9 steps: Start → `/screen/:code` with the token stored; lobby code, URL, chips, host line, Start disabled below 2; a tokenless Screen (with a stale token) shows "Waiting for 👑 Mika to start" and no Start; Drawing timer ticks, blanks count, the word is nowhere in either Screen's DOM; ink appears on both canvases; ✓ +points and a wrong guess; Reveal word, Got it, drawer line, drawing kept; next turn clears the canvas, "Nobody got it!", Final ranking with 🥇; unknown and malformed codes → "This game has ended". `npm run playtest -- .playtest/F07/layout.ts` checks the landing page fits 360×560 with no scroll, the lobby's Start stays on screen at 740×360, and with 10 players nothing is clipped in the lobby, the drawing sidebar (TV and 1180×820 tablet) or the Final ranking. Unit tests: `client/src/lib/{ink,screen,copy}.test.ts`.

## F06 — Ink relay v0 (2026-10-30)
**What changed:**
- `server/inkGateway.ts`: `attachInkGateway(io, {rooms, monotonic})` → `{ink, onInk}` on the `/ink` namespace (same engine: WebSocket only, 100 KB frames). A phone connects with handshake `auth: {code, playerKey}`; the middleware hashes the key and binds the socket to its pid (refused with `invalidPayload` / `roomNotFound` / `notPlayer`). A Screen connects with no auth and sends `ink:hello {code}` to join `ink:<code>:screen`, the only `/ink` room; a phone's hello acks `ok` and joins nothing. `ink:batch` is zod-checked, rate-limited (40/s per player), then relayed unchanged to `ink:<code>:screen` only if it comes from the current drawer, in DRAWING, not paused, for `room.turn.id`; otherwise it's dropped with `notJoined` / `notDrawer` / `wrongPhase` / `paused` / `staleTurn` / `rateLimited` (the ack is optional). `inkOpen` → `ink:turn {turnId}` to Screens so they clear; `inkClose`/`inkReset` are no-ops in v0. `ink:sync`, `ink:get`, `doodle:batch` answer `notAvailable`.
- `server/index.ts` wires `onInk` into `attachSockets`. `shared/types.ts`: `InkAuth`, `InkClientToServerEvents`, `InkServerToClientEvents`, new `GatewayError`s `notDrawer`, `staleTurn`, `rateLimited`. `shared/schemas.ts`: `inkAuthSchema` (strict).
- `client/src/ink/inkSender.ts`: the drawer's per-turn batcher. `toGrid(px, sizePx)` onto 0–1023; `begin`/`move`/`end` build `b`/`p`/`e` with relative points; flushes every 50 ms while ops are pending and at once on stroke end; ≤ 200 points per `p`, ≤ 4 KB per batch; `seq` and strokeIds from 1; no-op after `dispose`. Not wired to a socket yet (F08). No new dependencies.

**Decisions:** DECISIONS 22–24 (handshake auth for phones, open Screens as the spec allows; relay event names, error codes, check order and v0 limits; the sender's shape and its caller contract).

**Notes for next session:**
- F07 Screen: connect `io(base + '/ink', {transports: ['websocket']})` and send `ink:hello {code}` on every connect (including reconnects); clear on `ink:turn`; append each `ink:batch` (ignore a batch whose `turnId` isn't the latest `ink:turn`). A Screen that loads mid-turn sees a blank canvas until the next turn (snapshots are F12).
- F08 drawer pad: connect `/ink` with `auth: {code, playerKey}` (the same key as `player:join`), make one `createInkSender({turnId, send: (b) => inkSocket.emit('ink:batch', b)})` per turn (turnId from the view), `dispose()` it when the turn ends. Feed `toGrid(e.clientX - rect.left, rect.width)` (CSS px, not `canvas.width`); call `flush()` on `visibilitychange`/`pagehide` and `end()` on `pointercancel`. `getCoalescedEvents()` behind a feature check.
- F09 bot drawer can use `inkSender` too (it has no DOM dependency).
- F11: move the codec into `shared/ink.ts` and add the radial filter and RDP in `inkSender` before ops are pushed; the server should clamp accumulated points.
- F12: `seq` checks and `ink:resend`, the InkStore and its caps, `ink:sync`/`ink:hello` snapshots (Screens and the current drawer only), the 20-invalid-batches disconnect (count is not kept yet), `inkClose`/`inkReset` handling, freeing ink in the sweeper's `onExpired` (`index.ts` SPEC-QUESTION). Resends of kept batches must stay under the 40/s limit, which counts per player. `closeRooms` does not disconnect `/ink` sockets yet.
- `keyHash` lookups (here and `player:join`) are plain string compares of SHA-256 digests; fine, but switch both to `timingSafeEqual` if F44 tightens it.

**How to try it:** `npm test` (`server/inkGateway.test.ts`, `client/src/ink/inkSender.test.ts`, `shared/schemas.test.ts`). No UI yet (F07/F08), so no playtest. Live: `npm run build && PORT=3917 NODE_ENV=production node dist/server/index.js`; create a room with `curl -X POST localhost:3917/api/rooms`, then from Node connect a token Screen (`screen:join`) and an `/ink` socket that sends `ink:hello {code}`, join two players and give each an `/ink` socket with `auth: {code, playerKey}`, `host:start`; the Screen's `/ink` socket gets `ink:turn {turnId: 1}`, the first joiner's `ink:batch [1,1,[["b",1,0,1,10,10],["e",1]]]` acks `ok` and arrives at the Screen, and the second player's acks `notDrawer`.

## F05 — Views and socket gateway (2026-10-30)
**What changed:**
- `server/views.ts`: `toView(room, viewer, now)` builds `ScreenView` / `PlayerView` field by field (types in `shared/types.ts`: `TimerView`, `PlayerChipView`, `TurnView`, `SecretView`, `HostBlockView`, …, `ServerToClientEvents`). The word, gloss and choices only go into the drawer's own `secret` (current drawer in CHOOSING/DRAWING, `upcoming` drawer in REVEAL/SCOREBOARD); alternates go nowhere; the word goes public once the turn has ended and the phase is REVEAL or later. Everyone gets `mask` (`maskWord`), timers as `remainingMs`, and this turn's points; totals and ranks only in SCOREBOARD/FINAL. The `host` block goes to a token Screen and the crown holder.
- `server/sockets.ts`: `attachSockets(httpServer, {rooms, clock, monotonic, scheduler, onInk})` → `{io, dispatch}`. WebSocket only, `pingInterval`/`pingTimeout` 5000, 100 KB frames. Every event goes through zod → auth → `reduce` (monotonic `now`) → store with `lastActivityAt = clock()` → per-socket `state` → effects (`schedule` via the scheduler, `fx` to `room:<code>:screen` / `room:<code>` / `room:<code>:player:<pid>`, `kick`, ink effects handed to `onInk`). `screen:join` (a valid token makes it a host Screen; counts `screens`), `player:join` (SHA-256 `playerKey` → `keyHash`, acks `{pid}`), `ping` → `pong {t}`, every `player:*`, `drawer:choose` and `host:*` event. Disconnects dispatch `sys:screens` / `sys:disconnected`; `closeRooms` sends `room:closed {reason: 'expired'}` and is wired to the sweeper in `index.ts`.
- `Ack` errors are now a closed `AckError` (`ReduceError` + `GatewayError`); bad payloads answer `invalidPayload` without echoing. New constants `SOCKET_PING_INTERVAL_MS`, `SOCKET_PING_TIMEOUT_MS`.
- New deps: `socket.io` (the spec's realtime stack, as in Buzzr) and `socket.io-client` (dev: socket integration tests; the client uses it from F07).

**Decisions:** DECISIONS 20–21 (`toView` signature with `now` and the Screen token flag; array mask; `customWordCount`; reveal rule; inline shared ranks until F20; own-guess history waits for F15; closed ack codes; refused bad token; `lastActivityAt` on every accepted action; `room:<code>` all-sockets room; `room:closed` on expiry).

**Notes for next session:**
- F06: pass `onInk` to `attachSockets` and handle `inkOpen`/`inkClose`/`inkReset` there; share the `rooms` store. Ink must go only to `ink:<code>:screen`.
- F07/F08: the client must connect with `transports: ['websocket']` (the server accepts nothing else). A Screen with a stale token gets `badHostToken` and should retry `screen:join` without it. `state` arrives before the join ack on the same socket.
- F13: the `ping` handler only answers `pong`; add RTT samples per socket and pass the real `oneWayMs` in `player:guess` (now 0).
- F15: `PlayerView` has no "own last 5 guesses" yet; add per-player guess results to the turn and a `me.guesses` field. `guessFeed: 'masked'` is not applied in v0 (`off` is, in the view).
- F44: no join, guess, reaction or host-action rate limits in the gateway yet. Buzzr computes the client IP with `proxy-addr` and Express's compiled `trust proxy` fn; `TRUST_PROXY` is already parsed in `index.ts`.
- `closeRooms` does not cancel a swept room's pending timers; they fire into `roomNotFound` harmlessly.

**How to try it:** `npm test` (`server/views.test.ts`, `server/sockets.test.ts`). No UI yet (F07/F08), so no playtest. Live: `npm run build && PORT=3917 NODE_ENV=production node dist/server/index.js`, `curl -X POST localhost:3917/api/rooms` for a code, then from Node `io('http://localhost:3917', {transports: ['websocket']}).emitWithAck('player:join', {code, playerKey: 'x'.repeat(21), name: 'Kim'})` → `{ok: true, pid}` and a `state` with `role: 'player'`, `phase: 'LOBBY'`.

## F04 — Reducer v0: lobby and a basic turn (2026-10-30)
**What changed:**
- `server/reducer.ts`: pure `reduce(room, action, now) → {ok, room, effects} | {ok: false, error}` working on a `structuredClone`. Handles `player:join` (new / same-key reconnect / `kicked` / `roomFull` / case-insensitive `nameTaken` / `nameOfDisconnected` and `takeOver` → `fx rejoined`; first joiner crowned), `player:leave` (crown to the earliest connected joiner; drawer leaving → REVEAL as `skip`), `host:start` (≥ 2 connected, turn order by `joinedAt`), `player:guess`, `host:skip`, `host:next` (REVEAL), `timer` (`drawUp`, `allGuessed`, `revealDone`; mismatched `turnId`/`timerEpoch` → `staleTimer`), `sys:connected/disconnected/screens`. Every other action answers `notAvailable`.
- Turns go straight to DRAWING: 3 seeded-random words from `server/words.v0.ts` (20 frozen English words), the first one is the word; effects `fx yourTurn`, `inkOpen`, `drawUp` at `endsAt + GRACE_MS`. REVEAL awards the drawer half, pushes a `TurnSummary` to `history`, `inkClose`, `fx turnEnd`, `revealDone` in 8 s with auto-advance. After the last drawer in the order → FINAL. Every phase change bumps `timerEpoch`.
- `server/scoring.ts`: `guesserPoints(T, t)` and `drawerPoints(points[])`, fed uncorrected `t = receivedAt − clockStart`.
- `shared/types.ts`: closed `ReduceError` union; payload-less actions fixed to `Record<never, never>` (they couldn't be built before). Test fixtures in `server/test/rooms.ts`. No new dependencies.

**Decisions:** DECISIONS 16–19 (result and error shape, host check on the crown, seeded pids, v0 shortcuts and where each later feature picks them up, the `NoPayload` type fix).

**Notes for next session:**
- F05: the reducer never touches `lastActivityAt` (it's wall-clock; `now` is monotonic). The gateway must set `room.lastActivityAt = Date.now()` on every accepted action, or live rooms expire 3 h after creation. Drop `staleTimer` results silently (no broadcast, no log).
- F05 `toView` is the only barrier: `turn.word`, `turn.choices`, `history[].word` of the current turn, `closeGuesses` are server-only before REVEAL. Leak-test Screen, guesser and crown views mid-DRAWING.
- F13: replace the `receivedAt > endsAt` cut-off with corrected time ≤ `endsAt` (guesses inside the 300 ms grace are `tooLate` in v0), and give `correct` a stable order (corrected time, then arrival).
- F15: v0 sends every wrong guess raw to the Screen via `fx wrongGuess` and `feed`, so a near miss would show on the TV. Don't play a real game on v0.
- F18 replaces `startDrawing`'s deal with CHOOSING and the deck; F20 replaces `advance`'s single cycle; F23 appends mid-game joiners to `turnOrder` (`leave` already keeps `turnIndex` pointing at the turn just played). When pausing lands, the `timer` handler relies on pause bumping `timerEpoch`.
- F19: `allGuessed` is checked on a correct guess and on a guesser leaving, not on a disconnect yet.

**How to try it:** `npm test` (`server/reducer.lobby.test.ts`, `server/reducer.turn.test.ts`, `server/scoring.test.ts`, `shared/types.test.ts`). No UI or sockets yet (F05).

## F03 — Rooms, codes and RoomStore (2026-10-30)
**What changed:**
- Ported from Buzzr (credited at the top of each file): `server/codes.ts` (plus Tagalog blocked words), `hostToken.ts`, `rateLimit.ts`, `roomStore.ts` (`InMemoryRoomStore`, `startRoomSweeper`: 3 h idle TTL, swept every minute), `env.ts` (`parseTrustProxy`).
- `server/rng.ts`: mulberry32 with the state in `Room.rngState`: pure `nextRandom(state) → [value, state]` and `createRng(state)` with `next`, `int(n)`, `shuffle` and `.state` to store back. `server/room.ts`: `createRoom` (the full spec Room in LOBBY, partial settings over `DEFAULT_SETTINGS`, `newSeed()` from `crypto.randomInt`).
- `server/http.ts`: `POST /api/rooms` (10 per IP per hour, zod-checked, 201 `{code, hostToken}`, stores only the SHA-256 hash), `GET /api/rooms/:code/exists` → `{exists, phase, full}` (60 per IP per minute), JSON errors under `/api`. `server/index.ts` wires the store, the sweeper and `TRUST_PROXY`, and closes the server on shutdown.
- New constants: `ROOM_SWEEP_INTERVAL_MS`, `ROOM_CODE_MAX_ATTEMPTS`, `CREATE_ROOM_BODY_MAX_BYTES`, `ROOM_CHECK_RATE_LIMIT`; new type `HttpErrorBody`. No new dependencies.

**Decisions:** DECISIONS 13–15 (the `exists` limit; Tagalog code words that the I/L/O-free alphabet can actually spell; HTTP error shapes, 503, body cap, `TRUST_PROXY` parsing, seed source).

**Notes for next session:**
- F04/F05: `lastActivityAt` is only set at creation. The gateway/reducer must bump it on every action, or a live room expires 3 h after it was made. Pass `onExpired` to `startRoomSweeper` once the InkStore exists (F11/F12) so a swept room frees its ink.
- The reducer draws randomness with `const rng = createRng(room.rngState); …; rngState: rng.state`. Never import `room.ts` (`newSeed`) or `codes.ts` (`Math.random` default) from the reducer.
- F51/F52 deploy: set `TRUST_PROXY=1` in the container env, or every phone behind nginx shares 127.0.0.1 and one rate-limit bucket (10 rooms per hour for the whole site).
- `createApp` takes `rooms`, `clock`, `rng` and `trustProxy`; F05 should share the same `rooms` store with the socket gateway.

**How to try it:** `npm test` (`server/http.rooms.test.ts`, `rng.test.ts`, `codes.test.ts`, `hostToken.test.ts`, `rateLimit.test.ts`, `roomStore.test.ts`, `room.test.ts`, `env.test.ts`). Live: `npm run dev`, then `curl -X POST localhost:3000/api/rooms -H 'content-type: application/json' -d '{"settings":{"drawSeconds":60}}'` → `{"code":"MEHH","hostToken":"…"}`; `curl localhost:3000/api/rooms/MEHH/exists` → `{"exists":true,"phase":"LOBBY","full":false}`.

## F02 — Shared types, schemas and constants (2026-10-30)
**What changed:**
- `shared/types.ts`: the Room model as in the spec (`Room`, `Turn`, `Player`, `WordEntry`, `CorrectGuess`, `FeedItem`, `TurnSummary`, `Award`, `Paused`, `RoomSettings`), reducer `Action` (client actions carry `by: Sender`; `sys:*` and `timer` don't), `TimerName`, `Effect` and `Fx`, `ClientPayloads`/`ClientToServerEvents`/`Ack`, the ink op and batch tuples with `/ink` client payloads, and the HTTP bodies and responses.
- `shared/schemas.ts` (zod): `clientPayloadSchemas` for every main-namespace event and `inkPayloadSchemas` for every `/ink` event (`ink:batch` with the 4 KB cap, `ink:hello`, `ink:sync`, `ink:get`, `doodle:batch` with the 20 KB cap), `createRoomBodySchema`, `roomSettingsSchema` and the strict `partialSettingsSchema`. Both maps are `satisfies`-checked against `types.ts`, and `SchemaTypeChecks` asserts settings, ops and batches agree both ways.
- `shared/constants.ts`: every timing, limit and rate limit from the spec, the 8 drawing colours, eraser index, canvas colour, 12 player colours, reactions, settings choices, `DEFAULT_SETTINGS`, `PRESETS` (Quick, Classic, Barkada Night) and `MID_GAME_SETTINGS`.
- New dep: `zod` (runtime payload validation, the spec's stack; same major as Buzzr).

**Decisions:** DECISIONS 7–12 (id formats; the 12 player colours; trimming and strict settings; ink schema bounds and byte caps in the schema; the `exists` response shape; effect/fx shape and which types wait for F05/F06/F11).

**Notes for next session:**
- Handlers use `clientPayloadSchemas[event].safeParse(payload)` and `inkPayloadSchemas[...]`; schemas trim names and guesses and upper-case room codes, so use the parsed value.
- `ServerToClientEvents` and the `ScreenView`/`PlayerView` types are not written yet: F05 adds them with `toView`. The ink action-stack type and `ink:snapshot`/`ink:state`/`ink:resend`/`doodle` server payloads come with F06/F11/F12.
- The schema rejects off-grid `b` points; clamping accumulated `p` points to the grid belongs in the codec (F11) and relay (F12).
- Review follow-ups: `Ack.error` is still a free string; when F05 writes the handlers, consider a closed union of error codes so no handler can echo a word or guess in an error. Never log `host:customWords` payloads or their `ZodError` input (custom words are never logged).
- `shared/types.test.ts` holds `@ts-expect-error` checks for fx targets; the typecheck enforces them.
- `constants.test.ts` pins every fixed number from the spec; change both if a playtest retunes one (e.g. `DRAWER_SHARE`).

**How to try it:** `npm test` (`shared/schemas.test.ts`, `shared/constants.test.ts`); `npm run typecheck` fails if a schema and its type drift apart.

## F01 — Project skeleton and tooling (2026-10-30)
**What changed:**
- One `package.json` (npm, Node 24, ESM) with `dev`, `build`, `start`, `test`, `typecheck`, `lint`, `format`, `format:check`, `lan`, `playtest`; TypeScript (client `tsconfig.json`, server/scripts `tsconfig.node.json`, prod build `tsconfig.build.json`), ESLint flat config, Prettier, Vite + React + Tailwind 4, Vitest.
- `server/http.ts` (`createApp`: `GET /healthz` → `{ok: true}`, built client with SPA fallback in production), `server/index.ts`, `server/lan.ts` (`lanAddress`, ported from Buzzr's `env.ts`); placeholder `Landing`, `Play`, `Screen` pages (Screen is a lazy chunk, per the performance budget) and a favicon.
- `npm run lan [CODE] [--port N]` prints the Screen URL and the join URL with terminal QR codes; `npm run playtest -- <scenario.ts>` runs a Playwright scenario with one isolated context per role (`scripts/playtest/harness.ts`, `run.ts`, `smoke.ts`: Screen + 3 phones).
- CI: `sketchy-changes` + `sketchy` jobs in `../.github/workflows/ci.yml` (npm ci, format check, lint, typecheck, test, build), gated on changes like Buzzr's.
- New deps (one line each): `express` (HTTP server, spec stack); `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `react-router`, `tailwindcss`, `@tailwindcss/vite` (client stack, as Buzzr); `typescript`, `tsx`, `vitest`, `eslint` + `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-config-prettier` + `globals`, `prettier` (tooling, as Buzzr); `concurrently` (server + Vite in one `npm run dev`); `playwright` (playtest harness); `qrcode` (terminal QR for `npm run lan`); `@types/*` for the above.

**Decisions:** DECISIONS 4–6 (lan Screen URL is `/`; plain-Playwright harness in Chromium with device emulation; only F01's deps installed, SPA fallback never covers `/api/` or `/socket.io/`).

**Notes for next session:**
- The first unattended attempt was blocked only because `npm install` needed approval; this run installed it and finished the work.
- npm 12 blocks esbuild's postinstall (`allowScripts`); Vite and Vitest work without it (the platform binary comes from an optional dependency). CI's `npm ci` on Node 24 is unaffected.
- Playtests: start `npm run dev` first; `run.ts` checks `/healthz` and exits 2 if the app is down. Scenarios live in `.playtest/<ID>/scenario.ts` and import `../../scripts/playtest/harness.js`. The harness falls back to `/usr/bin/chromium` when Playwright's own browser isn't downloaded.
- `server/index.ts` has no Socket.IO yet; F03/F05 attach the main namespace and `/ink` to its `httpServer`.
- Review follow-ups for later features: close the HTTP/Socket.IO server in `shutdown` once rooms exist; keep the SPA fallback off `/socket.io/` (both namespaces share it); `overscroll-behavior: none`, `touch-action` and base colours/`theme-color` arrive with the play UI.

**How to try it:**
- `npm run dev`, then open http://localhost:5173/ (and `/play/ABCD`, `/screen/ABCD`); `curl localhost:5173/healthz` → `{"ok":true}`.
- `npm run lan -- ABCD`: scan the join QR with a phone on the same Wi-Fi → "Play ABCD".
- `npm run build && npm start` → http://localhost:3000/ serves the built client.
- With `npm run dev` running: `npm run playtest -- scripts/playtest/smoke.ts` → `PASS`.
