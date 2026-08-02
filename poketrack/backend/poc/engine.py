"""Pure progression engine — the heart of PokéTrack.

All functions here are DETERMINISTIC and depend only on their arguments and
the cached PokéAPI data passed in. No I/O, no globals.

Key guarantees:
  * level_from_xp(xp, growth_table) returns the highest level whose
    cumulative threshold ≤ xp. Floors at 1. XP is clamped ≥0.
  * resolve_evolutions(...) returns exactly one of:
        ("none", None)
        ("single", target_species_id)  # caller may cascade
        ("choice", [target_species_id, ...])  # stall for player pick
  * commit_single_path(...) walks single-path evolutions greedily,
    STOPPING as soon as it encounters a branch (choice) or a gate
    beyond current level. Used both for auto-cascade and after a
    player picks a branch.
  * derive_state_from_ledger(...) recomputes level+species+evolutions
    history from the base species and the XP ledger, so reversals just
    write a compensating event and re-derive; devolution falls out of
    that recomputation automatically.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Growth rate helpers
# ---------------------------------------------------------------------------

def build_growth_table(growth_rate_json: Dict[str, Any]) -> List[Tuple[int, int]]:
    """Return list of (level, cumulative_xp), sorted ascending by level."""
    levels = growth_rate_json.get("levels", [])
    table = [(int(lv["level"]), int(lv["experience"])) for lv in levels]
    table.sort(key=lambda x: x[0])
    return table


def level_from_xp(xp: int, growth_table: List[Tuple[int, int]]) -> int:
    xp = max(0, int(xp))
    current = 1
    for level, threshold in growth_table:
        if xp >= threshold:
            current = max(current, level)
        else:
            break
    return max(1, current)


def xp_needed_for_next(xp: int, current_level: int, growth_table: List[Tuple[int, int]]) -> Optional[Tuple[int, int]]:
    """Return (current_progress_in_level, xp_needed_for_next_level) or None if maxed."""
    xp = max(0, int(xp))
    # find threshold of current and next
    threshold_current = 0
    threshold_next = None
    for level, threshold in growth_table:
        if level == current_level:
            threshold_current = threshold
        if level == current_level + 1:
            threshold_next = threshold
            break
    if threshold_next is None:
        return None
    return (xp - threshold_current, threshold_next - threshold_current)


# ---------------------------------------------------------------------------
# Evolution chain parsing
# ---------------------------------------------------------------------------

def _species_id_from_url(url: str) -> int:
    parts = [p for p in url.split("/") if p]
    return int(parts[-1])


@dataclass
class EvoNode:
    species_id: int
    species_name: str
    # list of (child_node, details_list)
    children: List[Tuple["EvoNode", List[Dict[str, Any]]]] = field(default_factory=list)


def parse_chain(chain_json: Dict[str, Any]) -> EvoNode:
    """Recursively parse a /evolution-chain/{id}/ payload into an EvoNode tree."""
    root = chain_json["chain"]
    return _parse_node(root)


def _parse_node(node_json: Dict[str, Any]) -> EvoNode:
    sp = node_json["species"]
    node = EvoNode(
        species_id=_species_id_from_url(sp["url"]),
        species_name=sp["name"],
    )
    for child in node_json.get("evolves_to", []) or []:
        details = child.get("evolution_details", []) or []
        child_node = _parse_node(child)
        node.children.append((child_node, details))
    return node


def find_node(root: EvoNode, species_id: int) -> Optional[EvoNode]:
    if root.species_id == species_id:
        return root
    for c, _ in root.children:
        r = find_node(c, species_id)
        if r is not None:
            return r
    return None


def find_parent(root: EvoNode, species_id: int) -> Optional[EvoNode]:
    for c, _ in root.children:
        if c.species_id == species_id:
            return root
        r = find_parent(c, species_id)
        if r is not None:
            return r
    return None


# ---------------------------------------------------------------------------
# Gate resolution
# ---------------------------------------------------------------------------

def effective_gate(details_list: List[Dict[str, Any]], synthetic_level: int, level_pct: int) -> int:
    """Return the *effective* level required to evolve down this branch.

    Rule (from the spec):
      * if any of the evolution_details entries has a real min_level > 0, use it (min across entries).
      * otherwise, treat this branch as needing the synthetic level.
      * finally scale by level_pct/100, floored at 1.
    """
    real_levels: List[int] = []
    for d in details_list or []:
        ml = d.get("min_level")
        if isinstance(ml, int) and ml > 0:
            real_levels.append(ml)
    base = min(real_levels) if real_levels else int(synthetic_level)
    scaled = int(base) * int(level_pct) / 100
    return max(1, int(scaled))


def eligible_children(node: EvoNode, level: int, synthetic_level: int, level_pct: int) -> List[Tuple[EvoNode, int]]:
    """Return children whose effective gate has been reached, with their gate levels."""
    out: List[Tuple[EvoNode, int]] = []
    for child, details in node.children:
        gate = effective_gate(details, synthetic_level, level_pct)
        if level >= gate:
            out.append((child, gate))
    return out


def resolve_evolutions(
    root: EvoNode,
    current_species_id: int,
    level: int,
    synthetic_level: int = 30,
    level_pct: int = 100,
) -> Tuple[str, Any]:
    """Return one of ("none", None), ("single", target_id), ("choice", [ids])."""
    node = find_node(root, current_species_id)
    if node is None or not node.children:
        return ("none", None)
    eligible = eligible_children(node, level, synthetic_level, level_pct)
    if not eligible:
        return ("none", None)
    if len(eligible) == 1:
        return ("single", eligible[0][0].species_id)
    return ("choice", [c.species_id for c, _ in eligible])


def commit_single_path(
    root: EvoNode,
    current_species_id: int,
    level: int,
    synthetic_level: int = 30,
    level_pct: int = 100,
) -> Tuple[int, List[Dict[str, Any]], bool]:
    """Walk auto-evolutions while the path is unambiguous.

    Returns:
      final_species_id — the species you end up on
      hops             — list of {from_id, to_id, at_level} for evolutions history
      pending_choice   — True if we stopped on a branch that has ≥2 eligible children
    """
    hops: List[Dict[str, Any]] = []
    species = current_species_id
    while True:
        kind, payload = resolve_evolutions(root, species, level, synthetic_level, level_pct)
        if kind == "none":
            return species, hops, False
        if kind == "single":
            node = find_node(root, species)
            # gate for the single winning child (need the effective_gate value)
            gate_level = level
            for child, details in node.children:  # type: ignore[union-attr]
                if child.species_id == payload:
                    gate_level = effective_gate(details, synthetic_level, level_pct)
                    break
            hops.append({"from": species, "to": payload, "at_level": gate_level})
            species = payload  # type: ignore[assignment]
            continue
        # choice — stall
        return species, hops, True


# ---------------------------------------------------------------------------
# Full state derivation from the ledger
# ---------------------------------------------------------------------------

@dataclass
class DerivedState:
    total_xp: int
    level: int
    current_species_id: int
    evolutions_history: List[Dict[str, Any]]  # [{from, to, at_level}, ...]
    pending_evolution: bool
    stage_index: int  # 0 = base, 1 = first evo, 2 = second


def _stage_index(root: EvoNode, species_id: int) -> int:
    """Depth of species_id from root (root=0)."""
    def dfs(node: EvoNode, depth: int) -> Optional[int]:
        if node.species_id == species_id:
            return depth
        for c, _ in node.children:
            r = dfs(c, depth + 1)
            if r is not None:
                return r
        return None
    r = dfs(root, 0)
    return 0 if r is None else r


def derive_state_from_ledger(
    ledger: List[Dict[str, Any]],
    base_species_id: int,
    root: EvoNode,
    growth_table: List[Tuple[int, int]],
    synthetic_level: int = 30,
    level_pct: int = 100,
    xp_baseline: int = 0,
) -> DerivedState:
    """Recompute total_xp, level, current species, and evolution history purely from the ledger.

    xp_baseline: XP contributed BEFORE the current mon (used for prestige, so the Pokémon
    itself levels from (SUM(ledger) - xp_baseline)). For non-prestige it's 0.
    """
    total_lifetime_xp = sum(int(e.get("xp_awarded", 0)) for e in ledger)
    mon_xp = max(0, total_lifetime_xp - int(xp_baseline))
    level = level_from_xp(mon_xp, growth_table)

    # Walk evolutions from base_species. Auto-cascade single-path stages;
    # stop on branch as pending.
    species = base_species_id
    history: List[Dict[str, Any]] = []
    pending = False
    while True:
        kind, payload = resolve_evolutions(root, species, level, synthetic_level, level_pct)
        if kind == "none":
            break
        if kind == "single":
            node = find_node(root, species)
            gate_level = 1
            for child, details in node.children:  # type: ignore[union-attr]
                if child.species_id == payload:
                    gate_level = effective_gate(details, synthetic_level, level_pct)
                    break
            history.append({"from": species, "to": payload, "at_level": gate_level})
            species = payload  # type: ignore[assignment]
            continue
        # branch
        pending = True
        break

    return DerivedState(
        total_xp=total_lifetime_xp,
        level=level,
        current_species_id=species,
        evolutions_history=history,
        pending_evolution=pending,
        stage_index=_stage_index(root, species),
    )
