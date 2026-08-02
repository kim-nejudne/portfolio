# FORME

The frontend of a production system for a trade printer in Manila. Litho and digital: a
customer portal, a prepress queue with an imposition planner, a press floor board and an
admin price matrix, plus the public pages that price the work.

No backend, no database, no ORM, no auth library, no `.env`. A NestJS API replaces the data
layer later and that swap is a one-directory change.

## Running it

```bash
yarn install
yarn build      # next build, output: 'standalone'
yarn start      # next start on 0.0.0.0:3000
```

`yarn dev` runs the dev server. This deployment runs the production build behind a reverse
proxy that blocks the dev HMR socket, so `yarn build && yarn start` is the served path; after
any source change the build has to be re-run for the change to appear.

```bash
yarn typecheck  # tsc --noEmit, strict + noUnusedLocals + noUnusedParameters
```

## The eleven routes

| Route | Surface | What it is |
|---|---|---|
| `/` | marketing | The shop: presses, sheet sizes, turnaround, standards |
| `/specs` | marketing | The artwork specification, with a drawn bleed diagram |
| `/quote` | marketing | Instant quote; the whole quote lives in the query string |
| `/sign-in` | marketing | Plain form plus a demo role picker |
| `/app` | portal | Customer job list, sortable, filtered through the URL |
| `/app/jobs/[id]` | portal | Job detail: timeline, preflight, proof, approval, thread |
| `/app/new` | portal | Job submission; preflight streams check by check |
| `/prepress` | prepress | The queue across every customer, due time first |
| `/prepress/jobs/[id]` | prepress | Preflight overrides and the imposition planner |
| `/floor` | floor | The press floor board, read from six metres |
| `/admin/pricing` | admin | The price matrix that drives the quote |

Route groups keep the surfaces apart and role gating happens once, in each group's
`layout.tsx`, by reading the session server-side.

## The data seam

```
src/lib/api/            every read and write; one module per resource
src/lib/api/fixtures/   seed data; nothing outside src/lib/api/ imports it
src/lib/api/delay.ts    the one artificial latency helper, deleted in one edit
src/lib/api/clock.ts    the demo clock anchor; fixtures are written against it
src/lib/types.ts        every type, shared by every screen
src/lib/money.ts        integer pesos, formatted in exactly one place
src/lib/dates.ts        deterministic Asia/Manila formatting and working-day maths
src/lib/actions/        server actions; they call src/lib/api/ then revalidate
```

Rules that hold throughout:

- Every API function is `async`. Loading and streaming states are real.
- Fixture data is deterministic: fixed ISO strings, no `new Date()`, `Date.now()` or
  `Math.random()` anywhere in fixtures or in render. The only live clock is the floor board's,
  and it starts after mount.
- Money is whole pesos held as integers; multipliers are integer per-mille, so no float ever
  touches a price. VAT is 12% and is always a separate line.
- The preflight stream is `subscribeToPreflight(jobId, onCheck)` returning an unsubscribe
  function; the floor board is `subscribeToFloor(snapshot, onTick)`. No component holds a timer.
  A WebSocket drops into either without touching a screen.
- Uploads are written to `.uploads/` through `src/lib/api/uploads.ts` by a server action. There
  are no route handlers.

## Art direction

Prepress furniture used as interface furniture: crop marks on the proof frame, a registration
target as the processing mark, a CMYK colour bar as the progress strip, hairline rules
everywhere, radius 0, no shadows and no gradients. Paper `#F4F2ED` and ink `#0B0B0B`, with the
four process colours each carrying a job: cyan is automated, magenta is action required, yellow
is held, registration black is final. A status is never colour alone — every state carries a
text label and a distinct mark shape, and every status label is set in the current ink so it
meets AA on both grounds. IBM Plex Sans for language, IBM Plex Mono with `tabular-nums` for
every number, unit, code, dimension, timestamp and status label.

Motion is CSS only, transform and opacity only, and confined to the six things that earn it:
preflight checks landing, the timeline advancing, the imposition sheet re-laying out, the
colour bar filling, the registration target rotating and queue rows entering. All of it sits
inside `@media (prefers-reduced-motion: no-preference)`, so under reduced motion every screen
renders complete and static.
