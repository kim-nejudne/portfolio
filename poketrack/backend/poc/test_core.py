"""POC test script for the PokéTrack progression engine.

Covers, in one file:
  * PokéAPI client fetch + cache for the 27 starters + evolution chains + growth rates
  * Pure engine (level_from_xp, resolve_evolutions, commit_single_path)
  * Charmander → Charmeleon at level 16, → Charizard at level 36
  * Cascade: one giant XP award auto-evolves through multiple stages
  * Branch: Eevee at synthetic level 30 returns ≥2 eligible options; picking Vaporeon commits
  * Reversal: appending a negative XP event drops Charmeleon back to Charmander & rolls history
  * Reversal below branch gate clears the pending state
  * Level/XP flooring behavior
"""
from __future__ import annotations

import sys
from typing import Dict, List, Tuple

from pokeapi_client import (
    chain_id_from_species,
    get_evolution_chain,
    get_growth_rate,
    get_pokemon,
    get_species,
    growth_rate_name_from_species,
)
from engine import (
    EvoNode,
    build_growth_table,
    commit_single_path,
    derive_state_from_ledger,
    find_node,
    level_from_xp,
    parse_chain,
    resolve_evolutions,
)


# 27 gen 1-9 base starters by species id (order per spec)
STARTERS = [
    (1, "Bulbasaur"), (4, "Charmander"), (7, "Squirtle"),
    (152, "Chikorita"), (155, "Cyndaquil"), (158, "Totodile"),
    (252, "Treecko"), (255, "Torchic"), (258, "Mudkip"),
    (387, "Turtwig"), (390, "Chimchar"), (393, "Piplup"),
    (495, "Snivy"), (498, "Tepig"), (501, "Oshawott"),
    (650, "Chespin"), (653, "Fennekin"), (656, "Froakie"),
    (722, "Rowlet"), (725, "Litten"), (728, "Popplio"),
    (810, "Grookey"), (813, "Scorbunny"), (816, "Sobble"),
    (906, "Sprigatito"), (909, "Fuecoco"), (912, "Quaxly"),
]

EEVEE_ID = 133
CHARMANDER = 4
CHARMELEON = 5
CHARIZARD = 6
VAPOREON = 134


PASS = 0
FAIL = 0


def _label(status: bool) -> str:
    return "\033[92mPASS\033[0m" if status else "\033[91mFAIL\033[0m"


def check(cond: bool, msg: str) -> bool:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  {_label(True)}  {msg}")
    else:
        FAIL += 1
        print(f"  {_label(False)}  {msg}")
    return cond


def section(name: str) -> None:
    print(f"\n== {name} ==")


def fetch_root_for(species_id: int) -> EvoNode:
    sp = get_species(species_id)
    chain = get_evolution_chain(chain_id_from_species(sp))
    return parse_chain(chain)


def load_growth_for_species(species_id: int) -> List[Tuple[int, int]]:
    sp = get_species(species_id)
    gr = get_growth_rate(growth_rate_name_from_species(sp))
    return build_growth_table(gr)


# ---------------------------------------------------------------------------
# 1. Data availability — pre-warm all 27 starters + chains + growth rates.
# ---------------------------------------------------------------------------
def test_data_availability() -> Dict[str, EvoNode]:
    section("Data availability (pre-warming cache for 27 starters)")
    roots: Dict[str, EvoNode] = {}
    growth_names: set[str] = set()
    for sid, name in STARTERS:
        try:
            sp = get_species(sid)
            growth_names.add(growth_rate_name_from_species(sp))
            chain = get_evolution_chain(chain_id_from_species(sp))
            root = parse_chain(chain)
            check(find_node(root, sid) is not None, f"{name} (id={sid}) chain contains itself")
            roots[name] = root
            # Also make sure the pokemon endpoint works (used for sprites/types later)
            _ = get_pokemon(sid)
        except Exception as e:  # noqa: BLE001
            check(False, f"failed to load {name} (id={sid}): {e}")
    check(len(roots) == 27, f"loaded 27/27 starters (got {len(roots)})")
    # Also pre-warm growth rates for the set encountered
    for gname in growth_names:
        try:
            _ = get_growth_rate(gname)
            check(True, f"growth-rate/{gname} loaded")
        except Exception as e:  # noqa: BLE001
            check(False, f"growth-rate/{gname} failed: {e}")
    return roots


# ---------------------------------------------------------------------------
# 2. Charmander real evolution ladder — 16 → Charmeleon, 36 → Charizard.
# ---------------------------------------------------------------------------
def test_charmander_ladder(roots: Dict[str, EvoNode]) -> None:
    section("Charmander → Charmeleon @16, → Charizard @36")
    root = roots["Charmander"]
    # level 15: none
    kind, payload = resolve_evolutions(root, CHARMANDER, level=15)
    check(kind == "none", f"level 15 Charmander has no evolution (got {kind}, {payload})")
    # level 16: single Charmeleon
    kind, payload = resolve_evolutions(root, CHARMANDER, level=16)
    check(kind == "single" and payload == CHARMELEON, f"level 16 evolves to Charmeleon (got {kind}, {payload})")
    # level 35 Charmeleon: still none
    kind, payload = resolve_evolutions(root, CHARMELEON, level=35)
    check(kind == "none", f"level 35 Charmeleon has no evolution (got {kind}, {payload})")
    # level 36 Charmeleon: single Charizard
    kind, payload = resolve_evolutions(root, CHARMELEON, level=36)
    check(kind == "single" and payload == CHARIZARD, f"level 36 Charmeleon evolves to Charizard (got {kind}, {payload})")
    # Charizard has no children
    kind, payload = resolve_evolutions(root, CHARIZARD, level=100)
    check(kind == "none", "Charizard is final")


# ---------------------------------------------------------------------------
# 3. Cascade — start at Charmander, jump to level 50, must land on Charizard.
# ---------------------------------------------------------------------------
def test_cascade(roots: Dict[str, EvoNode]) -> None:
    section("Cascade — Charmander jumps to level 50 in one recompute")
    root = roots["Charmander"]
    final, hops, pending = commit_single_path(root, CHARMANDER, level=50)
    check(final == CHARIZARD, f"final species is Charizard (got {final})")
    check(len(hops) == 2, f"exactly 2 hops recorded (got {len(hops)})")
    check(not pending, "no pending branch after cascade")


# ---------------------------------------------------------------------------
# 4. XP → level using the real growth-rate table.
# ---------------------------------------------------------------------------
def test_level_from_xp() -> None:
    section("level_from_xp respects growth-rate thresholds")
    # Charmander uses medium-slow growth rate
    sp = get_species(CHARMANDER)
    gr = get_growth_rate(growth_rate_name_from_species(sp))
    table = build_growth_table(gr)
    check(level_from_xp(0, table) == 1, "0 XP → level 1")
    check(level_from_xp(-9999, table) == 1, "negative XP floors at level 1")
    # Look up the exact threshold for level 16 in medium-slow: should map to exactly 16.
    lvl16_threshold = dict(table)[16]
    check(level_from_xp(lvl16_threshold, table) == 16, f"exact lvl16 threshold ({lvl16_threshold}) → level 16")
    check(level_from_xp(lvl16_threshold - 1, table) == 15, "one below lvl16 threshold → level 15")
    # a very large XP maxes out at level 100
    check(level_from_xp(10_000_000, table) == 100, "huge XP → level 100")


# ---------------------------------------------------------------------------
# 5. Eevee branch at synthetic level 30.
# ---------------------------------------------------------------------------
def test_eevee_branch() -> None:
    section("Eevee branch at synthetic level 30 → ≥2 eligible options")
    sp = get_species(EEVEE_ID)
    chain = get_evolution_chain(chain_id_from_species(sp))
    root = parse_chain(chain)
    check(find_node(root, EEVEE_ID) is not None, "Eevee node parsed from chain")
    # level 29: nothing yet
    kind, payload = resolve_evolutions(root, EEVEE_ID, level=29, synthetic_level=30)
    check(kind == "none", f"level 29 Eevee: no evolution (got {kind}, {payload})")
    # level 30: choice with many options
    kind, payload = resolve_evolutions(root, EEVEE_ID, level=30, synthetic_level=30)
    check(kind == "choice", f"level 30 Eevee → choice (got {kind})")
    check(isinstance(payload, list) and VAPOREON in payload, f"Vaporeon is one of the choices")
    check(isinstance(payload, list) and len(payload) >= 7, f"Eevee has ≥7 branch options (got {len(payload) if isinstance(payload, list) else 0})")
    # Committing Vaporeon: since Vaporeon has no children, commit_single_path from Vaporeon is fine
    final, hops, pending = commit_single_path(root, VAPOREON, level=30, synthetic_level=30)
    check(final == VAPOREON and not pending, "Vaporeon after commit stays as Vaporeon (final form)")


# ---------------------------------------------------------------------------
# 6. Ledger-driven state — award, evolve, then reverse and devolve.
# ---------------------------------------------------------------------------
def test_ledger_reversal(roots: Dict[str, EvoNode]) -> None:
    section("Ledger reversal → clean devolution")
    root = roots["Charmander"]
    table = load_growth_for_species(CHARMANDER)
    # find XP to reach level 20 (medium-slow @20)
    xp_lvl20 = dict(table)[20]

    ledger = [
        {"xp_awarded": xp_lvl20 // 2},
        {"xp_awarded": xp_lvl20 // 2 + 1},
    ]
    state = derive_state_from_ledger(ledger, CHARMANDER, root, table)
    check(state.level >= 20, f"combined XP reaches ≥ level 20 (got {state.level})")
    check(state.current_species_id == CHARMELEON, f"auto-evolved to Charmeleon (got {state.current_species_id})")
    check(len(state.evolutions_history) == 1, f"history has 1 hop (got {len(state.evolutions_history)})")

    # Reversal: append negative event that undoes half the XP → below level 16 again.
    ledger.append({"xp_awarded": -(ledger[0]["xp_awarded"] + ledger[1]["xp_awarded"])})
    state2 = derive_state_from_ledger(ledger, CHARMANDER, root, table)
    check(state2.total_xp == 0, f"total XP clamped/summed correctly (got {state2.total_xp})")
    check(state2.level == 1, f"level floors at 1 after reversal (got {state2.level})")
    check(state2.current_species_id == CHARMANDER, f"devolved to Charmander (got {state2.current_species_id})")
    check(state2.evolutions_history == [], f"evolution history rolled back (got {state2.evolutions_history})")


# ---------------------------------------------------------------------------
# 7. Reversal clears pending branch state (Eevee case).
# ---------------------------------------------------------------------------
def test_reversal_clears_pending() -> None:
    section("Reversal below branch gate clears pending choice (Eevee)")
    sp = get_species(EEVEE_ID)
    chain = get_evolution_chain(chain_id_from_species(sp))
    root = parse_chain(chain)
    gr = get_growth_rate(growth_rate_name_from_species(sp))
    table = build_growth_table(gr)
    xp_lvl30 = dict(table)[30]
    ledger = [{"xp_awarded": xp_lvl30}]
    state = derive_state_from_ledger(ledger, EEVEE_ID, root, table)
    check(state.pending_evolution, f"Eevee at level 30 is pending (got pending={state.pending_evolution})")
    # reverse it all
    ledger.append({"xp_awarded": -xp_lvl30})
    state2 = derive_state_from_ledger(ledger, EEVEE_ID, root, table)
    check(not state2.pending_evolution, f"Pending cleared after reversal (got pending={state2.pending_evolution})")
    check(state2.current_species_id == EEVEE_ID, f"still Eevee after reversal (got {state2.current_species_id})")


# ---------------------------------------------------------------------------
# 8. Evolution level-pct scaling — 50% of Charmander gate is level 8.
# ---------------------------------------------------------------------------
def test_level_pct_scaling(roots: Dict[str, EvoNode]) -> None:
    section("evolution_level_pct scales gates (50% → Charmander evolves at 8)")
    root = roots["Charmander"]
    kind, payload = resolve_evolutions(root, CHARMANDER, level=7, level_pct=50)
    check(kind == "none", f"pct=50, level 7 stays Charmander (got {kind})")
    kind, payload = resolve_evolutions(root, CHARMANDER, level=8, level_pct=50)
    check(kind == "single" and payload == CHARMELEON, f"pct=50, level 8 → Charmeleon (got {kind},{payload})")


def main() -> int:
    print("PokéTrack — Phase 1 progression engine POC\n" + "=" * 60)
    roots = test_data_availability()
    test_charmander_ladder(roots)
    test_cascade(roots)
    test_level_from_xp()
    test_eevee_branch()
    test_ledger_reversal(roots)
    test_reversal_clears_pending()
    test_level_pct_scaling(roots)

    print("\n" + "=" * 60)
    print(f"Total: {PASS} passed, {FAIL} failed")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
