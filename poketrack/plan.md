# plan.md — PokéTrack

## Objectives
- Prove the **core progression engine** works with real PokéAPI data: XP→Level, evolution gates (real + synthetic), cascade, branching, and reversals **derived only from xp_events SUM**.
- Ship full end-to-end MVP: teams + invites + projects + forced starter gate + tickets board + XP ledger + evolution cutscene + leaderboard + prestige + shiny.
- Maintain non-negotiables: Fibonacci validation, per-mutation membership checks, single-transaction writes, reload-safe pending evolution, no component libraries, reduced-motion support.

---

## Implementation Steps

### Phase 1 — Core Progression Engine POC (must pass before UI)
**Goal:** deterministic, unit-tested Python core that matches PokéAPI realities and all edge cases.

1. **Web search (best practices / pitfalls)**
   - Confirm PokéAPI growth-rate tables + evolution-chain branching structure + triggers (min_level vs item/trade/happiness).
   - Confirm sprite sources (official-artwork vs front_default) and shiny availability.

2. **Minimal POC module (pure functions + cache)**
   - `pokeapi_client.py`: fetch JSON + store in `pokeapi_cache` (in-memory for POC), plus file cache optional.
   - `growth_rate.py`: parse growth-rate `levels[]` → cumulative XP thresholds.
   - `evolution_chain.py`: parse chain into graph nodes with triggers; compute eligible evolutions at a given level.
   - `engine.py` (pure):
     - `level_from_xp(xp, growth_rate_table) -> level` (floor 1, xp floor 0)
     - `resolve_evolutions(species_id, level, settings) -> none|single|choice(list)`
     - `commit_choice(...) -> new_species_id + cascade` (idempotent)
     - `recompute_state_from_ledger(ledger_events, base_species, settings, poke_data) -> derived_state`

3. **POC tests (single `test_core.py`, no UI)**
   - Fetch + cache growth rates for all types used by starters.
   - Fetch evolution chains for: Charmander, Bulbasaur, Eevee, Sprigatito, Fuecoco, Quaxly; verify all 27 starters resolve chain.
   - Simulations:
     - Charmander XP→level 16 evolves to Charmeleon; level 36 evolves to Charizard.
     - Cascade: huge XP jump evolves through multiple stages in one recompute.
     - Branch: Eevee at synthetic level 30 → `choice` with 8; commit Vaporeon.
     - Reversal: drop below 16 devolves and rolls back evolution history.
     - Reversal below branch gate clears pending.
   - Output: all tests green; deterministic logs for debugging.

**Phase-1 user stories**
1. As a developer, I can compute a trainer’s level from XP using the species’ real growth rate table.
2. As a developer, I can detect when a Pokémon hits a real evolution level (e.g., 16/36) and auto-cascade linear evolutions.
3. As a developer, I can surface a stable pending evolution choice for branching chains like Eevee.
4. As a developer, I can recompute state from an immutable XP ledger and correctly de-level/devolve on reversals.
5. As a developer, I can pre-warm and reuse PokéAPI responses without blocking gameplay.

---

### Phase 2 — V1 App Development (build around proven core)
**Goal:** deliver the complete playable product loop with the specified UX.

1. **Backend (FastAPI + MongoDB)**
   - Collections per provided schema; enforce unique indexes: memberships, player_pokemon (project,user).
   - Auth: email/password (bcrypt) + JWT; minimal profile (name/avatar).
   - Authorization middleware: on every mutation re-check team/project membership + role.
   - PokéAPI cache:
     - `pokeapi_cache` collection + startup pre-warm for 27 starters + evo chains + growth rates.
   - Core services:
     - Ticket mutations (create/edit/move/delete) with Fibonacci validation.
     - XP ledger write model:
       - Done→award: create `xp_events` row signed + link ticket.
       - Undo/edit/delete Done: compensating reversal/adjustment row.
       - Every mutation: single DB transaction.
     - Derived Pokémon state endpoint: compute from `SUM(xp_events.xp_awarded)` + evolution history reconciliation.
     - Evolution endpoints:
       - `GET pending-evolution` (if any)
       - `POST choose-evolution` (server re-derives eligibles, commits + cascades same transaction, idempotent)
     - Prestige endpoint: final-stage only; increments prestige, sets xp_baseline, re-roll starter+shiny, clears evolution history.
   - Leaderboard endpoint: all members incl 0-XP; ties ranking (1,1,3).

2. **Frontend (React + Tailwind + Framer Motion; fully custom UI)**
   - Build a small design system (no libraries): beveled frames, dialogue boxes, 3D buttons, type chips, Poké Ball loader, toasts.
   - App shell: dark-mode default + optional light mode; ambient parallax background.
   - Routes:
     - Landing → Sign-in/Sign-up → Teams → Team detail (projects/roster/invites) → Project.
     - Invite acceptance route handling all states.
   - Project route hard gate:
     - If no `player_pokemon` for user: forced starter picker (Prof Oak + 27 starters + shiny reveal moment).
   - Board:
     - 3 columns, DnD + keyboard moves, optimistic UI + server reconciliation.
     - Add/edit ticket modals; Done drop triggers confetti burst.
   - Partner panel:
     - Sprite (pixelated), type-colored gradient bg, XP bar hero animation, evolution history, branch CTA, prestige CTA.
   - Evolution cutscene:
     - Full-screen takeover with silhouette morph, flash/rays/confetti, typed dialogue; reduced-motion bypass.
   - Leaderboard:
     - Tournament-plate style top 3 medals, shimmer for current user.

3. **Incremental integration tests during build**
   - After each backend slice: quick API smoke tests (auth, membership checks, ticket move writes ledger, derived recompute).
   - After each frontend slice: run core flow manually: starter→ticket→done→XP→level up→evolve.

**Phase-2 user stories**
1. As a new user, I can sign up and see an inviting empty Teams screen.
2. As a team owner, I can create a team, invite by email, and manage pending invites.
3. As a member, I can accept an invite link and immediately see team projects.
4. As a trainer, my first project visit forces a starter pick and rolls shiny with a reveal moment.
5. As a trainer, I can move tickets to Done and watch XP/level/evolution update and reflect on the leaderboard.

---

### Phase 3 — Testing & Polish (stability + definition-of-done demo)
1. **Backend test suite**
   - Auth, teams/memberships, invites (dedupe/idempotency), projects/settings, ticket lifecycle, ledger correctness, evolution cascade/branch, reversal/devolution, prestige.

2. **Frontend flow tests + a11y pass**
   - Route gating (starter picker), modal focus trap, keyboard DnD controls, reduced-motion behavior, contrast checks.

3. **Performance + correctness**
   - Verify all derived fields come from `SUM(xp_events.xp_awarded)`.
   - Verify every mutation is one transaction and re-checks membership.
   - Validate PokéAPI cache warm start and fallback behavior.

**Phase-3 user stories**
1. As a user, I can undo a Done ticket and see my Pokémon devolve correctly with no broken pending states.
2. As a user, I can edit story points on a completed ticket and the ledger adjusts without mutation of history.
3. As a user, I can pick an Eevee branch at level 30 and it persists across reload.
4. As a user with reduced-motion enabled, I can still evolve and see the result without cutscene/shake.
5. As an owner, I can delete a project only after type-the-name confirmation.

---

## Next Actions
1. Implement Phase 1 POC files: `pokeapi_client.py`, `growth_rate.py`, `evolution_chain.py`, `engine.py`, `test_core.py`.
2. Run the POC tests until all scenarios pass (Charmander 16/36, cascade, Eevee branching, reversals).
3. Lock the engine API (function signatures + expected outputs) and only then scaffold FastAPI/Mongo + React app.

---

## Success Criteria
- **Phase 1:** `test_core.py` passes fully using real PokéAPI data + cache; deterministic evolution/branching/reversal behavior.
- **Phase 2:** Live flow works end-to-end: sign up → team → project → forced starter → tickets → Done awards XP → XP bar animates → **Charmander evolves at 16 with cutscene** → leaderboard updates.
- **Phase 3:** Un-complete ticket cleanly devolves; Eevee branch modal persists; prestige works; all rules enforced server-side; reduced-motion supported; no off-the-shelf component library used.
