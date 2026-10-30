# 04 — Player

Covers `/play/:code` (`pages/Play.tsx`): the join form, the in-room `Buzzer` shell and its states (lobby practice, get ready, open, pressed, won, lost, locked out, too early, choice, typed, revealed, final), the menu and the rename overlay. Built by **F96** (phone and short screens) and **F97** (tablet and desktop).

## What we saw

**Phone portrait:** this layout is good, and it is the baseline to protect. One big circular buzzer, a slim top bar, and the status above the buzzer.

**Laptop (1440×900):**
- The top bar runs across the whole window, with the avatar at the far left and the score and menu at the far right.
- The buzzer is capped at 290px in the middle of a large empty stage.
- The lobby's Who's-here bar runs edge to edge along the bottom.
- The copy says "Tap to test your buzzer".
- In the won state, the "You're first! Answer now" panel and the dead buzzer float about 200px apart.

**Landscape phone (667×375):**
- The stage is `h-dvh overflow-hidden`, and nearly every child is `shrink-0`.
- The lobby adds up to about 460px of content in about 375px of height, so content is clipped with no scroll.
- The Final screen and the typed-answer form can clip the same way.

## Target layouts

**Phone portrait (base):** unchanged, apart from the fixes in PLY-05 and PLY-06.

**Short screens (`short:`, landscape phones):** a two-column stage.
- **Left:** bulbs, status and countdowns.
- **Right:** the buzzer, sized by height.
- Who's here collapses to a "5 here ▾" pill.
- Final, Typed and Rename may scroll.

```
short  ┌ A Audit · Room GCDS ─────────────────── 1st · 0  ⋮ ┐
       │  ● ● ● ● ●                      ╭──────────╮        │
       │  YOU'RE FIRST!                 │   BUZZ   │        │
       │  Answer now · 7 s              ╰──────────╯        │
       └────────────────────────────────────────────────────┘
```

**Tablet and desktop (`md`+):**
- A centred shell, `max-w-2xl`, that contains the top bar, the stage and Who's here, so nothing sits at the window edges.
- On `lg`, the shell can sit on a subtle surface panel with rounded corners: a "device" framing that makes a desktop player look intentional.
- The buzzer grows to about 400px.
- Choices are a 2×2 grid that mirrors the Screen.
- The copy changes for a mouse.

## Issues: phone and short screens (F96)

### PLY-01 · P1 · Landscape phone — The lobby and live stages clip

**Evidence:**
- `Play.tsx:631`: `h-dvh … overflow-hidden`.
- The buzzer is `size-[min(290px,78vw,40dvh)] shrink-0` (`:815`).
- The `WhosHere` card is `shrink-0 max-h-[24dvh]` (`:1087`).
- The countdown rows (`:830-854`) are also `shrink-0`.

**Recommendation:**
- Under `short:`, the middle region becomes `flex-row`: status column on the left, buzzer on the right.
- The buzzer is sized `short:size-[min(70dvh,42vw)]`.
- WhosHere collapses to a count pill that opens the list as a popover.

**Done when:** at 667×375, in the lobby, open, won-with-countdown and locked-out states, nothing is clipped and the buzzer is at least 200px.

### PLY-02 · P1 · Landscape phone — The final screen clips Share

**Evidence:**
- The Final `section` (`Play.tsx:736-781`) stacks bulbs, rank (`text-6xl`), points, the team and Tonight blocks, and Share (`:778`). It totals more than 450px.
- The section sits in the non-scrolling stage.

**Recommendation:**
- The Final section is `overflow-y-auto`, or the stage switches to `min-h-dvh` in FINAL.
- Under `short:`, rank and points sit side by side.

**Done when:** at 667×375, **Share results** can be reached.

### PLY-03 · P1 · Landscape phone — The typed answer is buried by the keyboard

**Evidence:**
- `TypedAnswer` (`Play.tsx:960-991`) is `shrink-0`, and it sits under the header, bulbs and status.
- With the keyboard open, almost no height is left.

**Recommendation:**
- While the input has focus under `short:`, hide the bulbs and shrink the status to one line.
- The form sits at the top of the stage.
- Call `scrollIntoView({block: 'nearest'})` on focus.

**Done when:** at 667×375 with the on-screen keyboard (or a 667×200 viewport as a stand-in), the input and **Send** are visible.

### PLY-04 · P2 · Landscape phone — The choice list shows about 1.5 rows

**Evidence:** `ChoiceButtons` `ol` (`Play.tsx:884`) is `min-h-0 shrink overflow-y-auto`. It shrinks to whatever height is left, and the inner scroll is easy to miss.

**Recommendation:** Under `short:`, show the choices as a 2×2 grid at `min-h-14`. Four choices then fit in about 140px.

**Done when:** at 667×375, all four choices are visible without scrolling.

### PLY-05 · P2 · Phone — The rename overlay doesn't scroll with the keyboard open

**Evidence:** The `RenameForm` overlay (`Play.tsx:1027`) is `fixed inset-0 flex items-center justify-center` with no overflow, so **Save** can be pushed off screen.

**Recommendation:** `overflow-y-auto`, with `items-start` and top padding under `short:`.

**Done when:** at 667×375, with the input focused, Save can be reached.

### PLY-06 · P2 · Small phone — The avatar picker cells are under 44px

**Evidence:**
- `grid grid-cols-6 gap-2` (`Play.tsx:299`): cells are about 41px at 375px and about 34px at 320px.
- The header team, room and "of N" lines are 13px (`:653,663,674`); see FND-04.

**Recommendation:** `grid-cols-5 min-[400px]:grid-cols-6`.

**Done when:** every avatar cell is at least 44px at 320px and 375px.

## Issues: tablet and desktop (F97)

### PLY-07 · P2 · Tablet, desktop — Full-bleed top bar and Who's here around a narrow centre

**Evidence:**
- `Buzzer` (`Play.tsx:630-861`) has no max-width. The header (`:632`) and `WhosHere` (`:1087`, `mx-4`) span the whole window.
- The content is a `max-w-sm` column.

**Recommendation:**
- At `md`, wrap the shell in `mx-auto w-full max-w-2xl`.
- At `lg`, frame the shell: `my-6 rounded-[28px] border-2 border-edge bg-surface/40` with `h-[calc(100dvh-3rem)]`.
- The page background stays `bg`.

**Spec note:** "the whole viewport is one circular button" becomes "the stage is one button". Space and a press anywhere on the stage still buzz. Record this in DECISIONS.

**Done when:** at 1440×900, the top bar, stage and Who's here line up inside one centred frame.

### PLY-08 · P2 · Tablet, desktop — The buzzer is capped at 290px

**Evidence:**
- `size-[min(290px,78vw,40dvh)]` (`Play.tsx:815`).
- The label is `text-[min(60px,20vw,8dvh)]`.

**Recommendation:**
- `md:size-[min(400px,60vw,50dvh)]`, with the label scaled to match.
- Keep the ring and border proportions.

**Done when:** at 820×1180 and 1440×900, the buzzer is between 360 and 400px.

### PLY-09 · P2 · Tablet, desktop — Choices are a one-column list

**Evidence:** `ChoiceButtons` is `max-w-sm` with one column (`Play.tsx:884-925`). The Screen shows the same choices as a 2×2 grid.

**Recommendation:**
- At `md`, use a 2×2 grid in `max-w-2xl`.
- Each tile carries the same letter disc colour as the Screen (`CHOICE_COLORS`), so players match what they see on the TV.
- The "Your pick" badge and the reveal ring stay.

**Done when:** at 820×1180, the choice layout matches the Screen's A/B over C/D.

### PLY-10 · P3 · Desktop — Copy and hints assume touch

**Evidence:** `tapToTest` (`lib/copy.ts:12`) shows on a mouse. Nothing tells a desktop player that **Space** buzzes.

**Recommendation:**
- Apply FND-08 (`clickToTest`).
- On `pointer-fine`, show a small `Space` key hint under the buzzer in the lobby and while buzzers are open.

**Done when:** at 1440×900, the lobby reads "Click or press Space to test your buzzer". Taglish copy is added for both strings.

### PLY-11 · P3 · Desktop — No hover feedback, and the menu is cramped

**Evidence:**
- The choice buttons, avatar cells and menu items have no hover state.
- The menu popover is `w-60` (`Play.tsx:710-730`). When armed, **Leave game** shows Confirm and Cancel side by side in about 210px.

**Recommendation:**
- Apply FND-06.
- Make the menu `w-72`.
- When armed, stack Confirm and Cancel full-width.

**Done when:** every interactive element on the Player responds to hover, and the armed Leave fits on one line per button.

## Mapping

| Issue | Feature |
|---|---|
| PLY-01 … PLY-06 | F96 |
| PLY-07 … PLY-11 | F97 |
