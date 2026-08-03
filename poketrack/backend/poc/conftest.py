"""
Fixtures for the POC engine suite.

`test_core.py` was written as a script and later half-converted to pytest: four
of its tests take a `roots` argument that no fixture ever provided, so they
errored at setup and had never run — including `test_ledger_reversal`, which
exercises the app's headline claim that state is derived from the ledger and
therefore reverses when XP is withdrawn.

Data comes from the committed PokéAPI cache in `_cache/`, so this needs no
network and is deterministic.
"""
from __future__ import annotations

from typing import Dict

import pytest

from poc.engine import EvoNode
from poc.test_core import fetch_root_for

# The starters the suite actually indexes by name.
STARTERS = {
    "Bulbasaur": 1,
    "Charmander": 4,
    "Squirtle": 7,
    "Eevee": 133,
}


@pytest.fixture(scope="session")
def roots() -> Dict[str, EvoNode]:
    """Parsed evolution chains, keyed by the starter's name."""
    return {name: fetch_root_for(species_id) for name, species_id in STARTERS.items()}
