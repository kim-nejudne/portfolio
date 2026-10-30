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

<!-- entries below, newest first -->

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
