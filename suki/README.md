# SUKI — a sari-sari store ledger

A ledger and stock app for a sari-sari store in Barangay Daro, Dumaguete. One
shopkeeper, forty-odd neighbours, run from a counter at the front of a house.
A *suki* is a regular customer — the standing relationship of trust between a
shop and the people around it. The ledger is the record of that trust.

Live at **[suki.kimnejudne.dev](https://suki.kimnejudne.dev/)**. The write-up is
[`CASE-STUDY.md`](./CASE-STUDY.md), published at
[kimnejudne.dev/work/suki](https://kimnejudne.dev/work/suki/).

The demo shop is walkable: the landing page and the lock screen both print the
PIN. Everyone shares one shop, and it resets nightly.

## The three ideas it is built on

1. **Tingi is the business model.** Stock is bought in packs and sold by the
   piece — a ream of 12 sachets at ₱96, sold at ₱10 each. Every item has a buy
   unit, a sell unit and a conversion. No Western POS models this.
2. **Utang is normal, not an exception.** The *lista* is the credit book and it
   is append-only. A book you can quietly rewrite is not a record anyone would
   trust, so entries are never edited or deleted and the balance is the sum.
3. **The domain is already an event log.** Sales, payments and stock movements
   are immutable events, which is exactly the shape an offline operation queue
   takes. The offline architecture and the domain model are the same thing.

Offline-first is a requirement here rather than a feature. The power goes out,
the signal drops to one bar, and the shop still has to sell a sachet of shampoo
and write down who owes what.

## Layout

npm workspaces. The domain package is the point — the balance derivation, tingi
conversion, money rules and operation projections are imported by both sides, so
a phone and the server cannot disagree about what somebody owes.

| | |
|---|---|
| `packages/domain` | Pure, deterministic. No I/O, no clock, no randomness. |
| `frontend` | Vite 6 + React 19 + TypeScript (strict) + Tailwind 4, Dexie over IndexedDB, `vite-plugin-pwa`. |
| `api` | NestJS 11 + Drizzle + Postgres 17. Two routes, over an append-only `operations` table. |
| `deploy` | Runbook, nginx vhost, compose stack, backup and reset timers. |

## Routes

`/` is a public landing page — the front door, and the only screen designed for
a desktop as well as a phone. Everything else is the shop and sits behind a PIN
at `/unlock`; the till is `/till`. The installed PWA starts at `/till`, because
an installed app belongs to the shopkeeper and she wants the counter, not the
prospectus.

## Sync

Dexie over IndexedDB, an append-only operation queue, client-generated UUIDs as
idempotency keys, server authoritative, client rebases on pull.

**No CRDTs.** One writer, and the balance is a sum — sums commute, so there is
nothing to merge. A CRDT that invented a balance would be worse than useless.
ElectricSQL, PowerSync and Triplit were each rejected for adding a sync service
to a shared 1.9GB box and for hiding the engineering this project exists to show.

`VITE_DEVICE_KEY` ships **inside the bundle** and is therefore not a secret. It
is a coarse gate plus rate limiting, not authentication. SUKI has no accounts on
purpose.

## Working on it

```sh
npm install
npm run dev     --workspace frontend    # localhost:3000
npm run typecheck --workspace frontend
npm test        --workspace frontend    # and --workspace packages/domain
npm run build   --workspace frontend
```

Deploying is two shapes on one origin, and the nginx caching rules are
load-bearing — a long `max-age` on `sw.js` is a bricked deploy, not a slow site.
Read [`deploy/README.md`](./deploy/README.md) before touching them.

## Origin

This app began as an AI-generated scaffold and was then taken apart and rebuilt
by hand. `CASE-STUDY.md` says so plainly and describes the distance travelled;
that distance is the point, not the scaffold.
