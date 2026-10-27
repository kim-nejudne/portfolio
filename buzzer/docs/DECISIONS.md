# Decisions

Only the owner edits `docs/SPEC.md`. Gaps and conflicts found while building go here.

## Open spec questions

Each has a recommended answer. Until the owner says otherwise, a feature that hits one uses the recommendation and moves it to "Decisions made".

1. **Deploy target.** The spec suggests Railway, Render or Fly.io. Every other project in this portfolio runs on Kim's own droplet behind nginx with a per-subdomain certificate. *Recommend:* ask the owner before F34. Whichever host is chosen, nginx (or the platform) must proxy WebSocket upgrades for `/socket.io`.
2. **A Screen device that also holds the hostToken.** The Screen must never receive answers, but it must be allowed to send host actions. `host:join` subscribes to HostView, which carries answers. *Recommend:* `screen:join` accepts an optional `hostToken`; a valid token authorises host actions on that socket while it still receives only ScreenView.
3. **`player:join` limit of 10 per minute per IP.** At a party, every phone on the venue Wi-Fi shares one public IP. Reconnects count too. A 12-player game on one network would be refused. The fake-players tool (20 bots from one browser) hits the same limit. *Recommend:* count only joins that create a new player, raise the limit to 60 per minute per IP, and let reconnects of a known `playerId` through.
4. **Buzzes after the collection window.** Fairness rule 4 says late buzzes are "recorded only for the 'also buzzed' list". The rules list says any buzz outside OPEN/COLLECTING is "ignored silently". *Recommend:* in BUZZED, record late buzzes for the also-buzzed list and gaps only; they can never win and get no penalty.
5. **Phase during the 1.5 s before a reopen.** A wrong answer goes to "OPEN after 1.5 s", but the spec names no phase for the wait. *Recommend:* stay in BUZZED with the judgement recorded and a `reopenAt` field set; `host:judge` is rejected while `reopenAt` is set; the `reopen` effect moves to OPEN and increments `openingCounter`.
6. **Undo after a reopen.** Undo returns "to the state right after that buzz", but a reopen clears `buzzes`, and another player may already have buzzed. *Recommend:* each judgement stores a snapshot of `buzzes` and `winnerId`; undo restores it, discarding any newer buzzes of that question. Undo is allowed in BUZZED, OPEN, COLLECTING or REVEAL of the same question, once per question.
7. **Scoreboard overlay never hides itself.** `host:next` sets `showScoreboard` but nothing clears it. *Recommend:* clear it on the next `host:open`, `host:reveal` or `host:next`, as well as on `host:scoreboard {show:false}`.
8. **`host:prev` onto an answered question.** Scores stay unchanged, so the question can be judged again and award points twice. *Recommend:* allow it (host's call), reset `buzzes`, `winnerId` and `lockedOut`; reject `host:prev` at index 0.
9. **Who counts as "eligible" after a wrong answer.** *Recommend:* connected, not locked out, not kicked. If nobody qualifies, go to REVEAL.
10. **Kicking the current buzz winner.** Not covered. *Recommend:* discard the buzz without a judgement and reopen immediately (new opening).
11. **Missing limits.** No limits for set title, host notes or the `POST /api/rooms` body. *Recommend:* title 100 chars, host notes 500 chars, JSON body 1 MB.
12. **Server memory.** Images live in memory at up to 50 MB per room, and room creation allows 10 rooms per IP per hour. A small always-on host can run out. *Recommend:* add a global image cap (for example 500 MB). Over the cap, refuse new uploads with a clear error.
13. **`fx buzz` payload `gaps`.** The shape is unspecified. *Recommend:* `gaps: {playerId: string, gapMs: number}[]`, in rank order, excluding the winner.
14. **Pairing from a Screen without the token.** With "Open the Screen on another device", the TV holds no token, so it cannot show the pairing QR. *Recommend:* show **Pair host phone** only where the token is held, and add it to the host remote too. Note that the pairing QR shows a usable token on a public screen for 60 s. That is accepted as v1 risk.
15. **"Monorepo layout" vs "one TypeScript project".** Resolved in F01 as recommended; see "Decisions made".
16. **RTT before the first ping.** *Recommend:* one-way latency 0 until the first sample, so a new player gets no correction rather than the full 150 ms.

## Decisions made

| Date | Feature | Decision | Reason |
| --- | --- | --- | --- |
| 2026-10-27 | setup | Dev ports: server :3000, Vite :5173 proxying `/api`, `/socket.io`, `/healthz` | Hooks and the playtester need fixed URLs; Vite's default port |
| 2026-10-27 | setup | `buzzer/` lives in the `portfolio` monorepo: no nested `git init`; git commands and staging are scoped to `buzzer/`; commits use the repo's `type(buzzer):` scope | Matches the other projects' history; unscoped status would show other projects' files |
| 2026-10-27 | setup | npm, not pnpm | The spec and the workflow scripts use npm; each portfolio project picks its own package manager |
| 2026-10-27 | setup | Dexie, not idb-keyval | The stack table names Dexie; the editor section offers either |
| 2026-10-27 | F01 | Open question 15: one `package.json` in `buzzer/` with `shared/`, `server/` and `client/` folders, no npm workspaces | This is separate from the portfolio repository, which has no root `package.json` by design |
| 2026-10-27 | F01 | Three tsconfigs: `tsconfig.json` (client + shared, bundler resolution), `tsconfig.node.json` (server, shared, configs; NodeNext), `tsconfig.build.json` (emits `dist/server` and `dist/shared` beside Vite's `dist/client`). Relative imports use `.js` extensions everywhere | Node runs the compiled server without a bundler; Vite resolves `.js` to `.ts`, so shared files import the same way from both sides |
| 2026-10-27 | F01 | The server serves `dist/client` only when `NODE_ENV=production` (`npm start` sets it). Paths other than `/api/*` and `/socket.io/*` fall back to `index.html` | In development Vite serves the client; client routes like `/play/:code` must load the SPA |
| 2026-10-27 | F01 | The Socket.IO server accepts the `websocket` transport only, matching the client | Spec, Buzzer fairness and timing: "use the WebSocket transport only"; `.claude/rules/client.md` |
| 2026-10-27 | F01 | Prettier ignores `docs/` and `.claude/` as well as `docs/SPEC.md` | They are hand-formatted workflow files; the format hook would otherwise rewrite them on every edit |
| 2026-10-27 | F01 | No supertest: HTTP tests use `app.listen(0)` and Node's `fetch`. `@types/node` is pinned to 24 to match the runtime | One dependency fewer; Node 26 types would allow APIs Node 24 lacks |

## Proposed spec changes
