# 00 — Foundations

These are the rules every M24 feature builds on. F92 puts the shared pieces in place: variants, page shell, shared classes, floors and copy helper. F93–F101 use them and should not invent their own.

## Design intent

Buzzr has three kinds of device, and each needs something different:

- **The Screen** is a stage. It is designed for 1920×1080 at 5 m and scales with viewport units. On other displays, it must stay legible rather than look identical.
- **Phones** (Player, Host remote) are controllers. They are thumb-reachable, use one primary action, and the important controls never scroll away.
- **Laptops and tablets** (Landing, set library, editor, Host remote on a tablet) are workspaces. Use the width: grids, two panes, sticky toolbars. Never leave a phone column floating in an empty page.

The "Prime Time" look stays as it is: tokens in `client/src/index.css`, Bungee display, DM Sans body, gold accent and stage red. M24 is about layout, scale and hierarchy. It is not a restyle.

## Rules

### Breakpoints and variants

| Class | Width | Tailwind |
|---|---|---|
| Phone | < 640px | (base) |
| Large phone, small tablet | 640–767px | `sm:` |
| Tablet | 768–1023px | `md:` |
| Desktop | 1024px and up | `lg:` |
| Wide desktop | 1280px and up | `xl:` |

Two extra conditions:

- **Short screens** (landscape phones, about 360–430px tall). Add a custom variant in `index.css`: `@custom-variant short (@media (max-height: 500px));`.
- **Input type.** Use Tailwind v4's built-in `pointer-fine:` and `pointer-coarse:` variants. Use them for hints that only make sense with a keyboard and mouse (key hints, "Click"), not for layout.

Design phone first, then add `md:` and `lg:` layers. Use container queries (`@container`) where a component lives in places of different width, such as SetBrowser in the picker and on `/sets`.

### Scrolling

- **No nested scroll boxes on tablet or desktop.** A list scrolls with the page, or it fills a pane whose height is tied to the viewport (`lg:sticky lg:top-… lg:max-h-[calc(100dvh-…)]`). Never use a fixed `max-h-80` box inside a page that also scrolls.
- **Every fixed-height surface must scroll at short heights.** Overlays, dialogs and `h-dvh` stages must not clip a button out of reach at 667×375. Use `overflow-y-auto` on the dialog itself, or switch the stage to `min-h-dvh` under `short:`.
- **Keep the primary action reachable.** On phones, a page whose primary action can scroll out of view gets a sticky bottom bar. Respect `env(safe-area-inset-bottom)`.

## Issues

### FND-01 · P1 · All viewports — There is no responsive system

**Evidence:** Apart from `min-[2560px]:` (twice, `pages/Screen.tsx:251,442`), there are no `sm:`/`md:`/`lg:` classes in `pages/` or `components/`. Page widths are hard-coded per page: `Landing.tsx:22`, `Play.tsx:237`, `Host.tsx:177`, `Sets.tsx:270`, `SetEditor.tsx:226`.

**Recommendation:** Adopt the breakpoints and variants above. Add the `short` variant to `index.css`.

**Done when:**
- `short:` works in a component.
- `.claude/rules/client.md` names the breakpoints and the device matrix from `README.md`, replacing "Check them at 375 px wide" with the full matrix.

### FND-02 · P2 · Tablet, desktop — No page shell

**Evidence:** Each page repeats `mx-auto flex min-h-dvh max-w-* flex-col gap-* px-4 py-10`. Some are vertically centred and some are top-aligned. Nothing grows past 768px.

**Recommendation:** Add a `PageShell` component (`components/PageShell.tsx`):

- `width="narrow" | "content" | "wide"` maps to `max-w-md` / `max-w-3xl` / `max-w-6xl`.
- Gutters are `px-4 md:px-8`, with `py-6 md:py-10`.
- Content is top-aligned.
- An optional `header` slot holds the logo or back link and page actions.

Pages move to it in their own features. F92 only creates it and uses it for `Placeholder.tsx`.

**Done when:** `PageShell` exists with a test, and `Placeholder` uses it.

### FND-03 · P3 · All — Button and field classes are copied in many places

**Evidence:**
- `smallButton` appears four times with the same string: `Sets.tsx:74`, `SetEditor.tsx:78`, `GameBuilder.tsx:75`, `PasteQuestions.tsx:7`. `PREVIEW_BUTTON` (`SetBrowser.tsx:15`) is the same string plus `shrink-0`.
- `field` has two variants (`SetEditor.tsx:79`, `GameBuilder.tsx:72`).
- The filled accent button is hand-written at `Sets.tsx:307`, `SetEditor.tsx:358` and `PasteQuestions.tsx:98`. The outline button is hand-written at `Sets.tsx:283,291`.
- `CARD` is hand-written at `Host.tsx:369`, `HostBoard.tsx:24`, `TypedMarking.tsx:34`, `ReadAloud.tsx:53` and `PasteQuestions.tsx:31`.

**Recommendation:** In `lib/ui.ts`, add these and replace the local copies:
- `BUTTON_SMALL`: the `smallButton` string with `HOVER`.
- `BUTTON_DANGER`: see FND-07.
- `FIELD`: `min-h-11`, with an `aria-invalid:border-buzz` state.

Use `BUTTON_PRIMARY`, `BUTTON_OUTLINE` and `CARD` where they are hand-written. Sizes may still be overridden per call site with an extra class.

**Done when:**
- `rg "smallButton|PREVIEW_BUTTON|const field"` finds nothing in `client/src`.
- The existing tests still pass, with no change in behaviour.

### FND-04 · P2 · All — Text below 14px

**Evidence:**
- `LABEL` is `text-[13px]` (`lib/ui.ts:8`) and is used on every caps label.
- Other small text:
  - SecondaryActions tile labels: 13px (`SecondaryActions.tsx:14`).
  - Play header team, room and "of N" lines: 13px (`Play.tsx:653,663,674`).
  - SideCountdown "sec": `text-xs` (`PrimaryAction.tsx:158`).

**Recommendation:**
- Raise the floor to 14px on Player, Host, Landing and set pages: `LABEL` becomes `text-sm` and keeps its tracking.
- The Screen has its own floors (SCR-01).

**Done when:** `rg "text-\[1[0-3]px\]|text-xs"` finds nothing outside the Screen and the tests.

### FND-05 · P2 · Phone — Touch targets under 44px

**Evidence:**
- Cancel links: `HostGame.tsx:167` and `NewGamePicker.tsx:290`, about 28px tall.
- "← Back to the editor": `AnswerSheet.tsx:51`.
- The "Keep scores" label: `NewGamePicker.tsx:161-170`.
- The editor drag handle and ↑/↓ buttons: about 38px wide (`SetEditor.tsx:551-581`).
- The correct-choice radio: 24px with no wrapping label (`SetEditor.tsx:740-747`).
- Avatar cells: about 41px at 375px and smaller at 320px (`Play.tsx:299`).

**Recommendation:**
- Every interactive element is at least 44×44px (`min-h-11 min-w-11`).
- Text links get `inline-flex min-h-11 items-center`.
- Small inputs are wrapped in a label that is at least 44px.

The surface features fix their own targets. F92 fixes the shared pieces and the links named here.

**Done when:** at 375px, an audit with a script that checks the bounding rects of `button, a, input, select, [role=button]` reports nothing under 44px on Landing, the picker and AnswerSheet.

### FND-06 · P3 · Desktop — Hover feedback missing

**Evidence:**
- `BUTTON_SECONDARY` has no hover style (`lib/ui.ts`).
- `HOVER` (`lib/hover.ts:7`) is used on set pages and HostSettings only. It is missing on:
  - Host tabs (`Host.tsx:225`)
  - SecondaryActions (`SecondaryActions.tsx:14`)
  - HostPlayers (`HostPlayers.tsx:15`)
  - judge buttons (`PrimaryAction.tsx:26`)
  - HostBoard tiles (`HostBoard.tsx:42`)
  - Player choice buttons and the avatar picker

**Recommendation:**
- Add `HOVER` to `BUTTON_SECONDARY`, and to every local button class that stays local.
- Tailwind v4 already scopes `hover:` to `(hover: hover)`, so phones are unaffected.

**Done when:** every button on the Host remote and Player changes look on hover at 1440×900.

### FND-07 · P2 · All — Destructive actions look harmless

**Evidence:**
- Delete set (`Sets.tsx:505-511`), Delete question (`SetEditor.tsx:599-605`), Kick (`HostPlayers.tsx:220`) and End game (`SecondaryActions.tsx:72-84`) use the neutral button style.
- They sit between safe actions.
- They only turn red when armed (`ConfirmButton.tsx:58`).

**Recommendation:**
- `BUTTON_DANGER`: neutral surface, `text-buzz`, red border on hover.
- Destructive actions go last in their row, or in an overflow menu, and keep `ConfirmButton`'s two-step confirm.

**Done when:** Delete, Kick and End game read as destructive before they are armed, on every surface.

### FND-08 · P3 · Desktop — Copy says "Tap" on a mouse

**Evidence:**
- `copy.ts:12` `tapToTest` ("Tap to test your buzzer").
- `Sets.tsx:439` and `SetEditor.tsx:314` ("Tap New set", "Tap Add question").
- `ReadAloud.tsx:96` ("Tap to show answer").
- `StartOverlay` says "Click to start" on touch devices.

**Recommendation:**
- Add a `usePointerFine()` hook in `client/src/lib/`. It is backed by `matchMedia('(hover: hover) and (pointer: fine)')` and updates on change.
- Choose between paired copy keys: `tapToTest` on touch, and `clickToTest` "Click or press Space to test your buzzer" on a mouse.
- Add the Taglish strings for any new `copy.ts` key. Both tables must keep the same keys (`copy.test.ts`).
- Neutral verbs ("Choose", "Select") are fine where pairs would be overkill. The set pages can simply say "Use **New set** to write…".

**Done when:**
- No user-facing "Tap" shows on a fine pointer.
- `copy.test.ts` passes with the new keys.

## Kept as they are

- **Colour tokens and contrast notes** in `index.css`.
- **Reduced motion.** Every keyframe animation is already behind `motion-safe:`.
- **Focus ring.** The global `:focus-visible` gold outline.
- **Tailwind setup.** Tailwind v4 through `@tailwindcss/vite`.

M24 needs no new dependency. The overflow menus in later features use a small local `Menu` component built on `<details>` or a popover with the existing `ConfirmButton`. Build it once, in the first feature that needs it, in `components/`.
