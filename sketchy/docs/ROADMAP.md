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

- [ ] F55 Lobby doodle stays on the phone
  - Spec: Drawing data protocol (Lobby doodles); Data model (Room state); DECISIONS "Proposed spec changes" 2026-10-31
  - Depends: F53
  - Done when:
    - `doodle:batch`, the InkStore doodles, the `doodle` relay, `doodles` in `ink:snapshot`, `sys:doodle`, `hasDoodle`, the `doodleDrop` effect, `client/src/lib/doodles.ts`, the Screen's doodle wiring and `drawStroke`/`redrawPicture`'s `lineScale` (doodle avatars only) are gone; `/ink` refuses `doodle:batch`
    - `DoodlePad` draws and undoes locally with its sessionStorage stack and a local size cap, sends nothing; copy "Warm up: doodle while you wait!" in both languages (supersedes DECISIONS 50, Phone pad)
    - `npm run mem:probe` and `npm run size` re-run
  - Tests: removed-behaviour tests deleted (listed in PROGRESS); `/ink` refuses `doodle:batch`; no doodle in a Screen snapshot; the pad works offline of `/ink`

## Bugs

- [x] B01 Pointer cursor and hover on live controls

## Backlog

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
