# 10 — Live review fixes (M33)

On 2026-11-17 the live site (https://buzzr.kimnejudne.dev, commit f209bdd) was reviewed after M32 by two agents: a UI/UX review against `design.md` and the Overprint mocks (headless puppeteer, sloplint `--render`), and a QA playtest of a full game in Chrome (Screen, a host remote paired by PIN, three players, /sets). The game loop passed end to end. All wording matched `client/src/lib/copy.ts` except one label (§ F159). There were no blockers. Kim put every finding on the roadmap.

Screenshots are local only, in `.playtest/review-2026-11-17/ux/` and `.playtest/review-2026-11-17/qa/` (gitignored). The sloplint reports are the `sloplint-*.txt` files in `ux/`. The line numbers below are from f209bdd; grep before trusting them.

"Confirmed" means it was reproduced live. "Plausible" means it was read from code or seen only once: reproduce it first, and if it does not reproduce, say so in PROGRESS and move on.

## How each M33 feature runs

1. Read `design.md`, then this file's section for the feature, then the screenshots it names. The M32 rules still hold (`09` § How each M32 feature runs): no logic moves unless the section says so, and no prop, `name`, `id`, `key`, `href` or `data-testid` that code or a test reads is renamed.
2. Reproduce each finding locally first (`npm run dev`), at the viewport given, with names of 10 and 16 characters where names matter (`PLAYER_NAME_MAX` is 16). Use `Bartholomew Quinn` (16) and `Ana Revilla` (10).
3. Before commit, run sloplint on the changed files with `--render --kept` against the routes they touch, as M32 did (`HALLMARK_PUPPETEER=~/.cache/hallmark/pptr/node_modules/puppeteer-core`).
4. `buzzer:verify` green, then `/playtest` at the viewports the section names plus the `docs/ux/README.md` matrix rows for that surface. Phones are never worse than before.
5. A new or changed string gets a `copy.ts` key with English and a drafted Taglish line. List both in PROGRESS for Kim to review.

## F153 — Screen names in full

- **Buzz banner** (confirmed, 1690×1185 and 1920×1080): "ANA REV…", "BARTHOLOME…" and "QA CHAR…" with about 100px of empty banner beside the name; worst with an "also buzzed" chip. `ScreenQuestion.tsx` BuzzResult, about lines 530–564 (`nameSize` steps down to 5.6cqw past 9 characters, `truncate`, also-buzzed column `max-w-[58%]`). Shots: `ux/g2-screen-buzzed-longname-1920.png`, `ux/crop-screen-2.png`, `qa/02-screen-buzz-banner-truncated.jpg`.
- **Standings rail** (confirmed, 1024×768 to 1920×1080): "Q…" once a score has 3 digits; two leaders both read "Q…". `StandingsRail.tsx:69` (rail width `w-[min(15vw,26.7vh)]` / `min(17vw,30.3vh)`) and `:105` (`truncate`). Shots: `qa/03-screen-standings-truncated.png`, `qa/04-screen-1920-standings-truncated.jpg`.
- **Final podium and full ranking** (confirmed): every podium label "QA…" / "Barthol…"; the ranking list too. At 1920×903 the 3rd-place score "100" is clipped at the bottom of the viewport. `ScreenResults.tsx:233` (`truncate`). Shots: `qa/05-screen-final-podium-truncated.jpg`, `ux/g2-screen-final-1920.png`, `ux/g2-screen-final-1024x768.png`.
- **Target:** any name up to 16 characters reads in full on the banner, rail, podium and ranking at 1280×720, 1920×1080 and 1920×903, from the sofa (the README's 5 m rule). Fit by size steps, two lines, or a wider rail; never an ellipsis at or under 16 characters. Nothing clips at the viewport's foot.

## F154 — Screen game details

- **"? Shortcuts" chip contrast** (confirmed, every phase): `text-ink/40` on paper-3 measures 2.42:1 at 17px. Needs at least 4.5:1. `ScreenHostControls.tsx:250`. Shot: `ux/crop-screen-2.png`.
- **Shortcuts chip covers buttons at 667×375** (confirmed; outside the Screen's matrix, polish): it sits over Pair host phone and Start game. Same file. Shot: `ux/g2-screen-lobby-667x375.png`.
- **Colour chip on its own colour** (confirmed): the red player's chip on the red buzz banner reads as a hollow ink square. Give the chip an ink ring or a paper gap so it shows on any pass. `ScreenQuestion.tsx`. Shot: `ux/crop-screen-2.png`. (The lobby half is in F155.)
- **Correct flash** (confirmed, transient, polish): about 120ms into the teal flash, "+100" is teal on teal, and standings rows overlap while they reorder. `ScreenFlash.tsx`, `StandingsRail.tsx`. Shot: `ux/g2-screen-flash-correct-1920.png`.
- **Typed reveal** (confirmed, polish): the winner chip shows "QA Alpha ✓" without the "+100" the buzz reveal shows. `ScreenQuestion.tsx`.

## F155 — Screen lobby fit

- **Join URL breaks inside the domain** (confirmed, 1024×768, 1280×800, 1440×900, 667×375): "buzzr.kimnejudne.d / ev/play/ZQDD". The mock breaks only at "/". The code puts `<wbr>` before "/" and ":" but also has `[overflow-wrap:anywhere]`, so the domain splits once the column narrows. Target: it breaks only at "/" at every matrix size; size the text down within the floors if needed. `Screen.tsx:481-493`. Shots: `ux/g2-screen-lobby-1440x900.png`, `ux/sheet-g2-lobby.png`.
- **`break-all` on the other join URLs** (plausible, minor): one line live at 1024–1920, but `break-all` would split mid-word on a narrower stage. Give them the same slash-only breaking. `ScreenChrome.tsx:56`, `RoomCreated.tsx:94`.
- **Orange players pass stretches** (confirmed, every size): about 730×480px of empty orange with 2 players. In the mock the pass is content height (`.tv-players` in an auto row). Target: content height, still capped by the column with the existing "+N more" for many players (check 5 and 20 players). `index.css` (`.lobby-stage` rows `auto minmax(0,1fr)`, `.lobby-players` in row 2). Shot: `ux/screen-lobby-2p-1920.png`.
- **Colour chip on its own colour** (confirmed): an orange player's chip on the orange pass reads as an empty ink square. Same fix as F154's. `Screen.tsx` PlayerChips. Shot: `ux/screen-lobby-2p-1920.png`.
- **Buttons jump when the control bar returns** (plausible, seen twice, 1690×1185): Start game and Pair host phone move up about 60px when the auto-hidden bar reappears on pointer move, so a click aimed at the button misses, and on a touch Screen the first tap always misses. Target: showing or hiding the bar never moves the lobby. `ScreenHostControls.tsx:91-97` and `:600-620` (shows on pointerdown/pointermove) with `onHeight` reflowing the lobby in `Screen.tsx`. Shot: `qa/01-screen-lobby-empty.jpg` (bar hidden, button at y≈863; with the bar it sat at y≈802).
- **Pairing dialog under the chrome bar** (plausible, 1690×1185, polish): the dialog's bottom edge (Hide) runs into or under the ScreenChrome bar. `PairHostPhone.tsx`.

## F156 — Settings type and states

`HostSettings.tsx` renders on the Screen lobby and the host remote.

- **Type roles** (confirmed by computed style): labels ("Presets", "Wrong-answer penalty") and the −/+ steppers are Archivo 700, which is not installed (only 400 and 600), so the browser fakes the bold. `design.md` Rules set labels in Archivo Narrow 600. Stepper values ("5 s", "0.5 s") are Anybody 800 at 100% width, not the figure style (900 at 150%). The host's "Settings ▾" control is set in Anybody 900, a control in the display face. Shot: `ux/screen-lobby-2p-1920.png`.
- **Chosen language button** (confirmed, 1920): the selected preset (ENGLISH) is `disabled:opacity-40` over the teal pass and reads faded. A chosen option should read as chosen, not unavailable: show it as selected (`aria-pressed`, flooded) at full contrast.

## F157 — Host remote fixes

- **Judge panel name cut** (confirmed, 375×667): "ANA REVI…" for a 10-character name, so the host judges without the full name. Target: 16 characters in full at 375. `PrimaryAction.tsx` or `HostGame.tsx`. Shot: `ux/host-remote-buzzed-375x667.png`.
- **END GAME contrast** (confirmed, all sizes): buzz-red text on paper at 4.03:1, 16px semibold, under 4.5:1. `design.md` Danger sets only the outline colour; keep the red outline and set the label in ink, or darken it to pass. `SecondaryActions.tsx` around line 26. Shot: `ux/host-remote-lobby-375x667.png`.
- **Gate 39b, oversized controls** (confirmed, 1440): sloplint flags the PIN input (68px) and Pair button (64px) on `/host`, and SIGN IN (64px) on `/admin`. The `index.css` stamp waives 39b only for the Join field and button, the room code and the phone answer tiles. Either size them per `design.md` Controls or extend the waiver with a one-line reason as the Join field has; say which in PROGRESS. `HostPinEntry.tsx:77`, `AdminLayout.tsx` or `Admin.tsx`. Shots: `ux/admin-login-1280x800.png`, `ux/sloplint-*.txt`.
- **Favicon refetched** (plausible, polish): the host tab requested `/favicon.svg` about 28 times in one session (resource timing). Probably the icon link is re-set on state changes. Find it; set the icon once, or only when it really changes.

## F158 — Phone lobby, join and Landing fit

- **Buzzer over "Who's here"** (confirmed, 375×568 and 375×540, touching at 375×600): the buzzer's base and its 14px ink-2 drop cross the 4px ink bar into the panel. Fine at 667. A real iPhone SE in Safari is about 548px tall. `Play.tsx` around lines 870 and 945 (buzzer `min(290px,78vw,40dvh)` and `shrink-0`; WhosHere `max-h-[24dvh] shrink-0`); `.lit-buzzer`'s box-shadow drop is outside layout in `index.css`. Target: clear at 375×540 up, the drop counted in the layout. Shots: `ux/play-lobby-375x568.png`, `ux/play-lobby-375x540.png`, `ux/sheet-lead-a.png`.
- **Join button below the fold** (confirmed, 375×667): the 25-tile avatar grid pushes JOIN off the first screen (Enter still submits). Target: JOIN on the first screen at 375×667 with the keyboard closed. `Play.tsx` NameForm. Shot: `ux/play-join-375x667.png`.
- **Room code tracking** (confirmed, polish): "JOIN ROOM B F Z F" tracks the code at 0.15em, so it reads as spaced letters. `Play.tsx:243`.
- **Landing on a landscape phone** (confirmed, 667×375): only the join field shows; Host a game and Question sets are below the fold. Target: both fields reachable without hunting (side by side, or the host field visible at the fold). `Landing.tsx`. Shot: `ux/landing-667x375.png`.

## F159 — Phone game polish

- **Top-bar type** (confirmed by computed style, 375–390): the score figure is Anybody 400, the avatar initial Anybody 400 at 100% width, the rank "1st" Anybody 600. `design.md` Rules and the mock (`.score`, `.avatar`) set figures at Anybody 900, wide. `Play.tsx` top bar, about lines 650–690. Shot: `ux/sheet-buzzer-states.png`.
- **Negative score** (confirmed, 375×667): "-100" widens the score box, so the name cuts to "Ana Revi…" and "Room BFZF" wraps onto two lines. Target: one line each, with -999 and a 16-character name at 375. Shot: `ux/play-out-A.png`.
- **Idle copy invites a false start** (confirmed, 390×844, Competitive): "Get ready…" sits over "Tap to buzz in" while the buzzer is drained and a press counts as a false start. Target: the idle line does not tell the player to tap (for example "Wait for buzzers to open"), and "Tap to buzz in" shows only when live. Taglish drafted. `Play.tsx`, `lib/buzzerState.ts`, `lib/copy.ts`. Shot: `ux/play-idle-390x844.png`.
- **Reveal without its word** (confirmed, 375 and 390): a buzzer correct shows "Answer JUPITER +100" on teal with no "Correct", and a wrong shows "-100" in red with no "Wrong". `design.md` Rules: "Game states each come with their word." Use the existing Correct/Wrong copy keys if they exist. Shot: `ux/play-reveal-375x667.png`.
- **Buzzer drawn at reveal** (confirmed): a large drained buzzer sits under the answer card, but the `09` table's `revealed` row shows none. `BUZZER_LOOK.revealed` draws one; make it `null`, as `choice` and `typed` are. `lib/buzzerLook.ts`, `lib/buzzerState.ts` (REVEAL). Shot: `ux/sheet-g2-phone.png`.
- **Taglish "Cancel"** (confirmed): Menu → Leave game in Taglish shows "Sigurado, aalis na" next to "Cancel" in English. Expected the `cancel` copy key ("Huwag na"). `ConfirmButton.tsx:66` hard-codes `Cancel`; it is used from `Play.tsx:711` and elsewhere. Pass the label in (or read the language) so every caller gets the right language, English unchanged.

## F160 — Meta lines and picker details

- **Two-dot meta line** (confirmed, 375×667; gate 63 is a Floor): the /sets Preview dialog reads "Animals · 15 questions · Easy", which also echoes the heading "ANIMALS – EASY" (gate 69). The mocks use no middle dots. Target: no line joins more than two items with a dot, and the preview drops what its heading already says. `SetPreview.tsx:63`. Shot: `ux/sets-preview-375x667.png`.
- **More multi-dot strings** (plausible, read from code): My sets rows "15 questions · Easy · Last edited …" (`Sets.tsx:709`), `PasteQuestions.tsx:76` ("· answer · pts"), the TV's list below the podium (`ScreenResults.tsx:133`), `AdminHistory.tsx:125` and `lib/adminFilters.ts:113` (up to three each), SetPicker chips joined with dots (`SetPicker.tsx:104`). Same target. One-dot captions ("Who's here · 2", "ZQDD · 2 players", "online · 74 ms") fit at 375 and gate 63 allows them; leave them.
- **Picker underline and dashes** (confirmed, 1280, polish): the host picker underlines "Preview" and "questions" separately, and uses dashed borders that `design.md` does not name. Shot: `ux/landing-host-1280.png`.
- **Pairing QR plate** (confirmed, polish): the pairing dialog's QR sits on a pure-white plate, while the lobby QR is transparent on stock. Match the lobby. `PairHostPhone.tsx`. Shot: `ux/crop-pairing.png`.

## F161 — Final results survive a leave

QA (confirmed): when the winner used Leave game in FINAL, they vanished from the Screen's podium and every phone re-ranked ("1st sa 2"). This follows DECISIONS F61 ("`player:leave` works in every phase … through `withoutPlayer`"), but it rewrites the result on the TV.

Kim chose on 2026-11-17: **freeze the results.** In FINAL, `player:leave` detaches the device as F61 does (the socket leaves the player and room Socket.IO rooms and is unjoined), but the player stays in the room's players with their score, so the podium, full ranking, phones' "1st of 3" and the remote's Game over standings do not change. Every other phase keeps F61's removal. Add a DECISIONS row that supersedes F61 for FINAL only. `server/reducer.ts:433-438` (`playerLeave` → `withoutPlayer`). Use the `add-game-action` skill's checklist for the changed action.

## F162 — Live review sweep

- Re-run the review's checks on the local build: sloplint `--render --kept` on every route; the matrix in `docs/ux/README.md` plus 375×540 for the phone lobby; names of 16 characters on every Screen and host surface; Taglish on every phone state.
- **Docs mismatch** (confirmed, polish): `.hallmark/mocks/overprint/buzzers.html` variant E moves the cap −12/−9/−2px, while `design.md`, `index.html` and the code use 14/11/2. Make the mock match `design.md`.
- Record what was fixed, waived or sent to Backlog, by finding, in PROGRESS.
