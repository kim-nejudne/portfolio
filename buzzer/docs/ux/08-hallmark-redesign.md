# 08 — Hallmark redesign (M31)

A full Hallmark redesign of every Buzzr surface, planned 2026-11-16 with `/hallmark redesign buzzer/client`. **Kim's calls:** replace the Prime Time brand with a dealt theme, cover every surface, full depth, run as a roadmap milestone. The locked system is `design.md` at the project root: read it first. This file holds the read, the picks and what each feature changes. M31 supersedes the "Prime Time look stays" line in `00-foundations.md`. Every other rule in `00-foundations.md` still holds: the breakpoints, the variants, the floors and the device matrix.

## The read (before)

Recorded with `sloplint --before` on /, /sets, /play/:code, /screen/:code and /admin at 1280, 1440, 1920 and 375. The screenshots are in `.hallmark/before/` and the record in `.hallmark/before.json` (25 links, 22 fields, 327 handlers, 10 test hooks). The findings are in `.hallmark/before.txt`.

- **For:** running a quiz night on a TV, with phones as buzzers. The one action is to join (a player) or to host (the laptop).
- **Works and stays:** the Screen's huge room code and QR, which read at 5 m. The single-button "Click to start" gate. A buzzer that never moves between states. The two-pane admin.
- **Reads as generated:**
  - Bordered surface cards everywhere, including two identical cards side by side on Landing.
  - 60 identical "HOST / Preview / ⋯" cards on /sets.
  - Tracked uppercase labels ("ROOM CODE", "YOUR NAME", "OTHER"), gate 67 ×8.
  - Bungee on placeholders, buttons and labels.
  - Arrows glued to links ("Preview questions →"), gate 63 ×3.
  - The eyebrow on the answer sheet, gate 54.
  - Marquee bulbs as decoration.
- **Broken:**
  - Field edges are under 3:1 on Landing and Play (gate 40).
  - 40 controls wrap to 2 lines at 320px (49a).
  - `ChoiceTally` animates `width` (10a).
  - A colour literal in `CategoryPicker.tsx:56` (48).
  - Pure `#fff` ink (7b).
  - `::selection` and the scrollbar are unthemed (F16).
- **Before totals:** 79 FAIL · 7 REFLEX · 7 WARN. The 30a hits in tests are category and avatar emoji, which are content, not icons. They are dismissed.

## Picks

- **Redesign** · full · 11 routes (/, /play, /screen, /host, /sets, /sets/:id, /sets/:id/print, /admin and 4 sub-routes, /admin/sets/:id)
- **Keeps** · every route, link, field, handler and `data-testid` · every string except the copy-gate lines listed in each feature · the Screen's text floors and stage variants · `PLAYER_PALETTE` · the game logic (none of it moves)
- **Theme** · Squeeze, dealt 2/3 (forest-green felt, warm-white ink, Gabarito 800 figures over Manrope, rounded tiles, peach controls). Overprint (light newsprint, too bright on a TV in a dim room) and Werkstatt (static, and no fourth colour for players or game states) were passed over
- **Screen** · app screens throughout. Landing is the one page. The Screen is a stage variant (`design.md`)
- **Signature** · the room code. It is a four-tile Gabarito figure on Landing's join and set at statement size on the Screen lobby, and the phone's buzzer is the object a player holds
- **Chrome** · the app's own shell is kept (PageShell, AdminLayout, ScreenChrome). The marquee BulbRail goes everywhere
- **Material** · real: the 60 built-in sets and their categories and emoji, room codes, player names, avatars and colours, scores · pictures: none (no photographs; Squeeze's Range carries it: figures, tiles, rows) · absent: logos, quotes, metrics
- **Files** · edit: `client/src/index.css`, `client/src/lib/ui.ts`, `client/index.html` (theme-color), `client/public/favicon.svg`, `package.json` (fonts), and the components and pages each feature names · create: `client/src/tokens.css`, `client/src/base.css` (already scaffolded, not imported yet) · delete: `components/BulbRail.tsx` and `BulbRail.test.tsx` in F142, once nothing imports them (Kim to approve at F142)

## How each M31 feature runs

1. Read `design.md`, then this file's section for the feature. From the hallmark skill (`~/.claude/skills/hallmark`), read `references/redesign.md` § Build and § After, plus `references/flow.md` § App screens (or the page flow for F134).
2. Recompose inside the shell the screen already has. No logic moves, and no prop, `name`, `id`, `key`, `href` or `data-testid` that code or a test reads is renamed. A state the screen has no logic for goes to Backlog, never into code.
3. Before commit, with `npm run dev` running (and `GENERATE_FAKE=1` for admin), run `node ~/.claude/skills/hallmark/scripts/sloplint.mjs <changed files> --genre playful --scope app --render --kept --url http://localhost:5173/<route>`. Fix every FAIL and fix or waive every REFLEX in the `index.css` stamp. The render tier needs `puppeteer-core`, installed at `~/.cache/hallmark/pptr` and exported as `HALLMARK_PUPPETEER=~/.cache/hallmark/pptr/node_modules/puppeteer-core`. Never add it to `package.json`. If the variable is unset, run the static tier and say so in PROGRESS.
4. `buzzer:verify` green, then `/playtest` at the `README.md` device matrix. Phones are never worse than before.
5. Copy that a gate rewrites goes in the PROGRESS entry, before and after.

## Surfaces

| Feature | Surface | Target |
|---|---|---|
| F132 | System | Squeeze tokens on the existing Tailwind names. Gabarito and Manrope replace Bungee and DM Sans. `lib/ui.ts` classes rebuilt per `design.md` Controls. Looks reskinned, layouts unchanged |
| F133 | Floor sweep | Every static Floor finding in `.hallmark/before.txt` fixed app-wide: caps labels, glued arrows, literals, the width animation, field edges, 320px wrapping, selection and scrollbar |
| F134 | Landing, join | Page scope. First screen: a head of 7 words or fewer, one sentence and two actions. **Join** is the room code as four Gabarito tiles. **Host a game** is the peach primary. The two side-by-side cards go |
| F135 | Player phone | The join form as tiles (name field, avatar grid as choosable tiles that sink and ring). Lobby, buzzer states, choice and typed answers, reveal (answer on the warm-white card) and final. The buzzer: peach while open, buzz when you are first, paper-3 when locked |
| F136 | Screen lobby | The room code at statement size in Gabarito. The QR and join URL on the one warm-white card. Player chips as tiles with ink-ringed colour dots. The start gate. ScreenChrome without bulbs |
| F137 | Screen game | Question card, board (tiles that sink when used), buzz banner (buzz panel + word), flash (win, buzz), reveal, standings rail, scoreboard, results, host bar |
| F138 | Host remote | Phone and dashboard: pairing PIN, primary action (peach) and secondary row, players list as rows, settings, typed marking, read-aloud, board picker |
| F139 | Set library | /sets as a catalogue: category rows (emoji, name, an E/M/H level tile each) before cards. Search in Manrope. Pickers (CategoryPicker, GameBuilder, NewGamePicker, RoomCreated, HostGame) share it |
| F140 | Set editor, print | Editor toolbar, outline, question cards as tiles, paste and preview. The answer sheet prints card-ink on white with no eyebrow |
| F141 | Admin | Shell, list, overview tiles (figures in Gabarito, their own numbers only), category page, level review, generate, history |
| F142 | Sweep and handoff | `--kept` across every route, `compare.html`, the finish review, BulbRail removed, `00-foundations.md` updated, log entry |
