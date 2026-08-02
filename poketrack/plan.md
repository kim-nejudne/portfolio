# plan.md — PokéTrack (UPDATED)

## Objectives
- ✅ Prove the **core progression engine** works with real PokéAPI data: XP→Level, evolution gates (real + synthetic), cascade, branching, and reversals **derived only from `SUM(xp_events.xp_awarded)`**.
- ✅ Ship full end-to-end MVP: teams + invites + projects + forced starter gate + tickets board + XP ledger + evolution cutscene + leaderboard + prestige + shiny.
- ✅ Maintain non-negotiables: Fibonacci validation, per-mutation membership checks, single-transaction writes, reload-safe pending evolution, **no component libraries**, reduced-motion support.
- ✅ Validate with comprehensive automated testing (backend + frontend) and patch any gaps.

**Current status:** PokéTrack MVP is complete and demo-ready.

---

## Implementation Steps

### Phase 1 — Core Progression Engine POC (must pass before UI)
**Goal:** deterministic, unit-tested Python core that matches PokéAPI realities and all edge cases.

✅ Completed

1. **Confirm PokéAPI realities (growth + evolution chains)**
   - Growth-rate `levels[]` parsed into cumulative XP thresholds.
   - Evolution chains parsed into a tree/graph with branching.
   - Evolution gates:
     - Real `min_level` used when present.
     - Non-level triggers mapped to synthetic evolution level (default 30).
     - Gates scaled by `evolution_level_pct`.

2. **Minimal POC module (pure functions + cache)**
   - `pokeapi_client.py`: fetch JSON + file cache.
   - `engine.py` (pure):
     - `level_from_xp(xp, growth_table) -> level` (XP floors at 0; level floors at 1)
     - `resolve_evolutions(...) -> none|single|choice(list)`
     - `commit_single_path(...)` for cascade behavior
     - `derive_state_from_ledger(...)` recomputes current species + evolution history from immutable ledger

3. **POC tests (`test_core.py`, no UI)**
   - ✅ Pre-warmed + validated all 27 starters resolve their evolution chains.
   - ✅ Verified growth-rate table behavior at exact thresholds.
   - ✅ Simulations verified:
     - Charmander evolves at 16 and 36.
     - Cascade evolution on huge XP award.
     - Eevee branching at synthetic level 30 returns multi-choice.
     - Reversal drops level and devolves; evolution history rolls back.
     - Reversal below branch gate clears pending.
     - Level gate scaling via `evolution_level_pct`.

**Outcome:** 60/60 POC tests passed against real PokéAPI.

**Phase-1 user stories**
✅ All complete.

---

### Phase 2 — V1 App Development (build around proven core)
**Goal:** deliver the complete playable product loop with the specified UX.

✅ Completed

1. **Backend (FastAPI + MongoDB)**
   - Collections + indexes:
     - `users`, `teams`, `memberships`, `invites`, `projects`, `tickets`, `player_pokemon`, `xp_events`, `evolutions`, `pokeapi_cache`.
     - Unique indexes for: `users.email`, `(team_id,user_id)`, `(project_id,user_id)`, `invites.token`, `pokeapi_cache.key`.
   - Auth: email/password (bcrypt) + JWT.
   - Authorization: membership checked on every mutation.
   - PokéAPI caching:
     - Mongo-backed cache + **startup pre-warm** for 27 starters + evolution chains + growth rates.
     - Best-effort fallback to local on-disk cache if network unavailable.
   - Ticket lifecycle with Fibonacci validation:
     - Create/update/move/delete.
     - Done transitions create XP ledger events.
     - Undo/delete Done writes compensating reversal events.
     - Editing story points on Done writes adjustment event.
   - Pokémon state: derived endpoint recomputes from ledger + cached chain + growth rate.
   - Evolution:
     - Auto-cascade single-path evolutions.
     - Branching evolutions yield a persistent pending state.
     - `POST choose-evolution` re-derives eligibility server-side.
   - Prestige:
     - Final-stage only.
     - Increments prestige, sets `xp_baseline`, clears evolution history, re-rolls shiny.
   - Leaderboard:
     - Includes all members (including 0 XP).
     - Sorted by lifetime XP then level.
     - Competition ranking for ties (1,1,3).

2. **Frontend (React + Tailwind + Framer Motion; fully custom UI)**
   - ✅ Hand-built design system primitives (no shadcn/material/chakra):
     - GameFrame, DialogueBox, GameButton, TypeChip, PokéBall loader, Toaster.
     - XPBar hero element with segmented fill + shine sweep.
     - LevelUpBanner.
   - ✅ Ambient background (aurora + hex grid + speed stripes).
   - ✅ Routes implemented:
     - Landing, sign-in, sign-up, teams, team detail, team settings,
       project, project settings, invite acceptance.
   - ✅ Forced starter picker gate on first project visit.
   - ✅ Project main screen:
     - Board with 3 columns + DnD.
     - Keyboard-accessible move left/right buttons on tickets.
     - TicketModal for create/edit.
     - PartnerPanel with sprite, type gradient, XP bar, evolution history.
     - Leaderboard tab.
   - ✅ Evolution cutscene:
     - Full-screen takeover + flash/rays/confetti + typed dialogue.
     - Respects reduced-motion preferences.

3. **Incremental integration tests during build**
   - ✅ API smoke tests performed repeatedly while implementing slices.
   - ✅ Live progression verified:
     - Charmander reaches level 16 and evolves to Charmeleon.
     - Reversal drops XP below threshold and devolves cleanly.

**Phase-2 user stories**
✅ All complete.

---

### Phase 3 — Testing & Polish (stability + definition-of-done demo)
**Goal:** confirm correctness, enforce invariants, and ensure a demo-ready experience.

✅ Completed (with one minor fix applied)

1. **Backend test suite (testing_agent_v3)**
   - Result: **87/88 tests passed (98.9%)**.
   - One minor issue found:
     - `/api/auth/me` returned 200 when `Authorization: ""` (empty string) was sent.
     - ✅ Fixed by hardening the `current_user_id` dependency to treat empty/blank tokens as missing.

2. **Frontend flow tests (testing_agent_v3)**
   - Result: **100% critical flows passed**.
   - Full flow validated:
     - Sign up → teams → team create → project create → forced starter gate
     - Pick Charmander → board visible → create Done tickets → XP updates
     - Evolution cutscene triggers at level 16 and updates partner panel
     - Leaderboard renders and includes the current user

3. **Console warning follow-up**
   - A React warning was reported by the testing agent (`<span>` inside `<option>`),
     but could not be reproduced; no blocking behavior observed.

**Phase-3 user stories**
✅ All complete (note: branching evolution user story is validated in Phase 1 POC; the 27 approved starters are linear so branching cannot naturally occur in normal v1 gameplay without selecting a branching species).

---

## Next Actions
1. ✅ Prepare a **demo script** (recommended live demo path):
   - Sign up → Create team → Create project → Starter gate → Pick Charmander
   - Create ~24 Done tickets at 13 points (or increase XP-per-point temporarily in settings)
   - Watch **LEVEL UP** and evolution cutscene to Charmeleon
   - Undo enough Done tickets → confirm clean devolution back to Charmander
   - Open Leaderboard → confirm rank + XP consistency
2. Optional polish (non-blocking):
   - Add an “Adjust XP-per-point” quick toggle for demos (already available in settings).
   - Add explicit UI copy on branching: “Some Pokémon can branch; you’ll be prompted when eligible.”
   - Investigate any intermittent console warnings if they reappear.

---

## Success Criteria
- ✅ **Phase 1:** `test_core.py` passes fully using real PokéAPI data + cache; deterministic evolution/branching/reversal behavior. (**60/60 passed**)
- ✅ **Phase 2:** Live flow works end-to-end: sign up → team → project → forced starter → tickets → Done awards XP → XP bar animates → **Charmander evolves at 16 with cutscene** → leaderboard updates.
- ✅ **Phase 3:** Un-complete ticket cleanly devolves; prestige works; all rules enforced server-side; reduced-motion supported; no off-the-shelf component library used; automated E2E validation complete. (**Backend 87/88 then patched; Frontend 100%**)