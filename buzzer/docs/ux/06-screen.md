# 06 — Screen

Covers `/screen/:code` (`pages/Screen.tsx`) and `ScreenChrome`, `ScreenQuestion`, `ScreenBoard`, `ScreenResults`, `StandingsRail`, `BulbRail`, `ScreenHostControls`, `PairHostPhone`, `ReconnectingBanner`, `StartOverlay`, `Toast` and `lib/useShrinkToFit.ts`. Built by **F100** (legibility on any display) and **F101** (host bar and overlays).

## What we saw

**At 16:9 (1440×900 window, 1024×768):** the Screen is the most polished surface in the app.
- The lobby has a huge room code, the QR, the join URL and the setup panel.
- In the question and buzzed states, the type is big and clear.

**Off 16:9:** the sizing model is `min(Xvw, Yvh)` tuned for 16:9 (`.claude/rules/client.md`), and nearly nothing has a lower bound.
- On 4:3, portrait and phone-sized displays, text sizes follow the width. Labels shrink to about 5px on a 390px-wide portrait display, and lobby chips can reach 8px on any display (`CHIP_MIN_PX = 8`).
- The host control bar wraps to two rows at 1280px in BUZZED and covers the bottom of the buzz banner.
- The help overlay and the scoreboard can clip at 720p. These estimates come from the CSS; check them with screenshots first.

**Scope.**
- 1920×1080 is still the design target, and nothing here may make it look worse.
- Tablets (1024×768, 820×1180) and ultrawide displays should look intentional.
- A phone used as the Screen only needs to be legible ("graceful"). It does not need a designed layout.

**Legibility guide.**
- At 1080p, aim for at least 24px for anything a player must read from the couch.
- Never go below 14px absolute.
- Express floors as `clamp(<floor>px, <vw/vh term>, <cap>)`, or as `max()` on the existing `min()`.

## Issues: legibility on any display (F100)

### SCR-01 · P1 · Narrow, 4:3, portrait — Text has no floor

**Evidence:**
- **Lobby container text is cqw-only, with no vh cap and no px floor:**
  - title and labels 1.6cqw
  - "Join at" 2.89cqw
  - URL 3.56cqw

  All at `Screen.tsx:379-384`. With the setup panel open at 1280px, the labels come to about 12px.
- **Chips** use `useShrinkToFit` with `CHIP_MIN_PX = 8` (`Screen.tsx:354`).
- **Fixed labels:**
  - `SCREEN_LABEL`: `min(1.2vw,2.1vh)` (`ScreenQuestion.tsx:37`).
  - Header join: `min(1.4vw,2.5vh)` (`ScreenChrome.tsx:61`).
  - Options text: `min(2.4vw,4.3vh)`.
- **At 390px wide, portrait:** label 4.7px, header join 5.5px, choice text 9.4px.

**Recommendation:**
- Wrap every Screen text size in a floor:
  - labels: `max(14px, …)`
  - body, options and chips: `max(18px, …)`
  - names and answers: `max(24px, …)`
- Raise `CHIP_MIN_PX` to 14. When the chips no longer fit, show the first N chips and "+M more".
- Give the lobby cqw sizes a vh term (`min(Xcqw, Yvh)`) as well as a floor.

**Done when:**
- At 1920×1080 every size is unchanged (screenshot diff).
- At 1024×768, 820×1180 and 390×844, no text renders below 14px. Check with a script over `getComputedStyle` font sizes.

### SCR-02 · P2 · Ultrawide — `zoom:2` fires on 2560×1080

**Evidence:**
- `min-[2560px]:[zoom:2]` (`Screen.tsx:251,442`) triggers at 2560×1080 and 3440×1440. On a 1080-tall display, the setup panel (built to fit 720) doubles and scrolls.
- 4K TVs at DPR 2 report 1920 wide and never trigger it.

**Recommendation:** Key it to `[@media(min-width:2560px)_and_(min-height:1440px)]`.

**Done when:** at 2560×1080 the setup panel does not scroll. At 2560×1440 it zooms as it does today.

### SCR-03 · P2 · Ultrawide, portrait — Sizes in pure vw blow up or collapse

**Evidence:**
- `ReconnectingBanner.tsx:16` uses `text-[3.2vw]`, about 110px at 3440 wide.
- "Game over" uses `text-[5vw]` (`ScreenResults.tsx:87`).
- Stage rings (`ScreenQuestion.tsx:29`), text shadows (`Screen.tsx:338`), `px-[3.75vw]` and `gap-[4vw]` are pure vw.
- The rail is `w-[17vw]`.

**Recommendation:**
- Convert each to `min(Xvw, Yvh)` with the 16:9 ratio, which keeps 1920×1080 identical. Add a floor where it is text.
- Cap the rail at `min(17vw, 30vh)`.

**Done when:** at 3440×1440, the Reconnecting banner and the rail are within 1.3× their 2560×1440 size.

### SCR-04 · P1 · 720p and 1080p — Scoreboard and final ranking can clip (verify first)

**Evidence:**
- `ScreenResults.tsx:272-299`: ranking text steps `min(3vw,5.5vh)` / `min(2vw,3.6vh)` / `min(1.4vw,2.4vh)` for ≤10 / ≤24 / more players.
- Rows use the default line-height, in `minmax(0,auto)` rows inside `overflow-hidden`.
- With the host bar reserve, about 510px is left at 1080p. By estimate, only 3–4 rows of the ≤10 step fit.

**Recommendation:**
- First, check with Dev Bots (`/dev/bots/:code`): 10 and 24 players at 1280×720 and 1920×1080.
- If it clips, size rows from the available height: a grid with `grid-template-rows: repeat(n, 1fr)` and `leading-tight`, with text sized by `useShrinkToFit` on the list container. Switch to two columns above about 12 players.

**Done when:** with 10 and with 24 players at 1280×720 and 1920×1080, every ranking row is fully visible and at least 24px at 1080p.

### SCR-05 · P2 · 4:3, 6 columns — Board tile values overflow

**Evidence:**
- Tile text is `min(4.5vw,8vh)` (`ScreenBoard.tsx:50`), whatever the column count.
- Column titles already use `min(2vw, 9/n vw, 3.6vh)` (`:32`).
- At 1024×768 with 6 columns, "1000" needs about 150px in a column about 147px wide.

**Recommendation:** Add the same column-count term to tiles: `min(4.5vw, 18/n vw, 8vh)` (tune the constant), with a 18px floor.

**Done when:** a 6-column board at 1024×768 and 820×1180 shows every value inside its tile.

### SCR-06 · P2 · Portrait, narrow — The lobby setup panel and code don't fit

**Evidence:**
- The setup panel is `w-[min(28rem,30vw)]` (`Screen.tsx:442`): 117px on a phone and 230px on a 768px-wide tablet, which is unusable.
- The room code's `clamp(4rem,…)` floor (about 250px for 4 characters) overflows a column of about 232px.
- The QR is about 65px.

**Recommendation:**
- Below 1000px wide, or in `portrait:`, the lobby stacks: code, QR and URL on top; the setup panel full-width below.
- The lobby may scroll in this mode only. That is the one exception to the Screen's no-scroll rule, and only when the device can host.

**Done when:** at 820×1180 every setup control is usable and the code and QR are fully visible.

### SCR-07 · P2 · Portrait — Side-by-side layouts waste height

**Evidence:**
- Image questions put the text and image side by side in a flex row (`ScreenQuestion.tsx:78-86`).
- The Final screen shows three cards side by side, with podium steps at `max-w-[16vw]` (`ScreenResults.tsx:98-131`). That is 62px on a phone.
- In BuzzResult, the also-buzzed column is `max-w-[58%]` (`ScreenQuestion.tsx:505-531`), which squeezes the winner's name.

**Recommendation:** In `portrait:`, stack them all: image under the text, podium above the ranking above Tonight, also-buzzed under the banner.

**Done when:** at 820×1180 an image question shows the image at least 50% of the width, and the Final screen has no step narrower than 120px.

### SCR-08 · P3 · Phone as Screen — Graceful fallback

**Evidence:** Nothing stops a phone from opening `/screen/:code`. At 390×844, it shows the 16:9 layout at tiny scale.

**Recommendation:**
- With the floors (SCR-01) and portrait stacking (SCR-06, SCR-07), the phone Screen becomes readable.
- Below 640px wide, add a one-line banner: "The Screen is made for a TV or laptop. Players join at <url>". It can be dismissed.
- Do not design a phone Screen layout.

**Done when:** at 390×844 every phase is readable (14px floor), and nothing overflows horizontally.

## Issues: host bar and overlays (F101)

### SCR-09 · P1 · 1280–1920 — The host bar wraps over content

**Evidence:**
- In BUZZED the bar holds 12 buttons with key hints (`ScreenHostControls.tsx:173-275`, and the right group at `:122-135`), with a 14px font minimum (`:114`), in `flex-wrap`.
- At 1280 it wraps to two rows, about 100px tall, against a fixed `mb-[8vh]` reserve (`Screen.tsx:184`) of about 58px. It covers the bottom of the buzz banner and the also-buzzed list.
- The reserve stays even when the bar is hidden, which leaves an empty strip of about 86px at 1080p.

**Recommendation:**
- The bar is always one row.
- **Left:** the phase's primary action plus judge buttons.
- **Middle:** the 2–3 most used secondaries.
- **Right:** a **More ▾** menu (Undo, Previous, Scoreboard, End game in red, Sound, Fullscreen), plus **? Shortcuts** and **Hide**.
- Measure the bar with a `ResizeObserver`, and reserve that height only while the bar is visible. When hidden, the content uses the full height.

**Done when:** at 1280×720 and 1920×1080, in every phase, the bar is one row and never overlaps content.

### SCR-10 · P1 · 720p, 1080p — The help overlay overflows (verify first)

**Evidence:**
- 15 rows at `clamp(1rem,1.6vw,2.5rem)`, centred with no scroll (`ScreenHostControls.tsx:346-376`). That is about 680px against about 557px available at 720p.
- It is not modal: no `aria-modal`, and focus does not move into it.

**Recommendation:**
- Two columns at landscape sizes, with `max-h-full overflow-y-auto` as a safety net.
- `role="dialog" aria-modal="true"`, with focus moved to its heading. Esc and `?` close it (Esc already works, `:63`).

**Done when:** at 1280×720 every shortcut is visible without scrolling.

### SCR-11 · P2 · Lobby — Two Start game buttons

**Evidence:**
- The lobby's setup panel has **Start game · Space** (`Screen.tsx:444-455`).
- The bar shows a second **Start game · Space** at the same time (we saw both at 1440×900).

**Recommendation:** In LOBBY, while the setup panel is visible, the bar leaves out its Start. The panel's button is the one to press.

**Done when:** the lobby shows exactly one Start game button.

### SCR-12 · P2 · Touch Screens — The bar can be lost, and key hints show without a keyboard

**Evidence:**
- The bar hides 3 s after mount (`ScreenHostControls.tsx:24,52-53`). Only `pointermove` or **H** brings it back, and a tap on a tablet may not send `pointermove`.
- `kbd` hints show on touch. `PairHostPhone` already hides them with `pointer-fine` (`:205`).

**Recommendation:**
- Show the bar on `pointerdown` as well.
- On `pointer-coarse`, do not auto-hide; collapse to a small "Controls" tab instead.
- Hide `kbd` hints on `pointer-coarse`.

**Done when:** on a 1024×768 touch emulation, a tap anywhere brings the bar back, and no key hints show.

### SCR-13 · P3 · All — Nothing says shortcuts exist once the bar hides

**Evidence:**
- Once the bar auto-hides there is no visible hint.
- Shortcuts other than H give no visual feedback.

**Recommendation:**
- A small persistent corner hint ("? Shortcuts"), at 40% opacity, inside the bottom rail area. Show it only when the device can host.
- Pressing a shortcut flashes the matching bar button, or shows a short "Correct (C)" chip, for 600 ms.

**Done when:** after the bar hides, the hint is visible, and pressing C shows feedback.

### SCR-14 · P2 · All — The toast sits on the bar and is phone-sized

**Evidence:** `Toast.tsx:36`: `fixed bottom-6 text-lg max-w-md`. The same component is used on the Screen.

**Recommendation:**
- Add a Screen variant: positioned above the bar reserve (or the rail), with text `max(18px, min(1.6vw, 2.8vh))` and width `min(60vw, 900px)`.

**Done when:** at 1920×1080 a toast never overlaps the bar and is readable from the couch.

### SCR-15 · P2 · 1024–1279, short windows — The standings rail disappears silently

**Evidence:**
- The rail is `hidden … [@media(min-width:1280px)_and_(min-height:720px)]:flex` (`StandingsRail.tsx:45`).
- A 1366×768 laptop window with the browser bar is below 720px tall, so the rail hides until the Screen goes fullscreen. **Standings on the Screen** then does nothing, and nothing says so.

**Recommendation:**
- Show a slim rail (top 3, narrower) from 1024px wide or 600px tall.
- Hide it only in portrait or below 1024px.
- In the setup panel, when the rail can't show, the setting's detail line reads "Shows when the Screen is wider".

**Done when:** at 1366×700 the rail shows (slim).

### SCR-16 · P3 · All — Focus and banner details

**Evidence:**
- On the board, the arrow-key cursor (a gold box-shadow, `ScreenBoard.tsx:54`) and the global focus ring can mark different tiles after a mouse click. This needs checking.
- The Reconnecting banner (fixed top, `z-40`) covers the header's join info.

**Recommendation:**
- The board cursor follows focus: one marker.
- The Reconnecting banner sits below the header, or replaces only the header's centre pill.

**Done when:** only one tile is ever marked, and the join info stays visible while reconnecting.

## Mapping

| Issue | Feature |
|---|---|
| SCR-01 … SCR-08 | F100 |
| SCR-09 … SCR-16 | F101 |
