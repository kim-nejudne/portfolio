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

- [x] F30 Colours, sizes and eraser

- [x] F31 Undo and clear

- [x] F32 Draw pad hardening

## M6 — Screen and phone polish

- [x] F33 Responsive Screen layouts

- [x] F34 Announcements, reactions and feed UI

- [x] F35 The reveal

- [x] F36 Drawer feedback

- [x] F37 QR, tap-to-start, wake lock and connection dot

- [x] F38 Sounds

- [x] F39 Join budget

## M7 — Resilience

- [x] F40 Drawer away

- [x] F41 Screen away and too few players

- [x] F42 Rejoin by name from another phone

- [x] F43 Reconnect every role

- [x] F44 Rate limits and limits

## M8 — Language and content

- [x] F45 Taglish copy

- [x] F46 Full family word packs

- [x] F47 Spicy pack

- [x] F48 Custom words

## M9 — Gallery and awards

- [x] F49 Gallery on the Screen

- [x] F50 Tonight's awards

## Barkada night release

The first real barkada night needs everything in M1–M9. The review's must-haves for that night: private guessing (F08, F10, F15, F18, F26), the frozen-drawer fixes (F18, F36), onboarding and lobby doodles (F26, F27), the host lobby (F25), the shorter game (F21, F22), the drawer layout (F08, F32), the reveal (F35), no running ranks (F20, F34), awards (F50), rejoin by name (F42), plus the gallery, custom words, the spicy pack, phone and tablet Screens and sounds. Play it on the LAN, or on the deployed URL after M10.

## M10 — Deploy

- [x] F51 Docker image and smoke test

- [x] F52 Deploy to sketchy.kimnejudne.dev

## M11 — Avatars

- [x] F53 Emoji avatars

- [x] F54 Change avatar in the lobby

- [x] F55 Lobby doodle stays on the phone

## M12 — Sketchbook look

The light spiral-sketchbook restyle of every page, phones first. Build reference: `docs/design/SKETCHBOOK.md`. Target mockup: `docs/design/sketchbook.html` (the hash picks the phase, e.g. `#sketch-drawing`; `O` toggles a portrait Screen). Visual change only: no invariant, game rule or timing changes. Every M12 entry also needs:
- the look and layout of `sketchbook.html` for its surfaces, with app data and spec rules winning where they differ;
- only F56 tokens in the files it touches, with no `#1D1B22`, `#FF6B35`, `#FFD166` or `white/NN` classes left;
- no overflow at the viewports it names;
- `/playtest` screenshots compared with the mockup;
- a `mobile-ux-reviewer` run.

- [x] F56 Sketchbook foundation

- [x] F57 Sketchbook landing and join form

- [ ] F58 Sketchbook phone shell and lobby
  - Spec: UI by role and phase (Guesser phone, Host controls, Look and feel); DECISIONS "Proposed spec changes" 2026-10-31 (Sketchbook look); docs/design/SKETCHBOOK.md (Surfaces: Lobby)
  - Depends: F57
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - The global body and `color-scheme` switch to paper (light). The `Play.tsx` shell, toasts, kicked page, rotate-back prompt and connection dot are on paper with rings across the top.
    - The guest lobby (`#sketch-lobby`, guesser) is a ruled page. It shows the avatar with Change avatar, the waiting line with the host's name in colour, the avatars here with a count, the doodle pad (dashed border) with its note, and Leave (still two taps).
    - The host lobby (drawer frame) has a dot grid, a "Room KPRW" eyebrow, "You're the host 👑", a roster on dashed rules (`HostPlayerList`, with Kick and the crown actions unchanged), a full-width Start sketch button, and the settings line with Change.
    - The Change-avatar dialog is a paper sheet.
    - Both lobbies fit 360×560 with the doodle pad.
  - Tests: existing `hostPhone`, `phoneViews`, `ChangeAvatar` and `ConnectionDot` tests stay green

- [ ] F59 Sketchbook drawer phone
  - Spec: UI by role and phase (Drawer phone); Canvas and drawing tools (Tools); docs/design/SKETCHBOOK.md (Surfaces: Drawer)
  - Depends: F58
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - Choosing (`#sketch-choosing`) shows the heading and a countdown ring (12 s total), then three ruled index cards with tape, a red-pen level tag, the word large and the gloss. "You draw next!" during the reveal gets the same cards.
    - Drawing (`#sketch-drawing`, `#sketch-close`, `#sketch-gotit`) has a 56 px top bar. Row 1: the word at about 16 px in `soft`, the Nunito timer turning red at ≤ 10 s, "N of 4 got it", the 👑 Host button. Row 2: the latest wrong guess, or "Bea is close!" on an amber swash for 2 s.
    - The pad has an ink border and a hard shadow, and no tape. The "Start with one big shape" hint is in pen.
    - The toolbar keeps exactly two 48 px rows. Row 1 has 8 crayon swatches (40 px circles, 44 px hit areas, a visible active ring). Row 2 has hand-bordered Size (a dot plus S/M/L), Eraser, Undo and Clear with pen icons.
    - The pad size formula is unchanged, with no overflow at 360×560, 390×664 or 412×780.
  - Tests: existing DrawerTurn, WordChoice, DrawToolbar and `padTools` tests stay green

- [ ] F60 Sketchbook guesser phone
  - Spec: UI by role and phase (Guesser phone); Guess matching (Near misses); DECISIONS "Proposed spec changes" 2026-10-31 (Sketchbook look); docs/design/SKETCHBOOK.md (Surfaces: Guesser)
  - Depends: F58
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - The page is ruled with a red margin.
    - The top line is the Nunito timer and "✏️ Mika drawing", then the blanks.
    - The guess field is a pen underline with a blinking caret and a round pen send button. It stays near the top, keeps focus after a send, and keeps its input attributes.
    - Wrong tries are written on the lines and struck through in red pen with ✗. A close guess is circled "close!", with the "So close!" highlighter toast.
    - This turn's points sit in the left margin. They are never "+0" and never a rank.
    - Got it (`#sketch-gotit`) shows a big ✓, "Got it!" and a +points stamp, never the word, then the reaction buttons as wobbly circles.
    - Choosing shows the drawer's avatar, "Mika is choosing a word…" and the ring. Mid-game join and "👀 Watch the Screen" are restyled.
    - No overflow at 360×560, 390×664 or 412×780, with the keyboard-safe guess position kept.
  - Tests: existing GuesserTurn and `phoneViews` tests stay green; no word on the got-it panel (existing secrecy tests)

- [ ] F61 Sketchbook phone results and overlays
  - Spec: UI by role and phase (Guesser phone, Drawer phone, Host controls); Game flow and state machine (Pausing); docs/design/SKETCHBOOK.md (Surfaces: Results)
  - Depends: F59, F60
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - Reveal (`#sketch-reveal`) shows "It was…" and the word in Nunito 900 on the highlighter, then a red stamp: "+270 this turn", or "+320 for your drawing" only when above 0. The drawer gets the got-it rows.
    - Scoreboard (`#sketch-scoreboard`) shows the big pen-blue ordinal and the score, then the list with your row highlighted.
    - Final (`#sketch-final`) shows your award on a taped sticky note, then rank and score, "See the gallery on the Screen", and for the host the Rematch sketch button with "Back to lobby".
    - `HostDrawer` is a paper bottom sheet with its two-tap arming states still clear.
    - `PausedOverlay` and `RematchOverlay` use a paper veil and Nunito countdowns on both the phone and the Screen.
  - Tests: existing PhoneStandings, PausedOverlay, RematchOverlay and `hostPhone` tests stay green

- [ ] F62 Sketchbook Screen frame and lobby
  - Spec: UI by role and phase (Screen, Host controls, Look and feel); DECISIONS "Proposed spec changes" 2026-10-31 (Sketchbook look); docs/design/SKETCHBOOK.md (Surfaces: Screen)
  - Depends: F56
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - `Screen.tsx` puts the desk behind a notebook (paper, ink border, hard shadow). Landscape is a spread with a vertical ring gutter; portrait stacks with horizontal rings.
    - The room code sits on a tape strip under the notebook. It is always visible, except during the Final's gallery.
    - "Keep this device plugged in" is restyled.
    - `PlayerChip` becomes an index tab. In landscape the tabs form a column outside the right edge; in portrait they run along the bottom. They follow turn order, show the avatar and a name ≥ 3.5 vh, and handle up to 12 players.
    - The lobby (`#sketch-lobby`, Screen) shows the logo, "Join at …", the 4 Nunito code cells with the taped QR beside them, and How-to-play in pen circles. The right page has "Who's here", the hosting line, the settings line and Start, or the waiting line without the token.
    - `StartOverlay` and `RejoinedToast` are restyled.
    - All sizes are in vmin with the spec minimums.
  - Tests: existing ScreenLobby and RejoinedToast tests stay green

- [ ] F63 Sketchbook Screen host UI
  - Spec: UI by role and phase (Host controls); Settings; Words (Custom words); docs/design/SKETCHBOOK.md (Surfaces: Host UI)
  - Depends: F62
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - The host control bar is a taped strip along the bottom edge. Auto-hide and the keyboard shortcuts are unchanged.
    - The `?` shortcuts overlay is a ruled index card.
    - Settings, custom words and the players dialog are dot-grid sheets with sketch buttons and hand-bordered inputs. Every control and two-tap state behaves as before.
  - Tests: existing HostControls, ScreenSettings, CustomWords and PlayersDialog tests stay green

- [ ] F64 Sketchbook Screen turn, landscape
  - Spec: UI by role and phase (Screen); Guess feed and rude guesses; DECISIONS "Proposed spec changes" 2026-10-31 (Sketchbook look); docs/design/SKETCHBOOK.md (Surfaces: Turn, Motion)
  - Depends: F62
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - Choosing (`#sketch-choosing`, landscape) shows the drawer's large avatar, the name in colour and the ring on the left page.
    - The drawing (`#sketch-drawing`, `-close`, `-gotit`) is taped onto the left page by two corners and is the largest square that fits.
    - The right page shows the Nunito clock (red at ≤ 10 s), round/turn, blanks with counts, "✏️ Mika is drawing", the feed on dashed rules, the turn-1 and turn-2 caption, and the drawer-reconnecting badge.
    - The tabs get ✏️ and "✓ +points". Wrong-guess bubbles pop from the guesser's tab with a border in their colour, never over the drawing, at most 3 at once, for 2 s. Reactions float from the tabs. "Jun got it!" is a highlighter banner for 2 s.
    - `TurnFx` uses the mockup's keyframes (`sk-pop`, `sk-bubble`, `sk-float`) on the spec's timings, with a fade under reduced motion.
    - The paused veil is paper.
  - Tests: existing ScreenTurn tests stay green (feed masking, bubble cap, no word before REVEAL)

- [ ] F65 Sketchbook Screen portrait and reveal
  - Spec: UI by role and phase (Screen); DECISIONS "Proposed spec changes" 2026-10-31 (Sketchbook look); docs/design/SKETCHBOOK.md (Surfaces: Portrait, Reveal)
  - Depends: F64
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - The portrait turn (`#sketch-drawing` with `O`) puts a top bar over the square: timer, blanks, drawer line and the latest guess, following the spec's portrait priority (round and turn dropped). Then come the horizontal rings, the square and the tabs. It fits 3:4 and 9:16.
    - Reveal (`#sketch-reveal`, both orientations) shows "It was…" and the word in Nunito 900 on the highlighter. The word is the largest text, ≥ 12 vh, with the pop.
    - The reveal continues with the "Got it" rows in corrected order, "Almost:" struck in red (close guesses first), the drawer line only when above 0, and "Next: Jun draws". "Nobody got it!" has no point rows.
  - Tests: existing ScreenTurn reveal tests stay green

- [ ] F66 Sketchbook Screen scoreboard and final
  - Spec: UI by role and phase (Screen); Scoring; docs/design/SKETCHBOOK.md (Surfaces: Scoreboard / Final, Motion)
  - Depends: F64
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - The scoreboard (`#sketch-scoreboard`) is one full dot-grid page with "Round 1 of 2 done". Rows show the rank, avatar, name, a crayon bar that grows in a hand-bordered track, the score, and ↑n/↓n. The reorder animation is kept.
    - The final (`#sketch-final`) shows a drawn podium whose crayon blocks rise in the order 3rd, 2nd, 1st. 4th and later sit on one line.
    - The gallery is taped white sheets with captions. The lightbox is on paper, with the arrow keys kept.
    - Tonight's awards are sticky notes. The Tonight panel (game 2 and later) is restyled.
    - Rematch and Back to lobby are sketch buttons. The rematch countdown overlay is from F61.
  - Tests: existing ScreenStandings, ScreenAwards and ScreenGallery tests stay green

- [ ] F67 Sketchbook cleanup
  - Spec: UI by role and phase (Look and feel); Tech stack and architecture (Performance budget); docs/design/SKETCHBOOK.md (Rules)
  - Depends: F61, F63, F65, F66
  - Done when:
    - The M12 checks in `docs/design/SKETCHBOOK.md` (Definition of done)
    - `/dev/bots` and `DebugOverlay` use the F56 tokens (readable; no new flourishes).
    - Fredoka is removed: the font file, its `@font-face`, the preload and its OFL text.
    - `grep -rE '#1D1B22|#FF6B35|#FFD166|Fredoka|white/[0-9]' client/src` finds nothing.
    - `.claude/rules/`, the `mobile-ux-reviewer` agent and any README text describing the dark look are updated.
    - `BUDGET.playerCssAndFonts` is lowered to the measured CSS+fonts without Fredoka, plus about 5 KB, and `npm run size` passes. The numbers go in PROGRESS and DECISIONS.
    - A full-game `/playtest` covers the Screen in landscape and portrait with 3 phones, through every phase including a rematch, with screenshots compared to the mockup.
    - Kim checks are queued: TV legibility from 5 m, a budget Android, iPhone Safari, Taglish lengths in Patrick Hand, and the new copy's Taglish.
  - Tests: full suite green

## Bugs

- [x] B01 Pointer cursor and hover on live controls

## Backlog

- Dark sketchbook (black page, white gel pen, fluoro highlighter) for dim rooms, as in the 2026-10-31 mockups (M12 is light only).
- Reactions on the phone at the reveal (the server already takes them from anyone in REVEAL; F34 offers them only after a correct guess in DRAWING).
- Screen turn effects: re-measure chips on a resize or layout flip while a bubble or reaction is up, and measure a bubble's height instead of estimating it (F34 mobile-ux nits).
- Portrait "got it!" hides the blanks for its 2 s; on a turn where many guess right in a row, consider a second top-bar line or a shorter 1 s announcement (F34 mobile-ux nit).
- Server-wide cap on live rooms (503 past it), so many addresses creating rooms can't grow memory for 3 h each (F03 review).
- PNG download of a gallery drawing: 1024 × 1024 plus a caption band "tsinelas · by Mika · Sketchy", saved as `sketchy-<code>-<nn>-<word>.png` (deferred by the spec review: people photograph the TV).
- `drawer:choose` with an optional `turnId`, refused when it doesn't match the open choice, so a late duplicate tap from one CHOOSING can't pick the next `upcoming` deal when the sole connected player draws back-to-back (F21 review).
- The next drawer's phone: a one-line "It was {word}" strip above the "You draw next!" cards, and focus moved to the cards' heading on mount and to the "Get ready" line after a tap (F21 review).
- A per-socket rate limit on `host:settings` (host-only and a cheap merge, but each one broadcasts every view) (F22 review).
- A permanently mounted `role="status"` region on the Screen and phone for the pause reason, so "Paused" is announced reliably rather than mounting with its text; and a way out (Leave) for a guesser stuck in a long `drawerAway`/`fewPlayers` pause (F28 review).
- Screen: dim the Tonight rows of players who have left; on a 4:3 Screen the host bar wraps to two rows and covers the Tonight strip until it auto-hides; the rematch countdown should use the same permanently mounted status region as "Paused" (F29 review).
- Per-socket cap on all `player:*` events in the gateway, so refused actions (empty guesses, `alreadyGuessed`) can't be spammed at the reducer's clone cost (F14 review).
- Case study and the kimnejudne.dev hub link, after the Barkada night (as Buzzr: live first, listed on the hub once its case study is written).
- Drawer ink after a refused batch (`inkFull`, an unrecovered `rateLimited`): the pad keeps a stroke the server lacks, so a later Undo pops different strokes on the pad and the Screen. Disable the tools, or rebuild the pad from a fresh snapshot, on such a refusal (F30 review).
- Drawer phone: announce the new brush size in a live region after a tap (F30 review; the pinch-zoom lock on the bars landed in F32).
- Ask to turn upright on the other phone views too (guesser, lobby, choosing); F32 covers the drawer's pad only (DECISIONS 54).
- Screen layout hysteresis: switch to portrait at 0.85 but back to landscape only above about 0.9, so a mobile browser's bar resizing a Screen near 0.85 can't flip it back and forth (F33 review).
- Screen sidebar and strip: give the ✏️ and ✓ marks an accessible label (`role="img"`, "drawing" / "got it"), and check the lighter player colours at `opacity-60` for a disconnected player still reach 4.5:1 (F33 review).
- Standings: drive the Tonight panel's beside/under switch from the Screen's `layout` instead of its own 16:10 media query; today a 1180×820 Screen puts it under the scores (it fits, checked by `.playtest/F33`) (F33 review).
- Connection dot: a second cue besides colour for amber and red (a ring or a glyph), for colour-blind players (F37 review).
- Lobby QR: a larger code on wide Screens (about 34 vmin) if the F37 Kim check finds 24 vmin too small to scan from the sofa; it needs a lobby layout that doesn't push ten players off a 1080p Screen (F37 review, DECISIONS 59).
- Plain (no-token) Screens: an `M` key and a sound button, so a second Screen in the room can be quieted on its own (F38, DECISIONS 60).
- Display font swap: a metric-matched fallback `@font-face` (`local('Roboto')`/`local('Arial')` with `size-adjust` and ascent/descent overrides) so headings don't reflow when Fredoka arrives on a slow Android (F39 review).
- A catch-all route (`*` → Landing or a "No such page" with a link home); unknown paths render blank today, as they did with react-router (F39 review).
- Play's Leave: `navigate('/', {replace: true})` so Back doesn't return to the join form of the game just left (needs `replace` in `client/src/lib/router.tsx`) (F39 review).
- Join limit hardening (F44 secrets-fairness should-fixes): a looser per-key cap on rejoins by a known key (a joined player can loop connect + rejoin, each a commit and a broadcast); key IPv6 addresses on their /64 and fold `::ffff:a.b.c.d` into the IPv4 form.
- Screen lobby: clear a Start refusal ("Too fast", "Could not start") after `STATUS_MS`, as the host bar does, so the player-count hint comes back (F44 mobile-ux should-fix).
- An English spicy pack (or a Settings hint that Spicy words add Taglish words only), if Kim wants Spicy to change English-only games (F47, DECISIONS 69).
- Screen FINAL: let the gallery take the leftover height in landscape (thumbnails sized to it) instead of the fixed 17/28 vmin, which leaves a gap under the scores with few players (F49 mobile-ux should-fix).
- Screen FINAL with 10 players: the Tonight column on a 16:9 TV fits by shrinking to ~2 vmin, and a 4:3 Screen in game 2 shows the score rows at 18 px. Fold the night totals into the score rows, or page the standings and the gallery, to keep TV sizes (F50).
- Press feedback on live buttons: a motion-safe `:active` shrink (`not-disabled:active:scale-95`, as Buzzr), beyond the reactions' existing `active:scale-90` (B01, DECISIONS 75).
- Lobby doodle pad: Eraser and Clear, now that the 20 KB cap is the phone's own and a clear could free room locally (F55, DECISIONS 78).
