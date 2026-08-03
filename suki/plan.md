# SUKI — Frontend Plan (V1)

## 1) Objectives
- Deliver a mobile-first (360×640) ruled-ledger UI with 9 routes, fixed bottom nav, and strict typography/palette rules.
- Implement an offline-first data layer: async reads, optimistic writes via a single queued-ops spine, visible sync status, and deterministic fixtures.
- Ensure correctness constraints: integer pesos only, one money formatter, append-only ledger, no fixture imports outside `src/lib/api`, no forbidden motion/libs.
- Ship production build + strict typecheck with zero unused deps.

## 2) Implementation Steps

### Phase 1 — Core flow POC (no external integrations; validate offline queue + ledger correctness)
1. Rebuild frontend as Vite + React + TS (strict) + Tailwind v4; keep runtime port 3000.
2. Implement data-layer skeleton only:
   - `src/lib/types.ts`, `money.ts` (integer-only), `api/delay.ts` (single artificial delay helper)
   - `api/queue.ts` (enqueue/subscribe/pending + single drain timer; no component timers)
   - `api/fixtures/*` (deterministic customers/items/ledger, fixed ISO strings)
   - `api/customers.ts`, `api/items.ts`, `api/ledger.ts`, `api/sales.ts`, `api/stock.ts`, `api/session.ts`
3. Build 3 minimal POC screens:
   - Till: add 1–3 items → LISTA picker → commit sale (queued)
   - Customer ledger: render as `<table>` with running balance + pending state
   - Pending ops sheet: tap sync indicator → list pending
4. POC verification (must pass before Phase 2):
   - Sale appears immediately as `pending` then settles via drain.
   - Money formatting is `₱` + whole integers only.
   - No `new Date()` / `Math.random()` in fixtures or render paths.

**Phase 1 user stories (POC)**
1. As Aling Rosa, I can tap 3 items on the till and see the running total update instantly.
2. As Aling Rosa, I can choose LISTA, pick Aling Bebang, and the credit sale appears immediately (marked pending).
3. As Aling Rosa, I can open Bebang’s page and see all amounts right-aligned in mono with a running balance.
4. As Aling Rosa, I can tap the sync indicator and see exactly which operations are pending.
5. As Aling Rosa, I can use the app with “offline” state and never wait on spinners for writes.

---

### Phase 2 — V1 App Development (full 9 routes + shell + styling)
1. App foundation
   - Replace CRA with Vite project; remove `.env` usage; ensure `yarn start` runs Vite on `0.0.0.0:3000`.
   - Tailwind v4 via `@tailwindcss/vite`; define palette/type/spacing as CSS variables in `index.css` and only reference variables (no hex literals in components).
   - Self-host fonts via `@fontsource-variable/instrument-sans` + `@fontsource/martian-mono` (≤3 weights).
2. App shell + navigation
   - Router: 9 routes + 404; one `<h1>` per route; skip link; `<nav>` outside `<main>`.
   - Fixed bottom bar (≤4 destinations: Till, Lista, Stock, Day) + sync indicator (SYNCED / N PENDING / OFFLINE).
   - Content padding uses CSS var for bottom bar height; use `dvh` not `vh`.
3. Implement routes in priority order
   - `/` Till: search + most-sold grid; tap to add; pinned sale summary; BAYAD and LISTA flows.
   - `/lista`: customer list ordered by utang; summary strip (total credit out, days to next payday) + payday state on 15th/last day.
   - `/lista/:customerId`: ledger notebook `<table>`; append-only; RECORD A PAYMENT (partial allowed).
   - `/stock`: ruled list + filters (all/low/out); out-of-stock row includes “OUT” text.
   - `/stock/:itemId`: tingi breakdown (buy unit, sell unit, conversion) + live margin calc on buy-price edit; stock movement list.
   - `/restock`: checkable market list, biggest type, estimated total.
   - `/day`: closing summary (cash, credit extended, payments received, difference).
   - `/unlock`: PIN gate with on-screen keypad (no system keyboard), aria-live entry length.
   - `/settings`: store details + payday dates + reorder point.
4. Identity without images
   - `src/lib/monogram.ts`: deterministic 2-letter monogram + deterministic 6-color chip from name hash.
5. Motion (only the allowed 4 moments)
   - CSS-only transform/opacity; wrap in `prefers-reduced-motion: no-preference`.

**Phase 2 user stories (V1)**
1. As Aling Rosa, I can sell items on the till and complete BAYAD to record cash takings.
2. As Aling Rosa, I can extend utang via LISTA and see the customer’s balance increase immediately.
3. As Aling Rosa, I can record a partial payment on a customer and see a green entry appended with a new running balance.
4. As Aling Rosa, I can filter stock to “running low” and quickly see what needs restocking.
5. As Aling Rosa, I can open an item and change buy price to see margin update live without saving errors.
6. As Aling Rosa, I can use the restock list at the market and tick items off with large, high-contrast text.

**End of Phase 2:** run one end-to-end testing pass (routes + core flows) and fix before moving on.

---

### Phase 3 — Hardening + completeness (polish + edge cases + cleanup)
1. Tighten offline/sync simulation
   - Clear failure mode states (`failed`) and UI labeling (not color-only).
   - Pending-to-synced settle animation only via queue events.
2. Accessibility + layout robustness
   - Ensure all tap targets ≥48px; `type="button"` on all buttons; focus rings visible.
   - Long-name behavior: decide truncation/wrap per list; ensure no horizontal scroll at 360px.
3. Codebase hygiene
   - Ensure no unused deps, no unused locals/params; keep files <250 lines (split by screen/components).
   - Enforce “no fixtures import outside api” by refactor if needed.

**Phase 3 user stories (hardening)**
1. As Aling Rosa, I can see OFFLINE vs pending vs synced states clearly without relying on color alone.
2. As Aling Rosa, I can navigate the app fully by keyboard and always see where focus is.
3. As Aling Rosa, I can use the app on a small phone (360px) with no clipped content behind the bottom bar.
4. As Aling Rosa, I can review pending operations and understand what will sync later.
5. As Aling Rosa, I can trust that past ledger entries cannot be edited or deleted.

**End of Phase 3:** run one end-to-end testing pass and fix regressions.

---

## 3) Next Actions
1. Replace `/app/frontend` CRA scaffold with Vite + React + TS structure; update `package.json` name to `suki` and scripts for port 3000.
2. Add Tailwind v4 + fonts + base CSS variables + ruled-line primitives.
3. Implement Phase 1 POC data layer (`money.ts`, `types.ts`, `api/*`, deterministic fixtures) + 3 POC screens.
4. Verify POC checklist; only then proceed to full route build-out.

## 4) Success Criteria
- 9 routes navigable with correct bottom nav + 404.
- Offline-first: all writes go through `queue.ts`; optimistic UI; sync indicator + pending list.
- Money: integer-only everywhere; single formatter; no decimals.
- Ledger: `<table>` semantics, append-only, running balance aligned right in tabular mono.
- No photos/icons/icon libs; identity via monogram + deterministic color.
- Motion limited to the 4 allowed moments; reduced-motion shows static.
- Strict TS (`strict`, `noUnusedLocals`, `noUnusedParameters`) passes; `vite build` succeeds.
- No fixture imports outside `src/lib/api`; no `new Date()` / `Math.random()` in fixtures or render paths.
- Zero unused dependencies; no `src/components/ui/`; no component library packages.
