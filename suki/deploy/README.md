# Deploying SUKI

`suki.kimnejudne.dev` — a static PWA served off disk by nginx, plus a NestJS
sync API and Postgres in a compose stack. This file is the authority on ports,
env and exact commands.

Everything is built **on the workstation** and shipped over ssh. The droplet
shares 1.9GB with `n8n`, `netint-vpuaas`, `poketrack`, `tallow` and `forme`; it
does not run `npm ci` or `docker build`.

| | |
|---|---|
| Host | `165.245.189.5` (sgp1) |
| Stack dir | `/opt/suki` |
| Static root | `/var/www/suki` |
| API port | `127.0.0.1:3007` → container `4100` |
| nginx vhost | `/etc/nginx/sites-available/suki.conf` |
| Backups | `/var/backups/suki`, nightly 03:40, 14 days |

## Why the split

The web app is static and the API is not, so they deploy differently. The app
is `rsync`ed as files; a Node process whose whole job is returning files it
already has would cost ~60MB of RSS this box cannot spare.

They share one origin regardless. A service worker can only control pages on
its own origin, and a separate API host would put a CORS preflight in front of
the one request path that runs on a phone with one bar of signal.

## First deploy

### 1. DNS, by hand, before anything else

An A record for `suki` → `165.245.189.5` at **Namecheap** (DNS is not with
DigitalOcean). Certbot cannot issue until it resolves:

```sh
dig +short suki.kimnejudne.dev    # must print 165.245.189.5
```

### 2. Secrets

On the droplet, `/opt/suki/.env` — never committed, never in the image:

```sh
ssh root@165.245.189.5 'mkdir -p /opt/suki && chmod 700 /opt/suki'
```

```ini
POSTGRES_USER=suki
POSTGRES_PASSWORD=<openssl rand -base64 32>
POSTGRES_DB=suki

# Sent on every sync request. The API refuses to boot without it.
# NOTE: this same value goes into the web bundle at build time, so it is not
# a secret — see "What the device key is" below.
DEVICE_KEY=<openssl rand -base64 48>

WEB_ORIGIN=https://suki.kimnejudne.dev
IMAGE_TAG=local
```

```sh
ssh root@165.245.189.5 'chmod 600 /opt/suki/.env'
```

### 3. Ship the API image

From the repo root (the build context is the workspace root — the API imports
`@suki/domain` from a sibling workspace):

```sh
docker build -f api/Dockerfile -t suki-api:local .
docker save suki-api:local | gzip | ssh root@165.245.189.5 'gunzip | docker load'
scp deploy/compose.deploy.yaml root@165.245.189.5:/opt/suki/compose.yaml
```

### 4. Start the stack

```sh
ssh root@165.245.189.5 'cd /opt/suki && docker compose up -d'
ssh root@165.245.189.5 'curl -s localhost:3007/api/health'
```

`migrate` runs to completion before `api` starts; `api` waits on both it and the
database healthcheck.

### 5. Build and ship the web app

`VITE_DEVICE_KEY` must match `DEVICE_KEY` in `/opt/suki/.env`, and
`VITE_API_URL` is same-origin in production so nginx proxies it:

```sh
cd frontend
VITE_API_URL=/api VITE_DEVICE_KEY='<the key>' npm run build
rsync -av --delete dist/ root@165.245.189.5:/var/www/suki/
```

`--delete` matters: stale content-hashed assets accumulate otherwise, and an
old `sw.js` left behind would keep serving a precache manifest naming files
that no longer exist.

### 6. nginx and TLS

```sh
scp deploy/nginx/suki.conf root@165.245.189.5:/etc/nginx/sites-available/suki.conf
ssh root@165.245.189.5 'ln -sf /etc/nginx/sites-available/suki.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx'
ssh root@165.245.189.5 'certbot --nginx -d suki.kimnejudne.dev'
```

Certbot rewrites the `listen` lines and adds the TLS block. Leave those alone
on subsequent edits.

### 7. Backups

```sh
scp deploy/backup/suki-backup.sh root@165.245.189.5:/usr/local/bin/
scp deploy/backup/suki-backup.{service,timer} root@165.245.189.5:/etc/systemd/system/
ssh root@165.245.189.5 'chmod 755 /usr/local/bin/suki-backup.sh && systemctl daemon-reload && systemctl enable --now suki-backup.timer'
ssh root@165.245.189.5 'systemctl start suki-backup.service && journalctl -u suki-backup.service -n 20 --no-pager'
```

Run it once by hand and read the output. The script refuses to keep a dump that
fails its checks, so a silent success is the only acceptable result — and the
first time it ran during development it correctly refused a dump, because its
size floor was set too high for a three-table schema.

## Updating

API only:

```sh
docker build -f api/Dockerfile -t suki-api:local .
docker save suki-api:local | gzip | ssh root@165.245.189.5 'gunzip | docker load'
ssh root@165.245.189.5 'cd /opt/suki && docker compose up -d api'
```

Web only:

```sh
cd frontend && VITE_API_URL=/api VITE_DEVICE_KEY='<the key>' npm run build
rsync -av --delete dist/ root@165.245.189.5:/var/www/suki/
```

No nginx reload is needed for a web update — the files are read per request.

## The caching rules are load-bearing

`deploy/nginx/suki.conf` is the one file here where a mistake is not a slow
site but a bricked deploy. If `sw.js` is served with a long `max-age`, every
visitor keeps running the version they first installed, forever, and there is
no way to reach them: the old worker serves the old precache manifest, which
serves the old app.

Verified per route against a real build:

| Path | Cache-Control |
|---|---|
| `/`, `/stock`, any route | `no-cache` |
| `/sw.js`, `/registerSW.js`, `/workbox-*.js` | `no-cache` |
| `/manifest.webmanifest` | `no-cache` |
| `/assets/*` (content-hashed) | `public, max-age=31536000, immutable` |
| `/icon*.png`, `/icon.svg` (not hashed) | `public, max-age=86400` |
| `/api/*` | `no-store` |

The icons are deliberately *not* immutable: their filenames never change, so
`immutable` would be a promise the build cannot keep — redrawing the mark would
leave every installed phone showing the old one.

Check after any nginx change:

```sh
for p in / /sw.js /manifest.webmanifest /icon-192.png; do
  printf '%-24s ' "$p"
  curl -sI "https://suki.kimnejudne.dev$p" | grep -i '^cache-control'
done
```

A missing asset must 404 rather than fall back to `index.html` — otherwise a
stale hash returns HTML with a JS content type and the failure reads as a parse
error somewhere unrelated:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://suki.kimnejudne.dev/assets/nope.js   # 404
```

## What the device key is

It gates both sync routes and it ships inside the JS bundle, so anyone who
opens devtools has it. It is not authentication and is not presented as any.

What it does buy: drive-by scanners and crawlers cannot append to an
append-only log, and the two routes are rate limited (120 pushes and 240 pulls
per minute) behind it. What it does not buy: anything against someone who
looked.

SUKI has no accounts on purpose. A sign-in screen between a shopkeeper and a
sale she is ringing up in front of a customer is the wrong trade for a demo
shop, and pretending a bundled constant is a password would be worse than
saying plainly what it is.

To rotate it: change `DEVICE_KEY` in `/opt/suki/.env`, `docker compose up -d
api`, then rebuild and rsync the web app with the matching `VITE_DEVICE_KEY`.
Do them in that order and phones will fail to sync for the seconds in between —
which is exactly what the queue is for; nothing is lost.

## Restoring

The dumps are `pg_dump --clean --if-exists`, so they replay over a live
database:

```sh
ssh root@165.245.189.5
cd /opt/suki
zcat /var/backups/suki/suki-<stamp>.sql.gz | docker compose exec -T db psql -U suki -d suki
```

Verify a dump before you need it — restore into a scratch database and count:

```sh
docker compose exec db psql -U suki -d postgres -c 'CREATE DATABASE restore_check'
zcat /var/backups/suki/suki-<stamp>.sql.gz | docker compose exec -T db psql -U suki -d restore_check
docker compose exec db psql -U suki -d restore_check -tA -c 'select count(*) from operations'
docker compose exec db psql -U suki -d postgres -c 'DROP DATABASE restore_check'
```

## Troubleshooting

**`migrate` exits 1 with `password authentication failed`.** The database
volume was created with a different `POSTGRES_PASSWORD`. Postgres only reads it
when initialising, so changing `.env` afterwards has no effect. Either set the
password back, or `docker compose down -v` and restore from a dump — the second
destroys data, so take a dump first.

**The app loads but never leaves "pending".** Check the device key matches on
both sides:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -H "x-suki-device-key: $KEY" \
  'https://suki.kimnejudne.dev/api/sync/pull?clientId=x&since=0'    # 200, not 401
```

A 401 means the bundle and `/opt/suki/.env` disagree — rebuild the web app.

**An update does not reach a phone.** Confirm `sw.js` is `no-cache` (table
above). If it was ever served with a long `max-age`, affected devices need the
app removed and reinstalled; there is no server-side fix.

**Memory.** `mem_limit` is 192m for Postgres, 256m for the API. Check the box
before blaming SUKI:

```sh
ssh root@165.245.189.5 'free -m && docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"'
```
