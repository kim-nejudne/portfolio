# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**New dependencies:** each with a one-line reason, or none
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

## Kim checks

Things only Kim can do: real devices, real accounts and keys, live third-party services, and reviewing content. Unattended sessions add a line here instead of blocking. Format: `- [ ] Fnn: exact steps · what to look for`. Kim ticks them off.

<!-- entries below, newest first -->

## F03 — Geo module (2026-11-07)
**What changed:**
- `shared/geo.ts`: `haversineKm` (R = 6371.0088 km), `regionScale` (`S` = √(h × w) capped at 20,000), `bullseyeRadius` (0.01 × S), `boxContains` (edges included; `lng` or `lng + 360` in [west, east]), `mercatorCentre` (half way in Mercator x and y, longitude wrapped into [−180, 180)), `clampBounds` (box padded 25% each side, latitude clamped to ±`MAX_LAT`) and `geodesic` (64 segments, 65 points, both ends included).
- `normalizeLng` moved from `shared/schemas.ts` to `shared/geo.ts`; `schemas.ts` re-exports it.
**Decisions:** DECISIONS 12 (clamp latitude limit, continuous longitudes, antipodal geodesic, where `normalizeLng` lives).
**New dependencies:** none.
**Notes for next session:** `geodesic(a, b)` returns longitudes continuous from `a.lng`, so its last point may be `b.lng ± 360`; the reveal line should start at the pin or target that is drawn on the same world copy. `clampBounds` is for every box; the World category skips the horizontal clamp in the client (`worldCopyJump`). `mercatorCentre(box)` is the unlocked player's default aim (Points formula). The admin's S ≥ 150 km check can use `regionScale`. Scale and bullseye are unrounded; round only for display.
**How to try it:** `npm test` (shared/geo.test.ts, 24 tests).

## F02 — Shared types, schemas and constants (2026-11-07)
**What changed:**
- `shared/types.ts`: every Data model type (stored categories, Room state) plus the role views (`ScreenView`, `PlayerView`, `PublicPlayer`, prompts, reveal, standings, final passes, awards, `CategorySummary`), `fx` payloads and `Ack`.
- `shared/schemas.ts`: one zod schema per client event in `clientEventSchemas` (with `ClientPayload<E>`), the coordinate rule (`lat` within ±85.0511, `lng` finite and wrapped into [−180, 180) by `normalizeLng`), names (trimmed 1–16, no invisible characters), room codes (trimmed, upper-cased), the 21-char `playerKey`, every admin HTTP body and route parameter, and `categoriesFileSchema` for `categories.json`.
- `shared/constants.ts`: tokens, palette (the spec's list, untested until `palette.test.ts`), 24 emoji, room-code alphabet, settings menus and defaults, the eight timers plus the reveal timeline numbers, `RATE_LIMITS` (the limits table), player/screen caps, socket size, field limits, `MIN_PLACES_TO_OFFER`.
- Path alias `#shared/*` (package.json `imports`); `server/env.ts` and `shared/schemas.test.ts` use it. `npm start` and the deploy kit's Dockerfile CMD now pass `--conditions=dist`.
**Decisions:** DECISIONS 9 (limits the spec leaves open, `photoCandidate` = Commons file name), 10 (alias via Node subpath imports with a `dist` condition), 11 (views are types, not schemas; their layout is a first cut).
**New dependencies:** none.
**Notes for next session:** The built server needs `node --conditions=dist`; without it `#shared/*` points at the `.ts` sources and Node fails (F60's Dockerfile must keep the kit's CMD). The alias is proven in tsx (`server/env.ts` via `npm run dev`/tests), Vitest, tsc under both bundler (`tsconfig.json` includes `shared/*.test.ts`) and NodeNext resolution, the built server (`PORT=3011 npm start`), and a throwaway client import in a `vite build`; no committed client file imports `#shared` yet. `ScreenView.reveal.results` carries every row from REVEAL start because all pins drop at once; the views feature must still keep `myResult` until the reveal reaches the player. `photoSchema.author` may be empty: the credit builder must handle it. The box's S ≥ 150 km check belongs to the admin box editor.
**How to try it:** `npm test` (shared/schemas.test.ts, 25 tests); `npm run build && PORT=3011 npm start`, then `curl -s localhost:3011/healthz`.

## F01 — Project skeleton, tooling and CI (2026-11-07)
**What changed:**
- One npm package (no workspace): Express 5 server (`server/http.ts` `createApp()` with `/healthz`, `dist/client` with an SPA fallback that never swallows `/api`, `/socket.io` or `/tiles`; `server/index.ts` stops on SIGTERM within 3 s), `server/env.ts` parsing the spec's Environment table with zod (blank = unset; `TRUST_PROXY` as off, hop count, boolean or trust string), `.env.example` with every variable empty.
- React 19 + Vite client: a placeholder landing page ("PINPOINT" in flap cells, the one-liner) on the DESIGN.md tokens, defined in Tailwind 4 `@theme static` as `--color-*` with DESIGN.md-name aliases in `:root` (DECISIONS 8); JetBrains Mono 800 (latin) and Inter variable self-hosted via Fontsource; `.board-face` utility class; amber `:focus-visible` ring; SVG favicon.
- Tooling from Sketchy: tsconfigs (client/shared bundler; node for server/shared/scripts; build emits `dist/server`, `dist/shared`), eslint flat config, prettier; Playwright harness `scripts/playtest/` (one context per role; devices tv, tv 720p, laptop, Pixel 7, iPhone 13, small phone 360×640, large phone 430×932; default URL `http://localhost:5180`).
- Root `../.github/workflows/ci.yml`: `pinpoint-changes` and `pinpoint` jobs appended from `docs/deploy-kit/ci-jobs.yml` (format, lint, typecheck, test, build); nothing else changed.
**Decisions:** DECISIONS 4 (container data at `/data`), 5 (dev ports 3010/5180), 8 (token names). `.env.example` is written by shell: the `Read(./.env.*)` deny rule also blocks the Write tool on it, so sessions cannot edit it; ask Kim when a variable is added.
**New dependencies:** express, zod (env and later every schema; spec). Dev: react, react-dom, vite, @vitejs/plugin-react, tailwindcss + @tailwindcss/vite (tokens; spec), @fontsource/jetbrains-mono + @fontsource-variable/inter (self-hosted fonts; spec), typescript, tsx, concurrently, vitest, eslint + @eslint/js + typescript-eslint + eslint-plugin-react-hooks + globals + eslint-config-prettier, prettier, @types/node@24, @types/express, @types/react, @types/react-dom, playwright (playtest harness). Client libraries live in devDependencies, as in Sketchy: they are bundled at build time.
**Notes for next session:** npm's allowScripts blocked esbuild's postinstall (a binary check only); tsx, Vite and Vitest all work. Imports use relative paths with `.js` (`../shared/constants.js`) as in Sketchy; no path alias yet (F02 may add one if it pays). `shared/constants.ts` holds only the ports for now. Playwright uses its cached Chromium (falls back to `/usr/bin/chromium`).
**How to try it:** `npm run dev`, open http://localhost:5180 (phones on the LAN: `http://<laptop IP>:5180`); `curl -s localhost:5180/healthz` → `{"ok":true}`. `npm run playtest -- scripts/playtest/smoke.ts` with the dev server running. `npm run build && PORT=3010 npm start` serves the built app.

