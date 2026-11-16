# Design: Buzzr

The locked system. Every Hallmark run reads this first, and every screen shares it. Change it on purpose: this file is the rule. It replaces the 2026-11-16 Squeeze look (M31) with Overprint (M32, `docs/ux/09-overprint-redesign.md`). The approved mocks are `.hallmark/mocks/overprint/index.html` (Landing, Screen lobby, phone buzzer) and `.hallmark/mocks/overprint/buzzers.html` (variant E, Lit, is the buzzer).

## System

- Genre: playful
- Shape: app screens. Landing is the one page, and the Screen is a stage (see Variants)
- Theme: Overprint (deal 1/3, seed quiz-night-game-show-buzzer-7620·5b3b31b5·2026-11-16·r0), stock: newsprint
- Axes: light/grotesk-heavy/cool · posture: full-palette. Grey newsprint, near-black ink, two flat passes (teal, orange) that print moss where they cross
- Kim's exception: the phone buzzer is a red, round, shaded 3D dome with a bulb under it (Controls). It is the only third ink, the only gradient and the only round control

## Tokens

`client/src/tokens.css` is the source of truth. F143 maps these roles onto the Tailwind `@theme` names the code already uses (`bg` to paper, `surface` to paper-2, `bg-deep` to paper-3, `edge` to rule, `accent` to the teal pass, `card` to paper-2 under an ink bar).

```css
:root {
  --color-paper: oklch(91.5% 0.014 92);
  --color-paper-2: oklch(87.5% 0.018 90);
  --color-paper-3: oklch(83% 0.021 88);
  --color-ink: oklch(17% 0.008 60);
  --color-ink-2: oklch(29% 0.01 60);
  --color-muted: oklch(42% 0.012 70);
  --color-rule: oklch(78% 0.02 85);
  --color-accent: oklch(65% 0.12 212); /* pass 1, teal */
  --color-accent-ink: oklch(17% 0.008 60);
  --color-accent-2: oklch(71% 0.19 50); /* pass 2, orange */
  --color-accent-2-ink: oklch(17% 0.008 60);
  --color-mix: oklch(35.5% 0.121 142); /* what the multiply prints where the passes cross */
  --color-focus: oklch(44% 0.1 220);
  --blend: multiply;
  /* The buzzer's red (Kim, 2026-11-16) */
  --color-buzz: oklch(56% 0.215 27);
  --color-buzz-hi: oklch(80% 0.12 30);
  --color-buzz-deep: oklch(40% 0.17 27);
  --color-buzz-wall: oklch(33% 0.14 27);
  --buzz-glow: oklch(88% 0.1 40 / 0.9);
  --buzz-glow-0: oklch(88% 0.1 40 / 0);
  --buzz-drop: oklch(17% 0.008 60 / 0.35);
  --font-display: 'Anybody Variable', 'Anybody', ui-sans-serif, sans-serif;
  --font-body: 'Archivo', ui-sans-serif, sans-serif;
  --font-outlier: 'Archivo Narrow', ui-sans-serif, sans-serif;
  --display-weight: 900;
  --display-stretch: 140%; /* figures 150% */
  --tracking-display: -0.01em;
  --radius-card: 0;
  --radius-control: 0;
  --radius-pill: 0;
  --rule-hair: 1px;
  --rule-bar: 4px;
  --shadow-card: none;
}
```

The scaffold owns the spacing scale, the easings and the durations. The app keeps Tailwind's own xs-3xl text steps (DECISIONS F132). Fonts are self-hosted from `@fontsource-variable/anybody` (the width axis), `@fontsource/archivo` (400, 600) and `@fontsource/archivo-narrow` (600), because a LAN game night makes no third-party request.

## Rules

- Anybody 900, set wide (140%, figures 150% with `tabular-nums`) and in capitals, is for heads and figures only: room codes, scores, points, the timer, BUZZ. Body, inputs and data are Archivo. Labels, captions, table heads and the small print are Archivo Narrow 600, sentence case, untracked.
- Everything coloured is pass 1 or pass 2: a flat fill at `mix-blend-mode: var(--blend)`. Where two passes cross the stock prints moss; no letter ever sits in the moss, and moss is never painted.
- Square and flat: radius 0, no shadow, no gradient, except the buzzer. Depth is overprint, never a lift.
- Rules: the 4px ink `--rule-bar` over a list, a table, a figure row or the nav; `--rule-hair` in `--color-rule` between rows.
- One paper surface per screen holds what must read as paper (the join QR, a question's answer at reveal, the printed sheet): paper-2 under the 4px ink bar, no lift.
- Game states each come with their word ("Correct", "Wrong", "Too early") and are never decoration: **buzz** is the red (first to buzz, wrong), **win** is the teal pass (correct), **warn** is the orange pass (too early, reconnecting).
- Player colours (`PLAYER_PALETTE`) sit inside a 2px ink ring, square everywhere but the buzzer's corner chip. Yellow, lime, sand, teal and pink are under 3:1 on newsprint without one.
- Field edges are a 2px inset ink outline (ink on newsprint is far past 3:1).

## Controls

- Primary: an ink block with paper type, Archivo Narrow 600 in capitals, untracked, square. Hover pulls it through the orange pass (accent-2 fill, ink type); on an orange field it pulls through teal. Press: ink-2. Disabled: transparent with a 2px ink-2 inset outline.
- Secondary: a 2px inset ink outline, ink type, same size. Danger: a 2px buzz-red outline, filled once confirmed.
- Links: ink, 2px ink underline, the underline orange on hover.
- Heights: 40px in app UI, 56px for phone game controls; the Screen's controls are sized in cqw for the sofa (waived in the stamp, 39b).
- **The buzzer** (variant E, Lit): a round red dome in a round ink base. The base never moves; only the cap translates (`--dur-micro`, `--ease-out`), 14px up at rest, 11px on hover, 2px on press. A bulb under the dome breathes (opacity 0.3 to 0.85, 1.1s alternate) while it takes a buzz and flares to 1 on the press. BUZZ is Anybody 900 at 150% in paper on the red. Per state, see `09` § The buzzer.

## Motion

- Character: the press does not tween, except the buzzer's cap. Hover swaps a pass at once; press darkens by an ink step. Nothing reveals, floats or loops, except the state loops waived on the record: the buzzer's bulb and the generation shimmer. Under reduced motion everything ends at once and the bulb holds at 0.6.

## Variants

- **Screen (stage):** keeps its viewport-unit sizing and the `--screen-min-*` text floors (F100). The room code is a figure on the teal pass; the players' orange pass crosses its lower edge, so the moss prints below the QR column. The Screen's stock is newsprint unless Kim picks the black stock before F146 (`09` § Open).
- **Landing (page):** page scope: BUZZR, one sentence, and the join (teal pass) and host (orange pass) fields crossing in moss.
- **Answer sheet (print):** ink on white paper, no passes.

## Exports

`client/src/tokens.css` and `client/src/base.css` in this project, mapped into Tailwind v4 `@theme static` by F143 (`export-formats.md`, Tailwind v4).
