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
- [ ] F24: `npm run dev`, laptop Screen on the TV with a keyboard (Start), 3 phones; also a tablet as the token Screen once · from the couch, the bar's buttons are readable; it hides 3 s after the mouse stops and returns on a mouse move (on the tablet, on a tap); `?` shows the 11 shortcuts and Esc closes it; Space starts, then during a reveal Space/N move on; `G` shows "Guess feed: Clean" (wrong guesses masked on the TV), then Off, then All; S once shows "Press S again to skip the turn" and nothing happens, S twice skips; `F` goes fullscreen and back; `M` shows "Sound: Quiet"; a second Screen opened from the join link (no token) shows no bar and ignores every key; with Wi-Fi off on the laptop, tapping Skip twice shows "Could not do that. Try again." and nothing skips after Wi-Fi returns; on the final scores, Space twice starts the rematch countdown and Esc cancels it, L twice goes back to the lobby
- [ ] F25: `npm run dev`, laptop Screen on the TV (Start), 3 real phones (an iPhone and an Android if you have both) via `npm run lan CODE` · the first phone shows "You're the host 👑", a big Start game (greyed with "Need 2 players" until a second phone joins) and "Classic · 60 s · 2 rounds · Mixed words" with Change; Change opens the settings with the players list at the bottom; on the TV, click another player's name → Give host crown: that phone shows "You're the host now 👑" (below the Host button, not covering it) and the TV reads "👑 Jun is hosting · tap a name to change"; start from the crown phone, then while someone draws tap 👑 Host: the sheet slides up with Pause, Skip turn, End game, Guess feed All/Clean/Off and the players, never the word; with the crown phone guessing and the keyboard up, the guess box stays visible under the Host bar; with the crown phone drawing, the sheet never opens by itself and the pad still fits; the crown holder leaving passes the crown (toast on the next phone)
- [ ] F26: `npm run dev`, laptop Screen on the TV in fullscreen (Start), 3 phones via `npm run lan CODE` · from across the room, the lobby's three How to play steps (✏️ 1 · One person draws on their phone, 📱 2 · Everyone else types guesses 🤫, ⚡ 3 · Faster = more points) are readable under the code; start: during the first turn the yellow "Mika is drawing. Everyone else: type your guess on your phone 🤫" sits under the drawing on two lines, readable at 5 m and not cut off once the host bar hides; turn 2 reads "Type your guess. Don’t say it! 🤫"; the drawing does not jump in size when the word is revealed; from turn 3 there is no caption and the drawing is a little taller. Also try a landscape tablet as the Screen
- [ ] F27: `npm run dev`, laptop Screen on the TV (Start), 3 real phones via `npm run lan CODE` (a small Android, an iPhone, one more) · each lobby shows "Doodle yourself while you wait!" with a white pad (on the host's phone below Start); draw a face with a finger: the stroke follows the finger, the lobby doesn't scroll, zoom or pull-to-refresh while drawing, and a thumb on the gutter beside the pad still scrolls the lobby; ↶ Undo takes the last stroke off the phone and the TV; within a second or two the face replaces that player's initial on the TV chip and is recognisable from the sofa; reload one phone: its pad still shows the face and the TV keeps it; start the game: the faces stay on the sidebar chips; a phone that leaves (Leave, two taps) disappears with its face. No phone ever shows anyone else's doodle
- [ ] F28: `npm run dev`, laptop Screen on the TV (Start), 3 real phones via `npm run lan CODE` (a small Android, an iPhone, one more); start a game · move the mouse and press Pause on the bar (or P): the TV dims the drawing with "Paused / The host paused the game" readable from the sofa, every phone shows the full-screen "Paused" and a guesser's keyboard drops; wait 10 s: the clock doesn't move; Resume (P, Space or the bar): "Back in 3, 2, 1" on the TV and every phone, then drawing goes on with the time it had left; on the crown phone open 👑 Host and Pause, then Resume from the same drawer over the overlay; Skip turn (two taps "Tap again to skip") in CHOOSING and while drawing; Players → Kick → "Remove Jun?" → tap again: Jun's phone shows "You were removed from this game" with a link home and can't join again with that phone; kick the crown holder from the TV: the crown moves to the next player; at a scoreboard, Leave on a phone says "Tap again to leave. Your points will be lost"; End game (two taps): everyone lands on the final scores with their points kept
- [ ] F29: `npm run dev`, laptop Screen on the TV (Start), 3 real phones via `npm run lan CODE` (one holds the crown); play a short game (Quick preset) to the final scores · on the crown phone open 👑 Host, tap Rematch once ("Tap again to rematch: the gallery will be cleared"), tap again: the TV and every phone show "Game 2 starts in 3… 2… 1…" at the same moment with "<the 2nd joiner> draws first" under it, readable from the sofa, and that phone then gets "Your turn to draw!" and a vibrate; end game 2, rematch again from the TV (Space twice) and press Cancel (or Esc) during the countdown: everyone stays on the final scores; the TV's final scores now show the "Tonight · 2 games" panel with sensible totals; rematch once more and close two phones' browsers before it ends: "Need 2 players" on the TV and the remaining phone, the final scores unchanged; finally Back to lobby (two taps): everyone is in the lobby with their doodles, settings and names kept, and a new Start begins with the first joiner and no word from earlier games
- [ ] F30: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), 3 real phones (a small Android ≈ 360 px wide, an iPhone); start and, as the drawer: tap each of the 8 colours and draw a short line with each, cycle the size button M → L → S, turn on Eraser and rub out part of a line, tap Eraser again, then Undo three times, Clear, Undo; also tap Undo with a finger still on the pad · all 8 swatches and the 4 buttons fit in two rows with no scroll and are easy to hit with a thumb; the selected colour is obvious; the TV matches the pad after every tap (colours, thickness, the erased gap, Undo and Clear); the size dot turns white while erasing. In the lobby, doodle in two colours at L · the chip on the TV shows both colours
- [ ] F32: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), a budget Android (Chrome) and an iPhone (Safari, and once more from a home-screen icon), plus a third phone guessing; on each as the drawer: draw with both toolbar rows in view, with the browser's bars showing; pinch and double-tap on the top bar and the toolbar; draw with two fingers (the second finger does nothing); draw a long stroke, then don't touch the phone for longer than its auto-lock time; mid-stroke, turn the phone on its side, then upright again, and draw · no scroll, overflow or zoom at any point and all 12 tools fit; the screen doesn't dim or lock while the pad shows (note it if the iPhone from the home screen does: iOS before 18.4 has no Wake Lock there); on its side the phone shows "Turn your phone upright", "Your drawing is safe" and the clock, the stroke stops, and upright again the drawing is intact on the pad and the TV and new strokes reach the TV
- [ ] F33: `npm run dev` + `npm run lan CODE`; Screens: the laptop on the TV in fullscreen (Start), then a tablet held upright (open the join link's `/screen/CODE`) and turned on its side mid-turn, and once a phone propped upright as the Screen; 4+ real phones playing; play two turns and a reveal on each · from 5 m on the TV and 2 m on the tablet: names, clock, blanks and the last guesses are readable; the drawing is the biggest thing on screen and nothing is cut off; turning the tablet switches between the sidebar layout and the portrait one (clock and blanks on top, drawing, then the players with ✏️/✓ and the two latest guesses) within a second, with the drawing intact; at the reveal the drawing keeps its size and the word appears under it (portrait) or beside it (landscape); the code at the bottom is always visible
- [ ] F34: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV in fullscreen (Start), 4+ real phones (a ≈ 360 px Android, an iPhone); also a tablet held upright as a second Screen (`/screen/CODE`); bots at `/dev/bots/CODE` can fill the room · from the sofa (5 m): three phones send wrong guesses within a second: speech bubbles in each guesser's colour pop beside their names (under the strip on the upright tablet), at most three, gone after 2 s, never over the drawing, and the guesses list under the players keeps them; one phone guesses right: "Jun got it!" in Jun's colour replaces "Mika is drawing" for 2 s (on the tablet it replaces the blanks in the top bar), and Jun's row turns green with "+N"; on Jun's phone the guess box is replaced by six emoji buttons that are easy to hit with a thumb and fit with no scroll; tap 🔥: it floats up from Jun's row on the TV, and the tapped button lights green for a second; tap fast: no more than one reaction a second shows; set Guess feed Off (G): wrong guesses show as "💬 Bea is guessing…" with no text; with Reduce motion on (phone or laptop settings) the bubbles and emoji just fade
- [ ] F35: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV in fullscreen (Start), 3+ real phones; also a tablet held upright as a second Screen (`/screen/CODE`) · turn 1: two phones guess right (the slower phone first if you can) and one types a near miss and a wrong guess: at the reveal the word pops in, the biggest text on the TV and readable from the sofa, "Got it" lists the guessers in the order the server credited them with their points, "Almost:" shows the near miss then the wrong guess (never more than three, never the same guess twice), and "+N for Mika’s drawing" shows; turn 2: nobody guesses right (one wrong guess) and let the time run out: "Nobody got it! 😱" heads the panel above "It was…" (in the tablet's top bar too), and below the word there is no "Got it" and no points, only "Almost:"; no "+0" anywhere, and no speech bubble lingers into the reveal; set Guess feed Off (G) and play a turn with a near miss and a wrong guess: "Almost:" lists only the near miss (say if you'd rather Off showed the wrong guesses at the reveal too, DECISIONS 57); with Reduce motion on, the word appears without growing in
- [ ] F36: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), 3 real phones (one small Android if you have one, one iPhone) · on the drawer's phone, pick a word and don't draw: about 10 s in, "Start with one big shape. Anything helps!" appears just above the pad (on a small phone it sits over the pad's top edge) and the pad doesn't move; start a stroke right on that text: the line draws and the text is gone for the rest of the turn (Clear doesn't bring it back); have a guesser type a wrong guess: "Bea: sapatos" appears on the drawer's second line; have another type a near miss (the word plus "ko", or one letter off): "Cy is close!" shows there in amber for about 2 s, readable at arm's length but not from the next seat, then the wrong guess comes back; the Screen and the other phones never show the near miss; with VoiceOver/TalkBack on the drawer's phone, the nudge and "is close!" are read out
- [ ] F37: `npm run dev` + `npm run lan CODE`, open the **Screen URL printed by `npm run lan`** (the LAN address, not localhost) on the laptop on the TV, plus a tablet or spare phone as a second Screen, and 3 real phones (one iPhone, one small Android if you have one) · on each Screen, "Click to start" (laptop) or "Tap to start" (tablet) covers the page: one tap goes fullscreen (not on an iPhone Screen) and the Screen doesn't dim or sleep for 15 minutes on battery; the lobby QR scans with each phone's camera from the sofa (≈ 2–3 m; note the farthest distance that works, see the Backlog's QR line) and opens `/play/CODE` on the LAN address; "🔌 Keep this device plugged in" shows on the tablet or phone Screen and not on the laptop (also try an Android TV or Chromecast browser if you have one: it may report no pointer and show "Click to start" with no note); during a game no phone dims or locks (lobby phones may); turn on airplane mode on one phone: the dot in its top-right corner goes amber at once, red after about 5 s, and back to green with the same name and score within a few seconds of turning it off; try Wi-Fi with no internet (unplug the router's WAN) for the amber after about 6 s
- [ ] F38: `npm run dev` + `npm run lan CODE`, the laptop Screen on the TV with its speakers on, plus an iPad or iPhone as a second Screen with its ringer switch on silent, and 3 real phones; tap/click to start on each Screen, play a game of 2 short turns (let one run out of time), then end it · each phone joining gives a short pop; each new turn a two-note chime; each correct guess a ding; the last 10 s of a turn tick once a second, stopping while paused and picking up after; a timed-out turn gives a low double buzz, then the sting as the word pops in; FINAL plays the fanfare; nothing is cut short or doubled; the iPad/iPhone Screen plays everything with the ringer switch on silent; after locking and unlocking the iPad (or taking a call), one tap brings its sound back; `M` (or the bar's Sound button) cycles Sound on / Quiet / Muted, and the tick is still audible on Quiet from the sofa (≈ 2–3 m); only the drawer's phone buzzes on "your turn", and no phone makes a sound
- [ ] F39: after autopilot deploys, on the **budget Android with Wi-Fi off (mobile data)**, clear Chrome's data for sketchy.kimnejudne.dev, start a game on the laptop (Screen on the TV), then scan the lobby QR with a stopwatch running · the name field shows and takes typing within 5 s of the scan, and you reach the lobby within 15 s including typing a name; the headings are the rounded Fredoka face (round dots on i and j). Repeat on the iPhone. Then once on a Wi-Fi that's known to be fussy (a café or captive portal), join and play a turn · it joins (on a network that blocks WebSockets it falls back to polling, which may take a few seconds longer to connect)
- [ ] F40: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), 3 real phones (an iPhone and an Android as drawers in turn) · as the drawer, pick a word and draw a few strokes, then lock the phone for about 1 s and unlock: nothing pauses (at most "Mika’s phone reconnecting…" flashes on the TV); lock it for about 5 s: within 2 s of locking the TV shows "Mika’s phone reconnecting…" over the top of the drawing (readable from the sofa), then "Paused · Waiting for Mika’s phone…" on the TV and the guessers' phones, with the clock stopped; unlock: "Back in 3-2-1" everywhere, the strokes are still on the pad and the TV, and new strokes reach the TV; switch to another app for 5 s and back: the same; lock it for more than 35 s: the turn ends with the reveal ("It was…", points earned so far kept, the drawer's half shown) and the next drawer chooses, and the locked phone, unlocked, shows the reveal; repeat once during the word choice (lock for 35 s: the next drawer chooses, no reveal); turn on airplane mode on the drawer's phone for 10 s instead of locking it: the badge comes after a few seconds (the server has to notice the drop), then the pause, and on reconnecting the 3-2-1
- [ ] F41: `npm run dev` + `npm run lan CODE`, an **iPad or Android tablet as the Screen** (open the LAN Screen URL, tap to start) and 3 real phones · start a game; while someone draws, lock the tablet (or close its tab) for about 1 s and wake it: nothing pauses; lock it for 15 s: within about 13 s every phone shows "Paused · Waiting for the Screen…" with the clock stopped and the guess box covered; wake the tablet: it shows the drawing so far and "Back in 3-2-1", then every phone carries on with the time it had; do the same while the drawer is still choosing a word (the choice's countdown stops too); lock the tablet during the reveal for 10 s: the reveal and scoreboard carry on, and the game pauses about 3 s into the next turn until the tablet wakes. Then with 3 players, put two guessers' phones in airplane mode: within about 10 s the Screen and the drawer show "Paused · Waiting for more players…"; turn one back on: "Back in 3-2-1" and the turn goes on; with only 2 players, reload one phone's page: note whether the brief "Waiting for more players…" and 3-2-1 feel jarring (DECISIONS 63 has no debounce; a short grace is the fix if so)
- [ ] F42: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), 3 real phones plus a 4th phone or a different browser · join as Jun, Bea and Cy and play a turn so Jun scores; Jun holds the crown (first to join). Turn Jun's phone off (or close the browser fully) and wait about 10 s until his chip greys out. On the 4th phone open the join link and type "Jun": it asks "Are you Jun?" with "Rejoin as Jun" and "Pick another name", both easy to hit with a thumb; tap Pick another name: back to an empty name field. Type "Jun" again and tap Rejoin as Jun: the TV shows "Jun is back (new phone)" for a few seconds, below the top bar, and Jun's chip is in colour again with his score; the 4th phone has the Host button. On another phone type "Bea" (connected): "Someone here already has that name". Turn Jun's old phone back on and open the game: it isn't Jun any more and gets the name step. Repeat while Jun is drawing: the game pauses "Waiting for Jun’s phone…", the rejoin on the new phone gives "Back in 3-2-1" and the pad there (his strokes so far come back)
- [ ] F43: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), 3 real phones (at least one iPhone in Safari and one Android in Chrome) · start a game; while the drawer draws and one guesser has got it: (1) reload the TV's tab: within a couple of seconds the same code, round, clock, scores and the whole drawing are back, with the host controls, and new strokes keep arriving; (2) pull-to-refresh is locked on the pad, so reload the drawer's page from the browser menu: the word, the pad with every stroke so far, and drawing carries on (the TV shows the new strokes); (3) reload the guesser who got it: "You got it! +N" with the same points, no word, no drawing; (4) reload a guesser who hasn't: they can still guess and score; (5) on the iPhone, switch to another app for a minute and back (Safari may reload the tab itself): the same as a reload. Nothing should pause in (1)–(5) except a brief "phone reconnecting…" badge; with only 2 players a reload briefly pauses (DECISIONS 63)
- [ ] F44: after autopilot deploys, read the Sketchy container's start-up log on the droplet: no "TRUST_PROXY is not set" warning (if it's there, set `TRUST_PROXY=1` in the container env, or every phone shares one join limit of 10 a minute for the whole site). Then with the barkada on one Wi-Fi: everyone joins, everyone reloads their phone at once, a phone switches to mobile data and back · nobody sees "Too many people joined from this network"; an 11th phone sees "That game is full."
- [ ] F45: review the Taglish: read the `TAGLISH` table in `client/src/lib/copy.ts` (the English table above it says what each line is for), then `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), Settings → Game text → Taglish, 3 real phones (one at least as small as a 360 px-wide Android); play a turn each through lobby, choose, drawing, a close and a wrong guess, reveal, scoreboard, a pause (host Pause) and the final scores, and a rematch · every line sounds like the barkada talking, not a textbook or a machine; flag stiff ones (candidates: "Tuloy sa 3", "Game 2, simula sa", "Pang-#2 ka sa 4", "Sino’ng nandito", "Mahina" for Quiet sound, "Hirap" for Difficulty, "Itago mo ang phone 🤫" for "Hold your phone close") and the award reasons (`award*Why`, on screen from F50); check the drawer's top bar keeps a long word readable beside "2/4 nakakuha". The join form stays English until the phone has joined (DECISIONS 67)
- [ ] F46: review the word packs: open each of `data/packs/en-*.json` and `data/packs/tl-*.json` (one theme per file; `npm run packs:check` prints the counts per level), and play a few turns with `npm run dev`, Settings → Words → Taglish, then English · every word drawable on a phone in 60 s without letters or numbers; the difficulty (1 easy object, 2 medium, 3 scene or idea) feels right; the Taglish spelling is what a barkada writes, and the alternates cover what people type (ts/ch, j/dy, e/i, o/u, the English or Tagalog name); each gloss tells the drawer what to draw. Likely cuts or fixes: English `ghosting` (a spec sample), `brownout`, `low battery`, `job interview`, `marriage proposal`, `brain freeze`, `potluck`, `work from home`; Taglish `tambay`, `liga`, `bunso`, `lamay`, `pamamanhikan`, `noche buena`, `undas`, `barker`, `white lady`, and `sabong` (cockfighting, a spec sample: fine as family?). `hangover` is out of the family pack (DECISIONS 68); edit the JSON directly and re-run `npm run packs:check`
- [ ] F47: review the spicy pack: open `data/packs/tl-pang-inuman.json` (67 words; `npm run packs:check` prints the counts per level), then play a few turns with `npm run dev`, Screen Settings → Words → Taglish (or Mixed) and Spicy words → On, and `/dev/bots/CODE` · every word is party humour a barkada laughs at, not explicit and aimed at no group of people; each is drawable in 60 s without letters or numbers; the Taglish spelling and alternates are what people type; each gloss tells the drawer what to draw. Likely cuts or fixes: `lumalandi`, `pa-cute`, `torpe`, `basted` (the dating words that lean on feelings), `budots`, `ambagan`, `libre`, `hatid`, `long distance`, `monthsary`, `crush` (fine as spicy?), `beso`, `kopita`; alternates `syota`, `ubos-biyaya`, `pantulak`. Also decide whether English rooms need their own spicy words (today Spicy on with Words → English adds none, DECISIONS 69)
- [ ] F48: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), 3 real phones (an iPhone in Safari and a ≤ 360 px-wide Android in Chrome; the first to join holds the crown). On the crown phone tap "Add your own words ✍️", type 5 words on the keyboard (one per line, then a comma-separated line), tap Add words; on the Screen add 2 more and see "· 7" on both; tap Clear all twice on one of them, then add 4 again; Start and play 4 turns · the phone keyboard never hides Add words or the status line, nothing sits under the iPhone home indicator, the count matches on both host devices, each drawer's cards show one "Ours" until the 4 are drawn, and no custom word shows on the TV or a guesser phone before its reveal. Also read the Taglish: "Magdagdag ng sariling words", "Atin" on the card, "Kita ng lahat ang screen na ’to…" (Settings → Game text → Taglish)
- [ ] F49: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), 3 real phones; play a game with 2 rounds where every phone draws something different, then Rematch and finish game 2 so the Tonight panel shows too · from the sofa (≈ 5 m) the gallery's words and "by Name" lines are readable, every final score row and the Tonight panel fit above the gallery with nothing cut off, each thumbnail matches what was drawn; tapping a thumbnail (or ← →) opens it large with the word whole (try a long one, e.g. "refrigerator"), Esc closes it; the room code strip along the bottom is gone while the gallery is up
- [ ] F50: `npm run dev` + `npm run lan CODE`, laptop Screen on the TV (Start), 3–4 real phones (one ≤ 360 px wide); play a 2-round game where one drawing goes unguessed to the end of its time, then Rematch and finish game 2 · after the podium the Screen shows "Tonight's awards" cards, nobody twice, every winner's name readable from the sofa (≈ 5 m), all score rows, the Tonight column and the gallery visible with nothing cut off; each phone whose player won something leads its FINAL with the "Your award" card (try Settings → Game text → Taglish for one game: the card still fits on the small phone without pushing Leave off the screen); a player with no award sees no card. Also open the Screen on a 4:3 tablet in game 2 and check the scores and the one-line Tonight strip are readable at 2 m
- [ ] F51: on the laptop, with Docker running: `cd sketchy && npm ci && npm run smoke:docker` · it ends with `PASS`, after `ok   deploy/compose.deploy.yaml: 127.0.0.1:3006 -> 3000, mem_limit 256m`, every `scripts/smoke.ts` line (`/healthz`, the client, `/play/ABCD`, a room, the dev word route off, both namespaces), "the server started with the word packs", "runs as node", "HEALTHCHECK is starting" (or "healthy") and "stops on SIGTERM in Ns" with N < 5. Once F52 has deployed, run `docker stats sketchy-app-1` on the droplet during a real 10-player game · memory stays well under the 256MiB limit (the probe measured ~166 MB resident outside Docker for a full game)
- [ ] F52: once autopilot reports the deploy green, check the GitHub run "Deploy Sketchy" (Actions tab): `checks` ran typecheck, lint, format check and tests; `droplet` ran "build and smoke-test the image" ending `PASS`, shipped `sketchy:<tag>`, printed "no live games", "healthy after N attempt(s)", and the final "smoke" step ended `PASS` against https://sketchy.kimnejudne.dev. Then on the droplet: `docker ps --filter name=sketchy` (Up, healthy), `cat /opt/sketchy/.env` (`IMAGE_TAG=<that tag>`), `tail /var/log/nginx/sketchy.access.log` (`/socket.io/` lines answer 101) · all as described; if `deploy` lacks permission for anything in `/opt/sketchy`, fix ownership as in sketchy/README.md "Rebuilding the box's setup" step 2
- [ ] F52: the spec's Manual playtest checklist (`node .claude/scripts/spec.mjs "Manual playtest checklist"`) on https://sketchy.kimnejudne.dev: a laptop Screen on the TV, a portrait tablet, the budget Android, a mid-range Android and an iPhone, at least two phones on mobile data with Wi-Fi off · every box ticks; in particular the name field is usable within 5 s of scanning on the budget Android over mobile data, ink delay median ≤ 150 ms with the drawer on mobile data, and the drawer's data use for a game is under 1 MB
- [ ] F52: the live-game wait, once: leave the Screen open on https://sketchy.kimnejudne.dev, then run `gh workflow run deploy-sketchy.yml -f tag=<current tag>` (a re-point, no build) · the "wait for live games" step logs "N live connection(s); waiting (1/20)"; close the Screen tab and it carries on with "no live games" within 30 s and re-points. Then a rollback: `gh workflow run deploy-sketchy.yml -f tag=<previous tag>` (from `docker images sketchy` on the box) and back again · each ends healthy and the smoke step passes

<!-- entries below, newest first -->
## F52 — Deploy to sketchy.kimnejudne.dev (2026-10-31)
**What changed:**
- **`.github/workflows/deploy-sketchy.yml`**, modelled on `deploy-buzzer.yml` and keeping its job names (`checks`, `droplet`), step names and the `ABORT: N live connection(s) after 10 min` line that `scripts/autopilot.sh` matches:
  - Runs on pushes to `main` touching `sketchy/**` (not `*.md`, `docs/`, `.claude/`) or the workflow itself, and on `workflow_dispatch` with `tag` (re-point, a rollback) and `force` (restart with live games).
  - `checks`: typecheck, lint, format check, tests on the runner (Node from the root `.node-version`, as ci.yml).
  - `droplet` (environment `production`, the same SSH secrets as Buzzr's, user `deploy`): tag = last commit touching shipped code under `sketchy/`; `scripts/docker-smoke.sh sketchy:<tag>` builds and smoke-tests the image with the compose file's settings; `docker save | gzip | ssh docker load`; the compose file to `/opt/sketchy/compose.yaml`; one script on the box waits for established connections to `127.0.0.1:3006` to reach zero (20 × 30 s, abort touching nothing), re-points `IMAGE_TAG` in `/opt/sketchy/.env`, `docker compose up -d`, waits for `/healthz`, rolls back to the previous tag if it never answers; untagged images are pruned, so the previous release stays.
  - The final "smoke" step is `npm run smoke -- https://sketchy.kimnejudne.dev` through nginx and TLS: `/healthz`, the client and its entry script, the `/play` fallback, a room, the dev word route off, and WebSockets on `/` and `/ink`. `npm ci` runs in both modes so a re-point is smoke-checked too.
- **`sketchy/README.md`** (new): develop, commands, Docker, environment, and the Deploy runbook: the push deploy step by step, `force=true`, break-glass routine deploy, copying the compose file and the vhost, rollback (push-button and by hand), rebuilding the box's setup (DNS, `/opt/sketchy`, bootstrap vhost, certbot, real vhost), health checks.
- **Root `README.md`**: "Four" applications, a Sketchy row (no hub link), the build line, the live-games wait, the runbook pointer and the provenance line.
- `deploy/compose.deploy.yaml` and `deploy/nginx/sketchy{,-bootstrap}.conf` are unchanged (F51 and the 2026-10-30 bootstrap).
- **New dependencies:** none.

**Decisions:** DECISIONS 74.

Reviews:
- **spec-checker: PASS WITH FIXES.** Must-fix done: this entry and the Kim checks (live deploy, Manual playtest checklist on mobile data, the live-game wait and a rollback). Should-fix done: the root README paragraphs rewrapped. Noted: "All four are live" is true once autopilot's push deploys this commit (DECISIONS 74). Kept: `npm ci` unguarded in `droplet`, for the live smoke on a re-point.
- secrets-fairness and mobile-ux not run: no `server/`, `shared/`, ink or `client/` code changed.

**Verification** (no push, ssh or Docker in autopilot sessions):
- The workflow parses (PyYAML); job names `checks`/`droplet` and every step name match autopilot's `CI_STEPS` and its ABORT grep; every `run:` block and the box script pass `shellcheck` (only SC2029 infos, intended: `TAG`/`FORCE` expand on the runner, as in Buzzr's).
- The box script diffed against Buzzr's with the name and port normalised: identical but for one comment.
- The tag pathspec resolves (`6df5abf` before this commit).
- `npm run smoke -- http://127.0.0.1:3996` against `npm start` with `TRUST_PROXY=1` and `NODE_OPTIONS=--max-old-space-size=128`: PASS.
- `/verify`: format, lint, typecheck, 1414 tests, build all green.

**Notes for next session:**
- All 52 features are built. Autopilot pushes and watches this workflow; if it fails at "ssh" or "ship", check the `production` environment's secrets and `/opt/sketchy` ownership first.
- Backlog: a hub link for Sketchy once its case study is written.

**How to try it:**
- After the push: GitHub Actions → Deploy Sketchy; then `curl -s https://sketchy.kimnejudne.dev/healthz` and `npm run smoke -- https://sketchy.kimnejudne.dev`.
- Rollback: `gh workflow run deploy-sketchy.yml -f tag=<good-tag>`.


## F51 — Docker image and smoke test (2026-10-31)
**What changed:**
- **`Dockerfile`** (ported from Buzzr): four stages on `node:24-slim` (deps, build, prod-deps, runtime), `NODE_ENV=production`, `PORT=3000`, runs as `node`, `HEALTHCHECK` on `/healthz`. The word packs are baked in at `/app/data/packs`, where `packsDirFor` looks from `dist/server`; no `DATA_DIR`, no volume. `.dockerignore` keeps the context to what the build needs (`data/packs` stays in).
- **`deploy/compose.deploy.yaml`** (created here, not in F52, since the port and `mem_limit` are this feature's): `sketchy:${IMAGE_TAG}`, `TRUST_PROXY: '1'`, `NODE_OPTIONS: '--max-old-space-size=128'`, `127.0.0.1:3006:3000`, `mem_limit: 256m`.
- **`scripts/smoke.ts <url>`** (`npm run smoke -- <url>`): `/healthz` 200 `{"ok":true}`; `/` serves the client and its `/assets/*.js` entry; `/play/ABCD` falls back to it; `POST /api/rooms` 201; the dev word route is 404; on `/` a token Screen joins and gets its LOBBY state, and a player joins and the Screen sees them; on `/ink` the Screen's hello, the phone's hello on a `playerKey`-bound handshake, and an unknown `playerKey` refused `notPlayer`. Works against any URL, so F52's live check can reuse it.
- **`scripts/docker-smoke.sh`** (`npm run smoke:docker`, ported from Buzzr): reads `TRUST_PROXY`, `NODE_OPTIONS`, `mem_limit` and the `127.0.0.1:3006:3000` binding from the compose file (a dropped key fails), builds the image, runs it with those and `--memory`, runs `smoke.ts`, then checks the packs loaded, the user is `node`, the `HEALTHCHECK` isn't unhealthy and `docker stop` takes < 5 s.
- **`scripts/mem-probe.ts`** (`npm run mem:probe [-- --games N --heap MB]`): starts `dist/server/index.js` and plays N games over real sockets (one WebSocket per phone for both namespaces, each from its own `X-Forwarded-For`): 10 players with full lobby doodles, 3 cycles (30 turns), each drawer filling the canvas (~194 KB), 3 wrong guesses per guesser per turn, the host skipping each turn once the ink is in, and the Screen fetching the whole gallery at FINAL. Samples `/proc` RSS and `RssAnon` every 50 ms.
- **Measured** (this laptop, Node 24):

  | Run | Peak RSS | Peak anonymous |
  | --- | --- | --- |
  | 1 game, default heap | 228 MB | — |
  | 1 game, `--heap 48` | 136 MB | — |
  | 1 game, `--heap 128` | 166 MB | 114 MB |
  | 2 games, `--heap 128` | 243 MB | 186 MB |
  | 3 games, `--heap 128` | 304 MB | — |

  Idle is ~93 MB. Each game kept 19 of its 30 drawings (the 4 MB room budget). Hence `mem_limit: 256m` with the 128 MB heap cap: ~2× headroom for one game, two full games are the ceiling; 256m + Buzzr's 384m = 640 MB of the ~700 MB free.
- **New dependencies:** none.
- **Tests:** `scripts/smoke.test.ts` (3): every check passes against an in-process server wired like `server/index.ts` with a stand-in client build; it fails without a client; it fails with the dev route on.

**Decisions:** DECISIONS 73 (packs in the image, compose here, the memory figures and the limit, the smoke checks, Docker not run in autopilot sessions).

Reviews:
- **spec-checker: PASS WITH FIXES.**
  - Must-fix done: this entry and the Kim check for `npm run smoke:docker`.
  - Should-fixes done: the smoke checks the dev word route is 404 (the word's one guard is `NODE_ENV`); the compose file states two full games are the ceiling.
  - Kept: `mem-probe.ts` has no test (a measuring tool, ~75 s a run).
- secrets-fairness and mobile-ux not run: no `server/`, `shared/`, ink or `client/` code changed.

**Verification without Docker** (autopilot sessions may not run it):
- `npm run smoke -- http://127.0.0.1:3997` against `npm start`'s build with the compose env: PASS.
- The image rehearsed stage by stage: the context copied through `.dockerignore` (`rsync --exclude-from`), `npm ci` and `npm run build` in it, a prod-only `npm ci --omit=dev` in a fresh dir with `dist` and `data/packs` copied in, `node dist/server/index.js` there: "Loaded 11 word packs (584 words)", smoke PASS, SIGTERM shuts it down.
- The script's compose parsing gives `1`, `--max-old-space-size=128`, `256m`, `3006`; `shellcheck` clean.

**Notes for next session:**
- F52: run `npm run smoke:docker` in the workflow's "build and smoke-test the image" step (the runner needs `npm ci` first, since `smoke.ts` runs on the host), and `npm run smoke -- https://sketchy.kimnejudne.dev` for the live check (it creates one room, swept after 3 h).
- The probe's numbers are outside a container; if `docker stats` on the droplet shows more than ~200 MiB in one game, raise `mem_limit` and recheck the droplet's free memory.

**How to try it:**
- Tests: `npx vitest run scripts/smoke.test.ts`.
- Smoke without Docker: `npm run build && PORT=3997 TRUST_PROXY=1 npm start`, then `npm run smoke -- http://127.0.0.1:3997`.
- With Docker: `npm run smoke:docker`.
- Memory: `npm run build && npm run mem:probe -- --heap 128` (~75 s).

## F50 — Tonight's awards (2026-10-31)
**What changed:**
- **Server `server/awards.ts`** (`computeAwards`), run by `setPhase` on every way into FINAL (the last cycle, End game, nobody left to draw); the views already carried `awards` (Screen: all; phone: its own; FINAL only), and a rematch already cleared them.
  - Players are taken lowest-ranked first. Each takes the first award, in spec order, that they lead among the players still without one; a tie on the stat goes to the lower-ranked player. After each award the lowest-ranked are asked again. An award is skipped when nobody qualifies, or every qualifier already has one. Only players still in the room are awarded.
  - Stats: Picasso (drawer points), Bilis! (fastest corrected `elapsedMs`), Sharpshooter (correct guesses), Malapit na! (close guesses), Most creative (wrong guesses), Modern art (turns nobody got that ran out of time, `turnId` = the latest).
- **`TurnSummary`** gains `endReason` (not in the spec's type; Modern art ignores skipped, ended and abandoned turns). Its `wrong` count now subtracts the correct guess by `turn.correct` membership instead of by points.
- **Screen** (`client/src/components/screen/ScreenAwards.tsx`): one card per award between the scores (and Tonight) and the gallery. Each card has the award, the winner in their colour (a winner who left is named from the night's totals), and the reason; Modern art adds its word. The cards pop in one after another (`motion-safe`), as many per row as fit at ≥ 26 vmin. The heading sits left of the cards in landscape, above them in portrait.
- **Fitting it all** (`ScreenStandings.tsx`):
  - The score rows size their text to the height left over (`fitRows`, `cqh`; the size class stays as the fallback), with em padding, down to max(2 vmin, 13 px).
  - The Tonight column on a wide Screen sizes its text to its height (`fitTonight`); before, from F49, it ran into the gallery with 10 players.
  - On a narrower landscape Screen with the gallery up, Tonight is one line: the top 3 and "+N more".
  - Small gallery thumbnails went from 20 to 17 vmin, and the title's line height tightened.
- **Phone** (`PhoneStandings.tsx`): FINAL leads with a "Your award" card (award name as a heading and the reason), above "Final scores".
- **Copy:** `yourAward` ("Your award" / "Award mo"). Bilis!'s reason is now the spec's "Fastest guess of the night" ("Pinakamabilis na hula ngayong gabi"). `client/src/lib/awards.ts` maps kinds to copy keys.
- **New dependencies:** none. JS 111.6 of 120 KB, CSS and font 24.8 of 30 KB.
- **Tests:**
  - `server/awards.test.ts` (25):
    - each award's rule, including Modern art's latest turn and only timed-out turns;
    - a Bilis! tie at 0 ms;
    - skipped when nobody qualifies, no history, a departed player, zero counts;
    - one per player; lowest-ranked first; ties; a score tie ranking the later joiner lower; skipped when only award holders qualify; spec order; ten players;
    - through the reducer: the summary's corrected times, close, wrong and `endReason`; the awards at the end of the last cycle and by End game; cleared by a rematch;
    - the Screen view gets every award, each phone only its own, and none before FINAL.
  - `client/src/components/screen/ScreenAwards.test.tsx` (7): one card per award, after the scores and before the gallery; winners in colour, one who left too; Modern art's word; none on SCOREBOARD or with no awards; Taglish; the `fitRows` style plus fallback class; the Tonight sizing and strip.
  - `phoneViews.test.tsx` (+1): the award leads the FINAL, in English and Taglish; no card without one.

**Decisions:** DECISIONS 72 (assignment, qualifying, Modern art's timed-out turns, the layout and its sizes).

Reviews:
- **spec-checker: PASS WITH FIXES** (no Must-fix).
  - Done: Bilis!'s copy matches the spec; the Kim check is added.
  - Kept: a cut-short turn is now excluded from Modern art (from the fairness review); a correct guess at 0 points can't happen (`GUESSER_POINTS_MIN` > 0), so it has no test.
  - Recorded in DECISIONS 72: names at 3.45 vh on a 16:9 TV with 10 players and the gallery.
- **secrets-fairness: PASS WITH FIXES.**
  - Should-fix done: Modern art went to a drawer whose turn was skipped, ended or abandoned; it now counts only turns that ran out of time (`TurnSummary.endReason`).
  - Nit done: a test for a Bilis! tie at 0 ms.
  - Nit kept: `awards` stays in the room after FINAL until the next game resets it; views gate on FINAL.
- **mobile-ux: FAIL → fixed.**
  - Must-fix done: at 1024×768 in game 2 the scores box scrolled and showed 2 rows; the 16:9 Tonight column was clipped. Now the rows fit (em padding, lower floor), the Tonight column fits its height, and the narrow strip is one line.
  - Should-fixes done: heading padding and width; award text sizes up (name 3.6 vmin, reason 2.4 vmin at 80 % white); the phone card is a labelled section with an `h2`, says "Your award", and breaks long words.
  - Nit done: a fallback class without container units.
  - Kept: 17 vmin thumbnails (the price of the room); the Taglish phone card at 360 px is a Kim check.

**Playtest:**
- `.playtest/F50/scenario.ts` (playtester agent; Ana + 9 bots, 2 rounds): 3 award cards with distinct winners between the scores and the gallery; Ana won Picasso, and her phone shows it above "Final scores"; no horizontal overflow at 360×560; no console errors. Its overlap check was missing, and the screenshots showed the cards over the scores, which led to the layout work above.
- `.playtest/F50b/scenario.ts` (Ana + 9 bots; game 1 ended by the host after ~45 s, then a rematch and game 2 with Tonight), after the fixes, all pass at 1920×1080, 1024×768 and 1080×1920:
  - no page overflow;
  - the score rows end above the award cards, and the cards end above the gallery;
  - the scores box doesn't scroll;
  - Tonight isn't clipped (and "+N more" is in view);
  - the heading doesn't overlap a card.
  - Row text: 37 px at 1080p, 26 / 18 px at 4:3 in games 1 / 2. Screenshots: `game2-1920x1080.png`, `game2-1024x768.png`.

**Notes for next session:**
- Awards depend on `history`; if an InkStore drop ever sets `hasInk` false, Modern art still names the turn (the gallery shows "Drawing not kept").
- Backlog: fold the night totals into the score rows, or page the standings, to keep TV sizes with 10 players (F50).

**How to try it:**
- Tests: `npx vitest run server/awards.test.ts client/src/components/screen/ScreenAwards.test.tsx client/src/components/phone/phoneViews.test.tsx`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F50b/scenario.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), `/dev/bots/CODE` (Spawn 3), a phone window at `/play/CODE`, Start, and press "Everyone: guess right" until Final scores: the award cards sit under the scores, and the phone leads with "Your award" if it won one.

## F49 — Gallery on the Screen (2026-10-31)
**What changed:**
- **The server side was already there from F12** (DECISIONS 35): `ScreenView.gallery` (`{turnId, drawerPid, word}` per turn, FINAL only), `ink:get {turnId}` answering a frozen turn's actions to Screen sockets only (`notScreen` for phones, `inkNotKept` for a dropped, live or unknown turn), the 4 MB room budget dropping the oldest frozen log first, and the 60 per 10 s `ink:get` limit. F49 adds the client and the end-to-end test.
- **Store `client/src/lib/gallery.ts`** (`createScreenGallery`): asks `ink:get` once per drawing on the Screen's `/ink` socket (5 s ack timeout) and holds each answer as an `InkStack`. `inkNotKept` → "Drawing not kept", never asked again. Anything else (a timeout, `rateLimited`, `notJoined` before the hello, even `notScreen`) is asked again after 2 s, doubling to 16 s. A successful `ink:hello` (a reconnect, or a Screen opened straight into FINAL) asks the waiting ones at once, keeping their failure count. `clear()` when the game leaves FINAL drops late answers. Pure `galleryKey` holds the key rules.
- **`client/src/components/screen/ScreenGallery.tsx`**, under the final scores (and the Tonight panel) in `ScreenStandings`:
  - A strip of square thumbnails in turn order, the word and "by Name" (in the drawer's colour) under each; a drawer who left is named from the night's totals. ‹ › page the strip; "Tap a drawing to see it big · ← → to page" on a Screen with a mouse. A thumbnail still loading is a dim pulsing square, never a white one that looks empty.
  - Tapping one opens it large in a dialog (opaque): the drawing, the word sized to fit its column (longest single word × 0.6 em ≤ the column, then `overflow-wrap: anywhere`), "by Name", "3 of 8", and ‹ ✕ ›. ← → page (and open the first or last with none open), Esc closes except during a rematch countdown, where Esc stays the host's Cancel. Tab stays inside the dialog, the strip behind it is `inert`, the strip scrolls to follow the open drawing, and closing focuses the last one seen.
  - Thumbnails are `InkCanvas` with a new `InkSource` (`staticInk` for a finished stack), so eraser strokes paint the canvas colour as on the live Screen.
  - The standings tighten (smaller title and rows, two columns from 4 players in landscape) to leave room; bigger thumbnails with ≤ 6 players and no Tonight panel, and always in portrait.
  - The room-code strip is hidden while the gallery is up, as the spec says.
- **Copy:** gallery lines in both tables (`galleryTitle` … `galleryHint`; Taglish "ni Mika", "Hindi na naitabi ang drawing").
- **Bundle:** the gallery lives in the lazy Screen chunk; the F39 bundle test (no `*gallery*` module on the player page) passes. No new dependencies.
- **Tests:**
  - `server/inkGateway.test.ts`: "FINAL's gallery lists every drawing; past the room's budget the oldest answer inkNotKept": a full game through the gateway with a 200-byte room budget; the Screen's last view lists all 4 turns in order, `ink:get` answers the 2 oldest `inkNotKept` and the 2 newest with their exact actions, and both phones' `ink:get` is refused `notScreen`, even for a drawing they made.
  - `client/src/lib/gallery.test.ts` (12): asks once per drawing; `inkNotKept` final; retry with backoff after a timeout, `rateLimited`, `notJoined` and `notScreen`; `retry()` asks at once and keeps the failure count; `clear()` drops late answers; subscribers; `galleryKey` (open first/last, paging clamped, paging during a countdown, Esc vs the countdown, other keys).
  - `client/src/components/screen/ScreenGallery.test.tsx` (5): turn order, words and drawers (one who left, in colour); canvas, "Drawing not kept" and loading; none on SCOREBOARD or with no drawings; Taglish; the viewer word's sizing.

**Decisions:** DECISIONS 71.

Reviews:
- **spec-checker: PASS WITH FIXES** (no Must-fix). Should-fixes done: open/page/close logic is now the pure `galleryKey`, tested; the Kim check. Kept: the `Screen.tsx` glue (`retry()` on the hello ack, `want`/`clear` on FINAL) has no unit test, since the client tests run in Node without a DOM; both playtests cover it.
- **secrets-fairness: PASS.** Should-fixes done: `notScreen` is retried instead of shown as "Drawing not kept"; `retry()` keeps the failure count. Nit kept: a hello answered `rateLimited` leaves drawings on their timers (fine).
- **mobile-ux: PASS WITH FIXES.** Must-fix done: a long word clipped in the viewer (sized to the column now). Should-fixes done: focus trap and `inert` strip; captions up to 3.5 / 3 vmin; dim loading square; the strip follows the viewer and focus returns to the last one seen; the 10-player fit checked (playtest below). Nits done: room-code strip hidden during the gallery, opaque viewer, no label on thumbnail canvases. Moved to Backlog: let the gallery take the leftover height in landscape.

**Playtest:**
- `.playtest/F49/scenario.ts` (Ana + 3 bots, 2 rounds): 8 thumbnails in turn order with word and drawer; all 8 canvases have ink, Ana's included (through `ink:get`); the viewer opens on "1 of 8", → and › page, Esc closes; no overflow at 1920×1080 or 1080×1920; Ana's phone at FINAL has no canvas and no gallery ("See the gallery on the Screen").
- `.playtest/F49b/scenario.ts` (Ana + 9 bots, 20 drawings), after the review fixes: no room-code strip; no page overflow and all 10 score rows inside the viewport at 1920×1080, 1024×768 and 1080×1920; every viewer word fits (scrollWidth ≤ clientWidth); Tab and Shift+Tab stay in the dialog; Esc returns focus to the last thumbnail viewed. Screenshots `2-1024x768-screen.png`, `3-longest-word-screen.png`. No console errors.

**Notes for next session:**
- F50 (awards) goes between the podium and the gallery in `ScreenStandings`; the standings are already compact with the gallery up, so check the 1024×768 Screen with 10 players and Tonight (`.playtest/F49b` reaches FINAL with 10).
- The 🖼️ Modern art award ("the drawing nobody got") can point at a gallery entry by `turnId`.

**How to try it:**
- Tests: `npx vitest run client/src/lib/gallery.test.ts client/src/components/screen/ScreenGallery.test.tsx server/inkGateway.test.ts`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F49b/scenario.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), `/dev/bots/CODE` (Spawn), a phone window at `/play/CODE`, Start, and press "Everyone: guess right" on the bots page until Final scores: the gallery is under them; click a drawing, ← →, Esc.

## F48 — Custom words (2026-10-31)
**What changed:**
- **`host:customWords {words, clear?: true}`** now works (it answered `notAvailable` before). It needs the host (the token Screen or the crown phone) and the LOBBY, and **adds** the words to the room's list. `clear` empties the list first, and an empty batch without it changes nothing, so a blank submit can't wipe the list.
  - Each word: trimmed, spaces collapsed, difficulty 2, no alternates, `lang: 'custom'`, id `custom/<normalised form>` (stable across Clear, so `usedIds` still knows a drawn word).
  - Duplicates by normalised form, in the batch or already in, are dropped silently, as is a word that normalises to nothing ("the", "a", "!!!").
  - Over 100 in total, the batch is refused whole with the new `tooManyWords`.
  - Pure helper `server/customWords.ts` (`addCustomWords`); no effect, since views carry the new count.
- **The deck** (`server/deck.ts`): `allowedWords` adds the custom words last, whatever the Words, Spicy and Difficulty settings. `drawChoices` puts the topmost custom word in every deal while the deck holds one: easy, Ours, hard in 'mixed'; two easy and Ours in 'easy'. The other slots take pack words only, and custom words fill in only when too few pack words are left. A custom word sorts as medium (the auto-pick already counted it so). Custom words alone (3+) are enough to start.
- **Views:** only `host.customWordCount`, as before. `ChoiceView` gains `custom: boolean` (drawer only), and the card shows "Ours" ("Atin") in place of the level.
- **UI** (`client/src/components/CustomWords.tsx`): "Add your own words ✍️ · N" beside Settings on the token Screen and under the settings summary on the crown phone opens a full-cover panel. It has the rules, Add words (above the box, so a phone keyboard can't cover it), the box (one per line or comma-separated), "Our words: N" and Clear all (tap twice). `parseCustomWords` (`client/src/lib/customWords.ts`) catches a word over 30 characters (named in the error) or over 100 at once before sending. On the Screen the panel says everyone can see it and points secret words to the host's phone. Copy in both tables.
- **New dependencies:** none. Join budget 111.2 of 120 KB JS.
- **Tests:**
  - `server/reducer.customwords.test.ts` (16): the word shape; host-only (token Screen, crown phone; refused from a plain Screen, a guesser, a phone claiming host); adds; dedupe by normalised form; filler-only dropped; clear vs a blank batch; the 100 limit; LOBBY only; no effect; views carry only the count (lobby) and only the drawer gets the custom choice, flagged; one custom per deal while any remain, then none (8 turns); the slot order in 'mixed' and 'easy'; every Words/Spicy/Difficulty setting; custom-only start and `notEnoughWords`; the auto-pick in an Easy room; guessing a custom word (no plural rule); a drawn custom word not dealt in the next game, the list kept.
  - `server/deck.test.ts` (+3), `server/views.leak.test.ts` (+1: a scripted game with `qzcustom*` words audits every view and effect through to FINAL), `server/sockets.test.ts` (+1: through the gateway, counts only, `clear`), `shared/schemas.test.ts` (`clear`), `client/src/lib/customWords.test.ts` (3), `client/src/components/CustomWords.test.tsx` (3), the "Ours" card in `phoneViews.test.tsx`, the count on the crown phone's button in `hostPhone.test.tsx`.

**Decisions:** DECISIONS 70 (adds vs replaces, `clear`, dropped words, the limit, the slot, settings, the Screen note).

Reviews:
- **spec-checker: PASS WITH FIXES.** Must-fix done: DECISIONS 70, this entry and the Kim check. Should-fix kept: the 30-character limit stays in UTF-16 units like every other text limit since F02 (recorded in DECISIONS 70); a custom word equal to a pack word isn't checked (recorded).
- **secrets-fairness: PASS WITH FIXES** (no leak, purity kept). Should-fix done: a blank-only batch became `[]` and cleared the list; Clear is now the explicit `clear` flag, with a test. Nit done: the doubled schema comment.
- **mobile-ux: PASS WITH FIXES** (no Must-fix). Should-fixes done: Add moved above the box (keyboard), safe-area padding, the error clears as you type, 48 px buttons in the panel; nit done: focus ring on the phone's button. Kept: the button is `aria-disabled` on an empty box with no message; the panel stays in the `/play` chunk (budget still passes).

**Playtest** (`.playtest/F48/scenario.ts`, dev server), all steps pass, run again after the review fixes:
1. The Screen adds "Tita Baby, lola / lolo": "Our words: 3", and the button reads "· 3".
2. The crown phone adds "Mang Kanor": 4 on the phone and on the Screen's button.
3. A 31-character word shows "Too long" and nothing is sent.
4. Start: the drawer's cards are e.g. "rain · Easy", "Tita Baby · Ours", "white lady · Hard"; no custom word in the Screen's or the guessers' page text.
5. The phone panel at 360×560: no horizontal overflow, Add words in view.
6. Clear all on the Screen: "Tap again to clear", then "Our words: 0".

No console errors. Screenshot: `.playtest/F48/5-panel-360-Ana.png`.

**Notes for next session:**
- A custom word that equals a pack word can come up twice in one night (DECISIONS 70); dedupe against the packs if Kim sees it.
- The dev bots pick custom words like any card.

**How to try it:**
- Tests: `npx vitest run server/reducer.customwords.test.ts server/deck.test.ts server/views.leak.test.ts`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F48/scenario.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), "Add your own words ✍️", type a few words, Done; two phone windows at `/play/CODE`; Start: the drawer's cards have one "Ours".

## F47 — Spicy pack (2026-10-31)
**What changed:**
- **New pack `data/packs/tl-pang-inuman.json`**: "Pang-inuman", `language: 'tl'`, `rating: 'spicy'`, 67 words (easy 14 · medium 28 · hard 25).
  - Themes: drinks and the table (`beer`, `tagay`, `tanggero`, `chaser`, `beer pong`), pulutan (`kropek`, `kilawin`, `crispy pata`), the morning after (`hangover`, `bagsak`, `nagsusuka`, `walk of shame`), the party (`nightclub`, `birit`, `spin the bottle`, `ambagan`, `sabit`) and dating (`jowa`, `ex-jowa`, `first date`, `friend zone`, `third wheel`, `torpe`).
  - The spec's eight examples are all in: `tagay`, `jowa`, `hangover`, `walk of shame`, `pulutan`, `inuman`, `sabit`, `lasing`.
  - English loanwords people say over drinks sit in this Taglish pack, with glosses like every `tl` word of level 2–3.
  - Nothing explicit, nothing about groups of people, no brand names.
- **Dealt only with Spicy on**: no deck change was needed. `allowedWords` already adds spicy packs only with `spicy` on, of the chosen languages, so Taglish or Mixed. With Words → English, Spicy adds nothing (DECISIONS 69; Backlog: an English spicy pack or a hint). A `// SPEC-QUESTION:` in `server/deck.ts` points there.
- **Clashes swept:** no word or alternate is another pack's word (`ghosting` was already an `en-everyday` sample, `proposal` matched `marriage proposal`; both dropped). No alternate is shared within the pack (`shot` only on `shot glass`). `bir` and `bar` were left out because they made many unrelated guesses "close". `basi` was dropped: the bots' decoy `kasi` was 1 edit from it. A one-off `matchGuess` sweep of every decoy over all 11 packs now finds nothing "close".
- **New dependencies:** none.
- **Tests:**
  - `server/packs.test.ts`: "ships the Pang-inuman pack" checks that it is the only spicy pack, the title, language and rating, ≥ 60 words, the spec's eight examples, > 10 words per level, and six typed alternates accepted (`drunk`, `dyowa`, `hungover`, `lasengo`, `cheers`, `KKB`). The start summary is now "Loaded 11 word packs (584 words)".
  - `server/deck.test.ts`: "deals the shipped Pang-inuman pack only with spicy on" checks the shipped packs with Spicy off, for every language and difficulty (none dealt). With Spicy on it checks the whole pack for Taglish and Mixed, none for English, and some for Easy.

**Decisions:** DECISIONS 69 (one `tl` spicy pack, English rooms, loanwords, clash sweep, what stays out).

Reviews:
- **spec-checker: PASS WITH FIXES** (no Must-fix). Should-fixes done: `wasted` removed from `hangover` (it means drunk); `sweet dance` replaced by `slow dancing`; the SPEC-QUESTION comment added at the deck filter.
- **secrets-fairness, mobile-ux:** not run. Only pack data, tests and a comment changed; no server logic, ink or UI.

**Playtest:** not run, since there is no UI change. The deck tests deal from the shipped packs with the real settings filter.

**Notes for next session:**
- F48 (custom words) adds to `allowedWords` beside this filter. Custom words are not rated, so they come in whether Spicy is on or off.
- New pack words: re-run the decoy `matchGuess` sweep (see F46's note); short alternates (3 letters) make many guesses "close".

**How to try it:**
- `npm run packs:check` prints `tl-pang-inuman (tl, spicy): 67 words`.
- `npx vitest run server/packs.test.ts server/deck.test.ts`.
- `npm run dev`, Screen at http://localhost:5173 (Start), Settings → Words → Taglish, Spicy words → On, then `/dev/bots/CODE` and play a turn from a phone at `/play/CODE`: the word cards include Pang-inuman words. With Spicy off they never appear.

## F46 — Full family word packs (2026-10-31)
**What changed:**
- **Eight new family packs** in `data/packs/`, one theme each, so Kim can review a file at a time:
  - English: `en-home` (70), `en-food` (57), `en-outdoors` (76), `en-actions` (61).
  - Taglish/Filipino: `tl-pagkain` (50), `tl-bahay` (56), `tl-labas` (43), `tl-gawain` (45).
  - The spec samples stay as they were in `en-everyday` and `tl-pinoy-life`.
- **Totals:** 293 English (easy 121 · medium 121 · hard 51) and 224 Taglish (easy 60 · medium 104 · hard 60).
- **Alternates** cover the common spellings (tsinelas/chinelas, tsokolate, longganisa/longanisa/longaniza, kalesa/calesa, kwintas/kuwintas, paru-paro/paruparo) and the other language's name: the Tagalog name on English words, the English name on Taglish words.
- **Glosses:** every `tl` word of difficulty 2–3 has one (164 words).
- **Rules kept:** no brand names; no word that needs letters or numbers to draw.
- **Overlaps:** a concept appears in only one language, so the English pack has no "boat" beside `bangka`, and no alternate equals another word (`packs:check` warns on none).
- **`hangover` left `en-everyday`.** F47's spicy pack needs it, and a word in two packs fails `packs:check` (DECISIONS 68). `en-everyday` is now the spec's other 29 samples.
- **Dev bots:** five decoy guesses landed on or near a new word: `siguro` (contains `guro`), `kanina` (`kanin`), `mamaya` (`maya`), `sobra` (1 edit from `sobre`) and `tuloy` (`tulog`, `tulay`). They are now `marahil`, `kahit`, `naman`, `kasi`. The other decoys were already clear, and a one-off `matchGuess` sweep over every word found none "close".
- **New dependencies:** none. The server reads the packs at start; none of this reaches the client bundle.
- **Tests (`server/packs.test.ts`):**
  - ≥ 200 family words per language, with ≥ 40 at each level.
  - The spec's spicy list stays out of the family packs.
  - The common spellings and the other language are accepted (15 words, `isCorrect`).
  - Every `tl` word of difficulty 2–3 has a gloss.
  - The start summary reads "Loaded 10 word packs (517 words)".
- **Tests (`client/src/dev/bots.test.ts`):** the decoys are checked against every shipped pack (`import.meta.glob`), not just the two sample files.

**Decisions:** DECISIONS 68 (themed packs, one language per concept, `hangover` out of the family pack, the decoy swaps).

Reviews:
- **spec-checker: PASS WITH FIXES.**
  - Must-fix done: the Kim check above, naming the doubtful words; this entry and DECISIONS 68.
  - Should-fix done: weak Taglish words replaced (`padala`, `hele` and `karera` became `karoling`, `pagtatanim` and `luksong lubid`); English `nightmare` dropped; a spelling test added.
  - Kept: `en-actions` has 3 easy words; the level balance is per language, not per pack.
- **secrets-fairness, mobile-ux:** not run. No server, shared, ink or UI code changed: only pack data, a server test and the dev-only bot decoys.

**Playtest:** not run, since there is no UI change. The packs load through the same start path the tests cover (`loadPacksForStart`), and the deck tests deal from packs of this shape.

**Notes for next session:**
- F47: add `data/packs/tl-pang-inuman.json` (or similar) with `rating: 'spicy'`. The family packs hold none of the spec's spicy words, and a test enforces that.
- A new decoy or pack word must stay clear both ways: `bots.test.ts` checks substrings only. Sweep "close" with `matchGuess` over the loaded packs.

**How to try it:**
- `npm run packs:check`: counts per pack and level.
- `npx vitest run server/packs.test.ts client/src/dev/bots.test.ts`.
- `npm run dev`, Screen at http://localhost:5173, Settings → Words → Taglish (or English, Mixed), then `/dev/bots/CODE` for bots; the drawer sees the new words and the Taglish glosses.

## F45 — Taglish copy (2026-10-31)
**What changed:**
- **Taglish table** (`TAGLISH` in `client/src/lib/copy.ts`), typed against the English table, so every key is there: every phone and Screen string, including the How to play strip, the first- and second-turn captions, the host bar and shortcuts, pause, rematch, join and takeover, drawing tools, and the reveal ("Sino’ng nakakuha?", "Ang word ay…", "Walang nakakuha!"). The spec's sample lines are used where they fit. `copy` was already a lobby setting (Settings → Game text); the Screen and every phone switch as soon as it changes.
- **Awards:** the six award names and reasons plus `awardsTitle`, in both tables, ready for F50.
- **Two Screen labels moved into the table:** the live drawing's `aria-label` (`liveDrawing`, now an `InkCanvas` prop) and the blanks' label (`Blanks` takes `t`; `wordLettersLabel` + `hintsLabel`).
- **Not translated:** the landing page (spec), and anything before the phone or Screen has a room view: the join form, its errors and "Connecting…" (DECISIONS 67).
- **New dependencies:** none. The join budget is 109.8 of 120 KB JS with both tables on the player page.
- **Tests:** `copy.test.ts` (+6): a table for every `copy` value; both tables have the same keys; no empty Taglish string; the same `{placeholders}` and the same emoji per key; the spec's Taglish lines; the How to play strip, captions and award reasons differ from English. `ScreenTurn.test.tsx`: the `Blanks` label tests now pass `t`.
- **Earlier "F45:" notes** in this file (the F24–F44 keys) are all covered: the typecheck refuses a Taglish table missing any key.

**Decisions:** DECISIONS 67 (the Taglish style and where English stays, the spec's lines, awards ahead of F50, English before a view, `lang`).

Reviews:
- **spec-checker: PASS** (no Must-fix). Should-fixes done: DECISIONS 67 records the English join form and the pre-view flash; the Kim check for the Taglish review. Nits: the `’` apostrophe recorded; "Pang-#{rank}" and the countdown lines are flagged for Kim.
- **mobile-ux: PASS WITH FIXES.** Must-fix done: `gotItCount` "{guessed} sa {of} ang nakakuha" squeezed the drawer's word in the top bar at 360 px; now "{guessed}/{of} nakakuha". Should-fixes done: "Tuloy sa" and "Game {n}, simula sa" for the countdowns; a shorter `tapOne`; `levelMedium` "Medium" (was "Katamtaman", which took width from the word card); `ctlEnd` "End game" so the Screen's host bar wraps less on a tablet. Nits done: "Round {cycle}/{cycles}", "i-tap ang isang pangalan", "pagkalipas ng isang minuto". Kept: "✏️ {name} nagdo-drawing" on the guesser bar (truncates the verb only for very long names, as the English does).
- **secrets-fairness:** not run, since `server/`, `shared/` and the ink path are unchanged (`InkCanvas` only takes its label as a prop).

**Playtest** (`.playtest/F45/scenario.ts`, dev server; a 1920×1080 Screen, Ana at 360×560, Bea at 390×664, Cy at 412×780), all steps pass, run again after the review fixes:
1. The Screen shows "How to play"; three phones join.
2. Settings → Game text → Taglish: the Screen shows "Paano laruin" and "1 · Isa ang magdo-drawing sa phone niya"; phones show "Pasok ka na, …" and "Ikaw ang host 👑".
3. Start: the drawer sees "Ikaw ang magdo-drawing!" and "Pili ka ng isa. Bawal ang letters at numbers!"; the Screen "Pumipili si Ana ng word…".
4. Drawing: the drawer's bar "word · 1:00 · 0/2 nakakuha"; the Screen's caption "Nagdo-drawing si Ana. Kayong iba: i-type ang hula sa phone 🤫"; guessers' placeholder "Hula mo?".
5. A wrong guess, then the right one: "✓ Nakuha mo! +290"; the Screen "Nakuha ni Bea!"; no word on the Screen or guessers before the reveal.
6. The drawer and guesser views at 360×560, 390×664 and 412×780 (and the choose screen, after a guess, the reveal): no overflow, nothing clipped (13 layout checks).
7. Reveal: "Nakuha ng lahat! 🎉", "Ang word ay…", "Sino’ng nakakuha?".

No console errors. Screenshots: `.playtest/F45/360-drawer-Ana.png`, `360-guesser-Bea.png`.

**Notes for next session:**
- Every new string goes into both tables; `copy.test.ts` also checks placeholders and emoji match.
- F50: the award copy is ready (`awardsTitle`, `awardPicasso`/`awardPicassoWhy`, `awardBilis`, `awardSharpshooter`, `awardMalapitNa`, `awardMostCreative`, `awardModernArt`, each with `…Why`).
- The playtest layout scan should skip `.sr-only` elements (they report a 1 px client width).

**How to try it:**
- Tests: `npx vitest run client/src/lib/copy.test.ts client/src/components/screen/ScreenTurn.test.tsx`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F45/scenario.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), two phone windows at `/play/CODE`; on the Screen, Settings → Game text → Taglish; play a turn.

## F44 — Rate limits and limits (2026-10-31)
**What changed:**
- **`player:join`, 10 per client address per minute** (`server/sockets.ts`, `JOIN_RATE_LIMIT`), before the reducer. The address is `proxy-addr` with Express's compiled `trust proxy`, so behind nginx it is the phone's (`TRUST_PROXY`, now passed to `attachSockets` in `server/index.ts`; a production start without it logs a warning). Counted: every join by a key the room doesn't know, across rooms, refused or not, takeovers included. Not counted: a rejoin by a known key (a barkada reloading together) and a plain join to a full room (it reads "That game is full."). Refused as `rateLimited`. New option `joinRateLimit` for tests.
- **Host actions, 10 per second per socket** (`HOST_ACTION_RATE_LIMIT`), every `host:*` try counted before the host check; `rateLimited`.
- **Phone:** `joinOutcome` maps `rateLimited` to the name step with "Too many people joined from this network just now. Try again in a minute." (`joinTooMany`), keeping the typed name.
- **Host copy:** "Too fast. Wait a moment and try again." (`tooFast`) from `hostRefusalCopy` (new, `client/src/lib/hostSend.ts`), shared by the crown phone's drawer and the Screen's host bar; the Screen's Start and settings map `rateLimited` to it too (their other refusals unchanged).
- **Already enforced by earlier features and now proven together:** room creation 10/h and the room check (HTTP 429 messages), guesses (`slowDown` → "Slow down"), reactions (the row rests 1 s), ink (40 batches/s resent silently by the drawer's sync, 4 KB, 200 points per op, 20 invalid batches disconnect `/ink`), the 100 KB socket frame, names and 10 players.
- **New dependencies:** `proxy-addr` (and `@types/proxy-addr`): ported from Buzzr, so the join limit keys on the same client address as HTTP; already installed under Express.
- **Tests:**
  - `server/rateLimit.test.ts` (+14, over real sockets on both namespaces): guesses (`slowDown` at 699 ms, unread, per player, accepted at 700); reactions (1 a second); joins (the 11th across rooms refused and not joined, free again after a minute; refused joins count; ten phones reloading twice never count; a full room answers `roomFull` uncounted while a takeover there counts; per address behind a trusted proxy; a spoofed `X-Forwarded-For` buys nothing without one); host actions (the 11th in a second refused, settings unchanged, a second Screen has its own, refused tries count, a phone without the crown too); ink (40 a second, a 201-point op and a >4 KB batch refused, the 20th invalid batch disconnects `/ink` but not the game socket, a >100 KB frame closes the connection).
  - Client: `hostSend.test.ts` (new, 5), `phone.test.ts` (+1, `joinOutcome`).

**Decisions:** DECISIONS 66 (what counts toward the join limit, the address behind nginx, the host limit before auth, the copy, the limits that stay silent).

Reviews:
- **spec-checker: PASS** (no code Must-fix). Done: DECISIONS 66 (with the takeover consequence), silent reactions and ink recorded there, the batch key's DECISIONS 64 cited, the dependency's justification above. Checked: dev bots have fixed keys, so a re-spawn rejoins uncounted and 10 bots fill a room exactly.
- **secrets-fairness: PASS WITH FIXES** (no Must-fix). Done: a takeover into a full room now counts; the production warning for a missing `TRUST_PROXY` (and a Kim check). Backlog: a looser per-key cap on rejoin churn; IPv6 /64 keying and `::ffff:` folding.
- **mobile-ux: PASS WITH FIXES.** Must-fix done: the Screen's settings and Start no longer use `hostRefusalCopy`'s lobby-irrelevant messages ("coming in a later update"), only `tooFast` for `rateLimited`. Done: "this network" instead of "this Wi-Fi" (mobile data shares carrier addresses too). Backlog: clear a Start refusal after `STATUS_MS`. Checked: the join error sits under the button in a top-aligned form, so two lines fit at 360×560.

**Playtest** (`.playtest/F44/scenario.ts`, dev server; a 1920×1080 Screen and 12 Pixel 7 contexts, all from one address), passes, run again after the review fixes:
1. The Screen starts a room.
2. p1–p10 join; p10 sees "You're in, p10!" and 10 players.
3. p11 sees "That game is full." (not the Wi-Fi limit message).
4. The Screen starts a second room; a phone joining it sees "Too many people joined from this network just now. Try again in a minute.", its name kept.

No console errors. Not driven in the browser: the host-action, guess, reaction and ink limits (no UI path reaches them at human speed; covered by the socket tests).

**Notes for next session:**
- Playtests and `/dev/bots` share one address with the dev server: more than 10 new phones within a minute (across scenarios too) get `rateLimited`. Rejoins by a known key are free. Pass `joinRateLimit` to `attachSockets` in tests that need more.
- F51/F52: the container needs `TRUST_PROXY=1` (start-up warns without it in production).

**How to try it:**
- Tests: `npx vitest run server/rateLimit.test.ts client/src/lib/hostSend.test.ts client/src/lib/phone.test.ts`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F44/scenario.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), open `/play/CODE` in 10 private windows and join; an 11th says "That game is full."; start a second game and join it from an 11th window: "Too many people joined from this network…"; wait a minute and it joins.

## F43 — Reconnect every role (2026-10-31)
**What changed:**
- **No production code.** The reconnect paths were built by F04 (rejoin by `playerKey`), F12 (`ink:hello` snapshots, `ink:sync`), F25 (the crown stays with a disconnected holder), F40 and F41 (the away debounces). F43 proves them end to end over real sockets on both namespaces, with a page reload modelled as new main and `/ink` sockets carrying only what the page keeps (the Screen its hostToken, a phone its playerKey and name).
- **New dependencies:** none.
- **Tests:** `server/sockets.reconnect.test.ts` (new, 10), each refreshed view deep-equal to the one before the reload (time standing still), and a leak check (`expectNoSecrets`: the word, alternates, glosses and other choices in every event on both sockets):
  - The **Screen** with its token: host controls, DRAWING, clock, scores, crown and Ben's guess back; `ink:snapshot` first with both strokes, then live batches; no secrets; the `screenGone` check fired late pauses nothing.
  - A **tokenless TV**: the same game as a plain Screen, with the drawing.
  - The **drawer**: the word, its own snapshot only after `ink:hello`, drawing continues at `snapshot.seq + 1` and the TV's stack equals the server's; the `drawerAwayCheck` fired late pauses nothing. A drawer **holding the crown** keeps the host controls.
  - A **guesser who got it** (holding the crown): pid, points, `guessed`, crown and host controls; `alreadyGuessed`; no word; their new `/ink` socket gets nothing while Ana draws.
  - A **guesser who hasn't**: guesses after the reload and keeps the points into REVEAL; `ink:hello` gets nothing and `ink:get` is `notScreen`.
  - **Overlapping sockets** (the new page connects before the old socket drops): never disconnected, no `drawerAway`, the Screen's view unchanged.
  - **CHOOSING**: the drawer gets the same three choices back and chooses; the refreshed Screen and guesser get none.
  - **REVEAL**: the next drawer gets their deal back; the refreshed guesser and the Screen get none of it.
  - **All at once** (Screen, drawer and a guesser): `fewPlayers`, back in 3-2-1, the same turn, scores and drawing; every timer armed before the resume, fired late, leaves the room byte-identical.

**Decisions:** DECISIONS 65 (no production change; the reloaded phone's first moments without latency correction; a 2-player reload pauses).

Reviews:
- **spec-checker: PASS WITH FIXES.** Must-fixes: this entry, and a recorded browser playtest (re-run below with a stroke drawn after the drawer's reload; the stale failure screenshots were from a scenario bug and are gone); the client paths (hostToken from `localStorage`, the pad's resume at `seq + 1`) are covered by playtest steps 2–3, and real phones by the Kim check. Should-fixes done: the full leak check, the 3-2-1 timer picked by its length; the `ink:sync` resend and the Screen's gap re-hello were already covered (`inkGateway.test.ts`, `client/src/lib/ink.test.ts`).
- **secrets-fairness: PASS** (no Must-fix). Should-fixes done: the full leak check on every refreshed page, Cy's `/ink` refused, the CHOOSING and REVEAL refreshes, every stale timer fired after the resume, the overlapping-socket reload. Not done: its frozen wall clock point (the reducer runs on the monotonic clock, which the tests move); exact points for a guess just after a reload (DECISIONS 65). Nit left for F44: `player:join` has no per-IP limit yet.
- **mobile-ux:** not run, since `client/` is unchanged.

**Playtest** (`.playtest/F43/scenario.ts`, dev server; a 1920×1080 Screen, ana, ben and cara on Pixel 7s), all 6 steps pass:
1. ana starts, picks and draws; ben guesses right (+300), cara wrong; the Screen shows ink; guessers have no canvas.
2. The Screen reloads: code, "Round 1/2", the clock, the drawing, ben's +300 and cara's guess, the host controls; no word.
3. ana reloads: still the drawer with "Host", "1 of 2 got it", her word and her strokes on the pad; a new stroke after the reload reaches the Screen.
4. ben reloads: "You got it! +300", the same points, no crown, no canvas.
5. cara reloads: the guess box, +0, no word, no canvas.
6. cara guesses the word and the turn moves on.

No console errors.

**Notes for next session:**
- `server/sockets.reconnect.test.ts` has `openScreen`/`openPhone`/`closePage` helpers for both namespaces and `expectNoSecrets`; reuse them for later edge-case tests.
- F44: the per-IP `player:join` limit must not lock out a barkada reloading together behind one NAT; consider exempting rejoins by a known `keyHash` (secrets-fairness nit).

**How to try it:**
- Tests: `npx vitest run server/sockets.reconnect.test.ts`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F43/scenario.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), three phone windows at `/play/CODE`; start, draw a little, guess once; then reload the Screen, the drawer and each guesser in turn: each comes back as it was.

## F42 — Rejoin by name from another phone (2026-10-31)
**What changed:**
- **Server takeover** was already in place (F04's `player:join` with `takeOver`, F25's crown, `fx rejoined` to Screens). F42 adds the tests that prove it and one hardening:
  - **`/ink` binds the phone's key** (`server/inkGateway.ts`): `InkSocketData.keyHash` from the handshake; `isCurrentPhone` refuses a socket whose player's hash has changed, for `ink:hello`'s drawer snapshot, `ink:batch`, `ink:sync` and `doodle:batch`. A dead phone's leftover `/ink` socket can't draw, resync, doodle or read the drawing for the new phone. The batch rate is now bucketed per player and phone (`batchKey`: `code:pid:keyHash`), so the old socket can't use up the new phone's budget.
- **Phone** (`client/src/lib/phone.ts`, `components/phone/JoinForm.tsx`, `pages/Play.tsx`): `joinOutcome` maps `nameOfDisconnected` to `{status: 'takeOver'}` (was a taken name, DECISIONS 29). The new `TakeOverPrompt` asks "Are you Jun?" with a hint ("Jun’s phone is offline. Rejoin to keep their points."), **Rejoin as Jun** and Pick another name; its heading takes focus. Rejoin makes a new playerKey and joins with `takeOver: true` (sent again on a reconnect until answered), no "You're in!" welcome. A refused takeover goes back to the name step with its message; Pick another name to an empty one.
- **Screen** (`components/screen/RejoinedToast.tsx`, new, wired in `pages/Screen.tsx`): `fx rejoined` shows "Jun is back (new phone)" for 4 s (`REJOINED_TOAST_MS`) below the top bar, in an always-mounted `role="status"`.
- **Copy:** `areYou`, `areYouHint`, `rejoinAs`, `pickAnotherName`, `backNewPhone`.
- **New dependencies:** none.
- **Tests:**
  - `server/reducer.join.test.ts` (new, 12): asked first (`nameOfDisconnected`, ignoring case, nothing changed); takeOver hands over pid, score, colour and doodle under the stored name, with the old key gone and `rejoined` to Screens only; the crown; the new phone's `hidden`; a full room; a connected name stays blocked with or without takeOver; the old phone afterwards gets `nameTaken` (or is asked, should the new phone drop too); a kicked or departed player's name joins as someone new and the kicked key stays out; takeOver on a free name is an ordinary join; mid-game a guesser keeps score, turn order and their correct guess (a second one is `alreadyGuessed`, no word in the fx); the drawer on a new phone ends the `drawerAway` pause into the 3-2-1 and gets the word.
  - `server/sockets.test.ts` (+1): over the wire, `nameTaken` while connected, a non-boolean `takeOver` refused, `nameOfDisconnected` after the drop, then the takeover's ack carries the old pid, the score and the new key hash, and only the Screen gets `fx rejoined`.
  - `server/inkGateway.test.ts` (+2): the old phone's `/ink` socket gets `notDrawer` for batches and sync while the new one draws (40 refused old batches leave the new budget whole); in the lobby the old socket can't doodle and later gets no drawer snapshot.
  - Client: `joinOutcome` (`phone.test.ts`), `TakeOverPrompt` (`phoneViews.test.tsx`, +2), `RejoinedToast.test.tsx` (new, 2).

**Decisions:** DECISIONS 64 (the prompt and its hint, the typed name in the prompt, no welcome on takeover, the 4 s toast and where it sits, `/ink` bound to the key hash and per-phone batch buckets, no host confirmation); DECISIONS 29 updated.

Reviews:
- **spec-checker: PASS WITH FIXES** (no Must-fix). Should-fixes done: DECISIONS 64 with `SPEC-QUESTION`s at the toast and `isCurrentPhone`, a socket-level test. Left as a Kim check: `Play.tsx`'s takeover wiring has no unit test (the playtest drives it end to end).
- **secrets-fairness: PASS.** Should-fix done: the old `/ink` socket shared the new phone's rate bucket (now `code:pid:keyHash`, tested). Nits done: `takeOverRef` reset on Pick another name, the `sockets.ts` comment. Accepted as the spec says: anyone typing a disconnected name may take that player over.
- **mobile-ux: PASS WITH FIXES.** Done: the toast moved from the top bar (where it covered the timer and "Jun’s phone reconnecting…") to `16vmin`; the prompt's heading takes focus. Recorded instead: the prompt shows the typed spelling. Left: a reconnect during the takeover ack can send a second join (harmless: it rejoins by the new key).

**Playtest** (`.playtest/F42/scenario.ts`, dev server; a 1920×1080 Screen, Jun on a Pixel 7, Bea on an iPhone 13, the new phone at 360×560), all 6 steps pass, run again after the review fixes:
1. Landing → Start opens the Screen.
2. Jun joins first (crown), Bea joins; both on the Screen.
3. A third phone typing "Bea" gets "Someone here already has that name", no prompt.
4. Jun's browser closed; the new phone typing "Jun" sees "Are you Jun?", "Rejoin as Jun" and "Pick another name".
5. Rejoin as Jun: the new phone holds the crown (host state).
6. The Screen shows "Jun is back (new phone)".

No console errors. Score handover is covered by the reducer and socket tests, not the playtest (no turn was played).

**Notes for next session:**
- `/ink` phone sockets now carry `keyHash`; any new phone handler on `/ink` should check `isCurrentPhone` and use `batchKey` for rate limits.

**How to try it:**
- Tests: `npx vitest run server/reducer.join.test.ts server/sockets.test.ts server/inkGateway.test.ts`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F42/scenario.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), phone windows at `/play/CODE` as Jun and Bea; close Jun's window; in a private window open `/play/CODE` and type "jun": "Are you jun?" → Rejoin: the Screen says "Jun is back (new phone)".

## F41 — Screen away and too few players (2026-10-31)
**What changed:**
- **Reducer** (`server/reducer.ts`): after every successful action, the room's away reasons are reconciled in order: `syncFewPlayers`, `syncScreenAway`, then F40's `syncDrawerAway`. Each re-arms its check when the epoch moved in that action.
  - **`screenAway`:** with no Screen connected (`screens` 0) in CHOOSING or DRAWING, `Room.screenAwaySince` (new) records when the turn first found none and `screenGone` is scheduled 3 s on (`SCREEN_AWAY_MS`), re-armed at the same time on every epoch change (the auto-pick, a host pause, another reason's pause). It adds the `screenAway` reason if the same absence is still on; a Screen back and gone again makes the old check stale (50 ms slack, as F40).
  - A Screen back (plain or host) or leaving CHOOSING/DRAWING clears it; with no other reason, the 3-2-1. A Screen gone during REVEAL pauses 3 s into the next CHOOSING; a room no Screen ever joined pauses 3 s into its first turn.
  - **`fewPlayers`:** fewer than 2 connected players in any phase but LOBBY and FINAL adds the reason at once, with no debounce (deliberate: the spec gives none and Socket.IO's ping timeout absorbs dead links; a Kim check asks how a 2-player reload feels). 2 or more connected clear it. Leavers and kicked players don't count; a `hidden` phone is connected. It holds REVEAL's and SCOREBOARD's auto-advance too.
  - `screenGone` runs while paused (beside `resumeGo`, `drawerAwayCheck` and `drawerGone`), so the Screen can go missing during a host or `fewPlayers` pause. Combined reasons resume only when all clear (F28's `pause`/`clearPauseReason`).
  - The drawer gone 30 s with `fewPlayers` holding too: the turn ends as `drawerGone` and the REVEAL stays paused (F40's limit still stops only for the host's pause).
- **No client change:** F28's overlay already says "Waiting for the Screen…" and "Waiting for more players…" (`pausedScreenAway`, `pausedFewPlayers`), and a rejoining Screen gets its state and ink snapshot (F12, F28).
- **Test fixture:** `makeRoom` now has `screens: 1` (a Screen makes every room), so other reducer tests don't trip `screenAway`.
- **Older tests updated** for the new pause, none weakened: DECISIONS 43's "a new cycle with nobody connected ends the game" can no longer be reached by players dropping, so `reducer.flow` and `reducer.overlap` now assert that `fewPlayers` holds the SCOREBOARD and refuses Next (`startCycle`'s FINAL stays as a backstop). "Nobody following in the cycle" now plays to turn 3's reveal, so two players stay connected; "starts that cycle with the next connected player" adds Cy at the SCOREBOARD. `reducer.turnorder`'s disconnected-places test goes through the pause and its 3-2-1.
- **New dependencies:** none.
- **Tests:**
  - `server/reducer.away.test.ts` (+30, now 58):
    - `screenAway`: the pause at 3 s with the clock frozen; a 3 s blip pauses nothing; only the second absence's check pauses; one of two Screens leaving; a Screen back → 3-2-1 → the clock moved by the pause; the phones' view and guesses refused; CHOOSING; re-armed through the auto-pick; nothing in LOBBY, REVEAL or SCOREBOARD; gone in REVEAL → paused 3 s into CHOOSING; a skip clears it into the 3-2-1; a host pause re-arms it and Resume leaves `screenAway` holding; End game; a room no Screen joined.
    - `fewPlayers`: down to 1 pauses at once; back to 2 → 3-2-1 → the clock moved; a new joiner; hidden counts as connected; leavers; CHOOSING, REVEAL and SCOREBOARD; not LOBBY or FINAL; nobody connected is one reason; End game; dropping again during the 3-2-1.
    - Several reasons: `screenAway` + `fewPlayers` resume only when both clear; a Screen gone during a `fewPlayers` pause; `drawerGone` under `fewPlayers`; all four reasons, each cleared only by its own return.
  - `server/sockets.test.ts` (+2): a real Screen socket dropping → `screenGone` → phones paused → a new Screen joins → 3-2-1; a phone dropping in a 2-player game pauses every view.

**Decisions:** DECISIONS 63 (the new `Room.screenAwaySince`, the 3 s counted from when the turn finds no Screen, leaving CHOOSING/DRAWING clears `screenAway`, `fewPlayers` in every game phase with no debounce, the away timers under other reasons, DECISIONS 43's FINAL now a backstop).

Reviews:
- **spec-checker: PASS WITH FIXES.** Must-fixes: this entry with a Kim check, and a recorded browser playtest (it had run; `.playtest/` isn't in the diff), both done here. Should-fixes accepted as recorded choices: the 3 s from when the turn finds no Screen, no `fewPlayers` debounce (in the Kim check), `drawerGone` under `fewPlayers`.
- **secrets-fairness: PASS** (no Must-fix; nothing secret in the new state, the reducer stays pure, stale timers hold with several reasons). Should-fixes: the 2-player blip and the 3-2-1 over a REVEAL with no Screen, both in the Kim check. Nit left: a choice abandoned during a Screen absence keeps the absence's start, so the next drawer's choice can pause at once; that is the continuous "3 s without any Screen" the spec describes.
- **mobile-ux:** not run, since `client/` is unchanged.

**Playtest** (`.playtest/F41/scenario.ts`, dev server; a 1920×1080 Screen, Ana drawing, Ben and Cara on Pixel 7s), all 7 steps pass:
1. Ana draws a stroke and it reaches the Screen; no word in the Screen's or the guessers' HTML.
2. Screen offline for 1 s: no phone shows "Paused".
3. Screen offline: "Waiting for the Screen…" on all three phones at 12.4 s (Socket.IO noticing the drop, then 3 s), Ben's guess box covered.
4. Screen back online: "Back in" 3-2-1 on the Screen, the drawing restored (758 ink px, as before), every phone resumes; no word leaked.
5. Ben and Cara offline: "Waiting for more players…" on the Screen and Ana's phone at 9.3 s.
6. The Screen offline for 14 s too, then back: still "Paused · Waiting for more players…", no 3-2-1.
7. Ben back: 3-2-1, the Screen, Ana and Ben resume; no word leaked.

Console errors: only the expected `ERR_INTERNET_DISCONNECTED` while offline. Screenshots: `.playtest/F41/screen-away-Ben.png`, `screen-away-Ana.png`, `screen-back-screen.png`, `few-players-screen.png`, `resumed-screen.png`.

**Notes for next session:**
- `reduce` now runs `syncFewPlayers`, `syncScreenAway` and `syncDrawerAway` after every action; a new away reason goes there, and its timer into `timer()`'s pause allow-list.
- Reducer tests get a connected Screen from `makeRoom`; pass `makeRoom({ screens: 0 })` to test without one.
- Tests that drop to one connected player now pause (`fewPlayers`).

**How to try it:**
- Tests: `npx vitest run server/reducer.away.test.ts server/sockets.test.ts`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F41/scenario.ts` (about 1.5 minutes).
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), three phone windows at `/play/CODE`, start and choose; close or set Offline on the Screen's window for 15 s: every phone says "Waiting for the Screen…"; bring it back: 3-2-1. Set two phone windows Offline: "Waiting for more players…"; one back: 3-2-1.

## F40 — Drawer away (2026-10-31)
**What changed:**
- **Reducer** (`server/reducer.ts`): after every successful action `syncDrawerAway` checks whether the CHOOSING or DRAWING turn's drawer is away (disconnected or `hidden`).
  - Going away records `Room.drawerAway {turnId, since, goneAt}` (new) and schedules `drawerAwayCheck` 2 s on; the clock keeps running and guesses count meanwhile. Every epoch change re-arms the check at the same time (the auto-pick, a host pause).
  - The check adds the `drawerAway` pause reason if the same absence is still on. Back and away again makes the old check stale.
  - The pause schedules `drawerGone` 30 s on, but not while the host's pause holds the game too; then it starts afresh from Resume.
  - Back (connected and visible), a skip, a kick or leaving the phase clears the reason; with no other reason, the 3-2-1.
  - `drawerGone`: the reason drops without a 3-2-1, then a drawing turn ends as `drawerGone` (points stay, the drawer's half; they aren't dealt again this cycle) or an open choice is abandoned and the next drawer chooses.
  - `drawerAwayCheck` and `drawerGone` are the only timers besides `resumeGo` that run while paused.
- **`player:visibility`** (was `notAvailable`) sets `hidden` for any player, any phase; at most 5 a second per player (`VISIBILITY_RATE_LIMIT`). **`player:join` gains an optional `hidden`**, so a locked phone whose socket reconnects in the background stays away (no 3-2-1 flash, and the 30 s runs on).
- **Phones** (`client/src/lib/visibility.ts`, new, wired in `Play.tsx`): report `visibilitychange` while joined and connected, and send `hidden` with every join.
- **Screen:** `TurnView.drawerReconnecting` (new) shows "Mika’s phone reconnecting…" (`drawerReconnecting` copy key) as a ringed pill along the drawing's top edge, in both layouts and over the CHOOSING overlay, inside an always-mounted `role="status"` region. The pause itself is F28's overlay ("Waiting for Mika’s phone…").
- **Pad restored on return:** no new code. The pad stays mounted under the pause; when it lifts the drawer resyncs (F28), and a reload gets its own snapshot (F12). Proven by the playtest below.
- **New dependencies:** none.
- **Tests:**
  - `server/reducer.away.test.ts` (new, 28): visibility for any player and its senders; the join's `hidden`; a guesser away and the drawer away outside CHOOSING/DRAWING schedule nothing; **a 1 s blip pauses nothing**; the clock runs and the badge shows during the debounce; hidden and disconnected each pause after 2 s with the clock frozen; one check for hidden-then-dropped; only the second absence's check pauses after a blip; CHOOSING; the check re-armed through the auto-pick; a hidden player dealt a turn; back visible → 3-2-1 → the clock moved by the pause; back by rejoin; a locked phone reconnecting stays away and still hits the limit; away again during the 3-2-1; guesses refused while paused; the 30 s limit in DRAWING (drawerGone, points, half, `inkClose`, `turnEnd`, `revealDone`, the drawer passed over) and CHOOSING (no reveal, words back, next drawer); the limit stale on return, waiting through a host pause and restarting at Resume, stopped by a host pause; skip, kick and end during the pause.
  - `server/sockets.test.ts` (+5): hidden → badge → the check pauses every view → visible → 3-2-1; a dropped socket schedules the check; the rate limit; a join's `hidden`; a bad payload.
  - `client/src/lib/visibility.test.ts` (new, 3); `ScreenTurn.test.tsx` (+2: the pill in both layouts and phases, the empty status region); `schemas.test.ts` (+2); turn fixtures gain `drawerReconnecting`.
- `npm run size`: player JS 106.9/120 KB, CSS + font 24.1/30 KB.

**Decisions:** DECISIONS 62 (the new `Room.drawerAway`, re-arming on epoch changes, the 50 ms timer slack, the 30 s limit under a host pause, `drawerGone` with no 3-2-1, the join's `hidden`, the visibility rate limit, guesses in flight refused as for a host pause, the badge).

Reviews:
- **spec-checker: PASS WITH FIXES** (no Must-fix). Applied: this entry and the Kim check; the DRAWING `drawerGone` test now asserts the drawer is passed over this cycle. Pad restore is F12/F28's mechanism, proven by the playtest (no unit test added).
- **secrets-fairness: PASS WITH FIXES** (no Must-fix; nothing secret in the new view field, the reducer stays pure, the stale-timer paths hold). Applied: a rate limit on `player:visibility`; the join carries `hidden` (was: a rejoin reset it, so a locked phone reconnecting flashed a 3-2-1 and restarted the 30 s). Recorded, not changed: a guess in flight as the pause begins is refused, as under a host pause.
- **mobile-ux: PASS WITH FIXES** (no Must-fix). Applied: the pill at `max(4.5vmin,22px)`, wrapping rather than truncating a long name; an always-mounted status region; a ring so it shows over the CHOOSING overlay; a comment on why `pagehide` isn't needed (the disconnect is the backstop). Left: the pill covers the drawing's top edge for up to 2 s (transient), and it can show under a host pause's overlay (covered by it).

**Playtest** (`.playtest/F40/scenario.ts`, dev server; a 1920×1080 Screen, Ana drawing, Ben and Cara guessing), re-run after the review fixes, all 6 steps pass:
1. Ana draws a stroke and it reaches the Screen; no word in the Screen's or Ben's HTML.
2. Ana offline for 1 s: never "Paused".
3. Ana offline: the `role=status` pill after 6.4 s (Socket.IO noticing the drop), "Paused" + "Waiting for Ana’s phone…" on the Screen and Ben's phone at 8.7 s, and Ben's guess box covered.
4. Back online: "Back in" 3-2-1, Ana's pad still holds her stroke, and a second stroke reaches the Screen (ink pixels 729 → 1463).
5. Page hidden (`visibilityState` overridden): the pill after 8 ms, "Paused" at 2.3 s; visible again → 3-2-1.
6. Hidden for 30 s: the reveal with the word at 32.1 s and no "Paused".

Console errors: only Ana's expected `ERR_INTERNET_DISCONNECTED` while offline. Screenshots: `.playtest/F40/badge-screen.png`, `paused-screen.png`, `paused-Ben.png`, `backin-screen.png`, `reveal-screen.png`.

**Notes for next session:**
- **F41:** `screenAway` and `fewPlayers` are separate reasons; `drawerGone` keeps the pause if one of them still holds it. `syncDrawerAway` (after every action) is the pattern to copy for `screenGone`; remember to let its timer run while paused (the gate at the top of `timer`).
- **F43:** a reconnecting phone sends `hidden` in `player:join`; keep that when the join path changes.
- **F44:** `VISIBILITY_RATE_LIMIT` already exists.
- **F45:** new copy key `drawerReconnecting`.

**How to try it:**
- Tests: `npx vitest run server/reducer.away.test.ts server/sockets.test.ts client/src/lib/visibility.test.ts client/src/components/screen/ScreenTurn.test.tsx`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F40/scenario.ts` (about 1.5 minutes: it waits out the 30 s limit).
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), two phone windows at `/play/CODE`, start; on the drawer's window, switch tabs (hidden) for 3 s, or set DevTools' Network to Offline: the badge, then "Paused", then the 3-2-1 on return; stay away 30 s for the reveal.

## F39 — Join budget (2026-10-31)
**What changed:**
- **Budget check** (`scripts/bundle.ts`, new; `npm run size`, new): builds the client in production mode in memory and measures the player page, which is the entry chunk plus its static imports, the CSS `index.html` links and the font it preloads. JS and CSS are gzipped at level 6, matching nginx; KB means 1000 bytes. Now:
  - **JS 106.7 KB** of 120 (was 119.1 KB at level 9 before this feature);
  - **CSS 8.1 KB + font 15.9 KB = 24.0 KB** of 30.
  
  The lazy chunks are the Screen (22.9 KB) and Howler (9.5 KB). `qrcode` is in the Screen chunk.
- **`scripts/bundle.test.ts`** (new, 10 tests, part of `npm test`; about 1 s) builds in a child process with `NODE_ENV=production`. It fails when:
  - either budget is exceeded;
  - the Screen page, Howler or `qrcode` is on the player page or missing from the lazy chunks;
  - a `components/screen/` module other than the shared `ScreenSettings.tsx` is on the player page, or any module with "gallery" in its path (for F49);
  - DevBots, zod or `shared/schemas.ts` is anywhere in the production build;
  - the build ships more than one font, an unhashed one, a preload without `as="font"`/`type`/`crossorigin`, or a face without `font-display: swap` and the Latin range.
  
  A static `qrcode` import in `Landing.tsx` was tried and made it fail.
- **react-router removed** to make headroom for F45's Taglish table and M7–M9 (about 12 KB gzipped). `client/src/lib/router.tsx` (new, about 100 lines) gives the app the router pieces it used:
  - `BrowserRouter` over `pushState`/`popstate`, and `MemoryRouter` for tests;
  - `Routes`/`Route` with `:param` and one trailing slash;
  - `useParams` and `useNavigate`;
  - `Link`, which leaves modified clicks to the browser.
  
  App, Landing, Play, Screen and DevBots import it, and the callers drop `void navigate(…)`.
- **Font:** Fredoka Bold, one Latin-subset woff2 (16 KB, OFL; `client/src/fonts/` with `OFL.txt`).
  - `font-display: swap`, at the head of `--font-display`;
  - Vite fingerprints it, and `index.html` preloads the same hashed file with `crossorigin`;
  - one weight, since every `font-display` use is bold.
- **Transport:** WebSocket first, falling back to long-polling only when the WebSocket can't open. On the client this is `TRANSPORT_OPTIONS` in `client/src/lib/socket.ts` (`['websocket','polling']` with `tryAllTransports`, used by both namespaces). The server (`server/sockets.ts`) now accepts polling too, and every reconnect tries the WebSocket again.
- **Caching** (`server/http.ts`): `/assets/` gets `public, max-age=31536000, immutable`, and `index.html`, the SPA fallback, sounds and the favicon get `no-cache`.
- **nginx** (`deploy/nginx/sketchy.conf`): `gzip_comp_level 6` (the default 1 would ship the JS at 134 KB), and the `/socket.io/` comment no longer says WebSocket only.
- **New dependencies:** none, and `react-router` is removed. Fredoka was copied from `@fontsource/fredoka` 5.3.0, so the package isn't a dependency.
- **Tests:**
  - `scripts/bundle.test.ts` (10, above);
  - `client/src/lib/router.test.tsx` (new, 9): `matchPath` statics, decoded params, a trailing slash, segment counts and a bad escape; `Routes` picks the first match, renders nothing for an unknown path, skips a falsy route and ignores the query; no params outside a route; `Link` renders a plain anchor;
  - `client/src/lib/socket.test.ts` (new, 3): against real Socket.IO servers, a WebSocket first, polling when the server refuses the WebSocket, and both namespaces use the options;
  - `server/sockets.test.ts` (+1): a polling client joins and gets its view;
  - `server/http.test.ts` (+1): the cache headers.

**Decisions:** DECISIONS 61 covers:
- what the budget measures (files, gzip level 6, KB = 1000);
- react-router's replacement;
- the font, its weight and its fingerprinting;
- caching;
- what "fall back to polling" means in Socket.IO's options.

The rules file `.claude/rules/client.md` (local, gitignored) now says WebSocket first.

Reviews:
- **spec-checker: PASS WITH FIXES.** The Must-fixes were this entry, the Kim check and the recorded 5 s numbers, all done below. Should-fix: the client fallback is now also proven end to end (`.playtest/F39/fallback.ts`) and in `socket.test.ts`.
- **secrets-fairness: PASS.** Polling weakens no invariant: the limits, limiters, ink routing, timing and auth are all transport-independent. Should-fix applied: the stale nginx comment.
- **mobile-ux: PASS WITH FIXES** (no Must-fix). Applied:
  - the nginx comment;
  - caching, with the font moved under Vite so it gets a hashed name.
  
  Checked, no change needed: the reveal word's 0.82 em per letter. Fredoka Bold's W is 0.947 em, but the widest pack word (MANGO) averages 0.720 em per letter in Fredoka and 0.793 in the old fallback face, measured in Chromium. A pathological custom word such as "WWW" could overflow, as it could before.
  
  To Backlog: a metric-matched fallback face, since Roboto→Fredoka reflows headings on Android over slow networks; a catch-all route for unknown paths, which render blank as they did with react-router; and `replace` on Leave's navigate.

**Playtest** (production build on :3107; `.playtest/F39/`):
- **`join-budget.ts`:** an emulated Pixel 7 on DevTools' Slow 4G preset (562.5 ms, 1.44 Mbps) with 4× CPU slowdown, through a level-6 gzip proxy standing in for nginx, three cold loads of `/play/CODE`:
  - the name field is usable at **2653, 2600 and 2599 ms** (budget 5000);
  - the lobby is reached at 4174, 3702 and 3674 ms (without typing time);
  - 133.9 KB transferred: JS 106.6, CSS 8.4, font 16.2, HTML 1.1;
  - Fredoka loaded, and no polling requests.
- **`fallback.ts`:** behind a proxy that refuses WebSocket upgrades, one WebSocket attempt fails, then 18 polling requests; the phone joins and sees a second player arrive live. A phone with WebSockets allowed makes 0 polling requests.
- **`routes.ts`:** these all route:
  - Landing Start → `/screen/CODE` (lazy Screen lobby);
  - Landing Join → `/play/CODE`, then join;
  - Leave → `/`;
  - Back → `/play/CODE`, then Forward;
  - a deep link with a trailing slash and a query;
  - an unknown path renders nothing;
  - the ended page's Link → home.
- **`.playtest/F33/layouts.ts`** re-run with the new face (7 Screens, ten players, every phase): pass. The screenshots show Fredoka on the code, headings and reveal word, with nothing clipped.
- Console errors: only the expected "WebSocket connection … failed" in the blocked run.

**Notes for next session:**
- **F40+:** run `npm run size` after any client change. Player JS is 106.7/120 KB and CSS + font 24.0/30 KB; `bundle.test.ts` fails over budget.
- **F45:** the Taglish table lands in `copy.ts`, which is on the player page (about 2–3 KB gzipped, which fits).
- **F49:** keep the gallery in the Screen chunk or its own `import()`. The bundle test fails if a module named `*gallery*` reaches the player page.
- **F51/F52:** the droplet's nginx needs `gzip_comp_level 6` (in `deploy/nginx/sketchy.conf`). Hashed `/assets/` are cached for a year, so nothing changes for deploys.

**How to try it:**
- `npm run size`; `npx vitest run scripts/bundle.test.ts client/src/lib/router.test.tsx client/src/lib/socket.test.ts server/http.test.ts`.
- Playtests: `npm run build && PORT=3107 npm start`, then `PLAYTEST_URL=http://localhost:3107 npm run playtest -- .playtest/F39/join-budget.ts` (and `fallback.ts`, `routes.ts`).
- By hand: in Chrome DevTools on `/play/CODE`, set Network to "Slow 4G" and CPU to 4× slowdown, tick "Disable cache", and reload. Note that `npm start` doesn't gzip; nginx does in production.

## F38 — Sounds (2026-10-31)
**What changed:**
- **Sounds** (`client/src/lib/sounds.ts`, new; ported from Buzzr's `sounds.ts`): seven Screen sounds, `join`, `yourTurn`, `correct`, `tick`, `timeUp`, `reveal` and `fanfare`, synthesised by `scripts/make-sounds.mjs` (new, ported from Buzzr's) into `client/public/sounds/*.wav` (about 260 KB, with a README: self-made, nothing to license).
- **When they play** (DECISIONS 60):
  - `fx join` → pop, `fx correct` → ding (`soundForFx`, in `Screen.tsx`'s `fx` handler).
  - `transitionSounds(prev, next)` reads the snapshot: a new turn id in CHOOSING or DRAWING chimes; entering REVEAL plays the sting, 600 ms after `timeUp` when `endReason` is `time`; entering FINAL plays the fanfare. A Screen's first snapshot plays nothing, so a reload mid-game is quiet.
  - The last-10-s tick (`nextTick`): each whole second from 10 to 1 in DRAWING, counted locally from the snapshot's timer like `useCountdown`. A pause stops it, the resume snapshot picks it up again, a second is never ticked twice in a turn, and one already passed is skipped, not played late.
  - `createScreenSounds` runs both from snapshots; `useScreenSounds` (new) feeds it in `Screen.tsx`.
- **Levels:** Sound on / Quiet / Muted is Howler's global volume at 1 / 0.4 / 0. F24's `soundPref` now notifies listeners, so `M` and the bar's Sound button apply at once, and it keeps the level in memory when storage is blocked.
- **Loading and unlock:** Howler is a lazy chunk (9.6 KB gzipped) that only the Screen chunk imports. The Screen starts fetching it on mount. Tap to start (`start()`) then, inside the gesture: sets iOS's `audioSession.type = 'playback'` (plays through the ringer switch), creates the sounds, plays a one-sample silent buffer and resumes the AudioContext. Every later tap, click or key re-unlocks while the context isn't running (a tap before Howler arrived, an iOS interruption). `autoSuspend` is off, so the first tick of a long turn isn't late. A tick whose file is still loading is dropped, not played late. Before the tap nothing plays.
- **Phones** vibrate 200 ms on `fx yourTurn` and nothing else (`fxVibration` in `client/src/lib/phone.ts`, used by `Play.tsx`). They never load Howler or a sound file.
- **New dependencies:** `howler` and `@types/howler` (dev, like the other client packages). The spec names Howler for the Screen's sounds.
- **Tests:**
  - `client/src/lib/sounds.test.ts` (new, 31):
    - `soundForFx`: join and correct, every other fx silent;
    - `transitionSounds`: the first snapshot is quiet; the chime on the first deal, the next turn, a word chosen ahead, after SCOREBOARD and a rematch, and not within a turn; time-up then the sting at +600 ms on a timed-out reveal, the sting alone otherwise; the fanfare once; back to the lobby is quiet;
    - `nextTick`: 10 to 1, skipping a passed second, no repeat after a resync;
    - `createScreenSounds` with fake timers: 10 ticks then time-up and the sting; silent while paused and resumed from the new clock; no double tick on a mid-countdown snapshot; each turn counts from 10; `stop` cancels a waiting sting and tick;
    - Howler (mocked): every file exists; nothing before start; unlock inside the tap with Howler preloaded; a later tap or key unlocks while not running and not once running; `autoSuspend` off; the iOS audio session; a loading tick dropped; the stored level before any sound and every change after; one start; silent on failure;
    - `soundPref`: kept across a reload and in memory when storage is blocked.
  - `phone.test.ts` (+1 `fxVibration`: `yourTurn` only).

**Decisions:** DECISIONS 60 (each sound's moment, the tick under pause and resync, time-up before the sting, the quiet first snapshot, the levels, the lazy load and unlock, phone vibration, plain Screens without `M`).

Reviews:
- **spec-checker: FAIL**, all for missing pieces at review time:
  - DECISIONS 60 (cited by the SPEC-QUESTION) wasn't written yet;
  - the PROGRESS entry and Kim check were missing;
  - only the first playtest run's failure screenshots were in `.playtest/F38`;
  - the hook had no test.
  
  All fixed: the decision, this entry and the Kim check are written, the stale screenshots are removed, the playtest passes, and the hook's timing moved into `createScreenSounds` with fake-timer tests.
- **mobile-ux: PASS WITH FIXES.**
  - Must-fix, the unlock lost when Howler arrives after the tap: fixed. The tap unlocks synchronously with the preloaded module, plays a silent buffer, and later gestures retry.
  - Should-fix, all applied: iOS `audioSession` playback; `autoSuspend` off; recovery after an interruption, by the retry listener; a tick that's still loading is dropped, with a dev `onloaderror` log.
  - Nits: Quiet's tick is in the Kim check; there's now a dev log when Howler fails.
  
  Not changed: a `maxAge` on `/sounds` (a server change; revalidation is a cheap 304).
- **secrets-fairness:** not run, since `server/`, `shared/` and ink code are unchanged.

**Playtest:**
- **`.playtest/F38/scenario.ts`** (playtester: a 1920×1080 Screen; Ana on a Pixel 7, Ben on an iPhone 13, Cara on a Pixel 7), re-run after the review fixes. It reads the Screen's dev `[sound] name` lines and stubs `navigator.vibrate`. All pass:
  - three `join`s;
  - `yourTurn` on the deal; only Ana's phone vibrates (`[200]`);
  - no word in the Screen's or the guessers' HTML before the reveal;
  - `M` cycles quiet, muted, on;
  - `correct`, then `reveal` with no `timeUp` when all guessed;
  - turn 2 timed out: 10 `tick`s, `timeUp`, then `reveal`;
  - `E E` ends the game and plays `fanfare`;
  - phones load no Howler and no `.wav`, and the Screen loads Howler and all seven.
- No console errors.
- Not exercised: what's actually audible, the iOS unlock and ringer switch, and Quiet from the sofa (Kim check).

**Notes for next session:**
- **F39:** `/` + `/play` is 119.1 KB gzipped (budget 120). Howler (9.6 KB) is in its own chunk, and the Screen chunk is 23.0 KB.
- **F45:** no new copy keys.
- The Backlog has `M` and a sound button for plain (no-token) Screens.

**How to try it:**
- Unit tests: `npx vitest run client/src/lib/sounds.test.ts client/src/lib/phone.test.ts`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F38/scenario.ts` (about 2 minutes: it waits out a 60 s turn).
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), click "Click to start", add bots at `/dev/bots/CODE`, and listen: the joins, the chime on the deal, the ticks in the last 10 s, the time-up and the sting, and the fanfare after End game (E, E). Press M to cycle the level.
- To change a sound: edit `scripts/make-sounds.mjs` and run `node scripts/make-sounds.mjs`.
## F37 — QR, tap-to-start, wake lock and connection dot (2026-10-31)
**What changed:**
- **Lobby QR** (`client/src/lib/qr.ts`, new): `qrPath` draws the code from `qrcode`'s matrix as one SVG path (error correction M, 4-module quiet zone, 29 modules for a join URL). `JoinQr` in `ScreenLobby.tsx` sits beside the join details, before How to play, on every Screen. It points to this Screen's own origin + `/play/CODE`. Below 640 px wide or 480 px tall, "Code:" goes above the letters and the QR shrinks into what's left (min 64 px), so it never covers the code.
- **Tap to start** (`components/screen/StartOverlay.tsx`, ported from Buzzr): a full-screen modal button over every Screen view except "game ended", "Tap to start" on a coarse pointer, else "Click to start", with "Turns on sound and fullscreen, and keeps the screen on". The tap calls `enterFullscreen` (`lib/fullscreen.ts`, new; missing, refused or throwing APIs are ignored) and sets `started`, which holds a Screen Wake Lock until the page ends. Keys stop at the overlay, and Tab stays on its button. Solid at 95 %, no blur. The Screen joins and renders underneath meanwhile.
- **"🔌 Keep this device plugged in"** (`PluggedInNote`) under the join details on `(pointer: coarse)` Screens (`lib/usePointerCoarse.ts`, new).
- **Phone Wake Lock:** `Play.tsx` holds it while `phoneWakeLock(view)` (`lib/phone.ts`), from CHOOSING through FINAL and not in the lobby. It replaces `DrawerTurn`'s DRAWING-only lock.
- **Connection dot** (`lib/connection.ts` and `components/phone/ConnectionDot.tsx`, new; ported from Buzzr's `useRoomSocket` and `ConnectionDot`):
  - The 8 px dot sits in the top-right corner of every live phone view, `pointer-events-none`, as a labelled `role="img"`.
  - It's green on connect and on each ping ack (`keepPinging` gains `onAck`).
  - It goes amber on a disconnect, on the browser's `offline` event, after 6 s without an ack, and before the first connect, and red after 5 s of that.
  - `watch(socket)` runs in the page's effect, so StrictMode's second run re-attaches it.
  - Auto-reconnect is still Socket.IO's own, and every connect rejoins silently.
- **Playtest harness:** `openRole` taps "Tap/Click to start" whenever it blocks an action (`addLocatorHandler`); `{keepStart: true}` leaves it up for a scenario that checks it.
- Copy: `scanToJoin`, `keepPluggedIn`, `tapToStart`, `clickToStart`, `startHint`, `connected`, `offline`.
- **Tests:**
  - `client/src/lib/qr.test.ts` (new, 4: the exact dark modules inside the quiet zone, version 3 with the three finder patterns, the join URL, deterministic).
  - `client/src/lib/connection.test.ts` (new, 10: amber first, red after 5 s, disconnect/reconnect through a socket, a ping ack, a silent drop after 6 s, one red clock per outage, `offline`/`online`, subscribers and stop, StrictMode re-watch, an already connected socket).
  - `client/src/lib/fullscreen.test.ts` (new, 3).
  - `ScreenLobby.test.tsx` (new, 6: the QR's URL on token and plain Screens, its place, the plugged-in note on coarse Screens only, Tap vs Click, one modal button).
  - `ConnectionDot.test.tsx` (new, 4).
  - `phone.test.ts` (+2 `phoneWakeLock`).
  - `ping.test.ts` (+1 `onAck`).
  - `ScreenSettings.test.tsx` stubs gain `origin`.
- **No new dependencies:** `qrcode` was already a dev dependency (the terminal QR of `npm run lan`), and only the lazy Screen chunk bundles it. `/` + `/play` is 119.2 KB gzipped (was 118.8; budget 120), and the Screen chunk is 21.8 KB.

**Decisions:** DECISIONS 59 covers:
- the QR's address, size and narrow-screen layout;
- the overlay on every load, its keys and solid background;
- what counts as a tablet or phone Screen;
- the phone's wake lock from the first deal;
- the dot's amber and red rules and placement;
- auto-reconnect as Socket.IO's own.

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied:
  - the Kim check;
  - the connection store re-attaches under StrictMode (`watch`);
  - fullscreen pulled out and tested;
  - the dot's socket wiring tested through `watch`.
- **mobile-ux: PASS WITH FIXES** (no Must-fix). Applied:
  - the plugged-in note moved under the join details, so it adds no height to the bottom row;
  - Tab stays on the overlay's button;
  - the overlay's blur dropped;
  - the missed-ack watch (amber after 6 s).
  
  Not changed:
  - the Start button half-hidden at 844×390 and 1366×560 is F24's auto-hiding host bar over the bottom row (DECISIONS 49), not F37;
  - the QR size stays at 24 vmin (DECISIONS 59, the Kim check, Backlog);
  - Backlog: a non-colour cue on the dot.
- **secrets-fairness:** not run, since `server/`, `shared/` and ink code are unchanged.

**Playtest:**
- **`.playtest/F37/scenario.ts`** (playtester: TV Screen, tablet Screen, Pixel 7, iPhone 13, small phone). All 8 steps pass:
  - "Click to start" shows, and a click removes it, requests fullscreen and requests a wake lock;
  - the QR's `data-url` ends in `/play/CODE`, and the TV has no plugged-in note;
  - the phones join;
  - the dot is `connected`, leaves it offline and returns;
  - the tablet shows "Tap to start" and then "Keep this device plugged in";
  - the phone requests a wake lock in the game.
- **`.playtest/F37/dot.ts`:**
  - no phone wake lock in the lobby, one in the game;
  - at 360×560 on the crown phone the dot (348,4, 8 px) overlaps neither the 👑 Host button nor any text, and on a Pixel 7 likewise;
  - offline: amber at once, red after 5 s, and green again on return as the same player (one "Ben" on the Screen, no join form).
- **`.playtest/F33/layouts.ts`** re-run (7 Screens, ten players, every phase): pass. The lobby screenshots show the QR beside the code at every size; the first version covered the code's last letter at 390×844 and 844×390, which led to the narrow layout above.
- Console errors: none, except the expected `ERR_INTERNET_DISCONNECTED` while emulating offline.
- Screenshots: `.playtest/F37/dot-in-game-Ana.png`, `dot-red-Ben.png`, `.playtest/F33/1-lobby-<w>x<h>.png`.
- Not exercised: a real fullscreen, a held wake lock, and a QR scanned by a camera (Kim check).

**Notes for next session:**
- **F38:** unlock audio in `Screen.tsx`'s `start()` (the Tap to start handler); `started` says the gesture happened.
- **F39:** `/` + `/play` is 119.2 KB gzipped (budget 120). `qrcode` and its `dijkstrajs` are in the Screen chunk only.
- **F43:** the dot and the "Reconnecting…" pill already track reconnects on phones.
- **F45:** Taglish for the new copy keys above.

**How to try it:**
- Unit tests: `npx vitest run client/src/lib/qr.test.ts client/src/lib/connection.test.ts client/src/lib/fullscreen.test.ts client/src/components/screen/ScreenLobby.test.tsx client/src/components/phone/ConnectionDot.test.tsx`.
- Playtests: `npm run dev`, then `npm run playtest -- .playtest/F37/scenario.ts` and `.playtest/F37/dot.ts`.
- By hand: `npm run dev` + `npm run lan`, open the printed Screen URL, Start, tap the overlay, and scan the QR with a phone on the same Wi-Fi. In DevTools, set a phone-sized window offline to see the dot go amber, then red, then green.

## F36 — Drawer feedback (2026-10-31)
**What changed:**
- **Server** (`server/reducer.ts`): a close guess now also sends `closeAlert {pid}` (the guesser) to the drawer, next to the guesser's `nearMiss`. It carries no text and goes to no Screen. The drawer's `lastGuess` (latest wrong guess, masked like the feed, DRAWING only) was already there from F15.
- **`client/src/lib/closeAlert.ts`** (new): a store for `useSyncExternalStore`, like `screenFx`. It holds the close guesser's pid for 2 s (`CLOSE_ALERT_MS`), and a newer alert takes over and restarts the 2 s. `Play.tsx` feeds it from the `closeAlert` fx and clears it when the phase leaves DRAWING.
- **`DrawerTurn.tsx`:**
  - `GuessLine` (new, exported): the top bar's second line shows "Bea is close!" (bold, amber `#FFD166`) while the alert is up, else "Bea: sapatos" ("•••" when masked). It is `aria-live="polite"`. No alert shows for a guesser who has left (empty name).
  - The nudge, "Start with one big shape. Anything helps!", shows when `inkNudge` (`client/src/lib/phone.ts`) allows it: 10 s of the turn's clock (`totalMs − left`, so a pause holds it), the pad's ink is in, and nothing has been drawn this turn.
    - It sits 4 px above the centred pad, or over its top edge where there's no room (24 px over at 360 × 560), so nothing moves.
    - It is `pointer-events-none` (a stroke started on it reaches the pad) and `aria-hidden`, with an always-mounted `sr-only` `role="status"` that fills with the same text.
    - Once a stroke is on the stack it stays gone for the turn, even after Undo or Clear.
- **`PadState`** (`client/src/ink/padTools.ts`) gains `ready` (the turn's snapshot is in), so a reload with ink on the pad doesn't flash the nudge. `DrawPad` reports a change of it.
- Copy: `isClose`, `startBigShape`.
- **Tests:**
  - `server/views.test.ts` (+4, "the drawer's latest guess (F36)"): only the latest wrong guess reaches the drawer; guessers get none, including one who already got the word, and their JSON holds neither guess; it is masked under `'clean'`/`'off'` and for a slur; close guesses are skipped and are not on the Screen; it is null after DRAWING.
  - `reducer.guess.test.ts` and `reducer.turn.test.ts`: a close guess gives `nearMiss` to the guesser and `closeAlert` to the drawer.
  - `sockets.test.ts` (+1): `closeAlert` reaches only the drawer's socket, and no socket's fx holds the close text.
  - `client/src/lib/closeAlert.test.ts` (new, 4: 2 s then nothing; a newer one takes over and restarts; a repeat extends; `clear` and listeners).
  - `phone.test.ts` (+5 `inkNudge`: the 10 s edge, drawn, not before the ink is in, the turn length, no clock).
  - `phoneViews.test.tsx` (+3: the live region mounted and empty before the ink is in; amber "Bea is close!" in place of the guess; the guess line, masked, empty).
  - `padTools.test.ts` and `undoClear.property.test.ts` expect `ready`.
- No new dependencies.

**Decisions:** DECISIONS 58 (the alert's payload, place, 2 s and repeats, clearing at the end of DRAWING; the nudge's clock, staying gone after the first stroke, waiting for the ink, placement and live region).

Reviews:
- **spec-checker: PASS WITH FIXES** (no Must-fix). Applied:
  - DECISIONS 58 and SPEC-QUESTION at `inkNudge`;
  - this entry and the Kim check;
  - the 2 s expiry made testable (`closeAlert.ts`, fake timers);
  - the first stroke checked in the playtest.
- **secrets-fairness: PASS** (no Must- or Should-fix). Applied the nit: the Screen view holds no close text. A pause doesn't bring the nudge early (`useCountdown` freezes `left`).
- **mobile-ux: PASS WITH FIXES** (no Must-fix). Applied:
  - an always-mounted live region for the nudge;
  - no nudge before the turn's ink is in (no flash on reload);
  - the overlap at 360 × 560 is said in the comment;
  - no " is close!" for a guesser who has left.
  
  Not changed: the name is truncated with the line (16 characters fit at 360 px).

**Playtest:**
- **`.playtest/F36/scenario.ts`** (TV Screen; Ana drawing, Bea and Cy guessing, all Pixel 7). All pass:
  - A: "Bea: zzqxv" in the drawer's bar, and the word is in no Screen or guesser text;
  - B: "Cy is close!" in rgb(255, 209, 102), gone after 2.6 s, with "Bea: zzqxv" back;
  - C: no nudge 3.6 s in; it shows at 10.4 s, 4 px above the pad, and the live region holds the text; a stroke started on the nudge reaches the pad (Undo enabled) and the nudge goes; after Undo it stays gone.
- **`.playtest/F36/sizes.ts`** (Ana drawing on a 360×560 phone): "Cy is close!" fits the bar on one line. At 360×560, 390×664 and 412×780 there's no scroll, the nudge stays on one line inside its area, off the toolbar, at the pad's top edge (24 px over the pad at 360×560, 4 px above it at the others).
- No console errors.
- Screenshots: `.playtest/F36/C-nudge-Ana.png`, `C-after-stroke-Ana.png`, `sizes-<w>x<h>-Ana.png`.
- Not exercised: real screen readers (Kim check).

**Notes for next session:**
- **F38:** if the close alert gets a sound, it's the `closeAlert` fx in `Play.tsx` (drawer only).
- **F39:** `/` + `/play` is 118.8 KB gzipped (budget 120).
- **F45:** Taglish for `isClose` ("Malapit na si {name}!"?) and `startBigShape`.

**How to try it:**
- Unit tests: `npx vitest run server/views.test.ts server/sockets.test.ts client/src/lib client/src/components/phone`.
- Playtests: `npm run dev`, then `npm run playtest -- .playtest/F36/scenario.ts` and `.playtest/F36/sizes.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), join at `/play/CODE` on a phone-sized window, add bots at `/dev/bots/CODE`. When you draw, wait 10 s for the nudge, then have a bot guess wrong (and type a near miss from a second phone window) to see the bar.

## F35 — The reveal (2026-10-31)
**What changed:**
- **Server** (`server/views.ts`): the Screen view's `closeGuesses` is now `almost` (`shared/types.ts`), built by `almost(room, turn)`.
  - It lists the turn's close guesses first, then its wrong guesses newest first, up to `ALMOST_MAX` (3, `shared/constants.ts`).
  - Each guess is listed once by its matcher form (`normalize`); fillers-only and punctuation-only guesses are skipped.
  - Under `guessFeed: 'off'` only the close ones are listed.
  - It is still sent only from REVEAL on and masked at view time like the feed. The room keeps `turn.closeGuesses`.
- **`ScreenTurn.tsx`:**
  - `RevealIntro`: "Nobody got it! 😱" (😱 `aria-hidden`) is the headline above "It was…" when nobody got it, in the sidebar and in the portrait top bar, as "Everyone got it! 🎉" already was.
  - `RevealPanel`: with nobody right, there's no Got-it or drawer row, only "Almost:". A Got-it chip never shows "+0". The chips stay in the server's corrected order.
  - `RevealWord` remounts for each word and grows in from its left edge (`motion-safe:animate-reveal`, new in `index.css`). It has no overshoot, so a word sized to its column isn't clipped.
  - F34's speech bubbles end at the reveal, both layouts; reactions still float.
- The reveal sting is F38's (its Done-when now says so).
- **Tests:**
  - `server/views.test.ts` (+8 "Almost:": close first then newest wrong, filled from wrong ones, repeats once, mask, `'off'` close only, empty before the reveal, fillers skipped, empty).
  - `views.leak.test.ts` and `reducer.guess.test.ts` use the renamed field and expect the wrong guess after the close one.
  - `ScreenTurn.test.tsx` (+7: grow-in class, bubbles end, corrected order, "Almost:" with •••, the nobody headline above "It was…" in both layouts, no points rows, no "+0" and no drawer line at 0).
- No new dependencies.

**Decisions:** DECISIONS 57 ("Almost:" contents, order, repeats and `'off'`; the nobody headline; no "+0"; the grow-in; bubbles end at the reveal; the sting is F38's).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: this entry, the Kim check (entrance and reduced motion), and the sting named in F38's Done-when.
- **secrets-fairness: PASS** (no Must-fix). Applied:
  - a test that `almost` is empty in CHOOSING and DRAWING with close and wrong guesses held;
  - the masking tests under `'clean'`/`'off'` (in `views.test.ts`);
  - fillers-only guesses skipped;
  - the doc comments.
  
  The `'off'` question is in the Kim check.
- **mobile-ux: PASS WITH FIXES** (no Must-fix). Applied:
  - no-overshoot grow-in (the 1.15 pop clipped in the 28 % sidebar);
  - the screenshot is taken after the entrance;
  - bubbles end at the reveal (a "kahapon" bubble duplicated "Almost:");
  - `'off'` lists close guesses only.
  
  Not changed: the white "Nobody got it!" (the spec gives no colour); no live region for the headline (Backlog-sized, a TV).

**Playtest:**
- **`.playtest/F35/scenario.ts`** (playtester: 1920×1080 TV Screen; Ana drawing and Ben and Cara guessing, as a Pixel 7 and an iPhone 13). All steps pass:
  - the word is on the reveal and is the largest text (129.6 px);
  - Got-it shows Ben +260 then Cara +225, in corrected order;
  - "Almost: mangq · zzqx one", the close one first, at most 3;
  - no "+0" anywhere, and "Everyone got it! 🎉" shows;
  - turn 2 was skipped with nobody right: "Nobody got it! 😱", the word, "Almost: kahapon", no Got-it and no points, and "kahapon" appears exactly once (no bubble).
- No console errors.
- Screenshots: `.playtest/F35/reveal-some-screen.png`, `reveal-none-screen.png`.
- `.playtest/F33/layouts.ts` re-run (7 Screens, every phase): pass.
- Not exercised: reduced motion (Kim check).

**Notes for next session:**
- **F38:** play the reveal sting when the Screen enters REVEAL (the word grows in over 0.4 s).
- **F45:** Taglish `nobodyGotIt` is "Walang nakakuha!" (the 😱 is outside the string).

**How to try it:**
- Unit tests: `npx vitest run server/views.test.ts client/src/components/screen/ScreenTurn.test.tsx`.
- Playtest: `npm run dev`, then `npm run playtest -- .playtest/F35/scenario.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), bots at `/dev/bots/CODE`. Have one bot guess right and others guess wrong, then reveal. On the next turn press S twice on the Screen for a nobody-got-it reveal.


## F34 — Announcements, reactions and feed UI (2026-10-31)
**What changed:**
- **Server:** `player:react` lands (`react` in `server/reducer.ts`): DRAWING for players in `turn.correct` (others get the new `notGuessed`), REVEAL for anyone, refused while paused; emits `fx reaction` to Screens only and changes nothing. The gateway limits it to one a second per player (`code:pid`, `REACTION_INTERVAL_MS`, `rateLimited`) and sends no fresh views for it (`server/sockets.ts`).
- **Screen fx** (`client/src/lib/screenFx.ts`, new): a store fed by `fx` (`correct`, `wrongGuess`, `reaction`) holding "got it" announcements (2 s each), bubbles (≤ 3, 2 s; a guesser's newer guess replaces their own; a fourth is dropped, it's in the feed) and reactions (2 s, ≤ 20). `Screen.tsx` feeds it and passes the snapshot to `ScreenTurn`.
- **`client/src/components/screen/TurnFx.tsx`** (new):
  - `GotItLine`: "Jun got it!" in Jun's colour, several names together.
  - `TurnFx`: an overlay in the sidebar (landscape) or the room under the square (portrait) that measures `data-chip` rows. It clips itself, so nothing covers the drawing or makes its parent overflow.
  - Bubbles are `max(5vh, 20px)` in the guesser's colour. Landscape puts them on the row just after the name; portrait stacks them under the strip (as many as fit). A long one slides left. A masked guess is "•••"; under `'off'` it reads "💬 Bea is guessing…" with a pulsing 💬.
  - Reactions float up from just past the name, as far as the room allows, up to 14 vh.
- **`ScreenTurn.tsx`:**
  - "Got it" stands in for "✏️ Mika is drawing" (landscape) or the blanks (portrait top bar), inside a live region that stays mounted.
  - Correct guessers' chips stay lit green, and every chip has `data-chip`.
  - The landscape feed shows up to the last 8 right under the players and gives way first (never under two lines; 4 at 1080p with ten players); portrait keeps 2.
  - Hint letters pop into the blanks (new key, `motion-safe:animate-pop`).
- **`index.css`:** `pop`, `bubble`, `float-up` (rise from `--rise`) and `fade` keyframes. All are behind `motion-safe:`; reduced motion fades.
- **Phone** (`GuesserTurn.tsx`): after a correct guess, `ReactionRow` (six ≥ 44 px buttons) under "✓ You got it! +N". It rests for a second after a tap, with the sent one lit green. `Play.tsx` sends `player:react` only while connected.
- **Dev bots:** `bot.react()`, "Everyone: react" and a per-bot React button on `/dev/bots/CODE`.
- Copy: `isGuessing`, `reactions`, `sendReaction` (`gotIt` already existed).
- **Tests:**
  - `server/reducer.react.test.ts` (new, 6: Screens-only fx and no change, `notGuessed` for the drawer and a guesser without the word, anyone at the reveal, other phases, paused, Screen/unknown sender).
  - `sockets.test.ts` (+3: fx reaches Screens only with no new views, and one a second per player; `notGuessed`; an emoji outside `REACTIONS`).
  - `client/src/lib/screenFx.test.ts` (new, 7).
  - `ScreenTurn.test.tsx` (+8: banner in the sidebar and in the portrait top bar, several names, lit chips, the 8 / 2 feed, the overlay outside the canvas, hint pop, counts after the blanks).
  - `phoneViews.test.tsx` (+1, and the not-guessed test checks there's no row).
  - `bots.test.ts` (+1).
- No new dependencies.

**Decisions:** DECISIONS 56 (react phases, the limit and no broadcast; where "got it", bubbles and reactions go; the 8-line feed; a fourth bubble; the phone row at DRAWING only; hint pop; reduced motion).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: DECISIONS 56 (cited in code but missing), this entry and the Kim check, a SPEC-QUESTION at the limiter.
  - Recorded rather than changed: a refused reaction uses up the second (the phone only offers reactions when they're allowed), and no reaction row at the reveal (Backlog).
  - The ding is F38's.
- **secrets-fairness: PASS** (no Must- or Should-fix). Applied the nit: the `rateLimited` comment is split.
- **mobile-ux: PASS WITH FIXES** (no Must-fix). Applied:
  - the 💬 pulses instead of the text (contrast);
  - reactions start past the name, not over it;
  - one persistent live region for "got it";
  - the sent reaction lights up;
  - every chip has the padding, so lighting one moves nothing;
  - the 360×560 phone is checked (below).
  
  Not changed: portrait bubbles stay ≥ 5 vh (the spec) and cover the two feed lines for 2 s (DECISIONS 56). To Backlog: re-measuring chips on a resize, measuring the bubble height, and the portrait banner hiding the blanks.

**Playtest:**
- **`.playtest/F34/scenario.ts`** (playtester: TV Screen, Ana drawing on a Pixel 7, Ben on an iPhone 13, Cara at 360×560). All 7 steps pass:
  - blanks with counts on one line;
  - the word is in no Screen or guesser HTML;
  - bubbles go after about 2 s;
  - "Ben got it!" is in the sidebar, not over the canvas;
  - Ben's ✓ chip shows "+275" and no totals;
  - the reaction row replaced Ben's box, 😂 floated, and the row rested after the tap;
  - the feed list.
- **`.playtest/F34/fx.ts`:** four Screens (1920×1080, 1180×820, 820×1180, 390×844), nine bots, and Ivy on a 360×560 phone. All pass:
  - five wrong guesses at once give exactly 3 bubbles on every Screen, at 54/41/59/42 px (≥ 5 vh), inside the viewport and off the canvas, and none are left after 2 s;
  - after 8 more guesses there's no scroll, overflow or clipped list, with 8 feed lines in the DOM and at least 2 shown;
  - "Jun got it!" is off the canvas, and in portrait it's above the drawing;
  - 🔥 floats, the second within a second gets `rateLimited`, and a player without the word gets `notGuessed`;
  - Ivy at 360×560: "You got it" and the row with no scroll, every button ≥ 44 px, and her 👏 floats on all four Screens;
  - under guessFeed `'off'` the text isn't on the page and "💬 Bea is guessing…" shows;
  - the word never reaches a Screen.
- **`.playtest/F33/layouts.ts`** re-run (7 Screens, ten players, every phase): pass. A first run failed at 820×1180 because stacked bubbles overflowed the room; the overlay now clips itself.
- No console errors.
- Screenshots: `.playtest/F34/<step>-<w>x<h>.png`, `3b-reactions-Ivy.png`.
- Not exercised: reduced motion (Kim check).

**Notes for next session:**
- **F35:** the reveal's "Got it" chips carry `data-chip`, so a reaction at the reveal floats from them (from the bottom for anyone else).
- **F38:** the "got it" ding goes on the Screen's `correct` fx (`turnFx.push` sits in `Screen.tsx`'s `fx` handler).
- **F39:** `/` + `/play` is 118.1 KB gzipped (budget 120).
- **F45:** Taglish for `isGuessing`, `reactions`, `sendReaction`.

**How to try it:**
- Unit tests: `npx vitest run server/reducer.react.test.ts server/sockets.test.ts client/src/lib/screenFx.test.ts client/src/components`.
- Playtests: `npm run dev`, then `npm run playtest -- .playtest/F34/fx.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start). At `/dev/bots/CODE` spawn bots, then use "Everyone: random guess", "Guess right" on one bot, then "Everyone: react". Resize the Screen to portrait to see the strip version.

## F33 — Responsive Screen layouts (2026-10-31)
**What changed:**
- `client/src/lib/screen.ts`: `screenLayout(w, h)` is portrait at width/height ≤ 0.85, landscape otherwise (near-square included). `client/src/lib/useScreenLayout.ts` (new) follows window resizes with `useSyncExternalStore`. `Screen.tsx` passes `layout` to the turn and standings views.
- **Landscape** is F07's: the square at full height, capped at 72 vw, so near-square Screens get the 28 % minimum sidebar.
- **Portrait** (`PortraitTurn` in `ScreenTurn.tsx`):
  - The top bar has the clock and the blanks on one line (blanks floor at `max(3.5vmin, 16px)`).
  - The square is as wide as the Screen unless the height runs out. Flex weights give it the free height first, up to its width.
  - Below it is a room of at least `max(25vh, 180px)`, plus the caption row in turns 1–2. It holds the players strip (turn order, ✏️, ✓ with this turn's points, wrapped) and the two latest guesses (`Feed`, shared with the sidebar).
  - Round and turn numbers are dropped. The room's height never depends on its contents, so the square keeps its size through the turn.
- **Portrait reveal:** "🎉 Everyone got it! · It was…" is in the top bar. The word sits under the drawing, on one line, capped at 9 vh. "Got it" shares a line with its chips (0.85 em, so nine fit).
- **Landscape reveal word:** the per-letter estimate goes from 0.75 to 0.82 em, since MANGO overflowed a 28 % sidebar at 1180×820.
- **Standings:** one column in portrait (two cut names to "M…" at 390 px).
- **Footer:** portrait leads with the code and truncates the address.
- **Lobby:** under 480 px tall (a phone on its side), the join details sit left and the players, host line and Start sit right, with tighter gaps and 16 px chips. Before this, Start fell off screen with ten players at 844×390.
- **Tests:**
  - `lib/screen.test.ts` (+5 `screenLayout`: the six sizes, near-square, the 0.85 edge, no size yet).
  - `ScreenTurn.test.tsx` (+7 portrait: timer and blanks above the canvas, players and guesses under it; ✏️ and ✓ +points; two latest guesses only; ••• for a masked one; no round/turn in portrait but there in landscape; caption under the drawing; "It was…" above and the word under it at the reveal).
  - `ScreenStandings.test.tsx` (+2: two columns landscape, one portrait).
  - No test of `useScreenLayout` reacting to a resize (no jsdom; the sweep resizes nothing, so it's covered only by the Kim check).
- No new dependencies.

**Decisions:** DECISIONS 55 (the switch, portrait sizes and reserve, the portrait reveal, the 0.82 em estimate, one-column portrait standings, the footer, the short-landscape lobby).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: this entry, the Kim check, DECISIONS 55 with SPEC-QUESTIONs at the reserve, the standings and the lobby, a recorded clean sweep, a test of the portrait ••• feed. Not changed: no resize test of the hook (above).
- **mobile-ux: PASS WITH FIXES** (no Must-fix). Applied: the sweep covers game 2's final with the Tonight panel and a short 1366×560 laptop window; the portrait word comment is corrected. To Backlog: layout hysteresis near 0.85, labels for ✏️/✓ and the dimmed-name contrast, driving the Tonight switch from `layout`. Not changed: the strip has no "+N" (the room cap is 10, all checked).
- secrets-fairness not run: no server, shared or ink code changed.

**Playtest:** `.playtest/F33/layouts.ts` (+ `check.js`). There are 7 Screens, all holding the host token: 1920×1080, 1366×768, 820×1180, 1180×820, 390×844, 844×390 and 1366×560. Ten bot players go through the lobby, CHOOSING, DRAWING (turn 1 with the caption, and turn 3 without it), the reveal (2 got it with a close guess; and all 9 got it), the scoreboard, the final, and game 2's final with Tonight. On every Screen at every step:
- No document scroll.
- No visible element outside the viewport (the idle host bar is excluded).
- No clipped list or panel.
- The smallest text is ≥ 14 px (27 px on the TV, 19–20 px on 1366/tablets, 14 px only for the footer on phone-sized Screens).

All pass. The square sizes in turns 1–2 / 3+:
- 1920×1080: 878/986
- 1366×768: 624/701
- 820×1180: 648/731
- 1180×820: 666/748
- 390×844: 374/374 (full width)
- 844×390: 302/350
- 1366×560: 455/511

Screenshots: `.playtest/F33/<step>-<w>x<h>.png`. No console errors.

**Notes for next session:**
- **F34:** "Jun got it!" goes in the portrait top bar (`TopBar` in `ScreenTurn.tsx`), never over the drawing. Wrong-guess bubbles come from the portrait `PlayerStrip` chips. The portrait room under the square is fixed (`PORTRAIT_BELOW`), so new rows must fit it; re-run `.playtest/F33/layouts.ts` (restart `npm run dev` first if room creation hits the rate limit).
- **F35:** the portrait reveal is `RevealPanel layout="portrait"` plus `RevealIntro` in the top bar.
- **F37:** the lobby's QR has to fit the short-landscape two-column lobby too.

**How to try it:**
- Unit tests: `npx vitest run client/src/lib/screen.test.ts client/src/components/screen`.
- Sweep: `npm run dev`, then `npm run playtest -- .playtest/F33/layouts.ts`.
- By hand: `npm run dev`, Screen at http://localhost:5173 (Start), bots at `/dev/bots/CODE`. Resize the window, or use device emulation in Chrome at 820×1180 and 390×844, to see portrait.

## F32 — Draw pad hardening (2026-10-31)
**What changed:**
- Already in place from F08 and F30, so nothing changed there: DPR sizing (`size × devicePixelRatio`, capped at 2048), coalesced events, the first pointer only (`createPointerGate` and pointer capture), and `pointercancel`/`lostpointercapture` ending the stroke (`DrawPad.tsx`). The scroll/zoom lock is `useDrawLock`.
- `client/src/lib/wakeLock.ts` (new, the file the spec names): `holdWakeLock(nav, doc)` asks for a screen lock on a visible page and asks again on `visibilitychange`, since the browser drops it on hide. A refused request (no user gesture, battery saver) is retried on the next `pointerdown`, never twice at once. A lock that arrives after stop is released. No API or a throw does nothing. `useWakeLock(active)` is the hook. `DrawerTurn` holds it for the whole DRAWING view, through a pause too. F37 can reuse it for the Screen and phones.
- `client/src/lib/phone.ts`: `drawerSideways(w, h)` is true when the view is landscape and the pad would be under 352 px (the pad at 360 × 560).
- `DrawerTurn.tsx`:
  - On its side, `TurnUpright` covers the view with "Turn your phone upright", "Your drawing is safe" and the clock (`role="alert"`, an inline SVG icon, no word). The header, pad and toolbar are `inert`, the pad and toolbar are disabled, and so the stroke in hand ends.
  - The pad stays mounted at its upright size, so the turn's stack and sender carry on. A turn that starts sideways gets the pad its upright size would give (`drawerPadSize(h, w)`), so it binds to the turn at once.
  - The whole view is `touch-none overflow-hidden`, so a pinch on the bar or toolbar can't zoom. This takes the first half of the F30 Backlog item.
- Copy: `turnUpright`, `drawingIsSafe`.
- Tests: `lib/wakeLock.test.ts` (new, 6: request and release, re-request on show, wait for visible and no double request, retry on tap after a refusal, late lock released, no API or a throw); `lib/phone.test.ts` (+4 `drawerSideways` tables: phones on their side, upright phones, landscape tablets, the 352 px edge); `phoneViews.test.tsx` (+2: `touch-none` root with no cover, and the cover's copy and clock with no word). No test of `DrawerTurn` calling `useWakeLock` (there's no jsdom here; the playtest checks it with a stub).
- No new dependencies.

**Decisions:** DECISIONS 54 (the sideways threshold, the drawer only, the cover's contents, keeping the pad mounted, holding the wake lock through a pause, retrying on a tap).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: this entry, the Kim check, DECISIONS 54 and the SPEC-QUESTION at `drawerSideways`, a test of the cover.
- **mobile-ux: PASS WITH FIXES.** Applied:
  - the cover shows the clock;
  - the content under it is `inert`;
  - a turn that starts sideways binds its pad at once;
  - an SVG instead of the 📱↻ emoji;
  - the cover is tested;
  - the Kim check covers an iPhone home-screen app (no Wake Lock before iOS 18.4) and auto-lock.
  
  Not changed: a page already zoomed before the turn isn't reset; no video-loop fallback for Wake Lock (it would need a dependency).
- secrets-fairness not run: no server, shared or ink code changed.

**Playtest:** `.playtest/F32/scenario.ts` (TV Screen, Ana on a Pixel 7 drawing at DPR 2.625, Ben guessing, bots, `navigator.wakeLock` stubbed). All 7 steps pass, and the final run was after the review fixes:
- At 360×560, 390×664 and 412×780 there's no document scroll or overflow. The pad is square and fully visible (344/382/404 px), all 12 tools are in the viewport, and `canvas.width` = round(css × DPR) (903/1003/1061).
- The wake lock is requested while drawing and requested again after a release, on `visibilitychange` and on a pad tap.
- Rotated to 844×390 mid-stroke: the cover shows and every tool is disabled (the 👑 Host button stays usable above it). The pad stays 382 px and the Screen keeps the ink.
- Back to 390×844: the cover is gone, the old ink is on the pad and the Screen, and a new stroke reaches the Screen.
- A 1180×820 landscape tablet as the drawer: no cover, and the 604 px pad fits.
- The word is in neither Ben's HTML nor the Screen's.
- Every wake lock is released once the turn ends.
- No console errors. Screenshots: `.playtest/F32/3-landscape-visual-Ana.png`, `4-back-upright-Ana.png`, `5-tablet-visual-Ana.png`.
- Not playtested: a turn that starts with the phone already sideways (the pad mounts at its upright size and binds; the same mount path as any turn).

**Notes for next session:**
- **F37:** use `holdWakeLock`/`useWakeLock` from `lib/wakeLock.ts` for the Screen's Tap-to-start and phones during a game. Holding two locks at once is fine (each has its own sentinel).
- **F45:** Taglish for `turnUpright` and `drawingIsSafe`.
- Guesser and lobby phone views don't ask to turn upright (DECISIONS 54); see Backlog.

**How to try it:**
- Unit tests: `npx vitest run client/src/lib/wakeLock.test.ts client/src/lib/phone.test.ts client/src/components/phone/phoneViews.test.tsx`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE` or bots at `/dev/bots/CODE`. As the drawer, turn the phone on its side mid-stroke and back. In desktop Chrome, use device emulation and swap the orientation.

## F31 — Undo and clear (2026-10-31)
**What changed:**
- Tests only. Undo and Clear already shipped with F30: `padUndo`/`padClear` (`client/src/ink/padTools.ts`), `u`/`c` in the shared action stack (`shared/ink.ts`) and the server's ink log (`server/inkStore.ts`), and the Screen repainting on `redraw` (`InkCanvas.tsx`). F31 proves they agree everywhere.
- `client/src/ink/undoClear.property.test.ts` (new): the roadmap's property test. 150 seeded sessions of 160 random steps each (mulberry32 `server/rng.ts`, fake timers) run through the real code paths: the pad as `DrawPad` drives it (`pushStroke` + `createInkSender`, undo or clear with a finger down included, random flush ticks), the server's `createInkStore`, and three `createScreenInk` Screens fed the relayed batches. One watches live, one joins late from a snapshot, and one drops a batch, sees the gap and recovers from a snapshot. Whenever nothing is pending, the server's and every Screen's stack are equal point for point. The pad's stack has the same actions (kind, strokeId, colour, size, ended), the same visible strokes and Undo/Clear state, and each stroke's sent points are a subsequence of the pad's, with the same first point and, once the stroke has ended, the same last point (the sender filters and simplifies). Every session ends by undoing back to an empty stack. It asserts more than 5 undos and 1 clear per session on average, so the pass isn't vacuous, and a failure names its seed. Mutation-checked: a pad Undo that skips clears, or a server `u` that refuses to pop a clear, both fail it.
- `client/src/lib/ink.test.ts` (+1): the Screen feed asks for a full redraw on `u`, on `c` and on the `u` that undoes the clear.
- No new dependencies (no fast-check: the project's seeded PRNG is enough).

**Decisions:** none new (DECISIONS 53 covers when Undo/Clear are enabled).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: this entry; a failing seed is named. Not changed: no DOM test of `InkCanvas`'s repaint (there's no jsdom; the F30 and F31 playtests check the Screen's pixels).
- secrets-fairness and mobile-ux not run: no server, shared, ink runtime or UI code changed.

**Playtest:** `.playtest/F31/scenario.ts` (TV Screen 1920×1080, Ana on a 360×560 phone drawing, Ben on a Pixel 7, bots). All 6 steps pass:
- 3 strokes show on the Screen;
- Undo ×3 → 0 non-white pixels, with Undo and Clear disabled;
- 2 strokes, Clear → white, then Undo → both back;
- Clear, Undo ×3 → empty;
- the Screen reloaded after a Clear comes back white from its snapshot, and Ana's Undo restores both strokes on it;
- Ben has no canvas, and the word is in neither Ben's HTML nor the Screen's.
- No console errors.

**Notes for next session:**
- The Backlog item on a refused batch (`inkFull`) leaving the pad ahead of the server is still open; the property test stays within the caps on purpose.
- The F30 Kim check already covers Undo and Clear on real phones.

**How to try it:**
- Unit tests: `npx vitest run client/src/ink/undoClear.property.test.ts client/src/lib/ink.test.ts`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE`; as the drawer, draw, Undo back to empty, Clear and Undo, and watch the TV.

## F30 — Colours, sizes and eraser (2026-10-31)
**What changed:**
- **Client (drawer):**
  - `lib/tools.ts`: the tool state (`DrawTool {color, size, eraser}`), `DEFAULT_TOOL` (black, M), `pickColor` (leaves the eraser), `cycleSize` (S → M → L → S), `toggleEraser` (keeps the pen colour), `inkColor` (8 while erasing).
  - `ink/padTools.ts`: `padUndo`/`padClear` change the pad's stack and send `u`/`c` together; `padState` says when they'd do something (after the turn's snapshot, a non-empty stack, visible ink).
  - `components/phone/DrawToolbar.tsx` (new): `ColourSwatches` (8 × 40 px circles in 44 px buttons, `aria-pressed`, white border + orange outline when picked), `SizeButton` (a 6/12/22 px dot in the pen colour, white while erasing, and S/M/L), and `DrawToolbar`, the two 48 px rows: colours, then size, Eraser, ↶ Undo, ✕ Clear. Disabled while paused; Undo/Clear greyed when they'd do nothing.
  - `DrawPad.tsx`: takes `tool`, `controlsRef` (Undo/Clear for the toolbar) and `onState`; a stroke starts with `inkColor(tool)` at the tool's size; Undo or Clear with a finger down ends that stroke first. `DrawerTurn.tsx` holds the tool per turn and replaces the v0 placeholder rows.
  - Smoothing was already one shared `drawStroke` (`lib/ink.ts`) on the pad, the Screen and the avatars; now tested.
- **Client (lobby doodle):** `DoodlePad` gets the size button (by Undo) and the 8 colours under the pad (one row of 8 from 352 px, else 4 × 2); no Eraser or Clear (DECISIONS 53).
- **Copy:** `colours`, `colourBlack`…`colourBrown`, `brushSize`, `sizeSmall/Medium/Large`, `eraser`, `undo`, `clear`; removed `blackPen`, `moreToolsSoon`.
- **Tests:** `lib/tools.test.ts` (new, 5), `ink/padTools.test.ts` (new, 5: colours/sizes/eraser reach the server stack as drawn, undo back to empty, clear then undo, undo mid-stroke, nothing before the snapshot), `lib/ink.test.ts` (+3: quadratic midpoints and round caps, 8 colours and S/M/L widths, eraser = canvas colour), `phoneViews.test.tsx` (+1: the two rows, 44/40 px swatches, defaults, disabled Undo/Clear, all disabled while paused), `hostPhone.test.tsx` (button lists now include the doodle's tools; the helper reads `aria-label`).
- No server change: the schema already took colours 0–8 and sizes 0–2. No new dependencies.

**Decisions:** DECISIONS 53 (per-turn reset, eraser toggle and size, when Undo/Clear are enabled, the selection style, the single-dot size button, the doodle's tools and its 360 × 560 host lobby scroll).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: the Kim check, the single-dot note in DECISIONS 53. Not changed: swatches below 360 px (the spec's minimum is 360; 352 px fits); a DOM-level wiring test (no jsdom here; the playtest covers it).
- **secrets-fairness: PASS WITH FIXES.** No leak, routing untouched. To Backlog: a refused batch (`inkFull`) leaves the pad ahead of the server, so a later Undo would diverge (open since F12). Not changed: the pause race (the resync on resume resends the `u`) and the gate case (the gate always owns the stroke's pointer).
- **mobile-ux: PASS WITH FIXES.** Applied: the size dot is white while erasing; row 2's buttons have `px-1` for room at 360 px. To Backlog: pinch-zoom lock on the drawer's bars and a live region for the size. Not changed: the taller lobby (recorded in DECISIONS 53).

**Playtest:** `.playtest/F30/scenario.ts` (TV Screen, Ana and Ben on Pixel 7s, bots) and `lobby.ts`:
- drawer at 360×560, 390×664, 412×780: no overflow, square pad on screen, all 12 tools inside the viewport, ≥ 44×44, under the pad: pass;
- Red at L → 14,355 red pixels on the Screen; the eraser leaves pure white at the crossing; a colour tap turns the eraser off: pass;
- Undo removes the stroke on the pad and the Screen, Clear → 0 non-white pixels on the Screen, Undo brings it back: pass;
- the guesser has no canvas, and neither the guesser nor the Screen HTML has the word: pass;
- lobby at 360×560: the guesser's swatches are on screen; the host's are below the fold under Start (scroll; DECISIONS 53); a blue doodle shows blue on the Screen chip.
- No console errors. Screenshots: `.playtest/F30/layout-*-Ana.png`, `step2-screen.png`, `step3-screen.png`, `step4-screen.png`, `lobby360-*.png`, `lobby-chips-screen.png`.

**Notes for next session:**
- **F31 (drawer polish):** the toolbar is `DrawToolbar`; `DrawPad`'s `onState` reports `canUndo`/`canClear`.
- **F45:** Taglish for the new copy keys; check row 2's labels fit at 360 px (`whitespace-nowrap`, about 82 px each).
- **F49 (gallery):** draw with `redrawPicture`/`drawStroke` from `lib/ink.ts` so eraser strokes paint the canvas colour.

**How to try it:**
- Unit tests: `npx vitest run client/src/lib/tools.test.ts client/src/ink/padTools.test.ts client/src/lib/ink.test.ts client/src/components/phone`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE` or bots at `/dev/bots/CODE`; draw with each tool and watch the TV.

## F29 — Rematch, back to lobby and the night's totals (2026-10-31)
**What changed:**
- **Server (`reducer.ts`):**
  - `host:rematch` (FINAL, no countdown) sets `rematchAt` and schedules `rematchGo` in 3 s; nothing is reset yet. `host:rematchCancel` clears it and bumps the epoch. `timer rematchGo` (FINAL with a countdown, else `staleTimer`): with ≥ 2 connected, the new-game reset and `beginGame`; with fewer, FINAL stays and `fx notEnoughPlayers` goes to all.
  - `host:backToLobby` (FINAL, a running countdown too): the new-game reset, then LOBBY.
  - `newGame`: each score is banked into `session.totals` (with `session.players` identities) and set to 0; `gameNumber` +1; `history`, `awards`, `turn`, `upcoming`, cycle, `turnOrder`, `advanceAt`, `rematchAt` cleared; `inkReset`. Players, crown, settings, custom words, `usedIds`, `hasDoodle` and turn ids (still rising) carry over.
  - `beginGame` is shared by `host:start` and `rematchGo` (deck from `usedIds`, cycle 1, `firstDrawerJoinedAt`).
  - Rotation: new `server/turnOrder.ts` `cycleOrder(players, after)`. `Room.rotateAfter` is the last game's first drawer's `joinedAt` in a rematch game (null from the lobby), and every cycle of that game uses it.
  - `joinedAt` is strictly increasing in a room (`max(now, latest + 1)`), so same-millisecond joins can't tie the rotation.
  - Leaving or being kicked on FINAL banks that finished game's score at once.
- **Views (`views.ts`, `shared/types.ts`):** every view has `gameNumber` and, during the countdown, `rematchFirst` (pid, name and colour of the next first drawer, by the reducer's rule). The Screen has `tonight` (FINAL from game 2: every finished game plus this one, shared ranks, departed players included). New `SessionPlayer`, `TonightRow`, `Room.rotateAfter`, `session.players`.
- **Client:**
  - `RematchOverlay.tsx` (Screen and phone): "Game 2 starts in", a big 3-2-1 counted locally, "Jun draws first" in their colour. The Screen version is 95 % dim, lets the pointer through and sits under the host bar (Cancel). The phone's covers an `inert` view under the Host button, whose drawer has Cancel.
  - "Need 2 players" toast on `notEnoughPlayers`: Screen (FINAL, under the title) and phones.
  - `ScreenStandings` Tonight panel: beside the scores at ≥ 16:10, a wrapped strip under them on narrower Screens, 8 rows + "+N more". With it shown, the scores go into two columns from 4 players.
  - Copy: `tonight`, `andMore`, `gameStartsIn`, `inSeconds`, `drawsFirst`.
- **Tests:**
  - `server/reducer.rematch.test.ts` (new, 16): countdown, refusals, game 2 with the next drawer first, rotation over three rematches, rotation after the first drawer left, cycles 2+ rotated, a disconnected head skipped, a countdown joiner included, fewer than 2 connected, a 2-player room, cancel keeps everything, a stale `rematchGo` after cancel (and after a second rematch), back to lobby during the countdown, `joinedAt` ties.
  - `server/reducer.newgame.test.ts` (new, 10): back to lobby keeps and clears the right fields, `hasDoodle` kept, a lobby game starts with the earliest joiner, settings change afterwards, refusals, no word repeats across two games (both ways), totals over three games, a mid-game leaver keeps only earlier totals, game 2's first turn `number` is 1, turn ids keep rising.
  - `server/turnOrder.test.ts` (new, 5).
  - `server/views.night.test.ts` (new, 6): the countdown in every view, the first drawer after a disconnect or leave and that it matches the deal, Tonight null in game 1 and outside FINAL, Tonight totals with a departed player, Screen only.
  - `views.leak.test.ts`: the scripted game now rematches and audits game 2's deal and drawing.
  - `sockets.test.ts` (+1, rematch end to end).
  - `RematchOverlay.test.tsx` (new, 3).
  - `ScreenStandings.test.tsx` (+3).
  - `reducer.lobby.test.ts` and `room.test.ts`: adjusted for the landed actions and new fields.
- No new dependencies.

**Decisions:** DECISIONS 52 (rotation of every cycle and `rotateAfter`, strictly increasing `joinedAt`, `session.players`, totals banked at the reset and on a FINAL leave, the Tonight panel's place and layout, the countdown view fields, refusals, the overlay and toasts).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: this entry and the F29 Kim check; the F24 Kim check no longer says Rematch is "coming later"; a test that "draws first" matches the actual deal after a mid-countdown disconnect; a test that a later join keeps its own time.
- **secrets-fairness: PASS WITH FIXES.** No leak; purity and stale timers OK. Applied: a player leaving or kicked on FINAL banks that game's score (they used to lose it from the night's totals), with tests. Recorded in DECISIONS 52: departed and kicked players stay in Tonight. Not changed: `rematchGo`'s words guard reuses `notEnoughPlayers` (it can't trigger: words settings are lobby-only).
- **mobile-ux: PASS WITH FIXES.**
  - Applied: 10 players + Tonight on a 4:3 Screen (two columns from 4 players, a strip under them below 16:10, 8 rows + "+N more"); the Screen countdown backdrop is 95 %; screen readers hear "3 seconds" with the line; the Screen toast moved under the title; the phone toast no longer hides behind the crown toast.
  - To Backlog: dim departed players' Tonight rows; the 4:3 host bar covering the strip until it auto-hides; an always-mounted status region for the countdown.

**Playtest:**
- `.playtest/F29/scenario.ts` (TV Screen, Ana on a Pixel 7, 2 bots), all 7 steps pass:
  - game 1 ended, no Tonight;
  - Rematch (two taps): "Game 2 starts in" on the Screen and the phone;
  - Cancel keeps FINAL past the stale window;
  - Rematch: game 2 at Turn 1 with "Bot 1 draws first" (Ana drew first in game 1);
  - "Tonight · 2 games" after game 2;
  - Back to lobby keeps the players.
- `.playtest/F29/layout.ts` (10 bots, rematch, Tonight) measured at 1920×1080, 1024×768, 1280×1024 and 1180×820: no name truncated, scores and Tonight above the code strip.
- No console errors. Screenshots: `.playtest/F29/countdown-screen.png`, `tonight-screen.png`, `tonight10-*-screen.png`.

**Notes for next session:**
- **F49 (gallery):** the gallery is `history`, which the new-game reset clears; it stays through a countdown and a cancel. The Screen countdown overlay is `pointer-events-none`, so the gallery stays usable under it, as the spec asks.
- **F50 (awards):** `awards` is cleared by the reset; compute it on entering FINAL (`setPhase(d, 'FINAL')` is called from `endCycle`, `startCycle` and `end`).
- **F33:** the portrait Screen needs the overlay and Tonight checked at ≤ 0.85.
- **F38:** no sound for the countdown yet.
- **F45:** Taglish for `tonight`, `andMore`, `gameStartsIn`, `inSeconds`, `drawsFirst`.
- `notYet` is still used by `player:rename`, `player:react`, `player:visibility` and `host:customWords`.

**How to try it:**
- Unit tests: `npx vitest run server/reducer.rematch.test.ts server/reducer.newgame.test.ts server/turnOrder.test.ts server/views.night.test.ts server/views.leak.test.ts server/sockets.test.ts client/src/components/RematchOverlay.test.tsx client/src/components/screen/ScreenStandings.test.tsx`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE` or bots at `/dev/bots/CODE`; play or End a game, then Rematch (Space twice or two taps), Cancel (Esc), and L L for the lobby.

## F28 — Pause, skip, kick and end (2026-10-31)
**What changed:**
- **Server (`reducer.ts`):**
  - `host:pause` / `host:resume` (CHOOSING, DRAWING, REVEAL, SCOREBOARD): the `host` reason. The first reason freezes the phase at `paused.since` and bumps the epoch; `remainingMs` is recorded after every action (`phaseLeft`). Clearing the last reason starts the 3-2-1 (`resumeAt`, `resumeGo`); a reason added during it stops it. `resumeGo` (`resume`) moves `clockStart`/`endsAt`, an open choice's `dealtAt` and the auto-advance forward by the paused time, then re-schedules `drawUp`, the hints still to come (`scheduleHints`), `chooseUp`, the auto-advance, and re-runs the all-guessed check. Every timer but `resumeGo` is refused while paused (one check in `timer`, replacing the per-timer ones).
  - New `Room.advanceAt` (REVEAL/SCOREBOARD auto-advance due time), set by `autoAdvance`, held by a pause.
  - `setPhase(d, phase, now, fx)`: LOBBY/FINAL clear a pause; a skip or kick while paused keeps it, the new phase's timers wait for `resumeGo`, and a running 3-2-1 is re-armed.
  - `host:kick` (any phase): `removePlayer` shared with Leave (turn order, `doodleDrop`, crown passed, drawing turn ended as a skip, choice abandoned), the `keyHash` barred, `kick` effect; own pid → `cannotKickSelf`.
  - `host:end` (any game phase → FINAL): a drawing turn closes as a skip (`closeTurn`, `inkClose`), points kept; CHOOSING's words and an `upcoming` deal go back to the deck.
  - `shared/types.ts`: `advanceAt`, `notPaused`, `cannotKickSelf`.
- **Client:**
  - `PausedOverlay.tsx` (Screen and phone): "Paused" and the reason (`lib/pause.ts`: what the room waits on first), then "Back in" and a big 3-2-1 counted locally. The Screen dims to 80 % and lets the pointer through under the host bar; the phone covers its view (now `inert`, a focused guess box blurred) under the crown phone's Host button. Connection pills sit above it.
  - `hostKeys.ts`: Resume only for the host's own pause; Pause during the 3-2-1 and other pauses; Space does nothing then.
  - Kick, the kicked screen and the two-tap Leave were already in place (F08, F25); now the server answers them.
- **Tests:** `server/reducer.pause.test.ts` (new, 23: frozen time, `t` excludes paused time, stale timers, 3-2-1, hints, early end, choice, reveal/scoreboard, moving on while paused), `server/reducer.host.test.ts` (new, 17: skip, kick incl. drawer/crown holder/`doodleDrop`, end), `sockets.test.ts` (+2 end to end), `views.leak.test.ts` (real pause instead of `synth`, and a kick/pause/skip/end game), `hostKeys.test.ts` (+1), `lib/pause.test.ts` (new, 4), `PausedOverlay.test.tsx` (new, 3).
- No new dependencies.

**Decisions:** DECISIONS 51 (pause bookkeeping and `advanceAt`, Resume only for `host`, moving on while paused, `cannotKickSelf`, end's deck returns, overlay and Leave placement).

Reviews:
- **spec-checker: PASS WITH FIXES.** Applied: DECISIONS 51 and the `SPEC-QUESTION` at `kick`, this entry and the Kim check, the overlay render test. `notYet` kept (rematch and back to lobby still use it until F29).
- **secrets-fairness: PASS WITH FIXES.** No leak, purity and timing OK. Not changed: a kicked player's doodle stays in the Screen's memory (its chip is gone, as F27 noted); the kicked phone's `/ink` socket isn't disconnected by the server (the phone closes it on `kicked`, and the server refuses that pid).
- **mobile-ux: PASS WITH FIXES.** Applied: phone view `inert` while paused and the guess box blurred; the digit `aria-hidden`; scrim 80 % and a text shadow; pills above the overlay; the phone digit capped at 28 dvh. To Backlog: a permanently mounted status region, and a Leave for guessers during a long pause.

**Playtest:** `.playtest/F28/scenario.ts` and `real-clicks.ts` (1 TV Screen, 3–4 Pixel 7 phones): pause/resume from the bar with real clicks (after a mouse move, as the bar auto-hides) and from the crown phone's drawer over the overlay; clock frozen; 3-2-1; skip in CHOOSING and DRAWING (two taps); kick the drawer and the crown holder (crown passes, "You were removed from this game"); End game (two taps) → final scores; Leave at SCOREBOARD says "Your points will be lost". All pass.

**Notes for next session:**
- **F29:** `setPhase` clears a pause on LOBBY/FINAL; Rematch and Back to lobby still show `notYet` until then.
- **F40/F41:** `pause()`/`clearPauseReason()` take any `PauseReason`; `drawerAway`, `screenAway`, `fewPlayers` only need their triggers. If one lets `host:next` or a take-up happen under a pause, re-check `resume`.

**How to try it:**
- Unit tests: `npx vitest run server/reducer.pause.test.ts server/reducer.host.test.ts server/sockets.test.ts server/views.leak.test.ts client/src/lib client/src/components/PausedOverlay.test.tsx`.
- In the app: `npm run dev`, Screen at http://localhost:5173 (Start), phones via `npm run lan CODE`; press P on the Screen, kick from Players, E E to end.

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
