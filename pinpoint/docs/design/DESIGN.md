# Pinpoint design reference

Build sessions follow this from F01. There are no mock files: the spec's words are the design reference ("No design mocks exist", Kim's spec prompt, 2026-11-07). This file extracts the spec's look into one place; `docs/spec.md` wins where the two disagree. Anything not covered here follows the nearest existing component, and a gap is recorded in `docs/DECISIONS.md`.

Source: `docs/spec.md`, sections "Look and tokens", "Landing page `/`", "Screen view `/screen/:code`", "Finale", "Player view `/play/:code`", "VIP controls", "Photos and credits", "Sound and haptics", "Admin". Admin layout: Buzzr's "Admin redesign (2026-11-03)" in `../buzzer/docs/DECISIONS.md` and `../buzzer/client/src/pages/Admin*.tsx` (read-only reference; copy, never import).

The look in one line: **an airport departures board**. Amber and warm white on near-black, split-flap letters, gate-style labels ("Round 9/10 · ×1.5 · Boarding"), boarding-pass cards as the one light surface.

## Tokens

Defined once as CSS custom properties (Tailwind 4 `@theme`) and, where the server or tests need them, in `shared/constants.ts`.

| Token | Value | Use | Contrast (measured) |
| --- | --- | --- | --- |
| `--board-bg` | `#0B0C0E` | Page background on every view | — |
| `--board-panel` | `#15171B` | Panels, rails, sheets, drawers | — |
| `--flap-bg` | `#1C1E22`, seam `#050506` 2 px across the middle | Each split-flap cell | — |
| `--amber` | `#FFB000` | Primary accent: flap text, gate labels, Lock in, VIP ★, focus ring | 10.7:1 on bg, 9.1:1 on flap |
| `--amber-dim` | `#8A6200` | Disabled accent only (3.6:1: never for readable text) | 3.6:1 on bg |
| `--text` | `#F2E9D8` | Body text | 16.2:1 on bg, 13.9:1 on flap |
| `--text-dim` | `#8C8578` | Secondary text, credits, inactive tab labels | 5.4:1 on bg, 4.9:1 on panel, 4.6:1 on flap |
| `--line` | `#2A2D33` | Dividers, card borders, tear lines (never text) | — |
| `--delayed` | `#FF4D4F` | "Delayed", last 5 s of the timer, errors, destructive buttons | 6.0:1 on bg |
| `--on-time` | `#3DDC84` | "Locked in", connected dot | 11.0:1 on bg |
| `--pass-bg` | `#F2E9D8`, text `#0B0C0E` | Boarding-pass cards | 16.2:1 |

Text on `--amber` (Lock in, primary buttons) is `--board-bg` (10.7:1). Amber text on `--pass-bg` is 1.5:1 and is never used: boarding passes use `--board-bg` text and the player's colour as a stripe only.

Player palette (12, first free slot, `shared/constants.ts`): `#56B4E9` `#E5603A` `#44BB99` `#FFAABB` `#4477EE` `#BBCC33` `#F2F2F2` `#CC6677` `#99DDFF` `#AA4499` `#EEDD88` `#9F7FE0`. `palette.test.ts` is the authority (spec "Look and tokens"); a list that fails is adjusted and the final list recorded in DECISIONS. Colour is never the only cue: every pin, tile and row also carries the player's emoji.

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px (the spec fixes 16 px phone margins and 48 px tap targets; the rest of the scale is this file's default). Radii: flap cells 6 px (Screen) / 4 px (phone); cards and sheets 16 px; buttons 12 px; boarding passes 14 px with two 12 px semicircle notches at the tear line and a dashed `--line` tear line. Shadows: none; depth comes from `--board-panel` over `--board-bg` and 1 px `--line` borders. One theme only (dark); no light mode.

Components use only these tokens: no literal colours, sizes or shadows outside them. The player palette and map colours (tiles, fallback tiles) are data, not theme tokens.

## Type

| Role | Face | Weight | Size / line height |
| --- | --- | --- | --- |
| Board face (flaps, gate labels, timers, distances, points, room code) | JetBrains Mono | 800 ExtraBold, uppercase, `font-variant-numeric: tabular-nums` | Screen: prompt glyph 64 px in 72 × 104 cells, gate label 40 px, timer 120 px, room code 200 px flaps, rail distance/points 32 px, scoreboard 36 px. Phone: prompt 20 px (shrinks to 14 px, then wraps to 2 lines). Line height 1 |
| Body face (sentences, forms, admin) | Inter (variable) | 400 body, 600 labels and buttons, 700 headings | Phone body 16 px / 1.5. Screen fact line 32 px, names 24–28 px, photo credit 22 px (smallest Screen text), map attribution 16 px. Phone map attribution 11 px |

Font loading: `@fontsource/jetbrains-mono` (800 only, latin subset) and `@fontsource-variable/inter` (latin), self-hosted woff2, `font-display: swap`. No font CDN at runtime, no other faces or weights.

## Components

Every interactive component has these states unless noted: default, hover (desktop only), focus-visible (2 px `--amber` outline, 2 px offset), active (pressed: 0.96 scale or darker fill), disabled (`--amber-dim` or `--text-dim` at reduced opacity, with the reason shown as text nearby where the spec gives one), loading (spinner or label "…", control disabled).

- **SplitFlap** (`client/src/components/SplitFlap.tsx`): a row of `--flap-bg` cells with a 2 px `#050506` seam across the middle, board-face glyphs in `--amber` (or `--text` for names). Animation: each cell cycles 6–14 glyphs from `A–Z 0–9 ·-` at 70 ms per glyph, cells start 25 ms apart left to right, a full prompt settles within 1.6 s; a character outside the set flips straight to itself on the last step. Sizes: prompt (72 × 104), gate label, timer digits, room code (200 px), wordmark, scoreboard names. Reduced motion: 150 ms fade. Used on: Landing wordmark, Screen lobby code, intro, guessing prompt, reveal name, scoreboard, finale awards, rematch and resume 3-2-1.
- **Gate label**: one line of board face, `--amber`, segments joined by " · " ("Round 3/10 · ×1.5 · Boarding"). States: Boarding, Final call (last 5 s), Delayed (`--delayed`, paused), Now boarding (intro). Rounds at ×1 show no multiplier segment.
- **Timer**: board-face flap digits, 120 px on the Screen, at the right of the phone prompt bar. Last 5 s: `--delayed`. Paused: stops and shows the remaining time. Rendered from `endsAt` with the server clock offset, never counted locally.
- **Player tile** (Screen): 128 × 128 px rounded square (16 px radius) bordered 4 px in the player's colour, emoji 64 px, name 24 px under it, ★ badge (amber) on the VIP. States: joined (pop in 300 ms), practice wiggle (600 ms), locked in (fill `--amber`, "LOCKED IN" label), disconnected (40% opacity, greyed), waiting (dashed border). Reduced motion: no pop, no wiggle (a 600 ms amber outline instead).
- **Boarding pass** (`BoardingPass.tsx`): `--pass-bg` card, `--board-bg` text, 14 px radius, two 12 px semicircle notches at the tear line, dashed `--line` tear, a 6 px stripe in the player's colour on the left edge, emoji and name top-left, board-face numbers. Variants: phone round result (distance, base points, multiplier when > ×1, round points, new total, rank, BULLSEYE / CLOSEST stamp), locked-in card ("Boarding · Locked in", timer, emoji still guessing, frozen 180 px mini map), waiting card ("Next departure"), finale pass (rank, total, best round, average distance). Flip: 500 ms 3D rotate on Y from a face-down card (the Pinpoint wordmark pattern on `--board-panel`); reduced motion: 150 ms fade.
- **Stamp**: rotated −8°, board face, 2 px border, `--delayed` for BULLSEYE on passes, `--amber` on the Screen rail; CLOSEST and NOT LOCKED IN in `--text-dim` on the rail.
- **Button**: primary (`--amber` fill, `--board-bg` text, 12 px radius, 600 weight), secondary (1 px `--line` border, `--text`), destructive (`--delayed` border and text), two-tap confirm ("Tap again to skip": the label changes, resets after 3 s). Phone: at least 48 × 48 px; Lock in is 64 px tall, full width minus 16 px margins. Lock in disabled while paused or already locked.
- **Segmented control** (Mode, Difficulty, Rounds, Timer): `--board-panel` track, selected segment `--amber` fill with `--board-bg` text, unselected `--text-dim` text. Unavailable options: `--amber-dim`, not focusable as a choice, reason shown under the control.
- **Category card** (VIP lobby picker): `--board-panel`, emoji, name, per-level place counts for the chosen mode, selected = 2 px `--amber` border; unavailable = dimmed with the reason. Search box above once there are more than 8.
- **Input**: `--board-panel` fill, 1 px `--line` border, 12 px radius, 48 px tall on phones, `--text`; focus 2 px `--amber` outline; error text in `--delayed` under the field. The room-code input auto-uppercases and uses board face.
- **Emoji grid** (join form): 24 emoji in a 6 × 4 grid of 48 px cells; selected = `--amber` ring; taken = 30% opacity, disabled.
- **Crosshair** (`Crosshair.tsx`): 44 px amber cross with an 8 px gap at its centre and a 2 px `--board-bg` outline, `pointer-events: none`, fixed at the map centre.
- **MapView** (`MapView.tsx`, `useLeafletMap`): Leaflet with tiles from `/api/config`, attribution always visible (11 px phone, 16 px Screen), "Simplified map" badge in a corner when on the fallback tiles, zoom buttons (+, − 48 px at the right edge) on phones. No page zoom, text selection or long-press menu on the map.
- **Pin marker** (`PinMarker.tsx`): teardrop 40 px (Screen) or 32 px (phone mini map) in the player's colour, 3 px `--board-bg` outline, emoji at 60% of the width inside; the tip is the exact position. Drop: 450 ms ease-out with a 4 px bounce; reduced motion: appears.
- **Target marker**: 28 px amber ring, 6 px amber dot, pulsing ring with a 1.2 s period (reduced motion: no pulse).
- **Geodesic line**: 3 px in the player's colour, 64 segments, draws 400 ms linear (reduced motion: appears).
- **Reveal rail row**: 72 px, rank chip, emoji, name 28 px, distance and points 32 px board face ("412 km"; one decimal under 10 km; "+812", then "×1.5 → 1,218"), tags. Ticks in with a 600 ms count-up (reduced motion: final number).
- **Scoreboard row**: 64 px, 36 px text, rank, emoji tile, name in flaps, round points, total, movement ▲2 / ▼1. Reorder: 600 ms slide.
- **VIP drawer**: bottom sheet on `--board-panel`, 16 px top radius, opened only by the ★ button, controls per phase (spec "VIP controls"). Closes on outside tap and Escape.
- **Top bar** (phone): emoji, name, total, rank ("3rd of 8"), connection dot (`--on-time` / `--amber` / `--delayed`), ★ VIP button, ⋯ menu (Change name in lobby, Leave game).
- **Toast**: `--board-panel`, 1 px `--amber` border, top of the phone, 3 s ("You're the VIP now ★").
- **Overlay**: full-screen `--board-bg` at 85% for "Click to start" (Screen), paused ("Delayed · the VIP paused the round" / "Waiting for the Screen…"), 3-2-1 countdowns in 200 px flaps.
- **Photo frame**: contained (never cropped) in 1500 × 820 px on the Screen with a 2 px `--line` frame and the credit line under it; 72 × 48 px thumbnail in the phone prompt bar that opens full screen with pinch zoom and a close button. "Photo unavailable" board-style card when the image fails.

## Screens

One section per screen in the spec, in flow order. There are no mocks; every layout below is the spec's.

### Landing `/`

- Layout: the "PINPOINT" wordmark as flaps, the line "Find it on the map. Closest pin wins.", then **Join a game** (code input + Join) and **Show a game on this screen** with the hint "Use the device everyone can see: a laptop on the TV." Side by side, equal weight, from 768 px; stacked below.
- States: unknown code ("No game with that code"), full room, network error. No link to `/admin`.

### Screen `/screen/:code` (1920 × 1080 design, scaled by `min(100vw / 1920, 100vh / 1080)`, letterboxed on `--board-bg`)

- Always: a 48 px strip along the bottom, "Join at pinpoint.kimnejudne.dev · code ABCD". Keys `M` (Sound / Quiet / Muted), `F` (fullscreen), `?` (key list).
- **Click to start** overlay first (unlocks audio, fullscreen, Wake Lock).
- **Lobby**: room code in 200 px flaps, QR to `/play/:code`, join URL as text, player tiles, the settings departures row ("WORLD · NAME · MIXED · 10 ROUNDS · 30 S"). Empty: "Waiting for the first player: they'll be the VIP".
- **Intro**: gate label large at the centre ("ROUND 3/10 · NOW BOARDING"), multiplier row under it on boosted rounds ("×1.5 BONUS ROUND", "×2 FINAL ROUND").
- **Guessing, Name**: gate label top left, timer top right, city name in prompt flaps at the centre (up to 22 cells × 2 rows), tiles along the bottom. No map, no pins.
- **Guessing, Picture**: as Name with the photo frame instead of the flaps, credit line under it.
- **Paused**: gate label "Delayed" in `--delayed`, timer stopped, banner "Delayed · the VIP paused the game"; 3-2-1 on resume.
- **Reveal**: top band with the place name in flaps and the fact line (Picture: 240 px thumbnail and full credit beside it); map 1340 px left, rail 580 px right; map non-interactive, fits target and pins with 80 px padding, max zoom 11. Missed players last on the rail with "—".
- **Scoreboard**: full-screen departures board, rows reorder with a 600 ms slide.
- **Finale**: podium (3rd at 0.6 s, 2nd at 1.8 s, 1st at 3.0 s), boarding passes from 5.0 s (150 ms apart, grid up to 4 × 3), awards from 8.0 s (one per 2.5 s, flap cards), photo-credits line in Picture mode, rematch 3-2-1 overlay. Zero rounds: "No rounds played".
- **Game ended**: "This game has ended" with a link home.

### Player `/play/:code` (phones 360–430 px wide; portrait)

- **Join form**: name (1–16), emoji grid, Join. Errors inline ("That name is taken", "This game is full (12 players)").
- **Lobby**: top bar; "Waiting for ★ Mika to start" or the VIP settings card; read-only settings row; practice map "Practice: find 0°, 0°" with crosshair and Lock in; result "1,240 km from 0°, 0°" for 3 s and **Try again**.
- **VIP lobby**: settings card (category cards, Mode, Difficulty, Rounds, Timer, Start ▶ full width with its disabled reason) above the practice map.
- **Intro**: "Round 3 of 10" (and the multiplier) over the map already on the region box, not interactive.
- **Guessing**: prompt bar 48 px (name, or thumbnail; timer at the right), map filling the space, crosshair, zoom buttons, Lock in 64 px at the bottom. Paused: map covered by the overlay, Lock in disabled.
- **Locked in**: locked-in boarding pass with the frozen mini map.
- **Reveal**: face-down card, flips to the result pass when the Screen reaches this player. Missed: "Missed this round · 0". No map.
- **Scoreboard**: the pass stays, new rank, "Next: Round 4 of 10".
- **Waiting**: "Next departure" card, "You're in from round 5. You start at 0."
- **Final**: own finale pass and awards. VIP drawer: Rematch (big), Back to lobby, Players; Cancel during the countdown.
- **Kicked**: "You were removed from this game" with a link home. **Room gone**: "This game has ended".

### Credits `/credits/:code`

- Plain list on `--board-bg`: thumbnail, place name, author, licence with its link, Commons file page link. Empty: "No photos revealed yet". Body face; the board face only for the heading.

### Admin `/admin` and below (desktop-first, Buzzr's admin redesign layout)

- Header: **Pinpoint Admin**, History, session end, Logout (a ⋯ menu below 1024 px). From 1024 px a list pane on the left (categories with level dots, counts, badges, search and filter chips, **Add category**) and the open page on the right; below 1024 px one pane at a time.
- Pages: dashboard overview, Generate (form, stepped progress per level, Cancel, failure actions), Category (box editor map with draggable corners and numeric fields, scale readout, label style, levels, Publish, Hide/Show, Delete, emoji), Level review (Cities / Landmarks tabs, place cards with 200 px mini map and 4:3 photo, Edit / Replace / Remove / Preview, warnings, Add a place / Add by name, sticky footer, keys J/K/E/R/Delete), History.
- Board tokens apply; boarding-pass cards are not used. Body face for everything except headings and numbers.
- States: sign-in (and "Admin is not configured" when the hash is unset: every `/api/admin` route 404s, the page says so), loading skeletons, empty list ("No categories yet: Add category"), generation off with its reason when the Anthropic key is unset.

## Targets

Viewports: phones 360 × 640, 390 × 844, 430 × 932 (portrait); Screen 1280 × 720, 1920 × 1080 (landscape, scaled from the 1920 × 1080 design); admin 1280 × 800 and 390 × 844. Browsers: current iOS Safari, current Android Chrome, desktop Chrome, Edge and Firefox (spec "Manual acceptance checklist"). Motion: durations as in Components (flap 70 ms per glyph, settle ≤ 1.6 s; pin 450 ms; line 400 ms; count-up 600 ms; flip 500 ms; slide 600 ms); `prefers-reduced-motion: reduce` turns flaps and flips into 150 ms fades, shows final numbers, drops pins without animation, stops pulses and wiggles.

## Definition of done for UI

- Matches the spec's structure and hierarchy at every target viewport, with no horizontal scroll (the Screen letterboxes instead of scrolling).
- Only tokens from this file; text contrast ≥ 4.5:1 (`--amber-dim` and `--line` never carry readable text).
- Every interactive element has a visible `--amber` focus ring and a ≥ 48 × 48 px target on phones.
- Empty, loading, error and paused states exist where the screen has them.
- `prefers-reduced-motion` honoured as above.
- Map attribution visible on every map, phones included.
- Readable from 5 m on the Screen: nothing smaller than 22 px at 1920 × 1080 except the 16 px map attribution.
