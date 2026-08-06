# PokéTrack — deploy runbook

Authority for ports, env and exact commands for `poketrack.kimnejudne.dev`.
If something here disagrees with the root `CLAUDE.md`, this file wins.

> **Two placeholders run through this file.** `$DEPLOY_HOST` is the droplet as
> `user@host`, for ssh, scp and rsync; `$DROPLET_IP` is its IPv4, for DNS records
> and `dig` checks. Neither is recorded in this repository — export both in your
> shell profile before following anything below.

## Shape

Two artifacts, two paths, one hostname:

| | |
|---|---|
| Host | DigitalOcean droplet (sgp1), shared with `n8n`, `tallow`, `netint-vpuaas` |
| API | `poketrack:<tag>` container, uvicorn on **loopback `127.0.0.1:3004`** → nginx `/api/` |
| SPA | CRA build served off disk by nginx from **`/var/www/poketrack`** → nginx `/` |
| Data | `mongo:7` on the compose-internal network, **no published port**, volume `poketrack_poketrack-mongo` |
| Stack | `/opt/poketrack/compose.yaml` + `/opt/poketrack/.env` (chmod 600) |
| vhost | `/etc/nginx/sites-available/poketrack`, certbot-issued cert |

The image carries the **backend only**. nginx serves the bundle directly — static
bytes have no business waking a Python process on a 2GB shared box.

Memory is the scarce resource here, not CPU or disk. `mongod` is launched with
`--wiredTigerCacheSizeGB 0.25` because it would otherwise size its cache at ~50%
of host RAM and crowd out n8n. Both services carry a `mem_limit`.

## Deploying

Everything is built **on the workstation**. The droplet runs no build of any
kind — it has not the memory headroom next to its co-tenants.

From `poketrack/`:

```bash
TAG=$(git rev-parse --short HEAD)

# 1. API image -> droplet
docker build -t poketrack:$TAG .
docker save poketrack:$TAG | ssh $DEPLOY_HOST 'docker load'

# 2. SPA bundle -> droplet
#    REACT_APP_BACKEND_URL is deliberately empty: the SPA is same-origin, so
#    src/lib/api.js resolves the API to a relative /api. Setting it to the full
#    host would work but would start sending needless CORS preflights.
( cd frontend && REACT_APP_BACKEND_URL= GENERATE_SOURCEMAP=false yarn build )
rsync -az --delete frontend/build/ $DEPLOY_HOST:/var/www/poketrack/
ssh $DEPLOY_HOST 'chown -R www-data:www-data /var/www/poketrack'

# 3. point the stack at the new tag and restart the API
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/' /opt/poketrack/.env \
  && cd /opt/poketrack && docker compose up -d"
```

Order matters only in that step 3 should not run long before step 2 — the SPA
and the API ship as one release.

Routine deploys need nothing further; the demo world lives in mongo, not in the
image, and survives. On a **fresh volume** it has to be built once — see
[The demo world](#the-demo-world).

## Rolling back

Previous images stay on the box. Roll back without rebuilding:

```bash
ssh $DEPLOY_HOST 'docker images poketrack'          # list known-good tags
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<good-sha>/' /opt/poketrack/.env \
  && cd /opt/poketrack && docker compose up -d app"
```

The SPA has no equivalent — `rsync --delete` overwrote it. Roll the bundle back by
checking out the old sha and re-running step 2.

## Environment

`/opt/poketrack/.env`, modelled on `.env.production.example`. Notes that bite:

- **`MONGO_PASSWORD` is consumed once.** `MONGO_INITDB_ROOT_*` only runs against an
  empty volume. Editing it later does not change the stored user — it just breaks
  the connection string. Rotate with `db.changeUserPassword()` in `mongosh`, or by
  resetting the volume.
- **`JWT_SECRET` has a public default.** `backend/auth.py` falls back to
  `poketrack-dev-secret-do-not-use-in-prod` when it is unset, and does so silently.
  Anyone could then mint a valid token. It must be present.
- **`CORS_ORIGINS` must not be `*`.** The code default is `*`, which the app pairs
  with `allow_credentials=True` — a combination browsers reject outright. The
  compose file overrides it to the one real origin.

## Health checks

```bash
curl -s https://poketrack.kimnejudne.dev/api/health          # {"ok":true}
curl -s https://poketrack.kimnejudne.dev/api/                # {"service":"poketrack",...}
ssh $DEPLOY_HOST 'docker ps --filter name=poketrack'   # both Up (healthy)
ssh $DEPLOY_HOST 'docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}"'
```

On boot the app kicks off a background PokéAPI prewarm (27 starters plus their
evolution chains and growth rates) into the `pokeapi_cache` collection. It is
non-blocking and failure is logged, not fatal: `backend/poc/_cache` is baked into
the image as an offline fallback, so the app still plays without the network.
A cold first `/pokedex/starters` can take a few seconds; later ones are cached.

## Backups

`scripts/backup-db.sh` runs from **root's** crontab at **03:15 UTC** — the slot the
retired poke-project `pg_dump` used to hold. Root rather than `deploy` because the
script reaches into the container for credentials that only root can get at.

```
15 3 * * * /opt/poketrack/scripts/backup-db.sh >> /opt/poketrack/backups/backup.log 2>&1
```

Each run writes `/opt/poketrack/backups/poketrack-<UTC stamp>.archive.gz` and keeps
the **14 most recent**. A run is ~1MB, nearly all of it the `pokeapi_cache`
collection. Pruning sits downstream of every failure path in the script, so a
broken dump cannot age out the last good one — it exits first and leaves the
existing archives alone.

Credentials never cross the host shell: the container already carries them as
`MONGO_INITDB_ROOT_*`, so the script expands them inside it and they never appear
in a host process list.

Check it is running:

```bash
ssh $DEPLOY_HOST 'tail -5 /opt/poketrack/backups/backup.log; ls -la /opt/poketrack/backups'
```

### Restoring

Verified end-to-end on 2026-08-02 by restoring into a scratch database and
diffing collection counts against live — all 8 matched.

Rehearse into a scratch namespace first. This touches nothing real:

```bash
ARCHIVE=/opt/poketrack/backups/poketrack-<stamp>.archive.gz
docker exec -i poketrack-db-1 sh -c 'mongorestore --archive --gzip \
  --nsFrom="poketrack.*" --nsTo="restoretest.*" \
  --username="$MONGO_INITDB_ROOT_USERNAME" --password="$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase=admin' < "$ARCHIVE"
```

To restore for real, over the live database:

```bash
ssh $DEPLOY_HOST 'cd /opt/poketrack && docker compose stop app'   # no writes mid-restore
docker exec -i poketrack-db-1 sh -c 'mongorestore --archive --gzip --drop \
  --username="$MONGO_INITDB_ROOT_USERNAME" --password="$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase=admin' < "$ARCHIVE"
ssh $DEPLOY_HOST 'cd /opt/poketrack && docker compose start app'
```

`--drop` clears each collection as it restores it. Collections created *after* the
archive was taken are not in it and therefore survive — drop the database yourself
first if you want the state to match the archive exactly.

## The demo world

Recruiters need to see this app without signing up for it, so the database
carries a seeded world — three teams, eight projects, ~420 tickets, 34 partners
— and three shared accounts that the sign-in page offers as one-click buttons:

| | | |
|---|---|---|
| `owner@poketrack.dev` | Rina Halvorsen, team owner | Charmeleon one 5-point ticket short of Charizard |
| `dev@poketrack.dev` | Marcus Oyelaran, engineer | Eevee stalled on an eight-way branch |
| `new@poketrack.dev` | June Castellanos, new joiner | no partner on the flagship board — lands on the starter picker |

All three share the password **`pokedemo`**, which is printed on the page. They
are ordinary accounts with ordinary write access: a visitor can finish tickets,
evolve a partner and drag things back out of Done, because watching a Charizard
cutscene fire *is* the demo. There is no read-only role and nothing here is
guarded — treat every byte of the demo world as public and disposable.

`backend/seed_demo.py` builds it. Levels are not written as numbers: the seed
asks the real PokéAPI growth table what level 35 costs, converts that to story
points, and issues exactly enough Done tickets to pay for it. Delete one in the
UI and the level really does fall, because the app derives it the same way.

### Building it the first time

The script ships in the image (`COPY backend/ ./`), so on a fresh volume:

```bash
ssh $DEPLOY_HOST 'docker exec poketrack-app-1 python seed_demo.py'
```

It takes a few seconds and is safe to re-run. Then install the cron below.

**The first seed needs PokéAPI reachable.** It resolves every species the demo
will render — including Eevee's eight branches, which the startup prewarm does
not fetch and which the offline `backend/poc/_cache` does not carry; that
fallback only covers the 27 starters. Everything it pulls is written to the
`pokeapi_cache` collection, so later resets are offline-safe. If anything cannot
be resolved the seed prints a `WARNING:` naming the species ids and carries on —
re-run it once the network is back.

### Resetting

`scripts/reset-demo.sh` runs the seed inside the **app** container — that is
where `MONGO_URL` lives and the only place that can reach mongo, which publishes
no port. Root's crontab, at 04:15 UTC, an hour behind the backup so a reset
never lands mid-`mongodump`:

```
15 4 * * * /opt/poketrack/scripts/reset-demo.sh >> /opt/poketrack/backups/reset-demo.log 2>&1
```

Run it by hand any time — before sending the link to someone, for instance:

```bash
ssh $DEPLOY_HOST /opt/poketrack/scripts/reset-demo.sh
```

Two properties make that safe on a live box:

- **It only touches demo data.** The wipe walks out from users marked `is_demo`
  and takes their teams, projects, tickets, partners and ledger with them —
  including anything a visitor created while clicking around, which carries no
  demo marker of its own. A team a demo user merely *joined* is left alone; only
  teams a demo user **owns** are deleted. A real account is never in scope.
- **Ids are derived, not random** — a uuid5 of a fixed namespace. A reset hands
  every user, team and project the same id it had before, so bearer tokens
  (which carry the user id in `sub`) stay valid and bookmarked project URLs keep
  resolving. Nobody is signed out at 04:15.

Check it is running, and read what it wrote:

```bash
ssh $DEPLOY_HOST 'tail -5 /opt/poketrack/backups/reset-demo.log'
```

`--quiet` keeps the `wiped:`/`seeded:` summary — that line is the log's only
record — and drops the per-trainer table. Run it without the flag to see every
trainer's derived level, ticket count and XP residue; a `!` in that table means
a trainer did not land on the level the config asked for.

### Removing it

```bash
ssh $DEPLOY_HOST 'docker exec poketrack-app-1 python seed_demo.py --wipe-only'
```

Then drop the cron line. With no demo users in the database
`/api/auth/demo-accounts` returns `[]`, and both the sign-in panel and the
landing-page hint disappear on their own — neither is hardcoded.

**Do not change `DEMO_NS` in `seed_demo.py`.** It is the fixed uuid5 namespace
every id derives from. Changing it orphans every bookmarked URL and invalidates
every outstanding demo token.

## Analytics

**Nothing runs in the visitor's browser.** `scripts/stats.sh` renders a GoAccess
report from nginx's own access log, hourly from root's crontab:

```
7 * * * * /opt/poketrack/scripts/stats.sh >> /var/log/poketrack-stats.log 2>&1
```

Read it at **`https://poketrack.kimnejudne.dev/_stats/`**, behind basic auth
(`/etc/nginx/poketrack-stats.htpasswd`, user `kim`). Rotate the password with:

```bash
ssh $DEPLOY_HOST 'printf "kim:%s\n" "$(openssl passwd -apr1 NEWPASSWORD)" \
  > /etc/nginx/poketrack-stats.htpasswd && systemctl reload nginx'
```

`auth_basic` is scoped to the `/_stats/` location deliberately. At server level it
would also cover the ACME challenge path and quietly break certificate renewal.

The vhost writes to its own `/var/log/nginx/poketrack.access.log` so the report
does not have to sieve four vhosts apart; logrotate's existing `*.log` rule covers
it at daily/14. The script reparses that whole retained window each run and keeps
no `--persist` database, which makes it idempotent — a re-run cannot double-count
lines it already read. IPs are anonymised and crawlers ignored.

This *replaced* client-side analytics rather than supplementing it — see History.

## History

The scaffold shipped two third-party scripts in `frontend/public/index.html`: a
loader from `assets.emergent.sh` and an inline PostHog snippet with session
recording enabled, keyed to Emergent's project and ingest host. Both were removed
on 2026-08-02 and replaced by the log-based report above.

This is not about hiding the scaffold origin — the case study states that plainly
and should. It is that the key was not Kim's, so the data was unreadable to him
while the recording liability was his; the loader was a parser-blocking script
from an origin he does not control; and neither was referenced anywhere in the
application code.

This subdomain previously served **poke-project** — an unrelated Next.js +
Drizzle + Postgres + Clerk app, deployed pull-based from GHCR by a GitHub Actions
workflow. It was torn down on 2026-08-02 and replaced by this app. That workflow
(`Deploy` in `kim-nejudne/poke-project`) was disabled at the same time; if it is
ever re-enabled it will deploy the old app straight over this one.
