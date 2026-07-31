# TALLOW — droplet deployment

Runs on the shared DigitalOcean droplet `165.245.189.5` (sgp1) alongside `n8n`,
`netint-vpuaas`, `poketrack` and — for now — `marrow`. 1.9GB of RAM total, so every
service is memory-capped.

| | |
|---|---|
| Host path | `/opt/tallow` (`compose.yaml` + `.env`, mode 600) |
| App port | `127.0.0.1:3003` → container `:3000` (loopback only) |
| Postgres | compose-internal only, no published port, volume `tallow_tallow-db` |
| nginx | `/etc/nginx/sites-available/tallow` → `tallow.kimnejudne.dev` |
| Basic auth | `/etc/nginx/.htpasswd-tallow`, user `tallow` |

## Basic auth is load-bearing

The six `/api/admin/*` routes hand out a session token but **never check it**.
`auth_basic` on the vhost is the only thing standing between the public internet
and "read every guest reservation, delete any menu item". Do not remove it until
those routes enforce auth server-side.

Verify it still holds after any nginx change:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: tallow.kimnejudne.dev' \
  http://127.0.0.1/api/admin/reservations   # must be 401
```

## Deploying a new build

The droplet has 1 vCPU and should not run `npm ci`. Build on a workstation and
ship the image:

```bash
# on the workstation, in tallow/
TAG=$(git rev-parse --short HEAD)
docker build -t tallow:$TAG .
docker save tallow:$TAG | gzip -1 | ssh root@165.245.189.5 'gunzip | docker load'

# on the droplet
ssh root@165.245.189.5
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" /opt/tallow/.env
cd /opt/tallow && docker compose up -d
```

`migrate` runs to completion before `app` starts, and is idempotent — it applies
the schema, then seeds only if the tables are empty.

## Seed data

The runtime image carries no `data/` directory, so migrate seeds from the bundled
`src/data/initialData.ts`: 12 menu items and 5 **fictional** reservations
(555 phone numbers). No real guest data is shipped.

## TLS

Issue the certificate once `tallow.kimnejudne.dev` resolves — DNS is at Namecheap,
not DigitalOcean, so the A record must be added there by hand:

```bash
certbot --nginx -d tallow.kimnejudne.dev
```

Certbot edits the vhost in place; leave its managed lines alone.

## Backups

**Not yet configured.** Marrow has `marrow-backup.timer`; tallow has no equivalent.
Currently acceptable because all data is regenerable demo seed, but any real content
added through the staff dashboard is unprotected until a timer is added.
