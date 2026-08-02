# plan.md — FORME

## Status

**Phase 1 (core POC) — COMPLETE.** **Phase 2 (all eleven routes) — COMPLETE and tested.**

## What was proven in Phase 1 (before any UI was built)

Run through a single throwaway page and a production build, all passing:

- Next.js 16 App Router + React 19 + Tailwind CSS 4 + self-hosted IBM Plex boots on port 3000
  behind the preview proxy.
- `params` and `searchParams` awaited as Promises.
- A client leaf subscribing to `src/lib/api/preflight.ts` receives checks one at a time with **no
  timer in the component**.
- A Server Action writes a real multipart upload to `.uploads/` (needed
  `experimental.serverActions.allowedOrigins` because the proxy rewrites the host).
- Integer peso arithmetic and formatting, working-day despatch dates, press assignment, sheet
  fitting and the 4pp/8pp/16pp imposition schemes verified against the fixtures.
- `tsc --noEmit` with `strict`, `noUnusedLocals`, `noUnusedParameters` and `next build` both clean.

**Environment decision:** the preview proxy blocks the dev HMR websocket, which made `next dev`
reload in a loop. The app is therefore served from the production build (`yarn build` then
`next start`). Any source change needs a rebuild plus `supervisorctl restart frontend`.

## Phase 2 — delivered

| # | Route | State |
|---|---|---|
| 1 | `/` the shop | Done — presses from the data layer, drawn B2 sheet, sizes, turnaround, standards |
| 2 | `/specs` | Done — SVG bleed/trim/safety diagram, nine anchored sections, spec summary block, metadata |
| 3 | `/quote` | Done — full state in the query string, whole-peso output, press reason, sheets, up-count, despatch date |
| 4 | `/sign-in` | Done — plain form plus demo role picker writing the session cookie |
| 5 | `/app` | Done — real table, sortable header buttons with `aria-sort`, URL state filter, skeleton |
| 6 | `/app/jobs/[id]` | Done — timeline, twelve-check preflight, SVG proof viewer with three toggles, two-step approve, reject, thread |
| 7 | `/app/new` | Done — spec form plus streaming preflight over a real file input, `aria-live` announcements |
| 8 | `/prepress` | Done — denser queue, overdue labelled as well as coloured, arrow-key row navigation |
| 9 | `/prepress/jobs/[id]` | Done — waive/override with a required typed reason, live SVG imposition planner |
| 10 | `/floor` | Done — ink ground, three panels, clamp/cqi type, ticking figures, wall clock after mount |
| 11 | `/admin/pricing` | Done — editable cells, inline validation tied to inputs, arrow-key navigation |

Every route has `loading.tsx` with real geometry; the app has `error.tsx` and `not-found.tsx`.

## Verified invariants

- Nothing outside `src/lib/api/` imports a fixture (checked by grep).
- No `setTimeout` or `setInterval` in any component (checked by grep).
- No `/api` route handlers; all mutations are Server Actions.
- No currency value carries a decimal point anywhere in the product.
- Status is never colour alone: label + mark shape + colour, and status label text is always set
  in the current ink so cyan and yellow never appear as small text on paper.
- Reduced motion: all twelve checks land and the imposition sheet renders, static.
- `tsc --noEmit` clean, `next build` clean, zero unused dependencies.

## Testing

`testing_agent_v3` iteration 1: 97% overall, no critical or UI bugs. Three follow-ups raised and
resolved:

1. Waived and overridden checks now stay expanded, struck through, labelled `WAIVED` /
   `OVERRIDDEN` with the reason, technician and timestamp visible without expanding.
2. Comment thread verified on jobs inside the signed-in account (a job belonging to another
   customer correctly 404s, which is what the tester hit).
3. Preflight streaming re-verified end to end, with and without reduced motion: 5 rows at 1.3s,
   12 rows at 5.5s.

Also fixed after review: sort-header buttons were not inheriting `text-transform`; the queue's
due cell clipped its overdue label; a non-fitting imposition now draws in magenta with
`PAGES OVER THE SHEET EDGE` rather than looking broken; the bleed diagram labels were too small.

## If work continues

- Print stylesheet for the job ticket and the proof sheet (a shop prints these).
- Job history / audit panel listing every waiver and state change in one place.
- `/prepress` bulk actions (plate several jobs at once) and a shift handover note.
- Swap the fixtures for the NestJS API: delete `src/lib/api/fixtures/`, `store.ts`, `delay.ts`
  and the demo clock, and point each module at the real endpoints. No screen changes.
