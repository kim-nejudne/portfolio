# PokéTrack — Case Study

**A project tracker that turns delivery into a creature-raising game.** A project
picks a starter, tickets carry Fibonacci points, completing them awards XP, and
XP levels the partner up until it evolves — branching where the species branches,
and reversing if the work is un-done.

Live at [poketrack.kimnejudne.dev](https://poketrack.kimnejudne.dev). Demo
credentials are on the sign-in screen.

FastAPI · MongoDB · React · PokéAPI · self-hosted on a 1.9GB droplet

---

## Where this started, plainly

An AI app builder produced the first version, and the git history says so. What
it gave me was the shape: teams, projects, a ticket board, a starter picker, an
evolution cutscene. What it did not give me was a system that could be trusted,
and this case study is about the difference.

The interesting thing about this spoke is that the gap was not where I expected.
The engine — the part I assumed would be shakiest — turned out to be genuinely
correct. The tests that were supposed to prove it turned out to be incapable of
failing.

---

## 1. The tests could not fail

`poc/test_core.py` is the engine's proof: growth tables, evolution chains, gates,
cascades, reversal. Forty-six tests. All green.

They contained **thirty-seven `check()` calls and zero `assert` statements.**

```python
def check(cond: bool, msg: str) -> bool:
    if cond:  PASS += 1;  print(f"  PASS  {msg}")
    else:     FAIL += 1;  print(f"  FAIL  {msg}")
    return cond
```

The file began life as a standalone script whose `main()` printed a pass/fail
tally, and was later collected by pytest. But a pytest function that never
raises always passes. Every one of those tests reported green regardless of
outcome.

I proved it rather than asserting it. I inverted a known-true condition — "level
15 Charmander has no evolution" became a check that can never hold — and ran the
suite:

```
8 passed
```

Then made `check()` assert, and ran the same sabotage again:

```
FAILED poc/test_core.py::test_charmander_ladder - AssertionError: SABOTAGE
1 failed, 7 passed
```

With real assertions, all 46 pass. **The engine was right the whole time.** That
is the part worth sitting with: the code was correct, the tests were theatre, and
nothing about the green output distinguished the two.

Four of those tests had never run at all. They took a `roots` argument that no
fixture provided, so they errored at setup — including `test_ledger_reversal`,
which covers the app's headline claim. And the file could not be collected from
`backend/` in the first place: `from engine import ...` resolved to the
production engine instead of the POC's own copy, which has no `EvoNode`.

So the headline feature had a test, the test had never executed, and had it
executed it could not have failed.

---

## 2. Nobody could install the project

```
ERROR: Could not find a version that satisfies the requirement
       emergentintegrations==0.2.0 (from versions: none)
```

`requirements.txt` pinned a vendor package that is not on public PyPI. pip
aborts the entire install on one unsatisfiable pin, so a clean checkout got
*nothing* installed — not fastapi, not pytest, not one dependency.

The package is imported nowhere.

What makes this worth writing down is that a previous pass **knew**. There is a
`requirements-prod.txt` with a comment explaining that `emergentintegrations` is
unavailable and unused, created so the container image could build. The image
was fixed; the file developers actually use was left broken. A workaround that
routes around a problem for the machine and leaves it in place for the human.

---

## 3. A secret that was not a secret

```python
JWT_SECRET = os.environ.get("JWT_SECRET", "poketrack-dev-secret-do-not-use-in-prod")
```

The deployed stack does set `JWT_SECRET`, so this fallback was never reached in
production — I checked the droplet's env before deciding how loudly to worry.

It still had to go. A default committed to a repository is not a secret, and the
failure mode is silent: if the variable ever went missing, the app would boot
happily and sign every session token with a value anyone reading the source
already knows. Nothing would look wrong.

It now refuses to start, which is how TALLOW and FORME handle the same problem.
A missing secret should be a failed deploy, not a working one with forgeable
tokens.

---

## 4. Two and a half thousand lines of components nothing used

`src/components/ui/` held 46 files and 2,503 lines of shadcn components, backed
by 27 Radix packages. Nothing imported a single one — the app hand-rolls its
interface, which is what the design brief asked for.

Deleting them, and the 49 dependencies that existed only to serve them, produced
a result worth being precise about:

| | before | after |
|---|---|---|
| JS bundle (gzip) | 172.81 kB | **172.81 kB** |
| CSS bundle (gzip) | 11.54 kB | **7.47 kB** |
| `node_modules` | 564 MB | 410 MB |
| dependencies | 61 | 12 |

The JS is byte-identical, same content hash. It was always tree-shaken, and
claiming a bundle win there would be false.

The CSS is 35% smaller, and that one is real: Tailwind scans source files to
decide which classes to generate, and it had been scanning 2,503 lines of dead
components and emitting rules for every class it found. Dead code that never
reached the bundle was still shipping to every visitor, in a different file.

---

## 5. A test suite pointed at a host that no longer exists

`backend_test.py` — 629 lines, `"""Comprehensive backend API tests for
PokéTrack."""` — was hardcoded to `evolution-hub-20.preview.emergentagent.com`,
the builder's preview environment. That host is gone. The file could not run.

A file called *comprehensive backend API tests* that cannot execute is worse
than no file, because it reads as coverage.

I replaced it with a table-driven guard sweep: every one of the 24 routes that
touch team data, asserted to refuse an anonymous caller, plus forged-token
rejection and a check that no bcrypt hash is served to anonymous callers. 27
tests, ~110 lines, pointed at a configurable base URL and defaulting to the live
deployment. Every request is unauthenticated or read-only, so it is safe to run
against production — which means it is run against production.

The authorization it checks was already sound. All 24 routes went through
`assert_member` or `assert_project_access`, and I confirmed it live before
believing it. My first grep suggested `routes_game.py` had seven routes and zero
checks, which would have been a serious hole; it uses a differently-named helper
imported from another module. Worth the extra minute before writing that down.

---

## 6. The idea the app is actually built on

Worth stating because it is the good decision underneath everything else.

**A partner's state is never stored. It is derived from the XP ledger on every
read.** Species, level, evolution history and pending branch choices all come out
of `SUM(xp_events.xp_awarded)`.

That is what makes reversal fall out for free. Un-complete a ticket, the XP is
withdrawn, and the partner de-evolves — not because anything undoes it, but
because the derivation produces a different answer. I probed the engine
adversarially to confirm the properties hold:

```
xp = -100          -> level 1          (floors, no negative levels)
xp = 1e9           -> level 100        (caps)
100k then -100k    -> Charmander, lv 1 (reversal, clean)
order shuffled     -> identical state  (it is a sum, order cannot matter)
monotonic over 400 samples             -> 0 violations
```

The cost is that every read recomputes. The engine is pure and the PokéAPI data
is cached, so it is cheap — but it is a real trade and it was made deliberately.

---

## What I chose not to build

- **Replacing Create React App.** The frontend runs on `react-scripts` 5.0.1 via
  craco, which is unmaintained. Migrating to Vite is a day's work and touches
  every build assumption; it is on the list, not in this pass.
- **Frontend tests.** There are none. The backend now has 73.
- **Un-deriving the state.** Caching the derived partner would speed reads and
  cost the property that makes the whole design work.

---

## The honest summary

Everything I fixed here was invisible. The app worked. The site was up. The tests
were green. The install was documented.

Underneath: the tests could not fail, four of them had never run, the install
was impossible from a clean checkout, the signing secret had a public default,
and a third of the CSS served to every visitor was generated from components no
page rendered.

The through-line for this whole spoke is the same one that keeps recurring: a
system reporting success is not evidence that it is doing anything. The only
things that found these were executing them — inverting an assertion to see
whether the suite noticed, running `pip install` in an empty venv, diffing a
bundle before and after. Reading the code would have shown me 46 passing tests
and moved on.
