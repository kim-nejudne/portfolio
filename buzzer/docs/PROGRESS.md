# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

<!-- entries below, newest first -->

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
