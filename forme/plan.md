# plan.md

## 1. Objectives
- Replace the CRA/FastAPI/Mongo template with a **Next.js (App Router) + TypeScript (strict) + Tailwind CSS 4** frontend in `/app/frontend` (package name `forme`).
- Implement **11 routes** with the specified art direction (print-production UI furniture), dense data-first layouts, and accessibility semantics.
- Create a **hard data seam**: all reads/writes in `src/lib/api/*`, fixtures only in `src/lib/api/fixtures/*`, shared types in `src/lib/types.ts`, and money formatting in `src/lib/money.ts`.
- Prove the **core “failure-prone” flows** work early: URL-driven quote, preflight streaming (no component timers), filesystem uploads via Server Action helper, imposition SVG arithmetic, floor polling.
- Ship with **no backend, no DB, no auth library, no .env, no /api route handlers**, and with passing `tsc --noEmit` + `next build`.

## 2. Implementation Steps

### Phase 1 — Core POC (isolation-first)
**Goal:** validate the environment constraints + core seams before building the full UI.

1) **Re-scaffold frontend**
- Create fresh Next.js app (App Router) in `/app/frontend`.
- Install Tailwind v4 (`tailwindcss`, `@tailwindcss/postcss`, `postcss`) and fontsource packages.
- Configure `next.config.ts` with `output: 'standalone'`.
- Remove CRA artifacts and delete `.env` usage.
- Update supervisor expectations: keep port 3000 `yarn start` working.

2) **Remove unused backend/database**
- Delete `/app/backend` and Mongo usage from supervisor (or disable programs) so nothing unused runs.

3) **POC: URL-state quote (server render) + deterministic money**
- Implement `src/lib/money.ts` (integer pesos + `₱12,400` formatting).
- Implement `src/lib/api/pricing.ts` + fixtures for `PriceMatrix`.
- Implement `src/lib/api/quotes.ts`:
  - Parse/validate query → compute quote result (subtotal, VAT line, total)
  - Press assignment rule (INDIGO < 500; litho ≥ 500; choose XL75/G40 by simple deterministic rule)
  - Working-day despatch date function (no `Date.now()` on server; pass ISO constants + compute in pure functions).
- Build `/quote` page: server component `await searchParams`, renders form + output; client leaf updates query string.

4) **POC: preflight streaming seam (no timers in components)**
- Define `src/lib/api/preflight.ts` with `subscribeToPreflight(jobId, onCheck) => unsubscribe`.
- Put all timing/staggering in the data layer (single helper delay).
- Build a minimal client demo component that subscribes and renders checks landing one-by-one + a single `aria-live="polite"` region.

5) **POC: uploads to filesystem without /api**
- Implement `src/lib/api/uploads.ts` to write to `.uploads/`.
- Create a Server Action used by `/app/new` to accept file input and persist metadata; no route handlers.

6) **POC: params/searchParams are Promises**
- Create a minimal dynamic route that awaits `params` and renders deterministic content.

7) **Validation gate (don’t proceed until green)**
- Run: `yarn typecheck` (or `tsc --noEmit`) with strict/noUnused on.
- Run: `yarn build`.
- Manually verify: quote link is shareable; preflight stream lands; upload writes into `.uploads/`.

**Phase 1 user stories**
1. As a customer, I can share a quote by copying the URL and see the same totals on another machine.
2. As a user, I can see VAT shown as a separate line item, never baked into unit price.
3. As a user, I can watch preflight checks land one-by-one without the UI freezing.
4. As a user, I can upload artwork and know it was received (file appears in the job file list).
5. As a developer, I can replace fixtures with a real API later by editing only `src/lib/api/*`.

---

### Phase 2 — V1 App Development (all routes)
**Goal:** implement the full product surfaces using the proven seams.

1) **Global foundations**
- Route groups + layouts: `(marketing)`, `(portal)`, `(prepress)`, `(floor)`, `(admin)`.
- Root layout: skip link, nav outside main, fonts loaded via fontsource, `globals.css` tokens (`@theme`), base typography rules.
- Common components: status marks (shape+label), hairline rules, tables, skeletons, confirmation dialog (hand-rolled), SVG furniture (aria-hidden).

2) **Session role gating (single place)**
- `src/lib/api/session.ts`: read/write cookie via Server Actions.
- Layout gating in group layouts only:
  - default role = Customer
  - `/prepress`, `/floor`, `/admin` show “sign in as …” notice rather than hard failure.

3) **Build routes in required order**
- `/` marketing: presses/specs/sizes/turnaround; restrained SVG hero.
- `/specs`: anchored technical manual content + SVG trim/bleed diagram + “downloadable” summary block + metadata.
- `/quote`: full calculator with URL query state; output includes press reason, sheets/up-count, dispatch date.
- `/sign-in`: form + demo role picker → sets cookie → redirects.
- `/app`: job list table (sortable headers as buttons; URL filter; streaming loading skeleton).
- `/app/jobs/[id]`: job spine (timeline, preflight report, SVG proof viewer with toggles, approve/reject w/ confirmation, comments, files/spec panel).
- `/app/new`: spec form + upload showpiece; preflight stream + aria-live.
- `/prepress`: global queue dense table; overdue in magenta; keyboard navigable rows.
- `/prepress/jobs/[id]`: waive/override with required reason; imposition planner inputs + live SVG sheet + derived arithmetic outputs.
- `/floor`: press board on ink ground; giant mono numerals; polling hook in data layer for ticking values.
- `/admin/pricing`: editable price matrix table; inline validation; save via Server Actions to data layer.

4) **Data layer completion**
- Types: `src/lib/types.ts` for all domain objects.
- Modules: `jobs.ts, customers.ts, presses.ts, pricing.ts, quotes.ts, preflight.ts, imposition.ts, session.ts`.
- Fixtures: 5 customers, ~22 jobs across all states (incl HELD x2, CANCELLED x1), 3 presses + queues, full price matrix, 3 preflight report shapes.
- Single delay helper used by all API functions (80–250ms) to make loading states visible.

5) **Loading/error/not-found coverage**
- Every route: `loading.tsx` skeleton matching geometry.
- App-level: `error.tsx`, `not-found.tsx` with precise copy.

6) **Motion + reduced motion**
- Only specified animations; all behind `prefers-reduced-motion`.

7) **Phase 2 test pass**
- One end-to-end sweep: navigation, role gating, quote URL, sorting/filtering, job detail actions, preflight stream, imposition relayout, floor ticks, pricing edits.
- Fix build/typecheck warnings immediately.

**Phase 2 user stories**
1. As a customer, I can find a job by sorting and filtering the table without losing my place.
2. As a customer, I can approve a proof only after a deliberate confirmation step.
3. As a prepress tech, I can override a failed check only after typing a reason that becomes part of the job record.
4. As press floor staff, I can read the current job reference and time remaining from across the room.
5. As an admin, I can edit pricing with the keyboard and get exact, field-specific validation.

---

### Phase 3 — Hardening + UX density pass
- Tighten table truncation/wrapping rules to prevent layout breaks.
- Expand keyboard navigation (row focus patterns, skip links, focus return after actions).
- Add more deterministic fixtures to cover edge cases (long refs/descriptions, max quantities, multiple finishes).
- Performance pass: ensure client components are leaf-only; reduce rerenders in quote UI.
- Run a full regression: `typecheck`, `build`, and manual accessibility spot checks (labels, aria-sort, aria-live behavior).

**Phase 3 user stories**
1. As a user, I can navigate every interactive element using only a keyboard with visible focus.
2. As a colour-blind user, I can understand every status via label + mark shape, not colour.
3. As a customer, I can trust the quote totals because money formatting is consistent everywhere.
4. As a prepress tech, I can compare measured vs tolerance values quickly because they align in mono.
5. As an operator, I can leave the floor board open all day without it drifting or breaking layout.

## 3. Next Actions
1) Scaffold Next.js + Tailwind v4 + fontsource in `/app/frontend`, remove CRA and `.env`.
2) Remove backend/mongodb supervisor programs and delete unused directories.
3) Implement Phase 1 POC seams: money/quote URL state, preflight subscribe seam, uploads Server Action write.
4) Pass `tsc --noEmit` and `next build` before proceeding.

## 4. Success Criteria
- Next.js app runs on port 3000 behind the proxy; no backend services required.
- No `/api` routes exist; no `.env` exists; no unused deps.
- All 11 routes exist, render, and match design + accessibility constraints.
- Quote state is fully in URL; prices are whole pesos with VAT line; press choice + reason shown.
- Preflight streaming lands check-by-check via `subscribeToPreflight` with **no timers in components**.
- Imposition planner renders correct SVG relayout based on inputs.
- Floor board is legible at distance and updates via polling seam.
- Typecheck passes strict/noUnused; production build succeeds.
