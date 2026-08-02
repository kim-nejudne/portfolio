"""Pure progression engine used by the app.

Identical logic to the POC (which passed 60/60 tests), refactored to accept
dict trees so we do not need dataclasses across module boundaries.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

# ----------------------- Growth rate helpers -----------------------

def build_growth_table(growth_rate_json: Dict[str, Any]) -> List[Tuple[int, int]]:
    levels = growth_rate_json.get("levels", [])
    return sorted([(int(lv["level"]), int(lv["experience"])) for lv in levels], key=lambda x: x[0])


def level_from_xp(xp: int, growth_table: List[Tuple[int, int]]) -> int:
    xp = max(0, int(xp))
    current = 1
    for level, threshold in growth_table:
        if xp >= threshold:
            current = max(current, level)
        else:
            break
    return max(1, current)


def xp_progress(xp: int, current_level: int, growth_table: List[Tuple[int, int]]) -> Optional[Tuple[int, int]]:
    xp = max(0, int(xp))
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


# ----------------------- Chain parsing -----------------------

def _species_id_from_url(url: str) -> int:
    return int([p for p in url.split("/") if p][-1])


def parse_chain(chain_json: Dict[str, Any]) -> Dict[str, Any]:
    return _parse_node(chain_json["chain"])


def _parse_node(node: Dict[str, Any]) -> Dict[str, Any]:
    sp = node["species"]
    result = {
        "species_id": _species_id_from_url(sp["url"]),
        "species_name": sp["name"],
        "children": [],
    }
    for child in node.get("evolves_to", []) or []:
        details = child.get("evolution_details", []) or []
        result["children"].append({"details": details, "node": _parse_node(child)})
    return result


def find_node(root: Dict[str, Any], species_id: int) -> Optional[Dict[str, Any]]:
    if root["species_id"] == species_id:
        return root
    for child in root.get("children", []):
        r = find_node(child["node"], species_id)
        if r is not None:
            return r
    return None


def stage_index_of(root: Dict[str, Any], species_id: int) -> int:
    def dfs(node: Dict[str, Any], depth: int) -> Optional[int]:
        if node["species_id"] == species_id:
            return depth
        for c in node.get("children", []):
            r = dfs(c["node"], depth + 1)
            if r is not None:
                return r
        return None
    r = dfs(root, 0)
    return 0 if r is None else r


def total_stages(root: Dict[str, Any]) -> int:
    def dfs(node: Dict[str, Any], depth: int) -> int:
        best = depth
        for c in node.get("children", []):
            best = max(best, dfs(c["node"], depth + 1))
        return best
    return dfs(root, 0)


# ----------------------- Gate logic -----------------------

def effective_gate(details_list: List[Dict[str, Any]], synthetic_level: int, level_pct: int) -> int:
    real_levels: List[int] = []
    for d in details_list or []:
        ml = d.get("min_level")
        if isinstance(ml, int) and ml > 0:
            real_levels.append(ml)
    base = min(real_levels) if real_levels else int(synthetic_level)
    return max(1, int(int(base) * int(level_pct) / 100))


def eligible_children(node: Dict[str, Any], level: int, synthetic_level: int, level_pct: int) -> List[Tuple[Dict[str, Any], int]]:
    out: List[Tuple[Dict[str, Any], int]] = []
    for child in node.get("children", []):
        gate = effective_gate(child["details"], synthetic_level, level_pct)
        if level >= gate:
            out.append((child["node"], gate))
    return out


def resolve_evolutions(
    root: Dict[str, Any],
    current_species_id: int,
    level: int,
    synthetic_level: int = 30,
    level_pct: int = 100,
) -> Tuple[str, Any]:
    node = find_node(root, current_species_id)
    if node is None or not node.get("children"):
        return ("none", None)
    eligible = eligible_children(node, level, synthetic_level, level_pct)
    if not eligible:
        return ("none", None)
    if len(eligible) == 1:
        return ("single", eligible[0][0]["species_id"])
    return ("choice", [n["species_id"] for n, _ in eligible])


def derive_state(
    ledger: List[Dict[str, Any]],
    base_species_id: int,
    root: Dict[str, Any],
    growth_table: List[Tuple[int, int]],
    synthetic_level: int = 30,
    level_pct: int = 100,
    xp_baseline: int = 0,
) -> Dict[str, Any]:
    total_xp = sum(int(e.get("xp_awarded", 0)) for e in ledger)
    mon_xp = max(0, total_xp - int(xp_baseline))
    level = level_from_xp(mon_xp, growth_table)

    species = base_species_id
    history: List[Dict[str, Any]] = []
    pending = False
    pending_options: List[int] = []
    while True:
        kind, payload = resolve_evolutions(root, species, level, synthetic_level, level_pct)
        if kind == "none":
            break
        if kind == "single":
            node = find_node(root, species) or {"children": []}
            gate_level = 1
            for child in node.get("children", []):
                if child["node"]["species_id"] == payload:
                    gate_level = effective_gate(child["details"], synthetic_level, level_pct)
                    break
            history.append({"from": species, "to": payload, "at_level": gate_level})
            species = payload
            continue
        pending = True
        pending_options = list(payload)  # type: ignore[arg-type]
        break

    prog = xp_progress(mon_xp, level, growth_table)
    return {
        "total_xp": total_xp,
        "mon_xp": mon_xp,
        "level": level,
        "current_species_id": species,
        "evolutions_history": history,
        "pending_evolution": pending,
        "pending_options": pending_options,
        "stage_index": stage_index_of(root, species),
        "total_stages": total_stages(root),
        "xp_progress": {"current": prog[0], "needed": prog[1]} if prog else None,
    }


def next_evolution_hint(
    root: Dict[str, Any],
    current_species_id: int,
    level: int,
    synthetic_level: int = 30,
    level_pct: int = 100,
) -> Dict[str, Any]:
    """Return {kind: 'final'|'ready'|'gated', at_level?, options?}."""
    node = find_node(root, current_species_id)
    if node is None or not node.get("children"):
        return {"kind": "final"}
    eligible = eligible_children(node, level, synthetic_level, level_pct)
    if eligible and len(eligible) >= 2:
        return {"kind": "ready", "options": [n["species_id"] for n, _ in eligible]}
    if eligible and len(eligible) == 1:
        return {"kind": "ready", "options": [eligible[0][0]["species_id"]]}
    # otherwise gated: find lowest gate ahead
    lowest = None
    for child in node.get("children", []):
        g = effective_gate(child["details"], synthetic_level, level_pct)
        if lowest is None or g < lowest:
            lowest = g
    return {"kind": "gated", "at_level": lowest or 100}
