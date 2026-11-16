# 09 — Overprint redesign (M32)

A second full Hallmark redesign, planned 2026-11-16 with `/hallmark redesign buzzer/client`. It replaces M31's Squeeze with Overprint. **Kim's calls:** deal three themes, mock Landing, the Screen lobby and the phone buzzer in each, then pick. Kim picked Overprint, and asked for the phone buzzer to be a red, round, 3D game-show buzzer. Of six builds Kim picked E, Lit. The locked system is `design.md` at the project root: read it first. This file holds the read, the picks, the buzzer's states and what each feature changes. Every rule in `00-foundations.md` still holds except its look: the breakpoints, the variants, the floors and the device matrix.

## The mocks

Static HTML in `.hallmark/mocks/`. Rebuild with `.hallmark/mocks/build.sh`, which inlines the real join QR into each `index.src.html`. Serve the folder over HTTP to view: Chrome's extension can't open `file://`.

- `overprint/index.html`: the approved Landing, Screen lobby (host's laptop, folded settings) and phone buzzer (buzzers open). These are the visual targets for F144, F146 and F145.
- `overprint/buzzers.html`: the six buzzer builds. **E, Lit** is the pick. The others stay as the record.
- `werkstatt/` and `pasteup/`: the two themes not picked.

## The read (before)

The app as M31 left it: Squeeze, forest-green felt, Gabarito over Manrope, rounded peach controls. M31's sweep ended at 0 FAIL and 0 REFLEX (`.hallmark/log.json`). F143 records it afresh with `sloplint --before` so `--kept` has a current record of the wiring.

- **For:** running a quiz night on a TV, with phones as buzzers. The one action is to join (a player) or to host (the laptop).
- **Works and stays:** the room code as four tiles on Landing. The Screen's statement-size code and QR. The single-button start gate. A buzzer that never moves between states. Every route, handler and test hook.
- **Why change:** Kim's pick. The mocks were judged side by side, and Overprint won.

## Picks

- **Redesign** · full · the same 11 routes as M31 (/, /play, /screen, /host, /sets, /sets/:id, /sets/:id/print, /admin and 4 sub-routes, /admin/sets/:id)
- **Keeps** · every route, link, field, handler and `data-testid` · every string except the copy-gate lines each feature lists · the Screen's text floors and stage variants · `PLAYER_PALETTE` · the game logic (none of it moves) · category and avatar emoji, which are content (M31)
- **Theme** · Overprint, dealt 1/3, newsprint stock (grey stock, near-black ink, wide Anybody capitals over Archivo, teal and orange passes printing moss where they cross). Werkstatt (the three primaries coding the TV, phones and host) and Paste-up (kraft, League Gothic, a fluorescent sheet) were mocked and passed over
- **Signature** · the room code printed on the teal pass, with the players' orange pass crossing it in moss · the red Lit buzzer on the phone
- **Chrome** · the app's own shells are kept (PageShell, AdminLayout, ScreenChrome)
- **Material** · real: the built-in sets with their categories and emoji, room codes, player names, avatars and colours, scores · pictures: none (Overprint's Range carries it: figures as a bill, ruled tables, ink bands) · absent: logos, quotes, metrics
- **Files** · edit: `client/src/tokens.css`, `client/src/base.css`, `client/src/index.css` (stamp and `@theme`), `client/src/lib/ui.ts`, `client/src/main.tsx` (font imports), `client/index.html` (`theme-color`, `color-scheme`), `client/public/favicon.svg`, `package.json` (Kim: fonts), and the components and pages each feature names · create: none · delete: none. Kim uninstalls the Gabarito and Manrope packages in F143b

## The buzzer (variant E, Lit)

One button that never moves (`Play.tsx`, `BUZZER_LOOK` by `BuzzerKind`): a round ink base, a red wall, a red dome cap and a bulb inside the cap. Only the cap translates and only the bulb's opacity animates. The label above it and the word for each state are unchanged (`lib/buzzerState.ts`, `lib/copy.ts`).

| Kind | Cap | Bulb | Else |
|---|---|---|---|
| `practice` (lobby test) | up, presses | off; flares once on `fx practice` | red |
| `idle` (Get ready…) | down | off | drained: grayscale 0.8. A false-start press is still taken when `live` |
| `live` (Buzzers open!) | up | breathes 0.3 to 0.85 | red |
| `pressed` | down | 1 | red |
| `won` (You're first!) | down | 1, steady | the answer countdown as an Anybody figure under it |
| `early` (Too early!) | down | off | a 6px orange-pass ring (warn) around the base |
| `lost` (… buzzed first) | up | off | brightness 0.8 |
| `out` (Locked out) | down | off | drained, a 6px ink X over the cap's face |
| `choice`, `typed` | — | — | the choice tiles or text box replace it, as now |
| `revealed`, `final` | — | — | the answer on the paper surface (paper-2 under the ink bar), as now |

Under reduced motion the cap snaps and the bulb holds at 0.6 while live. Haptics are unchanged.

## How each M32 feature runs

1. Read `design.md`, then this file's section for the feature, then the mock it names. From the hallmark skill (`~/.claude/skills/hallmark`), read `references/redesign.md` § Build and § After, plus `references/flow.md` § App screens (or the page flow for F144) and `references/themes/overprint.md`.
2. Recompose inside the shell the screen already has. No logic moves. No prop, `name`, `id`, `key`, `href` or `data-testid` that code or a test reads is renamed. A state the screen has no logic for goes to Backlog, never into code.
3. Before commit, with `npm run dev` running (and `GENERATE_FAKE=1` for admin), run `node ~/.claude/skills/hallmark/scripts/sloplint.mjs <changed files> --genre playful --scope app --render --kept --url http://localhost:5173/<route>`. Fix every FAIL. Fix or waive every REFLEX in the `index.css` stamp. The render tier needs `puppeteer-core` at `~/.cache/hallmark/pptr`, exported as `HALLMARK_PUPPETEER=~/.cache/hallmark/pptr/node_modules/puppeteer-core`. Never add it to `package.json`. If the variable is unset, run the static tier and say so in PROGRESS.
4. `buzzer:verify` green, then `/playtest` at the `docs/ux/README.md` device matrix. Phones are never worse than before.
5. Copy that a gate rewrites goes in the PROGRESS entry, before and after.

## Surfaces

| Feature | Surface | Target |
|---|---|---|
| F143 | System | `--before` record of every route. Overprint tokens on the existing Tailwind names. `lib/ui.ts` classes rebuilt per `design.md` Controls. `color-scheme: light`, `theme-color`, favicon. Looks reskinned, layouts unchanged |
| F143b | Fonts | Kim installs the packages. `main.tsx` imports Anybody (width axis), Archivo 400/600 and Archivo Narrow 600 |
| F144 | Landing, join | As the mock: BUZZR wide at statement size, the sentence, then the join field (teal pass: the four code tiles and Join) and the host field (orange pass: Host a game outlined, Question sets) crossing in moss over two columns. The host picker and its created room stay in their slot |
| F145 | Player phone | The join form (name field, avatar tiles square with a 2px ink ring when chosen). The Lit buzzer and every state in § The buzzer. Top bar as the mock: avatar square with the colour chip, name, Room code, score boxed in ink, Menu. Choice and typed answers, reveal, final |
| F146 | Screen lobby | As the mock: the set title under an ink bar, the code on the teal pass, the QR and Join at on stock under an ink bar, the players on the orange pass as ruled rows, the moss below the QR column. Host controls bottom left. The start gate. ScreenChrome |
| F147 | Screen game | Question card, board (tiles flood a pass when used), buzz banner (red with its word), flash (win teal, buzz red), reveal on the paper surface, standings as a ruled table, scoreboard as a bill, results, host bar |
| F148 | Host remote | Phone and dashboard: pairing PIN as an Anybody figure, the primary ink block and a secondary row, players as ruled rows, settings, typed marking, read-aloud, board picker |
| F149 | Set library | /sets as a ruled listing under the ink bar: category rows with their E/M/H level cells (a chosen level floods teal). Pickers (CategoryPicker, GameBuilder, NewGamePicker, RoomCreated, HostGame) share it |
| F150 | Set editor, print | Editor toolbar, outline, question rows under rules, paste and preview. The answer sheet prints ink on white |
| F151 | Admin | Shell, list, overview figures (Anybody, their own numbers only), category page, level review, generate, history |
| F152 | Sweep and handoff | `--kept` across every route, `compare.html`, the finish review, `00-foundations.md` updated, the log entry |

## Open (Kim, before launching M32)

1. **The Screen's stock.** M31 passed over Overprint because light newsprint can glare on a TV in a dim room (DECISIONS M31). The mock is newsprint. Overprint's own alternative is black stock: ground `oklch(20% 0.01 280)`, ink `oklch(95% 0.01 90)`, the blend flipped to `screen`, passes in yellow `oklch(88% 0.17 95)` and aqua `oklch(78% 0.13 200)`. **Default if unanswered:** newsprint everywhere, as mocked.
2. **Emoji avatars.** Hallmark's Floor reads an emoji as an icon. M31 dismissed that, since avatars are content the players pick, and the mocks show the initial fallback only. **Default:** keep the emoji avatars as content.
3. **The status line.** `questionOf` plus `tapToBuzzIn` joins with a middle dot ("Question 3 of 12 · tap to buzz in"), which gate 63 names. **Default:** two lines, "Question 3 of 12" over "Tap to buzz in", as the mock does, with the Taglish strings split the same way.
