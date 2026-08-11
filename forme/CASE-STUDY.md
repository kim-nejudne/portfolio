# FORME — Case Study

**A production system for a trade printer.** Customer portal, prepress queue
with an imposition planner, a press floor board, an admin price matrix, and the
public pages that price the work.

Live at [forme.kimnejudne.dev](https://forme.kimnejudne.dev). Four demo
accounts on the sign-in screen, one per role, all read-only.

Next.js 16 · NestJS 11 · Postgres 17 via Drizzle · pg-boss · socket.io ·
poppler-utils + ghostscript · self-hosted on a 1.9GB droplet

## The short version

**What it is** A production system for a trade printer: a customer portal, a
prepress queue with an imposition planner, a press floor board, an admin price
matrix, and the public pages that price the work.

**The hardest problem** The centrepiece is a preflight report, twelve checks
against a supplied PDF, and the scaffold faked all twelve. Simulating them
convincingly would have been half a day. Instead the worker shells out to
poppler-utils and ghostscript and nine of the twelve are genuine measurements;
the three that need content-stream parsing report `SKIPPED` with a stated reason
rather than a pass, because a check that cannot be made is not a check that
passed.

**What the scaffold missed** No server, no database, no authentication and no
state machine. Eleven routes over a mock data layer, with the preflight engine
that the whole spoke is about implemented as a list of hardcoded strings on a
timer.

**How it was proven** 172 tests: 153 unit and integration, 36 end-to-end
against a real Postgres. The e2e suite is table-driven, every guarded route
crossed with every role that should not reach it, and it runs against a real
database rather than a mock because most of what is worth asserting there is
database behaviour and a fake would only assert that the fake works.

---

## Where this started, plainly

The frontend began as an AI-generated scaffold. I wrote a specification, an app
builder produced eleven routes over a mock data layer, and the git history says
so — the scaffold commits are still there, underneath mine, unsquashed.

What it produced was genuinely good, and I want to be specific about that
rather than damn it with faint praise. The one instruction that mattered was a
strict data seam: every screen reads through `src/lib/api/`, and nothing outside
that directory may import a fixture. That rule held completely — all six fixture
imports were inside it, no component fetched its own data, and the preflight
stream had exactly the subscription signature I asked for. All eleven routes
existed. `params` and `searchParams` were awaited as promises throughout. There
was no `Math.random()` and no `Date.now()` anywhere.

What it did not produce was a system. There was no server, no database, no
authentication, no state machine, and the preflight engine — the thing the whole
spoke is *about* — was a list of hardcoded strings on a timer.

This case study is about the distance between those two things.

---

## 1. The preflight engine had to be real

The centrepiece is a preflight report: twelve checks against a supplied PDF,
landing one at a time, each with a measured value and a tolerance. The scaffold
faked all twelve, which is the correct thing for a scaffold to do.

The question was what to do about it. Simulating convincingly would have been
half a day. Instead the worker shells out to **poppler-utils** and
**ghostscript**, and nine of the twelve are now genuine measurements:

| Check | How | Real? |
|---|---|---|
| Page count | `pdfinfo` | yes |
| Trim size | `pdfinfo -box`, TrimBox against the order | yes |
| Bleed | BleedBox against TrimBox, per edge | yes |
| Safety margin | `gs -sDEVICE=bbox` ink bounds vs trim − 4mm | yes |
| Fonts embedded | `pdffonts` | yes |
| Image resolution | `pdfimages -list`, x/y ppi | yes |
| Colour space | `pdfimages -list` colorspace column | yes |
| Total area coverage | `gs -sDEVICE=inkcov`, TAC = ΣCMYK | yes |
| PDF/X-4 | version + output intent probe | yes |
| Spot colours | needs separation enumeration | **no** |
| White overprint | needs graphics-state analysis | **no** |
| Hairlines | needs content-stream stroke widths | **no** |

Feed it an A4 export against an A5 order and it says:

```
FAIL  Trim size       148 × 210mm ordered, artwork trim box 209.9 × 297mm.
FAIL  Bleed           3mm required — top 0mm, right 0mm, bottom 0mm, left 0mm.
WARN  Safety margin   Page 1: live matter 1.3mm from trim, 4mm required.
FAIL  Fonts embedded  1 of 1 not embedded: Helvetica.
PASS  Total area cov  Peak TAC 160%, within the 300% limit.
```

**The three it cannot do report `SKIPPED`, not `PASS`.** That distinction is the
most important design decision in the project. A clean report on an analysis
nobody ran is worse than no report — it is a prepress technician signing off
artwork on the strength of a check that never happened. So `SKIPPED` is a fourth
member of the severity type, it renders with its own mark and the label
`NOT RUN`, and the UI states the reason. A skipped check also cannot be waived:
there is no finding to take responsibility for.

The same honesty applies when the tooling is absent. If ghostscript is missing
from the host, the checks that need it report `SKIPPED` with *that* as the
reason, rather than quietly passing.

---

## 2. Anyone could have been an admin

The scaffold's session was a plain `forme_role` cookie. The layouts read it and
rendered accordingly. Setting `forme_role=admin` in devtools was enough to reach
the price matrix.

That is not a criticism of the scaffold — it was scaffolding, and it said so in
its own copy. It is the work.

What replaced it:

- argon2id password hashing at OWASP's minimum parameters, tuned *down* from the
  library defaults because 64MB per hash on a shared 1.9GB box is how a login
  storm becomes an outage for four other services.
- JWT access (15m) and refresh (7d) tokens in httpOnly cookies, refresh stored
  hashed and rotated on every use, so a replayed token fails and theft becomes
  detectable.
- `JwtAuthGuard` registered **globally**. Routes are deny-by-default; a
  developer has to opt a route *out* with `@Public()`. Forgetting produces a 401
  on a public page — loud and immediate. The opposite default produces an
  unauthenticated admin route nobody notices, which is exactly the defect being
  fixed.
- The strategy re-reads the user on every request rather than trusting the
  claims, so a disabled account stops working now, not in fifteen minutes.
- Sign-in returns an identical message for an unknown email and a wrong
  password, and burns the same CPU on both — otherwise the form is an account
  enumerator. A customer requesting another account's job gets 404, never 403,
  because 403 confirms the reference exists.

Four demo accounts are seeded so the site is walkable without credentials. They
are flagged `is_demo`, which a guard turns into read-only: they can see every
surface and change nothing, so the next visitor finds the shop as it was.

---

## 3. A state machine, not a field

The scaffold moved jobs by assigning to `state`. Any caller could put a job in
any state — a cancelled job could go back on press, a job could reach `PLATED`
without a proof ever being approved.

There is now one transition table over the twelve states, and one method that
uses it. Inside a single transaction it takes `FOR UPDATE` on the row, asserts
the transition is legal, writes the new state, and appends to `job_events`. Two
operators clicking *Approve* at the same moment serialise; there is never a job
whose state moved without a matching event, nor an event for a move that did not
take.

The timeline the customer sees is **derived from `job_events`**, not stored
separately. That means a timeline can never disagree with the audit trail,
because there is only one record of what happened.

Two rules in that table are worth stating because they are judgement calls, not
mechanics. `PROOFING` can go backwards to `PREFLIGHT`, because a rejected proof
means new artwork. And `HELD` resumes at `PREFLIGHT` rather than where it
stopped, because a job that sat still long enough to be held gets re-checked.

---

## 4. One source of truth for the arithmetic

The price on the marketing page and the price the API charges are the same
number because they come from the same function.

`packages/domain` is a workspace package holding the types, the money helpers,
working-day date arithmetic, the quote engine, the imposition geometry, the
state machine and the job projection. Both apps import it. The imposition
planner recomputes its SVG locally on every slider drag from the same
`buildPlan` the API runs when it persists a plan — no round trip per frame, and
no second implementation to drift.

Money is whole pesos held as integers throughout; multipliers are integer
per-mille, so no float ever touches a price. One formatter, one currency glyph,
hand-rolled rather than `Intl` because `Intl` output depends on the runtime's
locale data and would produce a hydration mismatch between server and browser.

---

## 5. Bugs found by actually running it

Every one of these had shipped silently and was found by using the thing, not by
reading it.

1. **`computeQuote` priced jobs off the wrong row.** A rate lookup that missed
   fell back to `matrix.products[0]`, so a booklet could be quoted at the
   business-card rate. It throws now. Silently charging the wrong price is worse
   than a 500.

2. **`pdfinfo` prints two different formats.** Single-page files emit
   `MediaBox:`; multi-page emit `Page 1 MediaBox:`. Matching only the second
   dropped TrimBox and BleedBox on every one-page file — which is most flyers
   and posters, and exactly the artwork the trim and bleed checks exist for. A
   missing TrimBox reads downstream as "no bleed declared", so the bug produced
   confident *false failures* rather than an obvious crash.

3. **Every upload 500'd with `EXDEV`.** Multer staged to `/tmp`, which is tmpfs,
   while artwork lives on disk — and `rename` across filesystems fails. Staging
   now happens inside the artwork root so the move is atomic.

4. **The audit log disagreed with the responses.** An illegal transition
   returned 409 to the client and was recorded as 500, because the exception
   filter and the audit interceptor each had their own status mapping. A table
   that exists to answer *what happened* must not contradict what the caller was
   told. One mapping now, shared.

5. **`nest build` emitted nothing while reporting success.** `incremental: true`
   plus `deleteOutDir: true` meant a stale `tsbuildinfo` outside `dist` survived
   the delete and convinced tsc there was nothing to do. `npm start` and the
   container CMD would both have failed on a clean checkout.

6. **The e2e suite tested the wrong database.** It created `forme_test`, seeded
   it, and then asserted against the development database, because `.env` beat
   the explicitly-set environment variable. It surfaced only because a test
   expected four demo accounts and got exactly the two I had flipped by hand
   hours earlier — a coincidence that could as easily have gone the other way
   and left a green suite testing nothing it claimed to.

7. **The preflight stream read a different source from everything else.** It
   replayed the raw fixture array while every other function read the mutable
   store, so a waiver applied by prepress was invisible to the stream.

8. **The backup's own sanity check was broken.** `zgrep -q` exits at the first
   match, which SIGPIPEs the decompressor feeding it — and under `pipefail` that
   turns a *successful* match into a non-zero exit, nondeterministically. Caught
   by running the backup rather than trusting it.

---

## 6. The intake screen was lying

The scaffold streamed preflight checks the moment a file was chosen, looking
them up by filename. Against a real API there is nothing to stream at that
point: the job does not exist, the artwork has not been sent, and no worker has
measured anything.

Swapping the transport underneath would have produced a component that opens a
socket and silently receives nothing forever. So the live stream moved to the
job page, where there is a real report being written, keyed on the job reference
rather than a report id — a re-upload produces a *new* report, and the screen
should follow the job. The intake panel now states what will happen and stops
there.

The same audit caught the sign-in screen still saying *"Authentication is not
wired up in this build"* under a hardcoded-disabled submit button, weeks after
authentication was wired up. Both were true of the scaffold and false of the
system.

---

## 7. Designed for a droplet, not a platform

Everything runs on one shared DigitalOcean box: 1.9GB of RAM, two vCPUs, six
other containers, and a swapfile already 450MB deep before FORME arrived. That
constraint shaped three decisions.

**pg-boss instead of Redis and BullMQ.** Postgres has to be there anyway. A
second datastore is a container, a memory budget and a backup story for a
workload of a few jobs an hour. The worker runs in the API process rather than a
fourth container. The honest cost is that a CPU-bound ghostscript run shares a
process with the request handler — so concurrency is pinned to one, and every
external tool has a timeout and an output cap.

**Drizzle instead of Prisma.** Prisma's query engine is 50–80MB of RSS per
process. On this box that is real money.

**No platform primitives.** No edge runtime, no blob store, no platform cron.
Artwork goes to a real disk, named by SHA-256 so a re-upload deduplicates, with
a retention cron that removes the bytes and keeps the `job_files` rows so the
audit trail survives.

Measured with the stack running: 57MB, 46MB and 42MB against caps of 320, 224
and 160. Adding it moved swap by 14MB.

---

## 8. What the tests actually assert

172 of them: 153 unit and integration, 36 end-to-end against a real Postgres.

The domain tests run against a small hand-checkable price matrix rather than the
seed data, so every peso expectation can be verified on paper instead of being
whatever the code happened to return. The imposition tests assert that each
folio scheme's front and back forms cover every page exactly once and that pages
pair to *n+1*, which is what folding actually produces.

The preflight tests are split deliberately. Thirty-five assert the exact
*finding strings* — the sentence a technician reads and acts on — against
synthetic contexts. Nine run the real parsers against PDFs generated by
ghostscript at test time, including a direct regression for the single-page box
bug. Pinning the strings to generated artwork would have made them hostage to
whichever ghostscript version is installed.

The e2e suite is table-driven: every guarded route crossed with every role that
should not reach it. It runs against real Postgres rather than a mock, because
most of what is worth asserting there — the `FOR UPDATE`, the advisory lock
behind reference allocation, the case-insensitive unique index on email — *is*
database behaviour, and a fake would only assert that the fake works.

---

## What I chose not to build

- **A real PDF renderer for the proof viewer.** It draws an SVG representation
  with crop marks and separations toggles. Rasterising the actual artwork is a
  worthwhile feature and a large one; the viewer is honest about being a
  representation.
- **The three remaining preflight checks.** They need content-stream parsing.
  Reporting them as `SKIPPED` is the correct interim answer and the report says
  so out loud.
- **Multi-tenancy beyond customer scoping.** One shop, many customers.
- **A print stylesheet** for the job ticket and proof sheet. A shop prints these;
  it is on the list.

---

## The honest summary

The scaffold gave me eleven routes with a clean seam and a coherent art
direction. That saved real time and I would use it again.

What it could not give me was the part that makes this a production system: a
database with a schema that enforces its own invariants, authentication that
cannot be bypassed from devtools, a state machine that refuses illegal moves, a
preflight engine that measures rather than asserts, and a test suite that fails
when any of that stops being true.

The most useful habit through the whole pass was refusing to trust anything I
had not run. Every bug in section 5 came from executing something — probing the
PDF tools before building on them, uploading a real defective file, running the
backup instead of assuming it worked. The two worst ones, the `pdfinfo` parser
and the e2e database, were both cases where the system was confidently reporting
success while doing the wrong thing. Neither would have been caught by reading
the code.
