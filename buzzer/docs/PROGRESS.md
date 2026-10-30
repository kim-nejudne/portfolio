# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

## F99 — Host remote dashboard on tablet and desktop (2026-10-30)
**What changed:**
- New `lib/useMediaQuery.ts`:
  - `useMediaQuery` moved here from `usePointerFine.ts`, which now imports it.
  - New `useDesktopLayout()` matches `(min-width: 64rem)`, Tailwind's `lg`. It is false without `matchMedia`, so phones and tests get the phone layout.
- `pages/Host.tsx`:
  - **Dashboard at `lg` (HST-09):** no tabs. The page is `max-w-6xl` and `h-dvh`, in two columns that never scroll the page.
    - The "Game" region (3/5) holds the question card, board, tally or marking, also buzzed, the primary action (in place, not sticky), the secondary actions and lobby pairing.
    - The right column (2/5) holds Players in its own scrolling pane, then a **Settings** disclosure (`aria-expanded`). It is open by default in the lobby and closed once the game has started, until the host presses it. Open, it shares the column with Players, and each pane scrolls on its own.
    - The panes use the app's `scrollbar-color` idiom.
  - **Question card at `lg`:** the image sits beside the text, with the text and answer at `lg:text-2xl`. The h1 reads "Host controls" in full at `lg`.
  - Below `lg` the F98 tabs, sticky tabs and sticky action bar are unchanged; the old JSX was moved, not rewritten. The column is `md:max-w-2xl` (HST-10).
- **Container queries (HST-10):**
  - `HostSettings.tsx`: regular rows go two to a line inside `@container/settings` at `@xl` (36rem). The Screen's compact rows are unchanged.
  - `HostPlayers.tsx`: the list is `@container/players`. At `@xl` a row is one line (`flex-row`, and the buttons' holder becomes `contents`, so Custom's field still wraps below). That width is reached in the tablet's 640px column, never on a phone or in the dashboard's narrower column.
- HST-11 (laptop keyboard shortcuts) is optional in the UX doc. It moved to `## Backlog` with its full text.
- Tests:
  - `Host.test.tsx`: new block "tablet and desktop (F99)", 15 tests. At `lg` it checks that all three panels show with no tabs; the 3/5 grid; the primary action non-sticky in the Game column; judge, adjust and setting change without tabs; the Settings disclosure default and the host's choice; Players in its own pane under a long list; the image beside the text; the h1; and New game. Below `lg` it checks tabs and one panel at a time; `max-w-md md:max-w-2xl`; one-line player rows; and two-column settings.
  - New `useMediaQuery.test.tsx` (3).
  - 2516 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-30 for F99 (the dashboard and its JS breakpoint; Settings disclosure and question card; tablet container queries and HST-11 to Backlog).

**Notes for next session:**
- The layout tests check class names, because jsdom has no layout. The browser evidence is the playtest below.
- At 1440×900 with Settings open, the Players pane (10 players) and the Settings pane each scroll. The first settings rows and the toggle stay in view, but a lower setting needs a scroll inside its pane.
- The dashboard's Presets row is cramped in the 2/5 column: its detail wraps to 3 lines beside the two buttons.
- At 820, the paired settings rows don't align across the pair when one is taller (Presets beside Answer time).
- Phone, seen in the playtest and not changed by F99: at 375 in desktop Chromium (a 15px scrollbar), during a question a player row's `⋯` wraps under −100, +100 and CUSTOM. That leaves 300px of row for 307px of buttons. A phone has no layout scrollbar, so it should fit there, but it is close.
- Review: no Must-fix. The Should-fixes were this entry and real-browser evidence; both are done.
- Playtest (Playwright; Screen, host tab and 10 bots, room in QUESTION/OPEN):
  - **1440×900:** no tabs, and the document doesn't scroll (900 of 900). Reveal answer is at y 268–328 and "Add 100 to Bot 1" at y 170–214. The Settings toggle is at y 832–876 closed and y 470–514 open, with Party at y 570–618. "More answer time" went Off → 3 s.
  - **1024×768:** no tabs and no page scroll. Settings toggle (open) at y 384–428, Party at y 522–570.
  - **820×1180:** `main` is 672px. All 10 player rows are 64px with buttons on the name's line. Settings rows are two to a line (x 90 and 416).
  - **375×667:** tabs; the action bar's bottom is at 667; no horizontal overflow.
  - No console errors. Screenshots are in `.playtest/F99/`: `lg-1440.png` (checked), `md-820-players.png`, `md-820-settings.png` and `phone-375.png` (checked).
  - After the playtest the panes got `-m-1 p-1`, because a focus ring was clipped at a pane's bottom edge. I did not re-check this in the browser.
- Main `index` chunk 545.20 → 547.29 kB.

**How to try it:** `npm run dev`, host a set at `http://localhost:5173`, and open the remote on a laptop at `http://localhost:5173/host/<code>`. Join players from phones at `http://<LAN-IP>:5173/play/<code>`, or spawn bots at `/dev/bots/<code>`. Resize the window, or use DevTools at 1440×900, 1024×768, 820×1180 and 375×667. At `lg`, judge, press +100 on a player and open Settings, all without switching tabs.

## F98 — Host remote on the phone (2026-10-30)
**What changed:**
- `pages/Host.tsx`:
  - **Header (HST-02):** one line: `Host`, the connection dot and room code, "· N players" from 400px, the question pill and Read aloud. The set title left the header.
  - **Tabs:** the tablist sits in a `sticky top-0` holder on a solid fill.
  - **Action bar (HST-01):** a sticky bottom region, "Primary action", on the Game tab. It holds the primary button, the red judging panel in BUZZED, and **New game** in FINAL. There is no bar on the board.
  - **Also buzzed** moved out of `PrimaryAction` into the content (it is now exported).
  - **Read aloud hint (HST-08):** shown until the host first presses Read aloud, then kept sr-only (`hostLayout.ts`: `loadReadAloudHintSeen` and `saveReadAloudHintSeen`, in localStorage).
- `SecondaryActions.tsx` (HST-03): one row of equal tiles labelled Skip, Undo, Previous and Scoreboard, with the full names as `aria-label`. End game is a full-width red row below, and its armed Confirm and Cancel split that row.
- `HostPlayers.tsx` (HST-04): names show on up to 2 lines, with the status under the name. Line 2 is right-aligned: −N, +N, Custom and `⋯`. The `⋯` (`OverflowMenu`) holds "Move to <team>", then Kick, last and red. The team select is gone.
- Smaller fixes:
  - `HostSettings.tsx` (HST-05): a shared `@container` `Row` stacks the controls under the label below `@sm`. Switches and the compact Screen lobby are unchanged.
  - `ReadAloud.tsx` (HST-06): the code is `text-[clamp(2.5rem,16vw,3.75rem)]`.
  - `HostPinEntry.tsx` (HST-08): top-aligned, centred from `md`, tighter on `short:`.
  - `HostBoard.tsx` (HST-07): played tiles are struck through in muted ink, not 30% opacity.
- Tests:
  - `Host.test.tsx`: a new block "phone layout (F98)" with 14 tests. It checks the bar in lobby, question with image, open, reveal, typed marking and final; the judging panel in the bar, with also buzzed outside it; no bar on the board; the bar on the Game tab only; the sticky tabs; the header; the hint, twice; and the code clamp. New game now comes from the bar, a team move goes through the menu, and played tiles are struck through.
  - `HostControls.test.tsx`: tests for End game's own row and no reflow, and for equal tiles with no empty cells. Kick is in the `⋯` menu, last and red, and works through it; the menu's team moves, disabled state, refusal and the no-team case are covered; long names show whole; Settings rows stack, and the compact rows don't.
  - 2499 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-30 for F98: the action bar and board, the header, tabs and hint, the secondary tiles, the player rows, and settings, PIN and played tiles.

**Notes for next session:**
- **F99 (tablet and desktop) builds on this.**
  - The bar is plain `sticky`, so at `lg` it can drop to static in the Game column.
  - The tabs' holder is the element to `lg:hidden`.
  - `Row` in HostSettings already makes a two-column settings grid easy.
- The judging panel kept its layout, about 206px tall at 375×667. Its label and name could share a line if the bar needs to shrink.
- At 320px with a two-digit player count, "Players (12)" in `text-sm` is close to the tab width. This is unchecked; "Players (2)" fits at 84 of 84px.
- The review found no Must-fix. Its Should-fixes were the DECISIONS rows and the board fit and contrast notes, all recorded there.
- Playtest (Playwright; one host tab, one player, four bots, then a re-check with two players):
  - The bar was pinned at 375×667 in the lobby, question, open and judging phases (judging at y 461–667).
  - The tabs stayed put on scroll. Arming End game left the tiles where they were.
  - "Bartholomew Jone" showed whole. Kick appeared only in the menu, and Confirm kick took 5 players to 4.
  - Settings rows stacked with no overflow (Competitive ends at 341 against a row edge of 357).
  - The read-aloud code fit at 320 (scrollWidth 305). PIN entry was top-aligned at 375×480. The header at 320 and 375 was one line with no overflow.
  - No console errors, only the usual WebSocket "closed before established" warning.
  - Screenshots are in `.playtest/F98/` (judging, read-aloud 320, PIN, re-check of game 320, players and settings). I checked judging, read-aloud and players.
- Main `index` chunk is 545.20 kB.

**How to try it:** `npm run dev`. Host a set at `http://localhost:5173` and open the remote on a phone (or DevTools at 375×667 and 320×568). Join 2+ phones at `http://<LAN-IP>:5173/play/<code>`. Then:
- Step through a game and check that the action stays at the bottom.
- Scroll the Players tab and check that the tabs stay.
- Arm End game.
- Use a player's `⋯` to kick, or, with teams on, to move them.

## F97 — Player on tablet and desktop (2026-10-30)
**What changed:**
- `pages/Play.tsx`, from `md` and `lg`. Phone portrait and `short:` are unchanged.
  - **Shell (PLY-07):** the `<main>` is a centred `md:max-w-2xl` shell holding the top bar, the stage and Who's here. At `lg` it is framed: `my-6`, `h-[calc(100dvh-3rem)]`, `rounded-[28px]`, `border-2 border-edge` and `bg-surface/40` over the page's `bg`. The menu and the Who's here popover open inside it.
  - **Buzzer (PLY-08):** `md:size-[min(400px,60vw,44dvh)]`, with the label at `md:text-[min(83px,12vw,9dvh)]`.
  - **Choices (PLY-09):** a 2×2 grid from `md` (`md:grid-cols-2`, tiles `md:h-full`). The tiles already used the Screen's `CHOICE_COLORS` and letter disc.
  - **Space hint (PLY-10):** on a fine pointer, a `kbd` "Space" and "to buzz" sit under the buzzer in the lobby and while buzzers are open. It is `aria-hidden` and `short:hidden`. The "Click or press Space" copy came with F92.
  - **Hover and menu (PLY-11):** the practice and live buzzers take `hover:border-ink`. The menu is `w-72`, and an armed Leave stacks Confirm and Cancel full-width (`armedClassName`).
- Copy: new key `spaceToBuzz` ("to buzz", Taglish "para mag-buzz").
- Tests:
  - `Play.test.tsx` gains 9 tests, "Play on tablet and desktop (F97)": the shell and frame; the buzzer size classes; the choice grid in the Screen's colours; the Space hint on a mouse (English and Taglish), its absence when nothing can buzz and on touch; the menu and armed Leave; hover on the join form; and hover across choice, typed, armed menu, rename and Final.
  - `copy.test.ts` +1.
  - 2474 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-30 for F97: the spec note ("the stage is one button"; the press target stays the round button and Space works anywhere); the `44dvh` buzzer size and why the rings stay; the Space hint and hover.

**Notes for next session:**
- Tailwind emits the custom `short:` rules after `md:`, so a laptop window under 500px tall keeps the two-column short layout. The playtest checked this at 1440×480.
- Kim: the spec's Player view still says "the whole viewport is one circular button". The DECISIONS row proposes "the stage is one button". SPEC.md is locked, so the wording is yours to change.
- Review: one Must-fix, the missing DECISIONS rows, now added. Its Should-fixes: avatar-cell hover now has a test (the join form), and the buzzer sizes are measured below.
- Playtest: `.playtest/F97/drive.mjs` (cached Playwright 1.61, socket host and two socket players, Ana in Chromium with a mouse). 68 checks, all pass, no console errors:
  - the shell is centred at 672px wide, with the top bar, stage and Who's here inside it, at 820×1180, 1440×900 and 1024×768, in the lobby, open, won, choice and Final states. It is framed (28px radius, 2px border, 24px margin) at `lg`, and nothing is clipped;
  - the buzzer is measured at 400px (820×1180), 396px (1440×900) and 338px (1024×768);
  - the choices are A/B over C/D at all three sizes;
  - "Click or press Space to test your buzzer", and the Space hint in the lobby and while open, gone once Ana won via Space;
  - every enabled button in the lobby, the menu and the choices changes look under the mouse;
  - the menu is 288px, and the armed Confirm sits over Cancel at 236×52 each;
  - 1440×480 keeps the short grid, and 375×667 is full width.
  - I checked `lobby-1440.png`, `choice-820.png` and `won-1024.png` myself.
  - Not covered in a browser: typed and rename at `md` (unit tests only).
- Main `index` chunk 540.59 → 541.33 kB.

**How to try it:** `npm run dev`. Host a game from `http://localhost:5173/` on one window. Join from a desktop browser at 1440×900 at `http://localhost:5173/play/<code>`: the framed shell, the 396px buzzer and the Space hint. Resize to 820 wide for the tablet layout, and use devtools touch emulation to see the hint go. Add a Multiple-choice question to the set to see the 2×2 grid.

## F96 — Player phone: landscape and short screens (2026-10-30)
**What changed:**
- `pages/Play.tsx`, under `short:` (max-height 500px). Portrait is unchanged apart from PLY-05 and PLY-06.
  - **Stage (PLY-01):** a grid of two columns. The bulbs, status and countdowns are on the left (rows 2 and 3, with spacer rows around them). The buzzer, the choices or the typed form are on the right (`ANSWER_CELL`, spanning all rows).
    - The buzzer is `short:size-[min(70dvh,42vw)]`.
    - The stage scrolls rather than clip.
    - The header padding is tighter.
  - **Who's here:** the card is hidden, and a "3 here ▾" pill opens the same list as a popover. The popover is a new `Panel`, `whosHere`, closed by Escape or the backdrop. `WhosHere` takes a `className` and `id`, and uses `useId` for its heading.
  - **Typed (PLY-03):** the form is one row. Focusing the box (`typingAt`, per opening) hides the bulbs and the progress line, makes the status `text-xl`, moves the form to the top, and calls `scrollIntoView({block: 'nearest'})`.
  - **Choices (PLY-04):** a 2×2 grid at `min-h-14`, with "Your pick" on the tile's top edge.
  - **Final (PLY-02):** the section scrolls (`justify-center-safe`) on every size. Under `short:`, the rank and points sit side by side.
  - **Rename (PLY-05):** the overlay scrolls, with `items-center-safe` and `short:items-start`.
  - **Avatar picker (PLY-06):** 4, 5 or 6 across at 320, 360 and 400px.
- Small additions:
  - `BulbRail` takes a `className`.
  - `Icon` has a new `chevron-down`.
  - New copy key `hereCount` ("{n} here", Taglish "{n} nandito").
- Tests: `Play.test.tsx` gains 12 tests, "Play on short screens (F96)":
  - two columns in the lobby, open, won, locked out, revealed, choice and typed;
  - the pill and popover, with Escape and the backdrop, and closing at game start;
  - the countdown cells;
  - the choice grid and badge;
  - typed focus and blur, and the focus layout ending with the question;
  - Final scrolling and the side-by-side pair;
  - the rename overlay, the avatar grid, and the Taglish pill.
  - 2464 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-30 for F96: the stage grid; Who's here as a pill; typed focus; choices, Final and rename; the avatar columns, which differ from the UX doc's recommendation because of the card padding.

**Notes for next session:**
- **F97 is next (PLY-07 to PLY-11, tablet and desktop).**
  - Its `md:` buzzer size has to sit beside `short:size-[…]`. A laptop window under 500px tall still matches `short:`.
  - The Who's here card's classes are now passed in from the call site (`mx-4 mb-4 max-h-[24dvh] shrink-0 short:hidden`).
- Playtest: `.playtest/F96/drive.mjs`. It is a Node script, not a dependency. It uses the cached `playwright` 1.61 from `~/.npm/_npx`, a socket host and two socket players, and Ana in Chromium at 667×375 with touch.
  - All checks pass:
    - avatar cells: 53px at 320 and 51.8px at 375;
    - lobby, open, won-with-countdown, locked, revealed, choice, typed and final: nothing clipped;
    - buzzer at 263px (272px while pulsing);
    - the pill opens 3 names, and Escape closes it;
    - rename at 667×200: Save reachable;
    - all four choices visible, with no list or stage overflow;
    - typed at 667×200 with focus: box and Send at 78–134px;
    - Share results reachable, also with teams on (`TEAMS=2`, `.playtest/F96/teams/`);
    - Final in portrait: nothing clipped.
  - No console errors. I checked the screenshots in `.playtest/F96/` myself. The playtest found two problems, both fixed: the winner's ring touched the window edge (fixed with `short:px-3`), and the popover filled the full height (now sized to its content).
  - Not covered: a real on-screen keyboard; 667×200 stood in for it. The "Tonight" block on Final (game 2) was not shown in the browser, but the section scrolls either way.
- Review: no Must-fix. Its Should-fixes were the DECISIONS rows and the screenshot coverage, which the run with teams on closes.
- Main `index` chunk 537.80 → 540.59 kB.

**How to try it:** `npm run dev`, host a game from `http://localhost:5173`, and join from a phone at `http://<LAN-IP>:5173/play/<code>` held in landscape. On a laptop, use devtools device mode at 667×375. Go through the lobby (tap "N here"), a buzz question with Buzz time and Answer time set, a choice question, a typed question (tap the box), and the end of the game. Or run `node .playtest/F96/drive.mjs ~/.npm/_npx/e41f203b7505f1fb/node_modules` with the dev server running.

## F95 — Set editor toolbar and outline (2026-10-30)
**What changed:**
- `/sets/:setId` (`pages/SetEditor.tsx`), now in `PageShell width="wide"`:
  - **Sticky toolbar** ("Set toolbar"): ← (Question sets), the set title as a button to the title field, the save status ("Saved ✓", "Saving…", or a red error), then Paste, Preview (the set, at the card in view), Print and **Add question**.
    - Below `md`, Paste, Preview set and Print move into a `⋯` menu. Add is the same button, `fixed` at the bottom on a phone and `md:static` in the bar.
    - "N questions need attention" appears when any question has errors and jumps to the first. Add and paste bring the new card into view.
  - **Outline** at `lg`: a sticky `nav` (number, first words, mode badge, red dot). Clicking an entry scrolls the card under the toolbar and focuses its Question field. `aria-current` follows scroll (new `lib/useCurrentCard.ts`). The cards stay one vertical list.
  - **Card:**
    - Header on one line: SVG grip, "Question N", Preview (an eye below `sm`) and `⋯`. The menu holds Move up, Move down, Duplicate and a red Delete that asks to confirm.
    - Fields: Question, then Mode | Points | Image (the image compact from `md`), then Answer/Choices | Host notes at `lg`. From `md` the text boxes size to their text (`field-sizing: content`).
    - Choices: a 44px radio label and a × Remove.
    - A file dragged over a card shows "Drop image for Question N", and the image hint reads "Drop or paste an image" on a mouse.
- `PasteQuestions`: opens under the toolbar and scrolls into view. Text and result sit side by side from `md`, with no inner scroll lists.
- `QuestionPreview`:
  - A letterboxed 16:9 stage on black, a `[container-type:size]` box.
  - `ScreenQuestion`, `ScreenChrome` and `lib/screenQuestion.ts` switched `vw`/`vh` to `cqw`/`cqh`. On the Screen page they fall back to the window.
  - The bar: **Show answer** is the primary, Close is a ✕, and the bar is one row from `sm`.
- Shared: `BUTTON_ICON` in `lib/ui.ts`, the `grip` icon, and `needsAttention`, `outlineText` and `MODE_LABELS` in `lib/setEditor.ts`. `.claude/rules/client.md` notes the `cq` units.
- Tests:
  - `SetEditor.test.tsx`: 57, up from 45. Move, duplicate and delete go through the card menu. New: toolbar contents and sticky class, the phone menu and fixed Add, the title button, Preview set, Add scrolling, the paste panel's place and scroll, outline entries, outline jump 25/30, `aria-current`, the attention count and jump, the header and grip, and Delete/Cancel in the menu. The drop overlay and choice controls are asserted in existing tests.
  - `QuestionPreview.test.tsx` +3 (stage, primary and ✕, one row). `useCurrentCard.test.tsx` (4), `setEditor.test.ts` +3.
  - 2451 tests in total. No new dependency.

**Decisions:** the seven DECISIONS rows dated 2026-10-30 for F95 (toolbar and fixed Add; outline; attention count; card header and grid; choices and drop; paste panel; preview stage and `cq` units).

**Notes for next session:**
- Playtest (Playwright, a 30-question set; the scrollbar takes 15px, so "375" is 360 of content):
  - 1440×900: a Buzz card is 408px (≤420). It was 464 before content-sized text boxes; `editor-1440.png` is from then and is stale. A Choice card is 496. A 250-character question grows the box with no inner scroll.
  - Outline entry 25: card 25 at top 128, its Question focused, entry 25 `aria-current`, and Preview set opened question 25. The first run showed entry 24 current; the observer band now starts at 136px, below the jump's `scroll-mt-32`.
  - 375×667:
    - The card header is one 44px row.
    - Nothing in a Choice card is under 44px, and the choice inputs are 252px wide.
    - No horizontal overflow.
    - Mid-page, the save status and Add are both on screen.
    - The preview stage is 375×211, the whole 16:9 frame, with the bar on two rows inside the window (`preview-375.png`).
  - 640×800: the preview bar is one row. 1440×900: the stage is 1440×810.
  - 820×1180: Paste's text area and result are side by side, and only the textarea itself could scroll.
  - No console errors.
- Not checked live: the real Screen after the `cq` switch. With no size container round `ScreenQuestion`, `cqw`/`cqh` resolve to `svw`/`svh`, which equal `vw`/`vh` on a TV or laptop. Worth a glance at 1920×1080 in F100, which works on those units anyway.
- On a phone (below `md`) the text boxes keep 2 rows and scroll inside, as before.
- The review's Must-fix was the stale screenshot; re-measured at 408px. Its Should-fixes are done: the title button's name includes the title, and the phone card title has more room. The toolbar's set title still truncates on a phone, which is fine because the full title field is just below.
- Main `index` chunk 537.37 → 537.80 kB.

**How to try it:** `npm run dev`, open `http://localhost:5173/sets`, open or create a set, and paste 30 lines like `Q N | A N` with **Paste**. On a laptop (≥1024 wide) use the outline on the left and the sticky toolbar; on a phone (`http://<LAN-IP>:5173/sets/<id>`) use the `⋯` menus and the bottom **Add question**. Open **Preview** on a card at phone size to see the letterboxed TV.

## F94 — Set library grid (2026-10-30)
**What changed:**
- `/sets` (`pages/Sets.tsx`):
  - It uses `PageShell width="wide"`; Room created uses the narrow one.
  - Header: "← Buzzr", the title, **New set** (gold), **Build a game** (outline) and **Backup ▾** (Import JSON, Export all). On a phone New set has its own row. The actions sit beside the title from `lg`, with the home link on that line at `xl`.
  - The tabs are an underline tab bar with counts ("Built-in 61", "My sets 3").
  - Cards: the title links to the editor (My sets) or opens the preview (built-in). The row is **Host** (gold, new `BUTTON_PRIMARY_SMALL`), **Preview**, and `⋯`. The menu holds Open, Duplicate, Export JSON and a red Delete (My sets), or Duplicate to My sets (built-in).
  - Card actions report in toasts. Success is green, a failure is red, and Host from the preview reports the same way. Import, Export all and the builder's Save keep their inline blocks, which now scroll into view.
  - The never-exported reminder is one line with **Export all**.
- New `components/OverflowMenu.tsx`: the menu-button pattern. Arrows, Home and End move through the items. Esc or choosing an item closes the menu and refocuses the trigger, and a press outside or Tab also closes it. A destructive item asks again in place (Confirm delete / Cancel).
- `SetBrowser` (actions mode): a `md:grid-cols-2 xl:grid-cols-3` grid per category, a `cardTitle` render prop, and tighter gaps. `onPreview` is gone, since Sets puts Preview in its own row.
- `Toast`: an optional `'done'` tone (green, `role="status"`). The default is unchanged, so the Host, Screen and Player toasts are as before.
- `SetPreview`: `lg:max-w-5xl` with 2 columns at `lg`. Under `short:` the whole dialog scrolls, in 2 columns with a compact header.
- `AnswerSheet`: below `sm`, stacked blocks (number and question, Answer, Notes). The table stays at `sm` and above, and always in print.
- Tests:
  - New `OverflowMenu.test.tsx` (11): opening and first focus, Esc returning focus, arrows/Home/End wrap, the trigger's arrow keys, choose and refocus, link items, disabled items, the destructive confirm, Cancel refocusing Delete, outside press and toggle, disarm on close.
  - `Sets.test.tsx`: 53, up from 42. Every existing flow was kept, with its queries moved into the menu. New: title → preview and → editor, Open in the menu, the menu's items and red Delete, Host as the gold primary and the grid classes, the header order and home link, the wide shell, tab counts and style, the Backup menu (Export all, Import opening the chooser, Export all off with no sets), toasts for Duplicate, Delete and Export, a failed Host as a toast, and an import result scrolled into view.
  - `SetBrowser.test.tsx` +2 (grid, `cardTitle` and Enter), `SetPreview.test.tsx` +1 (lg and short classes), `AnswerSheet.test.tsx` +1 (stacked blocks and table/print classes).
  - `test/hover.ts` accepts the gold buttons' hover and `hover:underline`.
  - 2429 tests in total. No new dependency.

**Decisions:** the seven DECISIONS rows dated 2026-10-30 for F94:
- the menu
- the card and `cardTitle`
- the header and Backup
- toasts against inline feedback
- the tab bar
- SetPreview's sizes
- AnswerSheet's two layouts and the hover helper

**Notes for next session:**
- Enter after a search on `/sets` now focuses the card's title link, not its first action.
- Each card button is named after its set (`Host <title>`, `Preview <title>`, `More actions for <title>`). Tests scope by card and use those names.
- The menus always open downward (Backlog). The sketch's tabs-on-the-search-row at `xl` was not built (Backlog).
- **Review:** one Must-fix. `scrollIntoView` is missing in jsdom, so `App.test.tsx` left an unhandled error in the full run. The call is now optional, and the full run has no errors. The review's other points are covered by tests and the measurements below.
- Measured with my Playwright script `.playtest/F94/audit.mjs` at 375×667, 667×375, 820×1180, 1024×768, 1440×900 and 1920×1080 (screenshots there; I checked sets, menu and sheet at 375, mine at 375, sets and preview at 1440, and preview at 667×375):
  - **Cards:** at 1440×900, 7 built-in cards are fully visible in 3 columns (first try 4, so I tightened the gaps). 820 has 2 columns, phones 1. No card's action row wraps at any size, and no title is clipped.
  - **Controls:** nothing under 44px at any size, and no horizontal overflow.
  - **Header:** at every size the home link is visible without scrolling and the first header button is New set. At 1024 and up, title and actions share one line.
  - **Menu and toast:** after scrolling to the 21st card, `⋯` → Esc returned focus to the trigger. Duplicate to My sets showed the green toast in view.
  - **Preview:** 8 whole questions at 1440×900, 6 at 1024×768. At 667×375 it shows 4 (2 whole) and scrolls as a whole, and **Host this set** is reachable at every size.
  - **Answer sheet:** at 375, the stacked list shows, no word is split across lines (every word measured as one rect) and the back link is 44px. With print media emulated, the table shows and the list is hidden at every width. The 1440 print screenshot (`sheet-print.png`) shows the same table as before.
  - No console errors.
- The playtest skill (Playwright, one tab) independently passed the grid, header, card menu with red Delete, the Export all notice, the preview width and short scroll, and the 390px sheet. No console errors.
- Main `index` chunk 536.87 → 537.37 kB.

**How to try it:** `npm run dev`, then open `http://localhost:5173/sets` at 1440×900, then at 820 wide and on a phone.
- Use `⋯` on a card (Esc, the arrow keys, Delete → Confirm delete) and **Backup ▾**.
- Duplicate a set from far down the list, and see the toast.
- **Preview** a starter at 1440 (two columns), and on a landscape phone.
- Open a set, then **Print answer sheet** on a phone (stacked) and in Chrome print preview (table).

## F93 — Landing and host picker on every screen (2026-10-30)
**What changed:**
- Landing (`pages/Landing.tsx`):
  - It uses `PageShell width="wide"`. At `md`, Join and Host are equal cards side by side. The Host card is `HostGame`'s closed state: a pitch line, **Host a game**, then **Question sets**.
  - At `lg` it is vertically centred.
  - While hosting, the hero shrinks to the logo, and the picker or the created room spans both columns.
- New `components/SetPicker.tsx`, shared by HostGame and NewGamePicker:
  - At the top: "← Back" ("Cancel" in the dialog), the heading, and **Build a game** as an outline button with its hint. Keep scores sits under them.
  - The set list flows with the page.
  - A "Picked set" `aside` holds the title, detail, **Preview**, any error and the main action. Below `lg` it is a sticky bottom bar; at `lg` it is a sticky right pane.
  - `index.css` adds a `scroll-padding-bottom` while the bar shows, so focus stops above it.
- `SetBrowser`:
  - It is an `@container`. Picker sets form a 1/2/3-column grid, and the search and chips share a row at `@2xl`.
  - Titles use `line-clamp-2`, not `truncate`.
  - Per-card Preview is gone from the pickers (it stays on `/sets`).
- `RoomCreated`:
  - Four option cards with icons: This is the Screen, Screen elsewhere, Host remote, Phone only. They form a 2×2 grid at `md`.
  - The cards are ordered by `usePointerFine()`, and the first is gold.
  - New icons in `Icon.tsx`: `tv`, `cast`, `remote`, `phone`.
- `NewGamePicker`: the whole dialog scrolls; it is `short:max-w-2xl`, `md:max-w-3xl` and `lg:max-w-5xl`, and uses `SetPicker`.
- `GameBuilder`:
  - The kind toggle is a segmented radio group.
  - Problem and error share one area above the actions.
  - Host, Save and Back are one row at `md`, and mixed rows are one line at `md`.
- `lib/ui.ts`: a disabled `BUTTON_PRIMARY` is `bg-edge text-muted` with no opacity.
- Tests:
  - `Landing.test.tsx` +9: cards, disabled Join, Back and Build, no list box, sticky summary following the pick, Preview → Create room, the four options, touch order, mouse order.
  - `SetBrowser.test.tsx` +2, `GameBuilder.test.tsx` +2, `NewGamePicker.test.tsx` +1.
  - Updated for the new structure: Cancel → Back, the RoomCreated names, radios for the toggle, a summary Preview in Landing, NewGamePicker and `Host.test.tsx`, and the new names in `Sets.test.tsx`.
  - 2403 tests in total. No new dependency.

**Decisions:** the six DECISIONS rows dated 2026-10-30 for F93:
- SetPicker and its bar
- Preview in the summary, whose action is now the main action
- the container grid thresholds
- the Landing layout and the hero
- RoomCreated's cards and pointer order
- the disabled primary, the segmented toggle, the builder row and the dialog widths

**Notes for next session:**
- **Preview changed:** it previews the picked set only, and its button now hosts or starts that set. "Pick this set" is gone from the pickers. `/sets` still has per-card Preview with **Host this set**.
- Ordering RoomCreated by pointer bends the "pointer variants never for layout" rule, because the roadmap asks for it. In Playwright's mobile emulation `(hover: hover) and (pointer: fine)` still matched, so the touch order was proven by unit tests only. At 820×1180 (touch, not `isMobile`) the browser showed the touch order.
- The layout bullets are proven by class assertions in the unit tests, plus my browser measurements below. jsdom has no layout.
- The review found no Must-fix. I fixed its Should-fixes: the DECISIONS rows, and a re-shot to confirm the `lg` summary title wraps in full. The other two went to the Backlog or are noted here: RoomCreated is not centred on tall windows, and the Bungee search placeholder clips at 375px.
- Measured with my Playwright scripts (`.playtest/F93/audit.mjs`, `picker.mjs` and `dialog-debug.mjs`; screenshots there, the ones I opened looked right):
  - **Landing:** at 1440×900 the block is 1088px wide (176–1264), with 244px above and 218px below. At 820 and 1024 the cards are side by side and of equal height. At 375 it is one column.
  - **Picker:** at 1440×900, 10 sets are fully visible in 3 columns with no clipped title. At 820×1180, 16 sets are visible.
  - **Sticky bar:** Create room and the picked title stayed in view after scrolling half and all the way, at 375×667, 667×375, 820×1180, 1024×768 and 1440×900.
  - **Back and Build a game:** 44px and 64px, in view at 375×667.
  - **No control under 44px** on the landing, picker or builder pages.
  - **GameBuilder:** the actions are on one row from 820px up.
  - **RoomCreated:** no title wraps at 375; all four cards are in view at 1024×768 and 1440×900.
  - **Disabled Join:** `rgb(46,41,112)` with `rgb(183,179,230)` text at full opacity.
  - **New game dialog** (room driven to FINAL by a socket script):
    - Remote: at 667×375 it is 651×359, scrolls, and every control was reachable. At 375×667, all 61 sets scroll clear of the bar.
    - Remote and Screen at 1440×900 and 1920×1080: 1024px wide, two panes, a 2-column grid, all reachable.
  - No console errors.
- The playtest skill (Playwright) independently passed Landing at `md`, the `lg` two panes with the sticky pane, the phone sticky bar, Create room and the RoomCreated cards. It did not open the dialog; my scripts covered that.
- Restart `npm run dev` between long browser runs. Each audit creates rooms, and the per-network room limit then answers "Too many rooms created from this network".
- Main `index` chunk 531.74 → 536.87 kB.

**How to try it:** `npm run dev`.
- Open `http://localhost:5173/` at 1440×900, then at 820 wide and on a phone.
- **Host a game**: search, pick, scroll (the summary or bar stays), **Preview** → **Create room**, then see the four cards.
- For New game: finish a game with the remote paired, then **New game** on the remote or the Screen. At 667×375 the dialog scrolls as a whole.
- **Build a game** shows the segmented toggle and the one-row actions.

## F92 — Responsive foundations (2026-10-30)
**What changed:**
- Variants and rules:
  - `index.css` has `@custom-variant short (@media (max-height: 500px))`. Its first use is `PageShell`'s `short:py-3`.
  - `.claude/rules/client.md` names the breakpoints, `short:`, the pointer variants and the device matrix, and points at the shared pieces. `.claude/` is git-ignored, so this is local only.
- `components/PageShell.tsx`: `narrow`, `content` (default) and `wide` map to `max-w-md`, `max-w-3xl` and `max-w-6xl`. Gutters are `px-4 md:px-8`, `py-6 md:py-10`, content is top-aligned, and an optional `header` slot sits above a `<main>`. `Placeholder` uses it, narrow.
- `lib/ui.ts`:
  - `LABEL` is `text-sm` (14px). `BUTTON_SECONDARY` has `HOVER`.
  - New `BUTTON_SMALL`, `DANGER` (the red tone and hover for any shape), `BUTTON_DANGER`, `FIELD` (`min-h-11`, `aria-invalid:border-buzz`) and `LINK` (a 44px muted text link).
  - The `smallButton` copies (Sets, SetEditor, GameBuilder), `PREVIEW_BUTTON` (SetBrowser), PasteQuestions' `button`, and both `field`s are gone.
- 14px floor: the Play header's team, room and "of N" lines, the SecondaryActions tiles and the SideCountdown "sec".
- Hover:
  - `HOVER` is on the Host tabs, the Read aloud pill, SecondaryActions, HostPlayers, the primary and judge buttons, HostBoard tiles, the avatar picker and the Player menu button.
  - The choice buttons get the tint only, because an ink border would look like "Your pick".
- Danger:
  - Delete set, Delete question and Kick use `BUTTON_DANGER`. The remote's End game tile and the Screen bar's End game add `DANGER` to their own shape.
  - `ConfirmButton` takes a `cancelClassName`, so Cancel stays neutral. Delete set moved after Host this set.
- Touch targets: every muted text link and link-style button uses `LINK`: Cancel (HostGame, NewGamePicker), Back to start, Question sets, ← Question sets, Back to question sets, Back to the sets, the preview's Close and Read aloud's Hide answer. The AnswerSheet back link and the Keep scores label are `min-h-11`.
- Pointer copy:
  - New `lib/usePointerFine.ts`, with `usePointerFine()` (`(hover: hover) and (pointer: fine)`, default false) and `usePointerCoarse()`.
  - New copy keys `clickToTest` and `clickToBuzzIn`, in English and Taglish. `buzzerState` takes `pointerFine`.
  - ReadAloud reads "Click to show answer" on a mouse. StartOverlay reads "Tap to start" on touch. The set pages say "Use **New set**" / "Use **Add question**".
- Tests:
  - New `PageShell.test.tsx` (7, including Placeholder), `usePointerFine.test.tsx` (6), `StartOverlay.test.tsx` (2) and `ConfirmButton.test.tsx` (3).
  - `copy.test.ts` +1, `buzzerState.test.ts` +1, `Play.test.tsx` +2 (Click copy in English and Taglish; a hover guard), `Host.test.tsx` +2 (Click to show answer; hover on all three tabs).
  - `HostControls.test.tsx` +2 (End game and Kick are red before arming, Cancel is not), `Sets.test.tsx` +1 and `SetEditor.test.tsx` +1 (Delete is red).
  - `test/hover.ts` accepts `DANGER`, and has a new `buttonsWithNoHover` for the remote and the Player.
  - 2391 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-30 for F92 (danger style and `cancelClassName`; pointer copy and its defaults; `LINK` and the FND-03 leftovers; `PageShell`'s landmarks).

**Notes for next session:**
- **F93–F101 build on these pieces.** Wrap pages in `PageShell`, and use `BUTTON_SMALL`, `BUTTON_DANGER`, `FIELD`, `LINK` and `short:`. Use `usePointerFine()` for any new Tap/Click copy, with Taglish for any new `copy.ts` key.
- FND-03's hand-written filled and outline buttons and `CARD`s are left for F94, F95 and F98, and the editor's and avatar cells' small targets for the EDT and PLY features. Both are listed in the Backlog.
- On `/sets`, SetBrowser's Preview still comes after Delete in a My sets row. Moving it first changes which button Enter focuses after a search (an existing test), so F94's card layout should settle the order.
- Review: no Must-fix. I fixed its Should-fixes: hover guards for the remote and the Player, Delete danger tests, Taglish Click copy rendered on the phone, and a Backlog item for the `document.title` flake (it was seen again by the reviewer).
- Playtest:
  - The playtest skill ran Playwright with a Screen, the host remote and two phones, one touch-emulated. No text under 14px, `PageShell` widths right, the End game tile red with confirm and Cancel, "Click or press Space to test your buzzer" on a mouse, and no console errors.
  - My own scripts in `.playtest/F92/`:
    - `audit.mjs`, at 375×667: no `button`, `a`, `input` or `select` under 44px on Landing, the open Host-a-game picker (`picker-375.png`, checked) and an AnswerSheet. An input inside a label is measured by the label.
    - `hover.mjs`, at 1440×900: all 41 enabled buttons changed look under the mouse, across the Player lobby and menu and the remote's Game (lobby and question), Players and Settings tabs.
  - Not covered in a browser: the Tap copy on a touch lobby. Unit tests cover it.
- Main `index` chunk 531.74 kB.

**How to try it:** `npm run dev`. At 1440×900, open `http://localhost:5173/` and **Host a game** → **Create room** → **Use this phone as the host remote**. Hover the tabs and buttons, and see End game and Kick in red. Join from another window at `/play/<code>`: the lobby reads "Click or press Space to test your buzzer". On a phone (or with devtools touch emulation) it reads "Tap to test your buzzer". `/nope` shows the PageShell placeholder.

## F91 — Taglish copy (2026-10-30)
**What changed:**
- Shared and server: `CopyLanguage` and `RoomSettings.copy` (`'en' | 'taglish'`, default `'en'`, schema `z.enum(COPY_LANGUAGES)`), merged by `host:settings` in any phase. `PlayerView.copy` is new. The Screen reads `settings.copy`.
- New `client/src/lib/copy.ts`:
  - Two tables, `EN` and `TAGLISH`, with 81 strings each (`{name}` placeholders).
  - `translator(language)`, `useCopy()` (Taglish only for a player or Screen view; host and no view are English), and `pointsText`/`rankText`.
  - `buzzerState` reads `view.copy`. `countdownText(countdown, t)` replaces `TIME_UP_LABEL`.
- Phone (`Play.tsx`): the in-game tree is translated: status, progress, top bar, menu, Change name, choices, typed box, countdowns, final result with team and tonight, and Who's here. `ShareResults` is translated too.
- Screen:
  - The lobby join text, room code, player count and waiting line.
  - The title card, with the difficulty translated.
  - The header pill and the join line.
  - The buzzer status, buzz banner, time up, lockout and false-start tags.
  - Choice and typed counts, the reveal and "nobody got it".
  - The standings rail, scoreboard and final screen, and the Reconnecting banner.
- Settings: a **Phone and Screen language** row (English / Taglish buttons) last in `HostSettings`, so it shows on the remote and in the Screen lobby. Compact rows are now `py-0.5` with a 4 px gap, so nine rows still fit at 1280×720.
- Tests:
  - New `copy.test.ts` (8): same keys, no blank strings, same placeholders, filling, points and ranks, language per role.
  - `buzzerState.test.ts` +4, `Play.test.tsx` +8, `Screen.test.tsx` +10, `HostControls.test.tsx` +2 (plus the compact row).
  - Also `views.test.ts` +1, `reducer.admin.test.ts` +1, `schemas.test.ts` +1, `useAnswerCountdown.test.ts` (Taglish time up).
  - 2362 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-30 for F91: the tables and who reads them; what stays English; the settings row and compact spacing.

**Taglish for Kim to review** (English → Taglish, drafted by Claude; edit `TAGLISH` in `client/src/lib/copy.ts`, and `copy.test.ts` keeps the keys and placeholders in step):
  - Tap to test your buzzer → I-tap para i-test ang buzzer mo
  - Get ready… → Humanda ka…
  - Get ready… you can buzz from the next question → Humanda ka… makaka-buzz ka na sa next question
  - Too early! → Masyadong maaga!
  - Answer sent → Sent na ang sagot mo
  - Buzzed… → Naka-buzz ka na…
  - Buzzers open! → Bukas na ang buzzers!
  - Time’s up! → Ubos na ang oras!
  - You’re first! Answer now → Ikaw ang una! Sagot na
  - {name} buzzed first → Si {name} ang unang nag-buzz
  - Someone buzzed first → May naunang nag-buzz
  - Type your answer → I-type ang sagot mo
  - Answers closed → Sarado na ang sagutan
  - Pick your answer → Pumili ng sagot
  - Your answer → Sagot mo
  - Correct! → Tama!
  - Answer revealed → Labas na ang sagot
  - Answer → Sagot
  - Locked out this round → Locked out ka muna sa round na ’to
  - {rank} of {count} → {rank} sa {count}
  - Question {n} of {count} → Tanong {n} sa {count}
  -  · tap to buzz in →  · i-tap para mag-buzz
  - You’re in! Waiting for the host → Pasok ka na! Hinihintay ang host
  - {team} team → Team {team}
  - Room {code} → Room {code}
  - of → sa
  - Change name → Palitan ang pangalan
  - Leave game → Umalis sa game
  - Confirm leave → Sigurado, aalis na
  - Game over → Tapos na ang game
  - {rank} of {count} teams · {points} → {rank} sa {count} na team · {points}
  - Tonight → Ngayong gabi
  - second to buzz → segundo para mag-buzz
  - seconds to buzz → segundo para mag-buzz
  - second to answer → segundo para sumagot
  - seconds to answer → segundo para sumagot
  - Your pick → Pinili mo
  - Send → I-send
  - Your name → Pangalan mo
  - Enter your name → Ilagay ang pangalan mo
  - That name won’t work → Hindi puwede ang pangalang ’yan
  - Cancel → Huwag na
  - Save → I-save
  - Who’s here · {n} → Nandito na · {n}
  - (you) → (ikaw)
  - Share results → I-share ang results
  - Download results → I-download ang results
  - Saved {file} → Na-save ang {file}
  - Couldn’t make the image → Hindi nagawa ang image
  - {n} point → {n} puntos
  - {n} points → {n} puntos
  - Get ready → Humanda na
  - Easy → Madali
  - Medium → Katamtaman
  - Hard → Mahirap
  - Join at → Sumali sa
  - Room code → Room code
  - Waiting for players… → Hinihintay ang mga player…
  - {n} player → {n} player
  - {n} players → {n} na player
  - No players yet → Wala pang player
  - Question {n} / {count} → Tanong {n} / {count}
  - Game {n} → Game {n}
  - Room → Room
  - Buzzers OPEN → BUKAS na ang buzzers
  - Buzzers locked → Sarado pa ang buzzers
  - {answered} of {expected} answered → {answered} sa {expected} ang nakasagot
  - {n} answered → {n} ang nakasagot
  - Answers locked → Hindi pa puwedeng sumagot
  - Nobody got it → Walang nakakuha
  - locked out → out na
  - Too early → Maaga
  - First to buzz → Unang nag-buzz
  - also buzzed → nag-buzz din
  - Standings → Standings
  - Players → Mga player
  - Scoreboard → Scoreboard
  - Final results → Final na resulta
  - Full ranking → Buong ranking
  - and {n} more → at {n} pa
  - Reconnecting… → Kumokonekta ulit…

**Notes for next session:**
- These stay English on purpose (DECISIONS F91):
  - Anything before the first snapshot: the room check, join form and "Joining…".
  - Server errors and name-rule messages.
  - Aria-labels.
  - The Screen's host-operated controls: the host bar, Start game, Settings, Pair host phone, the sound button and Click to start.
  - The results card image.
  The Backlog has the follow-ups.
- A new phone or Screen string goes into both tables. Typecheck refuses a key missing from `TAGLISH` (`Record<CopyKey, string>`), and `copy.test.ts` checks the keys, blanks and placeholders at run time.
- Review: no Must-fix.
  - Should-fixes done: this list in PROGRESS.
  - Already covered: the Taglish BUZZED/REVEAL Screen tests, which the reviewer missed.
  - Not changed: the `as never` view casts in `copy.test.ts`.
- Playtest (Playwright; host remote, one phone and the Screen at 390×844, then the Screen at 1280×720):
  - After the switch, the phone read "Pasok ka na! Hinihintay ang host", "Humanda ka…", "Tanong 1 sa 10", "Bukas na ang buzzers!", "Ikaw ang una! Sagot na" and "SAGOT".
  - The Screen read "Sumali sa", "Tanong 1 / 10", "HUMANDA NA", "BUKAS na ang buzzers", "UNANG NAG-BUZZ" and "SAGOT".
  - Switching back to English mid-game took effect at once on both. The landing page and the remote stayed English.
  - No answer before reveal. No console errors.
  - The first fit check found the lobby's Game setup panel overflowing by 55 px (518 / 463). After tightening the rows it measured 463 / 463, with the language row's bottom 4 px inside the panel (`.playtest/F91/lobby-1280.png`, checked).
- Main `index` chunk 524.76 → 530.94 kB.

**How to try it:**
1. `npm run dev`.
2. Host a set from `http://localhost:5173/sets` and join a phone at `http://<LAN-IP>:5173/play/<code>`.
3. On the remote's Settings tab, or the Screen lobby's settings, press **Taglish** under **Phone and Screen language**.
4. The phone and the Screen switch on the next snapshot, in any phase. The remote stays English.

## F90 — Category board: builder and devices (2026-10-30)
**What changed:**
- Builder (`lib/gameBuilder.ts`, `GameBuilder.tsx`):
  - A **Mixed questions / Category board** switch.
  - Board mode ticks 2–6 of the categories that have a playable Easy, Medium and Hard question (`boardCategories`).
  - `buildBoard` draws one question per level per category, column by column in tick order. Each question keeps its own points (the starters' 100/200/300).
  - The set is titled "Board: …", filed under "Mixed", and saves with its board.
  - The draw, title, picture loading and renumbering are shared with `buildGame`.
- Screen:
  - New `ScreenBoard`: one grid of titles and point tiles, played tiles dimmed, titles sized by column count.
  - With host controls there is a gold cursor ring. Arrows move it and Enter or a click picks. The bar shows **Pick <category> <points>** (Enter), or "Every tile played: End game".
  - The title card also shows on LOBBY → BOARD.
  - A pick zooms the question out of the tile's place (`tile-zoom`, 600 ms, `transform-origin` from the tile).
  - On a board set, the header pill reads "Animals · 200".
- Remote:
  - New `HostBoard` in BOARD, laid out on its side: a row per category, then its three tile buttons.
  - The question card, read-aloud heading and header pill name the tile.
- Shared logic:
  - New `lib/boardCursor.ts`: `firstUnused`, `moveCursor`, `tileAt`, `tileOf`, `boardDone`, `questionHeading`.
  - `hostControls`: REVEAL on a board reads **Back to the board** or **Show final results**. New `canGoBack`: Previous from any tile, hidden in BOARD, used by the remote, the bar and ←. The help table lists the arrows and Enter.
- Tests:
  - New `boardCursor.test.ts` (11). `gameBuilder.test.ts` +9, `GameBuilder.test.tsx` +7, `hostControls.test.ts` +5.
  - `Screen.test.tsx` +10: grid, keys, played tile, click, zoom, mid-question load, cursor reset, Previous, all played, title card.
  - `Host.test.tsx` +8.
  - 2327 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-30 for F90 (builder board mode; the Screen board, cursor, title card, zoom without an auto-open hold; the remote board on its side, Previous and the REVEAL labels).

**Notes for next session:**
- With F90 done, all of M19 (category board) is built. F91 is the last roadmap item.
- Playtest (Playwright, one browser context, so the Screen held the host token too; one player):
  - Board mode with 1 then 3 categories ticked.
  - Three tiles played: one picked on the remote, one on the Screen with ArrowRight, ArrowDown and Enter, and one more on the remote. The played tile was dimmed on both. A buzz judged Correct gave +200. No answer reached the Screen or phone before reveal. 0 console errors.
  - A 6-category check found two layout problems, both fixed and re-shot:
    - The Screen's per-column grids overlapped: long Bungee titles overflowed and the rows misaligned. It is now one grid with scaled titles; columns are equal and aligned at 1920×1080 and 1280×720.
    - The remote's 48 px columns broke words mid-letter. It is now transposed: 129 px titles, 56×48 tiles.
  - The cursor ring rendered white as a CSS outline, so it is now a box-shadow ring, checked gold.
  - Screenshots are in `.playtest/F90/`. The zoom wasn't caught mid-animation (it was finished at ~100 ms after the pick); only the unit test checks its class and origin.
- The phone still shows "Question N of M" in set order on a board set (Backlog).
- Review: no Must-fix. Its Should-fixes (DECISIONS rows, playtest claims, 6-column check) are done.
- Main `index` chunk 515.79 → 524.76 kB.

**How to try it:** `npm run dev`.
- At `http://localhost:5173/sets` press **Build a game**, then **Category board**. Tick 3 categories and press **Host this game**.
- Join a phone at `http://<LAN-IP>:5173/play/<code>` and start.
- On the Screen (the laptop that created the room), use the arrows and Enter to pick a tile; or tap one on the paired remote.
- After the reveal, **Back to the board**. Played tiles are dimmed, and Previous from a tile returns to the board.

<!-- entries below, newest first -->

## F89 — Category board: server (2026-10-30)
**What changed:**
- Shared:
  - `QuestionSet.board?: {columns: {title, questionIds}[]}` (`QuestionBoard`, `BoardColumn`), with `BOARD_COLUMNS_MIN/MAX` (2/6) and `BOARD_ROWS` (3).
  - Phase `'BOARD'` and `Room.usedQuestionIds`. A `BoardView` (titles; per tile `{questionIndex, points, used}`, no text) goes on the Screen and host views as `board`, null without a board.
  - New `host:pick {questionIndex}`.
- Schemas: `boardSchema` (2–6 columns, titles trimmed to 1–40, exactly 3 ids each). A set-level check refuses a tile that is not a question of the set, or a question on the board twice. The import file schema now uses `safeExtend`, because zod 4 won't `extend` a refined object, so imports keep the board check.
- Reducer:
  - `host:start` on a board set goes to BOARD (`questionIndex` -1, no title-card hold).
  - `host:pick` (BOARD only) refuses an index that is not a tile, or a used tile. Otherwise it marks the tile used and plays the question through `enterQuestion`, with auto-open as on a Next.
  - `host:next` from REVEAL goes to BOARD, or to FINAL after the last tile. The scoreboard counts tiles picked.
  - `host:prev` from a question phase or REVEAL goes back to BOARD and frees nothing.
  - BOARD joins the team-change phases. `host:newGame` and `createRoom` reset `usedQuestionIds`.
- Views and gateway: `boardView`. `nextQuestion` and `nextImageId` are null on a board set. A `host:pick` handler. Phone: a grey "Get ready…" in BOARD.
- Tests:
  - New `reducer.board.test.ts` (39): start, auto-open, pick, plays as usual, used and off-board tiles, the wrong phases, next to BOARD and FINAL, scoreboard cadence, prev from 3 phases, scores kept, End game after prev from the last tile, buzzes and other actions in BOARD, team moves, a stale timer, new game.
  - `schemas.test.ts` +9, `views.test.ts` +5 (plus BOARD in the canJudge/canUndo/canChangeTeams matrix), `sockets.test.ts` +2, `importExport.test.ts` +1, `buzzerState.test.ts` +1. Fixture `makeBoardSet` in `server/test/rooms.ts`.
  - 2278 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-30 for F89 (schema and off-board questions; BOARD view and index -1; start, pick and auto-open; next, prev and the empty board; teams and the phone).

**Notes for next session:**
- **F90 builds the board UI on `view.board`.** Until then the Screen and remote render nothing designed for BOARD, and no client sends `host:pick`. Pick a tile by `tile.questionIndex`.
- The Screen's title card triggers on LOBBY → QUESTION with index 0, so a board game never shows it. F90 could show it on LOBBY → BOARD.
- The remote's and the Screen host bar's Previous are disabled at `questionIndex <= 0` (`SecondaryActions.tsx`, `ScreenHostControls.tsx`). On a board set, Prev from any tile is valid (back to BOARD), so F90 should enable it there and hide it in BOARD.
- In BOARD, the phone's header has no "Question N of M" line, because `questionIndex` is -1.
- After a Prev out of the last tile, the board is all used and only End game finishes the game. F90's remote should make that obvious (Backlog has the alternative).
- Backlog: the editor keeps `board`, so deleting a tile's question breaks hosting the set.
- The review found no Must-fix. I fixed its Should-fixes: the DECISIONS rows, and a table of actions refused in BOARD.
- No playtest: server-only feature with no UI. Main `index` chunk 514.98 → 515.79 kB.

**How to try it:** `npm test -- server/reducer.board.test.ts server/views.test.ts server/sockets.test.ts shared/schemas.test.ts`. There is no UI until F90. A set JSON with a `board` imports at `http://localhost:5173/sets` and hosts. The Screen and remote then sit in BOARD, and you pick a tile by sending `host:pick {questionIndex}` from a socket script, as in `.playtest/F87/drive.mjs`.

## F88 — Typed answers: devices (2026-10-30)
**What changed:**
- Lib:
  - `buzzerState` has a new kind `typed`: "Type your answer", then "Answer sent", or "Answers closed" when locked with no answer.
  - New `gotItRight(view)` (choice pick or typed group) drives "Correct! +100" and the reveal vibration for both modes.
  - `hostControls.primaryFor` reads **Reveal and score** (`host:reveal`) on a typed question in ANSWERING.
  - `useChoiceCountdown` is now `useAnsweringCountdown` and reads `choice?.timer ?? typed?.timer`.
- Phone (`Play.tsx`):
  - New `TypedAnswer`, keyed per opening: a text box (80 characters) and **Send** in place of BUZZ. It sends `player:answer {text}`, and Enter sends too.
  - Send is off while the box holds `mine`, and an edit can be re-sent until the lock. Then the box shows `mine`, and a refusal toasts.
  - At REVEAL the box stays, disabled, with no Send.
  - Space no longer buzzes from inside an input. `useChoiceHaptics` is now `useAnswerHaptics`.
- Remote: new `TypedMarking.tsx`, shown under the question card.
  - It shows "N of M answered", or "Answers closed · N answered".
  - Each group has its spelling, a "Pre-marked" tag, its count and a checkbox from the server's `correct`. A tick sends the whole ticked set as `host:markTyped` through the command lock.
  - The boxes are read-only at REVEAL. In read-aloud the groups wait for the lock.
- Screen (`ScreenQuestion.tsx`): new `TypedBoard`.
  - "Answers locked" before opening, then the countdown and "N of M answered", then "Answers closed".
  - At REVEAL: the answer, plus a chip in each player's colour for everyone in a correct group, or "Nobody got it".
  - Shared pieces: `AnsweringProgress`, `AnswersPill`, `AnswerText` (also used by `ChoiceBoard` and `Reveal`).
- Tests:
  - `Play.test.tsx` +13: box, trim, Enter, Space, sent, re-edit, lock, closed-with-none, refusal, before open, countdown, next question, reveal right/wrong, vibration.
  - `Host.test.tsx` +10, `Screen.test.tsx` +6 (5 typed plus the host bar).
  - `buzzerState.test.ts` (6 typed; replaces F87's "Answering…"), `hostControls.test.ts` (Reveal and score), `useAnswerCountdown.test.ts` +1.
  - 2220 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-30 for F88 (phone; remote; Screen).

**Notes for next session:**
- With F88 done, all of M17/M18 (choice and typed) is built.
- Review Should-fix, not changed: `TypedMarking.toggle` builds the set from the last snapshot. That is safe only because `command.busy` disables the boxes until the next snapshot; keep that lock if the remote's command handling changes.
- Backlog item added: a group's spelling breaks ties by code point ("PARIS" beat "paris" in the playtest); marking from the Screen; sounds at a typed reveal.
- Playtest (Playwright; one host tab, three players in their own contexts; a one-question Typed set, "Paris" with alternative "The City of Light"):
  - "paris", "  PARIS " and "The City of Light" arrived as 2 groups, both pre-marked.
  - The host unticked one group, then **Reveal and score**: Ann and Bob got "Correct! +100", and Cy got "Answer Paris" and 0.
  - The Screen showed the countdown and "0 of 3 answered", then "Answers closed · 3 answered". At reveal it showed PARIS with Ann ✓ and Bob ✓ (`.playtest/F88/reveal-screen.png`, checked).
  - No answer text on the Screen or phones before reveal. No console errors read on the host tab.
  - Not covered: re-editing before the lock (the round closed when all three had answered) and the player and Screen consoles. Unit tests cover re-editing.
  - After the playtest, Send was hidden at REVEAL.
- Main `index` chunk 509.90 → 514.98 kB.

**How to try it:** `npm run dev`. At `http://localhost:5173/sets`, set a question's **Mode** to **Typed**, with alternatives one per line, then **Host a game**. Join 3+ phones at `http://<LAN-IP>:5173/play/<code>` and pair a phone as the remote. On the typed question press **Open answers**, type variants on the phones, tick or untick groups on the remote, then **Reveal and score**.

## F87 — Typed answers: data, editor and server (2026-10-30)
**What changed:**
- Shared: `TYPED_ANSWER_MAX` (80). `Room.typed {answers, marks, closed}` (`TypedAnswers`). View types `TypedGroup`, `TypedView`, `HostTypedView`, `PlayerTypedView`. `player:answer` is now `{choice} | {text}` (a zod union; text trimmed, 1–80). New `host:markTyped {groups: string[]}` (≤ 50 keys of ≤ 80).
- Server:
  - New `server/typed.ts`: `normaliseAnswer` (accents, case, whitespace), `acceptedKeys` (answer + host-notes lines), `isCorrectKey` (own-key mark, else pre-mark) and `typedGroups`.
  - Reducer:
    - `opened()` sends typed questions to ANSWERING (`takesAnswers` replaces `isChoice`).
    - `playerTypedAnswer` records the text.
    - On all answered or `answeringClosed`, `closedTyped` locks the answers and the room stays in ANSWERING.
    - `hostMarkTyped` records the host's marks, and `host:reveal` runs `scoredTyped`, then goes to REVEAL.
    - Kick, leave and disconnect drop the player's typed answer; `clearedQuestion` resets `typed`.
  - Views: `typed` on every view; groups reach the Screen and phones only at REVEAL, the phone gets `mine`, and the host gets every group with `preMarked`. The gateway has a `host:markTyped` handler, and `player:answer` passes text through.
  - Ownership: `withAnswersIn` and the "answered" count now use `Object.hasOwn`.
- Client: the editor's Mode select offers **Typed**, and the notes field then reads "Other accepted answers (optional)", one per line. `previewView` fills `typed`. Until F88: "Open answers" in QUESTION, "Answering…" on the phone, and no false start.
- Tests:
  - New `reducer.typed.test.ts` (36): normalising, open and timer, auto-open, answer/replace/same, refusals, grouping, pre-marks from alternatives, marks while open and after close, later groups, close by all answered, disconnect and time, stale close, scoring, penalty, no lockout or undo, next/prev, "constructor" and "__proto__".
  - `views.test.ts` +6 and three typed rooms in the canJudge/canUndo matrix. `sockets.test.ts` +3, `schemas.test.ts` +2.
  - `SetEditor.test.tsx` +3 (and the Typed option), `setEditor.test.ts` +1, `hostControls.test.ts` +1, `buzzerState.test.ts` +1.
  - 2184 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-30 for F87 (lock, then host reveal; normalising and groups; markTyped's semantics; the payload, refusals and scoring; the views and editor).

**Notes for next session:**
- **F88 builds the device UI on `view.typed`.**
  - Until then a typed question can be selected and opened, but the phone shows "Answering…" with no text box.
  - The remote's primary action reads Close answers in ANSWERING (`host:reveal`: it scores as pre-marked and reveals), and nothing sends `host:markTyped` yet.
  - The Screen shows the buzz status ("Buzzers locked") for a typed question.
- F88 should rename the action to **Reveal and score**. `view.typed.closed` tells "still taking answers" from "locked, waiting for the host".
- **Marking:** send the full ticked set as `host:markTyped {groups: keys}`. Each group's `correct` already folds in pre-mark and mark, so tick from it. `preMarked` is there to label pre-marked groups.
- **At REVEAL:** the Screen's "names of the players who got it" are the `playerIds` of groups with `correct`, from `view.typed.groups`.
- Typed questions share `choiceSeconds` (still no stepper; Backlog).
- **Review fix:** a group keyed "constructor" was correct through the prototype chain. `isCorrectKey` now reads own keys only, and marks are built with `Object.fromEntries`.
- Playtest (Playwright plus Node socket scripts in `.playtest/F87/`; one browser phone and 4 script players):
  - Editor Typed mode, the relabelled notes and persistence. Trimmed text, with 0 and 81 characters refused.
  - "  PARIS " and "Pâris" grouped as `paris`, pre-marked; "Pa  ris" its own group.
  - No answers or groups in the Screen or other phones' views before REVEAL. The 10 s close locked the answers in ANSWERING ("Answers are closed").
  - markTyped after the close, then reveal scored 100 for the marked groups. Close by all answered was covered by the unit tests only.
  - No console errors. No screenshots.
- Main `index` chunk 509.77 → 509.90 kB.
- The unnamed flake again: in the final verify, one full `npm test` run failed 1 of 2184, and the dot reporter didn't name it. The next three full runs passed. See the F84/F85 notes (likely `AnswerSheet.test.tsx`'s `document.title`).

**How to try it:** `npm test -- server/reducer.typed.test.ts server/views.test.ts server/sockets.test.ts`. In the app (`npm run dev`), set a question's **Mode** to **Typed** at `http://localhost:5173/sets` and add alternatives one per line. In a game, **Open answers** starts a 10 s answering; answering from a phone arrives with F88. Until then, use a socket script like `.playtest/F87/drive.mjs`.

## F86 — Multiple choice: devices (2026-10-30)
**What changed:**
- Shared/lib: `CHOICE_COLORS` (A red, B blue, C yellow, D green). `useChoiceCountdown` (`useAnswerCountdown.ts`) counts `choice.timer` like the buzz countdown. `hostControls.ts`: `ControlsView` includes `choice`; `primaryFor` gives **Open answers** for a choice question in QUESTION and **Close answers** (`host:reveal`) in ANSWERING; ANSWERING joins `UNREVEALED` (Skip, `R`). The Screen's host bar and Space follow, as they share `primaryFor`.
- Screen (`ScreenQuestion.tsx`): `ChoiceBoard` replaces the buzzer status for a choice question. A 2-column grid of lettered tiles, then "Answers locked" (QUESTION) or the time left in a red pill and "N of M answered" (ANSWERING). At REVEAL the correct tile gets the gold ring and a check, the others dim to 35 %, every tile shows its count, and no scorer is named.
- Phone (`Play.tsx`, `buzzerState.ts`): `ChoiceButtons` replace the round BUZZ button. New kind `choice`: "Pick your answer", then "Answer sent". A tap marks "Your pick" before the ack and sends `player:answer`; a refusal drops it and toasts. "N seconds to answer". In QUESTION the buzzers are disabled, with "Get ready…" and never "Too early!". At REVEAL: "Your answer / Correct! / +100" (new `caption` on `BuzzerState`), or the answer text and any penalty. `useChoiceHaptics` vibrates on ANSWERING → REVEAL with a pick.
- Remote: new `ChoiceTally.tsx` under the question card (progress, per-choice count and share bar, correct marked; in read-aloud only at REVEAL). `PrimaryAction`'s side countdown is now `SideCountdown` with a label ("Buzz time" or "Time to answer"). The editor's `previewView` fills `choice`.
- Tests:
  - `hostControls.test.ts` +3, plus ANSWERING in the Space and R tables
  - `useAnswerCountdown.test.ts` +2
  - `buzzerState.test.ts` (choice: ask, sent ×2, no Too early, Correct!, wrong/none; replaces F85's "Answering…")
  - `Screen.test.tsx` +7 (tiles and colours, two tiles, countdown and progress, no marks or counts before REVEAL, Answers locked, REVEAL lit tile and counts, host bar Open/Close answers with Space)
  - `Play.test.tsx` +12, `Host.test.tsx` +9, `setEditor.test.ts` +3, `constants.test.ts` (colours)
  - 2128 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-30 for F86 (tile colours and the Screen; the phone's buttons, labels and haptics; the remote's labels, tally and read-aloud; the preview).

**Notes for next session:**
- Choice buttons send on click, not pointerdown: the client rule's pointerdown is for the buzzer race. The phone's `main` is `touch-none`, so the choices list sets `touch-auto` to scroll if it overflows.
- The playtester saw a phone read "3 seconds to answer" on first look. That was the 10 s `choiceSeconds` count already 7 s in; the remote's **Answer time** setting is the buzz winner's time and does not touch it. Still no Choice time stepper (Backlog).
- Main `index` chunk 502.78 → 509.77 kB (152.64 kB gzip); the bundle Backlog item still stands.
- Playtest (Playwright, `.playtest/F86/mixed.json`: buzz, choice "Largest planet?" (B Jupiter), buzz; one real phone plus 2 bots).
  - Checked: the remote's Open answers, then Close answers with its countdown and tally.
  - The Screen's tiles, countdown and "1 of 3 answered", with no `data-correct` or "correct" before reveal; at reveal the lit B with counts 0/1/0/0 and Ann's score 0 → 100.
  - The phone's "Answer sent" with "Your pick", then "Correct! +100"; the remote's tally kept at REVEAL with Next question; Previous, Skip and Next replay with no stale marks. No console errors.
  - Screenshots: `answering-screen.png`, `reveal-screen.png` (1920×1080) and `reveal-player.png`. No remote screenshot and no 375 px phone shot of ANSWERING.

**How to try it:** `npm run dev`. Make a set at `http://localhost:5173/sets` with a question whose **Mode** is **Choice** (or import `.playtest/F86/mixed.json`), then **Host a game** on the laptop. Join phones at `http://<LAN-IP>:5173/play/<code>` (or bots at `/dev/bots/<code>`), and pair a phone as remote. On the choice question press **Open answers** (or Space on the Screen). Tap a choice on each phone, then watch "N of M answered" and the tally. It reveals when all have answered, after 10 s, or on **Close answers**.

## F85 — Multiple choice: server (2026-10-30)
**What changed:**
- Shared: `Phase` adds `'ANSWERING'`; `RoomSettings.choiceSeconds` (int 5–30, default 10; `CHOICE_SECONDS_MIN/MAX/DEFAULT`); `Room.answers` (playerId → choice) and `Room.answeringTimer`; `player:answer {choice}` (int 0–3) in `ClientPayloads` and `clientPayloadSchemas`; view types `ChoiceView`, `HostChoiceView`, `PlayerChoiceView`, `AnsweringTimerView`.
- Reducer (`server/reducer.ts`): `opened()` sends a choice question QUESTION → ANSWERING as a new opening (from `host:open`, auto-open, and question 1's auto-open after the title card), and any other question to OPEN. `withAnsweringTimer` (beside `withBuzzTimer`, both now typed `Done`) starts `choiceSeconds` and schedules `answeringClosed {questionIndex, openingCounter, at}`. `playerAnswer` records or changes a pick. `withAnswersIn` in `reduce` closes once every connected player has answered (after an answer, a disconnect, a kick or a leave). `closedAnswering` scores through `applyJudgement` (correct +points, wrong 0 or −points with the penalty, no lockout, no undo point) and reveals. `host:reveal` in ANSWERING closes early; `host:prev` and `host:end` drop the answers unscored. ANSWERING joins `QUESTION_PHASES`. A press in QUESTION of a choice question is no false start.
- Views (`server/views.ts`): `choice` on every view, field by field: Screen/Player get `choices`, `answered` of `expected`, `timer {seconds}`, and `correctChoice` + `counts` only in REVEAL; the phone gets `mine`; the host gets `correctChoice`, `counts` and `answers` always. Gateway: a `player:answer` handler on the buzz rate budget.
- Tests: new `reducer.choice.test.ts` (39: open, timer, settings, auto-open both ways, answer/change/same, wrong phases, out of range, all answered incl. disconnect, kick and late joiner, nobody connected, stale closes ×3, scoring, judgements, penalty, no lockout, reveal early, no undo, judge/open refused, prev, end), `views.test.ts` +7 (serialised check for no `correctChoice`, `counts`, `"answer"` or `"answers"` before REVEAL; REVEAL fields; host; null for buzz) and two choice rooms in the canJudge/canUndo matrix, `sockets.test.ts` +6 (answer → views, all answered → REVEAL, timer close with fake timers, invalid payloads, non-player socket, rate budget), `schemas.test.ts` +2, `constants.test.ts` +1, `buzzerState.test.ts` +1; ANSWERING added to the any-phase lists of `reducer.admin.test.ts` and `reducer.lobby.test.ts`; settings shape assertions now include `choiceSeconds`. 2086 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-30 for F85 (Room fields and the setting; closing on all connected; scoring, no undo, no fx, no lockout; auto-open, false start and the rate budget; the views).

**Notes for next session:**
- **F86 builds the device UI on `view.choice`.** Until then the phone's buzzer area reads "Answering…" in ANSWERING (`buzzerState.ts`) with no way to answer, the remote and Screen have no primary action for ANSWERING (`BY_PHASE` in `hostControls.ts` has no entry; Skip's `UNREVEALED` list lacks ANSWERING), and a choice question closes on its timer with nobody scored. `R`/Skip and the remote's primary button need ANSWERING ("Close answers" → `host:reveal`).
- No `fx` at close: the Screen's correct/wrong sounds and the phone's vibration must come from the REVEAL snapshot (`choice.mine` vs `choice.correctChoice`, `pointsThisQuestion`). `scorerId` is the latest correct judgement, so with several correct players it names only one; the Screen's reveal should use `choice` instead.
- `choiceSeconds` has no stepper yet (no roadmap bullet asks for one); it's settable over `host:settings` only. Consider a Settings row in F86 or Backlog; the Screen lobby's settings column is full at 1280×720 (F83 note).
- The editor's `previewView` sets `choice: null`, so the preview of a choice question shows no choices until F86 fills it.
- Flake seen again by the reviewer: one full `npm test` run failed 1 test, the `document.title` assertion in `client/src/pages/AnswerSheet.test.tsx` ("names the printout after the set, and restores the title on leaving", ~line 86). Every other full run passed. That's likely F84's unnamed flake.
- No playtest: server-only feature; the socket tests drive real Socket.IO clients through open → answer → REVEAL. Main `index` chunk 502.66 → 502.78 kB.

**How to try it:** `npm test -- server/reducer.choice.test.ts server/views.test.ts server/sockets.test.ts`. In the app (`npm run dev`), a set with a choice question goes to ANSWERING on **Open buzzers** and reveals after 10 s; answering from a phone arrives with F86.

## F84 — Multiple choice: data and editor (2026-10-30)
**What changed:**
- Shared: `Question.mode?: QuestionMode` (`'buzz' | 'choice' | 'typed'`, absent = buzz), `choices?: string[]`, `correctChoice?: number`; constants `QUESTION_MODES`, `CHOICES_MIN`/`CHOICES_MAX` (2/4), `CHOICE_TEXT_MAX` (80), `CHOICE_LETTERS` (A–D).
- `questionSchema` (`shared/schemas.ts`): a `superRefine` requires `choices` and an in-range `correctChoice` for choice questions (and a non-blank answer for the others), then a `transform` sets `answer` to the correct choice's trimmed text and drops stray `choices`/`correctChoice` from non-choice questions. The server's room creation, `checkPlayable`, export and import all go through it.
- Editor (`SetEditor.tsx`, helpers in `lib/setEditor.ts`): a per-card "Mode" select (Buzz, Choice). Choice shows the `ChoicesField`: A–D inputs, a "Choice X is correct" radio each, Remove (above 2), Add choice (below 4); the helpers `setMode`, `setChoiceText`, `setCorrectChoice`, `addChoice`, `removeChoice` keep `answer` equal to the correct choice. `questionErrors` gives "Write choice B." and "Pick the correct choice."; `checkPlayable` names the question.
- Tests: `schemas.test.ts` +6 (valid and derived answer, missing choices or correct, out of range, counts and lengths, buzz/typed modes, strays dropped), `setEditor.test.ts` +7, `SetEditor.test.tsx` +7, `importExport.test.ts` +3 (round trip, blank answer derived, refusals with paths; two expected messages now read "The answer is required"), `hostRoom.test.ts` +2, `http.test.ts` +1 (stored room has the derived answer), `constants.test.ts` +1. 2023 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-30 for F84 (derived answer and dropped strays; the editor's mode select and choices; buzz play until F85).

**Notes for next session:**
- **A choice question plays as a buzz question until F85.** `viewQuestion` in `server/views.ts` names its fields, so `choices` and `correctChoice` reach no view yet; F85 adds `choices` to Screen and Player views and must keep `correctChoice` out until REVEAL. `HostView.question` is the whole `Question`, so the remote already gets them.
- zod 4 runs an object's `superRefine` even after a field's `min`/`max` check failed (not after a type error), hence the `correctChoice < CHOICES_MAX` guard in `questionSchema`.
- The editor's Typed option is F87's; an imported typed question shows a disabled "Typed" option and plays as buzz.
- Playtest (Playwright, editor at 390×844): mode select, Choice with A/B, Add choice to D and Remove down to 2, marking B correct, autosave, Export JSON (`mode`, `choices`, `correctChoice: 1`, `answer: "Paris"`), Import back with mode and radio kept. No console errors. Not checked visually at 375 px, and no screenshots taken. File: `.playtest/F84/export.json`.
- Main `index` chunk 501.56 → 502.66 kB (151.02 kB gzip).
- One full `npm test` run during the final verify reported 1 failed test out of 2023. The dot reporter didn't name it, and it never came back: the next three full runs passed, and five runs of the touched files passed. It could be a timing flake somewhere; if it shows up again, note the file.

**How to try it:** `npm run dev`, open `http://localhost:5173/sets`, open or create a set, and on a question card set **Mode** to **Choice**. Fill A–D, mark the correct one, then **Export JSON** from the set list and import it again.

## F83 — Teams: host controls (2026-10-29)
**What changed:**
- Views carry `canChangeTeams` (`canChangeTeams(room)` in `server/reducer.ts`, true in LOBBY and REVEAL, the same `TEAM_PHASES` the reducer checks), like `canUndo`. The editor's `previewView` sets it only for its REVEAL preview.
- `HostSettings.tsx`: a last "Teams" row (Off, 2, 3, 4 from `TEAM_COUNT_CHOICES`) that sends `{teams}` only, disabled while `canChangeTeams` is false. It's on the remote and in the hosting Screen's compact lobby, and the presets leave it alone. `SecondsStepper` became `ChoiceStepper`, with an optional `less` label ("Fewer teams"). Compact rows are tighter (steppers `size-7`, presets `h-7`, 6 px gaps), so all eight rows still fit at 1280×720.
- `HostPlayers.tsx`: rows are now a `PlayerRow` component. With teams on, `TeamGroups` shows one group per team in index order: colour square, name in the team's colour, player count, team score, "No players yet" when empty. Each row has a native "Team for <name>" select that sends `host:setTeam` and shows the snapshot's team. A player on no team (which the server never leaves) would show under "No team".
- Tests: `HostControls.test.tsx` +19 (stepper: Off by default, six steps, 4 stops +, disabled while teams can't change, presets leave teams, compact; Players: grouping and order, heading colour, empty team, select value and options, move only with the snapshot, refused move, select disabled, teams off, no-team fallback), `Host.test.tsx` +2 (Players tab grouping and a move over the socket; Settings tab stepper over the socket), `views.test.ts` (canChangeTeams matches what the reducer accepts in every phase, both answers covered). Compact size assertions now expect `size-7` and `h-7`. 1996 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F83 (`canChangeTeams` on the views; the Teams row, its detail and presets; the Players tab's groups and native select).

**Notes for next session:**
- **The Screen lobby's settings column is now full at 1280×720.** With no host phone paired, the aside is 463 px and its content 463 px (no inner scroll; the Teams row ends flush with the aside's bottom). At 1366×768 there are 22 px spare, and at 1920×1080 there are 223 px. Any further lobby settings row (such as the language setting) needs another squeeze or a fold. Before the fix, the first playtest showed the Teams row cut off under an inner scrollbar; the page itself never scrolled, so a page-level check missed it.
- Playtest (Playwright, room with 5–8 bots, remote at 375 and 390 px, Screen at 1280×720 and 1920×1080). Checked: stepper Off→2→3→4 with + stopped at 4; the Screen lobby's stepper; Players grouped Red/Blue/Green(/Yellow) with counts; a move from the remote reached the phone ("Blue team") and the Screen's columns; teams off from the Screen removed the groups; selects and both stepper buttons disabled in QUESTION and with buzzers open, enabled in REVEAL; at 375 px in REVEAL a row wraps to two lines (−100 +100 Custom / select … Kick) with no horizontal overflow. No console errors (the one warning is socket.io's dev-mode "WebSocket is closed before the connection is established" at page load). Files: `.playtest/F83/`.
- Main `index` chunk 499.37 → 501.56 kB (150.74 kB gzip), now past Vite's 500 kB warning (build still passes). Backlog item added.

**How to try it:** `npm run dev`, then on the laptop open `http://localhost:5173/` → **Host a game**. In the lobby, the settings beside Start game end with **Teams**; press + for 2–4 teams. Join phones at `http://<LAN-IP>:5173/play/<code>` (or bots at `/dev/bots/<code>`). Pair a phone as host remote: **Players** tab shows the team groups; change a player's team with their select (lobby or after Reveal answer only).

## F82 — Teams: Screen and phone (2026-10-29)
**What changed:**
- New `client/src/lib/teams.ts`: `teamOf` (the player's team from `memberIds`) and `teamsByRank` (the server's rank, index order on ties).
- Screen lobby (`pages/Screen.tsx`): with teams on, one column per team in index order. Each column has a border in the team's colour, the name in that colour, the player count and the members' chips in join order; an empty team shows "No players yet". One shrink-to-fit now runs on a wrapper round either the chip list or the columns, which drops the ref casts.
- `ScreenResults.tsx`: the Scoreboard puts team cards above the players, who then take the dense text. On FinalResults, the "Team podium" stands the teams (tied teams share a step, a 4th team is named under it), and the Full ranking and Tonight cards stay the players'. `StandingsRail.tsx`: every team by rank, then the top 3 players (`STANDINGS_TOP_WITH_TEAMS`).
- Phone (`pages/Play.tsx`): a "<Team> team" line with a colour square under the name in the top bar; in the final state, "<Team> team · 2nd of 3 teams · 450 points" above Tonight.
- Tests: `teams.test.ts` (3), `ScreenResults.test.tsx` +6 (team podium and ties, 4th team, colour and score, players after, scoreboard teams first, teams off), `Screen.test.tsx` +7 (columns and order, heading colour and count, empty column and a move, teams off, rail, scoreboard, Final), `Play.test.tsx` +6 (top bar in lobby and mid-game, a move, teams off, final team line, teams off at final). 1974 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F82 (lobby columns; teams first on the scoreboard, rail and Final; the phone's team line).

**Notes for next session:**
- Playtest (Playwright, room with 6 bots + one phone at 390×844, Screen at 1920×1080). Teams were forced on by rewriting the create-room request to `settings.teams = 2`, because the stepper is F83. Checked: the lobby's columns (Red 4, Blue 3), "Red team" on the phone's top bar (from the page text; the colour was not checked), the rail with teams first, the scoreboard at question 6, the Final team podium, and the phone's team line. No console errors. Files: `.playtest/F82/`.
- **Not checked visually:** the rail with 4 teams above the host bar at 1080p (only 2 teams were played), the phone's top bar mid-game in a screenshot, and the lobby chip fit after the wrapper refactor (same behaviour, jsdom only).
- F83: the host's team select and teams stepper. Re-measure the Screen lobby's settings at 1280×720 (F64/F65 note). Columns of a 4-team lobby with 50 players lean on the shrink-to-fit; worth a look then.
- Player rows on the scoreboard keep their own colour dots, so "Bot 1" can show a red dot while on Blue.
- The results card image (F78) has no teams yet; it could go in Backlog if wanted.
- Main `index` chunk 494.92 → 499.37 kB (150.22 kB gzip).

**How to try it:** until F83 adds the stepper, a host turns teams on over the socket (`host:settings {teams: 2}` in the lobby) or with a create-room request carrying `settings.teams`. Then `npm run dev`, open `http://localhost:5173/screen/<code>` on the laptop and `http://<LAN-IP>:5173/play/<code>` on phones (or `/dev/bots`): the lobby shows team columns, phones show their team, and the scoreboard, rail and Final rank teams first.

## F81 — Teams: server (2026-10-29)
**What changed:**
- Shared: `RoomSettings.teams` (`TeamCount` 0, 2, 3 or 4; default 0), `TEAM_COUNT_CHOICES`, `TEAMS` (Red, Blue, Green, Yellow, palette colours), `Player.team: number | null`, `TeamView`, `teams: TeamView[] | null` on Screen, host and Player views, `host:setTeam {playerId, team}` (zod: team an integer 0–3).
- `server/reducer.ts`: a joiner goes to the smallest team (lowest index on a tie); a new team count regroups everyone in join order (off sets all to null); `host:setTeam` moves a player. Both only in LOBBY or REVEAL (`TEAMS_PHASE_ERROR`); the same count is accepted in any phase. Scores still change only in `applyJudgement`.
- `server/ranking.ts`: `rankTeams` (tied teams share a rank, listed by index), sharing one ranking core with `rankPlayers`. `server/views.ts`: `teamsView`, the summed score, rank and members of each team, in index order. `server/sockets.ts`: the `host:setTeam` handler.
- Tests: new `reducer.teams.test.ts` (38: join assignment, balance, reconnect, mid-game join, count on, change and off, same count keeps moves, phase rules, setTeam errors, leave and kick, new game, scoring through judge, penalty, undo, adjust, move), `ranking.test.ts` +3, `views.test.ts` +5, `schemas.test.ts` +2, `constants.test.ts` +2, `sockets.host.test.ts` +1; fixtures gained `team` and `teams`. 1952 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F81 (LOBBY and REVEAL only, with the `host:settings` exception; assignment and regrouping; summed scores, index order, teams on every view).

**Notes for next session:**
- No UI yet: F82 (Screen and phone) and F83 (host stepper and team select). The client only got `teams: null` in fixtures and the editor's `previewView`.
- F83's teams stepper is another lobby settings row: re-measure the Screen lobby's settings at 1280×720 (F64/F65 note) when it lands. The stepper should be disabled outside LOBBY and REVEAL, or the host will see the phase error.
- When BOARD and ANSWERING arrive (M21/M22), decide whether BOARD counts as "between questions" for `TEAM_PHASES`.
- A player who leaves takes their points off their team's score.
- Main `index` chunk 494.70 → 494.92 kB (149.40 kB gzip).

**How to try it:** server only, no UI yet. `npx vitest run server/reducer.teams.test.ts server/views.test.ts`. Over sockets, a host sends `host:settings {teams: 2}` in the lobby and every `state` carries `teams`.

## F80 — Export all and import many (2026-10-29)
**What changed:**
- `client/src/lib/importExport.ts`: `setFileEntry` (shared by Export JSON), `exportAllFile` (`{sets: [...]}` text plus the count and each skipped set's reason; drafts, missing images and sets that would take the file over the 201 MB import cap are skipped), `exportAllFileName` (`buzzr-sets-YYYY-MM-DD.json`), `parseImportFile` (`bad` / `one` / `many`; each many-set entry parsed on its own and labelled "Set N “Title”"). `parseSetFile` kept for single files.
- New `client/src/lib/lastExport.ts`: guarded localStorage `buzzr:lastExport`.
- `pages/Sets.tsx`: on My sets, a bar with "Last export: <date>" or "Never exported…" and **Export all**; "Exported N sets to <file>." with a Skipped list; import of a many-set file adds each good set ("Imported N sets.") and lists each bad one under "Couldn't import X of Y sets from <file>:"; sets stored before a failed write still show.
- Tests: `importExport.test.ts` +8 (many-set file and skipped drafts, missing image, many-set round trip with images, mixed valid and invalid, single-set and bad wrappers, size limit, limit wording, file name), `lastExport.test.ts` (3), `Sets.test.tsx` +5 (Export all download, skipped and Last export; stored last export; drafts only; many-set import with a bad set; failed write midway). 1901 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F80 (file shape, skips and size cap; many-set detection and per-set errors; Last export counts only Export all).

**Notes for next session:**
- A picture shared by two sets is embedded once per set; an Export all of many duplicated sets is bigger than it needs to be.
- `exportAllFile` builds the whole text in memory (up to 201 MB); fine for real libraries, heavy at the cap.
- Playtest (Playwright, `/sets` only): Export all of 2 sets, then 8 with an empty draft listed as skipped; a mixed many-set file imported 2 and listed Set 2's errors; a single-set file still imports; Last export shown after export and "Never exported" after clearing the key. No console errors. Image embedding and the size cap were checked by unit tests only. Files: `.playtest/F80/`.
- Main `index` chunk 494.67 → 494.70 kB (149.28 kB gzip).

**How to try it:** `npm run dev`, open `http://localhost:5173/sets`, **My sets** tab (duplicate a built-in set first if it is empty). Read the "Never exported" line, press **Export all**, then **Import JSON** the downloaded `buzzr-sets-<date>.json`: every set comes back as a new copy.

## F79 — Bulk paste questions (2026-10-29)
**What changed:**
- New `client/src/lib/bulkPaste.ts`: `parsePaste` reads one question per line as `Question | Answer | points` or, when the paste has any tab, as spreadsheet cells; it handles quoted cells (`""`, delimiter or line break inside), trims stray spaces, skips blank lines and empty trailing cells, defaults points to 100, and returns the good questions plus each bad line with its line number, source and every reason. `addPasted` appends them with fresh ids, up to 100; `pasteRoom` gives what still fits.
- New `components/PasteQuestions.tsx`: the panel with the text area, a live preview ("N questions found", "N lines skipped" with reasons), the "Only N more questions fit" note, **Add N questions** and Cancel. `SetEditor.tsx`: **Paste questions** beside **Add question** (disabled with it at 100); after adding, the panel closes and the first new card takes focus. The empty-set text mentions it.
- Tests: `bulkPaste.test.ts` (15: both formats, CRLF, pipe in a cell, stray spaces and blank lines, quotes, literal quotes, unclosed quote, every bad reason, mixed paste hint, trailing cells, multi-line cell line number, empty paste, append, limit), `SetEditor.test.tsx` +4 (preview with reasons, Add appends and saves a spreadsheet paste, limit note and cap, disabled Add and Cancel). 1885 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F79 (format per paste and the mixed-paste reason; trimming, quotes and too many cells; preview, limit note and focus).

**Notes for next session:**
- A paste mixing tab and pipe lines reads every line as cells; pipe lines are skipped with "This paste has tabs, so | doesn't split cells."
- A header row from a spreadsheet ("Question / Answer / Points") is skipped as a bad line (points not a whole number); the rest still adds.
- Playtest (Playwright, 390×844, new empty set): pipe and tab pastes, quoted pipe, stray spaces, bad-line reasons, Add 2, then 100 lines into a 2-question set showed "Only 98 more questions fit" and filled the set to 100 with Add question disabled. No console errors. Screenshot: `.playtest/F79/limit-editor.png`. The mixed-paste reason was added after the playtest (unit test only).
- Main `index` chunk unchanged at 494.67 kB (149.27 kB gzip).

**How to try it:** `npm run dev`, open `http://localhost:5173/sets`, edit a set, press **Paste questions** and paste lines such as `Capital of France? | Paris | 200`, or copy three columns from a spreadsheet. Check the preview, then **Add N questions**.

## F78 — Results card (2026-10-29)
**What changed:**
- New `client/src/lib/resultsCard.ts`: `cardFromRoom` (Screen, remote) and `cardFromPlayer` (phone) build the card's data; `cardLayout` gives the podium (generic `podiumSteps`) and each ranking cut to 10 with "and N more"; `drawResultsCard` paints a 1080×1350 card (logo, set title, date, podium, Full ranking, or This game and Tonight from game 2; no room code); `renderResultsCard` loads the fonts and encodes a PNG; `shareOrDownload` uses `navigator.share` with the file where `canShare({files})` allows, else downloads `buzzr-results.png`.
- New `components/ShareResults.tsx`: **Share results** on the remote's Game over card and the phone's final state; **Download results** in the Screen's host bar in FINAL. Inline "Saved buzzr-results.png" after a download, "Couldn’t make the image" on failure.
- Server: `PlayerView.results` in FINAL only (title, top 10 of the game and of the night, with counts), new `RESULTS_CARD_ROWS = 10` in `shared/constants.ts`, `TopRows` and `PlayerResults` types.
- Tests: `resultsCard.test.ts` (17: podium order and ties, top 10 cut, join-order sort, night from game 2, phone input, 1080×1350, drawn text, no code, avatar and ellipsis, crowded tie "+N" clear of the date, date format, share / download / failed share / cancel / download mode), `views.test.ts` +2 (FINAL-only results with top 10 and night; game 1 with no RTT, answer or note), `Host.test.tsx` +2, `Play.test.tsx` +3, `Screen.test.tsx` +2. New `test/share.ts` stubs. 1866 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F78 (`PlayerView.results` in FINAL, widening F77's own-line-only rule; card layout; share vs download and the fallbacks).

**Notes for next session:**
- `renderResultsCard` and font loading only run in a real browser (jsdom has no canvas); tests use a recording context and mock the render.
- iOS Safari can reject `navigator.share` once the tap's activation has expired; that path falls back to a download. Not seen on a real phone yet.
- Playtest (Playwright): 12 players (Ann and 11 bots), two games. Remote, phone and Screen bar each produced `buzzr-results.png`; stubbed share got an `image/png` file. Game 1 card: Full ranking 10 rows "and 2 more", no Tonight, no code; game 2: This game and Tonight side by side. Cards: `.playtest/F78/host-download.png`, `game2-host.png`. After the playtest the podium steps were shortened and name lines capped so a large tie on the top step can't reach the date (unit test, not re-rendered).
- Main `index` chunk 489.38 → 494.67 kB (149.27 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room → Use this device as the Screen; pair a phone and join players at `http://<laptop-LAN-IP>:5173/play/<CODE>`. Play to the end: **Share results** on the remote's Game over card and on each phone opens the share sheet (or downloads `buzzr-results.png` on desktop); move the mouse on the Screen for the bar's **Download results**. Play a second game for the Tonight column.

## F77 — Session totals: devices (2026-10-29)
**What changed:**
- Server: `PlayerView.tonight` = `{total, rank, count}` from the ranked session totals, null in game 1 or before the player's first tally. Only the player's own line reaches the phone.
- Screen Final (`ScreenResults.tsx`): from game 2 a **Tonight** card beside Full ranking, top 10 totals plus "and N more", players who left dimmed. `RankingList` takes generic rows and a `dense` flag (no largest text). `ScreenHeader` takes `gameNumber`: the centre pill reads "Game N" in the lobby and the Final from game 2; during play it keeps "Question N / M".
- Remote `GameOverCard`: "Game N" pill beside the heading and a **Tonight** list (rank, colour, name, total) under the game ranking; rows share a new `RankRows`. Phone final: "Tonight · 2nd of 5 · 650 points" under the score. New `pointsLabel()` in `lib/results.ts`, reused by `buzzerState`.
- Tests: `views.test.ts` +2 (own total and rank only, ties, leaver counted, no other names; null in game 1 and for an untallied player), `ScreenResults.test.tsx` +3 (absent in game 1; ranked beside the game ranking with a leaver dimmed; top 10 and "and 3 more"), `Screen.test.tsx` +3 (Tonight and "Game 2" in FINAL; neither in game 1; question number kept in game 2), `Host.test.tsx` +2, `Play.test.tsx` +2. Fixtures gain `tonight: null`. 1840 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F77 (`tonight` on the phone, superseding F76's "the phone gets nothing"; Tonight card layout, 10-row cap, leavers dimmed; "Game N" pill and the remote's uncapped list).

**Notes for next session:**
- With Tonight shown the podium narrows to 2/6, so "Final results" wraps to two lines at 1920×1080; it still fits.
- The remote's Tonight list is uncapped; with 50 players it is long but scrolls.
- Playtest (Playwright): room TJZB, Ann and Bo, two games (100/200, then 300/0). Game 1 Final: no Tonight, no "Game N" anywhere. Game 2: Screen header "Game 2", Tonight Ann 400 / Bo 200 beside Full ranking Ann 300 / Bo 0; remote card same; phones "1st of 2 · 400 points" and "2nd of 2 · 200 points". Screenshot: `.playtest/F77/final-screen.png`.
- Main `index` chunk 487.42 → 489.38 kB (147.24 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room → Use this device as the Screen; pair a phone and join two players at `http://<laptop-LAN-IP>:5173/play/<CODE>`. Play to the end, press **New game**, play again: at game 2's Final the Screen shows Tonight and "Game 2", the remote's Game over card lists Tonight, and each phone shows its night rank and total.

## F76 — Session totals: server (2026-10-29)
**What changed:**
- Shared: `Room.session: Session` = `{gameNumber, totals, players, carried}`. `gameNumber` starts at 1; `totals` is playerId → points over every finished game; `players` is name, colour, avatar and `joinedAt` at each player's latest tally; `carried` is the scores Keep scores brought into the current game. New view types `RankedTotal` and `SessionView`; `SharedRoomView.session` (Screen and host) is `null` in game 1 and ranked totals from game 2 on. Phone views do not get it.
- Reducer: `tallied()` runs on entering FINAL, from the last `host:next` or from `host:end` in any other phase (not again from `host:end` in FINAL). It adds score − carried for every present player and refreshes their identity. `host:newGame` adds 1 to `gameNumber` and sets `carried` (scores with Keep scores, `{}` without), so totals come out the same either way. `host:adjustScore` in FINAL moves the total by the same delta. Leave and kick don't touch the session, so a departed player keeps their earlier total and name.
- Views: `sessionView()` ranks with `rankPlayers` (now generic over `{score, joinedAt}`), so ties share a rank and list in join order. A total with no recorded identity is skipped rather than throwing.
- Tests: `reducer.newgame.test.ts` +14 (game 1 empty, last `host:next`, `host:end` once, identities, no undo after FINAL, two games, three games with Keep scores on and off giving equal totals, new game leaves totals, late joiner, leaver and kicked keep totals, mid-game leaver loses that game, rename at next tally, FINAL correction carried, FINAL vs earlier adjust); `reducer.flow.test.ts` `host:end` expectations now include the tally, plus FINAL → FINAL does not count again; `views.test.ts` +6 (null in game 1, ranked with ties and leavers on Screen and host, empty, orphan skipped, not on the phone and `carried` never sent, reducer-driven three-game totals). Client view fixtures and `setEditor.ts` gain `session: null`. 1828 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F76 (score less carried, `players` and `carried` beyond the spec; when the tally runs, FINAL corrections, totals not live; `session` null in game 1, ranked, not on the phone).

**Notes for next session:**
- F77 (devices) reads `view.session` on the Screen's Final (Tonight panel) and the remote. During game 2's lobby and play it holds game 1 only; at game 2's FINAL it includes game 2.
- A total can belong to someone no longer in `players`. If the panel marks present vs left, compare `session.totals[].id` with `view.players`.
- Mutation-checked: without the carried subtraction, 3 tests fail; with `host:end` tallying in FINAL, 2 fail.
- No playtest: no UI changed. Main `index` chunk unchanged at 487.42 kB (146.70 kB gzip).

**How to try it:** server only; nothing renders it until F77. Run `npx vitest run server/reducer.newgame.test.ts server/reducer.flow.test.ts server/views.test.ts`.

## F75 — Avatars: devices (2026-10-29)
**What changed:**
- Phone: the join form has an **Avatar (optional)** grid of the 24 emoji under the name, as toggle buttons (`aria-pressed`); tapping the chosen one clears it. `player:join` carries `avatar` only when one is picked. `playerIdentity` stores it per room with the name (`z.enum(AVATARS).optional().catch(undefined)`: an unknown stored avatar is dropped, the identity kept), so a refresh rejoins with it; Leave game refills name and avatar; a taken name keeps the pick. The top bar's gold circle shows the avatar in place of the initial, the initial without one. "Who's here" shows avatars too.
- New `components/PlayerAvatar.tsx` (emoji, `aria-hidden`, `data-avatar`; nothing without one). Placed before the name, colour kept, in the Screen lobby chips, scoreboard and Final full ranking (`RankingList`), podium, standings rail and the remote's Players tab.
- `RankingList`: `minmax(0, 1fr)` columns, avatar inside the name span, gap 0.6em, rank column 1.4em, so scores never clip and a long name ellipsizes.
- Tests: `playerIdentity.test.ts` +4, `Play.test.tsx` +8 (grid, payload and storage, clear on retap, refresh rejoin, taken name keeps it, Leave refill, top bar avatar vs initial, Who's here), `Screen.test.tsx` +4 (lobby chips, scoreboard, rail, podium and full ranking; none without), `ScreenResults.test.tsx` +3 (shrinkable columns at 1/2/3 columns), `HostControls.test.tsx` +1 (Players tab). 1808 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F75 (avatar beside the colour, not replacing it, off the phone; toggle grid, per-room storage, unknown avatar dropped; ranking grid and row tightening).

**Notes for next session:**
- Still no way to change an avatar after joining (F74). Leave game rejoins under a new playerId (F61), so a new pick there applies.
- Not shown yet: Screen buzz banner, "also buzzed", Too early chips, remote's Game over standings. Backlog item added.
- Playtest (Playwright): room SZDC (Ann 🦊, Bea 🐼, Cal 🚀): grid, storage, top bar, Who's here, lobby chips, rail, podium, Players tab pass; Final full ranking clipped scores at 1920×1080. After `minmax(0, 1fr)` alone (room YYKQ, with Dan without avatar), "Ann" truncated to "A…". After the row tightening (room YUGR, plus "Alexandria" 🐙): names in full, Alexandria ellipsized, no clipping at 1920×1080 or 1280×720; scoreboard fine; Dan shows "D" on the phone and plain name elsewhere. Screenshots: `.playtest/F75/final2-1920.png`, `final2-1280.png`, `scoreboard2.png`, `lobby-screen.png`, `lobby-ann.png`, `lobby-dan.png`.
- Main `index` chunk 486.06 → 487.42 kB (146.70 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room → Use this device as the Screen. On phones at `http://<laptop-LAN-IP>:5173/play/<CODE>`, pick an avatar under the name (or none) and join: the avatar is in the phone's top bar and on the Screen's chips; play to the end for the podium and full ranking. A paired host phone's Players tab shows them too.

## F74 — Avatars: server (2026-10-29)
**What changed:**
- Shared: `AVATARS` in `shared/constants.ts`, 24 emoji, each one code point with emoji presentation. `Player.avatar?: string`. `RankedPlayer`, `LobbyPlayer` and `PlayerView.me` gain `avatar?`. The `player:join` payload takes optional `avatar`, validated by `z.enum(AVATARS).optional()`.
- Reducer: a new player stores the avatar when one is sent. A reconnect keeps the stored avatar and ignores the payload's, even when the player had none, as it does for the name. Two players may share one. Rename keeps it.
- Gateway passes `avatar` to `reduce`. Views: `avatarOf()` adds the key only when set, in Screen and host `players`, the phone's `lobby` and `me`.
- Tests: `constants.test.ts` +1 (24, distinct, single emoji glyph), `schemas.test.ts` +2 (each avatar and none accepted; unknown, empty, doubled, variation selector, number, null rejected), `reducer.lobby.test.ts` +7 (stored, none, shared, reconnect with another, reconnect with none, reconnect adds none, rename keeps), `views.test.ts` +4 (Screen, host, `me`, lobby; key absent without one), `sockets.test.ts` +2 (end to end with reconnect; unknown avatar refused, nobody added). 1788 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F74 (single-code-point list, shared avatars; reconnect keeps the stored one, SPEC-QUESTION; key absent rather than null).

**Notes for next session:**
- There is no way to change an avatar after joining. If F75's join form lets a returning device pick another avatar, the server keeps the old one. A change would need its own event, like `player:rename`.
- `Player.avatar` is typed `string`, as in the spec. Only the join schema restricts it to `AVATARS`.
- Mutation-checked: when the gateway does not pass `avatar`, the sockets test fails.
- No playtest, because no UI changed. Main `index` chunk 485.87 → 486.06 kB (146.30 kB gzip).

**How to try it:** this is server only, and nothing in the UI sends an avatar until F75. Run `npx vitest run server/reducer.lobby.test.ts server/views.test.ts server/sockets.test.ts shared/schemas.test.ts shared/constants.test.ts`.

## F73 — Settings presets (2026-10-29)
**What changed:**
- Client: `HostSettings` gains a **Presets** row at the top (`role="group"`, label, **Party** and **Competitive** buttons with `aria-pressed`), so in the remote's Settings tab and the Screen lobby. A press sends one `host:settings` with the preset's five keys (auto-open, penalty, answer time, buzz time, false start); it is marked while those five keys match the room's settings. Party: auto-open on, penalty off, answer, buzz and false start off. Competitive: auto-open off, penalty on, answer 5 s, buzz 10 s, false start 0.5 s. Client-only; no server or schema change.
- Compact (Screen lobby) rows tightened: `py-2` → `py-1`, steppers `size-9` → `size-8`, presets `h-8`, so eight rows and Start game fit at 1280×720.
- Tests: `HostControls.test.tsx` +11 (placement and order, each payload, none on defaults, each active, mark drops on one differing key, command lock until the snapshot; compact size assertions updated), `Screen.test.tsx` +1 (lobby presets above the switches, Party payload, mark), `schemas.test.ts` +1 (both five-key payloads accepted). 1772 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-29 for F73 (same five keys in both presets, Competitive turns auto-open off; scoreboard and standings not in either; row placement and the compact tightening).

**Notes for next session:**
- The Screen lobby now has 9 px spare at 1280×720 (aside scrollHeight 463 = clientHeight 463). Any further settings row (teams, language) will not fit without another layout change, such as two columns or folding the settings.
- Clicking an already active preset sends the same values again; harmless.
- Playtest (Playwright): room CQSE, remote 390×844 and Screen 1920×1080: both presets set every value on both views, the mark follows edits from either device. Room XBEU found the lobby aside scrolling at 1280×720 (524 vs 463); after the tightening, room SXFD fits at 1280×720 and 1920×1080 with no clipping. Screenshots: `.playtest/F73/lobby-1280-screen.png`, `lobby-1920-screen.png`, `competitive-1280-screen.png`.
- Main `index` chunk 484.81 → 485.87 kB (146.15 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room → Use this device as the Screen: the lobby's settings start with Presets; click **Competitive**, then **Party**, and watch the switches and steppers follow. On a paired host phone (`http://<laptop-LAN-IP>:5173/host/<CODE>`), the Settings tab shows the same row.

## F72 — False start: devices (2026-10-29)
**What changed:**
- Shared and views: `SharedRoomView.falseStarts` (Screen and host) and `PlayerView.falseStartMs`.
- Client: new `lib/useFalseStartWait.ts`, true from the first OPEN/COLLECTING snapshot of an opening until `falseStartMs` later, keyed by question index and opening counter. `buzzerState` gains the `early` kind ("Too early!", `TOO_EARLY_LABEL`) and a 4th argument `held`: in QUESTION with the setting on, the grey button is live and a local press or `falseStart` gives `early`; in OPEN/COLLECTING a held false starter is `early` and sends nothing. `Play.tsx`: amber pressed-in look (`bg-warn`) and `text-warn` status line.
- Screen: `ScreenQuestion` shows a `Too early` list, chips in the player's colour with a small amber tag, in QUESTION and during the wait. `HostSettings`: **False start** stepper Off / 0.5 s / 1 s after Buzz time (stepper takes a `format`), in the remote's Settings tab and the Screen lobby.
- Tests: new `useFalseStartWait.test.ts` (6), `buzzerState.test.ts` +7, `Play.test.tsx` +5 (press in QUESTION, off, wait then buzz at once with fake timers, waiter live at once, refused press), `Screen.test.tsx` +3, `HostControls.test.tsx` +6 (Off default, 4 steps, labels and ends) and the compact test extended, `views.test.ts` +2. 1759 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-29 for F72 (view fields and device-counted wait, SPEC-QUESTION; grey but pressable QUESTION button; Screen chips with tag; stepper placement and no own vibration).

**Notes for next session:**
- The device wait restarts on a reload or reconnect mid-wait, so a phone can hold up to one wait longer than the server. Never shorter.
- No haptic for `fx falseStart` beyond the press's 30 ms tap; Backlog item added.
- Playtest (Playwright): room STVC, Screen 1920×1080, Alice at 390×844, a bot; stepper Off → 0.5 s → 1 s in the Screen lobby, early press amber "Too early!", Screen tag, a press 150 ms after opening ignored, then "Buzzers open!" and Alice won the next press; remote Settings tab stepper. Second run (room FMKB): seven compact rows and Start game fit at 1280×720 and 1920×1080 with no overflow. Screenshots: `.playtest/F72/2-early-player.png`, `2-early-screen.png`, `3-lobby-1280-screen.png`.
- Main `index` chunk 483.13 → 484.81 kB (145.91 kB gzip).

**How to try it:** `npm run dev`. Host a game, use this device as the Screen, set **False start** to 0.5 s or 1 s in the lobby. On a phone at `http://<laptop-LAN-IP>:5173/play/<CODE>`, press the grey button while the question shows: "Too early!" in amber, and a "Too early" tag on the Screen. Open the buzzers: the phone stays amber for the wait, then reads "Buzzers open!".

## F71 — False start: server (2026-10-29)
**What changed:**
- Shared: `RoomSettings.falseStartMs: 0 | 500 | 1000` (`FalseStartMs`, `FALSE_START_MS_CHOICES`, default 0, `z.literal` in `roomSettingsSchema` and so in `host:settings`). `Room.openedAt` (monotonic start of the opening) and `Room.falseStarts` (playerIds, press order). `Fx {kind: 'falseStart', playerId}`. `PlayerView.falseStart`.
- Reducer: `reduce(room, action, now, mono?)`; a post-step `withOpening` stamps `openedAt = mono` whenever `openingCounter` moves, and clears `falseStarts` unless the opening came from QUESTION. `player:buzz` in QUESTION with the setting on records the player once and emits `fx falseStart`; otherwise it is still ignored silently. In OPEN, COLLECTING and BUZZED a false starter's press with `receivedAt < openedAt + falseStartMs` is ignored (ends inclusive). `clearedQuestion` resets both fields; kick or leave drops the player from the list; `host:settings` merges the key.
- Gateway: `dispatch` passes `monotonic()` to `reduce`. Views: `PlayerView.falseStart`. Client: `soundForFx` returns null for `falseStart` and `useScreenSounds` skips it, so the Screen stays silent.
- Tests: `reducer.buzz.test.ts` +11 (record, once, order, title-card hold, off, other phases, unknown player), `reducer.window.test.ts` +13 (stamp on open and reopen, 499/500 ms edge, 1000 ms, others at once, COLLECTING and BUZZED, late dispatch, autoOpen keeps, reopen clears, kick reopen clears, kicked false starter, next/prev clear, setting off releases, no `mono`), `sockets.buzz.test.ts` +4 (fx to every device and `falseStart` state, 500 ms monotonic wait, other player at once, off by default, bad value rejected), `views.test.ts` +2, `schemas.test.ts` +1, `constants.test.ts` +1, `sounds.test.ts` +1, `Screen.test.tsx` +1; fixtures in admin, newgame, roomStore, `buzzerState` and `Play` tests. 1730 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-29 for F71 (`openedAt` from the gateway's `mono`, SPEC-QUESTION; who keeps or clears false starts; a held press is an ordinary ignore, setting read at the press; silent Screen).

**Notes for next session:**
- `mono` is optional so the hundreds of existing `reduce(room, action, now)` test calls stay as they are; without it `openedAt` is null and nobody is held. The gateway is the only production caller and always passes it (a sockets test fails if it stops). Making it required is a possible later tidy-up.
- `canBuzz` is still true during the wait (the view carries no time). F72 should drive "Too early!" from `falseStart` plus `settings.falseStartMs`, counting from the OPEN snapshot. A press inside the wait is acked `{ok: true}` and changes nothing.
- F61's DECISIONS row says a false start needs its own vibration trigger: `fx falseStart` with the player's own id is that trigger.
- Mutation-checked: an off-by-one in the wait, never clearing on reopen, and the gateway not passing `mono` each fail tests.
- No playtest: no UI changed. Main `index` chunk 483.03 → 483.13 kB (145.52 kB gzip).

**How to try it:** server only; nothing in the UI turns it on until F72 adds the stepper and the phone states. Run `npx vitest run server/reducer.window.test.ts server/reducer.buzz.test.ts server/sockets.buzz.test.ts`.

## F70 — Pairing PIN (2026-10-29)
**What changed:**
- Server: new `server/pairing.ts` `PairingStore` (outside `Room`): one PIN per room, 6 digits from `crypto.randomInt`, salted SHA-256 compared in constant time, valid 60 s (`PAIRING_PIN_TTL_MS`), single use, deleted on the 5th miss, replaced by a new request, and freed by an unref'd timer. It holds the presented hostToken for the PIN's life (the room keeps only the hash). `http.ts`: `POST /api/rooms/:code/pairing` (Bearer; 201 `{pin}`, 401, 404) and `POST /api/rooms/:code/pair` (`PAIR_RATE_LIMIT` 5/min per IP, then per room, 429; 400 malformed; 413 over 1 KB; 401 for every other failure; 200 `{hostToken}`). Shared: `pairBodySchema`, `PairingResponse`, `PairBody`, `PairResponse`, the `PAIRING_PIN_*` and `PAIR_*` constants.
- Client: `api.ts` `createPairingPin`, `pairWithPin`. `PairHostPhone` asks for a PIN each time it opens and shows it (`NNN NNN`) beside the QR with the remote's address (`<join origin>/host/CODE`, wrapping before `/host`); a late answer for an earlier opening is dropped; failure says "PIN unavailable. Use the QR." New `HostPinEntry`: `/host/:code` without a token shows **Pair this phone** (numeric field, Pair at 6 digits, server message in an alert) instead of "Not authorised"; the token joins through the existing accept-then-store path.
- Tests: new `http.pair.test.ts` (20: each status, 60 s edge, single use, replace, revoke, both limits, IP-first, 413, timer frees, old timer keeps new PIN), `PairHostPhone.test.tsx` +3, `Host.test.tsx` PIN entry (5 new; the Not authorised tests now expect the PIN entry), `App.test.tsx`, `api.test.ts` +6. 1695 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-29 for F70 (token held beside the PIN, SPEC-QUESTION; one PIN per room and dialog states; status codes and limit order; PIN entry page).

**Notes for next session:**
- Five junk tries in a minute from anyone lock a room's PIN entry for that minute (per-room limit from the Done-when); the QR still pairs.
- Hide does not revoke the PIN on the server; it lives out its 60 s. Backlog item added.
- Playtest (Playwright): run 1 at 1920×1080 Screen + phone context (room CPJK): PIN beside the QR, remote paired by PIN, Screen dialog closed on join; curl-style checks of 401/201/200/401 reuse/401 after 62 s/400/429. Revoke after 5 misses is not reachable from one IP (the 429 comes first); unit-tested from 5 IPs. Run 1 found the address breaking inside "hos/t" and the PIN field clipping the 6th digit at 390 px, both fixed; run 2 (room THMJ) confirmed the wrap before `/host`, all six digits at 375×667 (`scrollWidth` 375), and pairing by PIN. Screenshots: `.playtest/F70/4-dialog-fixed-screen.png`, `5-pinentry-375-host.png`, `5b-paired-375-host.png`.
- Main `index` chunk 479.75 → 483.03 kB (145.47 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room → Use this device as the Screen, then **Pair host phone**. On a phone open `http://<laptop-LAN-IP>:5173/host/<CODE>`, type the 6-digit PIN, tap Pair.

## F69 — Read-aloud mode (no TV) (2026-10-29)
**What changed:**
- `RoomCreated`: a fourth button, **Run from this phone (no TV)**, opens `/host/:code?read=1`.
- New `client/src/lib/hostLayout.ts`: the read-aloud choice per room in sessionStorage (`buzzr:readAloud:<CODE>`), plus `?read=1` parsing and stripping. `Host.tsx` stores `?read=1` and drops it from the URL in the hash-stripping effect. The header gains a **Read aloud** toggle (`aria-pressed`) under the Q pill.
- New `client/src/components/ReadAloud.tsx`: `ReadAloudJoin` (lobby: join address, QR, room code, localhost note) and `ReadAloudQuestion` (28px question, image, answer and notes under **Tap to show answer**, reset per question, uncovered in REVEAL). `PrimaryAction` takes `bigWinner`: 56px winner name that wraps instead of truncating.
- Tests: `Host.test.tsx` +9 (read-aloud layout: `?read=1` stored and stripped, normal default, large question and cover, cover reset, REVEAL uncover, same controls, big winner wrapped, lobby QR/code without the first question, toggle across a remount), `Landing.test.tsx` +1 (fourth button, path with search), new `hostLayout.test.ts` (8). The `LocationProbe` and `CurrentPath` test helpers now include `location.search`. 1662 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F69 (stored and stripped `?read=1`; lobby join block and REVEAL uncover; big winner wraps).

**Notes for next session:**
- The layout is client-only; no server or view change. Nothing new reaches the Screen.
- Opening `/host/:code?read=1` in a tab where the remote is already showing (same mount) stores the choice but the visible layout waits for a reload. Not reachable from the UI.
- Playtest (Playwright, no Screen tab): run 1 at 390×844 (room JTAQ, Ann and a bot) took **Run from this phone (no TV)** into the read-aloud lobby with the QR, ran Q1 (no buzz, revealed) and Q2 (Ann buzzed, Correct), and tested the toggle and a reload. Run 2 at 375×667 (room PQJS): lobby and covered question had no overflow (`scrollWidth` 360); BUZZED with `Maximilianussss1` showed a 56px name truncated to "MAXI…", hence the wrap fix. Not checked in a browser: the wrapped name after the fix (unit-tested by class). Screenshots: `.playtest/F69/readaloud-host.png`, `1-lobby-host.png`, `2-question-host.png`, `3-buzzed-host.png` (before the fix).
- Main `index` chunk 476.24 → 479.75 kB (144.54 kB gzip).

**How to try it:** `npm run dev`. On a phone at `http://<laptop-LAN-IP>:5173`, Host a game → Create room → **Run from this phone (no TV)**. Players scan the QR on that phone. Start, read the question out, tap **Tap to show answer** to check it, open the buzzers and judge. The header's **Read aloud** button switches back to the normal remote.

## F68 — Undo every judgement of the question (2026-10-29)
**What changed:**
- Shared/server: `Room.undo` is now `UndoPoint[]`, newest last (`[]` in `createRoom`, `clearedQuestion` and new game). `hostJudge` pushes a point; `hostUndo` pops one, reverses `judgements.at(-1)` (points, lockout) and returns to BUZZED with that point's buzzes and winner, so repeated undos walk back the whole question. `canUndo` reads the top point. `host:end` now empties the stack too.
- Kick/leave (`withoutPlayer`): drops the departing player's newest point and every older one; newer points lose their buzzes. Their judgements stay in the history, so undo stops before them.
- No client change: the remote's Undo button and the Screen's `U` already follow `view.canUndo`.
- Tests: `reducer.undo.test.ts` (three wrong then correct with the penalty on, undo ×4 with each state `toEqual` the room before that judgement, fifth undo "Nothing to undo"; every undone reopen stale at each step; undo during a pending reopen; rejudge after undo then older undos; stack cleared on next, prev, end, new game; two kick cases), `views.test.ts` +3 (`canUndo` true after one of two undos, false after both), fixtures in `reducer.admin`, `reducer.newgame`, `roomStore` tests. 1644 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F68 (stack paired with the tail of `judgements`, superseding F20's one level; end clears the stack; kick truncates the stack).

**Notes for next session:**
- The kick rule is a call beyond the spec: after a kick, earlier judgements of that question (the kicked player's and older) can no longer be undone. Undo always reverses `judgements.at(-1)`, so it cannot skip a kept judgement.
- Undo keeps `openingCounter` (F20), so after walking back four judgements the room is the first BUZZED state with the counter of the last opening.
- No playtest: no UI changed. Not checked in a browser: Undo staying enabled through several undos (covered by `views.test.ts`).
- Main `index` chunk unchanged at 476.24 kB (143.54 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room, open the Screen, pair a phone with **Pair host phone**, add two or three players (`http://<laptop-LAN-IP>:5173/play/<CODE>` or `/dev/bots/<CODE>`). Start, open the buzzers, judge one buzz wrong, let another player buzz after the reopen and judge them correct. Tap Undo (or `U` on the Screen) twice: first the correct answer comes back to judge, then the first wrong one, with scores and lockouts restored.

## F67 — Half points and custom score adjust (2026-10-29)
**What changed:**
- Server: `Judgement.result` and the `host:judge` schema gain `'half'`. `hostJudge` sends it through correct's path with `Math.round(points / 2)`: REVEAL, `fx correct` with the half points, no lockout, penalty ignored. Undo is unchanged (it reverses `pointsDelta`). `scorerId` counts half.
- Remote: the judging panel is a 3-column grid, Correct / **Half** (gold, new `half` split-circle icon) / Wrong, icon stacked above each label. Screen: a Half bar button and the `V` key (`hostControls.ts`, listed on `?` as "Half points").
- Players tab: a **Custom** button per row (`aria-expanded`) opens a digits-only amount field (1–`SCORE_DELTA_MAX`) with − and + buttons naming the amount; sending closes it. Shown in every phase, the lobby included; the ±question-value buttons are unchanged.
- Tests: `reducer.judge.test.ts` +10 (half points, rounding 75→38, 1→1, 0→0, 10000→5000, REVEAL, fx, record, penalty, guards; half in the wrong-phase loop), `reducer.undo.test.ts` +2, `schemas.test.ts` +1, `views.test.ts` +1, `hostControls.test.ts` (`v`, gated, help table), `Host.test.tsx` (Half in order and sending), `Screen.test.tsx` +2 (`V`, bar Half), `HostControls.test.tsx` +11 (Custom). 1632 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F67 (half through correct's path and scorer; gold Half, stacked judge buttons; Custom field with sign buttons).

**Notes for next session:**
- The lobby test for the question-value buttons now matches `/^(Add|Subtract) \d/`, since Custom's buttons start with "Add"/"Subtract" too and show in the lobby.
- Playtest (Playwright, room XFTP: Screen 1920×1080, Host and Ann 390×844, 2 bots): remote order Correct, Half, Wrong; no answer in the Screen text before reveal; `?` lists `V Half points`; `V` gave Ann 50 of 100 and the Screen ✓; Undo restored judging; remote Half gave 50 again, Ann's phone showed +50; Custom 37 Subtract took Ann 50 → 13; 100001 disabled both buttons. At 375×667 (room TPPP) the three judge buttons are 93px each with no overflow and no page scroll; the first layout (icon beside the label) clipped Correct's icon by 8px, hence the stack. Custom open at 375: field, −, + on one line, Kick below, no overflow. Not checked in a browser: odd-point rounding (unit-tested), the Screen bar at 1280×720. Screenshots: `.playtest/F67/judge-375-host.png`, `custom-375-host.png`.
- Main `index` chunk 474.22 → 476.24 kB (143.54 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room, open the Screen, Click to start, pair a phone with **Pair host phone**. Join a player at `http://<laptop-LAN-IP>:5173/play/<CODE>`, start, open the buzzers and buzz: the remote shows Correct / Half / Wrong, and the Screen takes `V`. On the remote's Players tab, tap **Custom**, type an amount, then − or +.

## F66 — Screen polish (2026-10-29)
**What changed:**
- Lobby: the header leaves out "Join at" and the room code (the body's QR block has them); every other state keeps them. With a host remote paired, Game setup shows Start game and a **Settings** button (`aria-expanded`) over the folded settings.
- Title card: `ScreenView` gains `category`, `difficulty` (null when unset) and `hostDevices`. `useTitleCard`/`TitleCard` in `Screen.tsx` show "Get ready", the set title and "Category · Difficulty" for `TITLE_CARD_MS` (3 s, `shared/constants.ts`) when the room moves from LOBBY to question 1, ending early if the buzzers open.
- Server: with auto-open on, `host:start` shows question 1 locked, sets `Room.autoOpenAt` and schedules a new timer action `autoOpen`, which opens the buzzers 3 s later (stale-guarded by phase, index, counter and `at`). New gateway action `hostDevices {count}`: `countHostDevices` in `sockets.ts` counts the host channel after `host:join` and a host disconnect.
- Tests: new `reducer.titlecard.test.ts` (21: hold, open, buzz ignored during it, buzz timer from the hold end, no hold without auto-open or on next/prev, early open, setting toggled off, six stale cases, New game, `hostDevices`), new `ScreenResults.test.tsx` (4: podium with 1, 2, 2 tied and 3 players), `sockets.host.test.ts` +4, `views.test.ts` +2, `Screen.test.tsx` +10 net (join address once, header in game, settings fold ×3, title card ×6); `reducer.flow` and `reducer.buzztimer` start-with-auto-open tests now expect the hold. 1604 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-29 for F66 (server hold for auto-open, Kim's choice; client title card; host count; lobby header and fold; podium already right since F24).

**Notes for next session:**
- The podium bullet needed no code: `podiumSteps` has dropped missing ranks since F24. Only tests were added.
- `ScreenView.hostDevices` is on the Screen only; the remote does not get it.
- Playtest (Playwright, room UZUG, Screen 1920×1080, Host remote, Ann and a bot): one join line in the lobby, header logo only; the title card showed ~3 s at the first Start game (sample set: title only) and after New game with Animals – Easy ("Animals · Easy"); podium with 1 player showed one centred step; with 2 players tied at 0, one shared step; the lobby showed **Settings▾** with the remote connected and the settings expanded once it had closed; no answer in the Screen text during question 1. Not checked in a browser: the auto-open hold (covered by `sockets.host.test.ts`), a 2nd-place step, opening the folded settings. Screenshots: `.playtest/F66/1-lobby-screen.png`, `3-podium1-screen.png`, `3-podium2-screen.png`.
- Main `index` chunk 472.67 → 474.22 kB (143.08 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room, open the Screen, Click to start: the header shows only the logo. Pair a phone with **Pair host phone**: the lobby's settings fold behind **Settings**. Join a player (`http://<laptop-LAN-IP>:5173/play/<CODE>` or `/dev/bots/<CODE>`), turn on Auto-open buzzers, Start game: the Screen shows the title card for 3 s while phones stay locked, then question 1 opens. End game with one or two players to see the podium.

## F65 — Standings: rank on the phone and a Screen rail (2026-10-29)
**What changed:**
- Shared/server: `RoomSettings.showStandings` (default true in `DEFAULT_SETTINGS`), `z.boolean()` in the create body and `host:settings`, merged by `hostSettings`.
- Phone: "3rd of 8" (`ordinal(me.rank)` of `playerCount`) in the top bar left of the score pill from the first question; the "Your rank" footer card is gone.
- Screen: new `StandingsRail.tsx`, a `17vw` column right of the question column in `ScreenQuestion` (top 5: rank, colour dot, name, score; disconnected dimmed; `useFlip` reorder) in QUESTION, OPEN, COLLECTING, BUZZED and REVEAL, at `(min-width:1280px) and (min-height:720px)` only. Settings: a "Standings on the Screen" switch, last row of `HostSettings` (remote tab and Screen lobby); compact rows now keep their detail line `sr-only`.
- Tests: `reducer.admin.test.ts` +1 (and fixtures), `schemas.test.ts` +2, `constants.test.ts`, `HostControls.test.tsx` +3, `Play.test.tsx` +15 (top bar, lobby absent, ordinals 1st–111th, tie), `Screen.test.tsx` +12 (top 5 in each of five phases with colour, beside the card and the breakpoint class, dimmed, off, toggled mid-question, reorder, lobby and Final, no players). 1564 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F65 (phone top bar replaces the footer; rail as its own column, phases, breakpoint; switch placement and `sr-only` details in compact).

**Notes for next session:**
- The Screen lobby's settings had already overflowed at 1280×720 since F64 (five rows with details: `scrollHeight` 576 vs `clientHeight` 454 once the sixth row came, "Scoreboard every" clipped before). With compact details `sr-only` it is 454 = 454 and the last row ends at 563 of 601. Any further lobby setting (F71 false start, F73 presets, F81 teams, F91 copy) must re-measure this at 1280×720.
- Playtest (Playwright, room CZXS: Screen 1920×1080 and 1280×720, Zed at 390×844 and 6 bots; then room UTFD): Zed's top bar read "1st of 7"; the rail listed the top 5 of 7, ties sharing rank 2 after Zed scored, Zed moved to the top; at 1280×720 the rail spans x 1014–1232 and the card ends at 989; gone at 1100 wide; the remote switch removed and restored the rail live; in BUZZED with 6 bots and five "also buzzed" the rail and banner don't overlap; lobby toggle works. Not checked: "2nd"/"3rd" on a real phone, the rail in OPEN and COLLECTING in a browser, the FLIP animation by eye. Built CSS carries the `(width>=1280px) and (height>=720px)` rule. Screenshots: `.playtest/F65/rail-1920x1080-screen.png`, `rail-1280x720-screen.png`, `lobby-1280x720-screen.png`, `buzzed-1280x720-screen.png`.
- With all players tied, the rail's five are the first five by join order (server ranking), so a sixth tied player is absent.
- Main `index` chunk 471.20 → 472.67 kB (142.73 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room, open the Screen at 1280×720 or larger, Click to start. Add players (phones at `http://<laptop-LAN-IP>:5173/play/<CODE>`, or bots at `/dev/bots/<CODE>`), start: each phone's top bar shows "1st of N"; the Screen's right edge lists the top 5 and reorders as scores change. Toggle **Standings on the Screen** in the lobby settings or the remote's Settings tab.

## F64 — Buzz time limit: devices (2026-10-29)
**What changed:**
- `useAnswerCountdown.ts`: one private `useCountdown` behind `useAnswerCountdown` and the new `useBuzzCountdown` (`buzzTimer`, never `up`).
- Settings (remote tab and Screen lobby): a "Buzz time" stepper (Off, 5, 10, 15, 20, 30 s) under Answer time; both rows now use one `SecondsStepper` in `HostSettings.tsx`.
- Screen: `BuzzTimeRing` in `ScreenQuestion.tsx`: the gold stage ring around "Buzzers OPEN" drains as a conic ring (`--left`), seconds in a dark chip. `ScreenFlash` flashes red on `fx buzzTimeUp`. Phone: "N seconds to buzz" (singular at 1) under the BUZZ button. Remote: a "sec" box beside Reveal answer (`PrimaryAction.tsx`).
- Tests: `useAnswerCountdown.test.ts` +4, `HostControls.test.tsx` +10 (stepper), `Host.test.tsx` +3, `Screen.test.tsx` +4 (ring drains, gone on buzz and restarts on reopen, plain without, time up plays `timeUp`, flashes, shows the answer), `Play.test.tsx` +3. 1531 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F64 (shared counting, never `up`; ring, phone line for everyone, remote box, red flash, one stepper).

**Notes for next session:**
- Playtest (Playwright, Screen 1920×1080, Host and two players 390×844, room QQPA): the lobby stepper cycled Off to 30 s with the ends disabled, and the Host tab showed the same value; with 5 s, Screen, phone and remote each counted 5 to 1; nobody buzzed and all three showed the reveal ("Jupiter") about 5 s after opening; the answer was absent from the Screen while open. Not checked: the sound by ear, the answer's absence on the phones during the countdown, console on Host and player tabs. One Screen console warning (WebSocket closed before connected, likely dev reconnect noise). The playtest found "1 seconds to buzz", fixed after. Screenshots: `.playtest/F64/ring-screen.png`, `.playtest/F64/open-host.png`.
- The ring steps once a second and its drained part is `--color-edge`, subtle from far away; the seconds chip carries the count.
- Main `index` chunk 468.98 → 471.20 kB (142.44 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room, open the Screen, Click to start. In the lobby settings set **Buzz time** to 5 s. Join from a phone at `http://<laptop-LAN-IP>:5173/play/<CODE>`, start, open the buzzers and don't buzz: the Screen ring, the phone line and the remote box count down, then every device shows the answer and the Screen flashes red with the time's-up sound.

## F63 — Buzz time limit: server (2026-10-29)
**What changed:**
- Shared: `BuzzSeconds` and `BUZZ_SECONDS_CHOICES` (0, 5, 10, 15, 20, 30), `RoomSettings.buzzSeconds` (default 0, in `DEFAULT_SETTINGS`), zod in the create body and `host:settings`. `Room.buzzTimer {seconds, endsAt}`, `BuzzTimerView {seconds}` on the Screen, Host and Player views (no `endsAt`), `Fx {kind: 'buzzTimeUp'}`.
- Reducer: new timer action `buzzTimeUp {questionIndex, openingCounter, at}`. `withBuzzTimer`, a post-step in `reduce`, starts the timer and schedules the action on every new opening (host:open, auto-open, reopen, an emptied window) and clears it whenever the room leaves OPEN, so the first buzz stops it. A fresh `buzzTimeUp` goes to REVEAL through `revealed()`, now shared with `host:reveal`, and emits `fx buzzTimeUp`. `hostSettings` merges `buzzSeconds`.
- Client, compile-level only: `soundForFx` maps `buzzTimeUp` to `timeUp`; view fixtures and the editor preview carry `buzzTimer: null`.
- Tests: new `reducer.buzztimer.test.ts` (29: start, each choice, off, reopen restarts, auto-open on start/next/prev, emptied window, unchanged in the same opening, settings wait, buzz clears, reveal/end/prev/undo clear, time up to REVEAL with no points, lockouts kept, overlay hidden, seven stale cases), `sockets.buzz.test.ts` +3 (fires through the gateway to every device, a buzz stops it, bad value refused), `views.test.ts` +2, `schemas.test.ts` +2, `constants.test.ts` +1, `sounds.test.ts` +1; settings fixtures in `reducer.admin`, `reducer.newgame`, `roomStore` gained the new fields. 1507 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F63 (one post-step keeps the timer in step with openings; freshness by `at`, time up shares the reveal path, sound mapped early).

**Notes for next session:**
- No UI: the Settings stepper, the countdowns and the reveal animation are F64. The Screen already plays `timeUp.wav` on `fx buzzTimeUp`, so F64's sound bullet only needs a test through the Screen.
- `useAnswerCountdown` keys on `questionIndex:openingCounter`; each opening's buzz timer has its own counter, so the same key works for a generalised hook.
- No playtest (server only). Main `index` chunk 468.88 → 468.98 kB (141.92 kB gzip).

**How to try it:** `npm test -- server/reducer.buzztimer.test.ts server/sockets.buzz.test.ts`. No control sets `buzzSeconds` until F64.

## F62 — Screen sound: mute and volume (2026-10-29)
**What changed:**
- `sounds.ts`: `SoundLevel` (`on`, `quiet`, `muted`), `SOUND_LEVEL_VOLUME` (1, 0.4, 0), `SOUND_LEVEL_LABEL`, `getSoundLevel` (localStorage `buzzr:soundLevel`, guarded, in-memory fallback), `cycleSoundLevel`, `subscribeSoundLevel`. `startSounds` sets `Howler.volume` from the stored level before creating any Howl; a later change sets it at once. New `useSoundLevel` hook (`useSyncExternalStore`).
- Host Screen: a sound button on the host bar beside Fullscreen, labelled with the current level and an `M` hint; `M` is a local shortcut (`shortcutFor` → `'sound'`) and listed on the `?` overlay. Token-less Screen: the same button under the lobby's join QR, and its own `M` listener in every phase. Click to start still swallows keys.
- Tests: `sounds.test.ts` +7 (now jsdom: cycle order and labels, persisted, invalid stored value, storage blocked, volume before the first Howl, live changes, subscribers), `hostControls.test.ts` (`m`/`M` in three phases, help lists M), `Screen.test.tsx` +7 (bar button and M with storage, stored level shown, help row, one button in a host lobby, token-less lobby button and M, token-less M mid-game and Ctrl-M ignored, M on the overlay). 1469 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F62 (levels, storage and Howler volume; button placement and the token-less `M`).

**Notes for next session:**
- Playtest (Playwright, 1920×1080, room BTFY): host bar showed "Sound on M"; click and `M` cycled Sound on, Quiet, Muted, Sound on with storage following; after a reload on `quiet` and Click to start, `Howler.volume()` read 0.4; `?` listed M; a token-less Screen showed the button under the QR and cycled by click and `M`. No console errors. Not checked by ear; no screenshot of the host bar with the new button (it is `flex-wrap`). Screenshot: `.playtest/F62/lobby-tokenless-screen.png`.
- The token-less button is the lobby's only; mid-game a token-less Screen has `M` alone.
- Main `index` chunk 467.53 → 468.88 kB (141.87 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room → open the Screen, Click to start. The bar's **Sound on** button (or `M`) cycles Quiet and Muted; play a test buzz from a phone at each level. Reload: the level stays. Open the same `/screen/<CODE>` in a private window (no token): the button sits under the QR, and `M` works there too.

## F61 — Leave, rename and outcome haptics on the phone (2026-10-29)
**What changed:**
- Server: `player:rename {name}` (LOBBY only, join's zod rules, case-insensitive duplicate check ignoring the player's own name, `NAME_TAKEN_ERROR` now in `shared/constants.ts`, 3 per 10 s per socket) and `player:leave {}` (any phase). Leave shares the kick's removal: `hostKick` now adds the id to `kickedIds` and calls the new `withoutPlayer`, which holds the F20 winner and window rules; leave calls it without the bar. The gateway then takes the leaver's sockets out of their Socket.IO rooms and resets `socket.data`, so the same connection can join again as a new player.
- Phone (`Play.tsx`): a ⋮ **Menu** button beside the score opens **Change name** (LOBBY only) and **Leave game** (`ConfirmButton`). Change name is a full-screen form with inline errors; it closes on success, Cancel, or when the game starts. Space does not buzz while either is open. Leaving clears the stored identity (`clearPlayer`), draws a new `playerId` and shows the join form prefilled with the old name. `renamePlayer` in `playerIdentity.ts` keeps the stored name in step. `useOutcomeHaptics` vibrates `[60, 80, 60]` on this player's `fx correct` and `400` on their `fx wrong`. New `more` icon.
- Tests: `reducer.lobby.test.ts` +29 (rename rules and phases; leave in all 7 phases, rejoin, colour reuse, five kick-equivalence cases including the BUZZED winner), `sockets.test.ts` +9 (every view gets the new name, taken, after start, rate limit, not joined; leave removes from views, same connection rejoins, no disconnect dispatch, second leave), `schemas.test.ts` +1, `playerIdentity.test.ts` +2, `Play.test.tsx` +12 (menu in and out of lobby, backdrop and Space, rename ok, taken, invisible characters, closes at start, leave confirm and rejoin as new, refused leave, vibrations). Four existing Play tests now find the buzzer by name ("BUZZ"), since the menu is a second button. 1455 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-29 for F61 (rename order and limit; leave as an unbarred kick and the unjoined socket; menu and form behaviour, new id after leaving; vibration patterns, wrong covers lockout).

**Notes for next session:**
- Playtest (Playwright, 390×844, room GHQT, Host remote plus Ann and Bob phones, `navigator.vibrate` stubbed): menu offered both items in LOBBY and only Leave game after start; renaming Ann to "Bob" showed "That name is taken", "Annie" showed on both phones; wrong on Annie recorded `[30, 400]` (buzz tap, then the long pulse) with "Locked out this round"; correct on Bob recorded `[60,80,60]`; Leave then Cancel kept Bob, Confirm leave returned him to the form with storage empty; he rejoined at 0; Bob leaving as the Q2 buzz winner reopened the buzzers on Annie's phone. Not checked: the Screen tab (no Screen opened), player-tab console errors (listeners lost), leave in other phases on a device. No screenshots.
- F71 (false start) will need its own lockout vibration trigger; today only `fx wrong` vibrates.
- Main `index` chunk 463.64 → 467.53 kB (141.45 kB gzip).

**How to try it:** `npm run dev`. Host a game → Create room, open the Screen. Join from two phones at `http://<laptop-LAN-IP>:5173/play/<CODE>`. On one, tap ⋮ → Change name, try the other's name (refused), then a new one: every device shows it. Start the game; ⋮ now offers only Leave game. Judge one phone wrong (one long buzz) and the other correct (two short). On a phone, ⋮ → Leave game → Confirm leave: it drops from every list and shows the join form; Join brings it back at 0 points.

## F60 — Practice buzz and who's here: devices (2026-10-29)
**What changed:**
- Phone (`Play.tsx`, `buzzerState.ts`): LOBBY is a new `practice` kind, "Tap to test your buzzer" over a live, muted-red button (`--color-buzz-muted`, no pulse), with "You're in! Waiting for the host" on the line below. A tap or Space vibrates 30 ms, replays a gold ring (keyed span, `data-practices`) and sends `player:practice`; the button stays live and a refused one toasts its error. "Who's here · N" sits under the button in LOBBY only: own name first with "(you)", the rest in join order, colour dots, disconnected dimmed, scrolling inside itself past 24 dvh.
- Screen: `usePracticePops` (store subscription) keeps each player's latest practice `seq`; `PlayerChips` keys the chip by it, so every test buzz remounts it with `animate-chip-bump`. `soundForFx` now maps every `fx` (returns `SoundName`, no null); `practice` plays the new `practice.wav` (0.14 s tick, peak 0.3) from `scripts/make-sounds.mjs`. The other six WAVs regenerate byte-identical.
- Tests: `Play.test.tsx` +5 and the lobby test updated (test press, ring replay by tap/Space not click, refused toast, list order and colours, list follows lobby and goes at start), `buzzerState.test.ts` (practice kind), `Screen.test.tsx` (chip bump and replay, practice sound), `sounds.test.ts`, new `usePracticePops.test.ts` (3). 1402 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F60 (muted buzzer and list; `practice.wav` and per-player bump keys).

**Notes for next session:**
- Playtest (Playwright): Screen 1920×1080 plus Alice and Bob phones in room CUUZ. Both phones showed the label and live button; presses called `vibrate(30)`; each phone listed itself first ("Alice (you), Bob" / "Bob (you), Alice", count 2); each press bumped that player's chip on the Screen separately (`data-practice` 3, then 4); the room stayed in LOBBY. No console errors. The sound was not checked by ear (unit-tested; `/sounds/practice.wav` served 200). The screenshot `.playtest/F60/lobby-player.png` came out at desktop width, not 375 px.
- The list cap was lowered from 30 to 24 dvh after the fact by arithmetic (267 px button at 375×667), not re-shot.
- Main `index` chunk 461.33 → 463.64 kB (140.51 kB gzip).

**How to try it:** `npm run dev`. On the laptop, Host a game → Create room → open the Screen and Click to start. Join from two phones at `http://<laptop-LAN-IP>:5173/play/<CODE>`. Tap BUZZ on each: the phone vibrates and rings, that player's chip bumps on the Screen with a soft tick. Each phone's "Who's here" lists itself first. Start the game: the list goes and the button greys out until the buzzers open.

## F59 — Practice buzz and who's here: server (2026-10-29)
**What changed:**
- `player:practice {}` (types, `emptySchema`, reducer, gateway). The reducer accepts it in LOBBY only (`Not allowed in this phase` elsewhere, `Unknown player` for a stranger). It returns the same room object with one effect, `fx {kind: 'practice', playerId}`, so the gateway broadcasts no `state` and stamps no activity. The handler checks the socket joined as a player, then spends the per-socket `buzzLimiter`, the same budget as `player:buzz` (`Too many buzzes`).
- `PlayerView.lobby: LobbyPlayer[] | null`: `{id, name, color, connected}` in join order in LOBBY, `null` in every other phase. `views.ts` now shares `byJoinOrder` between this list and the Host's players.
- Client fallout only: `soundForFx` returns `null` for `practice` and `useScreenSounds` skips it, so the Screen stays silent until F60. The `PlayerView` fixtures in `buzzerState.test.ts` and `Play.test.tsx` carry `lobby`.
- Tests: `reducer.lobby.test.ts` +9 (fx, same room and no stamp, six phases rejected, unknown player), `sockets.test.ts` +4 (fx to Screen, Host and both players with no `state`, shared limit with reset, rejected after start, not joined), `views.test.ts` +7 (join-order list, `null` in six phases), `schemas.test.ts` (payload row), `sounds.test.ts` +1, `Screen.test.tsx` +1 (silent practice, next fx still plays). 1392 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-29 for F59 (no state and no activity stamp, error outside LOBBY, shared limit, row fields and order, silent Screen until F60).

**Notes for next session:**
- F60 builds the devices: the phone's live muted buzzer sending `player:practice`, the "Who's here" list from `view.lobby` (own name first is F60's ordering), and the Screen chip pop and sound on `fx practice` (change `soundForFx`).
- A lobby `player:buzz` is still ignored silently and spends the same budget, so a phone mixing the two gets 5 presses a second in total.
- Server-only feature, so no playtest.

**How to try it:** `npm test -- server/reducer.lobby.test.ts server/sockets.test.ts server/views.test.ts`. Nothing shows on a device until F60.

## F58 — Landing explainer and host-first layout (2026-10-29)
**What changed:**
- `Landing.tsx`: the line "A game-show buzzer: questions on the TV, buzzers on your phones" under the logo. The Join card renders only while `HostGame` is closed; the typed code stays in `Landing` state, so Cancel brings it back.
- `HostGame.tsx`: **Host a game** uses Join's classes (`BUTTON_PRIMARY text-2xl`, filled gold). A new optional `onOpenChange` prop reports the picker, builder or Room created, from a layout effect (a plain effect let one frame show both cards; the first test run caught it). The F55 `scrollIntoView` is gone: the picker now opens under the logo. `BUTTON_OUTLINE` remains only on Save to My sets.
- Tests: `Landing.test.tsx` +4 (explainer, equal weight, picker replaces Join, builder keeps it hidden, Room created keeps it hidden; the F55 scroll test removed; Cancel now checks Join and the kept code). 1370 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-29 for F58 (explainer, button classes, Join hidden through Room created, F55 scroll superseded).

**Notes for next session:**
- Playtest (Playwright, 375×667): the explainer shows under the logo; Join is 276×64 inside its card and Host a game 328×64, both gold. **Host a game**'s bottom edge is at y=637 of 667 at scroll 0. The page is 753 px tall, so only the **Question sets** link is below the fold. Opening the picker removed the Join card and put "Pick a question set" under the explainer; Cancel brought Join back. No console errors. `.playtest/F58/landing-375x667.png` was shot scrolled about 87 px, so its logo is cut off.
- Main `index` chunk 460.84 → 461.33 kB (139.99 kB gzip).

**How to try it:** `npm run dev`. On a phone (or devtools at 375×667), open `http://<laptop-LAN-IP>:5173`: the explainer, the Join card and a gold **Host a game** fit on one screen. Type two letters, tap **Host a game**: the picker takes the Join card's place. Tap **Cancel**: Join returns with the two letters. Tap **Host a game**, then **Create room**: Room created shows where the picker was.

## F57 — Game builder (2026-10-29)
**What changed:**
- `client/src/lib/gameBuilder.ts`: `buildGame(sets, picks, { random, now, id })` draws `{category, difficulty, count}` rows from the playable sets. It draws without repeats (copies count once), shuffles with the injected random source, renumbers the questions `q1…`, titles the set "Mixed: <categories>" with category "Mixed" and no difficulty, and reports each short row. It fails for no match or over 100 questions, and returns a `loadImage` that reads each picture from its source set (bundle or IndexedDB). There are also `builderCategories` and `pickCounts` (the live per-row counts).
- `client/src/components/GameBuilder.tsx`: the rows (category, Any difficulty / Easy / Medium / Hard, count 1–15), Add a row, Remove, "Only N questions match.", the total, the limit message, the host button (label prop), **Save to My sets** (`importSet` with its own picture copies) and **Back to the sets**.
- Wired in three places. The `/sets` header gets **Build a game**, whose **Host this game** calls `hostSet` and whose Save shows My sets. The Host a game picker gets a **Build a game** link, and the remote's New game picker gets it through the new `builder` prop, which `Host.tsx` passes and the Screen doesn't. `NewGamePicker`'s send path now carries `{set, loadImage}`, so a built game's image retry works.
- Tests: `gameBuilder.test.ts` (21), `GameBuilder.test.tsx` (10), `Landing.test.tsx` +3, `Sets.test.tsx` +3, `NewGamePicker.test.tsx` +4, `Host.test.tsx` +1, `Screen.test.tsx` +1. 1366 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-29 for F57 (pool, Any difficulty and draw order; repeats, copies and the title; images and Save; where it shows and the labels).

**Notes for next session:**
- **Repeats gotcha:** a copy's pictures get fresh ids, so a picture-only card is deduplicated by answer and notes. The first rule (text, else image id) let the sample's flag card appear twice in a profile holding a sample copy. The playtest found it.
- Playtest (Playwright):
  - On `/sets`, built Animals, Science and Movies × 3 (total 9), saved it to My sets, then hosted it. The remote showed "Question 1 of 9". Two questions were played with one player: buzz and Correct (+100). The answer wasn't in the Screen or Player text before reveal.
  - The remote's New game → Build a game (Space & Astronomy, Hard, 15) → Start new game loaded 15 questions.
  - At 375×667, Host a game → Build a game: no horizontal scroll, and the selects stay inside the card. Remove is 46 px, Add a row 44 px, and Back 44 px after a fix.
  - On a wiped profile, Other / Any / 15 said "Only 10 questions match.", and Host this game posted the room, then `sample-img-hexagon` and `sample-img-flag` (201). After Duplicate to My sets it still said 10.
  - No console errors.
- Not playtested: two players at once (shared tab storage), or a game over 100 (unit-tested).
- Main `index` chunk 449.31 → 460.84 kB (139.89 kB gzip). HostGame loads the builder eagerly.
- F58 moves the Host a game picker in place of the Join card. The builder renders inside that picker card, so it moves with it.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and tap **Build a game**. Add rows (for example Animals Easy 3, Science Medium 3, World History Hard 3) and watch the total. Then tap **Host this game**, or **Save to My sets** to keep it.
2. On a phone (`http://<laptop-LAN-IP>:5173`), tap **Host a game**, then **Build a game** under Create room. Set Other / Any / 15 to see "Only 10 questions match.", then Host this game: the sample's pictures upload.
3. Play to FINAL. On the paired host phone, **New game** → **Build a game** → **Start new game** (Keep scores is above it). The Screen's New game has no builder.

## F56 — Set preview before hosting (2026-10-29)
**What changed:**
- `client/src/components/SetPreview.tsx`: a read-only dialog listing every question of a set: "Question N · P points", the text, a picture thumbnail, the answer and the host notes. A picture missing from this browser is named. Pictures come from `imagesOf(set)` (now exported from `hostRoom.ts`): the bundle for the sample, else Dexie, loaded lazily. Escape or Close returns focus to the Preview button. The page or picker behind is `inert`.
- `SetBrowser` takes `onPreview`, which adds a **Preview** button ("Preview <title>") beside each picker radio and after each `/sets` card's actions. **Host a game** and the remote's **New game** offer **Pick this set**, which selects it. `/sets` (both tabs) offers **Host this set**. `NewGamePicker` shows Preview only with the `preview` prop: `Host.tsx` passes it and `Screen.tsx` doesn't.
- Tests: `SetPreview.test.tsx` (4), `NewGamePicker.test.tsx` +3, `Sets.test.tsx` +3 (built-in card buttons now include Preview), `Landing.test.tsx` +1, `Screen.test.tsx` +1 and `Host.test.tsx` +1 (page-level: none on the Screen, one per set on the remote; both files now import `fake-indexeddb/auto`). 1323 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F56 (the dialog's content and image source; where Preview shows, the action labels, Esc).

**Notes for next session:**
- **Focus gotcha:** `inert` on the page behind blurs the clicked Preview button before effects run. So `SetPreview` reads the opener in a `useState` initializer on its first render. jsdom has no `inert` blur, so only the playtest covers this.
- Playtest (Playwright):
  - First run (390×844 and 1920×1080), 5 of 5 steps passed. `/sets` preview of the sample copy showed 10 questions and 2 thumbnails, and Host this set created a room. On Host a game, Pick this set checked the sample and Create room worked. The remote's New game had 63 Preview buttons; the Screen's had 0.
  - Recheck at 375×667: no horizontal scroll. Preview buttons are 44 px, inside the row. The dialog's list scrolls inside it, with Pick and Close in view. Picker `section` and `/sets` `main` were `inert` while it was open. The recheck found focus returning to `body`, which led to the fix above. After the fix, focus returned to the Preview button after Escape, Pick and Close. Close is now 44 px.
  - No console errors.
- Not checked: a title long enough to truncate beside the Preview button at 375 px (none of the built-ins is).

**How to try it:** `npm run dev`.
1. On a phone (or devtools at 375×667), open `http://<laptop-LAN-IP>:5173` and tap **Host a game**. Tap **Preview** on "Sample: General Knowledge" to see every question with its answer, notes and the two pictures. Tap **Pick this set**, then **Create room**.
2. On the laptop, open `http://localhost:5173/sets`. **Preview** is on every card in both tabs, and **Host this set** in the preview creates a room.
3. Play a game to FINAL. **New game** on the host remote has Preview on every set; **New game** on the Screen has none.

## F55 — Set browser: search, categories and difficulty (2026-10-29)
**What changed:**
- `client/src/lib/setFilter.ts`: `filterSets` (every query word in the title or category, case- and accent-insensitive; difficulty chips any-of, `none` for sets without one) and `groupByCategory` (groups in first-appearance order, "Other" for no category or the category "Other", list order kept).
- `client/src/components/SetBrowser.tsx`: search box (first in tab order), Easy / Medium / Hard / None chips (`aria-pressed`), grouped list, "No sets match." In `select` mode it renders radios (hiding the selection clears it; Enter with one set left selects it). In `actions` mode it renders `/sets` cards (Enter focuses the card's first action). It replaces the flat lists in `HostGame`, `NewGamePicker` and both `/sets` tabs. Category headings are `h3` in pickers and `h2` on `/sets`, where card titles are now `h3`.
- Rows show the difficulty ("15 questions · Easy · Built-in", `setDetail`). `DIFFICULTY_LABELS` moved to `setLabels.ts`. **Host a game** scrolls its picker into view when it opens.
- Tests: `setFilter.test.ts` (17), `SetBrowser.test.tsx` (15), `Landing.test.tsx` +3, `NewGamePicker.test.tsx` +3, `Sets.test.tsx` +4 (heading level now 3). 1310 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-29 for F55 (search rule and the "anim" mismatch; group order and "Other"; selection, Enter and tab reset; the picker scroll).

**Notes for next session:**
- **Roadmap mismatch:** "anim" at Easy leaves two sets (Animals – Easy, Anime & Manga – Easy) under any substring or prefix rule. The tests and playtest use "animal" at Easy, which leaves one. Marked with a `SPEC-QUESTION` in `setFilter.ts`.
- Playtest (Playwright):
  - First run, 375×667: the picker opened under the Join card with the chips below the fold (`.playtest/F55/picker-375.png` is from this run). The scroll fix followed.
  - Re-run, 375×667: after tapping Host a game, the search box was at y 114 and the chips at y 182–278. "animal", Easy and Enter selected Animals – Easy, and Create room worked. On `/sets` the headings ran Other, Animals, …; one card was left and Enter focused Duplicate to My sets; My sets search found the copy.
  - The Screen's New game picker (1920×1080) filtered and took Enter.
  - No console errors.
- Not playtested: the Host remote's New game picker (it needs a full game to FINAL). It uses the same component as the Screen's, and `NewGamePicker.test.tsx` covers it.
- Main `index` chunk 449.31 kB (136.80 kB gzip); `db` 277.45 kB.
- F56 adds Preview to `SetBrowser`: put it in the `actions` render prop on `/sets`, and add an optional per-row action in `select` mode (not on the Screen).

**How to try it:** `npm run dev`.
1. On a phone (or devtools at 375×667), open `http://<laptop-LAN-IP>:5173` and tap **Host a game**: the picker scrolls up with the search box and chips in view. Type "animal", tap **Easy**, press Enter (Go), then **Create room**.
2. On the laptop, open `http://localhost:5173/sets`: the Built-in tab is grouped by category. Search and chips narrow it, and Enter on one result focuses its first button. My sets has its own search.
3. Host a game to the end on the Screen, then press **New game**: the same search and chips are in the dialog.

## F54 — Built-in sets library (2026-10-29)
**What changed:**
- `shared/builtInSets.ts`: `BUILT_IN_SETS` (`SAMPLE_SET`, then the 60 `STARTER_SETS`) and `builtInSet(id)`, read from the bundle. New browsers no longer seed anything; `populate` and the v2 starter upgrade are gone.
- Dexie `version(3)` deletes each stored copy of a built-in whose title, category, difficulty and questions equal the bundled set. A pre-F53 copy without either field counts as unedited. An edited copy stays in My sets under a fresh id with its dates. The sample's pictures are deleted when no remaining set uses them; the host's own sets are untouched.
- `/sets` has **Built-in** and **My sets** tabs. It opens on My sets when this browser has a set, else Built-in. Built-in cards offer **Duplicate to My sets** (a "(copy)" with its own pictures, then shows My sets) and **Host this set**. My sets keeps every action.
- **Host a game** and **New game** list My sets, then the built-ins marked "· Built-in" (`listHostableSets()`). Hosting the sample uploads its pictures from `sampleImages()` (`hostRoom.ts`, `imagesOf`), not IndexedDB. The editor's category suggestions include the built-in categories.
- Tests: `db.test.ts` (built-ins, Duplicate to My sets, 6 v3-upgrade cases from v2 and v1 databases), `hostRoom.test.ts` +1, `Sets.test.tsx` (8 tab and built-in tests; the My sets tests now use a stored set), `NewGamePicker.test.tsx` +1, `Landing.test.tsx` (order, built-in sample hosted with its pictures), `SetEditor.test.tsx` (built-in categories). 1268 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-29 for F54 (v3 clean-up rules; image loader by id; tabs, "(copy)" and the "Question sets" rename; picker order and the Built-in label; built-in category suggestions).

**Notes for next session:**
- Playtest (Playwright, `/sets` and `/`): fresh database held 0 sets and 0 images, and `/sets` opened on Built-in with only Duplicate to My sets and Host this set per card. Duplicating the sample then reloading opened My sets with the copy and all five actions. Host a game listed My sets first, then the built-ins, each marked Built-in. Hosting the built-in sample posted the room, then both `sample-img-*` uploads (201). No console errors. The playtester's snapshot showed 49 built-in cards; `Sets.test.tsx` asserts all 61 render, so that was probably a truncated snapshot.
- The v3 upgrade has not been run against a real browser's v2 database, only fake-indexeddb in `db.test.ts`. On Kim's own browser, `/sets` after this build should show only edited copies in My sets.
- Card titles and the pickers still show no category or difficulty; F55 adds search, chips and grouping.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`. A browser seeded before today loses its untouched starters and sample on load; a fresh profile shows My sets empty and opens on **Built-in**.
2. On Built-in, tap **Duplicate to My sets** on any set: My sets opens with "<title> (copy)", which Open edits.
3. Tap **Host this set** on "Sample: General Knowledge", then **Use this device as the Screen**, join from a phone and play to question 4: the hexagon shows.
4. On a phone, open `http://<laptop-LAN-IP>:5173`, tap **Host a game**: your sets come first, then the built-ins marked Built-in.

## F53 — Set category and difficulty fields (2026-10-29)
**What changed:**
- `QuestionSet` has optional `category` (1–40, trimmed by the schema; `SET_CATEGORY_MAX`) and `difficulty` (`'easy' | 'medium' | 'hard'`; `DIFFICULTIES` in `shared/constants.ts`). `questionSetSchema`, and so the set file schema, room creation and new game, accept both and still accept sets without them. `schemaVersion` stays 1.
- All 60 starter sets in `shared/starterSets/*.json` carry `category` (the title before " – ", e.g. "Philippine TV & Pop Culture") and `difficulty` (the id's level), right after `title`. Only those 120 lines changed.
- Set editor: **Category (optional)** with a `<datalist>` of the categories this browser's sets use, trimmed on blur; **Difficulty (optional)** select (None, Easy, Medium, Hard). Both autosave like the title; blank or None removes the key. Helpers `withCategory`, `withDifficulty`, `categoriesInUse`, `DIFFICULTY_LABELS` in `client/src/lib/setEditor.ts`.
- Export writes both, import keeps both, Duplicate copies both (it already spread the source; now tested).
- Tests: `schemas.test.ts` +4, `starterSets.test.ts` +2 (and the key order), `importExport.test.ts` +3, `db.test.ts` +1, `setEditor.test.ts` +3, `SetEditor.test.tsx` +4. 1255 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-29 for F53 (trim on blur and removing blank keys; the datalist and where labels live; no Dexie backfill for already-seeded starters).

**Notes for next session:**
- Browsers seeded before F53 keep stored starter copies without the two fields. F53 adds no Dexie upgrade, since F54 stops storing built-ins. F54's v3 clean-up must compare such a copy as if it had the bundled category and difficulty; the F54 roadmap bullet now says so.
- Playtest (Playwright, 390×844), 6 of 6 steps passed on a fresh database: starter fields shown in the editor, the datalist held the 20 starter categories, Category and Difficulty survived a reload, Duplicate copied them, export wrote them (category trimmed), re-import kept them. No console errors. Trim-on-blur was added after the playtest (review should-fix), covered by `SetEditor.test.tsx`.
- Nothing shows category or difficulty outside the editor yet: the set list (F55) and the Screen title card come later.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, open any set (or **New set**).
2. Type a category: the suggestions list the categories already in use. Pick a difficulty. Wait for **Saved**, reload: both are still there.
3. Back on `/sets`, **Export JSON** the set: the file has `category` and `difficulty`. **Import JSON** it back, and **Duplicate** it: both keep the fields.
4. A browser seeded before today shows starters without the fields; a fresh profile (or deleting the `buzzr` IndexedDB) shows them.

## F52 — Screen fixes from the backlog (2026-10-29)
**What changed:**
- Reveal fit:
  - `useShrinkToFit` takes `max: number | 'css'`. With `'css'`, it clears its inline size and caps at the size the classes give, so it only ever shrinks.
  - `ScreenQuestion` puts the length-step class (F18) on the text row, which is `overflow-hidden` and has the hook (min 12 px). The `h1` inherits the size.
  - It runs in every question phase. It refits on resize (the answer, the scorer pill or the banner appearing) and on a new question.
- `PairHostPhone` builds its QR from `joinPageOrigin(useJoinOrigin())`, like the join QR. A Screen on `localhost` now hands the phone `http://<LAN-IP>:5173/host/:code#t=…`. The Host remote's Pair button gets the same.
- `HOVER` is on Pair host phone and its Hide button, the lobby's Start game, and the HostSettings switches and steppers.
- Tests:
  - `useShrinkToFit.test.tsx` +4 (`'css'`: keeps the class size, shrinks under it, fresh cap on refit, refit on resize).
  - `PairHostPhone.test.tsx` +2 (LAN origin with the page port; page origin when null).
  - `Screen.test.tsx` +3 (LAN pairing link, lobby and dialog hover, the text row fitted by measurement). 1238 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F52 (measured question fit; pairing origin).

**Notes for next session:**
- Playtest (Playwright):
  - Plain Screen: Animals – Easy Q1 at REVEAL showed both lines above the answer at 1920×1080, 1366×768 and 1280×720.
  - Hosting Screen (bar shown), Ana judged correct: at 1920×1080 the full step (≈92 px) would not fit above the answer and the scorer pill. The row shrank to 70 px (49 px at 1366×768, 47 px at 1280×720), and the question then fits on one line. The row's scrollHeight equals its clientHeight, so nothing is clipped.
  - Pill bottom is 25–42 px above the bar top.
  - Pairing QR decoded to the LAN address. No console errors.
  - Screenshots are in `.playtest/F52/`.
- The question text can step down when the answer appears (the card loses height). That is the fit working, not a flicker.
- `docs/PROGRESS.md`: the `<!-- entries below -->` marker had drifted below F35, so `roadmap.mjs next` showed F35 as newest. It is back under the template.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and choose **Host this set** on Animals – Easy, then **Use this device as the Screen**. Join from a phone.
2. In the lobby, hover Pair host phone, Start game and the settings: each shows the ink border. Open **Pair host phone** and scan it with a phone: it opens `http://<LAN-IP>:5173/host/…`.
3. Start, buzz on Q1 and judge Correct. At 1280×720 (devtools), the question stays whole above LION and the scorer pill.

## F51 — Host remote link after room creation (2026-10-29)
**What changed:**
- `RoomCreated.tsx` has a third button, **Use this phone as the host remote**. It navigates to `/host/:code`. `hostSet` has already saved the hostToken, so the remote joins with the stored token and no pairing hash.
- The button shows on both **Host a game** (landing page) and `/sets` **Host this set**, since both render `RoomCreated`.
- Tests: `Landing.test.tsx` +1 and `Sets.test.tsx` +1 (the button, the `/host/WXYZ` route, the token still stored), and `Host.test.tsx` +1 (a stored token with no hash sends `host:join` and renders Host controls). 1229 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-29 for F51 covers the button's style and placement.

**Notes for next session:**
- Playtest (Playwright, 390×844), 5 of 5 steps passed. I created a room from Host a game, opened `/screen/:code` in a second tab and tapped the new button. It went to `/host/:code` with no `#t=`, joined as host and showed the answer. Start, Open buzzers and Reveal from the remote all reached the Screen. `/sets` Host this set showed the three buttons. No console errors.
- Not exercised: judging a buzz. The scripted DOM `.click()` on BUZZ doesn't fire `pointerdown`. F51 doesn't touch buzzing.
- A `node dist/server/index.js` in `buzzer/` has been running since 2026-10-27. It isn't from this session, so I left it alone.

**How to try it:** `npm run dev`.
1. On a phone, open `http://<laptop-LAN-IP>:5173`, tap **Host a game**, pick a set and tap **Create room**.
2. Tap **Open the Screen on another device**, then open the URL it shows on the laptop.
3. On the phone, tap **Use this phone as the host remote**. Host controls appear without pairing. Join from another phone and run a question.

## F50 — New game: picker on the Screen and the remote (2026-10-29)
**What changed:**
- `api.ts`: `replaceSet(code, hostToken, body)` (`PUT /api/rooms/:code/set`, JSON, Bearer). A 409 throws `NewGameTakenError` ("A new game has already been set up."); other errors carry the server's message.
- `hostRoom.ts`: `gatherImages` (playable check, each image once, 50 MB) and `uploadImages` are shared by `hostSet` and the new `hostNextSet(code, hostToken, set, keepScores)`: checks, then the PUT, then the uploads. An upload failing after the PUT throws `SetImagesError`; `uploadSetImages` retries only the uploads.
- New `components/NewGamePicker.tsx`: a modal over the page (portal to body). It lists this browser's saved sets newest first (seeding the starters on a fresh phone), marks drafts "Not playable yet", has **Keep scores** (default off), **Start new game** ("Starting new game…" while it runs), the error inline, **Retry images** after an upload failure, and Cancel / Esc. A 409 toasts and closes. It closes itself if the room leaves FINAL before this device sent anything.
- Screen: **New game** in the host bar in FINAL only (never without the token). The bar and shortcuts unmount while the picker is open. Remote: **New game** on the Game over card. Both keep the picker's state above the phase switch, so it survives the LOBBY snapshot during uploads.
- Tests: `api.test.ts` +5, `hostRoom.test.ts` +7, new `NewGamePicker.test.tsx` (11), `Screen.test.tsx` +3, `Host.test.tsx` +2. 1226 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-29 for F50 cover:
- drafts pickable and marked
- where the picker's state lives, its self-close, and the button-label progress
- `SetImagesError` and **Retry images**
- the 409 toast
- the Screen bar button, the bar unmounting under the picker, and the picker's sizing

**Notes for next session:**
- Playtest (Playwright, Screen at 1920×1080, remote, one Player), room SGRA:
  - The Screen offered New game in FINAL. With Keep scores off it went back to the lobby with the same code and player, the phone showed score 0 and "Waiting for the host", and Start game played question 1 of 10.
  - The remote's New game with Keep scores on kept 100. Start game played question 1, and the Screen text had no answer before reveal.
  - A Screen without the token showed no New game.
  - The first layout check found the list running past the dialog, then a horizontal overflow at 390 px and a squashed button. Both were fixed and rechecked at 1920×1080 and 390×844.
- Not run live: the 409 race (two devices pressing at once). Unit tests cover it.
- Deviations: the tabs shared one browser context, and the game reached FINAL through End game after Q1 rather than a 1-question set.
- The DECISIONS "Proposed spec changes" entry for new game still needs to go into SPEC.md (Kim's edit).

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and host a set. Pair a phone as Host, and join from another phone.
2. Start, play a question, then **End game**.
3. On the Screen, move the mouse and click **New game** in the bar. Pick a set, leave **Keep scores** off, then **Start new game**. Every device shows the lobby with the same code and players, with scores at 0.
4. Start game and play. End again, then use **New game** on the remote's Game over card with **Keep scores** on. Scores carry over.

## F49 — New game: server (2026-10-29)
**What changed:**
- Shared: `NewGameBody {set, keepScores}`, `NewGameResponse {ok: true}`, `newGameBodySchema` (with the type-equality check).
- Reducer: `host:newGame {set, keepScores}`, FINAL only (else `WRONG_PHASE_ERROR`). Returns LOBBY with the new set, `questionIndex` −1, the per-question fields, `judgements` and `showScoreboard` cleared. Players (disconnected too), `kickedIds`, `settings`, code and `openingCounter` stay. Scores go to 0 through `applyJudgement` unless `keepScores`. No effects.
- HTTP: `PUT /api/rooms/:code/set` in `server/http.ts`. 404 / 401 before the body is read, then `express.json` at `CREATE_ROOM_BODY_MAX_BYTES` (413), zod (400), dispatch (409 outside FINAL), then `images.deleteRoom(code)` and 200 `{ok: true}`.
- Gateway: `attachSockets` returns `{io, dispatch}` (new `Gateway`, `Dispatch` types). `index.ts` passes `dispatch` to `createApp`, bound late. The socket test harness mounts `createApp` the same way and exposes `base` and `images`.
- Tests:
  - New `server/reducer.newgame.test.ts` (27): full reset, kept fields, keepScores both ways, disconnected and kicked players, rejection from the six other phases, no undo across games, start/end on the new set, stale `windowClosed` / `reopen` / `answerTimeUp` in the lobby and on question 0.
  - New `server/http.newgame.test.ts` (13): each status, the 1 MB limit at the edge, racing PUTs (200 + 409), old images freed and only new ones uploadable, images kept on refusal, all four socket roles (Screen, hosting Screen, Host, Player) get LOBBY with the new count, scores on every device, no new-set answers or notes in Screen/Player frames (through `host:start`).
  - `schemas.test.ts` +3. 1198 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-29 for F49 on the route's check order, the error mapping, the gateway's return shape and the default `dispatch`. The two earlier F49 rows (HTTP not socket; what resets) were followed as written.

**Notes for next session:**
- No UI yet. F50 adds the picker on the Screen (when it holds the hostToken) and the remote, then re-uploads the new set's images with the existing route after the PUT succeeds.
- The client must send `Content-Type: application/json`; express ignores other bodies, which then fail zod with 400.
- No playtest: server-only feature. Socket coverage is in `http.newgame.test.ts`.
- The DECISIONS "Proposed spec changes" entry for new game still needs to go into SPEC.md (Kim's edit).

**How to try it:** `npm run dev`. Host a set at `http://localhost:5173/sets`, join a phone, Start, then End game on the remote. Copy the Screen's localStorage value `buzzr:hostToken:CODE`, then:
`curl -i -X PUT localhost:3000/api/rooms/CODE/set -H "Authorization: Bearer TOKEN" -H 'Content-Type: application/json' -d @set.json` with `{"set": <exported set JSON>, "keepScores": false}`. Every device returns to the lobby. A second identical request answers 409.

## F48 — Seed starter sets into My sets (2026-10-29)
**What changed:**
- `client/src/lib/db.ts`:
  - `version(2)`, same stores. `populate` (fresh browser) adds the sample at `now`, then the 60 `STARTER_SETS` at `now - 1 - i`.
  - The v1 → v2 `upgrade` adds each starter whose id is not stored at `oldest - 1 - i` (`oldest`: smallest stored `updatedAt`, or now). Own sets stay on top and unchanged.
  - Both chained on Dexie promises, no native `await`. `STARTER_SETS` is a static import, so the data lives in the lazy `db` chunk.
- Build: main `index` chunk 438.92 kB before and after; `db` chunk 112.74 → 286.57 kB (41.83 → 90.27 kB gzip).
- Tests:
  - `db.test.ts` +5: fresh 61 in order with stamps; v1 with two user sets; empty v1 stamped from now; v1 holding a starter id keeps it; a deleted starter is not re-added (fresh and after upgrade). The sample-seed, delete-sample, order, and duplicate tests now include the starters.
  - `Sets.test.tsx` +1: **Host this set** on Animals – Hard sends its 15 questions at 300 points. Count and order expectations take the 60 starters; the empty-state tests clear the table.
  - `Landing.test.tsx`: the picker lists all 62, the newest own set checked.
  - 1155 tests in total. No new dependency.

**Decisions:** the two DECISIONS rows dated 2026-10-29 for F48 cover the populate/upgrade stamping (including the 1 ms gap a skipped id leaves) and the bundle sizes.

**Notes for next session:**
- Playtest (Playwright), all pass:
  - Upgrade path (old profile with a v1 database): 62 sets, own Untitled set first, sample, then the starters 1 ms apart. A deleted Animals – Easy stayed deleted after reload.
  - Fresh profile: 61 cards, sample first, Words & Language – Hard last. **Host a game** preselects the sample.
  - Animals – Easy hosted as room, one Player buzzed, C judged Correct: Screen showed "+100", scoreboard 100, N went to Question 2 / 15.
- Found, not fixed (Backlog): the Screen's question card clips a two-line question at REVEAL.
- The DECISIONS "Proposed spec changes" entry for starter sets is still pending Kim's edit of SPEC.md.
- Browsers keep IndexedDB per origin: the deployed site and `localhost:5173` seed separately.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`: the sample, then Animals – Easy … Words & Language – Hard. An existing profile keeps its own sets above them.
2. **Host this set** on any starter, **Use this device as the Screen**, join from a phone, and play a question: Correct scores 100, 200 or 300 by level.
3. Delete a starter and reload: it stays gone.

## F47 — Starter set data (2026-10-29)
**What changed:**
- `shared/starterSets/<slug>.json`: 20 categories × Easy/Medium/Hard × 15 questions, 60 sets and 900 questions. They were written in Claude Desktop and copied from `~/Downloads/buzzr-starter/`, with the 39 review fixes in `~/Downloads/buzzr-starter-fixes.json` applied by a one-off scratchpad script. The script is not in the repo.
  - Each file is an array of 3 sets in the set file shape, so it also imports through Import JSON.
- `shared/starterSets/index.ts` exports:
  - `STARTER_CATEGORIES`: 20 slugs in list order.
  - `StarterCategory`.
  - `STARTER_SETS`: the 60 sets, parsed with `questionSetSchema.array()` at module load.
- Config:
  - `resolveJsonModule` in `tsconfig.json` and `tsconfig.node.json`.
  - `tsconfig.build.json` excludes `shared/starterSets`, so `dist/shared` has no question data.
  - No new dependency.
- `shared/starterSets.test.ts` (7 tests):
  - order and count;
  - schema parse unchanged, with 15 questions each;
  - key order;
  - titles, points and question ids by level;
  - 900 unique ids and no pictures;
  - `createRoomBodySchema` accepts every set;
  - spot-checks of 4 fixes.

**Decisions:** DECISIONS rows dated 2026-10-29: "starter plan" (content and review), and F47 (file layout, parse instead of cast, the tsconfig changes).

**Notes for next session:**
- F48 seeds these into Dexie. Import `STARTER_SETS` statically into `client/src/lib/db.ts`: it is already a lazy chunk, and the upgrade transaction cannot await a dynamic import.
- Nothing imports the data yet, so the client bundle is unchanged (main `index` 438.9 kB, `db` 112.7 kB). Record F48's sizes against these.
- Only 4 of the 39 fixes are asserted in tests. The review recomputed all 39 against the originals and found 0 differences.
- Known level miss, left as is: `ph-pop-culture-hard-01` (Cardo Dalisay) is easy for Hard. No verified replacement.

**How to try it:** `npx vitest run shared/starterSets.test.ts`. To see the content in the app before F48, Import JSON does not take an array. Copy one set object out of a file into its own `.json` and import that on `/sets`.

## F46 — Slim runtime image and CI job (2026-10-28)
**What changed:**
- `package.json`: `dependencies` is now only what `dist/server` imports: express, proxy-addr, socket.io and zod.
  - react, react-dom, react-router, dexie, howler, `@dnd-kit/core`, `@dnd-kit/sortable`, qrcode.react, zustand, socket.io-client and nanoid moved to `devDependencies`. Versions are unchanged; the lockfile only gained `dev: true` flags.
  - The Dockerfile is unchanged apart from a comment: its prod-deps stage already ran `npm ci --omit=dev`.
- **Image: 266 MB to 245 MB.** `node_modules` inside it went from 41 MB to 18 MB. The `node:24-slim` base is 230 MB, so that is most of what is left. The README's Docker section records this.
- Root `.github/workflows/ci.yml` (outside `buzzer/`):
  - New `buzzer-changes` job: diffs `buzzer/` and `ci.yml` against the PR base or the push's `before`.
  - New `buzzer` job, run only when that says changed: Node 24, `npm ci`, format:check, lint, typecheck, test, build.
- Tests: new `server/dependencies.test.ts` (3). It scans the non-test sources under `server/` and `shared/`, and fails if `dependencies` misses a server import or lists a package the server does not import. A probe file in `server/` that imported nanoid turned it red. 1138 tests in total. No new dependency.

**Decisions:** two DECISIONS rows dated 2026-10-28 for F46:
- what `dependencies` holds, nanoid's move, and the reversed F34 row
- the change gate in `ci.yml`, and why there is no `paths` filter or smoke test there

**Notes for next session:**
- `npm run smoke:docker` printed PASS on the new image (`buzzr:smoke`, 245 MB).
- **The CI job has not run on GitHub yet**: nothing was pushed. `actionlint` (Docker `rhysd/actionlint`) passes the new jobs. Its only finding is an existing SC2086 in the hub `axe` step. The gate script was run locally against four cases: a change, no change, an all-zero base, and a manual run. The job's steps were run locally from a clean `npm ci`.
- On the first push that touches `buzzer/`, check the Actions tab: "buzzer changed?" should print `changed=true`, and "build buzzer" should be green.
- `deploy-buzzer.yml` still runs its own checks job on pushes to main. It has no build step, but its Docker build covers one.

**How to try it:**
1. `npm run smoke:docker` prints `PASS`. `docker images buzzr` shows `smoke` at 245 MB.
2. `npm test -- server/dependencies.test.ts`. Add `import 'react';` to any server file and it fails.
3. After a push or a PR touching `buzzer/`, the CI workflow shows "build buzzer".

## F45 — Socket test harness and typed host emit (2026-10-28)
**What changed:**
- New `server/test/sockets.ts`, the gateway harness shared by the four `server/sockets*.test.ts` files.
  - It exports `TestClient`, `TOKEN`, `start`, `stopAll`, `record`, `recordStates`, `nextState`, `flush`, `screenJoin`, `hostJoin`, `playerJoin`, `openTable` and `serverDisconnect(h, client)`.
  - `start({room, fakeMonotonic, playerJoinLimit})`: `room: null` starts with no rooms, as after a restart. The harness exposes `io`, `rooms`, `connect`, `advance` and `advanceMono`. `advanceMono` throws unless the monotonic clock is fake.
  - `stopAll` closes every gateway and client. Each file calls it from `afterEach`.
- The four test files keep only what is theirs:
  - fake timers and the console spy (buzz, host)
  - `buzz` and `sampleRtt` (buzz)
  - `buzzedTable` (host)
  - `midGame` and a `start` wrapper (reconnect)
  - `nextFx`, `TOKEN_HASH` and `SECRETS` (sockets)
- `client/src/lib/useHostCommand.ts`: the `emit.bind(...) as` cast is gone. `emitHost` takes a `HostEmitter` interface, and the `GameSocket` is assigned to it structurally.
- Tests: 1135 before and after (54 socket tests before and after). No test was changed, and there is no new dependency.

**Decisions:** two DECISIONS rows for F45:
- which clocks and limits `start` fakes or exposes, and why
- how `HostEmitter` stays type-checked with no cast

**Notes for next session:**
- No behaviour change, so no playtest.
- The review raised two should-fix points. Neither was changed:
  - `start` has no option for the clock's start time, and no test needs one.
  - `record<T>` keeps its `as T`, which the old copies already had.
- `sockets.test.ts` still has a deliberate `as` cast on `emitWithAck` for its unknown-event test.

**How to try it:** `npm test`. Typecheck with `npm run typecheck`.

## F44 — Favicon and hover states (2026-10-28)
**What changed:**
- `client/public/favicon.svg`: a round buzz-red button (`--color-buzz` fill, `--color-buzz-edge` rim, a soft highlight) on a rounded `--color-bg` square. `client/index.html` links it with `rel="icon" type="image/svg+xml"`.
- Hover:
  - `@utility hover-tint` in `index.css`: an 8% ink wash as `background-image`, so solid buttons keep their colour.
  - New `client/src/lib/hover.ts`: `HOVER = 'not-disabled:hover:border-ink not-disabled:hover:hover-tint'`.
  - Added to the Screen host bar (`barButton`, the shortcuts sheet's Close, the Show controls pill), Sets (`smallButton`, Import JSON, New set, Room created's two buttons) and SetEditor (`smallButton`, Add question, the Preview bar).
  - `ConfirmButton`'s armed button keeps its red border under hover (`not-disabled:hover:border-red-400!`).
- `vite.config.ts`: `test.css.include` lets `*.css?raw` imports through (Vitest blanked them).
- Tests:
  - New `client/src/favicon.test.ts` (2): the icon link, and the SVG colours equal the `index.css` tokens.
  - New `client/src/test/hover.ts`: `buttonsWithoutHover(root)`.
  - `Screen.test.tsx` +1 (bar with Correct/Wrong and a disabled Undo, the shortcuts sheet, Show controls), `Sets.test.tsx` +1 (list and Room created), `SetEditor.test.tsx` +1 (editor and Preview). Removing `HOVER` from `barButton` fails the Screen test.
  - 1135 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-28 for F44 cover:
- favicon colours from the `index.css` theme tokens, not `shared/constants.ts` (which has only the player palette)
- the tint as an image layer
- the extra buttons covered (Room created, Preview, shortcuts sheet, Show controls) and the armed Confirm's red
- the Vitest `?raw` CSS setting

**Notes for next session:**
- The tests check class strings only. That the classes compile was checked by hand in `dist/client/assets/*.css`: both rules are `:not(:disabled):hover` inside `@media (hover:hover)`, and `favicon.svg` is copied into `dist/client`.
- Playtest (Playwright, Screen at 1920×1080, 7 of 7 steps passed):
  - `/favicon.svg` 200. No console errors on `/`, `/screen/:code`, `/sets` and the SetEditor, and no `/favicon.ico` request (headless Chromium may not fetch icons at all, so that part is weak).
  - Hover turned the border from `edge` to `ink` and added the tint on every enabled host-bar, Sets and SetEditor button. Start game stayed yellow under the tint. Disabled ↑/↓ and the stepper's "−" did not change.
  - Touch was not emulated; the `@media (hover:hover)` wrapper is in the built CSS.
- The Screen lobby's own controls (Pair host phone, side-panel Start game, settings switches and steppers) have no hover yet: Backlog.

**How to try it:** `npm run dev`, then on the laptop with a mouse:
1. Open `http://localhost:5173/sets`: the tab shows the red buzzer icon. Hover New set, a card's Open or Delete: ink border and a faint tint. Tap Delete, then hover Confirm: the border stays red.
2. Open a set: hover Add question, Preview, and the Preview bar's buttons. The disabled ↑ on question 1 does not change.
3. Host the set, use this device as the Screen: hover the host bar's buttons. On a phone, nothing changes on tap.

## F43 — Preview: show answer (2026-10-28)
**What changed:**
- `previewView(set, index, reveal = false)` in `client/src/lib/setEditor.ts`. With `reveal`, the view is phase REVEAL with `question.answer`, `scorerId: null` and no players. Host notes are never copied.
- `QuestionPreview`: a **Show answer** toggle (`aria-pressed`) first in the bottom bar, also on the `A` key.
  - On, the preview draws the Screen's own reveal layout (answer card, no scorer chip).
  - Previous and Next (buttons and ←/→) turn it off. Closing unmounts it, so it is off on the next opening.
  - A blank answer (after trimming) disables the button, and `A` does nothing.
  - `A` is ignored on key repeat and with Ctrl, Meta or Alt.
  - Pressed style: accent border, text and a faint accent tint. The bar's base button class is split so the border colours do not conflict.
  - The key listener now goes through `useEffectEvent` and subscribes once.
- Tests:
  - New `client/src/components/QuestionPreview.test.tsx` (7): starts off, the button shows the reveal (answer, no notes, no scorer) and hides it, the `A` key with case, modifiers and repeat, reset on Previous/Next by button and arrow, arrows at the ends leave it on, reset after close and reopen, and the disabled toggle for a blank answer.
  - `setEditor.test.ts` +1: the reveal variant.
  - 1130 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-28 for F43 covers the blank-answer rule, the key filtering, arrows at the ends, and the no-scorer reveal view.

**Notes for next session:**
- Playtest (Playwright, set editor at 390×844 and 1920×1080), 8 of 8 steps passed: toggle present and `false`, click on, `A` both ways, the reveal layout with "Jupiter" and no scorer chip, reset on Next, reset on Previous, reset on close and reopen, and disabled with `A` inert on a blank answer.
- The playtest noted the pressed state was clear only from its yellow text: the accent border lost to `border-edge`. Fixed after the playtest (accent border and tint). Not re-screenshotted.
- The DECISIONS "Proposed spec changes" backlog entry already carries the F43 spec text.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, open a set and tap **Preview** on a question.
2. Tap **Show answer** or press `A`: the answer appears as at reveal. Press `A` again to hide it.
3. Turn it on, then press → or **Next →**: the next question opens with the answer hidden. Close and reopen: also hidden.
4. Clear a question's answer and preview it: **Show answer** is disabled.

## F42 — Join address and room-check limit (2026-10-28)
**What changed:**
- Server:
  - New `GET /api/config` → `{joinOrigin}`. It returns `PUBLIC_URL` when set. Otherwise, when `req.hostname` is loopback, it returns `http://<first private IPv4>` (no port). Otherwise null.
  - `server/env.ts`: `parsePublicUrl` (a bare http(s) origin, or start-up throws) and `lanAddress(interfaces)` (10/8, 172.16/12, 192.168/16; skips `docker*`, `br-*`, `veth*`). `createApp` takes `publicUrl` and an injectable `interfaces`.
  - `GET /api/rooms/:code/exists` is limited by `ROOM_CHECK_RATE_LIMIT` (30/min per `req.ip`). Past the limit it answers 429 `{ok: false, error: ROOM_CHECK_RATE_LIMITED_ERROR}`.
- Client:
  - `useJoinOrigin` fetches the config once per Screen mount.
  - `joinPageOrigin` gives a port-less origin the page's port when the protocols match. The QR, the join URL and the bottom strip all use it.
  - The localhost note shows only once the server has answered null.
  - `roomExists` throws the server's error message. On the 429, `/play/:code` shows "Slow down" with "Too many tries. Wait a minute and try again."
- Deploy:
  - `compose.deploy.yaml` sets `PUBLIC_URL=https://buzzr.kimnejudne.dev`.
  - `docker-smoke.sh` passes it and checks `/api/config`.
  - The README env table has a `PUBLIC_URL` row.
- Tests:
  - `http.test.ts` +6: config for PUBLIC_URL, loopback, non-loopback and no LAN; the 31st check gets 429 and the window slides; forwarded IP.
  - `env.test.ts` +6.
  - `joinUrl.test.ts` +3.
  - `Screen.test.tsx` +3 (the old note test is replaced by 4 in "join address").
  - `api.test.ts` +3 and `Play.test.tsx` +1.
  - 1122 tests in total. No new dependency.

**Decisions:** the seven DECISIONS rows dated 2026-10-28 for F42 cover:
- `PUBLIC_URL` validation
- what counts as a loopback Host, the LAN pick, and a spoofed Host
- the port rule's protocol match
- the fetch-once behaviour and no note while loading (supersedes the F08 join-QR row)
- Docker needing `PUBLIC_URL` for a LAN
- the room check counting every request, and the "Slow down" title
- the pairing QR going to Backlog

**Notes for next session:**
- Playtest (Playwright, dev server):
  - `/api/config` gave `http://192.168.1.235` for loopback, null for `example.com` and for the LAN host, and `PUBLIC_URL` when set. A bad `PUBLIC_URL` stops the server.
  - Calls 1–30 of `/exists` answered 200, then 429 with the message. The join flow from `/` reached `/play/ABCD`, which showed "Slow down…".
  - The Screen lobby at `localhost:5173` read "Join at 192.168.1.235:5173/play/TEDN", in the strip too, with no localhost note.
- The 429 shows on `/play/:code`, not on the Landing code form: Landing only navigates, and the check runs on `/play`.
- Before the config answers, the QR briefly encodes the page origin. That is a few ms on localhost; review flagged it as a Should-fix, and it was not changed.
- Backlog: the pairing QR (`PairHostPhone`) still uses the page origin.
- `npm run smoke:docker` prints PASS, including the new `/api/config` check.
- The spec's proposed text for F42 is in DECISIONS → Proposed spec changes; SPEC.md is unchanged.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and host a set. The Screen lobby shows `Join at <LAN-IP>:5173/play/<CODE>` and no localhost note. Scan the QR with a phone on the same Wi-Fi: it opens the join page.
2. `curl -s localhost:3000/api/config` returns the LAN origin. `curl -s -H 'Host: example.com' localhost:3000/api/config` returns null.
3. `for i in $(seq 31); do curl -s -o /dev/null -w '%{http_code} ' localhost:3000/api/rooms/ABCD/exists; done` ends in 429. A phone opening `/play/ABCD` within that minute shows "Slow down".

## F41 — Connection awareness (2026-10-28)
**What changed:**
- `lib/ping.ts`: `keepPinging` takes `onAck` and `onLost`. `onLost` fires once when a ping is due and the previous `PINGS_LOST` (2) are unanswered. Any ack resets the count and calls `onAck`. A reconnect starts afresh.
- `lib/useRoomSocket.ts`: pings for every role (Screen, Host, Player); `attach`/`AttachSocket` removed and `Play.tsx` no longer attaches its own ping. One `linkDown` (disconnect, lost pings, window `offline`) sets `connecting` (red stays red) and starts the 5 s offline clock if not running; `linkUp` (connect, any ack) sets `connected`. `online` does nothing.
- Screen: new `components/ReconnectingBanner.tsx`, a 3.2vw amber "Reconnecting…" bar fixed across the top while `connection === 'offline'`; the stage stays underneath.
- Host Players tab: "status unknown", dimmed, on every row while the remote's own `connection` is not `connected`.
- Tests: new `useRoomSocket.test.tsx` (10: pings on every page, two misses then 5 s, one miss is nothing, late ack, ack from offline, `offline` event, `online` no-op, disconnect keeps the clock, red stays red, unmount). `ping.test.ts` +3, `Screen.test.tsx` +1 (banner at 4999/5000 ms, snapshot kept, gone on connect), `HostControls.test.tsx` +3. 1100 tests in total. No new dependency, no server change.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F41 cover: every role pinging (Kim's choice), when a silence counts as lost and what counts as an ack, the shared `linkDown` clock, the banner's placement, and "status unknown".

**Notes for next session:**
- Playtest (Playwright; Screen 1920×1080, Host, two Players): server killed, no banner at ~2 s, banner by ~8 s with the lobby underneath; Host Players tab "status unknown" for both players; restart cleared the banner (then "This game has ended", as F32). Host context set offline: "status unknown" within 300 ms, back to "online · 0 ms" within 4 s of going online.
- Not seen live: the two-missed-acks path (a killed server closes the socket at once). Unit tests cover it. Check on a real phone by walking out of Wi-Fi range.
- The banner covers the top of the lobby title and QR while it shows. Intended (DECISIONS F41); revisit if it bothers on the TV.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, pair a phone as Host, join from another phone.
2. Stop the server (Ctrl-C). After 5 s the Screen shows "Reconnecting…" across the top; the Host's Players tab says "status unknown"; the phone dots go amber then red.
3. On a phone, toggle airplane mode: its dot turns amber at once (browser `offline`).

## F40 — Host remote: game over, stable order, tab keys (2026-10-28)
**What changed:**
- Server: `hostView` ranks the players, then sends them in join order (`joinedAt`, then id). Each row keeps its `rank`. Screen and Player views stay ranked. `HostView.players` has a comment saying so.
- Host remote (`Host.tsx`):
  - In FINAL the Game tab shows a new `GameOverCard` in place of the question card: "Game over", then each player's ordinal rank, colour dot, name and score, sorted by `rank` with ties in join order. "No players" when empty. Show/Hide scoreboard stays in the secondary actions.
  - Tabs follow the WAI-ARIA pattern: roving `tabIndex`, and the tablist's `onKeyDown` (`tabForKey`) handles ←/→ (wrapping), Home and End. Each key selects the tab, shows its panel and focuses it.
- Tests: `views.test.ts` +3 (join order with rank; order kept after two score changes while the Screen re-ranks and the Player's rank updates; id tie-break). `Host.test.tsx` +10 (tab order, ←/→, wrap, Home/End, other keys; FINAL card, shared rank, no players, scoreboard toggle, no card before FINAL). 1083 tests in total. No new dependency.

**Decisions:** one DECISIONS row dated 2026-10-28 for F40 covers the card layout, the tie order, the id tie-break and where the keys are handled. The three "backlog plan (F40)" rows were Kim's choices.

**Notes for next session:**
- Playtest (Playwright; Screen at 1920×1080, Host and two Players at 390×844), every step passed:
  - Tab keys: roving `tabIndex`, → / ← with wrap both ways, Home / End.
  - After Correct for Bob and ± on both players, the Host list stayed Ann, Bob while the Screen scoreboard showed Bob 300, Ann 200.
  - FINAL: "Game over" with "1st Ann 300" and "1st Bob 300" (shared rank). Show/Hide scoreboard toggled.
- The Players tab still shows no rank, only the order. The roadmap asked for `rank` in the view, not on the row.
- The ± buttons still work in FINAL (F22), so a correction after the game re-ranks the card live.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, and pair a phone as Host. Join from two phones.
2. On the Host, open Players, then tap +100 on the second player a few times: the rows never move. The Screen scoreboard re-ranks.
3. End the game: the Game tab shows "Game over" and the ranking.
4. With a keyboard (laptop browser), focus the Game tab and press →, ←, Home and End.

## F39 — Buzz eligibility and monotonic window (2026-10-28)
**What changed:**
- Shared:
  - `Room.windowStartedAt: number | null` holds the monotonic `receivedAt` of the opening's first buzz. `UndoPoint` stores it alongside the buzzes.
  - `PlayerView.canBuzz: boolean`.
- Server:
  - `fairness.ts` gains two helpers:
    - `inWindow(buzz, start)` uses raw `receivedAt ≤ start + 150`, inclusive. With a null start, every buzz counts.
    - `rankOpening` ranks the in-window buzzes, then the late ones.
  - Reducer:
    - New exported `canBuzz(room, playerId)`: OPEN or COLLECTING, and the player is eligible. A BUZZED press from an eligible player is still recorded as a late "also buzzed".
    - The first buzz sets `windowStartedAt`. Every route that empties `buzzes` clears it. Judge snapshots it and undo restores it.
    - `windowClosed` picks its winner from in-window buzzes only. If a kick leaves only late buzzes, it reopens the buzzers.
  - `views.ts`: `canBuzz` comes from the reducer. The `alsoBuzzed` list and the `fx buzz` gaps use `rankOpening`.
- Client: in OPEN and COLLECTING, `buzzerState` shows a grey, disabled button reading "Get ready… you can buzz from the next question" when `canBuzz` is false and the player is neither locked out nor already buzzed. While it shows, the phone sends no buzz (`live: false`).
- The DECISIONS F14 row "window stays open until `windowClosed` arrives" is marked superseded.
- Tests:
  - New `server/reducer.window.test.ts` (17):
    - the start is set and kept
    - a buzz at exactly +150 ms counts, and the next millisecond does not
    - a late-timer buzz with a lower `adjustedTime` loses
    - a kick that leaves only late buzzes reopens the buzzers
    - a null start counts every buzz
    - the start is cleared on reveal, next, auto-open next, FINAL, prev, reopen and three kick routes, and restored on undo
  - `views.test.ts` +12: a `canBuzz` table checked against what the reducer counts.
  - `fairness.test.ts` +4, `buzzerState.test.ts` +3 and `Play.test.tsx` +1 (grey button, and no buzz from pointerdown or Space).
  - Client fixtures derive `canBuzz` from phase, lockout and hasBuzzed unless a test overrides it.
  - 1070 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F39 cover:
- one `canBuzz` for both the view and the reducer, with BUZZED false
- when the late-joiner label shows
- where `windowStartedAt` is cleared, `host:end` keeping it, and undo restoring it
- the inclusive window, and the in-window-then-late order
- why only a kick lets the cut change the winner, the anchor staying on the first buzz after a kick, and the reopen

**Notes for next session:**
- Without a kick, a late buzz can never beat the first buzz: its adjusted time is always above `windowStartedAt`. The cut matters for the also-buzzed order and when the first buzzer is kicked mid-window. That is how the tests show it.
- Playtest (Playwright; Screen, Host remote, 4 Players at 390×844):
  - A player who joined during OPEN got the grey label, and a forced click sent no buzz.
  - Players who joined late got a normal BUZZ! on the reopen after Wrong.
  - The answer did not leak.
  - The COLLECTING frame (150 ms) was too short to catch in the UI. Unit tests cover the label in COLLECTING.
  - `favicon.ico` 404 (F44).
- No gateway-level late-timer test. The gateway's `receivedAt` source is unchanged, and the reducer tests cover the rule.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, and pair a phone as Host. Join from one phone and start.
2. Open the buzzers. Join from a second phone now: it shows "Get ready… you can buzz from the next question" on a grey button, and tapping it does nothing.
3. Buzz from the first phone and mark it Wrong. After the reopen, the second phone shows BUZZ!.

## F38 — Screen lobby fit (2026-10-28)
**What changed:**
- **Pair host phone** opens a dialog instead of growing the lobby:
  - It is a portal on `body` with `role="dialog"` and `aria-modal`. It holds a large QR (`min(58vh, 45vw)` on the Screen), "Hides in N s" and Hide (with an Esc hint on fine pointers).
  - It closes on Hide, Esc, the 60 s deadline, or a host joining. Hide takes focus and Tab stays on it. Focus returns on close. Esc is caught in the capture phase, so the page behind it never sees that press.
  - The remote uses the same dialog (qr `min(70vw, 20rem)`).
- Host joined, end to end:
  - New server→client event `host:paired` (empty payload). `host:join` sends it to the Screen and host rooms with `socket.to(...)`, so the joiner never gets it, and a refused token sends nothing.
  - `roomStore.hostJoins` counts it. `PairHostPhone` records the count when it opens and closes when the count moves.
- Lobby fit:
  - New `client/src/lib/useShrinkToFit.ts`. The chip list (`flex-1 min-h-0`) takes the column's leftover height. The hook binary-searches the list's font size, from the old 2.44 / 1.56 cqw down to a floor of 8 px, until the chips fit. It refits on resize (ResizeObserver), on `document.fonts.ready` and on a change of names. Chip padding and gap are now in `em`.
  - Past 20 players: room code `clamp(3rem, 12cqw, 24vh)`, join QR `min(30vh, 22cqw)`.
  - **Pair host phone** moved under the join QR. The lobby has `pb-[2vh]` above the strip.
- `HostSettings` takes `compact`, and the Screen's Game setup panel uses it. The remote's rows are unchanged.
- Tests:
  - New `PairHostPhone.test.tsx` (6): the dialog, focus and Tab, Esc not reaching the page, a host join, a join while closed, and the deadline.
  - New `useShrinkToFit.test.tsx` (5): full size, shrink to half a pixel, the floor, refit on content change and on resize. Layout is faked, because jsdom has none.
  - `Screen.test.tsx`: the pairing block was rewritten for the dialog (8 tests). It adds a dialog over the lobby, Esc not starting the game, a `host:paired` close, and Space starting the game with the dialog open.
  - `sockets.test.ts` +2: who gets `host:paired`, and none on a wrong token.
  - `HostControls.test.tsx` +1: compact and regular sizes.
  - 1033 tests in total. No new dependency.

**Decisions:** the six DECISIONS rows dated 2026-10-28 for F38 cover:
- the `host:paired` event and who receives it
- a reconnecting remote also closing the QR
- the remote getting the dialog
- the dialog's focus, Esc and shortcuts behind it
- how the chips are fitted, and the many-player header
- the compact sizes

**Notes for next session:**
- Measured with Playwright, 50 players (my own script plus `/playtest`). Every chip's bottom was at or above the list bottom and the strip top:
  - Plain Screen, short names, with the localhost note: chip font 19.0 / 13.2 / 12.7 px at 1920×1080 / 1366×768 / 1280×720. 0 hidden.
  - Hosting Screen, short names: 17.3 / 12.2 / 11.4 px. 0 hidden.
  - Long names (`Bartholomew 01`…) on the LAN URL: 0 hidden at all six combinations. The tightest was the hosting Screen at 1280×720, with the last chip at 590 against the list bottom at 591.
  - The ~5 px chip/footer overlap is gone. The list now ends 22 px (1920×1080) above the strip.
  - Game setup at 1280×720: `scrollHeight` 555 = `clientHeight` 555, so all four rows and Start game show without scrolling.
- `/playtest` F38: 7 of 7 steps passed.
  - The dialog closed when a second tab opened the pairing URL.
  - Esc left the room in LOBBY, and Space went to "Question 1 of 10".
  - The chip-list box was identical before and during the dialog.
  - The remote's Settings tab at 375 px looked normal.
  - The 60 s close was checked only by unit tests.
- At 1280×720 with long names and the panel, the chips are about 10 px. They fit, but they are hard to read from 5 m. Only a full room on a 720p Screen gets that small.
- The other Screen shortcuts (C, X, N…) still act behind the dialog. In LOBBY that only matters for S, F, H and ?.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://<LAN-IP>:5173/sets` → **Host this set** → **Use this device as the Screen**. Add bots from `/dev/bots/<CODE>` (up to 50).
2. Resize the window to 1280×720: every chip stays above the bottom strip, and Game setup shows all its rows and Start game.
3. Click **Pair host phone**: a dialog with a big QR. Esc or Hide closes it. Open it again and scan it with a phone: it closes as the phone joins.
4. Press Space: the game starts.

## F37 — Settings in the Screen lobby (2026-10-28)
**What changed:**
- On a Screen whose hostToken the server accepted, the lobby has a "Game setup" panel on the right:
  - a **Start game** button (Space)
  - the remote's `HostSettings`, unchanged: wrong-answer penalty, auto-open buzzers, answer time, scoreboard every N
- It is not on a plain Screen, or on one whose stale token fell back to a plain join. It goes away when the game starts.
- `HostSettings` takes `HostView | ScreenView`. It reads only `settings`, which the ScreenView already carried.
- The Screen page owns one `useHostCommand` and one `Toast` in the new `ScreenStage`. The bar, the shortcuts and the panel share them. `ScreenHostControls` now takes `command`, not `send`.
- Lobby sizing: the main column is an `@container`, with sizes in `cqw` (N vw ÷ 0.9). A plain Screen looks exactly as before. Beside the panel, the code, URL, QR and chips shrink instead of wrapping.
- Tests: `Screen.test.tsx` +6 (`lobby settings`):
  - the panel shows only with an accepted token
  - it leaves at start
  - a toggle and the stepper send `host:settings` with one key
  - a refusal toasts and releases the lock
  - the lobby Start sends `host:start`
  - Space on a focused switch sends only `host:start` and blurs it
- 1016 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-28 for F37 cover:
- the panel with its own Start game, and showing it only with `canHost`
- the shared lock and toast
- Space while a control has focus (the existing blur)
- the `cqw` sizing, and the panel staying in rem

**Notes for next session:**
- Playtest (Playwright; a Screen that created the room, plus one Player): 4 of 4 flow steps passed.
  - I turned on auto-open and set 3 s in the lobby.
  - With "More answer time" focused, Space started the game without changing the value.
  - The buzzers opened with no host action. The Player saw 3, 2, then "Time's up!".
  - The no-token case and the failed-ack toast are covered by unit tests only.
- Layout, measured at 1920×1080, 1366×768 and 1280×720:
  - The first version wrapped the join URL and hid the room code's 4th letter. With `cqw`, the code and URL stay on one line at all three sizes, and a plain Screen is unchanged.
  - Backlog: at 1280×720 the panel scrolls about 67 px, and "Scoreboard every" is below the fold.
  - Backlog, not caused by F37: with **Pair host phone** open, the player chips are pushed below the footer.
- The Start game button now appears twice in the lobby, in the panel and on the auto-hiding bar. This is intended.
- The DECISIONS "Proposed spec changes" entry for lobby settings is already in SPEC.md and can be pruned.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and host a set. Choose **Use this device as the Screen**, then Click to start. Join from a phone at `http://<LAN-IP>:5173/play/<CODE>`.
2. In the lobby's right panel, turn on **Auto-open buzzers** and set **Answer time** to 3 s.
3. Press Space (or **Start game**). The buzzers open by themselves. Buzz from the phone: the 3 s countdown runs on the Screen and the phone.
4. Open `/screen/<CODE>` in a private window: there is no panel.

## F36 — Answer countdown and time's-up on the devices (2026-10-28)
**What changed:**
- New `client/src/lib/useAnswerCountdown.ts`:
  - `useAnswerCountdown(view)` returns `{secondsLeft, up}` or null.
  - It is keyed by question index and opening counter, so it restarts on a new question or opening. It reads `Date.now()` every 250 ms and stops at 0. `up` comes from the view.
  - `countdownText` and `TIME_UP_LABEL` ("Time's up!") come from the same file.
- Winner's phone: `buzzerState` takes the countdown. The winner gets "You're first! Answer now" with a big `secondsLeft` number, then "Time's up!". Other phones are unchanged.
- Screen:
  - A `Countdown` box sits beside the winner's banner. At time up it turns red and reads "Time's up!".
  - `ScreenFlash` flashes red on `fx timeUp`.
  - New `timeUp` sound: `client/public/sounds/timeUp.wav`, made by `scripts/make-sounds.mjs`. The other WAVs regenerate byte-identical. `soundForFx` now always returns a sound.
- Host remote:
  - An "Answer time" row directly above Correct / Wrong, then a red "Time's up" badge.
  - `useVibrateOnTimeUp` in `Host.tsx` calls `navigator.vibrate([200, 100, 200])` on each fresh `fx timeUp`.
- Tests:
  - New `useAnswerCountdown.test.ts` (10, fake timers).
  - `buzzerState` +3, `sounds` (timeUp mapped), `Screen` +4 (+ timeUp in the sound test), `Host` +5 and `Play` +2.
  - `Play.test.tsx` now restores real timers after each test.
  - 1010 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-28 for F36 cover:
- how the countdown starts, ticks, stops at 0, and defers to the server's `up`; a late joiner counts from the full time
- the Host countdown in its own row above Correct / Wrong (too narrow for a middle column at 375 px)
- the vibration pattern, only for events after mount, Host only
- the sound's design, and reusing the red flash

**Notes for next session:**
- Playtest (Playwright; Screen, Host remote, two Players in separate contexts; answer time 3 s), 6 of 6 steps passed:
  - The winner's phone counted 3, 2, 1, then "Time's up!". The other phone stayed "Ann buzzed first".
  - The Screen counted beside the banner, then showed a red "Time's up!" box. The `timeUp` flash fired once, and `/sounds/timeUp.wav` served 200 (not heard).
  - The Host counted 3, 2, 1, then the badge. A stubbed `navigator.vibrate` got `[200,100,200]` once.
  - The next question restarted at 3 on all three devices.
  - With the timer set back to Off, every view looked as before.
  - No answer text before reveal.
- Not checked: the reduced-motion tint, the sound by ear, and a real phone's vibration.
- The F35 DECISIONS row saying `timeUp` is silent "until F36" is now history; the F36 sound row supersedes it.
- With the timer on, F37 (settings in the Screen lobby) is the last roadmap feature.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, and click **Click to start** on the Screen. Pair a phone as Host, and join from one or two more phones.
2. On the Host phone, open Settings and set **Answer time** to 3 s.
3. Start, open the buzzers and buzz. The Screen shows 3, 2, 1 beside the winner's name, then "Time's up!" with a red flash and the new sound. The winner's phone counts down too; the Host phone counts above Correct / Wrong, then shows "Time's up" and vibrates (Android Chrome; iOS has no vibration).
4. Judge as usual. Set Answer time back to Off: no countdown anywhere.


## F35 — Answer timer: server and phone setting (2026-10-28)
**What changed:**
- Shared:
  - `RoomSettings.answerSeconds` (`AnswerSeconds`: 0, 3, 5, 7 or 10; default 0 = off).
  - `ANSWER_SECONDS_CHOICES` in `constants.ts`.
  - `roomSettingsSchema` takes `z.literal(ANSWER_SECONDS_CHOICES)`, so room creation and `host:settings` both validate it. It is required in the create body.
  - `Room.answerTimer {seconds, endsAt, up}`.
  - `answerTimer {seconds, up} | null` on Screen, Host and Player views. `endsAt` never leaves the server.
  - New `fx {kind: 'timeUp', playerId}`.
- Reducer:
  - `windowClosed` starts the timer when `answerSeconds > 0`, and schedules `answerTimeUp {questionIndex, openingCounter, at}`.
  - A fresh `answerTimeUp` sets `up: true` and emits `fx timeUp`. Fresh means BUZZED, no pending reopen, not already up, `endsAt === at`, and the same index and counter. Nothing is judged.
  - The timer is cleared by both judgements, reveal, reopen (`openBuzzers`), kick of the winner, next, prev (`clearedQuestion`), end and undo.
  - The settings merge takes the new key. A running timer is untouched.
- Client:
  - The Settings tab has an "Answer time" stepper: Off, 3, 5, 7, 10 s.
  - `soundForFx` returns null for `timeUp`, and `useScreenSounds` skips it. The sound comes in F36.
- `scripts/docker-smoke.sh` builds its room body from `DEFAULT_SETTINGS`, so a new settings key cannot 400 it again.
- Tests:
  - New `server/reducer.timer.test.ts` (31): start, off, each choice, time up, judging after time up, every clear, every stale case (including undo then wrong again, a mismatched `at`, and a repeat), and a settings change mid-countdown in both directions.
  - `sockets.buzz.test.ts` +2: the timer fires through the gateway to all four sockets, and an invalid `answerSeconds` is refused.
  - `views.test.ts` +3, `schemas.test.ts` +2, `constants.test.ts` +1, `HostControls.test.tsx` +9 and `sounds.test.ts` +1. Settings expectations were extended with the new key.
  - 987 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F35 cover:
- what makes `answerTimeUp` fresh, and undo returning without a timer
- a disconnecting winner, or a kick of another player, leaving the timer running
- settings applying from the next buzz
- views without `endsAt`, with devices counting down locally
- the required create key, and the silent `timeUp` until F36

**Notes for next session:**
- Playtest (Playwright; Screen, Host remote, one Player), 7 of 7 steps passed:
  - The stepper runs Off → 10 s and stops at both ends.
  - `answerTimer` reaches all three roles, then `up: true` and `fx timeUp`. The Player still shows "You're first! Answer now".
  - A change from 5 s to 3 s mid-countdown applied from the next buzz.
  - Wrong, Correct and Undo cleared the timer.
  - No websocket frame carried `endsAt`.
- No device shows the countdown yet. That is F36.
- `npm run smoke:docker` prints PASS. It had failed with 400s until the smoke body included the new key.
- The DECISIONS "Proposed spec changes" entry for the answer timer is already in SPEC.md (commit 7d45855). It can be pruned when convenient.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets`, host a set, and pair a phone as Host. Join from another phone.
2. On the Host phone, open Settings and set **Answer time** to 3 s.
3. Start, open the buzzers and buzz. In devtools, the Socket.IO frames show `answerTimer {seconds: 3, up: false}`, then after 3 s `up: true` and an `fx timeUp`. Correct / Wrong still work.

## F34 — Dockerfile and deploy guide (2026-10-28)
**What changed:**
- `Dockerfile` with four stages on `node:24-slim`: deps, build, prod-deps and runtime.
  - It runs `node dist/server/index.js` as the `node` user, with `NODE_ENV=production`, on `PORT` 3000.
  - It has a `HEALTHCHECK` on `/healthz`.
  - The image is 266 MB. `.dockerignore` keeps the context small.
- Deploy target, chosen by Kim: the droplet at `buzzr.kimnejudne.dev`.
  - `deploy/compose.deploy.yaml` runs the container on `127.0.0.1:3005` with `TRUST_PROXY=1`, `IMAGES_MAX_MB=200` and `mem_limit: 384m`.
  - `deploy/nginx/buzzr.conf` sends everything to Node. `/socket.io/` gets the WebSocket upgrade, a 120 s read timeout and no buffering. `client_max_body_size` is 2m.
  - `deploy/nginx/buzzr-bootstrap.conf` is the HTTP-only vhost used for the first certbot run.
- New `README.md`: dev commands, Docker, env vars, and the droplet runbook (DNS, bootstrap, ACME probe, cert, ship image, compose, vhost, routine deploy, rollback, health checks).
- Server:
  - New `server/env.ts`: `parseTrustProxy` (moved from `index.ts`, unchanged) and `parseImagesMaxBytes` for the new `IMAGES_MAX_MB` env var.
  - `index.ts` exits on SIGTERM and SIGINT, so `docker stop` is immediate.
- Tests:
  - New `server/env.test.ts` (7).
  - New `scripts/docker-smoke.sh` (`npm run smoke:docker`). It builds and runs the image with the compose file's env, then checks:
    - `/healthz` 200
    - `/` and `/play/ABCD` serve the client
    - a Socket.IO WebSocket connects
    - the 11th room from one forwarded IP gets 429 and another IP gets 201
    - the process runs as `node`
    - `docker stop` takes under 5 s
  - 938 tests in total. No new dependency.

**Decisions:** the six DECISIONS rows dated 2026-10-28 for F34 cover:
- the droplet target, port 3005, and shipping the image (this resolves open question #1)
- nginx proxying everything, the WebSocket headers, the body size, and `http2` on nginx 1.24
- `TRUST_PROXY=1` and the right-most-XFF reasoning
- `IMAGES_MAX_MB`, and its 200 MB value on the droplet
- the SIGTERM exit
- the image keeping client libraries (Backlog if size matters)

**Notes for next session:**
- **Not deployed yet.** Step 1 (the Namecheap A record `buzzr`) is Kim's. Then follow README → Deploy → First deploy. Nothing was changed on the droplet; I only made a read-only check of its memory, ports and vhosts.
- **Not done: the spec's manual acceptance checklist on real devices**, including mobile data, and the F33 Wake Lock check over HTTPS. Both need the deploy.
- Checked locally with `nginx:1.24` (the droplet's version) in front of the image, using a dummy cert:
  - `nginx -t` passes for both vhosts.
  - `/healthz` answers 200 over HTTP/2, and HTTP gets a 301 to HTTPS.
  - The WebSocket upgrade answers 101.
  - A 1.4 MB image upload gets 201.
  - Rate limit: 10 rooms, then 429, even with a different spoofed XFF each time. A second source address (127.0.0.2) still got 201.
- The droplet had about 730 MB available, with swap in use (656 MB). Watch `docker stats` after the first real game with photos.
- A deploy ends every live game (rooms are in memory). The README says to deploy only between games.
- The local Docker uses the legacy builder (no buildx), so the `# syntax=` line is ignored. It does no harm.

**How to try it:**
1. `npm run smoke:docker` prints `PASS`.
2. Or by hand: `docker build -t buzzr . && docker run --rm -p 3000:3000 buzzr`, then open `http://localhost:3000` (Screen) and `curl -i http://localhost:3000/healthz`.
3. Deploy: README.md → Deploy → First deploy, steps 1–8. Then run the SPEC manual checklist with the laptop on the TV, a Host phone, and players on Wi-Fi and on mobile data.

## F33 — Device polish and feedback (2026-10-28)
**What changed:**
- Wake Lock: new `client/src/lib/useWakeLock.ts`, used by the Player's buzzer screen.
  - It requests `navigator.wakeLock.request('screen')` on mount and again on each return to the page.
  - It skips a request while it still holds a lock or one is pending, and releases on unmount.
  - Where the API is missing or refuses, it does nothing.
- Connection dot: new `components/ConnectionDot.tsx`, in the Player's colour bar and beside the code on the Host remote.
  - `roomStore` gains `connection` (`connected` / `connecting` / `offline`).
  - `useRoomSocket` sets it on `connect` and `disconnect`. It turns `offline` after `OFFLINE_AFTER_MS` (5 s) down.
  - Green, amber and red come from `win`, the new `--color-warn` token and `buzz`. Each state has an aria-label: Connected, Reconnecting… or Offline.
- Toasts: a refused `player:buzz` now shows its reason in the shared toast. Host and Screen controls already toasted.
- Empty states: "No players yet" on the Scoreboard overlay, and "No bots yet" on `/dev/bots`. Every other list already had one (see DECISIONS).
- Tests:
  - New `useWakeLock.test.ts` (7): hold and release, re-acquire on visible, no double lock while holding or pending, a lock granted after unmount is released, no API, and retry after a refusal.
  - `Play.test.tsx` +4: the buzz-refusal toast, no toast on ok, the dot's green, amber, red and green again, and the wake lock on the buzzer screen.
  - `Host.test.tsx` +1 (the dot), `Screen.test.tsx` +1 (empty scoreboard) and `DevBots.test.tsx` +1.
  - 931 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F33 cover:
- what each dot colour means, and the 5 s threshold
- where the dot sits, and the warn token
- the wake lock's lifetime, and why it needs HTTPS
- which failed acks toast and which keep their page
- the empty-state audit

**Notes for next session:**
- Playtest (Playwright; Screen, Host and Players at 390×844):
  - `navigator.wakeLock.request` ran on the Player's buzzer screen.
  - Host and Player dots were green ("Connected"). After the server was killed, the Host's dot was red ("Offline").
  - "Start game" with no players toasted "Wait for at least one player to join". A taken name showed "That name is taken" on the form.
  - The Host Players tab and the Screen lobby showed their empty states.
- Not seen live: amber (the sampling every 1.5 s did not land in the 5 s window), green again after a reconnect, and the wake lock re-acquired after a real tab switch. Unit tests cover all three.
- **Not done: the manual check on a real phone.** Wake Lock needs HTTPS, so on `http://<LAN-IP>:5173` the phone can still sleep. Check it on the F34 deploy: the screen should stay on while the buzzer shows.
- A silent drop (airplane mode, Wi-Fi out of range) is noticed only by Socket.IO's heartbeat, which is up to about 45 s with the defaults (`pingInterval` 25 s, `pingTimeout` 20 s). Until then the dot stays green. A closed connection (server down, page reloaded) turns it amber at once. Shorter heartbeat or the browser's `offline` event: Backlog.
- After a server restart, the dot does go green on reconnect, but the rejoin is refused and the page shows "This game has ended" (F32). Green-again only shows after a network blip.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and tap **Host this set**. Pair a phone as Host and join from another phone.
2. Both phones show a green dot: in the Player's top bar, and beside the room code on the Host.
3. Stop the server (Ctrl-C): both dots turn amber, then red after 5 s. (A restart ends the game, as in F32.)
4. On the deployed HTTPS URL, leave the Player phone idle on the buzzer: the screen stays on.

## F32 — Reconnects and room lifecycle (2026-10-28)
**What changed:**
- Server:
  - Every successful `*:join` also joins the Socket.IO room `room:<code>` (`anyRoom`).
  - New `closeRooms(io, codes, reason)` in `server/sockets.ts` sends `room:closed {reason}` to that room, then disconnects its sockets.
  - `index.ts` now attaches the gateway before the sweeper. `onExpired` frees images, then calls `closeRooms(…, 'expired')`.
  - New shared constants: `ROOM_NOT_FOUND_ERROR`, `GAME_ENDED_ERROR` and `ROOM_EXPIRED_REASON`. The gateway and the reducer use them in place of string literals.
- Client:
  - `useRoomSocket` turns `room:closed` into "This game has ended". It does the same for a "Room not found" rejoin once the page has had a `state` (a server restart mid-game).
  - On a first load, "Room not found" also becomes "This game has ended" when the device was in the room: a Screen with a stored token, any Host page, or a Player with a stored identity.
  - Play no longer sends a saved player back to the name form on "Room not found". A new player whose room vanished between the check and the join sees "Room not found".
  - The Host's Players tab greys the name line of an offline player (`opacity-40`). The ± and Kick buttons stay at full strength. The Screen's chips and ranking already greyed offline players.
- Tests:
  - New `server/sockets.reconnect.test.ts` (6):
    - a player rejoins with their score and lockout
    - an offline player stays listed on Screen and Host
    - a refreshed Screen and Host get the latest snapshot, and the token Screen can send host actions again
    - the host can judge a buzz winner who has disconnected
    - expiry sends `room:closed` to all three roles and disconnects them, but not a stranger
    - after a restart, every role is told "Room not found"
  - `Play.test.tsx` +3 (one test replaced): a refresh into an ended room, a rejoin after a restart, `room:closed`, and a new player whose room vanished.
  - `Host.test.tsx` +3: ended on "Room not found", `room:closed`, and a silent rejoin with the stored token. The "other join errors" test now uses "Already joined".
  - `Screen.test.tsx` +5: ended with a stored token, after a snapshot, and on `room:closed`; greyed chips and scoreboard rows.
  - `HostControls.test.tsx` +1: the greyed name line.
  - 917 tests in total. No new dependency.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F32 cover:
- `closeRooms`, `anyRoom` and the 'expired' reason
- when "Room not found" reads as "This game has ended", and when it stays "Room not found"
- clearing the Player identity but keeping the hostToken
- leaving the backgrounded-phone case to Socket.IO's reconnection, with no indicator
- the shared error constants

**Notes for next session:**
- Playtest (Playwright; room TFMM; Screen, Host remote from the stored token, Pia and 2 bots):
  - Refreshing the Screen, the Host and Pia mid-game each came back on the same question and score.
  - Closing Pia's tab greyed her row on the Host as "offline". Reopening `/play/TFMM` rejoined her with 100.
  - Killing and restarting the server showed "This game has ended" with Back to start on all three devices within 8 s.
- The playtest flagged `/play/ZZZZ` and `/screen/ZZZZ`, which show "Room not found". That is intended (see DECISIONS). `/host/ZZZZ` with no token shows "Not authorised", as before.
- Not checked live: expiry by the 3-hour timeout. `closeRooms` is covered by the server test, and `room:closed` by each page's test.
- While the server is down, every device shows its last snapshot with no hint. A "Reconnecting…" indicator is in Backlog.
- The playtest saw "Another connection wants to delete database 'buzzr'". Its source was not traced. It is probably the playtest's own IndexedDB reset across shared-context tabs.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and tap **Host this set**. Use the laptop as the Screen. Pair a phone as Host, and join from another phone.
2. Start the game, buzz, and judge. Then refresh the Screen, the Host phone and the Player phone. Each returns to the same question and score with no prompt.
3. Lock the player's phone. The Screen and the Host show them greyed or "offline". Unlock it: they come back.
4. Stop the server (Ctrl-C) and start `npm run dev` again. All three devices show "This game has ended" with **Back to start**.

## F31 — Sounds and animations (2026-10-28)
**What changed:**
- Sounds:
  - Five self-made WAVs in `client/public/sounds/`: buzz, correct, wrong, join and fanfare.
  - They come from the new `scripts/make-sounds.mjs`, which synthesises them from plain waveforms. Run `node scripts/make-sounds.mjs` to remake them.
  - `client/public/sounds/README.md` lists each file, what plays it and its source.
  - `eslint.config.js` now gives `scripts/**` Node globals.
- `client/src/lib/sounds.ts`:
  - Howler loads through a dynamic import, as its own 36 KB chunk. `preloadSounds` warms it when the Screen mounts.
  - `startSounds` creates the Howls and resumes a suspended AudioContext.
  - `playSound` is silent before start and logs `[sound] <name>` in DEV.
  - `soundForFx` maps each fx kind to a sound.
- Screen:
  - **Click to start** (`components/StartOverlay.tsx`) covers every page load except an error page.
  - The click enters fullscreen (new `lib/fullscreen.ts`, now shared with the F key) and starts the sounds.
  - Keys pressed on the overlay never reach the host shortcuts.
  - After the click, `useScreenSounds` plays each new fx sound, and the fanfare on the change into FINAL.
- Reduced motion: the Player's open-buzzer pulse is now `motion-safe:`. F24 already handled the chip pop-in, the +points float, the flash and the scoreboard FLIP.
- Tests:
  - New `sounds.test.ts` (6, with Howler mocked): the fx-to-sound map, a file for every sound, silence before start, load once and resume, play only the named sound plus the log line, and a Howler failure.
  - `Screen.test.tsx` gains 9:
    - the overlay's click, focus and fullscreen
    - keys swallowed behind it
    - no overlay over an error
    - each fx sound
    - silence before the click and no replay
    - an fx arriving with the first state
    - the fanfare once
    - no fanfare on a load into FINAL, before or after the click
  - `renderScreen` now presses Click to start by default (`{ start: false }` opts out).
  - The `Play.test.tsx` pulse assertion now checks the `motion-safe:` guard.
  - 899 tests in total.
- New dependencies:
  - `howler`: the spec names Howler.js for sound.
  - `@types/howler` (dev): its types.

**Decisions:** the five DECISIONS rows dated 2026-10-28 for F31 cover:
- the self-made WAVs and the script that makes them
- wrong.wav as the "buzz sound" for Wrong
- Screen-only, lazy Howler, the fanfare trigger and the DEV log
- the overlay: on every load, fullscreen first, keys swallowed, no replay
- the reduced-motion scope

**Notes for next session:**
- Playtest (Playwright; a Screen with the token, a Host remote, Ann and 2 bots), all passed:
  - All five `/sounds/*.wav` returned 200.
  - The Screen logged `[sound]` join ×3, buzz, correct, buzz, wrong, then fanfare after End game.
  - Click to start closed and set `document.fullscreenElement`.
  - A lobby chip had `animation-name: pop-in`. With `reducedMotion: reduce` emulated, it had `none`.
- Not checked live: the +points float and the scoreboard FLIP under reduced motion. Their guards are in place and are unit-tested from F24.
- Nobody listened to the sounds. The playtest checked that the right ones fired. Their levels were balanced by measurement (ffmpeg `volumedetect`), not by ear. Remake them with the script if one sounds wrong on a TV.
- The playtest saw a dev-only warning on first load: "WebSocket is closed before the connection is established" (StrictMode remount). Only the favicon 404 showed as an error (pre-existing).
- The F29 and F30 entries sat above the `<!-- entries below, newest first -->` marker, so `roadmap.mjs next` showed F28 as the newest. The marker now sits right under the template. Add new entries directly below it.

**How to try it:** `npm run dev`.
1. On the laptop, open `http://localhost:5173/sets` and tap **Host this set** on the sample. Use the laptop as the Screen.
2. The Screen shows **Click to start**. Click it: the window goes fullscreen.
3. Join from phones at `http://<LAN-IP>:5173`. Each new chip pops in with a blip.
4. Run a question: a buzz rings in, C plays the correct arpeggio, and X plays the wrong buzzer. End the game: the fanfare plays.
5. Turn on reduced motion in the OS: chips and the phone's BUZZ! button stop animating.

## F30 — Image upload, serving and preload (2026-10-28)
**What changed:**
- Server:
  - New `server/imageStore.ts` keeps images in memory per room and image id. It holds up to 50 MB per room and 500 MB in total (`GLOBAL_IMAGES_MAX_BYTES`, DECISIONS #12, now enforced).
  - The sweeper's new `onExpired` callback frees a deleted room's images (wired in `index.ts`).
  - `POST /api/rooms/:code/images/:imageId`, in this order:
    - The room, the Bearer hostToken, an `imageId` the room's set uses, and the content type are all checked before the body is read.
    - `express.raw` then reads the body, up to 1.5 MB.
    - Errors: 404, 401, 404, 415, 400 (empty), 413 (image too big or room over 50 MB), 507 (global cap).
  - `GET` serves an image with its type, `Cache-Control: public, max-age=31536000, immutable` and `nosniff`.
- Client:
  - `hostSet` loads each referenced blob once and refuses a missing image or a total over 50 MB before it creates the room. Then it uploads each image with `uploadImage` (`api.ts`).
  - `ScreenView.nextImageId` is new. `usePreloadImage` preloads the next image on the Screen and, from `nextQuestion`, on the Host.
  - The Host's question card shows the image thumbnail (this resolves the F10 TODO).
  - `IMAGE_TYPES` moved to `shared/constants.ts`.
- Sample set: question 4 has a hexagon picture, and question 7 is image-only (the flag of Japan, which replaces the diamond question). The PNGs are made with ImageMagick and embedded in `client/src/lib/sampleImages.ts`. They are seeded in Dexie's `populate` hook.
- Tests:
  - New `http.images.test.ts` (10): auth, 404s, 415, exactly 1.5 MB vs 1 byte more, empty body, 50 MB then the 51st MB, 507, and GET headers, bytes and 404s.
  - New `imageStore.test.ts` (5) and `usePreloadImage.test.ts` (2).
  - Existing files gained tests: `hostRoom.test.ts` 5, `api.test.ts` 2, `Host.test.tsx` 2, `Screen.test.tsx` 1, `views.test.ts` 1, `roomStore.test.ts` 1 (sweep frees images) and `db.test.ts` 1 (seeded PNGs).
  - New helper `client/src/test/nodeBlob.ts` (from SetEditor.test). It lets jsdom tests store blobs in fake-indexeddb.
  - 884 tests in total. No new dependency.

**Decisions:** the six DECISIONS rows dated 2026-10-28 for F30 cover:
- the image store and cleanup
- the upload checks, their order and status codes
- the GET cache header
- `hostSet`'s pre-checks and what happens to the room after a failed upload
- preload, `nextImageId` and the Host thumbnail
- the sample pictures, and why an already-seeded browser keeps the old sample

**Notes for next session:**
- Playtest (Playwright; Screen at 1920×1080; Host and one Player at 390×844), all passed:
  - Create room sent `POST /api/rooms`, then both sample image uploads with `Bearer <hostToken>`, each 201.
  - No token or a bad token gets 401. On :3000, 1.6 MB gets 413 and 1.4 MB gets 201.
  - GET returned `public, max-age=31536000, immutable` and `image/png`.
  - At question 3, Screen and Host had already fetched `sample-img-hexagon`. Moving to question 4 made no new image request, and the image was already loaded.
  - Question 7 shows only the flag (1728×568) with no text, and "Japan" appears nowhere on the Screen. The Player shows no image.
  - Only the favicon 404 showed in the console (pre-existing).
- Not checked live: the 50 MB room cap, because the sample room has 2 image ids. `http.images.test.ts` covers it.
- An oversized upload through the Vite dev proxy (:5173) shows as 502 with `write EPIPE` in the dev log. The server answers 413 before it has read the whole body, and the proxy is still writing. The server on :3000 returns the right 413. The editor never stores an image over 1.5 MB, so the app itself doesn't hit this.
- A browser that seeded the sample before F30 keeps the text-only sample. Delete the `buzzr` IndexedDB in DevTools (Application › IndexedDB) to reseed it.

**How to try it:** `npm run dev`.
1. If this browser already had Buzzr, delete the `buzzr` IndexedDB first.
2. On the laptop, open `http://localhost:5173/sets` and tap **Host this set** on the sample. Open the Screen at 1920×1080. Pair a phone as Host and join from another phone.
3. Play to question 4: the hexagon appears at once beside the text. On the Host phone, the card shows the thumbnail.
4. Question 7 is the flag alone, filling the Screen.

## F29 — Image pipeline in the editor (2026-10-28)
**What changed:**
- `client/src/lib/imagePipeline.ts`:
  - `fitWithin` holds the size maths: longest side 1600 px, aspect kept, never enlarged, at least 1 px.
  - `shrinkImage(file, codec)` refuses types other than PNG, JPEG, WebP and GIF, and then decodes the file. It draws the image at the fitted size and writes WebP at 0.8, or JPEG over white when the browser cannot write WebP. A result over 1.5 MB is refused, and the decoded frame is freed afterwards.
  - The browser codec uses `createImageBitmap` (which gives a GIF's first frame) and a canvas. It is injected so tests run without a canvas.
- Set editor: each card has an **Image (optional)** block under the question text.
  - Empty: an **Add image** picker. Full: a thumbnail with **Remove**.
  - A file dropped on the card, or an image pasted while focus is in it, becomes the card's image and replaces any image already there.
  - "Shrinking image…" shows while it works, and a refusal shows its reason.
  - An image no question uses any more is deleted after the next save without it. A shared image (from Duplicate) is kept while either question uses it.
- Other changes:
  - `db.ts` gains `addImage` and `deleteImages`.
  - `lib/setEditor.ts` gains the pure `setQuestionImage` and `unusedImageIds`.
  - `useStoredImageUrl` moved out of `QuestionPreview` into `lib/useStoredImageUrl.ts`, and the thumbnail uses it too.
- Tests:
  - New `imagePipeline.test.ts` (11): the size maths, WebP at 0.8, the JPEG fallback, the four types, refused types, the 1.5 MB limit and its edge, undecodable files, and the frame being freed.
  - New `useStoredImageUrl.test.tsx` (2).
  - `setEditor.test.ts` gains 3. `db.test.ts` gains 1.
  - `SetEditor.test.tsx` gains 7: pick, drop, paste (and text paste left alone), refusal, image-only question, Remove after save, and delete with a shared duplicate.
  - 854 tests in total. No new dependency.

**Decisions:** the three DECISIONS rows dated 2026-10-28 for F29 cover:
- the pipeline: always redraw, JPEG over white, and checking only the result against 1.5 MB
- the editor block: card-wide drop and paste, replacing an image, and a text paste winning
- when an unused blob is deleted

**Notes for next session:**
- Playtest (Playwright, `/sets/:id` only), all passed:
  - A pasted 3200×2000 noise PNG (22.0 MB) showed a 1600×1000 thumbnail. It was stored as one `image/webp` blob of 782,226 bytes.
  - Remove cleared the thumbnail and its button.
  - A dropped GIF was accepted as a still.
  - A text file was refused ("Use a PNG, JPEG, WebP or GIF image.").
  - A 1600×1600 noise PNG was refused with the 1.5 MB message, and nothing was stored.
  - An image-only question survived a reload, and Preview showed its image.
- Not checked: the file-picker button in a real browser, an animated GIF, and the JPEG fallback in Safari. The last two rely on `createImageBitmap` and `toBlob`.
- `SetEditor.test.tsx`: fake-indexeddb clones with Node's `structuredClone`, which drops a jsdom Blob. The test's mocked `shrinkImage` therefore returns a Node Blob (`process.getBuiltinModule('node:buffer')`).
- F30: hosting must upload each `imageId` blob. The stored blobs are already at most 1.5 MB, in WebP or JPEG.

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets` and open a set.
1. Tap Add image on a card and choose a photo. A thumbnail appears.
2. Copy an image (in a browser, use "Copy image"). Click in a card and paste.
3. Drag an image file onto another card.
4. Clear a card's question text. With an image, the card shows no error. Tap Preview to see it as the Screen would.
5. Tap Remove. The upload area returns.
## F28 — Import and export JSON (2026-10-28)
**What changed:**
- `client/src/lib/importExport.ts`:
  - `exportSetFile` builds one JSON file: the set's fields plus `images`, each referenced image once as a base64 data URL. It refuses a draft (`checkPlayable`'s reason), a missing image, or an image type import would refuse.
  - `parseSetFile` never throws. It reports invalid JSON, then validates with zod (`setFileSchema`), then checks each `imageId` is in the file. Errors read "<path>: <message>" ("Question 3 › answer: …"), capped at 10 plus "…and N more."
  - Also `exportFileName` (title slug), `blobToDataUrl`, `dataUrlToBlob` and `IMPORT_FILE_MAX_BYTES` (201 MB).
- `db.ts`: `importSet` stores the parsed set and its blobs in one transaction under fresh set and image ids, stamped now.
- `/sets`:
  - **Import JSON** sits beside New set and opens a hidden file input. Success shows "Imported “<title>”." and the new card. A bad file shows "Couldn't import <file>:" and a list of errors. A file over the size cap is refused before it is read.
  - Each card gains **Export JSON**, which downloads `<slug>.json` through an object URL.
- Tests: new `importExport.test.ts` (12). It covers the round trip with PNG and GIF bytes (every byte value) and the shared image id, plus the malformed files: not JSON, not an object, schema errors with paths, and missing, unsupported and oversized images. It also covers the error cap, the draft and type refusals, and the file name. `Sets.test.tsx` gains 5: export download, draft export, import success, the import error list and the size cap. 830 tests in total. No new dependency.

**Decisions:** the four DECISIONS rows dated 2026-10-28 for F28 cover:
- the file format
- export refusing drafts
- the import checks, the error format and the size cap
- fresh ids on import

**Notes for next session:**
- Playtest (Playwright, `/sets` only). Pass: export of a 3-question set, re-importing that file, and the errors for invalid JSON (`{not json`), `{"title":5}` and a file with one empty question.
- Not checked in a browser: a set with images, because the editor cannot add one before F29. `importExport.test.ts` covers the image round trip.
- F29: the stored blob must keep a PNG, JPEG, WebP or GIF `type`, or Export JSON refuses it.
- F30: an imported set's images are ordinary stored blobs, so uploading them at hosting needs nothing special.

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets`.
1. Tap Export JSON on the sample. `sample-general-knowledge.json` downloads.
2. Tap Import JSON and choose that file. A second "Sample: General Knowledge" card appears.
3. Edit the file so `"title": ""`, then import it again. The page lists "Title: Too small: …".

## F27 — Reorder, preview and print sheet (2026-10-28)
**What changed:**
- Drag reorder in the set editor. Each card has a ⠿ handle (`useSortable`) that drags by pointer or by keyboard: Space or Enter, then ↑/↓, then Space or Enter (Escape cancels). Screen-reader announcements name the question positions. A drop goes through the new pure `reorderQuestions` and the same autosave path as ↑/↓, which stay.
- **Preview** on each card opens `components/QuestionPreview.tsx`, a full-window dialog.
  - It renders the Screen's own `ScreenQuestion` from `previewView(set, index)`: QUESTION phase, buzzers locked, with no answer or notes in the view.
  - It has Previous/Next, ←/→, Escape and Close.
  - Focus moves in and is restored on close. The editor behind is `inert` and stops scrolling.
  - `ScreenQuestion` gains an optional `imageSrc`, and `db.getImage` feeds it a stored blob.
- **Print answer sheet** (link at the top of the editor) opens `/sets/:setId/print` (`pages/AnswerSheet.tsx`, a lazy chunk).
  - A black-on-white table of #, Question, Answer and Notes.
  - The Print button calls `window.print()`. Controls are `print:hidden`, rows avoid page breaks, and `body` prints white.
  - The tab title names the printout.
- Tests:
  - `setEditor.test.ts` gains 3 (reorder, the preview view, a leak check).
  - `SetEditor.test.tsx` gains 5: the handle's role and instructions, a keyboard drag with mocked rects that saves `b,a,c`, the preview's content, its keys and focus, and the print link. The save indicator is now queried by the name "Save status".
  - New `AnswerSheet.test.tsx` (5). `App.test.tsx` gains the print route.
  - 813 tests in total.
- New dependencies: `@dnd-kit/core` and `@dnd-kit/sortable`. The spec names `@dnd-kit` for the drag handle. They load only in the editor chunk.

**Decisions:** the DECISIONS rows dated 2026-10-28 for F27 cover:
- the dnd-kit setup: handle only, the keyboard sensor, and the "Save status" name
- Preview as a full-window dialog built on `ScreenQuestion`
- the print page, its route and styling, and points left off

**Notes for next session:**
- Playtest (Playwright, one 1280×900 tab, a 3-question set), all passed:
  - A mouse drag of Q3's handle above Q1 reordered the list.
  - Keyboard Space, ↓, Space moved Q1 down one place. The order survived a reload.
  - Preview showed "Question 1 of 3", the text and "Buzzers locked", and not the answer. The screenshot matches the Screen's layout.
  - Under print media, the print page showed no links or buttons, a white background and black text, with rows in the new order.
- Not checked: a touch drag on a real phone (the handle has `touch-none`), and page breaks on a long set.
- Two quick clicks on Add question gave one card in the playtest. The first card pushes the button down, so the second click lands on the new card. This is layout, not a lost click.
- F29: the image picker goes in `QuestionCard`. Preview already shows a stored blob through `getImage` and `imageSrc`. The print sheet marks image-only questions "(picture question)".

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets` and open a set.
1. Drag a card by its ⠿ handle. Or focus the handle and press Space, ↓, Space. Reload: the order stays.
2. Tap Preview on a card. Step with ←/→ and close with Escape.
3. Tap Print answer sheet, then Print. The browser's print preview shows only the table.

## F26 — Set editor (2026-10-28)
**What changed:**
- `/sets/:setId` is now the editor (`pages/SetEditor.tsx`, a lazy route chunk, keyed by `setId`). It replaces the placeholder.
  - Title field, then a card per question: Question, Answer, Host notes (optional) and Points.
  - Text fields have `maxLength` and an `n/max` counter. Inline errors show after a field is left: title, answer and question text required, the length limits, and the points range.
  - Per card: ↑/↓, Duplicate (copy below) and Delete (tap twice). **Add question** appends and focuses a new card; at 100 questions Add and Duplicate are disabled with a message.
  - Status line: Saving… / Saved / Couldn't save.
- `lib/autosave.ts`: `Autosaver` (500 ms debounce, no overlapping writes, a failed value kept for retry) and `useAutosave`, which also flushes on unmount and `pagehide`.
- `lib/setEditor.ts`: pure edits (`addQuestion`, `moveQuestion`, `duplicateQuestion`, `removeQuestion`) and checks (`questionErrors`, `titleError`, `parsePoints`).
- `lib/db.ts`: `saveSet` writes the set and stamps `updatedAt`.
- `Placeholder` now serves only unknown routes, without route params.
- Tests: new `autosave.test.ts` (7, fake timers), `setEditor.test.ts` (12) and `SetEditor.test.tsx` (13). `db.test.ts` gains 1 (`saveSet`). `App.test.tsx` checks `/sets/:setId` without IndexedDB. 799 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-28 for F26 cover:
- autosave: whole-set writes, flushing on leave, and failure and retry
- errors shown after blur, `maxLength`, and empty notes removed
- points: only a valid number is saved
- the question actions, the cap, a missing set, and what F27 and F29 own

**Notes for next session:**
- Playtest (Playwright, one 390×844 tab), all passed:
  - New set opens the editor with "Saved".
  - The fields, counters and the blank-question error work.
  - "Saving…" turns to "Saved" within 750 ms.
  - Move up, Duplicate, and Delete (with Cancel and Confirm) work.
  - After a reload, the title, both questions, answer, notes and points were all still there.
  - At 100 questions, Add question is disabled and the cap message shows.
- Only the favicon 404 showed in the console (pre-existing).
- `SetEditor.test.tsx` uses `vi.useFakeTimers({ shouldAdvanceTime: true })`, because Dexie and fake-indexeddb also schedule with `setTimeout`. Tests that jump past the debounce use `advanceTimersByTimeAsync`.
- F27: add the `@dnd-kit` handle beside the ↑/↓ buttons in `QuestionCard`, and feed `moveQuestion` (or an `arrayMove`) through the same `changeQuestions`. Preview and Print can read the editor's `set` state.
- F29: the image goes in `QuestionCard`. `questionErrors` already accepts an image-only question. Deleting a question should also delete its blob.

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets` and tap New set (or Open on the sample). Edit the title and questions, watch the status go from Saving… to Saved, then reload the page: the edits stay. Use ↑/↓, Duplicate and Delete on the cards.

## F25 — Saved sets and the set list (2026-10-28)
**What changed:**
- `client/src/lib/db.ts`: a Dexie database `buzzr` with `sets` and `images` (blob) tables.
  - The sample set is seeded once, on first visit, in `populate`.
  - Helpers: `listSets` (last edited first), `getSet`, `createSet`, `duplicateSet` (copies image blobs under new ids), `deleteSet` (removes the set's images) and `copyTitle`.
- `/sets` (`pages/Sets.tsx`, a lazy route chunk):
  - Cards show title, "N questions" and "Last edited <date>".
  - Card actions: Open (to `/sets/:id`, still a placeholder until F26), Duplicate, Delete (tap twice) and Host this set.
  - **New set** saves an "Untitled set" draft and opens it. The page also has an empty state and a load-error state.
- **Host a game** on `/` opens a set picker (newest preselected), then **Create room**. Both paths use `hostSet` in `lib/hostRoom.ts`. Its `checkPlayable` refuses a draft with a readable reason before any request.
  - The "Room created" panel moved to `components/RoomCreated.tsx`, shared by `/` and `/sets`.
  - Label helpers are in `lib/setLabels.ts`.
- Tests:
  - New: `db.test.ts` (10, `fake-indexeddb`), `Sets.test.tsx` (11), `hostRoom.test.ts` (6).
  - `Landing.test.tsx` now covers the picker: list order, pick, the no-sets state, draft refusal and Cancel.
  - `App.test.tsx` checks `/sets` without IndexedDB.
  - 767 tests in total.
- New dependencies:
  - `dexie`: the spec's stack table names it for sets and image blobs.
  - `fake-indexeddb` (dev): the roadmap names it for `db.test.ts`.

**Decisions:** the DECISIONS rows dated 2026-10-28 for F25 cover:
- the DB layout and seed-once
- Duplicate, Delete and New set
- the picker, `hostSet` and draft refusal (this supersedes the F08 sample-set row)
- the image-upload gap (F30), with Import and Export left to F28
- the code split that keeps Dexie off the players' bundle

**Notes for next session:**
- Playtest (Playwright, one 390×844 tab), all passed:
  - First visit seeds the sample.
  - Duplicate adds "(copy)", and Host this set on the copy gives "Room created" with a code.
  - The Host a game picker lists both sets.
  - Delete confirms, then removes the set. With every set gone the page shows the empty state, and it stays empty after a reload (no re-seed).
- Only the favicon 404 showed in the console (pre-existing).
- F26 replaces the `/sets/:setId` placeholder. Read and write through `db.ts`, and bump `updatedAt` on save so the list order follows edits. Drafts may stay unplayable: `checkPlayable` guards hosting.
- F30 must upload images in `hostSet` (see the `SPEC-QUESTION` there). The DB layout is fixed; any change needs a Dexie `version(2)`.
- Dexie is in its own chunk (`db-*.js`, 100 kB). Keep `lib/db.ts` out of static imports on Play and Screen paths.

**How to try it:** `npm run dev`. On the laptop, open `http://localhost:5173/sets`. Duplicate the sample, then tap Host this set and choose Use this device as the Screen. Or, on `/`, tap Host a game, pick a set and tap Create room. To see the empty state, delete every set.

## F24 — Screen and player result states (2026-10-28)
**What changed:**
- Screen judged states:
  - `fx` events now reach the room store (`fx: {fx, seq}`), and `useRecentFx` holds each one for 1.5 s.
  - `ScreenFlash` flashes the Screen green or red.
  - At REVEAL, `ScreenQuestion` shows the answer under the question and "<name> ✓", and "+100" floats up beside the name.
  - While a wrong winner waits for the reopen, their banner is grey and struck through. A grey "locked out" row then stays for the rest of the question.
- `ScreenResults.tsx`:
  - The `Scoreboard` overlay opens in the order it last showed, then slides into the current ranking after 800 ms. The slide is a FLIP animation from `lib/useFlip.ts` and is skipped under `prefers-reduced-motion`.
  - `FinalResults` shows a podium (ties share a step) and the full ranking beside it.
  - `lib/results.ts` holds `ordinal`, `signedPoints`, `podiumSteps` and `replayOrder`.
- Server: `ScreenView` and `HostView` gain `scorerId`, the player judged correct on the current question (`server/views.ts`).
- Player: `buzzerState` adds three states:
  - `out`: ✕, "Locked out this round".
  - `revealed`: the answer, plus "+100" or "−100".
  - `final`: "2nd of 5" and the score, in place of the button.
  - The `kicked` event and a refused rejoin both show "Removed by host".
- Tests: new `results.test.ts` (11) and `useFlip.test.tsx` (4). `buzzerState.test.ts` gains 7, `Screen.test.tsx` 20 (judged, reveal, scoreboard, final, ties) and `Play.test.tsx` 5. `views.test.ts` gains 5 for `scorerId`. 736 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-28 for F24 cover:
- `scorerId`, and what the flash, float and greyed chip show
- the answer shown only when the view carries it
- the scoreboard replay order
- no overlay over FINAL
- the podium for ties
- the 8 vh reserved for the host bar
- the Player result states, the penalty display and the kick page

**Notes for next session:**
- Playtest (Playwright; Screen with the token at 1920×1080).
  - Run 1, with bots: wrong answer (red flash, greyed banner), correct answer (green flash, "+100", answer, "Bot 2 ✓"), scoreboard (S) with tied ranks, a player locked out, a player's reveal "+100", and FINAL via End game. The podium showed ties at 1st and at 3rd, and the phone showed "1st of 4 / 100 points".
  - Run 2, with 2 players and a paired Host remote: all 10 questions to FINAL with N/R, with the podium and the full ranking above the bar. Kick from the Players tab showed "Removed by host" on the kicked phone.
  - Fixed after the playtests: content under the host bar, "+100" over the answer, and the scoreboard covering FINAL.
  - The scoreboard's reorder animation was checked only in unit tests (DOM order with fake timers, FLIP transforms with mocked rects), not by eye.
- F31 (sounds and animations) can hang sounds off `useRoomStore((s) => s.fx)`. The flash, float, FLIP and reduced-motion handling are already in place, so F31 needs the Howler sounds and the Click to start overlay.
- The penalty "−100" sits in red under the answer on the phone. The Screen shows no float for a penalty.

**How to try it:** `npm run dev`.
1. On the laptop, Host a game, then Use this device as the Screen.
2. Join 2–3 players from phones at `http://<LAN-IP>:5173`, or open `/dev/bots`.
3. Run a question with Space, then judge with X (wrong) and C (correct).
4. Press S for the scoreboard, then play on to FINAL (or End game).
5. Kick a player from a paired host phone's Players tab.

## F23 — Screen host controls and shortcuts (2026-10-27)
**What changed:**
- A Screen whose `screen:join` with the hostToken was acked gets `ScreenHostControls` (`client/src/components/ScreenHostControls.tsx`).
  - A bar along the bottom edge with Primary (or Correct / Wrong / "Reopening buzzers…"), Skip, Previous, Undo, Scoreboard, End game (click twice), Fullscreen, Shortcuts and Hide controls. Each button shows its key.
  - The bar hides 3 s after the last pointer move and stays up while hovered. H collapses it; while collapsed, mouse movement shows a small "Show controls" button.
  - The keys Space, C, X, R, N/→, ←, S, U, F, H and `?` work, and the `?` help overlay closes with Esc.
- `client/src/lib/hostControls.ts` holds `primaryFor`, `UNREVEALED`, `inGame`, the `SHORTCUTS` table and the pure `shortcutFor(key, view)`. The remote's `PrimaryAction` and `SecondaryActions` now import the same rules.
- `canJudge` and `canUndo` moved into the shared view fields, so `ScreenView` has them. `useHostCommand` accepts either view, and `useSendHost` moved out of `Host.tsx` into `client/src/lib/useHostCommand.ts`.
- Tests: new `client/src/lib/hostControls.test.ts` (23). `Screen.test.tsx` gains 26 host-control tests: token gating, auto-hide with fake timers, hover, H, help, every key, modifier keys, the lock, the toast, End game, fullscreen, and an answer search with the bar and help open. `views.test.ts` now checks both flags on host and Screen views. 685 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F23 cover the flags on `ScreenView`, gating on an acked token, keys following the button rules (Space does nothing in BUZZED; N/→ from REVEAL only), the hover and collapse behaviour, End game without a key, and the shared lock.

**Notes for next session:**
- Playtest (Playwright; Screen with the token at 1920×1080, 1 Player): the bar shows, auto-hides at 3 s and returns on mouse move. Space, C, X, U, R, →, ←, N, H, F and `?`/Esc all acted. The answers never appeared in the Screen's text after any key. A full game to FINAL was not finished on screen, because S and R change state the Screen does not draw yet (the scoreboard overlay and the answer at REVEAL are F24). After ←, N does nothing until reveal, by design.
- F24 should check that its reveal answer and scoreboard overlay sit above the bar's `absolute bottom-0` position, or move the bar.
- A dropped socket leaves the bar up; a press then toasts "Not connected".

**How to try it:** `npm run dev`. On the laptop, Host a game, then Use this device as the Screen. Join a player at `http://<LAN-IP>:5173` from a phone or second tab. On the Screen, press `?` for the keys, then run the game with Space, C/X, R, N, ←, U and S. Leave the mouse still for 3 s to see the bar hide; press H to toggle it.

## F22 — Host remote: judging, secondary actions, tabs (2026-10-27)
**What changed:**
- `HostView` gains `canJudge` and `canUndo`. Both come from predicates exported by `server/reducer.ts`, which `hostJudge` and `hostUndo` also use. `views.test.ts` checks the flags against `reduce()` in 11 room states.
- The host remote has three tabs: Game, Players (n) and Settings (`client/src/pages/Host.tsx`).
  - Game: the question card, then `PrimaryAction`. In BUZZED it shows Correct / Wrong side by side, or a disabled "Reopening buzzers…" during the 1.5 s wait. Below it, `SecondaryActions`: Skip question (`host:reveal`), Undo last judgement (enabled by `canUndo`), Previous question, Show/Hide scoreboard, and End game (tap twice to confirm).
  - Players (`HostPlayers.tsx`): score, "online · N ms" or "offline", −/+ the current question's points (`host:adjustScore`), and Kick (tap twice to confirm).
  - Settings (`HostSettings.tsx`): penalty and auto-open switches, and a stepper for scoreboard every N (0 = Never, up to `SCOREBOARD_EVERY_MAX`). Each sends only its own key.
- `client/src/lib/useHostCommand.ts` holds one lock for the whole remote. A press disables every button until the next snapshot or a rejection; a rejection shows the toast. `ConfirmButton.tsx` is the tap-twice button.
- Tests: new `client/src/components/HostControls.test.tsx` (29). `Host.test.tsx` covers tabs, Correct / Wrong, the shared lock and the reopen wait. `views.test.ts` gains 12. 636 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F22 cover the two view flags, Skip = `host:reveal`, which actions show in which phase, tap-twice confirmation for Kick and End game, the ± step and when it hides, the shared lock, and the RTT display.

**Notes for next session:**
- Playtest (Playwright; 1 Screen, Host and 3 Players): a 3-question game run from the remote alone. It covered a wrong answer with the penalty off and on, then a correct answer, an undo back to BUZZED, ±100, a kick (3 players to 2), all three settings (kept across a host reload; auto-open worked on Q2 and Q3), Previous, and End game. The answer never appeared on the Screen or the phones. The playtest found raw float RTT values; they are now rounded.
- Left for F24: the Screen does not render the scoreboard overlay yet. The Show scoreboard toggle and `scoreboardEvery` only flip `showScoreboard`. The Player FINAL and "Removed by host" states are also F24. The host FINAL view is still in Backlog.
- Backlog additions: a stable host Players order, arrow keys for the tabs, and a typed replacement for the `emit` cast in `Host.tsx`.

**How to try it:** `npm run dev`. On the laptop, Host a game, then Use this device as the Screen. Scan Pair host phone with a phone (or open the `/host/<code>#t=…` link). Join 2–3 players at `http://<LAN-IP>:5173`, then run the game from the phone using the Game, Players and Settings tabs.

## F21 — Gateway: remaining host events (2026-10-27)
**What changed:**
- `server/sockets.ts` wires `host:judge`, `host:undo`, `host:adjustScore`, `host:settings` and `host:kick`. They go through `asHost`, so they need `canHost`: a host socket, or a Screen holding the token. They also get the zod parse and guarded ack from `handle`. Every host event in the spec is now wired.
- `host:kick` works like this after the reducer accepts it:
  - The gateway emits `kicked {}` to every socket in `room:<code>:player:<id>`.
  - Then it calls `disconnectSockets()` without closing the transport. The client sees `io server disconnect` and does not reconnect.
  - The kicked player gets no final `state` and no `fx`. A rejoin with the same id fails with `PLAYER_KICKED_ERROR` (F05).
- `fx correct` and `fx wrong` come from the reducer's effects (F19) through the existing `runEffects`. `fx join` was already emitted and tested (`sockets.test.ts`).
- Tests: new `server/sockets.host.test.ts` (12):
  - Rejection from a player and from a plain Screen.
  - A Screen holding the token can judge, adjust and kick, and still gets only ScreenView.
  - An invalid payload and an unknown settings key are rejected.
  - `fx correct` reaches all 4 sockets.
  - Judge wrong, then reopen at exactly 1.5 s with fake timers. The locked-out player's buzz is ignored.
  - Undo cancels the pending reopen.
  - Adjust and settings.
  - The kick flow: `kicked`, disconnect, no state, and the rejoin refused. Also two sockets for one player, an unknown player, and kicking the unjudged winner, which reopens the buzzers.
  - 589 tests in total. No new dependency.

**Decisions:** the DECISIONS row dated 2026-10-27 for F21 covers the order of `kicked` and the disconnect, and why the transport stays open until the disconnect packet.

**Notes for next session:**
- F22 (host remote) can now send every host event. As noted in F20, no view says whether undo is available yet. Add `HostView.canUndo` server-side rather than deriving it in the client.
- The Player client must handle `kicked` by showing "Removed by host" and must not retry the join. The socket closes right after.
- `sockets.test.ts`, `sockets.buzz.test.ts` and `sockets.host.test.ts` each have a copy of the start/connect harness (see Backlog).

**How to try it:** `npx vitest run server/sockets.host.test.ts`. There are no Host remote buttons until F22.

## F20 — Reducer: undo, score adjust, kick, settings, final ranking (2026-10-27)
**What changed:**
- `server/reducer.ts` gains four host actions. The zod schemas existed since F02.
  - `host:undo` works in OPEN, COLLECTING, BUZZED or REVEAL. It reverses the last judgement of the current question: the score delta, the lockout and the judgement record. It returns to BUZZED with the buzzes and winner as judged, and newer buzzes are discarded. There is one level per question; otherwise it fails with "Nothing to undo".
  - `host:adjustScore {playerId, delta}` works in any phase.
  - `host:kick {playerId}` works in any phase. It removes the player, adds the id to `kickedIds`, and drops their buzzes, lockout and undo point. An unjudged winner's buzz is discarded and the buzzers reopen, or the room goes to REVEAL if nobody else is eligible. A kick that empties the COLLECTING window also reopens.
  - `host:settings` works in any phase and merges the keys that are set.
- `Room.undo: UndoPoint | null` (`shared/types.ts`). `host:judge` sets it; entering a question, FINAL via next, and the undo itself clear it.
- The `reopen` timer action now carries `at` and is ignored unless `at === room.reopenAt`. This fixes the F19 note: after undo and a second wrong judgement, the first timer no longer reopens early. `openingCounter` never moves backwards.
- `applyJudgement` takes `'adjust'`: score only, with no judgement and no lockout. It stays the only score writer, now used by judge, adjust and undo.
- Tests:
  - New `server/reducer.undo.test.ts` (19): exact restore after a correct answer, after a wrong answer during the wait, after wrong then reopen, and after the last wrong one. Also one level only, stale timers after undo, and the phase guard.
  - New `server/reducer.admin.test.ts` (42).
  - `server/ranking.test.ts` gains 4 tie cases.
  - The judge tests' `reopen` helper now carries `at`.
  - 577 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F20 cover the following:
- They resolve open questions 6 (an undo snapshot) and 10 (kicking the winner).
- They record the `at` match on `reopen` and the monotonic counter.
- They record the `'adjust'` score change, and that adjust, kick and settings work in every phase.
- They record that a settings change applies the next time the setting is read.

**Notes for next session:**
- F21 must wire `host:undo`, `host:adjustScore`, `host:kick` and `host:settings` in `server/sockets.ts`, as well as `host:judge`, with `canHost` and the zod schemas. On kick, the gateway emits `kicked` to the player's socket(s) and disconnects them. The reducer emits no effect for this; the gateway reads it from the action.
- No view shows whether undo is available yet. F22's Undo button needs it, for example `HostView.canUndo = room.undo !== null && phase in OPEN…REVEAL`, so the client does not derive the rule (DECISIONS F02).
- The ± buttons send the question's `points` as `delta`; the server accepts any integer within ±100000.

**How to try it:** `npx vitest run server/reducer.undo.test.ts server/reducer.admin.test.ts server/ranking.test.ts`. There is no socket path or UI until F21 and F22.

## F19 — Reducer: judging, lockout and reopen (2026-10-27)
**What changed:**
- `server/reducer.ts` handles `host:judge {result}`, accepted only in BUZZED:
  - Correct: the winner gets the question's points, the room moves to REVEAL, and the reducer emits `fx correct {playerId, points}`.
  - Wrong: the winner is locked out, loses the points if `wrongPenalty` is on, and the reducer emits `fx wrong`.
  - If anyone is still eligible, the room stays in BUZZED with `reopenAt = now + 1500` and schedules `reopen`. Otherwise it moves to REVEAL.
  - A second judge of the same buzz is rejected: "Not allowed in this phase" after a correct answer, "Already judged" while a reopen is pending.
- New timer action `reopen {questionIndex, openingCounter}` (part of `TimerAction`). It opens a new opening and keeps `lockedOut`. It is a no-op unless the room is in BUZZED with a reopen pending, on the same question and opening.
- New exported `applyJudgement(room, playerId, result, pointsDelta)` is the only score writer. `Room` gains `reopenAt: number | null`, which `host:reveal`, `host:next` and `host:prev` clear.
- Tests: `server/reducer.judge.test.ts` (34 tests). They cover phase rejection, double judging, correct, wrong with the penalty on and off, negative scores, last eligible → REVEAL, a disconnected winner, and the reopen with stale cases after reveal, next, prev and end. 512 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F19 resolve open questions 5 (the wait stays in BUZZED with `reopenAt`) and 9 (eligible means connected and not locked out, checked at judge time). They also record that a judged buzz keeps `winnerId` and `buzzes` into REVEAL, and the `applyJudgement` signature.

**Notes for next session:**
- `host:judge` is not wired in `server/sockets.ts` yet; that is F21. The gateway's `schedule` already runs `reopen` through the generic `TimerAction`, so F21 needs the handler (`canHost`, zod `host:judge`) and the `sockets.host.test.ts` reopen-after-1.5 s test.
- F20 undo: undoing a wrong answer during the wait must clear `reopenAt`. If the host then judges wrong again, the first `reopen` timer still matches index and counter and would reopen early. Guard it, for example by comparing `now >= room.reopenAt` or by putting `at` on the action.
- No view exposes `reopenAt` yet. During the wait, Screen and players still see BUZZED with the winner, and `lockedOut` includes them.

**How to try it:** `npx vitest run server/reducer.judge.test.ts`. There is no UI or socket path until F21 and F22.

## F18 — Screen question and buzz views (2026-10-27)
**What changed:**
- New `client/src/components/ScreenQuestion.tsx` renders the Screen from QUESTION to REVEAL:
  - "Question N of M", the question text, and the image (`object-contain`, beside the text or alone).
  - A status pill: "Buzzers locked" (grey) or "Buzzers OPEN" (red, pulsing, through COLLECTING too).
  - In BUZZED, the pill is replaced by the winner's name in a giant banner in their colour, with "also buzzed" names in their colours and gaps such as "+0.12 s".
- New `client/src/lib/screenQuestion.ts`: `formatGap`, `questionTextClass` (5 length steps in `min(vw, vh)`, one step down with an image) and `buzzersOpen`. `client/src/lib/api.ts` gains `imageUrl(code, imageId)`.
- `Screen.tsx`: FINAL shows "Game over" until F24. No Screen component renders an answer.
- Tests: 8 in `screenQuestion.test.ts`, 10 new in `Screen.test.tsx`. These include a DOM test that feeds an answer in QUESTION, OPEN, COLLECTING and BUZZED views and checks `innerHTML`. 478 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F18 cover:
- Length-step shrinking instead of measuring the box.
- In BUZZED, the banner replaces the status line and the question stays.
- REVEAL and FINAL placeholders until F24.
- The image URL ahead of F30.

**Notes for next session:**
- Playtest (2026-10-27, `PORT=3100 npm start`, because PokéTrack held :3000). All bullets passed at 1920×1080:
  - Q1 showed locked, then OPEN with the colour change.
  - On Q2, three players buzzed at once. The banner showed "Ann" in her colour, and below it "also buzzed Bob +0.00 s, Cy +0.00 s".
  - The answers ("Jupiter", "Oxygen") were absent from the Screen's `innerText` and `outerHTML` before reveal.
  - The players were 3 browser contexts, not `/dev/bots`, which the production build doesn't serve. The near-simultaneous clicks gave 0.00 s gaps. Non-zero gaps are covered by unit tests only.
- The sample set has no long question and no image, so shrinking and the image area were checked in unit tests only. F30 adds the sample images. Check the layout then.
- F24: add the answer under the question at REVEAL in `ScreenQuestion`, replace the `TODO(F24)` FINAL placeholder in `Screen.tsx`, and grey out locked-out players.

**How to try it:** `npm run dev`, then Host a game on `http://localhost:5173`; the Screen opens at `/screen/<CODE>`. Join 2–3 players from `/play/<CODE>` (phones on `http://<LAN-IP>:5173`) or spawn bots at `/dev/bots/<CODE>`. Pair the host remote, then Start game ("Buzzers locked") and Open buzzers ("Buzzers OPEN"). Buzz from several players: the Screen shows the winner's banner and the "also buzzed" gaps.

## F17 — Player buzzer screen (2026-10-27)
**What changed:**
- The Player view's `Buzzer` in `client/src/pages/Play.tsx` is now live. It is a whole-viewport circle that fires on `pointerdown` and on Space (no key repeat). A press shows "Buzzed…" and calls `navigator.vibrate(30)` before it sends `player:buzz`. A rejected ack frees the button.
- New `client/src/lib/buzzerState.ts` maps the `PlayerView` to the look and label: Lobby, Get ready…, BUZZ! (red, pulsing), Buzzed…, You're first! Answer now (green), "<Name> buzzed first" (dim).
- The button and page use `touch-none`, `select-none` and `[-webkit-touch-callout:none]`, and the button blocks the context menu.
- New `client/src/lib/ping.ts` (`keepPinging`): pings every `PING_INTERVAL_MS` while connected and acks every `pong`. `useRoomSocket` takes an optional `attach(socket)` that runs before `connect()`; the Player page attaches the pinger. `dev/bots.ts` now reuses `keepPinging`, with its tests unchanged.
- `index.css`: theme tokens `buzz`, `buzz-edge`, `win`, `win-edge` and the `animate-buzz-pulse` animation.
- Tests: 8 in `buzzerState.test.ts`, 5 in `ping.test.ts`, 13 new in `Play.test.tsx`. 460 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F17 cover:
- Pings start on the socket's connect, not on page load.
- The optimistic press lasts the whole opening; only a rejected ack frees it.
- Locked out, REVEAL and FINAL stay "Game in progress" until F24.

**Notes for next session:**
- Playtest (2026-10-27, `PORT=3100 npm start` because a PokéTrack dev server held :3000): 3 players at 375 px. Lobby, Get ready, BUZZ! and pointerdown all passed. The winner's tab went green and the other two showed "Ben buzzed first". A Space buzz on the next question passed. Computed `touch-action` and `user-select` were `none`. The client sent `ping` every 2 s and acked every `pong`. "Buzzed…" was too brief to see on localhost; the unit test covers it.
- `vite.config.ts` proxies to `DEFAULT_PORT` only, so `npm run dev` cannot move off :3000.
- The host remote shows no RTT, so a phone's `rttMs` is only visible in tests and `/dev/bots`.
- F24 replaces the `TODO(F24)` branches in `buzzerState.ts`.
- A buzz the server ignores silently leaves "Buzzed…" up for the opening (Backlog: `canBuzz`).

**How to try it:** `npm run dev`, Host a game on `http://localhost:5173`, then join two or three phones at `http://<LAN-IP>:5173/play/<CODE>`. From the host remote, Start game, then Open buzzers. Tap one phone: it turns green, and the others show its name. On a desktop tab, Space buzzes.

## F16 — Host remote primary action (2026-10-27)
**What changed:**
- New `client/src/components/PrimaryAction.tsx` is the remote's full-width primary button. Its label and event follow the phase:
  - LOBBY: Start game.
  - QUESTION: Open buzzers.
  - OPEN, COLLECTING and BUZZED: Reveal answer.
  - REVEAL: Next question, or Show final results on the last question.
  - FINAL: no button.
- After a press, the button stays disabled until a new `state` arrives or the ack is a rejection.
- New `client/src/components/Toast.tsx` (`useToast`, `Toast`, `TOAST_MS` = 3 s). A rejected ack shows the server's error as a toast.
- `useRoomSocket` now returns a ref to the open socket. `Host.tsx` sends through it, and a null socket is rejected locally as "Not connected".
- Tests: 10 new ones in `Host.test.tsx` cover labels and events per phase, the cycle, a double tap, and the toast and its timer. 1 new one in `sockets.buzz.test.ts`: two host sockets send `host:next` at once, one is ok, the other gets "Not allowed in this phase", and every device ends on question 2. 434 tests in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F16 cover:
- The label map, with BUZZED on Reveal answer until F22.
- Start game stays enabled with no players, so the server's error comes back as a toast.
- The disable-until-snapshot rule, which needs no timer.
- The toast's length and the offline buffering.

**Notes for next session:**
- F22 replaces the BUZZED entry in `BY_PHASE` (`TODO(F22)`) with Correct / Wrong. Reuse `useToast` and the `send` pattern for the secondary actions, and widen `PrimaryEvent`/`send` to take a payload (`host:judge {result}`).
- Playtest result (2026-10-27): start, open, reveal and next across all 10 questions passed. Show final results passed. Two host tabs pressing Reveal at once passed: the loser got the toast and both tabs matched. The Screen only shows "Game in progress" until F18, so "Screen follows" could not be seen there.
- In FINAL, the remote keeps showing the last question. A game-over state for the remote is in the Backlog.

**How to try it:** `npm run dev`, then Host a game on `http://localhost:5173`. Use **Pair host phone** (or a phone on `http://<LAN-IP>:5173`) to open the remote. Join one player from `/play/<CODE>` or `/dev/bots/<CODE>`, then drive the game from the remote. For the toast, open the remote in two tabs: once one tab has pressed Reveal answer, press it in the other before that tab updates. Alternatively, press Start game with no players.

## F15 — Gateway: effects runner, ping and buzz (2026-10-27)
**What changed:**
- `server/sockets.ts` runs the reducer's new effects:
  - `schedule` runs `setTimeout(() => dispatch(code, action), at − now)`. Pending timers are cleared when the HTTP server closes.
  - `log` prints one `[buzz] {…}` JSON line per counted buzz.
  - `dispatch` skips the store and the broadcast when `reduce` returns the same room.
- New gateway option `monotonic` (default `performance.now()`). It supplies the buzz `receivedAt` and times RTT.
- New handlers:
  - `player:buzz`: joined players only, 5/s per socket (`BUZZ_RATE_LIMIT`, "Too many buzzes").
  - `ping`: 5/s per socket (`PING_RATE_LIMIT`). It answers `pong {t}` with an ack. The server times emit → ack, keeps the samples on `socket.data`, and writes the median into the player's `rttMs`. That write sends no broadcast and stamps no activity.
  - `host:start/open/reveal/next/prev/end/scoreboard`, gated by `canHost` ("Only the host can do that").
- `shared/types.ts`: `pong` now has an ack. `client/src/dev/bots.ts` acks it.
- New constants: `NOT_HOST_ERROR`, `BUZZ_RATE_LIMITED_ERROR`, `PING_RATE_LIMIT`, `PING_RATE_LIMITED_ERROR` and `PONG_ACK_TIMEOUT_MS`.
- 15 new tests in `server/sockets.buzz.test.ts` (fake `setTimeout`, injected monotonic clock) and 1 in `bots.test.ts`, 420 in total. No new dependency.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F15 cover:
- How the server times RTT (the `pong` ack, resolving the F12 note). This is also a proposed spec change.
- Where the RTT samples live, with no broadcast and no activity stamp.
- How timers are scheduled and cleared.
- Skipping the broadcast for ignored actions, and the log format.
- The auth errors for host and buzz events.
- The ping rate limit, a spec gap.

**Notes for next session:**
- F17's player client must ping every `PING_INTERVAL_MS` and **ack every `pong`**. Without the ack the server gets no sample and `rttMs` stays 0, which means no latency correction. This is now a Done-when bullet on F17.
- `HostView.players[].rttMs` is a raw median in fractional ms, so clients should round it.
- `host:judge/undo/adjustScore/kick/settings` are still unwired (F19–F21). F19's `reopen` effect goes through the same `schedule` path, so no gateway change is needed.
- `sockets.buzz.test.ts` has its own harness. `flush(c)` sends `screen:join` ("Already joined") as a side-effect-free round trip. Use it before recording, because a broadcast to other sockets can land after the sender's ack.

**How to try it:** `npx vitest run server/sockets.buzz.test.ts`. In the app, `npm run dev`: create a room, open `http://localhost:5173/dev/bots/<CODE>` (F11), spawn bots, then use the host remote to start and open. The bots' buzzes now get a winner `fx` and the server prints `[buzz]` lines. Player buzz UI arrives in F17/F18.

## F14 — Reducer: buzz collection and window close (2026-10-27)
**What changed:**
- `server/reducer.ts` adds two actions:
  - `player:buzz {playerId, receivedAt}`. `receivedAt` is the gateway's monotonic time.
  - `windowClosed {questionIndex, openingCounter}`, a new `TimerAction`.
- `Effect` gains `schedule {at, action}` and `log {questionIndex, openingCounter, buzz}`.
- Buzz behaviour by phase:
  - The first counted buzz in OPEN goes to COLLECTING and schedules `windowClosed` at `now + 150`.
  - COLLECTING adds the buzz to the window.
  - BUZZED records a late buzz for the also-buzzed list. It never changes the winner.
  - Every counted buzz emits a `log` effect.
  - `windowClosed` checks COLLECTING, the index and the counter. It ranks with `rankBuzzes`, sets `winnerId`, moves to BUZZED and emits `fx buzz` with `buzzGaps`.
- Ignored buzzes and stale timers return ok with the same `room` object and no effects. `reduce` leaves `lastActivityAt` unstamped for them. Ignored buzzes are: wrong phase, locked out, already buzzed this opening, or joined this opening.
- New `Player.joinedAtOpening` field: the `openingCounter` at join, kept on reconnect. It implements "can buzz from the next opening".
- `toView`'s `alsoBuzzed` is now filled in. The winner stays first, and every other buzz is ranked with its gap to the winner.
- 36 new tests in `reducer.buzz.test.ts` and 3 in `views.test.ts`, 404 in total.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F14 cover:
- Open question 4 (late buzzes in BUZZED), now resolved.
- `joinedAtOpening`.
- Silent ignores that return the same room. An unknown player id fails with "Unknown player".
- The `schedule` and `log` effects.
- The window lasts until the timer fires. Measuring it in monotonic time is in the Backlog.

**Notes for next session:**
- F15 wires `player:buzz` in `sockets.ts`:
  - Dispatch `{type: 'player:buzz', playerId, receivedAt: performance.now()}`.
  - In `runEffects`, `schedule` should run `setTimeout(() => dispatch(code, effect.action), effect.at - clock())`, and `log` should print the buzz.
  - `runEffects` currently has no case for either, so both are silently dropped.
  - `dispatch` can skip `broadcast` when `result.room === room`, which is an ignored action.
  - Clear pending timers when a room closes.
- F19's `reopen` joins `TimerAction`. While BUZZED has a pending reopen, decide whether late buzzes still record for the old opening. They currently would.
- Kicking a player (F21) during COLLECTING: `rankBuzzes` sorts a departed player last, but a lone departed buzzer would still become `winnerId`.

**How to try it:** `npx vitest run server/reducer.buzz.test.ts server/views.test.ts`. Nothing is visible in the app until F15/F18.

## F13 — Reducer: question flow (2026-10-27)
**What changed:**
- `server/reducer.ts` accepts seven new actions. They are named like their socket events, and `host:scoreboard` carries `show`.
  - `host:start`: LOBBY with at least 1 player, to QUESTION 0.
  - `host:open`: QUESTION to OPEN. It clears `buzzes` and adds 1 to `openingCounter`.
  - `host:reveal`: QUESTION, OPEN, COLLECTING or BUZZED to REVEAL. It drops the buzzes and the winner, and keeps the lockouts.
  - `host:next`: REVEAL to the next QUESTION, or to FINAL after the last question.
  - `host:prev`: any question phase or REVEAL to QUESTION index − 1. It is rejected at index 0.
  - `host:end`: any phase to FINAL.
  - `host:scoreboard`: any phase. It sets the overlay.
- `enterQuestion` resets `buzzes`, `winnerId` and `lockedOut`. With `autoOpenBuzzers` on, it goes straight to OPEN (start, next and prev). `host:next` sets `showScoreboard` when the finished question number is a multiple of `scoreboardEvery`.
- A wrong phase fails with the exported `WRONG_PHASE_ERROR` ("Not allowed in this phase"). No effects are emitted, and there is no socket wiring yet.
- There are 64 new tests in `reducer.flow.test.ts`, 365 in total. They cover each transition row, plus a table-driven test that every unlisted phase rejects each action and leaves the room unchanged.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F13 cover:
- Open questions 7 (when the overlay hides) and 8 (prev onto an answered question), now resolved.
- Auto-open on every entry to QUESTION. The start rule counts disconnected players.
- FINAL clears the per-question state. Reveal keeps lockouts. End and scoreboard work in every phase.
- One wrong-phase error. Stale timers are guarded by phase + index + counter.

**Notes for next session:**
- F14's `windowClosed` must check that the phase is COLLECTING, as well as `questionIndex` and `openingCounter`. F19's `reopen` must check BUZZED with a pending reopen. Only an opening bumps the counter, so after `prev`/`next` back to the same question the counter alone does not prove an effect is fresh.
- F15/F21 wire these through `sockets.ts` `dispatch` (host token check, zod parse, ack).
- F19 adds the reopen wait (open question 5). `host:reveal` and `host:prev` from BUZZED with a pending reopen then need to clear it.

**How to try it:** `npx vitest run server/reducer.flow.test.ts`. Nothing is visible in the app until F15/F16.

## F12 — Fairness: latency and ranking (2026-10-27)
**What changed:**
- `server/fairness.ts`, pure functions with no clock or socket:
  - `addRttSample(samples, rttMs)` keeps the newest `RTT_SAMPLES` (10) and drops negative or non-finite samples.
  - `medianRtt(samples)` returns 0 with no samples. With an even count, it takes the mean of the two middle samples.
  - `oneWayMs(rtt) = rtt / 2`.
- `makeBuzz(playerId, receivedAt, rttMs)` → `Buzz` with `adjustedAt = receivedAt − min(oneWay, MAX_LATENCY_CORRECTION_MS)`. A negative or non-finite RTT counts as 0.
- `rankBuzzes(buzzes, players)` puts the winner first. It sorts by `adjustedAt`, then `receivedAt`, then `joinedAt`. A buzz from a player who has left sorts after the rest of its tie. `buzzGaps(ranked)` returns `BuzzGap[]` (`adjustedAt` gap to the winner, in rank order, winner excluded).
- There are 21 new tests in `fairness.test.ts`, 301 in total.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F12 cover:
- Open question 16 (no correction before the first sample), now resolved, and the even-count median.
- Pure functions only. F15 picks where the samples live.
- Departed players in ties, and raw-ms gaps that clients format.

**Notes for next session:**
- F15 wires this up. On each RTT sample: `samples = addRttSample(samples, rtt)`, then `player.rttMs = medianRtt(samples)`. The samples need a home: a `Player.rttSamples` field that views never copy, or a gateway map cleared when a player or room goes. The reducer then builds buzzes with `makeBuzz(id, receivedAt, player.rttMs)`, where `receivedAt` comes from `performance.now()` in the gateway.
- The spec's ping shape is `ping {t}` → `pong {t}`. That pair lets the client measure RTT, but not the server. F15 has to decide how the server gets a sample, for example from the client's measured RTT or from a server-initiated ping.
- Late buzzes in BUZZED (DECISIONS #4) still go through `rankBuzzes`/`buzzGaps`. They can never outrank the announced winner only because the reducer keeps `winnerId` fixed, so F14/F15 must not re-pick the winner from a re-rank.

**How to try it:** `npx vitest run server/fairness.test.ts`. Nothing is visible in the app until F15.

## F11 — Dev tool: fake players (2026-10-27)
**What changed:**
- `client/src/dev/bots.ts`: `createBot({code, index, onChange})`. Each bot is its own `createSocket()` that joins as `bot-<n>` / "Bot <n>" on every connect, pings every `PING_INTERVAL_MS` while connected, and has `buzz(delayMs)`. A buzz shows its ack, or "No reply in 2 s". Also `buzzDelay` (0–300 ms) and `clampBotCount` (1–50).
- `client/src/dev/DevBots.tsx` at `/dev/bots/:code`: a count input (default 8), **Spawn** (grows or shrinks the set to N), **Remove all**, **Buzz all (random 0–300 ms)**, and one row per bot with status, RTT and the last message.
- `App.tsx` registers the route only when `import.meta.env.DEV` and lazy-loads the page. After `npm run build`, `grep -rE "dev/bots|Buzz all|Bots for|bot-" dist/client` finds nothing.
- There are 27 new tests, 280 in total: `bots.test.ts` (17), `DevBots.test.tsx` (7), `App.test.tsx` (2: the route in dev, "Page not found" with `DEV=false`) and `sockets.test.ts` (1: 20 joins from one IP at once under the default limit).

**Decisions:** the DECISIONS rows dated 2026-10-27 for F11 cover:
- The client-only route gated on `import.meta.env.DEV`.
- Fixed bot ids, so a re-spawn reconnects. No dev-specific join limit.
- The 2 s buzz-ack timeout, and pinging only while connected.

**Notes for next session:**
- F15 adds the `ping`→`pong` handler and `player:buzz`. The bots' RTT column then fills in, and their buzz rows show real acks instead of "No reply in 2 s".
- One `/dev/bots` tab per room. Two tabs would drive the same `bot-<n>` players.
- `vi.stubEnv('DEV', false)` plus `vi.resetModules()` and a dynamic `import('./App.js')` is how the production-route test sees the build flag.
- The playtest saved no screenshot, because no step failed. Its evidence: 8 bots joined and the Screen showed "8 players" with chips Bot 1–8; 20 bots joined with no limit error; Buzz all gave "No reply in 2 s" on every row.

**How to try it:** Run `npm run dev`. On the laptop, open `http://<LAN-IP>:5173`, click **Host a game**, then **Use this device as the Screen**. In another tab, open `http://<LAN-IP>:5173/dev/bots/CODE`, set the count and click **Spawn**. Chips appear on the Screen. **Buzz all** sends a buzz from every bot (the server ignores it until F15). `npm run build && npm start`, then `/dev/bots/CODE` shows "Page not found".

## F10 — Host pairing and host remote shell (2026-10-27)
**What changed:**
- `client/src/components/PairHostPhone.tsx`: a **Pair host phone** button. It shows a QR to `/host/:code#t=<hostToken>` (`pairUrl` in `lib/joinUrl.ts`) with "Hides in N s", hides at a 60 s deadline (`PAIRING_QR_TTL_MS`), and has a **Hide** button. The token is never printed as text.
- `Screen.tsx` lobby: shows the button only when `loadHostToken(code)` is set (DECISIONS #14).
- `client/src/pages/Host.tsx` at `/host/:code`, replacing the placeholder:
  - The token comes from the hash (`tokenFromHash` in `lib/hostTokens.ts`) or from storage. The hash is stripped at once, and the token is stored only after `host:join` succeeds.
  - With no token: "Not authorised", and no socket is opened. A rejected token is cleared (only if it is the stored one; a different stored token is tried next) and ends at "Not authorised".
  - Remote: code and title, a question card (in the lobby, "Up first: question 1 of N" from `nextQuestion`) with the answer and notes in an accent box, **Pair host phone** in the lobby, and a live player list with colour dot, score and "offline".
- `INVALID_HOST_TOKEN_ERROR` in `shared/constants.ts` replaces the string in the server and the Screen.
- There are 28 new tests, 253 in total: `Host.test.tsx` (20), Screen pairing (5), `tokenFromHash` (2) and `pairUrl` (1). `App.test.tsx` now expects "Not authorised" at `/host/ABCD`.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F10 cover:
- Open question 14, now resolved.
- The deadline-based QR expiry and the Hide button.
- Hash over stored token, storing only after acceptance, and the fallback on rejection.
- "Not authorised" without a socket, and the shared error constant.
- Hash-only navigation in an open tab.
- `nextQuestion` in the lobby card; the image (F30) and the primary action (F16) wait.

**Notes for next session:**
- F16 adds the primary action where `Host.tsx` has `TODO(F16)`, below the question card. F22 adds the tabs and secondary actions.
- `HostConnected` is keyed by token, so a token change opens a fresh socket.
- Tests that start on a `#t=` URL must `await flushNavigation()` (an `act` flush) before acking a join that remounts. Otherwise React Router's pending transition hangs the test until it times out.
- Pairing tests mock `qrcode.react` to expose the QR value as `data-value`.

**How to try it:** Run `npm run dev`. On the laptop, open `http://<LAN-IP>:5173`, click **Host a game**, then **Use this device as the Screen**, then **Pair host phone**. Scan the QR with a phone: it opens the remote with the first question's answer, and players appear there as they join. The QR hides after 60 s. `/host/CODE` on a device with no token shows "Not authorised". Screenshot: `.playtest/F10/4-host.png`.

## F09 — Player join flow (2026-10-27)
**What changed:**
- `client/src/pages/Play.tsx` at `/play/:code`:
  - It checks `GET /api/rooms/:code/exists` (`roomExists` in `lib/api.ts`). An unknown or malformed code shows "Room not found" with a link home.
  - Name form: 1–16 characters (`maxLength`, then `playerNameSchema`, which trims). Join stays disabled for a blank name. Server refusals, such as "That name is taken", show on the form.
  - The join goes through `useRoomSocket` with `player:join`. The identity is stored only once the join succeeds. A stored identity rejoins on load and on every reconnect, without the form.
  - Lobby: a slim top bar in the player's colour with name and score, and a grey disabled round button, "You're in! Waiting for the host". Other phases show "Game in progress" until F17.
- `client/src/lib/playerIdentity.ts`: `newPlayerId` (nanoid), and save, load and clear `{playerId, name}` under `buzzr:player:<CODE>`.
- `PLAYER_KICKED_ERROR` in `shared/constants.ts` is now used by the reducer and by the Player view.
- `client/src/test/fakeSocket.ts`: the `FakeSocket` moved out of `Screen.test.tsx` and is shared.
- There are 29 new tests, 225 in total: `Play.test.tsx` (19), `playerIdentity.test.ts` (6) and `roomExists` in `api.test.ts` (4). `App.test.tsx` now expects the real Player page.

**Dependencies:**
- `nanoid`: the spec's `playerId` generator. `crypto.randomUUID` is unavailable on plain-http LAN pages, which are not a secure context.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F09 cover:
- nanoid over `randomUUID`.
- The storage key.
- `exists` first, and clearing a stale identity.
- Storing only after the join succeeds, with one id per visit.
- Refusals back to the form, except a kick.
- The "Game in progress" stand-in.

**Notes for next session:**
- F10 (the Host remote) can follow the same page shape: a `Step` union, then a room component that calls `useRoomSocket` with its own `join`.
- F17 replaces the `Buzzer` label switch in `Play.tsx` (`TODO(F17)`). Keep the colour bar, and add `pointerdown` and Space.
- Players in tabs of one browser share `localStorage`, so they share an identity per room. Playtests need one browser context per player.
- Wake Lock and the connection dot belong to F33, not F17.

**How to try it:** Run `npm run dev`. On the laptop, open `http://<LAN-IP>:5173`, click **Host a game**, then **Use this device as the Screen**. Scan the QR with phones (or open `/play/CODE` in separate browser profiles) and enter names. Chips appear on the Screen. Reload a phone and it stays the same player. A duplicate name shows "That name is taken". `/play/ZZZZ` shows "Room not found". Screenshot: `.playtest/F09/lobby-player.png`.

## F08 — Host a game and the Screen lobby (2026-10-27)
**What changed:**
- `client/src/components/HostGame.tsx`, shown on the landing page:
  - **Host a game** posts `SAMPLE_SET` with `DEFAULT_SETTINGS` through `createRoom` (`client/src/lib/api.ts`) and stores the token with `saveHostToken`.
  - It then shows the code, **Use this device as the Screen** (which goes to `/screen/CODE`) and **Open the Screen on another device** (which shows the Screen URL and the code).
- `client/src/pages/Screen.tsx` at `/screen/:code`:
  - It joins with the stored token, if this device has one. A stale token is dropped and the Screen rejoins without it.
  - Lobby: the set title, "Join at <url>", the huge code, the QR to `/play/CODE` (`qrcode.react`) and colour chips that pop in. Chips shrink above 20 players. Running on localhost shows a note.
  - A bottom strip always shows the code and "Join at <url>".
  - Errors show their message with a link home. Phases other than LOBBY show "Game in progress".
- Client plumbing:
  - `lib/roomStore.ts`: a Zustand store `{view, error}`.
  - `lib/useRoomSocket.ts`: `useRoomSocket(code, join, makeSocket?)` joins on every `connect`, so a reconnect rejoins, and resets the store on unmount.
  - `lib/hostTokens.ts`: save, load and clear.
  - `lib/joinUrl.ts`: `joinUrl`, `displayUrl` and `isLoopbackHost`.
- There are 27 new tests, 196 in total.
  - `Screen.test.tsx` uses a fake socket: the join payload with and without a token, the stale-token rejoin, the reconnect rejoin, the lobby code, URL and QR, live chips, the strip in the lobby and in a game, errors, a malformed code and the disconnect on unmount.
  - Landing gains 5 Host a game tests.
  - The new lib tests cover api, hostTokens and joinUrl.
- `.gitignore` now ignores `graphify-out/`.

**Dependencies:**
- `zustand`: the spec's client-state store. It holds the latest snapshot, which pages render.
- `qrcode.react`: the spec's QR library, used for the join QR now and the pairing QR in F10.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F08 cover:
- The sample set until F25.
- The Screen choice shown on the landing page.
- The localStorage key.
- The join URL from the page origin, with the localhost note. A `PUBLIC_URL` item is in the Backlog.
- The stale-token rejoin.
- The store and hook shape.
- Pair and Start deferred.
- The chip scaling.

**Notes for next session:**
- F09 and F10 should reuse `useRoomSocket` with their own `join`. A component reads `useRoomStore` and narrows on `view.role`.
- F10 adds **Pair host phone** to the Screen lobby, shown only when `loadHostToken(code)` is set (DECISIONS #14). It also adds Start (F16/F23).
- In dev, open the app at the laptop's LAN address, not `localhost`, or the QR points phones at `localhost`.
- In dev, StrictMode mounts twice, so the browser logs one "WebSocket is closed before the connection is established" warning per Screen load. It is harmless.
- The playtest joined players by socket script, because `/play` is still a stub (F09). Node `socket.io-client` needed `transports: ['websocket']` against `127.0.0.1:5173`.

**How to try it:** Run `npm run dev`. On the laptop, open `http://<LAN-IP>:5173`, click **Host a game**, then **Use this device as the Screen**. The lobby shows the code, the QR and the URL. Join players with a `socket.io-client` script (`player:join {code, playerId, name}`) or, after F09, from phones. Chips appear live. Screenshots: `.playtest/F08/`.

## F07 — Socket gateway: joins and state broadcast (2026-10-27)
**What changed:**
- `server/sockets.ts`: `attachSockets(httpServer, {rooms, clock, trustProxy, playerJoinLimit})` is WebSocket only, with `maxHttpBufferSize` set to 100 KB.
  - `handle(socket, event, fn)` parses with `clientPayloadSchemas[event]`, tolerates a missing ack and turns a throw into "Server error".
  - `dispatch(code, action)` runs `reduce`, stores the result, broadcasts and then runs the effects. `broadcast(room)` sends `toView` per role to `room:<code>:screen`, `room:<code>:host` and each `room:<code>:player:<id>`. `fx` goes to all of them.
  - `screen:join` (optional token, which sets `socket.data.canHost`), `host:join` (`verifyHostToken`) and `player:join` (per-IP limit for new ids only) are handled. A disconnect marks the player disconnected unless another socket holds the same id.
- `server/index.ts` passes `rooms`, `Date.now` and `trustProxy` to the gateway.
- `client/src/lib/socket.ts`: `createSocket(url?)` is typed, uses `transports: ['websocket']` and sets `autoConnect: false`. Nothing calls it yet.
- There are 16 new tests, 169 in total. `server/sockets.test.ts` uses real socket.io clients on an ephemeral port: bad tokens, Screen with a token gets no answers, notes or hash, the fresh state per role, reconnect, the reconnect race, validation, the 100 KB close, the join limit and `lastActivityAt`. `client/src/lib/socket.test.ts` covers the transport. Two mutations of the gateway were each caught.

**Dependencies:**
- `socket.io-client`: the official client for the Socket.IO server, used by the browser and by the real-client gateway tests.
- `proxy-addr` and `@types/proxy-addr`: Express already ships `proxy-addr` for `req.ip`. Importing it directly lets the socket join limit resolve the client IP with the same `TRUST_PROXY` rule.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F07 cover:
- Open questions 2 and 3, now resolved.
- `proxy-addr` for the IP.
- One join per socket.
- Joins bumping `lastActivityAt`.
- The disconnect race.
- State going out before the ack, and the error messages.

**Notes for next session:**
- F08 and later host events: check `socket.data.canHost` (true for host sockets and for a Screen that sent a valid token). Send them through `dispatch`.
- Extend the Screen-with-token leak test once host actions change state. Add an `fx` leak check when `fx buzz` and `fx correct` land (F12 and later).
- `player:*` events must use `socket.data.playerId`, never a playerId from the payload.
- `ping`, `player:buzz` and scheduled effects are F15. `runEffects` switches on `effect.type`, so add the cases there.
- `room:closed` and `kicked` are not emitted yet. The sweeper deletes rooms silently.

**How to try it:** Run `npx vitest run server/sockets.test.ts`. Or run `npm run build && PORT=3917 npm start`, `POST /api/rooms` with `SAMPLE_SET`, and connect a `socket.io-client` with `transports: ['websocket']`. `host:join {code, hostToken}` acks `{ok: true}` and delivers a HostView.

## F06 — Room creation over HTTP (2026-10-27)
**What changed:**
- `server/http.ts`: `createApp({clientDir, rooms, clock, rng, trustProxy})`.
  - `POST /api/rooms` checks the per-IP limit (10/h, 429), parses JSON up to 1 MB (413), validates with `createRoomBodySchema` (400 with a `z.prettifyError` message naming the field) and draws a code with `createRoomCode` (503 if none is free). It stores `createRoom(...)` with only the token hash and answers 201 `{code, hostToken}`.
  - `GET /api/rooms/:code/exists` answers `{exists, phase}` in any case, with `phase: null` for unknown or malformed codes.
  - Every error body is `{ok: false, error}`. An error handler maps body-parser failures to 400 and 413.
- `server/hostToken.ts` holds `generateHostToken` (32 CSPRNG bytes, base64url), `hashHostToken` (SHA-256 hex) and `verifyHostToken` (constant-time digest compare). `server/rateLimit.ts` holds `createRateLimiter({max, windowMs}, clock)`, a sliding window per key.
- `shared/sampleSet.ts` holds `SAMPLE_SET`: 10 text-only general-knowledge questions with ids `sample-q1`…`sample-q10`.
- `server/index.ts` passes the store, `Date.now` and `TRUST_PROXY` to `createApp`. `shared/types.ts` gains `RoomExistsResponse` and `HttpErrorBody`.
- There are 28 new tests, 153 in total, in `http.test.ts`, `hostToken.test.ts`, `rateLimit.test.ts` and `sampleSet.test.ts`.

**Dependencies:** none.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F06 cover:
- The status codes and the error shape.
- Every create attempt counting against the limit.
- `trust proxy` off unless `TRUST_PROXY` is set.
- `exists` always answering 200.
- The hash format and the compare.
- The text-only sample set.

**Notes for next session:**
- F07 must authorise `host:join` and `screen:join` with `verifyHostToken(token, room.hostTokenHash)`, not a string compare.
- Reuse `createRateLimiter` for `player:buzz` (per socket) and `player:join` (per IP, DECISIONS #3).
- `server/index.ts` still has `TODO(F07)`: pass `rooms` to `attachSockets`.
- F34 must set `TRUST_PROXY` behind a proxy; I added that to its Done-when. Rate-limiting `exists` is in the Backlog.
- Nothing in the client calls these endpoints yet. **Host a game** (F08) will post `SAMPLE_SET` or a saved set.

**How to try it:** Run `npm test` (`server/http.test.ts` and the others above). Or run `npm run dev` and then:
`curl -s -XPOST localhost:3000/api/rooms -H 'content-type: application/json' -d '{"set":{},"settings":{}}'`, which gives a 400 listing the bad fields. Then `curl -s localhost:3000/api/rooms/ABCD/exists`.

## F05 — Reducer foundation: lobby, players, toView (2026-10-27)
**What changed:**
- `server/reducer.ts` holds:
  - `reduce(room, action, now)`, which returns `{ok: true, room, effects}` or `{ok: false, error}`. It never mutates its input and sets `lastActivityAt = now` on every successful action.
  - The `Action` union, which so far has `player:join {playerId, name}` and the internal `player:disconnect {playerId}`. `Effect` is `{type: 'fx', fx}` for now.
  - `player:join`, which checks in this order: kicked id, known id (reconnect: `connected: true`, with name, score and colour kept), FINAL, 50 players, then a case-insensitive name match. A new player gets the least-used palette colour and triggers `fx join`.
- `server/room.ts` holds `createRoom({code, hostTokenHash, set, settings, now})`, which builds a fresh LOBBY room. F06 should use it.
- `server/ranking.ts` holds `rankPlayers`. It sorts by score, highest first, then by join order. Ties share a rank (1, 1, 3).
- `server/views.ts` holds `toView(room, role, playerId?)`, with an overload per role.
  - The Screen view builds the question field by field. The answer is included in REVEAL only.
  - The host view gets the full current and next question, the buzzes, the judgements and each player's RTT.
  - The player view gets `me`, rank, `hasBuzzed`, `lockedOut`, the winner's name and `pointsThisQuestion`. It never gets question text.
- Test fixtures live in `server/test/rooms.ts`: `makeRoom`, `makePlayer`, `makeSet`, `makeQuestion` and `withPlayers`. `tsconfig.build.json` excludes `server/test`.
- There are 50 new tests, 125 in total, across `reducer.lobby.test.ts`, `views.test.ts` (the leak test) and `ranking.test.ts`. The leak test fails if `screenQuestion` spreads the question; I checked this by mutating it.

**Dependencies:** none.

**Decisions:** the DECISIONS rows dated 2026-10-27 for F05 cover:
- `now` is wall-clock time.
- The result shape.
- The order of the join checks.
- A reconnect ignores the name it sends.
- The duplicate-name rule.
- Colour reuse.
- Competition ranking.
- No answer in FINAL. This departs from the spec's literal wording, because `host:end` can reach FINAL from an unrevealed question.
- The view defaults.

**Notes for next session:**
- `alsoBuzzed` is `[]`, marked `TODO(F12, F14)`.
- F14 needs a way to know that a player "joined during the current opening". `Player` has only `joinedAt`, so F14 may need to record the opening a player joined in.
- No action is phase-gated yet; only the unknown-action rejection is tested. F13 adds the table-driven wrong-phase tests.
- `player:disconnect` also bumps `lastActivityAt`.
- The reducer expects the name to be trimmed and parsed by zod already.
- `toView(room, 'player', id)` throws for an unknown id. The gateway must only build views for joined players.
- Under `noUncheckedIndexedAccess`, `room.players[id]` and `PLAYER_PALETTE[i]` can be `undefined`. Use `?.` in tests.

**How to try it:** Run `npm test` (`server/reducer.lobby.test.ts`, `server/views.test.ts` and `server/ranking.test.ts`). There is no UI or socket yet.

## F04 — Room codes and RoomStore (2026-10-27)
**What changed:**
- `server/codes.ts` holds:
  - `generateRoomCode(rng)`, which makes one 4-letter draw from `ROOM_CODE_ALPHABET`.
  - `isBlockedCode(code)`, a substring match against `BLOCKED_WORDS`.
  - `createRoomCode(isTaken, rng = Math.random)`, which retries collisions and blocked words. It throws after `ROOM_CODE_MAX_ATTEMPTS` (100) draws.
  - The `Rng` type, `() => number` in [0, 1).
- `server/roomStore.ts` holds:
  - A synchronous `RoomStore` interface: `get`, `has`, `set` (keyed by `room.code`), `delete` (returns a boolean), `size` and `sweep(now)`. `sweep` deletes rooms with `now - lastActivityAt >= ROOM_IDLE_TTL_MS` and returns their codes.
  - `InMemoryRoomStore`, the Map-backed implementation.
  - `startRoomSweeper(store, clock, intervalMs = ROOM_SWEEP_INTERVAL_MS)`, an unref'd interval that returns a stop function.
- `shared/constants.ts` gains `ROOM_SWEEP_INTERVAL_MS` (60 s) and `ROOM_CODE_MAX_ATTEMPTS` (100).
- `server/index.ts` creates the store and starts the sweeper with `Date.now`. The store is not yet passed to the HTTP or socket layers (`TODO(F06, F07)`).
- There are 19 new tests, 75 in total. `codes.test.ts` covers the alphabet, seeded collision retry, the blocklist and exhaustion. `roomStore.test.ts` covers get/set/delete, 3 h − 1 ms against exactly 3 h, idleness measured from last activity, and the sweeper on fake timers.

**Dependencies:** none.

**Decisions:** DECISIONS rows dated 2026-10-27 for F04 cover:
- The blocklist contents and substring matching.
- `Math.random` for codes and the 100-draw cap.
- Expiry at exactly 3 h, on wall-clock time, with a 60 s sweep.
- The synchronous `RoomStore`.

**Notes for next session:**
- Write `createdAt` and `lastActivityAt` with `Date.now` (wall clock), not `performance.now`. The sweeper compares them against `Date.now`. Buzz times are the only values on the monotonic clock.
- F06 calls `createRoomCode((code) => rooms.has(code))` and turns the exhaustion error into an error response.
- Whatever handles an event must bump `lastActivityAt`, or rooms expire mid-game after 3 h.
- The store keeps nothing but rooms. Images are still to come.

**How to try it:** Run `npm test` (`server/codes.test.ts` and `server/roomStore.test.ts`). There is no UI or endpoint yet.

## F03 — Landing page and route shell (2026-10-27)
**What changed:**
- Tailwind v4 through `@tailwindcss/vite`. `client/src/index.css` holds the theme in `@theme`: `bg`, `surface`, `edge`, `ink`, `muted`, one `accent` (#ffc400) with `accent-ink`, and a `font-display` stack. Use them as `bg-surface`, `text-accent`, `font-display` and so on.
- React Router 8 (`react-router`, declarative `<Routes>`). `App.tsx` exports `AppRoutes` (the route table, mountable in a `MemoryRouter`) and `App` (wraps it in `BrowserRouter`). The routes are `/`, `/play/:code`, `/screen/:code`, `/host/:code`, `/sets`, `/sets/:setId` and a `*` "Page not found". All but `/` render `pages/Placeholder.tsx`.
- `pages/Landing.tsx`: **Join a game** with a code input, **Host a game** and a **My question sets** link to `/sets`. The input runs every change through `normalizeRoomCode`. Join is disabled until `isCompleteRoomCode`, and submitting navigates to `/play/<CODE>`.
- `lib/roomCode.ts`: `normalizeRoomCode` (upper case, room-code alphabet only, at most 4) and `isCompleteRoomCode` (uses the shared `roomCodeSchema`). There are 22 new tests, 56 in total.

**Dependencies:**
- `react-router` (runtime): the spec's stack names React Router.
- `tailwindcss` and `@tailwindcss/vite` (dev): the spec's stack names Tailwind CSS; the Vite plugin is Tailwind v4's build integration.

**Decisions:** DECISIONS rows dated 2026-10-27 for F03 cover the theme tokens living in CSS, the inert **Host a game** button, the input dropping characters outside the alphabet, and the catch-all route.

**Notes for next session:**
- Import router APIs from `react-router` (v8 has no `react-router-dom`).
- To test a page that navigates, mount it in a `MemoryRouter` with a `*` route that prints `useLocation().pathname`. `Landing.test.tsx` shows the pattern.
- `client/src/lib/roomCode.ts` imports `shared/schemas`, so zod ships in the client bundle (about 346 kB JS before gzip in total).
- **Host a game** has a `TODO(F08)` and no handler.
- The playtester's Playwright MCP writes `.playwright-mcp/`. It is now in `.gitignore` and `.prettierignore`.

**How to try it:** Run `npm run dev`, then open http://localhost:5173 on a phone (`http://<LAN-IP>:5173`) or a 375 px-wide browser window. Type `ab1cd` into the code box: it shows `ABCD`. Tap **Join** to land on `/play/ABCD`. **My question sets** opens `/sets`.

## F02 — Shared types, schemas and constants (2026-10-27)
**What changed:**
- `shared/types.ts` has every Data model type, plus:
  - `Role`, `BuzzGap`, `RankedPlayer` and `ScreenQuestion`.
  - `ScreenView`, `HostView` and `PlayerView`, each tagged by `role`, and their union `View`.
  - `Ack<T>` and `Fx`.
  - `ClientPayloads` and the typed Socket.IO maps `ClientToServerEvents` and `ServerToClientEvents`.
  - `CreateRoomBody` and `CreateRoomResponse`.
- `shared/schemas.ts` has:
  - `questionSetSchema` and `createRoomBodySchema`.
  - `clientPayloadSchemas`, one schema per client→server event. It uses `satisfies` over `ClientEvent`, so a missing event fails typecheck.
  - The building blocks `idSchema`, `roomCodeSchema`, `hostTokenSchema` and `playerNameSchema`.
  - `SchemaTypeChecks`, a compile-time assertion that the schemas and `types.ts` agree in both directions.
- `shared/constants.ts` has:
  - `PLAYER_PALETTE` (12 colours), `ROOM_CODE_ALPHABET` and `DEFAULT_SETTINGS`.
  - Every spec limit, plus those from DECISIONS #3, #11 and #12: sizes, timings and rate limits as `{max, windowMs}`.
- There are 34 tests, 30 of them new across `schemas.test.ts` and `constants.test.ts`.

**Dependencies:** `zod` 4 (runtime). The spec's stack names it for payload validation.

**Decisions:** DECISIONS rows dated 2026-10-27 for F02 cover:
- Open questions 11 and 13, now resolved.
- Ranges for points, score deltas, `scoreboardEvery` and ids.
- The schema validating only a *playable* set.
- Trimming and upper-casing room codes.
- Rejecting invisible characters in names.
- Strict versus stripping object schemas.
- First-cut view shapes and binary byte units.

Open questions 2, 3 and 12 now note which part F02 adopted.

**Notes for next session:**
- Zod 4 API: use `z.int()`, `z.strictObject()` and `z.string().toUpperCase()`. Schemas output trimmed or upper-cased strings, so handlers should use the parsed value, not the raw payload.
- A client that emits `player:buzz` with only an ack callback sends no payload. `emptySchema` rejects `undefined`. The socket handler should default a missing payload to `{}` before parsing.
- The view fields are a first cut. Extend them in `types.ts` when `toView` lands (for example, undo availability). Keep answers and notes out of Screen and Player views.
- `shared/constants.ts` imports `RoomSettings` from `types.ts` as a type only. There is no runtime cycle.

**How to try it:** Run `npm test` and `npm run typecheck`. There is no UI.

## F01 — Project skeleton and tooling (2026-10-27)
**What changed:**
- One ESM `package.json` with `dev`, `build`, `start`, `test`, `typecheck`, `lint`, `format`, `format:check`. The `dev` script runs `concurrently` with `tsx watch server/index.ts` (:3000) and `vite` (:5173, `0.0.0.0`). Vite proxies `/api`, `/healthz` and `/socket.io` (ws).
- `server/http.ts` has `createApp({clientDir?})`, with `GET /healthz` returning `{ok:true}` and an SPA fallback. `server/sockets.ts` attaches Socket.IO with websocket only and no handlers yet. `server/index.ts` wires them together.
- `client/` is a Vite root holding `index.html`, `src/main.tsx` and `src/App.tsx` (an H1 placeholder that F03 replaces). `shared/constants.ts` holds `APP_NAME` and `DEFAULT_PORT`.
- There are 4 tests: `/healthz`, the SPA fallback (which never swallows `/api` or `/socket.io`), App rendering under jsdom, and the shared constants.

**Dependencies:**
- Runtime: express, socket.io, react and react-dom, all from the spec's stack.
- Dev:
  - tsx runs the TypeScript server with watch.
  - concurrently gives one `npm run dev` command.
  - vitest, jsdom and @testing-library/react run the tests, with jsdom and Testing Library covering the client test.
  - eslint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, globals and eslint-config-prettier handle lint.
  - prettier, typescript, vite, @vitejs/plugin-react and @types/* make up the rest of the toolchain.

**Decisions:** DECISIONS rows dated 2026-10-27 for F01 cover open question 15 (resolved), the tsconfig split and `.js` imports, prod-only static serving with the fallback, the websocket-only server, Prettier ignoring `docs/` and `.claude/`, and no supertest with `@types/node@24`.

**Notes for next session:**
- `client/src` imports shared code as `../../shared/x.js`. Server and shared files also use `.js` extensions, which NodeNext requires.
- Vitest runs in the node environment by default. Client tests start with `// @vitest-environment jsdom` and use `afterEach(cleanup)`.
- On `npm run dev`, Vite may log one `http proxy error: /healthz ECONNREFUSED` if something probes it before the server is listening. That is harmless.
- npm 12 blocks esbuild's postinstall script. tsx and Vite work without it.

**How to try it:**
- Run `npm run dev`, then open http://localhost:5173 to see the "Buzzr" heading. `curl localhost:5173/healthz` returns `{"ok":true}`. Phones can use `http://<LAN-IP>:5173`.
- Run `npm run build && npm start`, then open http://localhost:3000 and http://localhost:3000/play/ABCD. Both show the app.
