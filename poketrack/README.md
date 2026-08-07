# PokéTrack

A project tracker that turns delivery into a creature-raising game. A project
picks a starter, tickets carry Fibonacci points, completing them awards XP, and
XP levels the partner up until it evolves — branching where the species branches,
and **reversing** if the work is un-done.

Live at [poketrack.kimnejudne.dev](https://poketrack.kimnejudne.dev). Demo
credentials are printed on the sign-in screen.

```
backend/    FastAPI + MongoDB. The progression engine is pure and unit-tested.
frontend/   React (CRA + craco), hand-rolled components, no component library.
deploy/     Droplet runbook: compose stack, nginx, mongodump backups.
```

## Running it

```bash
# backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
JWT_SECRET=$(openssl rand -base64 48) .venv/bin/uvicorn server:app --port 8001

# frontend
cd frontend && npm install && npm start
```

The API refuses to start without a `JWT_SECRET` of at least 32 characters. That
is deliberate — see the note in `backend/auth.py`.

## Tests

```bash
cd backend
.venv/bin/pytest                                    # engine + guard sweep
POKETRACK_API=http://localhost:8001/api .venv/bin/pytest test_api_guards.py
```

- `test_engine_choices.py` — the progression engine's branching and choice
  commitment, as pure functions.
- `poc/test_core.py` — the original engine proof: growth tables, evolution
  chains and gates for all 27 starters, against cached PokéAPI data.
- `test_api_guards.py` — every route that touches team data must refuse an
  anonymous caller. Defaults to the live deployment; every request is
  unauthenticated or read-only, so it never mutates anything.

## The one idea worth knowing

**A partner's entire state is derived from the XP ledger, never stored.**
Species, level, evolution history and pending branch choices are all recomputed
from `SUM(xp_events.xp_awarded)` on every read. That is what makes reversal fall
out for free: un-complete a ticket, the XP is withdrawn, and the partner
de-evolves because the derivation simply produces a different answer. Nothing
has to "undo" anything.

The cost is that every read recomputes. The engine is pure and the growth tables
are cached, so it is cheap — but it is a real trade, made on purpose.

## Provenance

The first version came from an AI app builder and the git history says so. What
it produced was the shape of the app; the progression engine, the derivation
model, authentication, the deployment and the tests came after. The case study
is about that distance.
