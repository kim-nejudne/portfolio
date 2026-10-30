# 01 — Landing and hosting

Covers `/` (Landing), the Host-a-game picker (`HostGame` + `SetBrowser` in select mode), `RoomCreated`, the in-game `NewGamePicker` and `GameBuilder`. Built by **F93**.

## What we saw

At 1440×900 the Landing page is a 448px column stuck to the top of the window, and the bottom 60% of the window is empty. Opening **Host a game** swaps the Join card for the picker. The picker is also 448px wide. Its set list is a 320px scroll box inside a page that also scrolls, so only about 2.5 sets show at a time. Titles are truncated ("Sample: General Kn…") even though the window has more than 900px of unused width. **Create room** sits below the list, so choosing a set further down means scrolling the box, then the page.

`RoomCreated` shows four stacked display-font buttons. At 448px their labels wrap to two lines ("Use this device as the / Screen"), and on a laptop they all talk about phones.

## Target layouts

**Phone (< 768px)**
- Keep the current single column.
- The picker's set list flows with the page (no inner box).
- A sticky bottom bar shows the selected set's title and **Create room**.
- Cancel becomes a "← Back" link at the top.

**Tablet (`md`)**
- Landing: hero on top, then **Join a game** and **Host a game** as two equal cards side by side, in `PageShell width="wide"`. The spec asks for "the same weight".
- The picker replaces both cards and takes the full shell width.
- The set list becomes a two-column grid.

**Desktop (`lg`+)**
- The picker becomes two panes:
  - **Left:** search, difficulty chips, and the category-grouped set grid, which scrolls with the page.
  - **Right:** a sticky summary of the selected set (title, category, difficulty, question count, the first 3 questions or a **Preview** button) with **Create room**, **Build a game** and **Back**.

```
lg+  ┌──────────────────────────────────────────────┬──────────────────────┐
     │ PICK A QUESTION SET           [search……]     │  Animals — Easy      │
     │ [Easy][Medium][Hard][None]                   │  15 questions · Easy │
     │ ANIMALS                                      │  Built-in            │
     │ ┌────────────┐ ┌────────────┐ ┌────────────┐ │  [ Preview ]         │
     │ │◉ Animals E │ │○ Animals M │ │○ Animals H │ │                      │
     │ └────────────┘ └────────────┘ └────────────┘ │  [  CREATE ROOM   ]  │
     │ GEOGRAPHY …                                  │  Build a game · Back │
     └──────────────────────────────────────────────┴──────────────────────┘
```

## Issues

### LND-01 · P2 · Tablet, desktop — Landing is a phone column; Join and Host are unequal

**Evidence:**
- `pages/Landing.tsx:22` uses `max-w-md` and is top-aligned with no `justify-center`.
- Join is a full `CARD` with a heading.
- Host is a single button (`Landing.tsx:34` vs `:65`).

**Recommendation:**
- `PageShell`, with the hero centred.
- At `md`, two equal cards in a `grid-cols-2`:
  - **Join a game:** code input and Join.
  - **Host a game:** a one-line pitch ("Questions on the TV, buzzers on everyone's phone"), then **Host a game**, then a **Question sets** link.
- Vertically centre the hero and the cards on tall viewports with `lg:min-h-dvh lg:justify-center`.

**Done when:**
- At 1440×900 the hero and both cards fill a centred block of 900–1100px, with no empty half-page.
- At 375px the page looks as it does today.

### LND-02 · P1 · All — The picker's set list is a 320px scroll box (Kim's screenshot)

**Evidence:**
- `components/HostGame.tsx:128` sets `listClassName="max-h-80 overflow-y-auto"`, which nests a scroll inside the scrolling page.
- Titles use `truncate` (`components/SetBrowser.tsx:117`).
- On a landscape phone (≈ 390px tall) the 320px box is taller than the space above the fold, so scroll gets trapped in it.

**Recommendation:**
- Remove the fixed height. The list scrolls with the page on every size.
- Make SetBrowser's select mode a container-query grid: 1 column below `@md`, 2 at `@2xl`, 3 at `@4xl`. The same component then works in the picker, the NewGamePicker dialog and `/sets`.
- Titles wrap to two lines (`line-clamp-2`) rather than truncate at one.

**Done when:**
- No `max-h-80` remains on the picker.
- At 1440×900 at least 9 sets are visible without scrolling, and no built-in title is truncated.

### LND-03 · P2 · All — Create room is far from the choice

**Evidence:** **Create room** is rendered after the list (`HostGame.tsx`). The selection only shows as a highlighted radio row inside the scroll box.

**Recommendation:**
- `lg`: a sticky right-hand summary pane, as in the sketch above.
- Phone and tablet: a sticky bottom bar (`sticky bottom-0`, safe-area padding) showing "**Animals — Easy** · 15 questions" and **Create room**.

**Done when:** **Create room** and the name of the selected set are always on screen while the list scrolls, at every matrix size.

### LND-04 · P3 · All — Build a game and Cancel are easy to miss

**Evidence:**
- Both are underlined text links (`HostGame.tsx:144-170`).
- Cancel has no `min-h` and is about 28px tall.
- Build a game sits between the error and Preview.

**Recommendation:**
- **Build a game** becomes a `BUTTON_OUTLINE` in the picker header (or the summary pane at `lg`), with a one-line hint: "Mix categories or make a category board".
- Cancel becomes a top-left "← Back" link of at least 44px.

**Done when:** both controls are at least 44px and visible without scrolling at 375×667.

### LND-05 · P2 · All — RoomCreated's four long buttons

**Evidence:**
- `components/RoomCreated.tsx:25,33,49,57`: `py-5 text-2xl` font-display buttons whose labels wrap to 2–3 lines at 375px.
- Labels such as "Use this phone as the host remote" appear on a laptop.

**Recommendation:**
- Turn the four buttons into option cards. Each card has an icon, a short Bungee title, and one DM Sans line of explanation:

  | Title | Explanation |
  |---|---|
  | **This is the Screen** | Show questions on this device |
  | **Screen elsewhere** | Open the Screen on a TV or laptop |
  | **Host remote** | Control the game from this phone |
  | **Phone only** | No TV: run everything from here |

- At `md`, show the cards as a 2×2 grid.
- Order and emphasis follow the pointer:
  - On `pointer-fine`, **This is the Screen** is the gold primary.
  - On `pointer-coarse`, **Host remote** and **Phone only** come first.
- The room code stays huge above the cards.

**Done when:**
- No option title wraps at 375px.
- At 1440×900 the four options fit in one view without scrolling.

### LND-06 · P1 · Landscape phone; P2 desktop — NewGamePicker clips at short heights and is narrow on desktop

**Evidence:**
- The dialog `components/NewGamePicker.tsx:182` (`max-h-full max-w-md flex-col`) has no `overflow-y-auto`.
- Only the list (`:240`) can shrink.
- At 667×375 the fixed parts (heading, search, chips, Keep scores, Start, Build, Cancel) are taller than the viewport, so the list collapses to 0 and the buttons fall off screen.
- "Keep scores" (`:161-170`) is a 20px checkbox in a label about 28px tall.

**Recommendation:**
- The dialog scrolls as a whole under `short:`.
- At `lg`, widen it to `max-w-5xl` and use the same two-pane layout as LND-02/03 (share the component with `HostGame`).
- "Keep scores" gets a 44px label row.

**Done when:**
- At 667×375 every NewGamePicker control can be reached by scrolling.
- At 1440×900 it matches the Landing picker.

### LND-07 · P2 · Tablet, desktop — GameBuilder is a stack of slabs

**Evidence:**
- Buttons are full-width and stacked (`components/GameBuilder.tsx:288-316`).
- The `problem` text appears above them (`:284`) but the run `error` appears below (`:304`).
- The Mixed / Board toggle is two `aria-pressed` buttons that look like normal buttons (`:170-186`).

**Recommendation:**
- Make the toggle a segmented control with a shared track and the selected segment filled, using `role="radiogroup"`.
- At `md`, put the actions in one inline row: **Host** primary, **Save as set** outline, **Back** link.
- Show `problem` and `error` in one message area above the actions.
- Rows of the mixed builder: at `md`, show category, difficulty and count on one line (they already use a grid; widen the template).

**Done when:**
- At 1440×900 the builder's actions fit on one row.
- All messages appear in one place.

### LND-08 · P3 · All — Disabled primary buttons look muddy

**Evidence:**
- `PRESS` in `lib/ui.ts` applies `disabled:opacity-40`.
- On gold, that renders as brown: the Landing **Join** button before a code is entered, and the picker's **Create room**.
- It reads as a different colour, not as "not yet".

**Recommendation:** A disabled `BUTTON_PRIMARY` uses `bg-edge text-muted`, with no opacity change. Leave other buttons on opacity.

**Done when:** a disabled primary button shows as indigo and muted with readable text (contrast ≥ 3:1), not as brown.

## Mapping

| Issue | Feature |
|---|---|
| LND-01 … LND-08 | F93 |
