# Buzzr (buzzer/)

A browser game-show buzzer. A big **Screen** (laptop on a TV) shows questions; **Players** buzz from their phones; the **Host** judges from a paired phone or from the Screen's keyboard. One Node process runs Express and Socket.IO and serves the React client. Rooms live in memory. There are no accounts and no database. Question sets live in the host's browser (IndexedDB).

Read in this order, through the scripts. Never read ROADMAP.md, PROGRESS.md or SPEC.md whole:

1. `node .claude/scripts/roadmap.mjs next [ID]`: roadmap status, the feature's entry, and the newest 3 PROGRESS entries.
2. `node .claude/scripts/spec.mjs <ID>`: only the spec sections that feature cites. Use `--toc` to find others.
3. `docs/DECISIONS.md`: grep for the topic.

Change roadmap markers with `roadmap.mjs mark <ID> <todo|~|x|!> [note]`. Marking `x` collapses the entry to one line.

## Repository

- `buzzer/` is one project inside the `portfolio` monorepo (siblings: `hub/`, `poketrack/`, `ts-dojo/`). The git root is `..`.
- Scope every git command to this directory: `git status --short -- .`, `git log --oneline -5 -- .`, `git add -- .`. Never stage or commit files outside `buzzer/`.
- Commit messages use the repo's scope: `feat(buzzer): F07 <title>`, `fix(buzzer): B03 <title>`, `docs(buzzer): …`, `chore(buzzer): …`.
- One `package.json` here, no npm workspaces (DECISIONS #15). Use npm.

## Commands (created by F01)

```
npm run dev          # server :3000 + Vite :5173 (proxies /api, /socket.io, /healthz)
npm test             # vitest run
npm run typecheck
npm run lint
npm run format       # format:check in CI and in /verify
npm run build
```

Phones on the LAN: open `http://<laptop-LAN-IP>:5173`. Vite listens on `0.0.0.0`.

## Architecture invariants

- The server is the only source of truth.
- Game logic is a pure `reduce(room, action, now) → {room, effects}` in `server/reducer.ts`. Timers, sockets and the clock live outside it.
- Clients render the latest role-filtered `state` snapshot and contain no game logic.
- Answers and host notes never reach Screen or Player sockets before reveal. This holds even when the Screen device holds the hostToken (DECISIONS #2).
- Every inbound socket payload and HTTP body is zod-validated (`shared/schemas.ts`).
- Shared types live in `shared/`. Palette and limits live in `shared/constants.ts`.
- Store only the SHA-256 hash of `hostToken`, and compare it in constant time.

## Working rules

- One feature per session.
- Never edit `docs/SPEC.md`. A hook blocks it. Never create `.claude/spec-unlocked`.
- Record spec gaps in `docs/DECISIONS.md`. Add a `// SPEC-QUESTION:` comment at the code site.
- Logic ships with tests.
- Justify any new dependency in one line, in the plan and in the PROGRESS entry.
- Make one commit per feature. Do not push.
- Never weaken, skip or delete tests to get green.
- Nice-to-haves go under `## Backlog` in `docs/ROADMAP.md`, not into code.

## Finishing

When the feature is committed, stop. Tell Kim to run `/clear`, then `/next-feature`. Do not start the next feature.
