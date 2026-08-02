# PokéTrack — deploy runbook

Authority for ports, env and exact commands for `poketrack.kimnejudne.dev`.
If something here disagrees with the root `CLAUDE.md`, this file wins.

## Shape

Two artifacts, two paths, one hostname:

| | |
|---|---|
| Host | DigitalOcean droplet `165.245.189.5` (sgp1), shared with `n8n`, `tallow`, `netint-vpuaas` |
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
docker save poketrack:$TAG | ssh root@165.245.189.5 'docker load'

# 2. SPA bundle -> droplet
#    REACT_APP_BACKEND_URL is deliberately empty: the SPA is same-origin, so
#    src/lib/api.js resolves the API to a relative /api. Setting it to the full
#    host would work but would start sending needless CORS preflights.
( cd frontend && REACT_APP_BACKEND_URL= GENERATE_SOURCEMAP=false yarn build )
rsync -az --delete frontend/build/ root@165.245.189.5:/var/www/poketrack/
ssh root@165.245.189.5 'chown -R www-data:www-data /var/www/poketrack'

# 3. point the stack at the new tag and restart the API
ssh root@165.245.189.5 "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/' /opt/poketrack/.env \
  && cd /opt/poketrack && docker compose up -d"
```

Order matters only in that step 3 should not run long before step 2 — the SPA
and the API ship as one release.

## Rolling back

Previous images stay on the box. Roll back without rebuilding:

```bash
ssh root@165.245.189.5 'docker images poketrack'          # list known-good tags
ssh root@165.245.189.5 "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<good-sha>/' /opt/poketrack/.env \
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
ssh root@165.245.189.5 'docker ps --filter name=poketrack'   # both Up (healthy)
ssh root@165.245.189.5 'docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}"'
```

On boot the app kicks off a background PokéAPI prewarm (27 starters plus their
evolution chains and growth rates) into the `pokeapi_cache` collection. It is
non-blocking and failure is logged, not fatal: `backend/poc/_cache` is baked into
the image as an offline fallback, so the app still plays without the network.
A cold first `/pokedex/starters` can take a few seconds; later ones are cached.

## Backups

**There are none yet.** The retired poke-project stack had a nightly `pg_dump`
cron under the `deploy` user; it was removed with that stack and has no MongoDB
equivalent. If this app grows data worth keeping, a `mongodump` on the same 03:15
schedule is the obvious replacement.

## History

This subdomain previously served **poke-project** — an unrelated Next.js +
Drizzle + Postgres + Clerk app, deployed pull-based from GHCR by a GitHub Actions
workflow. It was torn down on 2026-08-02 and replaced by this app. That workflow
(`Deploy` in `kim-nejudne/poke-project`) was disabled at the same time; if it is
ever re-enabled it will deploy the old app straight over this one.
