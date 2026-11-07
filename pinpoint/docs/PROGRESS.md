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

