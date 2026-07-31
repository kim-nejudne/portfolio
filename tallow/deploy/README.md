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
| Auth | in-app bearer sessions; no nginx gate (site is public) |

## Authentication

The site is public — no gate in front of it. Access control lives in the app:

| PIN | Role | Can |
|---|---|---|
| `STAFF_PIN` (private) | `staff` | read the dashboard, 86 dishes, edit the menu, change reservation status |
| `DEMO_PIN` (shown on the sign-in screen) | `demo` | read the dashboard only |

Sessions are HMAC-signed with `SESSION_SECRET` and expire after 8 hours. They are
not stored server-side, so a restart does not sign anyone out. Every `/api/admin/*`
route is guarded: reads need any session, writes need `staff`, and a `demo` write
returns 403 with `readOnly: true`, which the dashboard surfaces as a banner.

Verify the guards still hold after any change:

```bash
# all six must be 401
for r in "GET /api/admin/reservations" "POST /api/admin/86" \
         "POST /api/admin/dish-of-the-day" "POST /api/admin/menu/save" \
         "DELETE /api/admin/menu/cut-1" "PATCH /api/admin/reservations/x/status"; do
  curl -s -o /dev/null -w "%{http_code} ${r}\n" -X ${r%% *} https://tallow.kimnejudne.dev${r#* }
done
```

Sign-in is rate limited to 10 attempts per IP per 10 minutes. `trust proxy` is set
to 1 so that limiter keys on the real client IP rather than nginx's.

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
