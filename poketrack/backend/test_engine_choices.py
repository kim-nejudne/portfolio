"""derive_state's handling of a committed branch choice.

    cd backend && python -m pytest test_engine_choices.py

No database and no network: the chains and growth curves come from the
`poc/_cache` copies that ship inside the image anyway.

Why this exists. A fork is the only piece of a partner's state the engine
cannot re-derive — the ledger holds XP and nothing else. Before `choices`,
`derive_state` restarted from `base_species_id` on every read and stalled at
the fork again, so committing an evolution appeared to do nothing. Nobody hit
it because none of the 27 pickable starters branch; the demo seed's Eevee is
the first partner that can.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from engine import build_growth_table, derive_state, parse_chain

CACHE = Path(__file__).parent / "poc" / "_cache"

EEVEE, VAPOREON, UMBREON = 133, 134, 197
CHARMANDER, CHARMELEON, CHARIZARD = 4, 5, 6

# Eevee's eight branches all trigger on stones, happiness or affection rather
# than a level, so every gate falls back to the synthetic level.
EEVEE_GATE = 30


def _load(key: str) -> dict:
    return json.loads((CACHE / (key.replace("/", "__") + ".json")).read_text("utf-8"))


@pytest.fixture(scope="module")
def eevee():
    return parse_chain(_load("evolution-chain/67")), build_growth_table(_load("growth-rate/medium"))


@pytest.fixture(scope="module")
def charmander():
    return (
        parse_chain(_load("evolution-chain/2")),
        build_growth_table(_load("growth-rate/medium-slow")),
    )


def _state(chain, xp, choices=None, base=EEVEE):
    root, growth = chain
    return derive_state(
        ledger=[{"xp_awarded": xp}],
        base_species_id=base,
        root=root,
        growth_table=growth,
        synthetic_level=EEVEE_GATE,
        level_pct=100,
        choices=choices,
    )


# medium growth is n**3, so level N costs exactly N**3.
AT_31 = 31 ** 3
BELOW_GATE = 29 ** 3


def test_no_choice_stalls_at_the_fork(eevee):
    state = _state(eevee, AT_31)
    assert state["current_species_id"] == EEVEE
    assert state["pending_evolution"] is True
    assert len(state["pending_options"]) == 8


def test_committed_choice_is_followed(eevee):
    state = _state(eevee, AT_31, {EEVEE: UMBREON})
    assert state["current_species_id"] == UMBREON
    assert state["pending_evolution"] is False
    assert state["pending_options"] == []
    assert state["evolutions_history"] == [
        {"from": EEVEE, "to": UMBREON, "at_level": EEVEE_GATE}
    ]
    assert (state["stage_index"], state["total_stages"]) == (1, 1)


def test_each_branch_is_reachable(eevee):
    assert _state(eevee, AT_31, {EEVEE: VAPOREON})["current_species_id"] == VAPOREON


def test_choice_lapses_when_xp_is_reversed_below_the_gate(eevee):
    """The reversal promise: strip the XP and the evolution really is undone."""
    state = _state(eevee, BELOW_GATE, {EEVEE: UMBREON})
    assert state["current_species_id"] == EEVEE
    assert state["pending_evolution"] is False
    assert state["level"] == 29


def test_choice_reapplies_when_xp_is_restored(eevee):
    """Re-earning the level must not force the trainer to pick all over again."""
    assert _state(eevee, AT_31, {EEVEE: UMBREON})["current_species_id"] == UMBREON


def test_target_that_is_not_a_child_of_the_fork_is_ignored(eevee):
    state = _state(eevee, AT_31, {EEVEE: 25})
    assert state["current_species_id"] == EEVEE
    assert state["pending_evolution"] is True


def test_choices_for_unrelated_species_do_not_perturb_the_walk(eevee):
    assert _state(eevee, AT_31, {999: VAPOREON})["pending_evolution"] is True


@pytest.mark.parametrize(
    "xp,expected",
    [(39_000, CHARMELEON), (40_007, CHARIZARD)],
)
def test_linear_chain_is_unaffected(charmander, xp, expected):
    assert _state(charmander, xp, base=CHARMANDER)["current_species_id"] == expected


def test_linear_chain_ignores_a_bogus_choice(charmander):
    state = _state(charmander, 40_007, {CHARMELEON: 999}, base=CHARMANDER)
    assert state["current_species_id"] == CHARIZARD


def test_omitting_choices_matches_passing_an_empty_mapping(charmander):
    assert _state(charmander, 40_007, base=CHARMANDER) == _state(
        charmander, 40_007, {}, base=CHARMANDER
    )
