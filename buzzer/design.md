# Design: Buzzr

The locked system. Every Hallmark run reads this first, and every screen shares it. Change it on purpose: this file is the rule. It replaces the 2026-10-28 "Prime Time" look (M31, `docs/ux/08-hallmark-redesign.md`).

## System

- Genre: playful
- Shape: app screens. Landing is the one page, and the Screen is a stage (see Variants)
- Theme: Squeeze (deal 2/3, seed quiz-night-game-show-buzzer-7620·5b3b31b5·2026-11-16·r0)
- Axes: mid/geometric-sans/warm · posture: drenched. The green is the whole surface on every screen

## Tokens

`client/src/tokens.css` is the source of truth. F132 maps these roles onto the Tailwind `@theme` names the code already uses (`bg` to paper, `surface` to paper-2, `bg-deep` to paper-3, `edge` to rule, `accent` to peach).

```css
:root {
  --color-paper: oklch(41% 0.1 154);
  --color-paper-2: oklch(47% 0.105 154);
  --color-paper-3: oklch(34% 0.09 156);
  --color-ink: oklch(99% 0.005 90);
  --color-ink-2: oklch(94% 0.02 120);
  --color-muted: oklch(90% 0.03 150);
  --color-rule: oklch(55% 0.1 154);
  --color-accent: oklch(83% 0.115 56);
  --color-accent-2: oklch(74% 0.15 46);
  --color-accent-ink: oklch(30% 0.07 40);
  --color-focus: oklch(88% 0.14 85);
  --color-card: oklch(97% 0.012 85);
  --color-card-ink: oklch(24% 0.05 160);
  --color-buzz: oklch(74% 0.16 25);
  --color-buzz-ink: oklch(24% 0.06 25);
  --color-win: oklch(89% 0.17 125);
  --color-win-ink: oklch(26% 0.06 140);
  --color-warn: oklch(86% 0.15 75);
  --font-display: 'Gabarito', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Manrope', ui-sans-serif, system-ui, sans-serif;
  --radius-card: 24px;
  --radius-control: 16px;
  --radius-pill: 999px;
  --rule-hair: 1px;
  --rule-bar: 2px;
  --shadow-card: 0 14px 32px -16px oklch(22% 0.05 160 / 0.5);
}
```

The scaffold owns the spacing scale, the app type scale (ratio 1.2), the easings and the durations, all in `tokens.css`. Fonts are self-hosted from `@fontsource/gabarito` (800) and `@fontsource/manrope` (500, 700), because a LAN game night makes no third-party request.

## Rules

- Gabarito 800 is for heads and figures only: room codes, scores, points, the timer. Labels, buttons, inputs, placeholders and data are Manrope. Sentence case, untracked, never uppercase.
- Tiles, not cards: a tile is paper-2 at `--radius-card`, with no border and no shadow. A chosen tile sinks to paper-3 and takes a 3px accent ring. There is no card inside a card.
- One raised surface per screen: the warm-white card (card, card-ink, `--shadow-card`). It holds what must read as paper: the join QR, a question's answer at reveal, the printed sheet.
- Peach marks the primary action, the current selection and focus hover, and nothing else. It is never type and never a field.
- Game states own the buzz, win and warn colours, and each always comes with its word ("Correct", "Wrong", "Too early"). They are never decoration.
- Player colours (`PLAYER_PALETTE`) sit inside a 2px ink ring. Red, blue, violet and magenta are under 3:1 on the green without one.
- Field edges are `--color-muted`, not `--color-rule`: rule on paper is 1.8:1, and a field needs 3:1.

## Controls

- Primary: peach fill, accent-ink text, `--radius-control`, 40px tall (app) and 56px (phone game controls), Manrope 700. Pressed: `translate: 0 1px` and accent-2.
- Secondary: a 2px ink outline, same radius and height. Danger: a 2px buzz outline, filled once confirmed.
- The buzzer is the one exception in size: round, peach while open. It turns buzz when you are first and paper-3 when locked.

## Motion

- Character: brisk, state only, at `--dur-micro` and `--dur-short` on `--ease-out`. There are no reveals and no decorative loops. Two state loops are waived on the record: the open buzzer's pulse and the generation shimmer. Under reduced motion everything ends at once.

## Variants

- **Screen (stage):** keeps its viewport-unit sizing and the `--screen-min-*` text floors (F100). The display steps are fluid here, not the app scale. The room code and scores are Gabarito figures at statement size.
- **Landing (page):** page scope, so its first screen holds a head, one sentence and the two actions (join and host).
- **Answer sheet (print):** card-ink on white paper, no green.

## Exports

`client/src/tokens.css` and `client/src/base.css` in this project, mapped into Tailwind v4 `@theme static` by F132 (`export-formats.md`, Tailwind v4).
