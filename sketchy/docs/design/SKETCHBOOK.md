# Sketchbook look (M12)

The build reference for F56–F67. Sketchy is restyled as a shared sketchbook left open on the coffee table: dot-grid pages, masking tape, a blue ballpoint, a yellow highlighter and red-pen corrections. **Light only.** A dark sketchbook is in the Backlog.

The target is the mockup, `docs/design/sketchbook.html`. Open it in a browser. The hash picks the phase: `#sketch-landing`, `-lobby`, `-choosing`, `-drawing`, `-close`, `-gotit`, `-reveal`, `-scoreboard`, `-final`. `O` toggles a landscape or portrait Screen. Its source sits inline: the concept is the `CONCEPTS.push({ id: 'sketch', … })` script, with every class prefixed `sk-`, and its CSS is the `css` template literal. To screenshot it, use Playwright on a `file://` URL.

The mockup is the target for the look and the layout. **The app's behaviour wins** wherever the mockup hard-codes something the app gets from data or from the spec. That covers px sizes (the Screen is sized in `vmin` with the spec's minimums), 2–12 players, Taglish lengths, settings, every phase and overlay the mockup doesn't show, timings, and the secrecy rules.

## Tokens

Define these once in `client/src/index.css` under `@theme` (F56), then use them as Tailwind colours (`bg-paper`, `text-ink`, `border-pen`, …). Never use a literal hex in a component.

| Token | Value | Use |
|---|---|---|
| `paper` | `#F8F8F3` | every page and sheet |
| `dot` | `#C3C7D2` | dot grid, dashed rules, ring track |
| `rule` | `#B9CBEA` | ruled lines (guesser page, word cards) |
| `margin` | `#E8978F` | the red margin line on ruled pages |
| `ink` | `#26282E` | text, outlines, hard shadows |
| `soft` | `#6A6E79` | secondary text, the drawer's small word |
| `pen` | `#2846C8` | ballpoint: underlines, guess line, send button, big ordinals, countdown ring |
| `red` | `#D2372C` | red pen: strikes, ✗, stamps, level tags, the low timer |
| `hl` | `#FFE14D` | highlighter swash, primary sketch button, sticky notes (`#FFF3A6`) |
| `amber` | `#FFB547` | "Jun is close!" on the drawer phone |
| `tape` | `rgb(236 222 170 / .82)` with `rgb(190 172 110 / .55)` dotted ends | masking tape |
| `ring` | `#6F737C` | spiral wire |
| `desk` | `#DCDFE6` | behind the Screen's notebook |
| canvas | `CANVAS_COLOR` (`#FFFFFF`) | the drawing stays pure white |

**Player colours:** 12 crayon colours (F56) replace `PLAYER_COLORS`. Each must reach ≥ 4.5:1 on `paper`, because names are written in them. Each must also stay distinct from the 8 draw colours. `BACKGROUND_COLOR` becomes `paper`. The mockup's five crayons (`#E0502A`, `#22925A`, `#2B66D2`, `#C23F92`, `#B9850E`) set the mood but are too light for text: darken them, then add seven more.

## Type

- **Patrick Hand** (one weight): everything said in words, including headings, names, copy, buttons, the feed and guesses.
- **Nunito 900**: every number and the room code. That covers the timer, scores, points, ranks, letter counts, the code cells, the blank tiles, and the revealed word on the Reveal.
- Both are self-hosted, using Google Fonts' own Latin-subset woff2 files (from the `/* latin */` block of the css2 API, as Fredoka was). Measured 2026-10-31: Patrick Hand 23.9 KB, Nunito 900 16.7 KB. They use `font-display: swap`, are preloaded by `index.html`, and keep their OFL texts in `client/src/fonts/`. F56 sets the CSS+font budget with Fredoka still counted; F67 drops Fredoka and tightens the budget.
- Fallbacks: `'Patrick Hand', 'Comic Sans MS', 'Chalkboard SE', cursive` and `'Nunito', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif`.
- Patrick Hand has no bold. Use `font-weight: 400` everywhere it appears, and get hierarchy from size alone.

## Primitives (F56, `client/src/components/sketch/`)

| Primitive | Technique (mockup class) |
|---|---|
| Dot-grid paper | `background-image: radial-gradient(circle, dot 1.1px, transparent 1.5px)` at 22–24 px (`.sk-phone.dots`, `.sk-l`). This is a flat pattern, not a gradient fill. |
| Ruled paper | Repeating 1 px `rule` lines every 34 px, plus a 2 px `margin` line at 46 px (`.sk-phone.ruled`). Text sits on the lines. |
| Spiral rings | A row of 12×26 px rounded rects (3 px `ring` border), half off the top edge, each with an 8 px hole in the page colour (`.sk-rings`). Phones get them across the top. The Screen spread has them vertical in a 34 px centre gutter in landscape, and horizontal in portrait. |
| Tape | A 74×22 px `tape` strip with dotted ends. Rotate it ±38° on corners and −3° when centred on top (`.sk-tape`). Use it on the Screen drawing, word cards, award notes, QR, the code strip and landing cards. **Never** on the drawer's pad. |
| Highlighter | An absolutely placed `::before` behind the text: `hl` at 85% opacity, uneven radius, rotated −1.2°. The text itself stays level (`.sk-hl`). |
| Hand-drawn border | `border: 2.5px solid ink; border-radius: 255px 18px 225px 18px / 18px 225px 18px 255px` (`.sk-btn`). |
| Sketch button | Hand-drawn border, `hl` fill, `box-shadow: 3px 4px 0 ink`, Patrick Hand at 22 px (28 px full width). The ghost variant is `paper` fill. Min height 48 px (60 px full width). The `:active` press collapses the shadow. |
| Avatar | Emoji on `paper` in a 2.5 px wobbly ring in the player's colour: `border-radius: 52% 48% 55% 45% / 47% 55% 45% 53%` (`.sk-av`). Sizes 34, 64 and 132 px, or the vmin equivalents on the Screen. |
| Blanks | Nunito 900 cells 1 em wide, each with a 0.14 em underline. Spaces are 0.6 em gaps. Letter counts `(5, 4)` come after, at 0.55 em in `soft` (`.sk-blanks`). Scale them down to stay on one line. |
| Countdown ring | SVG circle `r=16`, `pathLength=100`, track in `dot`, value in `pen`, with `stroke-dasharray: calc(left/total*100) 100`. It turns `red` at ≤ 10 s, except while choosing, where the total is 12 s. The number sits in the middle in Nunito 900 (`.sk-ring`). |
| Red-pen strike | A 2.5 px `red` line through the word, rotated −4° (the line only), then ✗ in `red` (`.sk-tried s::after`). |
| Stamp | Nunito 900 in `red` with a 3 px `red` border, `border-radius: 50%`, and a Patrick Hand caption under the number (`.sk-stamp`). |
| Index tab | The Screen's player chip: `paper`, 2 px `ink` border, a 10 px left edge in the player colour, rounded on the outer side, hard 3 px shadow (`.sk-tabs li`). It has its own portrait form (`border-top` in the player colour). |

Hard shadows are always offset `ink` with no blur. Nothing has a gradient fill, glass or blur.

## Surfaces

**Phones** (360×560 minimum; also check 390×664 and 412×780). Every phone page has spiral rings across the top.

- **Landing** (F57): logo "Sketchy" in Patrick Hand with a pen scribble underline. The tag line ends with "Laugh." on the highlighter. Two taped cards follow: Join, with the code as 4 Nunito cells on `pen` underlines plus a Join sketch button; and Start, a ghost button on a faint `hl` card. On a laptop: two columns, with the umbrella drawing replaying on the left.
- **Lobby** (F58): the guest page is ruled. It shows the avatar (64 px) with "You're in, Jun!", the waiting line with the host's name in colour and the Change avatar affordance, a row of avatars plus the count, and the doodle pad (dashed `soft` border) with its note. Leave sits underlined at the bottom. The host page has a dot grid: "Room KPRW" as an eyebrow, "You're the host 👑", a roster on dashed rules, a full-width Start sketch button, and the settings line with an underlined "Change".
- **Drawer** (F59): Choosing has the heading plus a 58 px countdown ring, then three ruled index cards with tape, a red-pen level tag at top right, the word at 34 px and the gloss in `soft`, then the rule line. Drawing has a dot grid and an exact 56 px top bar. Row 1: the word at 16 px in `soft`, the Nunito timer at 20 px, "N of 4 got it", and the 👑 Host pill. Row 2: the latest wrong guess, or "Jun is close!" on an `amber` or `hl` swash. Below that comes the pad (2 px `ink` border, 3 px hard shadow, no tape), then two 48 px rows. Row 1 holds 8 crayon swatches (40 px, wobbly, 2.5 px `ink` ring; the active one gets an outline). Row 2 holds Size (a dot plus S/M/L), Eraser, Undo and Clear, each hand-bordered with a pen icon.
- **Guesser** (F60): a ruled page with a red margin, and text starting right of the margin. The top line is the timer in Nunito 24 px and "✏️ Mika drawing". Under it come the blanks, then the guess line: a 3 px `pen` underline, a blinking caret and a round `pen` send button, kept near the top. Then the "So close!" toast with the highlighter, then tries written on the lines. A wrong try is struck through with a red ✗; a close one is circled "close!". At the bottom: "👀 Watch the Screen". This turn's points go in the left margin in `red` Nunito. Got it: a big ✓ in the success colour, "Got it!" at 44 px, a +points stamp and never the word, then the reaction buttons (56 px wobbly circles).
- **Results** (F61): Reveal shows "It was…", the word in Nunito 900 at 52 px on the highlighter, then a big stamp ("+320 / for your drawing", or "+270 / this turn"), and the got-it rows for the drawer. Scoreboard shows the ordinal at 96 px in `pen` with a superscript suffix, the score, and the ranked list with your row highlighted. Final shows the award on a taped sticky note (`#FFF3A6`), then rank and score, "See the gallery on the Screen", and the host's Rematch with "Back to lobby" underlined. Overlays (paused, rematch, host drawer) sit on a `paper` sheet or veil, never dark.

**Screen** (sized in `vmin` with the spec's minimums; mockup px are for a 1280×720 or 768×1024 frame)

- **Frame** (F62): a `desk` background. On it sits the notebook: `paper`, 2 px `ink` border, `6px 7px 0 ink` shadow. Landscape is a spread: the left page is a square, then a 34 px gutter with vertical rings, then the right page. Portrait stacks: page, horizontal rings, page. The room code sits on a tape strip centred under the book in Nunito: `sketchy.kimnejudne.dev · KPRW`.
- **Players** (F62, F64): index tabs, in turn order. In landscape they stand in a column outside the book's right edge, about 150 px wide. In portrait they run along the bottom as equal-width tabs. A tab holds the avatar, the name (≥ 3.5 vh), ✏️ for the drawer, and "✓ +270" in the success colour after a correct guess. Bubbles pop from a tab toward the right page (never over the drawing) with a border in the guesser's colour. Reactions float up from the tab.
- **Lobby** (F62): left page has the logo, "Join at …", the code as 4 Nunito cells on `pen` underlines with the taped QR beside them, and How-to-play numbered in pen circles. The right page holds "Who's here", the hosting line, the settings line and Start (host token) or the waiting line.
- **Host UI** (F63): the control bar is a taped strip along the bottom edge. Settings, custom words and players are dot-grid sheets with sketch buttons and hand-bordered inputs. The `?` overlay is a ruled index card.
- **Turn** (F64): the drawing is taped onto the left page by two corners. The right page has the Nunito clock (64 px on the frame; `red` at ≤ 10 s), "Round 2/2 · Turn 3/5" in `soft`, the blanks, "✏️ Mika is drawing", the "Jun got it!" highlighter banner, and the feed on dashed rules at the bottom. Choosing shows the drawer's avatar at 132 px, "Mika is choosing a word…" with the name in colour, and the countdown ring.
- **Portrait** (F65): during a turn the right page becomes a top bar over the square. It holds the timer, blanks, drawer line and latest guess. Round and turn are dropped, per the spec's portrait priority.
- **Reveal** (F65): "It was…", the word in Nunito 900 on the highlighter (the largest text, ≥ 12 vh), "Got it" rows, "Almost:" struck in red, "+320 for Mika's drawing" (only when above 0), and "Next: Jun draws".
- **Scoreboard / Final** (F66): the scoreboard is one full dot-grid page with "Round 1 of 2 done". Each row has the rank, avatar, name, a crayon bar in a hand-bordered track, the score, and ↑n/↓n in the success colour or `red`. The final has a drawn podium (crayon blocks with `ink` borders and hard shadows, 2-1-3), then 4th and later on one line, the gallery as taped white sheets with captions, award sticky notes, and Rematch / Back to lobby sketch buttons.

## Motion

The mockup's look replaces the F34/F35 effects. **Triggers, durations and caps stay as the spec says.** Under `prefers-reduced-motion`, use a fade or nothing.

| Mockup keyframe | Look | Used for (spec timing) |
|---|---|---|
| `sk-pop` | scale .5 → 1.06 → 1, `cubic-bezier(.2,.9,.3,1.3)` | got-it panel, "Jun got it!" banner (2 s), reveal word, toasts, the latest feed line |
| `sk-bubble` | scale .6 → 1, hold, fade | wrong-guess bubbles from tabs (2 s, max 3) |
| `sk-float` | rise about 90 px and fade | reactions from tabs (F34 timing) |
| `sk-move` and `sk-grow` | rows slide from their old rank; bars grow from 0 | scoreboard reorder |
| `sk-rise` | blocks rise 60 px with an overshoot, 2nd then 3rd then 1st | podium |
| `sk-blink` | 1 s steps | the guess caret |
| ink replay | strokes draw on | landing laptop only (the live canvas draws real ink) |

## Definition of done (every M12 feature)

- Its surfaces match the look and layout of `sketchbook.html` for the phases it names. Where the two differ, the app's data and the spec's rules win. A deliberate difference gets a DECISIONS row.
- The files it touches use only F56 tokens: no `#1D1B22`, `#FF6B35`, `#FFD166` or `white/NN` classes, and no literal hex values in components.
- No overflow or scroll at the viewports it names. For phones that is at least 360×560, 390×664 and 412×780. For the Screen it is 16:9 and 4:3 landscape plus 3:4 portrait.
- `/playtest` screenshots of its surfaces sit side by side with the mockup's (Playwright on `file://…/docs/design/sketchbook.html#sketch-<phase>`), and the PROGRESS entry names what still differs.
- The `mobile-ux-reviewer` has run, and its Must-fixes are done.
- No game behaviour, copy key, timing or invariant changes, except copy a mockup element needs (both languages, plus a Kim check for the Taglish).

## Rules

- Only decoration rotates: tape, the highlighter swash, the scribble, the strike line. Gameplay text (timer, blanks, scores, names in lists, guesses) is always level.
- No gradient fills, glass or blur. CSS gradients appear only as flat patterns (dots, ruled lines).
- Player names reach ≥ 4.5:1 on `paper`. Secondary text uses `soft`.
- The drawing canvas stays `CANVAS_COLOR` white. The drawer's pad has no tape over it.
- Copy comes from `copy.ts`. Add a line only when a mockup element needs it, in both languages, with the Taglish queued as a Kim check.
- The invariants are untouched. This is a visual change only.
