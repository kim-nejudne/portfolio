# kimnejudne.dev

[![CI](https://github.com/kim-nejudne/portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/kim-nejudne/portfolio/actions/workflows/ci.yml)

Six independent web applications and the homepage that links them, by
[Kim Nejudne](https://kimnejudne.dev). Every one of them is live, self-hosted,
and has a written case study.

That badge builds all six from their own lockfiles, then runs the hub's
browser assertions against the built site over the DevTools protocol and an
axe-core sweep of every hub page. The assertions are tested too: they are
deliberately broken to confirm they fail, because a check that has never
failed is a check nobody has verified.

| | | Stack | Live |
|---|---|---|---|
| **[hub](hub/)** | The homepage. A pen-and-ink portrait that hinges open on scroll and shows the work | Vite · React · GSAP | [kimnejudne.dev](https://kimnejudne.dev) |
| **[tallow](tallow/)** | Dry-aged steakhouse. Reservations against real cover capacity, and an 86 board wired from the kitchen to the public menu | Vite · React · Express · Postgres | [tallow.kimnejudne.dev](https://tallow.kimnejudne.dev) |
| **[plinth](plinth/)** | A sixteen-week periodised strength program told entirely in type. No photography anywhere, by design | Vite · React · GSAP | [plinth.kimnejudne.dev](https://plinth.kimnejudne.dev) |
| **[forme](forme/)** | A trade printer's production system. The preflight engine measures your PDF rather than asserting it passed | Next.js · NestJS · Postgres · Drizzle | [forme.kimnejudne.dev](https://forme.kimnejudne.dev) |
| **[poketrack](poketrack/)** | Project tracking that levels up. A partner's whole state is derived from the sum of its XP events and never stored | React · FastAPI · MongoDB | [poketrack.kimnejudne.dev](https://poketrack.kimnejudne.dev) |
| **[suki](suki/)** | A neighbourhood sari-sari store's ledger, built for a cheap Android phone with no signal | Vite · React · NestJS · Postgres | [suki.kimnejudne.dev](https://suki.kimnejudne.dev) |

Case studies for all five spokes are published at
[kimnejudne.dev/work](https://kimnejudne.dev/work).

## Why the art directions do not match

They are not supposed to. Each application has its own independent art
direction, and the range is the argument. Coherence comes from a consistent
craft bar and a single curatorial voice in the case studies, not from a shared
design system.

The bar every one of them holds to: 60fps motion with no layout thrash,
`prefers-reduced-motion` honoured throughout, keyboard-navigable with proper
semantics, and real performance budgets that survive a mid-range phone.

## How this repository is arranged

Six directories, each a self-contained project with its own `package.json`,
its own lockfile and its own `node_modules`.

**There is deliberately no root `package.json` and no workspace.** The six do
not share dependencies and should not: poketrack is on Tailwind 3 and
TypeScript 4.9 behind Create React App, while the rest are on Tailwind 4 and
TypeScript 5.9; suki pins Vite to 6.3.4 through an `overrides` block that npm
would apply repo-wide from a shared root. Hoisting them into one dependency
graph would buy a smaller `node_modules` at the cost of breaking builds that
currently work. They are colocated, not merged.

Two directories do use npm workspaces *internally* — `forme` and `suki` each
have a `packages/domain` imported by both their frontend and their API, so the
price a marketing page quotes and the price the server charges come from one
function.

Each project builds from its own directory:

```
cd tallow && npm ci && npm run build
cd plinth/frontend && npm ci && npm run build      # code lives under frontend/
cd poketrack/frontend && npm ci && npm run build   # Python API under backend/
```

`hub` is the exception worth knowing about: its build reads each spoke's
`CASE-STUDY.md` from the sibling directory and **fails naming the path** if one
is missing, because publishing four case studies of five silently is the worst
outcome available.

## `spoke-plinth-recovered-craft-pass` is an archive, not a feature branch

> [!WARNING]
> **Do not merge this branch.** GitHub will offer a "Compare & pull request"
> button for it after any push, and the name reads like ordinary
> work-in-progress. It is not.

It holds the **retired PLINTH gym marketing site**, replaced on 2026-08-02 by
the sixteen-week strength program that `plinth/` carries today. Twelve commits
and ninety-four files that exist nowhere else in this graph, on a **disjoint
root** — it shares no merge base with `main` at all, so merging it would need
`--allow-unrelated-histories` and would graft a dead site into the live tree.

It survives because `plinth-brief.md` records it as the preservation copy of
that site, and because it was the one ref in the six-repository merge that
genuinely had nowhere else to live. The tag `recovery/plinth-2026-07-31` points
at the same commit.

Three other `spoke-*` branches were carried across in the merge and have since
been deleted: they held zero commits that were not already in `main`, so they
duplicated refs already preserved on the archived source repositories while
adding three more chances to misread the warning above. `main` is the only
branch here that is meant to move.

## Deployment

Everything runs on one DigitalOcean droplet behind nginx, with TLS per
subdomain. There is no Vercel, no Netlify and no serverless anything —
containers for the projects with a server, static files for the ones without.
Images are built on a workstation and shipped over ssh, because the box has not
the memory headroom to build them next to its co-tenants.

Each project's `deploy/` directory carries its own runbook, and that runbook is
the authority on ports, environment and exact commands.

## Provenance

Each of these began as a generated scaffold and was then rewritten. The case
studies say so plainly, and the check is mechanical rather than editorial:
`hub/scripts/case-study/policy.mjs` refuses to build a case study that does not
disclose it. The scaffold is the starting line; what the case studies are about
is the distance from there to what is running now.

The commit history reflects this too. `emergent-agent-e1` is the scaffolding
tool and its commits are left under its own name.
