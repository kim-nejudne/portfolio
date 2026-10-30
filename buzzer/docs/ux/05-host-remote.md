# 05 — Host remote

Covers `/host/:code` (`pages/Host.tsx`) and its parts: header, tablist, Game tab (`QuestionCard`, `HostBoard`, `ChoiceTally`, `TypedMarking`, `PrimaryAction`, `SecondaryActions`, `PairHostPhone`, `ReadAloud`), Players tab (`HostPlayers`), Settings tab (`HostSettings`), `HostPinEntry` and the in-game `NewGamePicker`. Built by **F98** (phone) and **F99** (tablet and desktop).

The spec says "Phone-first layout". The phone stays the baseline. The tablet and desktop layouts are layers on top.

## What we saw

**Phone:** the remote works, but the important controls move around.
- The Game tab stacks the question card, then the board, choice tally or typed marking, then the primary action.
- With an image or a typed-answer list, **Open buzzers**, Correct / Half / Wrong and **Next** scroll below the fold.
- The tabs scroll away with the page.
- End game is a tile in the same grid as Undo and Scoreboard.

**Tablet and laptop (820×1180, 1440×900):**
- The remote is the same 448px strip in the middle of the window.
- Players and Settings are hidden behind tabs, even though there is room to show everything at once.
- The judging panel is a small block at the top of a mostly empty page.

## Target layouts

**Phone (base):**
- A compact header: room, players count, question pill.
- A sticky tablist under it.
- The tab content scrolls.
- A **sticky bottom action bar** that always holds the current primary action. During judging, that is the red panel with Correct / Half / Wrong and the countdown.
- Secondary actions sit above the bar, in the scrolling content. **End game** is set apart.

```
phone ┌ HOST · GCDS · 3 players          Q1/10 ┐
      │ [ Game ][ Players 3 ][ Settings ]      │  ← sticky
      │ QUESTION 1 OF 10              100 PTS  │
      │ What is the largest planet…            │
      │ ANSWER  JUPITER                        │
      │ [Skip] [Undo] [Prev] [Scoreboard]      │
      │ ─────────────── End game (red) ──────── │
      ├────────────────────────────────────────┤
      │ BUZZED FIRST  AUDIT                    │  ← sticky bottom
      │ [✓ Correct] [½ Half] [✕ Wrong]  7 s    │
      └────────────────────────────────────────┘
```

**Tablet (`md`):**
- `max-w-2xl`, with the same structure as the phone.
- The secondary actions go in one row.
- Settings rows sit in two columns.

**Desktop (`lg`+):** a dashboard with no tabs. The page is `PageShell width="wide"`.

| Column | Width | Contents |
|---|---|---|
| Left | 3/5 | The Game column: question card (larger type, image beside the text), board, tally or marking, primary action, secondary actions. |
| Right | 2/5 | Players, always visible, then Settings in a collapsible section. |

```
lg+  HOST CONTROLS · Room GCDS · 3 players                     Q1/10   Read aloud
     ┌──────────────────────────────────────┐ ┌──────────────────────────────┐
     │ QUESTION 1 OF 10            100 PTS  │ │ PLAYERS (3)                  │
     │ What is the largest planet in our…   │ │ ● Audit      online     200  │
     │ ANSWER  JUPITER                      │ │   [−100][+100][Custom]   ⋯   │
     ├──────────────────────────────────────┤ │ ● Kim        online     100  │
     │ BUZZED FIRST  AUDIT                  │ │ …                            │
     │ [✓ Correct] [½ Half] [✕ Wrong]   7 s │ ├──────────────────────────────┤
     ├──────────────────────────────────────┤ │ SETTINGS ▾                   │
     │ [Skip] [Undo] [Prev] [Scoreboard]    │ │ Answer time   [−]  OFF  [+]  │
     │                         End game     │ │ …                            │
     └──────────────────────────────────────┘ └──────────────────────────────┘
```

## Issues: phone (F98)

### HST-01 · P1 · Phone — The primary action scrolls below the fold

**Evidence:**
- On the Game tab, the stack is: `QuestionCard` (image `max-h-48`, `Host.tsx:380`), `HostBoard`, `ChoiceTally`, `TypedMarking`, then `PrimaryAction`.
- With an image, or a typed question with several groups, the action that runs the game is off screen.

**Recommendation:**
- Move `PrimaryAction` into a sticky bottom bar on the Game tab: `sticky bottom-0`, `bg-bg/95`, top border, `pb-[env(safe-area-inset-bottom)]`.
- The judging panel (buzzed name, judge buttons, countdown) lives in the bar.
- **AlsoBuzzed** stays in the content above.

**Done when:** at 375×667, in every phase (lobby, question with image, open, judging, reveal, typed marking, board, final), the primary action is visible without scrolling.

### HST-02 · P2 · Phone — The tabs scroll away

**Evidence:** The tablist (`Host.tsx:200-230`) is in the normal flow.

**Recommendation:**
- Make the header compact (one line).
- Make the tablist `sticky top-0 z-10` with a solid background.

**Done when:** after scrolling the Players list, the tabs are still visible.

### HST-03 · P2 · Phone — End game sits among harmless actions

**Evidence:**
- `SecondaryActions.tsx:72-84`: End game uses the same `small` tile as Undo and Scoreboard.
- When armed it becomes `col-span-2`, which reflows the grid.
- With 3–5 tiles, cells are left empty.

**Recommendation:**
- Secondary actions become one row of equal tiles: Skip, Undo, Previous, Scoreboard (`grid-cols-4`, or `grid-cols-2` below 360px).
- **End game** is a separate `BUTTON_DANGER` row below them (FND-07). It confirms in place without reflowing the tiles above.
- Tile labels are 14px (FND-04).

**Done when:**
- Arming End game does not move any other control.
- No empty grid cells are left in any phase.

### HST-04 · P2 · Phone — Player rows are crowded, and Kick sits beside the score buttons

**Evidence:**
- `HostPlayers.tsx:156-172`, line 1: dot, avatar, name, "online · 123 ms" and score in about 330px. Names get truncated hard.
- Line 2 (`:173-229`): −N, +N, Custom, the team select and Kick. Kick sits right after the score buttons, and arming it wraps the row again.

**Recommendation:**
- **Line 1:** avatar with a status dot, name (allowed to wrap to 2 lines), score.
- **Line 2:** status text at 14px, then −N, +N and Custom on the right.
- The team select and **Kick** move into a `⋯` menu per row, with Kick last and in red.

**Done when:**
- At 375px a 16-character name shows in full.
- Kick is never next to a score button.

### HST-05 · P2 · Phone — Settings rows squeeze the label

**Evidence:**
- `HostSettings.tsx:22-31,184-217,309-337`: two `size-12` steppers, a `w-16` value, `gap-3` and `p-4` leave about 120px for label and detail, and the detail wraps over 3–5 lines.
- The Presets row (`:116-132`) and Language row (`:248-264`) leave about 90px, and "Competitive" can overflow.

**Recommendation:**
- Make the row a container (`@container`).
- Below `@sm` (about 384px), stack the controls under the label and detail, aligned right.
- The `SIZES.compact` map that the Screen uses stays as it is.

**Done when:**
- At 375px no label or detail wraps beyond 2 lines.
- No preset button overflows.

### HST-06 · P2 · Small phone — The read-aloud room code overflows

**Evidence:** `ReadAloud.tsx:33`: `text-6xl tracking-[0.2em]`. Four Bungee characters come to about 265px, against about 291px of usable width, so the code overflows at 320px.

**Recommendation:** `text-[clamp(2.5rem,16vw,3.75rem)]`.

**Done when:** at 320px the code fits inside its card.

### HST-07 · P3 · Phone and desktop — Small labels and no hover feedback

**Evidence:**
- No `HOVER` on: tabs (`Host.tsx:225`), secondary tiles (`SecondaryActions.tsx:14`), player buttons (`HostPlayers.tsx:15`), judge buttons (`PrimaryAction.tsx:26`) and board tiles (`HostBoard.tsx:42`).
- Played board tiles use `opacity-30` (`HostBoard.tsx:44`) and are barely readable.

**Recommendation:**
- Apply FND-04 and FND-06.
- Played tiles become `text-muted` with a strike or a ✓, not 30% opacity.

**Done when:** every remote button has a hover state on `pointer-fine`, and played tiles pass 3:1 contrast.

### HST-08 · P3 · Phone — Pairing and read-aloud details

**Evidence:**
- `HostPinEntry.tsx:38` is vertically centred (`min-h-dvh justify-center`), so the iOS keyboard can cover **Pair**.
- The **Read aloud** toggle in the header (`Host.tsx:190-197`) has no hint of what it does.

**Recommendation:**
- PIN entry is top-aligned under `short:` and on coarse pointers.
- Read aloud gets `aria-describedby` and a one-line hint the first time it is shown ("Big question text, answer covered").

**Done when:** at 375×667 with the keyboard open, Pair is visible.

## Issues: tablet and desktop (F99)

### HST-09 · P2 · Desktop — The remote is a phone strip; tabs hide each other

**Evidence:**
- `Host.tsx:177` uses `max-w-md` at every width.
- Game, Players and Settings are exclusive tabs (`:200-281`).

**Recommendation:**
- At `lg`, use the two-column dashboard in the sketch above. Tabs are hidden (`lg:hidden`), and Players and Settings render in the right column.
- The question card uses larger type (`lg:text-2xl`) and puts the image beside the text.
- Settings are collapsible and closed by default once the game has started.
- The primary action is no longer sticky at `lg`. It sits in the Game column, which is always in view.

**Spec note:** the phone layout stays the spec's "phone-first" baseline. Record the dashboard in DECISIONS.

**Done when:**
- At 1440×900 the host can judge, adjust a score and change a setting without switching tabs or scrolling.
- At 375px nothing changes from F98.

### HST-10 · P2 · Tablet — A narrow strip on an 820px screen

**Evidence:** The same `max-w-md` at 820×1180, with about 370px unused.

**Recommendation:**
- At `md`, use `max-w-2xl`. Keep the tabs and the sticky bars from F98.
- Secondary actions go in one row.
- Settings rows sit in a two-column grid.
- The Players list shows the actions inline, with no second line.

**Done when:** at 820×1180 the remote fills a 672px column and each player row is one line.

### HST-11 · P3 · Desktop — No keyboard shortcuts on a laptop remote

**Evidence:**
- The Screen's host controls have shortcuts: Space, C, V, X, R, N, ←, S, U (`ScreenHostControls.tsx`).
- A host who opens the remote on a laptop beside the TV has to click every action.

**Recommendation:**
- On `pointer-fine` at `lg`, the remote accepts the same keys, routed to the same host actions.
- Key hints show on the buttons, as on the Screen bar.
- Reuse the Screen's key map; do not write a second one.
- The keys are disabled while typing in an input.

**Done when:** at 1440×900, Space opens buzzers and C, V and X judge, with the existing `host:*` events.

This is optional within F99. If it doesn't fit the session, move it to `## Backlog` with this text.

## Mapping

| Issue | Feature |
|---|---|
| HST-01 … HST-08 | F98 |
| HST-09 … HST-11 | F99 |
