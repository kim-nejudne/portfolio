# kimnejudne.dev

[![CI](https://github.com/kim-nejudne/portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/kim-nejudne/portfolio/actions/workflows/ci.yml)

Three independent web applications and the homepage that links them, by
[Kim Nejudne](https://kimnejudne.dev). All three are live and self-hosted.
PokéTrack and ts-dojo have a written case study; Buzzr's is still to come.

That badge builds every project from its own lockfile (Buzzr only when
`buzzer/` changed, and with its format check, lint and unit tests), then runs the hub's
browser assertions against the built site over the DevTools protocol and an
axe-core sweep of every hub page. The assertions are tested too: they are
deliberately broken to confirm they fail, because a check that has never
failed is a check nobody has verified.

| | | Stack | Live |
|---|---|---|---|
| **[hub](hub/)** | The homepage. A pen-and-ink portrait that hinges open on scroll and shows the work | Vite · React · GSAP | [kimnejudne.dev](https://kimnejudne.dev) |
| **[poketrack](poketrack/)** | Project tracking that levels up. A partner's whole state is derived from the sum of its XP events and never stored | React · FastAPI · MongoDB | [poketrack.kimnejudne.dev](https://poketrack.kimnejudne.dev) |
| **[ts-dojo](ts-dojo/)** | A TypeScript course graded by the real compiler, running in a Web Worker, with a Vim-keyed REPL and no backend | Vite · React · TypeScript 6 · CodeMirror | [dojo.kimnejudne.dev](https://dojo.kimnejudne.dev) |
| **[buzzer](buzzer/)** | Buzzr, a game-show buzzer. The TV shows the questions, players buzz from their phones, and one server decides who was first, with rooms held in memory | React · Express · Socket.IO · TypeScript 6 | [buzzr.kimnejudne.dev](https://buzzr.kimnejudne.dev) |

Case studies are published at
[kimnejudne.dev/work](https://kimnejudne.dev/work). Buzzr joins them once its
case study is written.

## Why the art directions do not match

They are not supposed to. Each application has its own independent art
direction, and the range is the argument. Coherence comes from a consistent
craft bar and a single curatorial voice in the case studies, not from a shared
design system.

The bar every one of them holds to: motion with no layout thrash,
`prefers-reduced-motion` honoured throughout, keyboard-navigable with proper
semantics, and real performance budgets, measured rather than assumed. ts-dojo
is desktop-only by its spec, because a lesson needs two panes side by side; the
others are budgeted against a mid-range phone.

## How this repository is arranged

Each directory is a self-contained project with its own `package.json`, its
own lockfile and its own `node_modules`.

**There is deliberately no root `package.json` and no workspace.** The projects
do not share dependencies and should not: poketrack is on Tailwind 3 and
TypeScript 4.9 behind Create React App, the hub is on Tailwind 4 and
TypeScript 5.9, ts-dojo is on TypeScript 6 under pnpm and Node 24, with
the compiler version pinned because it also runs inside the app, and Buzzr is
on Tailwind 4 and TypeScript 6 under npm and Node 24, with its Express and
Socket.IO server in the same package as its client. Hoisting them into one dependency
graph would buy a smaller `node_modules` at the cost of breaking builds that
currently work. They are colocated, not merged.

Each project builds from its own directory:

```
cd hub && npm ci && npm run build
cd poketrack/frontend && npx yarn@1.22.22 install --frozen-lockfile && npx yarn@1.22.22 build   # Python API under backend/
cd ts-dojo && pnpm install --frozen-lockfile && pnpm build
cd buzzer && npm ci && npm run build                # client and server
```

`hub` is the exception worth knowing about: its build reads each spoke's
`CASE-STUDY.md` from the sibling directory and **fails naming the path** if one
is missing, because silently publishing fewer case studies than there are
spokes is the worst outcome available.

## Deployment

Everything runs on one DigitalOcean droplet behind nginx, with TLS per
subdomain. There is no Vercel, no Netlify and no serverless anything —
containers for the projects with a server, static files for the ones without.
The box builds nothing, because it does not have the memory headroom to build
next to its co-tenants.

**A push to `main` deploys whichever project it touches.** Each project has its
own workflow in `.github/workflows/deploy-*.yml`. Its checks run on the runner
first, and the build or image they verified is shipped over ssh as an
unprivileged `deploy` user. The swap keeps the previous release for rollback,
and smoke checks run against the live URL afterwards. Buzzr also waits until no
game is running, because its rooms live in memory.

Each project's `deploy/` directory (`buzzer/README.md` for Buzzr) carries its
own runbook. That runbook is the authority on ports, environment and exact
commands, and its manual steps are the break-glass path.

## Provenance

Each of these began as a generated scaffold and was then rewritten. The case
studies say so plainly, and the check is mechanical rather than editorial:
`hub/scripts/case-study/policy.mjs` refuses to build a case study that does not
disclose it. The scaffold is the starting line; what the case studies are about
is the distance from there to what is running now.

Buzzr differs in method rather than in kind: it was not scaffolded but written
feature by feature by an AI coding agent against a written spec
(`buzzer/docs/SPEC.md`), with every decision the spec left open recorded in
`buzzer/docs/DECISIONS.md`.

The commit history reflects this too. `emergent-agent-e1` is the scaffolding
tool and its commits are left under its own name.
