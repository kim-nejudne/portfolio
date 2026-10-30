# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

## Kim checks

Things only Kim can do: real phones and devices, mobile data, and reviewing Taglish, word packs and lists. Unattended sessions add a line here instead of blocking. Format: `- [ ] Fnn: exact steps · what to look for`. Kim ticks them off.

<!-- entries below, newest first -->

## F02 — Shared types, schemas and constants (2026-10-30)
**What changed:**
- `shared/types.ts`: the Room model as in the spec (`Room`, `Turn`, `Player`, `WordEntry`, `CorrectGuess`, `FeedItem`, `TurnSummary`, `Award`, `Paused`, `RoomSettings`), reducer `Action` (client actions carry `by: Sender`; `sys:*` and `timer` don't), `TimerName`, `Effect` and `Fx`, `ClientPayloads`/`ClientToServerEvents`/`Ack`, the ink op and batch tuples with `/ink` client payloads, and the HTTP bodies and responses.
- `shared/schemas.ts` (zod): `clientPayloadSchemas` for every main-namespace event and `inkPayloadSchemas` for every `/ink` event (`ink:batch` with the 4 KB cap, `ink:hello`, `ink:sync`, `ink:get`, `doodle:batch` with the 20 KB cap), `createRoomBodySchema`, `roomSettingsSchema` and the strict `partialSettingsSchema`. Both maps are `satisfies`-checked against `types.ts`, and `SchemaTypeChecks` asserts settings, ops and batches agree both ways.
- `shared/constants.ts`: every timing, limit and rate limit from the spec, the 8 drawing colours, eraser index, canvas colour, 12 player colours, reactions, settings choices, `DEFAULT_SETTINGS`, `PRESETS` (Quick, Classic, Barkada Night) and `MID_GAME_SETTINGS`.
- New dep: `zod` (runtime payload validation, the spec's stack; same major as Buzzr).

**Decisions:** DECISIONS 7–12 (id formats; the 12 player colours; trimming and strict settings; ink schema bounds and byte caps in the schema; the `exists` response shape; effect/fx shape and which types wait for F05/F06/F11).

**Notes for next session:**
- Handlers use `clientPayloadSchemas[event].safeParse(payload)` and `inkPayloadSchemas[...]`; schemas trim names and guesses and upper-case room codes, so use the parsed value.
- `ServerToClientEvents` and the `ScreenView`/`PlayerView` types are not written yet: F05 adds them with `toView`. The ink action-stack type and `ink:snapshot`/`ink:state`/`ink:resend`/`doodle` server payloads come with F06/F11/F12.
- The schema rejects off-grid `b` points; clamping accumulated `p` points to the grid belongs in the codec (F11) and relay (F12).
- Review follow-ups: `Ack.error` is still a free string; when F05 writes the handlers, consider a closed union of error codes so no handler can echo a word or guess in an error. Never log `host:customWords` payloads or their `ZodError` input (custom words are never logged).
- `shared/types.test.ts` holds `@ts-expect-error` checks for fx targets; the typecheck enforces them.
- `constants.test.ts` pins every fixed number from the spec; change both if a playtest retunes one (e.g. `DRAWER_SHARE`).

**How to try it:** `npm test` (`shared/schemas.test.ts`, `shared/constants.test.ts`); `npm run typecheck` fails if a schema and its type drift apart.

## F01 — Project skeleton and tooling (2026-10-30)
**What changed:**
- One `package.json` (npm, Node 24, ESM) with `dev`, `build`, `start`, `test`, `typecheck`, `lint`, `format`, `format:check`, `lan`, `playtest`; TypeScript (client `tsconfig.json`, server/scripts `tsconfig.node.json`, prod build `tsconfig.build.json`), ESLint flat config, Prettier, Vite + React + Tailwind 4, Vitest.
- `server/http.ts` (`createApp`: `GET /healthz` → `{ok: true}`, built client with SPA fallback in production), `server/index.ts`, `server/lan.ts` (`lanAddress`, ported from Buzzr's `env.ts`); placeholder `Landing`, `Play`, `Screen` pages (Screen is a lazy chunk, per the performance budget) and a favicon.
- `npm run lan [CODE] [--port N]` prints the Screen URL and the join URL with terminal QR codes; `npm run playtest -- <scenario.ts>` runs a Playwright scenario with one isolated context per role (`scripts/playtest/harness.ts`, `run.ts`, `smoke.ts`: Screen + 3 phones).
- CI: `sketchy-changes` + `sketchy` jobs in `../.github/workflows/ci.yml` (npm ci, format check, lint, typecheck, test, build), gated on changes like Buzzr's.
- New deps (one line each): `express` (HTTP server, spec stack); `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `react-router`, `tailwindcss`, `@tailwindcss/vite` (client stack, as Buzzr); `typescript`, `tsx`, `vitest`, `eslint` + `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-config-prettier` + `globals`, `prettier` (tooling, as Buzzr); `concurrently` (server + Vite in one `npm run dev`); `playwright` (playtest harness); `qrcode` (terminal QR for `npm run lan`); `@types/*` for the above.

**Decisions:** DECISIONS 4–6 (lan Screen URL is `/`; plain-Playwright harness in Chromium with device emulation; only F01's deps installed, SPA fallback never covers `/api/` or `/socket.io/`).

**Notes for next session:**
- The first unattended attempt was blocked only because `npm install` needed approval; this run installed it and finished the work.
- npm 12 blocks esbuild's postinstall (`allowScripts`); Vite and Vitest work without it (the platform binary comes from an optional dependency). CI's `npm ci` on Node 24 is unaffected.
- Playtests: start `npm run dev` first; `run.ts` checks `/healthz` and exits 2 if the app is down. Scenarios live in `.playtest/<ID>/scenario.ts` and import `../../scripts/playtest/harness.js`. The harness falls back to `/usr/bin/chromium` when Playwright's own browser isn't downloaded.
- `server/index.ts` has no Socket.IO yet; F03/F05 attach the main namespace and `/ink` to its `httpServer`.
- Review follow-ups for later features: close the HTTP/Socket.IO server in `shutdown` once rooms exist; keep the SPA fallback off `/socket.io/` (both namespaces share it); `overscroll-behavior: none`, `touch-action` and base colours/`theme-color` arrive with the play UI.

**How to try it:**
- `npm run dev`, then open http://localhost:5173/ (and `/play/ABCD`, `/screen/ABCD`); `curl localhost:5173/healthz` → `{"ok":true}`.
- `npm run lan -- ABCD`: scan the join QR with a phone on the same Wi-Fi → "Play ABCD".
- `npm run build && npm start` → http://localhost:3000/ serves the built client.
- With `npm run dev` running: `npm run playtest -- scripts/playtest/smoke.ts` → `PASS`.
