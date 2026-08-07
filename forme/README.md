# FORME

A production system for a trade printer in Manila. Litho and digital: a customer portal, a
prepress queue with an imposition planner, a press floor board and an admin price matrix, plus
the public pages that price the work.

Live at [forme.kimnejudne.dev](https://forme.kimnejudne.dev). The sign-in screen
carries a demo account for each role.

```
packages/domain/   types, money, working-day dates, the quote engine, imposition geometry
api/               NestJS — Postgres via Drizzle, pg-boss queue, preflight worker, socket.io
frontend/          Next.js App Router — eleven routes across five surfaces
```

`packages/domain` exists so the price the marketing page quotes and the price the API charges
cannot drift: both import the same `computeQuote`. The imposition planner recomputes its SVG
locally on every slider drag from the same `buildPlan` the API runs when it persists a plan.

## Running it

```bash
npm install                 # once, from the repo root — one lockfile for all workspaces
docker compose up -d db     # Postgres 17
npm run dev:api             # NestJS on :4000
npm run dev:web             # Next.js on :3000
```

```bash
npm run typecheck           # every workspace
npm run test                # unit and integration — 153 tests, no database needed
npm run test:e2e            # guard sweep against a real Postgres
npm run build               # every workspace
```

`npm run test:e2e` drops and recreates a `forme_test` database, migrates and
seeds it, then asserts that every non-public route refuses an anonymous caller
and every role-restricted route refuses the wrong role. It runs against real
Postgres rather than a mock, because most of what is worth asserting there —
the `FOR UPDATE` in the state machine, the advisory lock behind reference
allocation, the case-insensitive unique index on email — is database behaviour,
and a fake would only assert that the fake works.

The preflight worker shells out to **poppler-utils** and **ghostscript**. Without them the API
still runs, but every check that needs them reports as unavailable rather than passing silently.

## The eleven routes

| Route | Surface | What it is |
|---|---|---|
| `/` | marketing | The shop: presses, sheet sizes, turnaround, standards |
| `/specs` | marketing | The artwork specification, with a drawn bleed diagram |
| `/quote` | marketing | Instant quote; the whole quote lives in the query string |
| `/sign-in` | marketing | Sign-in, plus a demo account picker for each role |
| `/app` | portal | Customer job list, sortable, filtered through the URL |
| `/app/jobs/[id]` | portal | Job detail: timeline, live preflight, proof, approval, thread |
| `/app/new` | portal | Job submission and artwork upload |
| `/prepress` | prepress | The queue across every customer, due time first |
| `/prepress/jobs/[id]` | prepress | Preflight overrides and the imposition planner |
| `/floor` | floor | The press floor board, read from six metres |
| `/admin/pricing` | admin | The price matrix that drives the quote |

Route groups keep the surfaces apart, and access is checked at three depths:

1. **The API** verifies the JWT on every request and scopes every read to the caller's role and
   account. This is the only real boundary.
2. **Each group's `layout.tsx`** resolves the session server-side through `/auth/me` and renders a
   gate notice rather than data.
3. **`middleware.ts`** redirects a visitor with no session cookie to `/sign-in?next=…`, so they
   land on a form with somewhere to go back to instead of a page that looks broken.

The middleware checks only that a cookie is *present* — a forged one walks past it, and that is
fine, because the two layers behind it do the real work. Verifying the token there would have put
`JWT_SECRET` into the web tier, which currently holds no signing key at all.

## Rules that hold throughout

- **Money is whole pesos held as integers.** Multipliers are integer per-mille, so no float ever
  touches a price. One formatter, one currency glyph, in `packages/domain/src/money.ts`. VAT is
  12% and is always a separate line.
- **Status is never colour alone.** Every state carries a text label and a distinct mark shape as
  well as a colour, and status labels are set in the current ink so they meet AA on both grounds.
- **No component holds a timer.** The preflight stream is `subscribeToPreflight(reference, ...)`
  returning an unsubscribe function; the floor board is `subscribeToFloor`. Both are socket.io
  subscriptions over one shared, reference-counted connection at `/api/events`, authenticated by
  the session cookie on the handshake. Rooms are the authorization boundary: `job:<reference>` is
  joined only after the server checks the caller may see that job.
- **Preflight reports what it measured.** Checks that cannot be computed from the tooling
  available report as `SKIPPED` with the reason, rather than passing and implying they ran.
- **Every external process runs through `execFile`** with an argument array, a timeout and an
  output cap. No shell strings anywhere near a filename.

## Art direction

Prepress furniture used as interface furniture: crop marks on the proof frame, a registration
target as the processing mark, a CMYK colour bar as the progress strip, hairline rules
everywhere, radius 0, no shadows and no gradients. Paper `#F4F2ED` and ink `#0B0B0B`, with the
four process colours each carrying a job: cyan is automated, magenta is action required, yellow
is held, registration black is final. IBM Plex Sans for language, IBM Plex Mono with
`tabular-nums` for every number, unit, code, dimension, timestamp and status label.

Motion is CSS only, transform and opacity only, and confined to the six things that earn it:
preflight checks landing, the timeline advancing, the imposition sheet re-laying out, the colour
bar filling, the registration target rotating and queue rows entering. All of it sits inside
`@media (prefers-reduced-motion: no-preference)`, so under reduced motion every screen renders
complete and static.

## Deployment

Self-hosted on a shared DigitalOcean droplet — no PaaS, and nothing here may
assume one. Three containers (`web`, `api`, `db`) behind nginx, images built on
a workstation and shipped with `docker save | docker load` because the box has
1.9GB shared with six other containers and cannot afford a build.

`deploy/README.md` is the authority on ports, env, memory caps and the release
procedure.

**The artwork volume is not backed up.** The database is, nightly, with a
verified restore path — but `forme_forme-artwork` holds uploaded PDFs and nothing
dumps it. Acceptable only while those are test files.

## Provenance

The frontend began as an AI-generated scaffold and the git history says so. What it produced was
eleven routes over a mock data layer; the API, the schema, the state machine, the preflight
engine, authentication and the realtime transport were built afterwards. The case study is about
that distance, so the scaffold commits are kept rather than squashed.

## Deferred

- A print stylesheet for the job ticket and the proof sheet — a shop prints these.
- A job history panel listing every waiver and state change in one place.
- `/prepress` bulk actions (plate several jobs at once) and a shift handover note.
- The semantic token layer in `design_guidelines.md` (`--color-bg`, `--space-1…16`,
  `--text-floor`) that `globals.css` never implemented; components still reference raw process
  colours and carry 28 hardcoded hex literals across five files.
