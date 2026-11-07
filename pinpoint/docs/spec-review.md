# Pinpoint — Spec Review

2026-11-07 · Review of `docs/spec.md` (2026-11-07) through four lenses: product design, architecture, security and privacy, ops and deploy. Each finding proposes the text the spec should say instead, and a default that applies if Kim doesn't choose.

> **Applied 2026-11-07.** Clear-cut findings 2–15 (except the forks), 18 and 19 applied to `docs/spec.md` as proposed. Kim's answers to the forks:
> - **1. Idle crosshair:** keep as written (Kim). The rule is now marked [decided]; finding 1's mitigation is not applied.
> - **16. Tiles:** Kim first picked Stadia Maps. Checked: domain authentication works without a key, but Stadia has no dark no-labels raster (only the black-and-white `stamen_toner_background`) and its free plan is 200,000 tiles a month (about 27 eight-player games, against CARTO's ~680). With that, Kim chose CARTO with the website-restricted, non-commercial key as written. No option costs money: a used-up month switches maps to the fallback tiles.
> - **17. Sign check:** added (Photos step, Swap photo, fake sign checker, tests).
> - **Keys:** Kim has the Anthropic key. The CARTO key and `WIKIMEDIA_CONTACT` come later, so `/opt/pinpoint/.env` is provisioned with them empty: the live app starts on fallback tiles with generation off, and the live smoke runs without `SMOKE_EXPECT_TILES` until the key is set.
> - Open question 4 (launch categories) became Milestones item 11, a post-launch Kim task.

Ground rules:

- Items marked **[decided]** in the spec can be challenged. Findings that do so say **Reverses [decided]**.
- Severity: **Must** (blocks an unattended build or ships something broken or unsafe), **Should** (real cost if skipped), **Could** (polish).
- **Clear-cut** findings have one sensible answer and are applied as defaults. **Fork** findings are a genuine product or cost choice and go to Kim, one question at a time.

## Verdict

The spec is unusually complete: a pure reducer with every transition tabled, a scoring formula whose worked table checks out to the point (every cell recomputed for this review), a named leak test for the one invariant that matters most, and Buzzr's admin and deploy as proven patterns to copy. The top three risks are (1) **rate limits keyed on an IP that is always nginx's**, plus a join limit a party behind one home router trips on its own; (2) **pieces an unattended session cannot finish**: the fallback tiles need Natural Earth data downloaded, the sounds need licensed audio, the generator's dev mode still calls Wikidata; (3) **the idle-crosshair and CARTO-key questions**, which the spec rightly leaves to Kim. A smaller gap: phones need the region box to open their map, and no view carries it. Once the Musts are applied, the spec can drive an unattended build.

## Locks

These are fixed before the roadmap, because changing them after launch touches every screen and test:

- **Audience and locale:** party groups in one room (friends, family) with one laptop on a TV and their own phones, anywhere in the world. English only, for everyone. UK spelling in UI copy (the spec already writes "colour", "licence"). Distances in km only (miles out of scope). Numbers with comma thousands ("4,812 km", "1,218"), formatted in one module with `Intl.NumberFormat('en-GB')`. Place names in English as Wikidata/Wikipedia give them. Daily limits reset at 00:00 UTC. No currency except the admin's USD spend.
- **Look:** no mocks; `docs/design/DESIGN.md`, extracted from the spec's "Look and tokens", is the target. One dark theme (departures board: amber `#FFB000` and warm white `#F2E9D8` on `#0B0C0E`, `#F2E9D8` boarding passes as the one light surface). JetBrains Mono 800 for the board face, Inter variable for body, self-hosted.
- **Stack:** as the spec names it: Node 24, TypeScript strict, Express 5, Socket.IO 4, React 19 + Vite, React Router, Tailwind CSS 4, Zustand, Leaflet 1.9, zod 4, sharp, `@anthropic-ai/sdk`, Howler, Vitest + Testing Library + jsdom, Playwright (Chromium) for one smoke, eslint + typescript-eslint + prettier, npm. Own `package.json` in `pinpoint/`; no workspace.
- **Keyed services:** Anthropic (`PINPOINT_ANTHROPIC_API_KEY`; fake: `GENERATE_FAKE=1` and the injected fake generator in tests), CARTO tiles (`PINPOINT_CARTO_KEY`; fake: unset, so the self-rendered fallback tiles serve; tests never fetch tiles). Wikidata and Commons need no key, only `WIKIMEDIA_CONTACT`; fake: an injected Wikimedia client with fixture responses (finding 11).
- **Data:** no database. Rooms in memory (die on restart and deploy). `DATA_DIR` on a volume: `categories.json`, `photos/`, `generation-history.jsonl`. Nightly backups on the droplet (finding 18).

## Findings

### Product designer

#### 1. Idle crosshair scores for free (open question 1)

- **Severity:** Should · **Kind:** fork
- **Where:** Points formula ("Unlocked players"), Reveal timeline, Screen view (rail tags), Player view (Reveal), Open questions for Kim
- **What goes wrong:** In a Tuscany game, Ben puts his phone down and talks. At time-up he is scored at the box centre, 23 km from Siena: 494 points for doing nothing, and a target near the centre can hand him a bullseye. On small regions the idle score beats honest guesses.
- **Proposed spec text (recommended):**
  - Replace the "Unlocked players" bullet with: "**Unlocked players.** At time-up, a participant who has not locked in is scored at their last `player:aim` position only if that round they sent at least one `player:aim` farther than `0.005 × S` from the opening centre (the Web Mercator centre of the region box). Otherwise they score 0 for the round, their `position` is null, and their row says "No pin". Locking in without moving the map is a real guess and scores normally."
  - `RoundResult` gains `noPin: boolean`; the rail tag "NO PIN" joins "NOT LOCKED IN"; the phone shows "No pin this round · 0".
- **Alternatives:** (b) open each round's map on a random point inside the box (seeded PRNG, the same point for every phone), keeping "scored at the crosshair"; (c) keep the rule as written.
- **Default:** the recommended text.

#### 2. A live game with nothing to play

- **Severity:** Should · **Kind:** clear-cut
- **Where:** VIP controls (Lobby), Dev tools, Open questions for Kim (4), Milestones and acceptance criteria
- **What goes wrong:** The autopilot deploys at 4 a.m. Kim opens the live URL in the morning, creates a room, and the VIP's category picker is empty: production has no categories until the admin generates some, and the spec has no empty state for it. The "Start" button says "Pick a category" with nothing to pick.
- **Proposed spec text:**
  - VIP controls, Lobby, add: "With no live, visible category, the category area reads "No destinations yet. Check back soon." and Start is disabled with that reason. Non-VIP phones see the same line in the settings row."
  - Open question 4 becomes a post-launch Kim task under Milestones: "**After the first deploy (Kim):** generate, review and publish the launch categories, all three levels each: World, Europe, Asia, Africa, the Americas, Oceania, United States, Japan, Scandinavia and Tuscany (30 levels, two days at the default limit of 20)."
- **Default:** as proposed.

#### 3. Disputed countries in display names

- **Severity:** Should · **Kind:** clear-cut
- **Where:** Wikidata and Commons resolution (Resolving one item), City display text
- **What goes wrong:** A "Europe" category draws Simferopol. Wikidata gives it two current P17 values (Ukraine and Russia). The resolver picks the first, and the TV flaps "SIMFEROPOL, RUSSIA" at a party with a Ukrainian guest. The same happens with Taiwan, Kashmir, Western Sahara, Northern Cyprus.
- **Proposed spec text:**
  - Resolving one item, add step 2a: "**Country**: the item's P17 values with preferred rank, else its normal-rank values without an end time (P582). Exactly one must remain; otherwise drop ("Disputed or unclear country"). Box and size checks follow as before."
- **Default:** as proposed.

#### 4. Inactive tab text below contrast

- **Severity:** Could · **Kind:** clear-cut
- **Where:** Look and tokens
- **What goes wrong:** `--amber-dim` (`#8A6200`) on `--board-bg` is 3.6:1. Used for inactive tab labels (the admin's Cities / Landmarks tabs, the segmented controls), it fails WCAG AA for text and is hard to read on a dim laptop.
- **Proposed spec text:**
  - In the token table: `--amber-dim` use becomes "Disabled accent only (never readable text)"; `--text-dim` use becomes "Secondary text, credits, inactive tab labels".
- **Default:** as proposed (already in `docs/design/DESIGN.md`).

#### 5. Screen readers and keyboards on the phone view

- **Severity:** Could · **Kind:** clear-cut
- **Where:** Player view `/play/:code`
- **What goes wrong:** A player using VoiceOver hears nothing when the round starts or when their result flips, and the map's role is unannounced. A tester on a laptop cannot aim without a mouse.
- **Proposed spec text:**
  - Player view, add: "A polite `aria-live` region announces phase changes ("Round 3 of 10. Find Osaka."), lock-in ("Locked in") and the player's own result ("412 kilometres, 812 points, 3rd of 8"). The map container has `role="application"` and the label "Map. Pan to aim the crosshair."; Leaflet's keyboard panning stays on, and Enter on the focused map locks in."
- **Default:** as proposed.

### Architect / tech lead

#### 6. Views lack the region box

- **Severity:** Must · **Kind:** clear-cut
- **Where:** Role views, Player view (Intro, Guessing), Screen view (Reveal)
- **What goes wrong:** F-something builds the guessing map; "the map opens fitted to the region box", but PlayerView carries no box, so the session either fetches `/api/categories` (live data, which may have changed since the game's snapshot) or invents a field. The Screen's reveal map has the same gap for its clamp.
- **Proposed spec text:**
  - Role views, ScreenView and PlayerView: "From INTRO until the game ends: `region: {box, scale}` from the game's snapshot (`game.box`, `game.scale`). The box is public: the category list already shows it."
- **Default:** as proposed.

#### 7. The leak test can fail on coincidences

- **Severity:** Should · **Kind:** clear-cut
- **Where:** Security (the true location), Automated tests
- **What goes wrong:** The leak test searches each serialised view for the target's latitude to 1 decimal ("35.7"). The view also carries `serverNow` (a `performance.now()` float such as `12335.712`) and the box (`east: 135.7`). The test fails on a substring that isn't a leak; a later session "fixes" it by loosening the search, and the one test guarding the main invariant stops guarding it.
- **Proposed spec text:**
  - Security, after the leak test: "The test's fixture uses integer `now` values and a target whose coordinates (e.g. 12.3456, −98.7654) share no 1-decimal form with any other number in the fixture (box, clock, ids). The test may never be loosened to make it pass; a coincidence is fixed in the fixture."
- **Default:** as proposed.

#### 8. Dev fixture coordinates "copied from Wikidata by hand"

- **Severity:** Could · **Kind:** clear-cut
- **Where:** Dev tools (Dev fixture category)
- **What goes wrong:** A session building the fixture tries to fetch 45 cities' coordinates from Wikidata, has no network, and stalls; or a reviewer flags coordinates written from memory as unverified.
- **Proposed spec text:**
  - Dev fixture bullet: replace "(coordinates copied from Wikidata by hand)" with "(coordinates written to two decimals from general knowledge; dev only, never shipped, so approximate is fine)". Playwright runs Chromium only.
- **Default:** as proposed.

#### 9. Fallback tiles need data a session cannot fetch, and 20 MB of PNGs in a public repo

- **Severity:** Must · **Kind:** clear-cut
- **Where:** Map tiles (Fallback), Folder layout, Milestones (Deploy)
- **What goes wrong:** `npm run tiles:fallback` needs Natural Earth 1:10m shapefiles (coastlines, lakes, admin-0, admin-1), which are not on npm. An unattended session either downloads ~300 MB of zips from naturalearthdata.com (no test may touch the network; the session may not have it) or stalls. The output, ~5,500 PNGs up to 20 MB, then goes into the public portfolio history for good.
- **Proposed spec text:**
  - Replace the first two Fallback bullets with: "`npm run tiles:fallback` renders zoom 0–6 from the `world-atlas` npm package (Natural Earth 1:10m land and countries as TopoJSON, public domain; a dev dependency, so no download beyond `npm ci`) with `topojson-client`, `d3-geo` (Web Mercator) and `@resvg/resvg-js`. It draws land, coastlines and country borders; the fallback has no lakes and no state or province borders. The tiles are **not committed**: the Dockerfile's build stage renders them into the image, and development renders them once into `server/assets/fallback-tiles/` (gitignored). Identical all-water tiles are written once and served for every all-water address. Tests use a three-tile fixture directory."
  - Colours unchanged except the dropped state-border line.
- **Default:** as proposed.

#### 10. Sounds an unattended session cannot license

- **Severity:** Should · **Kind:** clear-cut
- **Where:** Tech stack (Sound), Sound and haptics
- **What goes wrong:** "Royalty-free or self-made sounds" sends a session hunting for downloads whose licences it cannot verify, or committing nothing and leaving the Screen silent.
- **Proposed spec text:**
  - Sound and haptics, add: "All five sounds are synthesised from plain waveforms by `scripts/make-sounds.mjs` (adapted from Buzzr's), written as mono 16-bit WAV (`flap.wav`, `chime.wav`, `tick.wav`, `thud.wav`, `fanfare.wav`, under 400 KB together) and committed with a `client/public/sounds/README.md` naming each as self-made. No third-party audio."
  - The sound table's `.mp3` names become `.wav`.
- **Default:** as proposed.

#### 11. The generator's dev mode still calls Wikidata

- **Severity:** Must · **Kind:** clear-cut
- **Where:** Generation pipeline, Wikidata and Commons resolution, Dev tools, Environment (`GENERATE_FAKE`), Automated tests
- **What goes wrong:** With `GENERATE_FAKE=1` the writer and checker are fake, but Locate and Photos still call `wikidata.org` and `commons.wikimedia.org`. The Playwright smoke and every admin page a session builds hit the network or fail; the resolver tests need "recorded" responses that no session can record without network.
- **Proposed spec text:**
  - Generation pipeline, replace the `GENERATE_FAKE` sentence: "The writer, the checker **and the Wikimedia client** sit behind interfaces. `GENERATE_FAKE=1` swaps in fakes for all three: the fake Wikimedia client answers from `server/generate/fixtures/` (entities, search results, SPARQL answers and image info for every place the fake writer produces) and serves generated placeholder images (a solid colour and a number) instead of Commons files. No code path under `GENERATE_FAKE=1` or in tests opens a network connection."
  - Automated tests, Resolver bullet: "…against fixture responses in the shape the Wikidata and Commons APIs document (hand-written where no recording exists). `scripts/record-wikimedia.ts <enwiki title>…` lets Kim replace them with real recordings."
  - Manual acceptance: "The first real generation on the live site (a small region) resolves coordinates and photos end to end." (Kim check.)
- **Default:** as proposed.

#### 12. Port and spec paths that predate the bootstrap

- **Severity:** Could · **Kind:** clear-cut
- **Where:** Folder layout, Milestones (Skeleton, Deploy)
- **What goes wrong:** The folder layout names `docs/SPEC.md` and "spec.mjs copied from Buzzr"; the spec now lives at `docs/spec.md` and the tooling comes from the bootstrap. Port 3007 is assumed free; the droplet is checked at provisioning.
- **Proposed spec text:**
  - Folder layout: `docs/  spec.md (this file), spec-review.md, ROADMAP.md, DECISIONS.md, PROGRESS.md, design/DESIGN.md, deploy-kit/`; drop the `.claude/scripts/spec.mjs` line.
  - Milestone 1: drop "`spec.mjs` copied from Buzzr".
  - Milestone 10: "Node on loopback `127.0.0.1:3007` (the next free port after PokéTrack 3004, Buzzr 3005, Sketchy 3006, confirmed at provisioning)".
- **Default:** as proposed.

#### 13. Dev routes and fixture in production

- **Severity:** Should · **Kind:** clear-cut
- **Where:** Dev tools, Automated tests
- **What goes wrong:** `/dev/bots/:code` spawns players that aim "near the target's region"; a production build where the guard slipped would let anyone flood a room with bots.
- **Proposed spec text:**
  - Dev tools, add: "Both are mounted only when `NODE_ENV !== 'production'`. A test starts the server with `NODE_ENV=production` and asserts `/dev/bots/ABCD` is 404 and the dev fixture is not loaded."
- **Default:** as proposed.

### Security / privacy

#### 14. Every rate limit keys on nginx, and a party trips the join limit

- **Severity:** Must · **Kind:** clear-cut
- **Where:** Rate limits and limits, Environment, Milestones (Deploy)
- **What goes wrong:** Behind nginx every request comes from `127.0.0.1`, so "10 room creations per IP per hour" is ten for the whole internet, and the 11th party of the evening gets a 429. Separately, eight friends on one home Wi-Fi share one public IP: their first joins plus a few refreshes and phone sleeps (each reconnect is a `player:join`) pass 10 per minute, and the ninth phone can't get in.
- **Proposed spec text:**
  - Environment, add a row: "`TRUST_PROXY` | unset | Express's `trust proxy` setting; `1` behind nginx (set in the deploy compose file), so `req.ip` and the socket's client IP are the real client's".
  - Rate limits: "`player:join` | 30 **new** players per IP per minute (a reconnect with a known `playerKey` is not counted, as in Buzzr) | `{ok: false}`".
- **Default:** as proposed.

#### 15. Room codes can be enumerated

- **Severity:** Should · **Kind:** clear-cut
- **Where:** HTTP (`GET /api/rooms/:code/exists`), Rate limits
- **What goes wrong:** 279,841 codes and an unlimited `exists` endpoint: a script finds every live room in minutes, opens its Screen (no credential) and joins as "Mika" to troll, or reads the credits page.
- **Proposed spec text:**
  - Rate limits, add: "`GET /api/rooms/:code/exists`, `GET /api/credits/:code` and `screen:join` | 30 per IP per minute together | 429 / `{ok: false}`".
- **Default:** as proposed.

#### 16. The CARTO key reaches every browser (open question 2)

- **Severity:** Should · **Kind:** fork
- **Where:** Map tiles, Security (Keys), Open questions for Kim
- **What goes wrong:** CARTO requires a key for raster tiles since 2026-09-25 and forbids proxying (§9.c.3), so the key is in every tile URL. Anyone can copy it; the website restriction stops browsers on other sites, not scripts that spoof a Referer. Worst case: the 5M monthly tiles are burnt and the maps fall back to the blurrier self-rendered tiles until the month ends.
- **Proposed spec text (recommended):** keep the spec as written (key website-restricted to `pinpoint.kimnejudne.dev`, registered non-commercial, fallback on errors), and remove open question 2.
- **Alternatives:** (b) ship only the self-rendered fallback tiles (no key; blurry above zoom 6; weak for small regions); (c) try Stadia Maps' domain authentication (no key; no confirmed dark no-labels raster style).
- **Default:** the recommended text.

#### 17. Signs naming the landmark in photos (open question 3)

- **Severity:** Should · **Kind:** fork
- **Where:** Generation pipeline (Check, Photos), Level review warnings, Open questions for Kim
- **What goes wrong:** A Commons photo of the Christ the Redeemer statue includes a souvenir stall sign reading "Corcovado". The room sees the answer on the TV. The text-only Haiku check cannot see it; only Kim's eye in review catches it.
- **Proposed spec text (recommended):**
  - Photos step, add: "**Sign check** (`claude-haiku-5-5`, vision, no web search): the checker sees the 480 px thumbnail with the place's name and country and answers whether any visible text, sign or caption names or strongly hints at the place. A flagged candidate is skipped for the next usable one; a landmark whose every candidate is flagged is dropped ("Every photo names the place"). Its cost is priced like the other calls. The review card keeps the "Check for signs naming the place" reminder."
  - The fake generator gets a fake sign checker (flags candidates whose fixture file name contains `sign`).
- **Alternatives:** (b) no image check; rely on the review reminder (as written).
- **Default:** the recommended text.

### Ops / deploy

#### 18. No backups of the curated data

- **Severity:** Should · **Kind:** clear-cut
- **Where:** Data model (Stored categories), Milestones (Deploy)
- **What goes wrong:** Kim spends two evenings and API money curating 30 levels. A bad publish, a disk slip or a bug in the photo clean-up at start wipes `categories.json` or `photos/`, and there is no copy.
- **Proposed spec text:**
  - Milestone 10, add: "Nightly backup of `/opt/pinpoint/data` on the droplet following its existing backup convention: `categories.json` and `generation-history.jsonl` copied with a date stamp, `photos/` as a hard-linked snapshot (`rsync --link-dest`, so unchanged photos cost no space), 14 days kept. A restore drill is a Kim check."
  - Stored categories, add: "Before deleting unreferenced photo files at start, the server logs how many it will delete, and deletes nothing when `categories.json` failed to load or holds no categories."
- **Default:** as proposed.

#### 19. Smoke paths not named

- **Severity:** Should · **Kind:** clear-cut
- **Where:** Milestones and acceptance criteria (Deploy)
- **What goes wrong:** The deploy goes green on `/healthz` while `/api/config` returns `tiles: null` because the CARTO key never made it into the container, and every player sees blurry maps until Kim notices.
- **Proposed spec text:**
  - Milestone 10, add: "`scripts/smoke.sh <base URL>` checks: `/healthz` is `{ok: true}`; `/` serves the app shell; `/api/config` returns a fallback template and, when `SMOKE_EXPECT_TILES=1` (the live deploy), a non-null `tiles` (never printing the URL); `/api/categories` returns a JSON array; `POST /api/rooms` returns a 4-letter code and `/api/rooms/<code>/exists` says it exists; `/tiles/fallback/0/0/0.png` is a PNG; `/api/admin/session` is 404 without `ADMIN_PASSWORD_HASH` and 401 with it."
- **Default:** as proposed.

## Questions for Kim

1. **Idle crosshair** (finding 1): (a) no pin unless the map moved, recommended; (b) random opening point; (c) keep as written. Default (a).
2. **CARTO key in the browser** (finding 16): (a) accept, website-restricted and non-commercial, recommended; (b) self-rendered tiles only; (c) Stadia. Default (a).
3. **Sign check on photos** (finding 17): (a) add the Haiku vision check, recommended; (b) review reminder only. Default (a).
4. **Keys and accounts** (project facts): whether Kim has a CARTO account and a non-commercial key restricted to `pinpoint.kimnejudne.dev`, a Pinpoint Anthropic key, and the contact for `WIKIMEDIA_CONTACT`, for `/opt/pinpoint/.env` at provisioning.
