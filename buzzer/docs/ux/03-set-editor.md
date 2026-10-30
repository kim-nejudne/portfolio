# 03 — Set editor

Covers `/sets/:setId` (`pages/SetEditor.tsx`), its `QuestionCard`, `ChoicesField`, `ImageField`, `PasteQuestions` and `QuestionPreview`. Built by **F95**.

## What we saw

At 1440×900 the editor is a 768px column. Each question is a fully expanded card about 650px tall. The fields are stacked one per row: question, image, mode, answer, notes, points. A set can hold 100 questions (`MAX_QUESTIONS_PER_SET`), which means a 65,000px page with no outline and no way to jump. The "Saved" status and the back link scroll away. **Add question** and **Paste questions** exist only below the last card.

## Target layouts

**Phone:**
- One column of cards.
- A sticky top bar: back, set title (truncated), save status and a `⋯` menu holding Paste, Preview set and Print.
- A sticky bottom **Add question** button.
- The card header shows the drag grip, "Question N", Preview and a `⋯` menu holding ↑, ↓, Duplicate and Delete.

**Tablet:**
- `PageShell width="content"`.
- The toolbar shows every action inline.
- Card fields go in a grid: Mode, Points and Image on one row; Answer beside Points for Buzz and Typed questions.

**Desktop (`lg`+):**
- `PageShell width="wide"` with two columns.
- **Left:** a sticky question outline, about 280px wide. Each entry shows the number, the first words of the question, a mode badge (Buzz / Choice / Typed) and a red dot when the question has an error. Clicking an entry scrolls to its card and focuses it.
- **Right:** the card list, unchanged in order and still one vertical list, as the spec requires.

```
lg+  ← Question sets   CURSOR TEST ✎        Saved ✓   [Add] [Paste] [Preview] [Print]
     ┌──────────────────────┐ ┌───────────────────────────────────────────────────┐
     │ 1 Capital of Fr… Buzz│ │ ⠿ QUESTION 1                     Preview  ⋯       │
     │ 2 Which planet… Choice│ │ Question [……………………………………………………………]            │
     │ 3 ● (no answer)  Typed│ │ Mode [Buzz ▾]   Points [100]   Image [Add image]  │
     │ …                     │ │ Answer [Paris……………]  Host notes [………………………]       │
     └──────────────────────┘ └───────────────────────────────────────────────────┘
```

## Issues

### EDT-01 · P2 · All — Save status, back link and Add scroll away

**Evidence:**
- The status and back link are only at the top (`SetEditor.tsx:228-237`).
- Add and Paste are only at the bottom (`:352-380`).
- "Print answer sheet" sits by itself between the metadata and the questions (`:305`).

**Recommendation:**
- A sticky top toolbar (`sticky top-0 z-10 bg-bg/95 backdrop-blur`) holding:
  - back
  - the set title, read-only, which scrolls to the title field
  - the save status: "Saving…", "Saved ✓", or a red error
  - **Add question**, Paste, Preview set and Print
- On phones, the secondary actions go into a `⋯` menu and **Add question** becomes a sticky bottom button.
- A new question scrolls into view and its question field gets focus.

**Done when:**
- The save status and **Add question** are on screen at every scroll position, at every matrix size.
- Adding a question focuses its text field.

### EDT-02 · P2 · Desktop — No outline for long sets

**Evidence:** `SortableContext` renders an `ol` of full cards (`SetEditor.tsx:318-349`). There is nothing else to navigate with.

**Recommendation:**
- At `lg`, add a sticky outline column (`lg:sticky lg:top-[toolbar] lg:max-h-[calc(100dvh-…)] overflow-y-auto`; this is the one allowed inner scroll, see `00-foundations.md`).
- Each entry has the number, a one-line `truncate` of the question text (or "Image question"), a mode badge and an error dot.
- The entry for the card in view is highlighted (IntersectionObserver).
- Reordering stays on the cards. The outline is for navigation only.

**Spec note:** the cards stay a vertical list, so the spec holds. Record the outline in DECISIONS.

**Done when:**
- At 1440×900 with 30 questions, clicking entry 25 scrolls card 25 into view and focuses it.
- The outline follows scroll.

### EDT-03 · P2 · Tablet, desktop — Short fields each take a full row

**Evidence:**
- The Mode select (`SetEditor.tsx:640`), Points `w-32` (`:696`) and ImageField (`:802`) each sit on their own row.
- The card is about 650px tall.

**Recommendation:**
- At `md`, lay the card out in a grid:
  - Row 1: the question text, full width.
  - Row 2: Mode, Points and Image (the image becomes a compact button plus thumbnail).
  - Row 3: Answer (or the choices) next to Host notes, at `lg`.
- Labels stay above their fields.

**Done when:** at 1440×900 a Buzz question card is at most 420px tall.

### EDT-04 · P2 · Phone — The card header wraps over 2–3 lines

**Evidence:**
- `SetEditor.tsx:549-606` holds the handle, "Question N", ↑, ↓, Preview, Duplicate and Delete.
- Arming Delete adds Cancel.

**Recommendation:**
- The header keeps the grip, the title, Preview and `⋯`.
- The menu holds Move up, Move down, Duplicate, then **Delete** last, in red.
- Keyboard reordering still works through the menu items and dnd-kit's `KeyboardSensor`.

**Done when:** the card header is one line at 375px.

### EDT-05 · P2 · All — The drag handle is a font glyph and the targets are narrow

**Evidence:**
- The handle is the braille glyph "⠿" in a generic small button (`SetEditor.tsx:551-560`). How it looks depends on the font having that glyph.
- The handle and the ↑ and ↓ buttons are about 38px wide (`:564-581`).

**Recommendation:**
- Use an SVG grip icon, added to `components/Icon.tsx`.
- Give the handle `cursor-grab` with `aria-label="Drag to reorder"`, and `min-w-11` on every icon button.

**Done when:** every icon button in the card is at least 44×44px.

### EDT-06 · P2 · Phone — The choices editor is cramped

**Evidence:**
- `ChoicesField` (`SetEditor.tsx:739-771`): the correct-choice radio is `size-6` with no wrapping label.
- The "Remove" text button takes about 90px, which leaves the input about 150px.

**Recommendation:**
- Wrap the radio and its letter in a label of at least 44px ("Correct" shown on `sm+`).
- Remove becomes a 44px × icon button with `aria-label="Remove choice B"`.

**Done when:** at 375px each choice input is at least 220px wide, and every control is at least 44px.

### EDT-07 · P2 · Tablet, desktop — Paste questions has two nested scroll lists

**Evidence:** `components/PasteQuestions.tsx:58,74` uses two `max-h-64 overflow-y-auto` lists ("Questions found" and "Lines skipped") under the textarea.

**Recommendation:**
- At `md`, put the textarea on the left and the live result on the right (found count, then the skipped lines with their reasons).
- On phones, stack them with no inner scroll.
- Open Paste as a panel under the toolbar, not at the bottom of the page.

**Done when:**
- Paste opens in view from the toolbar.
- At 1440×900, input and result are side by side with no nested scroll.

### EDT-08 · P2 · Phone; P3 desktop — Question preview at phone size, and its Close is the loudest button

**Evidence:**
- `components/QuestionPreview.tsx:82` renders `ScreenQuestion`, which is sized in vw/vh for 1920×1080, straight into a 375px portrait viewport.
- Its bottom bar of 4 buttons wraps (`:84-122`).
- Close is the filled accent button (`:118`) and outweighs Show answer, Prev and Next.

**Recommendation:**
- Render the preview in a letterboxed 16:9 stage: a fixed-aspect box sized to fit, with `container-type: size`. A phone in portrait then sees a small TV.
- Close becomes an outline or ✕ button.
- **Show answer** is the primary.

**Done when:**
- At 375×667 the preview shows the whole 16:9 frame.
- The bar is one row at `sm+`.

### EDT-09 · P3 · All — The image drop target isn't obvious

**Evidence:**
- Drop and paste work on the whole card (`SetEditor.tsx:537-540`).
- The only hint is small text inside the empty image area (`:843`).

**Recommendation:**
- While a file is dragged over a card, outline the card in gold and show a "Drop image for Question N" overlay.
- On `pointer-fine`, the hint reads "Drop or paste an image".

**Done when:** dragging a file over any card shows the drop state.

### EDT-10 · P3 · All — Errors are hard to find in a long set

**Evidence:**
- Invalid fields set `aria-invalid` on the field (`SetEditor.tsx:79`).
- Nothing at set level says how many questions have problems.

**Recommendation:**
- The toolbar shows "2 questions need attention". Clicking it jumps to the first one.
- The outline shows a dot on each of them (EDT-02).

**Done when:** an invalid question can be found from the toolbar in one click.

## Mapping

| Issue | Feature |
|---|---|
| EDT-01 … EDT-10 | F95 |
