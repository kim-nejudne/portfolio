# 07 — Admin

Covers the super-admin's pages:
- `/admin` (`pages/Admin.tsx`, `components/AdminCategories.tsx`)
- `/admin/generate` (`pages/AdminGenerate.tsx`, `AddCategoryForm`, `GenerateProgress`)
- `/admin/categories/:name` (`pages/AdminCategory.tsx`)
- `/admin/categories/:name/:setId` (`pages/AdminLevel.tsx`)

Admin mode on `/sets` and the built-in editor at `/admin/sets/:setId` are out of scope: hosts share them.

Built by milestone **M29 — Admin redesign** (F119–F128). Audited 2026-11-03 at commit `61c162c`. Line numbers will drift; search for the quoted code if a line has moved.

The admin is one person (Kim) who works on a laptop and on a phone equally. Both layouts are designed in their own right. Neither is a fallback.

## How the audit was done

- Ran `npm run dev` with `GENERATE_FAKE=1`, a throwaway `ADMIN_PASSWORD_HASH` and a scratch `DATA_DIR`. The data was the 20 starter categories plus one fake 3-level draft ("Rivers and Lakes of the World", 8 questions a level), so 21 categories in all.
- Chrome cannot shrink a window below about 500px. Each page was therefore loaded in a same-origin `<iframe>` at 375×667 and 667×375 and measured with JS:
  - horizontal overflow (`scrollWidth` against `clientWidth`, and any element past the right edge)
  - controls under 44×44
  - text under 14px
  - page height
- Screenshots at 375 (iframes) and at 1440×900.

## What we saw

**Passed everywhere:**
- No horizontal overflow on any of the four pages at 375 or 667.
- Every control is at least 44px. The Add category checkboxes are 20px, but they sit in 44px labels.
- No text under 14px.

**Phone:** nothing is broken, but `/admin` is a scroll marathon. At 375×667 it is 10,068px tall, about 15 screens. Every one of the 21 categories is a full card: three level rows, each with its own Regenerate button. The session card and two gold buttons fill the first screen before the first category shows. The level review is 2,744px for 8 questions, and about 5,000px for 15. Its one goal, **Mark reviewed**, is at the very bottom.

**Laptop (1440×900, and the same at 1024 and 820):** every admin page is the same 768px column (`PageShell` `content`). About 2.5 categories fit on a screen, and the sides of the window are empty. A fresh draft that needs review is sorted alphabetically among the live categories, so it can be anywhere in the list.

## Issues

### ADM-01 — The dashboard is 15 phone screens long
- **Severity:** P2
- **Viewports:** 375×667 (10,068px tall), 667×375 (6,396px), and every size
- **Evidence:** `components/AdminCategories.tsx`, `CategoryCard`: a `CARD` per category, with a row and a `ConfirmButton` "Regenerate" per level. That makes 63 Regenerate buttons for 21 categories.
- **Recommendation:** make the dashboard a list of compact category rows: name, an E/M/H status dot per level, the question total and a status badge. Levels and their actions move to the category page (ADM-08).
- **Done when:** at 375×667 with the 21 categories, `/admin` is at most 3 screens tall, and no Regenerate button shows on it.

### ADM-02 — One 768px column on every laptop
- **Severity:** P2
- **Viewports:** 820×1180, 1024×768, 1440×900
- **Evidence:** `pages/Admin.tsx:152`, `<PageShell width={… 'content' …}>`. The inner pages use the default `content` width too.
- **Recommendation:** from `lg`, use list + detail panes. The category list sits on the left, in its own scroll area. The right pane holds the route's page: the overview, a category, a level review or Add category.
- **Done when:** at 1440×900 the list shows at least 12 categories without scrolling, and choosing one shows it on the right without leaving the list.

### ADM-03 — Drafts that need review are hidden in the alphabet
- **Severity:** P2
- **Viewports:** all
- **Evidence:** `AdminCategories.tsx:363` lists `data.categories` in the server's order. Only a small `new` pill on each level row marks a draft.
- **Recommendation:** pin the categories that need review, are generating or have failed first. Give each a badge. Show the counts as filter chips (F121).
- **Done when:** a category with an unreviewed draft is the first row of the list, with a "Needs review" badge.

### ADM-04 — The level review hides its goal and puts actions first
- **Severity:** P2
- **Viewports:** all; worst on a phone
- **Evidence:** `pages/AdminLevel.tsx:364-401`. Edit, Remove and Replace sit in the card's header, above the question and answer, with Remove (danger) between them. `client.md` says to put the destructive action last. **Mark <level> reviewed** is at `AdminLevel.tsx:846`, after every card and the Add section.
- **Recommendation:** order each card as question, answer, notes, then the actions **Edit · Replace · Remove**, with Remove last. Add a sticky footer that holds **Mark <level> reviewed**, "N replacements left today" and a progress line ("2 replacing · 1 edited").
- **Done when:**
  - at 375×667, Mark reviewed is visible without scrolling at any scroll position
  - in every card, Remove is the last button

### ADM-05 — Two gold buttons and a session card above the work
- **Severity:** P3
- **Viewports:** all
- **Evidence:**
  - `Admin.tsx:84-98`: a `CARD` with "Admin", "Signed in until …", a gold **Question sets** and **Logout**
  - `AdminCategories.tsx:327`: a second gold **Add category**
- **Recommendation:** a slim admin header (ADM-06) takes the session time, Question sets and Logout. **+ Add category** is the page's only gold button, at the top of the list.
- **Done when:** `/admin` has one `BUTTON_PRIMARY`, and the first category row is above the fold at 375×667.

### ADM-06 — Each admin page has a different frame
- **Severity:** P3
- **Viewports:** all
- **Evidence:**
  - `/admin` has no header, and "Back to start" sits at its foot (`Admin.tsx:154`)
  - the inner pages have only "← Admin" or "← <category>" (`AdminCategory.tsx:238`, `AdminLevel.tsx:899`)
  - Logout and the session's end show only on `/admin`
- **Recommendation:** one admin header on every `/admin/*` page: **Buzzr Admin** (to `/admin`), History, Question sets, "Signed in until 23:13" and Logout. Below `sm` the links and Logout go in the existing `OverflowMenu`. The inner pages keep a back link under the header on a phone only. On desktop the list pane is the way back.
- **Done when:** the four pages share the header, and Logout is reachable from each.

### ADM-07 — Category cards wrap awkwardly and repeat themselves
- **Severity:** P3
- **Viewports:** 375×667
- **Evidence:** `AdminCategories.tsx:145`. At 375, Delete wraps onto its own line under the name and Review. At `AdminCategories.tsx:180` every level row repeats the category ("Animals – Easy", "Animals – Medium").
- **Recommendation:** fixed by the compact list row (ADM-01). On the category page the level rows read "Easy", "Medium" and "Hard", or the set's title when it has no difficulty.
- **Done when:** no admin row repeats its category's name.

### ADM-08 — Review leads to a dead end, and a paid action is everywhere
- **Severity:** P3
- **Viewports:** all
- **Evidence:**
  - `AdminCategories.tsx:150`: **Review** shows on every category. For a live-only category it opens "Nothing to review".
  - `AdminCategories.tsx:186`: **Regenerate** (a paid generation) repeats on every live level row.
- **Recommendation:** merge the dashboard card and the review page into one category page at `/admin/categories/:name`. It shows every level, live or draft, with its count, its state and Regenerate. Then Publish (gated as today), Hide (F126) and Delete. The list row itself is the link, so there is no Review button.
- **Done when:** every category opens a page with content, and Regenerate appears only on the category page.

## Target layouts

Breakpoints are Tailwind's defaults (`docs/ux/00-foundations.md`). The two-pane layout switches at `lg` (1024px) with `useDesktopLayout()` (`lib/useMediaQuery.ts`), as the host remote does (F99). The panes are rendered or not, never hidden by CSS. Without `matchMedia`, the phone layout renders, so tests get it too.

### Phone and tablet (< `lg`)

One pane. The route decides what fills it. `/admin` is the list; the other routes are full pages with a back link.

```
375  ┌ BUZZR ADMIN                     ⋯ ┐   ⋯ = History · Question sets ·
     │ 1 to review · 0 generating · 20 live│       until 23:13 · Logout
     │ [ + ADD CATEGORY               ]   │   ← the one gold button
     │ [search…                        ]  │
     │ (All 21)(Needs review 1)(Live 20)… │   ← filter chips, scroll sideways
     │ ┌─────────────────────────────────┐│
     │ │ Rivers and Lakes…   NEEDS REVIEW││   ← pinned first
     │ │ ● ● ●  24 questions             ││
     │ ├─────────────────────────────────┤│
     │ │ Animals                         ││
     │ │ ● ● ●  45 questions             ││
     │ ├─────────────────────────────────┤│
     │ │ Anime & Manga …                 ││
```

Category page (`/admin/categories/:name`):

```
375  ┌ BUZZR ADMIN                     ⋯ ┐
     │ ← Categories                       │
     │ RIVERS AND LAKES OF THE WORLD      │
     │ ┌ Easy     8 q   draft · ✓ reviewed┐
     │ │                     [Regenerate] │
     │ ├ Medium   8 q   draft · not rev.  ┤
     │ │                     [Regenerate] │
     │ └ Hard …                           ┘
     │ [ PUBLISH RIVERS AND LAKES… ]       │  ← gated as F116
     │ [Hide from hosts]   [Delete]       │  ← Delete last
```

Level review (`/admin/categories/:name/:setId`):

```
375  ┌ BUZZR ADMIN                     ⋯ ┐
     │ ← Rivers and Lakes of the World    │
     │ EASY · 8 questions · 1 duplicate   │
     │ ┌ QUESTION 1             100 pts ─┐│
     │ │ Which river is the longest…     ││
     │ │ ANSWER  Nile                    ││
     │ │ ⚠ Same answer as Q6             ││  ← F123
     │ │ [Edit] [Replace] [Preview] [Rem]││  ← Remove last
     │ └─────────────────────────────────┘│
     │ …                                  │
     ├────────────────────────────────────┤
     │ 1 replacing · 99 left today        │  ← sticky footer
     │ [   MARK EASY REVIEWED          ]  │
     └────────────────────────────────────┘
```

At `short:` (667×375), the footer is one line: the progress text and the button side by side.

### Desktop (`lg`+)

The admin header spans the window. Under it are two panes: the list (fixed width, about 320px at `lg` and 360px at `xl`) and the detail pane (the rest, its content capped at `max-w-3xl`). The page is `h-dvh`, and each pane scrolls on its own, so the list never scrolls away.

```
1440 ┌ BUZZR ADMIN        History   Question sets   until 23:13   Logout ┐
     ├──────────────────────────┬───────────────────────────────────────────┤
     │ [ + ADD CATEGORY      ]  │ OVERVIEW                                  │
     │ [search…              ]  │ ┌ Needs review ┐┌ Generating ┐┌ Left today ┐│
     │ (All 21)(Review 1)(Live) │ │      1       ││     0      ││ 17/20 lvls ││
     │ ● Rivers and Lakes  NEW  │ └──────────────┘└────────────┘└ 100 repl.  ┘│
     │   Animals          ●●●   │ ┌ Spend today ┐┌ 30 days ─┐  (F128)        │
     │   Anime & Manga    ●●●   │ │   $0.04     ││  $1.92   │                │
     │   Comics & Super…  ●●●   │ └─────────────┘└──────────┘                │
     │   Computers & Tech ●●●   │ Needs review                              │
     │   Food & Drinks    ●●●   │  • Rivers and Lakes of the World →        │
     │   …                      │                                           │
```

- `/admin`: the overview fills the detail pane. On a phone, the same counts are one line above the list.
- `/admin/generate`: the Add category form, or a job's progress, in the detail pane.
- `/admin/categories/:name`: the category page in the detail pane. The row is highlighted in the list (`aria-current="page"`).
- `/admin/categories/:name/:setId`: the level review in the detail pane, with its sticky footer at the pane's foot. The list still highlights the category.
- `/admin/history` (F128): full width, with no list pane. A table at `lg`+ and stacked rows on a phone.

At 820×1180 (tablet portrait) the phone layout applies, with `md` gutters. The list rows can show the level dots and the count on one line.

## New features (M29)

| Feature | What it adds |
|---|---|
| Overview, search and filters (F121) | Count chips that filter the list (All, Needs review, Generating, Live, Hidden), a search over category and level titles, and the overview pane. Client only. |
| Hide a category (F126) | **Hide from hosts** on the category page. Its sets leave `GET /api/built-in-sets` at once and stay editable in admin. **Show** brings them back. Stored as `hiddenCategories` in `built-in-sets.json`. |
| Generation history (F127, F128) | Every ended job is appended to `DATA_DIR/generation-history.jsonl`. `/admin/history` lists them with their cost and outcome, plus today, 30-day and all-time totals. The overview shows today and 30 days. |
| Duplicate and long-text warnings (F123) | Badges on review cards: the same answer twice, or near-identical question text, across the category's levels; and text long enough to shrink a lot on the Screen. They never block. |
| Preview on Screen (F124) | A card's **Preview** opens the editor's `QuestionPreview` (the Screen's own render, 16:9) for that question, with ←/→ through the level. |
| Review shortcuts (F125) | Desktop only (`lg` and a fine pointer), off while typing: j/k or ↑/↓ move between cards, e edit, r replace, p preview, Esc cancel, Ctrl+Enter save, Shift+M mark reviewed. Key hints show on the buttons. |

## Roadmap mapping

| Feature | Issues it closes |
|---|---|
| F119 Admin shell and panes | ADM-02, ADM-05, ADM-06 |
| F120 Category list and merged category page | ADM-01, ADM-03, ADM-07, ADM-08 |
| F121 Overview panel, search and filters | ADM-03 (the chips) |
| F122 Level review layout and sticky footer | ADM-04 |
| F123–F128 | New features, no audit issue |
