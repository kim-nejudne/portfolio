# Roadmap

Status: [ ] todo · [~] in progress · [x] done · [!] blocked (see note)

Change markers with `node .claude/scripts/roadmap.mjs mark`. A done item collapses to one line; its details are in PROGRESS.md and git history. Each `Spec:` line cites headings of `docs/spec.md` in `spec.mjs` form: `Heading (Subheading, Subheading)`.

M1 is the **thinnest playable version**: at the end of it a real group can play one full cycle on a laptop Screen and their phones, with one pen colour, a hard-coded word list and exact-match guesses. Every later milestone makes it fairer, safer, prettier or sturdier, and the game stays playable after every feature. The **Barkada night release** after M9 is the version Kim brings to a real barkada night.

## M1 — Thin slice

- [x] F01 Project skeleton and tooling

- [x] F02 Shared types, schemas and constants

- [x] F03 Rooms, codes and RoomStore

- [x] F04 Reducer v0: lobby and a basic turn

- [x] F05 Views and socket gateway

- [x] F06 Ink relay v0

- [x] F07 Screen page v0

- [x] F08 Player page v0

- [x] F09 Dev tool: fake players

## M2 — Fair and secret

- [x] F10 Secrecy leak tests

- [x] F11 Ink codec and action stack

- [x] F12 Ink sequence, resend and snapshots

- [x] F13 Latency-corrected scoring

- [x] F14 Guess matching

- [x] F15 Near-miss feedback and the guess feed

- [x] F16 Ink delay debug overlay

## M3 — Game shape

- [x] F17 Word packs and loader

- [x] F18 Deck and word choice

- [x] F19 Hints and early end

- [x] F20 Cycles, scoreboard and final

- [x] F21 Overlapped choosing

- [x] F22 Settings and presets

- [x] F23 Late join and turn order

## M4 — Host and onboarding

- [x] F24 Screen host controls and shortcuts

- [x] F25 Host crown and the host lobby

- [x] F26 How to play and first-turn captions

- [x] F27 Lobby doodles

- [x] F28 Pause, skip, kick and end

- [x] F29 Rematch, back to lobby and the night's totals

## M5 — Drawing tools

- [x] F30 Colours, sizes and eraser

- [x] F31 Undo and clear

- [x] F32 Draw pad hardening

## M6 — Screen and phone polish

- [x] F33 Responsive Screen layouts

- [x] F34 Announcements, reactions and feed UI

- [x] F35 The reveal

- [x] F36 Drawer feedback

- [x] F37 QR, tap-to-start, wake lock and connection dot

- [x] F38 Sounds

- [x] F39 Join budget

## M7 — Resilience

- [x] F40 Drawer away

- [x] F41 Screen away and too few players

- [x] F42 Rejoin by name from another phone

- [x] F43 Reconnect every role

- [x] F44 Rate limits and limits

## M8 — Language and content

- [x] F45 Taglish copy

- [x] F46 Full family word packs

- [x] F47 Spicy pack

- [x] F48 Custom words

## M9 — Gallery and awards

- [x] F49 Gallery on the Screen

- [x] F50 Tonight's awards

## Barkada night release

The first real barkada night needs everything in M1–M9. The review's must-haves for that night: private guessing (F08, F10, F15, F18, F26), the frozen-drawer fixes (F18, F36), onboarding and lobby doodles (F26, F27), the host lobby (F25), the shorter game (F21, F22), the drawer layout (F08, F32), the reveal (F35), no running ranks (F20, F34), awards (F50), rejoin by name (F42), plus the gallery, custom words, the spicy pack, phone and tablet Screens and sounds. Play it on the LAN, or on the deployed URL after M10.

## M10 — Deploy

- [x] F51 Docker image and smoke test

- [x] F52 Deploy to sketchy.kimnejudne.dev

## M11 — Avatars

- [x] F53 Emoji avatars

- [x] F54 Change avatar in the lobby

- [x] F55 Lobby doodle stays on the phone

## M12 — Sketchbook look

The light spiral-sketchbook restyle of every page, phones first. Build reference: `docs/design/SKETCHBOOK.md`. Target mockup: `docs/design/sketchbook.html` (the hash picks the phase, e.g. `#sketch-drawing`; `O` toggles a portrait Screen). Visual change only: no invariant, game rule or timing changes. Every M12 entry also needs:
- the look and layout of `sketchbook.html` for its surfaces, with app data and spec rules winning where they differ;
- only F56 tokens in the files it touches, with no `#1D1B22`, `#FF6B35`, `#FFD166` or `white/NN` classes left;
- no overflow at the viewports it names;
- `/playtest` screenshots compared with the mockup;
- a `mobile-ux-reviewer` run.

- [x] F56 Sketchbook foundation

- [x] F57 Sketchbook landing and join form

- [x] F58 Sketchbook phone shell and lobby

- [x] F59 Sketchbook drawer phone

- [x] F60 Sketchbook guesser phone

- [x] F61 Sketchbook phone results and overlays

- [x] F62 Sketchbook Screen frame and lobby

- [x] F63 Sketchbook Screen host UI

- [x] F64 Sketchbook Screen turn, landscape

- [x] F65 Sketchbook Screen portrait and reveal

- [x] F66 Sketchbook Screen scoreboard and final

- [x] F67 Sketchbook cleanup

## M13 — English only

Sketchy goes international: flat English only, per DECISIONS 91. The Taglish copy table, the `tl` packs, the `words` and `copy` settings, `gloss`, the Tagalog filler words, Tagalog alternates and the Tagalog blocklist entries all go, with no i18n plumbing left for another language. UI spelling is US; word alternates accept US and UK spellings. Buzzr is out of scope. No game rule, timing or invariant changes beyond removing language. Every M13 entry also needs:
- `/verify` green and `npm run packs:check` green;
- the English-only guard test green once F70 adds it;
- no Filipino text added anywhere in `client/`, `server/`, `shared/`, `data/` or `scripts/`.

F68 is run attended: Kim reviews and applies its spec patch before launching autopilot for F69 onwards. F73 stays blocked until Kim approves the spicy draft from F72.

- [x] F68 English-only spec patch

- [x] F69 English-only settings and copy

- [x] F70 Remove Filipino words and Tagalog code paths

- [x] F71 Global English word packs

- [x] F72 English spicy draft

- [x] F73 English spicy pack

- [x] F74 English-only docs and cleanup

## M14 — Admin and categories

Kim adds a password-protected admin at `/admin` for word **categories**, per DECISIONS 100. Packs become categories in a writable store on a new data volume, every one editable. The host picks categories in the lobby, which replaces the Spicy toggle, and guessers see the current word's category. An LLM (Claude API) drafts a category's words from its title. The landing tagline changes too. This reverses the spec's "no admin UI for word packs", "no database" and "no paid services" lines, and DECISIONS 73's "no volume". Every M14 entry also needs:
- `/verify` green, `npm run packs:check` green on the seed packs, and `npm run size` within budget (`/admin` is a lazy route, so the join budget doesn't move);
- the secrets-fairness-reviewer on any change to `server/`, `shared/` or views: no word, alternate or choice reaches a Screen or guesser payload before REVEAL, and LLM drafts and admin data never reach rooms or sockets;
- admin secrets (setup code, password, hash, session token, API key) never logged or sent to a client.

F75 runs attended: Kim reviews and applies its spec patch before launching autopilot for F76 onwards. Kim supplies `SKETCHY_ANTHROPIC_API_KEY` in `/opt/sketchy/.env` before F83 can be checked on live.

- [x] F75 Admin and categories spec patch

- [x] F76 Landing tagline

- [x] F77 Data volume and category store

- [ ] F78 Lobby category picker
  - Spec: Settings; Words (Word selection); Host controls; Data model (Room state, Role views)
  - Depends: F77
  - Done when:
    - `settings.spicy` is gone from `shared/` types, constants and schemas, the reducer, the views and the UI. An old client's `spicy` is accepted and dropped, as F69 did for `copy` and `words` (DECISIONS 93). New setting `categories: string[]` (category ids), lobby only.
    - The lobby view lists the visible (non-hidden) categories as `{id, title, emoji, wordCount, defaultOn}`, read from the store at snapshot time. A new room's `categories` is the `defaultOn` set. Ids of deleted or hidden categories are dropped when the game starts.
    - On Start the room takes a frozen snapshot of the chosen categories' words, so admin edits apply from the next game. The reducer stays pure: the snapshot is passed in with the action, not read inside it.
    - `allowedWords` builds the deck from the chosen categories plus custom words, deduped by normalised word (`server/match.ts` normalisation), keeping the first category in title order. `difficulty: 'easy'` still keeps level 1 only. `notEnoughWords` still refuses a Start with fewer than 3 words. A Start with no category and no custom words is refused with a clear message.
    - The Screen settings sheet and the crown phone's settings show category chips (emoji and title, tick to toggle, word count). The settings summary names the count ("5 categories"). The host's last pick is remembered on that device (`client/src/lib/hostKeys.ts` / `settings.ts`, localStorage, wrapped in try/catch), ignoring ids that no longer exist. Presets don't change categories.
  - Tests: schema strips `spicy`; deck dedupe across two categories; frozen snapshot unaffected by a later store edit; empty selection refused; default from `defaultOn`; reducer purity unchanged.

- [ ] F79 Category chip during the turn
  - Spec: UI by role and phase (Screen, Drawer phone, Guesser phone); Data model (Role views)
  - Depends: F78
  - Done when:
    - Each dealt word carries `categoryId` (custom words carry none). From CHOOSING's end through REVEAL, every role's view has the current word's category `{title, emoji}`, or "Custom" for a custom word. It is never in a view before the word is chosen, and never carries the word, an alternate, or the other choices' categories.
    - The Screen (landscape and portrait) and guesser phones show it as a chip by the hint blanks, and the drawer's phone by the word. It fits at 320 px and in portrait without pushing the blanks off one line.
  - Tests: `views` tests for each role and phase (no category before the choice, none from unchosen choices); a component test for the chip; a playtest with a Screen and 3 phones.

- [ ] F80 Admin auth and shell
  - Spec: Realtime events and HTTP API (HTTP); Reconnects, security and edge cases (Security); Ported from Buzzr
  - Depends: F77
  - Done when:
    - Env: `SKETCHY_ADMIN_SETUP_CODE` (from `/opt/sketchy/.env`, passed through compose as `${SKETCHY_ADMIN_SETUP_CODE:-}`). The password hash is read from `DATA_DIR/admin.env` (`ADMIN_PASSWORD_HASH=scrypt$N$r$p$salt$hash`) at start, ported from Buzzr's `parseAdminPasswordHash` (`../buzzer/server/env.ts`) and `verifyAdminPassword` (`../buzzer/server/admin.ts`) with `node:crypto` scrypt.
    - `GET /api/admin/status` returns `{configured, passwordSet, signedIn}`. With no setup code and no hash, every other `/api/admin` route returns 404 and `/admin` says "Admin not configured".
    - `POST /api/admin/setup` takes `{setupCode, password}` and works only while no hash is set. `POST /api/admin/reset` takes `{setupCode, password}` and works whenever a setup code is configured. Both check the code in constant time, need a password of at least 12 characters, write `admin.env` atomically, update the in-memory hash, and sign out every other session. `POST /api/admin/login` takes `{password}`; `POST /api/admin/logout` ends the session.
    - Sessions: in-memory, 12 h, token hashed with SHA-256 (Buzzr's `AdminSessions`). Cookie `sketchy_admin`: httpOnly, `sameSite: 'strict'`, path `/api/admin`, `secure: req.secure`. A restart signs the admin out.
    - Write routes need `Origin` equal to the host and a JSON body (Buzzr's `requireWrite`). Setup, reset and login are rate limited together at 5/min per IP (`server/rateLimit.ts`). Every body is zod-validated.
    - Deleting the `ADMIN_PASSWORD_HASH` line from `admin.env` and restarting returns `/admin` to setup mode.
    - Client: lazy `/admin` route in `client/src/App.tsx` (custom router, DECISIONS 61) and `client/src/pages/admin/` with setup, login, "Forgot password" (reset) and a signed-in shell with Sign out, in the sketchbook look, desktop-first, single column at 375 px. Nothing in it is imported by `/` or `/play`.
  - Tests: setup only once; reset with a wrong code refused; constant-time compare; rate limit; cookie flags; CSRF guard; `admin.env` round trip; 404 when not configured; bundle test proves `/admin` stays out of the join chunks.

- [ ] F81 Admin category and word editor
  - Spec: Words (Word pack format); Ported from Buzzr
  - Depends: F80
  - Done when:
    - `/api/admin/categories` routes (signed in, write guard): list, create, rename, set emoji, `defaultOn` and `hidden`, delete (confirmed in the UI), and add, edit and delete words (word, level easy/medium/hard defaulting to medium, up to 6 alternates). Every write goes through the store's validation, and errors name the field.
    - Bulk paste: one word per line, `word | level | alt, alt` with level and alternates optional. Bad lines are listed with the reason and the good ones are added. Duplicates within a category are skipped and counted; duplicates across categories are allowed (DECISIONS 100).
    - The admin page lists categories (emoji, title, word count, hidden and default-on badges) and opens one to edit its words. A word filter is shown once a category has 20 or more words.
    - Edits show in the next lobby snapshot and apply to games started afterwards (F78).
  - Tests: route tests for each action and its validation errors; bulk-paste parser; a playtest that creates a category, picks it in a lobby and gets one of its words.

- [ ] F82 Export and import JSON
  - Spec: Words (Word pack format)
  - Depends: F81
  - Done when:
    - Export downloads one category as pack-format JSON (`sketchy-category-<id>.json`); there is also an "Export all" download.
    - Import takes a pack-format file (a repo pack too, with `rating` ignored) and creates a category. An id clash asks to rename or replace. Invalid files are refused with the store's error messages, nothing written.
    - Import bodies are capped at 256 KB.
  - Tests: export then import round trip; a repo pack imports; invalid and oversized files refused.

- [ ] F83 LLM word generation
  - Spec: Ported from Buzzr; Words (Word pack format)
  - Depends: F81
  - Done when:
    - New dependency `@anthropic-ai/sdk`, justified: the only way to call the Claude API from the server. `SKETCHY_ANTHROPIC_API_KEY` is passed through compose (`${SKETCHY_ANTHROPIC_API_KEY:-}`) and only that variable is read. Generation is off, with the button explaining why, when it is unset.
    - Ported and adapted from `../buzzer/server/generate/` (copy, never import): a `claude-sonnet-5-5` writer drafts N words (10–100, default 40) with level, alternates and an emoji for the category title; a `claude-haiku-5-5` checker drops words that are hard to draw, obscure, need letters or numbers to draw, or are another word's alternate. Server validation (pack rules) runs last. A fake generator is used in dev without a key and in tests.
    - Flow: title and N, then a background job, then a **draft** the admin reviews (untick, edit word, level and alternates, change the emoji), then Save creates the category (hidden until unhidden, so it is checked first). "Generate more" on a category drafts N new words that avoid its current words and adds the kept ones.
    - Drafts live in memory and are gone after a restart. They never reach rooms, sockets or logs.
  - Tests: writer and checker against the fake client (the parse, a bad reply, a timeout, a refusal); draft review then save; top-up excludes existing words; generation off without a key.

- [ ] F84 Generation spend and cap
  - Spec: Ported from Buzzr
  - Depends: F83
  - Done when:
    - Each request's usage is priced (Buzzr `pricing.ts`, unknown models at the dearest known price) and logged to `DATA_DIR/generation-history.json` (title, N, words kept, cost, time), written atomically.
    - The admin shows spend tiles (this month, all time, last generation) and the history list.
    - `SKETCHY_GENERATION_CAP_USD` (default 5 when unset, passed through compose) caps spend per UTC calendar month. A generation that would start past the cap is refused with the month's spend and the cap shown.
  - Tests: pricing, month rollover in UTC, cap refusal, history persistence across a restart.

- [ ] F85 Admin and categories docs and cleanup
  - Spec: Overview; Build roadmap; Test plan
  - Depends: F76–F84
  - Done when:
    - `README.md`, `CASE-STUDY.md` and the local `CLAUDE.md` describe the admin, categories, the data volume, the env vars (`SKETCHY_ADMIN_SETUP_CODE`, `SKETCHY_ANTHROPIC_API_KEY`, `SKETCHY_GENERATION_CAP_USD`, `DATA_DIR`) and the reset steps, and drop "no database" and "no paid services".
    - README commands append to `/opt/sketchy/.env` as `deploy` (`printf … | runuser -u deploy -- tee -a /opt/sketchy/.env`), since root `>>` fails there.
    - Kim checks queued: set the password on live with the setup code, sign out and in, reset with the setup code, add the API key, generate a category and play a game with it on real phones, untick Spicy and see no spicy word.
  - Tests: none beyond `/verify`

## Bugs

- [x] B01 Pointer cursor and hover on live controls

## Backlog

- Screen host bar in portrait: at 810 px wide its 7 buttons wrap to two rows and, while shown (3 s after a mouse move), cover the foot of the final's gallery captions (F63; seen in the F67 playtest). Smaller buttons or one scrolling row when upright.
- Dark sketchbook (black page, white gel pen, fluoro highlighter) for dim rooms, as in the 2026-10-31 mockups (M12 is light only).
- Reactions on the phone at the reveal (the server already takes them from anyone in REVEAL; F34 offers them only after a correct guess in DRAWING).
- Screen turn effects: re-measure chips on a resize or layout flip while a bubble or reaction is up, and measure a bubble's height instead of estimating it (F34 mobile-ux nits).
- Portrait "got it!" hides the blanks for its 2 s; on a turn where many guess right in a row, consider a second top-bar line or a shorter 1 s announcement (F34 mobile-ux nit).
- Server-wide cap on live rooms (503 past it), so many addresses creating rooms can't grow memory for 3 h each (F03 review).
- PNG download of a gallery drawing: 1024 × 1024 plus a caption band "slippers · by Mika · Sketchy", saved as `sketchy-<code>-<nn>-<word>.png` (deferred by the spec review: people photograph the TV).
- `drawer:choose` with an optional `turnId`, refused when it doesn't match the open choice, so a late duplicate tap from one CHOOSING can't pick the next `upcoming` deal when the sole connected player draws back-to-back (F21 review).
- The next drawer's phone: a one-line "It was {word}" strip above the "You draw next!" cards, and focus moved to the cards' heading on mount and to the "Get ready" line after a tap (F21 review).
- A per-socket rate limit on `host:settings` (host-only and a cheap merge, but each one broadcasts every view) (F22 review).
- A permanently mounted `role="status"` region on the Screen and phone for the pause reason, so "Paused" is announced reliably rather than mounting with its text; and a way out (Leave) for a guesser stuck in a long `drawerAway`/`fewPlayers` pause (F28 review).
- Screen: dim the Tonight rows of players who have left; on a 4:3 Screen the host bar wraps to two rows and covers the Tonight strip until it auto-hides; the rematch countdown should use the same permanently mounted status region as "Paused" (F29 review).
- Per-socket cap on all `player:*` events in the gateway, so refused actions (empty guesses, `alreadyGuessed`) can't be spammed at the reducer's clone cost (F14 review).
- Case study and the kimnejudne.dev hub link, after the Barkada night (as Buzzr: live first, listed on the hub once its case study is written).
- Drawer ink after a refused batch (`inkFull`, an unrecovered `rateLimited`): the pad keeps a stroke the server lacks, so a later Undo pops different strokes on the pad and the Screen. Disable the tools, or rebuild the pad from a fresh snapshot, on such a refusal (F30 review).
- Drawer phone: announce the new brush size in a live region after a tap (F30 review; the pinch-zoom lock on the bars landed in F32).
- Ask to turn upright on the other phone views too (guesser, lobby, choosing); F32 covers the drawer's pad only (DECISIONS 54).
- Screen layout hysteresis: switch to portrait at 0.85 but back to landscape only above about 0.9, so a mobile browser's bar resizing a Screen near 0.85 can't flip it back and forth (F33 review).
- Screen sidebar and strip: give the ✏️ and ✓ marks an accessible label (`role="img"`, "drawing" / "got it"), and check the lighter player colours at `opacity-60` for a disconnected player still reach 4.5:1 (F33 review).
- Standings: drive the Tonight panel's beside/under switch from the Screen's `layout` instead of its own 16:10 media query; today a 1180×820 Screen puts it under the scores (it fits, checked by `.playtest/F33`) (F33 review).
- Connection dot: a second cue besides colour for amber and red (a ring or a glyph), for colour-blind players (F37 review).
- Lobby QR: a larger code on wide Screens (about 34 vmin) if the F37 Kim check finds 24 vmin too small to scan from the sofa; it needs a lobby layout that doesn't push ten players off a 1080p Screen (F37 review, DECISIONS 59).
- Plain (no-token) Screens: an `M` key and a sound button, so a second Screen in the room can be quieted on its own (F38, DECISIONS 60).
- Display font swap: a metric-matched fallback `@font-face` (`local('Roboto')`/`local('Arial')` with `size-adjust` and ascent/descent overrides) so headings don't reflow when Fredoka arrives on a slow Android (F39 review).
- A catch-all route (`*` → Landing or a "No such page" with a link home); unknown paths render blank today, as they did with react-router (F39 review).
- Play's Leave: `navigate('/', {replace: true})` so Back doesn't return to the join form of the game just left (needs `replace` in `client/src/lib/router.tsx`) (F39 review).
- Join limit hardening (F44 secrets-fairness should-fixes): a looser per-key cap on rejoins by a known key (a joined player can loop connect + rejoin, each a commit and a broadcast); key IPv6 addresses on their /64 and fold `::ffff:a.b.c.d` into the IPv4 form.
- Screen lobby: clear a Start refusal ("Too fast", "Could not start") after `STATUS_MS`, as the host bar does, so the player-count hint comes back (F44 mobile-ux should-fix).
- Screen FINAL: let the gallery take the leftover height in landscape (thumbnails sized to it) instead of the fixed 17/28 vmin, which leaves a gap under the scores with few players (F49 mobile-ux should-fix).
- Screen FINAL with 10 players: the Tonight column on a 16:9 TV fits by shrinking to ~2 vmin, and a 4:3 Screen in game 2 shows the score rows at 18 px. Fold the night totals into the score rows, or page the standings and the gallery, to keep TV sizes (F50).
- Press feedback on live buttons: a motion-safe `:active` shrink (`not-disabled:active:scale-95`, as Buzzr), beyond the reactions' existing `active:scale-90` (B01, DECISIONS 75).
- Lobby doodle pad: Eraser and Clear, now that the 20 KB cap is the phone's own and a clear could free room locally (F55, DECISIONS 78).
- Screen turn on a 4:3 landscape Screen (F64): centre the square and the caption as one group on the left page (today the square is centred in the space above the caption, leaving paper under it), and say the tab status to screen readers in words ("drawing", "got it, 270 points") instead of ✏️ / ✓.
