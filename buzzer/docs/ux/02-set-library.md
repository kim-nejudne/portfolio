# 02 — Set library

Covers `/sets` (`pages/Sets.tsx`), `SetBrowser` in actions mode, `SetPreview` and the print page `AnswerSheet`. Built by **F94**.

## What we saw

At 1440×900, `/sets` is a 672px column. Each set is a full-width card with six equal-weight buttons: Open, Duplicate, Export JSON, Delete, Host this set, Preview. They wrap onto two or three lines. The page header has three buttons that wrap at 375px. Import sits in the header, while Export all sits inside the My sets tab. The only way home is a link at the bottom.

## Target layouts

**Phone:**
- One column of set cards.
- Each card shows its title, its meta line, a primary **Host** button and a `⋯` menu.
- The header shows **New set** first, with Build a game and a Backup menu on the next row.

**Tablet:** `PageShell width="wide"`; cards in two columns.

**Desktop (`xl`):** three columns. The header actions sit on one line, to the right of the title.

```
xl   QUESTION SETS                         [New set] [Build a game] [Backup ▾]
     [Built-in 61] [My sets 3]      [search……………]  [Easy][Medium][Hard][None]
     ANIMALS
     ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
     │ Animals — Easy      │ │ Animals — Medium    │ │ Animals — Hard      │
     │ 15 q · Easy · Built-in│ │ …                   │ │ …                   │
     │ [Host]  Preview  ⋯  │ │ [Host]  Preview  ⋯  │ │ [Host]  Preview  ⋯  │
     └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

## Issues

### LIB-01 · P2 · Tablet, desktop — One column of cards in a 672px page

**Evidence:**
- `pages/Sets.tsx:270` uses `max-w-2xl`.
- `components/SetBrowser.tsx:147-153` renders a single-column `ul`.

**Recommendation:**
- Use `PageShell width="wide"`.
- In actions mode, SetBrowser renders each category group as a grid: `md:grid-cols-2 xl:grid-cols-3`, or the container-query version from LND-02.
- Category headings span the full width.

**Done when:** at 1440×900, at least six set cards are visible in the first screen of the Built-in tab.

### LIB-02 · P2 · All — Six equal buttons per card, no primary, card not clickable

**Evidence:**
- Action row `Sets.tsx:486-519` plus `SetBrowser.tsx:161-173`.
- "Host this set" is a small outline button, placed last.
- Delete sits between Export and Host.

**Recommendation:**
- The card title is a link to Open (My sets) or Preview (Built-in).
- The visible actions are **Host** (`BUTTON_PRIMARY` small size) and **Preview**.
- A `⋯` overflow menu holds the rest, with **Delete** last and in red (FND-07):
  - My sets: Open, Duplicate, Export JSON, Delete.
  - Built-in: Duplicate to My sets.
- The menu is keyboard-accessible: `Esc` closes it and focus returns to the trigger.

**Done when:**
- No card's action row wraps at 375px.
- Delete still asks for confirmation.
- The existing `Sets.test.tsx` flows pass, with updated queries where needed.

### LIB-03 · P2 · All — Header actions wrap, and Import/Export are split

**Evidence:**
- `Sets.tsx:272-311`: an h1 at `text-4xl` and three `text-xl` buttons. At 375px they wrap, and **New set** (the primary) can end up alone on the last row.
- Import JSON is in the header.
- Export all is inside the My sets tab (`:444-469`).

**Recommendation:**
- Header order: **New set** (primary), **Build a game** (outline), then **Backup ▾**, a menu holding Import JSON and Export all.
- Keep the "never exported" reminder, as one compact line with an **Export all** action.
- Add a "← Buzzr" home link at the top left.

**Done when:**
- **New set** is the first header action at every size.
- Import and Export all are both in the Backup menu.

### LIB-04 · P2 · All — Feedback appears far from the action

**Evidence:**
- Notices, skipped-file lists and errors render at the top of the page (`Sets.tsx:314-357`).
- After a per-card Export or Duplicate halfway down the page, the user sees nothing change.

**Recommendation:**
- Use the existing `Toast` (`components/Toast.tsx`) for short confirmations: "Exported 'Animals — Easy'" and "Duplicated to My sets".
- Keep the inline blocks only for import results that need detail, and scroll them into view.

**Done when:** every card action gives feedback that is visible without scrolling.

### LIB-05 · P3 · All — Built-in / My sets look like filter chips, not tabs

**Evidence:** `Sets.tsx:386-406` styles the tabs as two pills, the same as the difficulty chips below them.

**Recommendation:**
- Make them a proper tab bar: an underline or a segmented track, with counts ("Built-in 61", "My sets 3").
- Keep `role="tablist"`.

**Done when:** the tabs can be told apart from the difficulty chips.

### LIB-06 · P2 · Desktop; P1 landscape phone — SetPreview is narrow, and short on a landscape phone

**Evidence:**
- Dialog `components/SetPreview.tsx:71` is `max-w-2xl`, with a one-column question list (`:89`) and images at `max-h-40` (`:156`).
- At 667×375 the header (`text-3xl`) plus two buttons leave about 150px of list.

**Recommendation:**
- At `lg`, widen it to `max-w-5xl` with a two-column question grid.
- Under `short:`, use a compact header and let the whole dialog scroll.

**Done when:**
- At 1440×900 at least 6 questions are visible.
- At 667×375 the list shows at least 3 questions.

### LIB-07 · P2 · Phone — The answer sheet table is crushed

**Evidence:**
- `pages/AnswerSheet.tsx:89` is a 4-column table with no overflow wrapper.
- At 375px, long words break mid-word.
- "← Back to the editor" (`:51`) is about 28px tall.

**Recommendation:**
- Below `sm`, render each question as a stacked block: number, question, then **Answer** and **Notes** under it.
- Keep the table at `sm` and above, and always in print (`print:` styles).
- Give the back link `min-h-11`.

**Done when:**
- At 375px no word breaks mid-word.
- The printed page (Chrome print preview) is unchanged.

### LIB-08 · P3 · All — The way home is only at the bottom

**Evidence:** "Back to start" is only at the end of the page (`Sets.tsx:538`).

**Recommendation:** A header link (logo or "← Buzzr"), as in LIB-03. Keep the bottom link.

**Done when:** at every size, home can be reached without scrolling.

## Mapping

| Issue | Feature |
|---|---|
| LIB-01 … LIB-08 | F94 |
