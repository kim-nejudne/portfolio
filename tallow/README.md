# TALLOW

A dry-aged, live-fire steakhouse: the public site, the reservation flow, and the
staff dashboard that drives both. Front of house books a table against real cover
capacity; back of house 86s a cut and the menu strikes it through.

Live at [tallow.kimnejudne.dev](https://tallow.kimnejudne.dev). The sign-in
screen carries a read-only demo PIN and a one-click button that uses it.

```
src/            React 19 + TypeScript, seven routes plus a 404
src/server/     the two modules the API needs — sessions and the pg pool
server.ts       Express 4, thirteen API routes; Vite middleware in dev
migrate.ts      the schema, an idempotent seed, and forward-only data migrations
deploy/         droplet runbook: compose stack, nginx, image release
```

## Running it

```bash
npm install
cp .env.example .env         # then fill in SESSION_SECRET, STAFF_PIN, DEMO_PIN, DATABASE_URL
docker compose up -d db      # Postgres
npm run migrate              # schema + seed, safe to re-run
npm run dev                  # Express with Vite middleware on :3000
```

```bash
npm run lint                 # tsc --noEmit — this is the typecheck
npm run build                # client bundle + esbuild'd server
```

The server refuses to boot without `SESSION_SECRET`. That is deliberate: a
signing key with a development fallback is a signing key that ships.

`npm run dev` reads `.env` through `dotenv`, and that ordering matters — an ESM
module body runs before `dotenv.config()` in an importing module, so anything
that reads `process.env` at module scope sees nothing. Env access is inside
functions for that reason.

## Access control

The site is public; the gate is in the app, not in nginx.

| PIN | Role | Can |
|---|---|---|
| `STAFF_PIN` | `staff` | read the dashboard, 86 dishes, edit the menu, change reservation status |
| `DEMO_PIN` (published on the sign-in screen) | `demo` | read the dashboard only |

Sessions are HMAC-signed and expire after eight hours. They are not stored
server-side, so a restart signs nobody out. Every `/api/admin/*` route is
guarded — reads need any session, writes need `staff`, and a `demo` write is
refused with `403 { readOnly: true }`, which the dashboard surfaces as a banner
rather than a dead button. Sign-in is rate limited per IP.

The demo role exists so the dashboard can be *shown* without being writable. A
reviewer gets the live 86 board and the real cover maths; nothing they do
survives, because the server never lets it start.

## Rules that hold throughout

- **Money is whole pesos held as integers.** `src/lib/money.ts` is the only place
  that knows the currency glyph and the grouping. No float touches a price.
- **Reduced motion is a global policy, not a per-component afterthought.** The
  stylesheet disables motion at the root under
  `prefers-reduced-motion: reduce`; new animation has to opt back in explicitly.
- **The 86 strike inks in over 420ms via `text-decoration-color`** — the one
  animatable property that gets there without touching layout. It is the app's
  signature move and the only thing on the page that animates for its own sake.
- **Cover capacity is real.** Availability is computed per sitting (early, prime,
  late) against seats actually committed, not a fixed slot count. Reservation
  input is validated server-side, including the 30-day booking window the copy
  promises.
- **Data migrations are forward-only.** `schema_migrations` records one row per
  applied migration. A freshly seeded database is *baselined* — every migration
  marked applied without running — because the current seed already has the shape
  they produce, and `001_gbp_to_php` would otherwise convert pesos to pesos.

## Art direction

A printed menu, taken literally: paper `#F7F4EE`, insert stock `#EFE6D5`, ink
`#1A1715`, oxblood `#7A2322`, brass `#8C6E43`, hairline rules at `#DDD6C8`.
Instrument Serif for display, Newsreader for body, Plus Jakarta Sans for UI,
JetBrains Mono for anything that is data — prices, weights, aging days. Fonts are
self-hosted and subset to 156KB total; Newsreader alone went 276KB → 48KB by
pinning a static instance instead of shipping the variable font.

The restrained end of the portfolio's range. It earns attention through
precision rather than expression.

## Deployment

Self-hosted on a shared DigitalOcean droplet — no PaaS, and nothing here may
assume one. Two containers (`app`, `db`) plus a `migrate` job that runs to
completion first, behind nginx. Images are built on a workstation and shipped
with `docker save | docker load`; the box has 1.9GB shared with several other
services and cannot afford a build.

`deploy/README.md` is the authority on ports, env and the release procedure.

**Backups are not configured.** No dump timer exists for the Postgres volume.
Acceptable only while every row is regenerable demo seed — anything entered
through the staff dashboard is unprotected.

## Provenance

This began as an AI-generated scaffold and the git history says so. What the
scaffold produced was seven views, thirteen routes and the art direction above,
over a `data/db.json` file with no authentication and no router. Postgres, the
signed sessions, the routing, the accessibility work and the type layer came
after — `@types/react` was never installed, so the whole app was implicitly `any`
and the lint script passed on it regardless. `CASE-STUDY.md` is about that
distance, so the scaffold commits are kept rather than squashed.

## Deferred

- **Verification on a real mid-range phone**, and a visual regression pass — the
  craft pass touched the hero, the menu teaser and the choice grids.
- **The private dining enquiry form is not wired to a backend.** The copy says so
  rather than faking a submission.
- No share card, no `robots.txt`, no `sitemap.xml`, and nginx answers a missing
  path with the SPA fallback rather than a 404.
