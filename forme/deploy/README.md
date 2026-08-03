# FORME — droplet deployment

Runs on the shared DigitalOcean droplet `165.245.189.5` (sgp1) alongside `n8n`,
`netint-vpuaas`, `poketrack`, `tallow` and the static `plinth` vhost. 1.9GB of
RAM total and a 2GB swapfile that is already ~450MB in use, so every service is
memory-capped and nothing here builds on the box.

| | |
|---|---|
| Host path | `/opt/forme` (`compose.yaml` + `.env`, mode 600) |
| Web port | `127.0.0.1:3005` → container `:3000` (loopback only) |
| API port | `127.0.0.1:3006` → container `:4000` (loopback only) |
| Postgres | compose-internal only, no published port, volume `forme_forme-db` |
| Artwork | volume `forme_forme-artwork` → `/data/artwork` |
| nginx | `/etc/nginx/sites-available/forme` → `forme.kimnejudne.dev` |
| Images | `forme-api`, `forme-web`, built on the workstation |

Ports 3001, 3003 and 3004 were already taken by the co-tenants; 3005/3006 were
the next free pair.

## Status

The stack is **deployed and running** at `f310acd`, serving correctly on loopback
and through nginx on the `Host` header. It is **not yet reachable from the
internet**: `forme.kimnejudne.dev` has no DNS record, so there is no
certificate. Two manual steps remain — see *Going live* below.

## Memory

Measured on the droplet with the stack running:

| | limit | actual |
|---|---|---|
| `forme-api` | 320m | ~57MB |
| `forme-web` | 224m | ~46MB |
| `forme-db` | 160m | ~42MB |

Adding the stack took available memory from 1024MB to 759MB and moved swap by
14MB. The `api` cap is the loose one on purpose: ghostscript is spawned per
preflight job and a spike there should not be an OOM kill mid-run.

`PREFLIGHT_CONCURRENCY` is pinned to 1. Two vCPUs are shared with six other
containers, and ghostscript is the only genuinely CPU-hungry thing in the
stack.

## Going live — the two steps that need a human

**1. DNS, at Namecheap.** DNS is not at DigitalOcean, so this cannot be
scripted from the droplet. Add an A record by hand:

```
Type: A    Host: forme    Value: 165.245.189.5    TTL: Automatic
```

Confirm it has propagated before continuing — certbot validates over HTTP-01
and a failed run counts against Let's Encrypt's rate limit:

```bash
dig +short forme.kimnejudne.dev A     # must print 165.245.189.5
```

**2. TLS.** The port-80 vhost is already installed and answering, which is what
the challenge needs:

```bash
ssh root@165.245.189.5 'certbot --nginx -d forme.kimnejudne.dev'
```

Certbot edits the vhost in place to add the TLS block and the port-80 redirect.
Leave its managed lines alone. After it runs:

```bash
curl -sI https://forme.kimnejudne.dev/ | head -1        # 200
curl -s  https://forme.kimnejudne.dev/api/health        # {"status":"ok",...}
```

## Deploying a new build

The droplet shares 1.9GB with six other containers and must never run `npm ci`
or `docker build`. Build on a workstation and ship the images:

```bash
# on the workstation, in forme/
TAG=$(git rev-parse --short HEAD)
docker build -f api/Dockerfile      -t forme-api:$TAG .   # context is the REPO ROOT
docker build -f frontend/Dockerfile -t forme-web:$TAG .
docker save forme-api:$TAG forme-web:$TAG | gzip -1 \
  | ssh root@165.245.189.5 'gunzip | docker load'

# on the droplet
ssh root@165.245.189.5
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" /opt/forme/.env
cd /opt/forme && docker compose up -d
```

Both Dockerfiles take the **repo root** as build context, not their own
directory — the workspace lockfile and `@forme/domain` both live above them.

`migrate` runs to completion before `api` starts. It applies pending drizzle
migrations, then seeds *only if the tables are empty*, so re-running it against
a populated database is a no-op.

The deployed tag is the commit it was built from — currently `f310acd`. Check
what is actually running before assuming:

```bash
ssh root@165.245.189.5 'cd /opt/forme && docker compose ps --format "{{.Name}}\t{{.Image}}"'
```

## Old images

`docker load` keeps every tag ever shipped, and two images per deploy fills 87GB
of disk faster than it sounds. After a few deploys:

```bash
ssh root@165.245.189.5 'docker image prune -a --filter "until=336h" -f'
```

## Secrets

`/opt/forme/.env` is mode 600 and was generated **on the droplet** — the
Postgres password and `JWT_SECRET` have never existed on a workstation or in
this repo. The API refuses to boot without `JWT_SECRET`, and validates the
whole environment at startup rather than failing at the first request.

`DEMO_PASSWORD` is deliberately not a secret: it is shown on the sign-in screen
so the portfolio is walkable. The four seeded accounts it unlocks are flagged
`is_demo`, which `DenyDemoWritesGuard` turns into read-only — they can read
every surface and change nothing.

To rotate `JWT_SECRET`, edit `.env` and `docker compose up -d api`. Every
existing session is invalidated, which is the point.

## Artwork

Customer PDFs live in the `forme_forme-artwork` volume, named by SHA-256 so a
re-upload of the same bytes deduplicates. A daily cron inside the API removes
the bytes for jobs despatched or cancelled more than `ARTWORK_RETENTION_DAYS`
(90) ago, keeping the `job_files` rows so the audit trail survives.

`ARTWORK_MAX_BYTES` (200MB) must stay in step with `client_max_body_size` in the
nginx vhost. If they disagree, nginx rejects a large upload with its own 413
before the API can explain what went wrong.

## Verifying the guards after a change

Every one of these must be `401`:

```bash
for r in "GET /api/jobs" "GET /api/jobs/queue" "GET /api/customers" \
         "GET /api/imposition/plan" "PATCH /api/pricing" \
         "POST /api/jobs/FM-2608-0417/approve"; do
  printf "%s %s\n" "$(curl -s -o /dev/null -w '%{http_code}' \
    -X ${r%% *} https://forme.kimnejudne.dev${r#* })" "$r"
done
```

The same sweep runs as `npm run test:e2e`, table-driven across every route and
every role, against a throwaway `forme_test` database.

## Backups

**Not yet configured.** No dump timer exists for `forme_forme-db`.

Currently acceptable because everything in it is regenerable demo seed, and
because the artwork volume holds only test PDFs. It stops being acceptable the
moment a real job or a real customer record lands in there — the same open item
TALLOW carries.

## Rolling back

Images are kept, so a rollback is a tag change:

```bash
ssh root@165.245.189.5
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<previous>/" /opt/forme/.env
cd /opt/forme && docker compose up -d
```

Drizzle migrations are forward-only. Rolling the image back does **not** undo a
schema change, so a rollback across a migration needs a new migration rather
than an older tag.
