# PLINTH — droplet deployment

Runs on the shared DigitalOcean droplet `165.245.189.5` (sgp1) alongside `n8n`,
`netint-vpuaas`, `poketrack` and `tallow`. 1.9GB of RAM total.

| | |
|---|---|
| Host path | `/var/www/plinth` (static files, owned by `www-data`) |
| Process | **none** — nginx serves from disk |
| nginx | `/etc/nginx/sites-available/plinth` → `plinth.kimnejudne.dev` |
| Auth | none; the site is public |
| App source | `frontend/` (Vite + React 19 + TS) |

## What this replaced

This vhost previously served a *different* PLINTH — a gym marketing site
("Strength is a discipline, not a mood"). It was deliberately replaced on
2026-08-02 by this site, the 16-week periodised program formerly called BLOCK.

The gym site's source is preserved locally on branch `recovered/plinth-craft-pass`
and tag `recovery/plinth-2026-07-31`. Its last build output is in `dist/` at the
repo root (not `frontend/dist/`). **Neither is on any remote** — do not delete
them without pushing first.

## Why this isn't containerised like tallow

TALLOW is Express + Postgres, so it needs a runtime and gets a compose stack.
PLINTH is a pure static Vite build with no server process at all. Running a
container purely to hand out ~900KB of static assets would cost memory on an
already-crowded box and buy nothing — nginx is already running and already
terminating TLS for four other sites.

A deploy is a build plus an rsync. There is no image and no container.

## Deploying

```bash
./deploy/deploy.sh
```

Typechecks and builds in `frontend/`, precompresses (`gzip -9`, served by
`gzip_static` so the single vCPU isn't recompressing per request), **tars the
current `/var/www/plinth` to `/var/backups/plinth-<UTC-stamp>.tar.gz`**, rsyncs
with `--delete` so stale asset hashes don't accumulate, then reloads nginx.

Override the target with `PLINTH_HOST=root@host ./deploy/deploy.sh`.

## Rollback

Every run prints the exact restore command for the backup it just took:

```bash
ssh root@165.245.189.5 'rm -rf /var/www/plinth/* \
  && tar -xzf /var/backups/plinth-<STAMP>.tar.gz -C /var/www/plinth \
  && chown -R www-data:www-data /var/www/plinth && systemctl reload nginx'
```

## Caching

`/assets/` is content-hashed by Vite and served `immutable` for a year.
`index.html` is served `no-cache` — it's rewritten every deploy and a cached copy
would keep pointing at asset hashes that no longer exist.

nginx does **not** merge `add_header` across levels: any location block with an
`add_header` discards every header inherited from the server block. The security
headers are therefore repeated per location rather than set once at server level,
where they would silently apply to nothing.

## DNS and TLS

Both already in place from the previous site — the A record (`plinth` →
`165.245.189.5`, at **Namecheap**, not DigitalOcean) and the certbot certificate
for `plinth.kimnejudne.dev` are unchanged by this deploy. Nothing to redo.

## Known gaps carried over from the scaffold

The site this replaced had these; this one does not yet:

- **No favicon set** — `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`
  will 404. Browsers request `/favicon.ico` unprompted.
- **No `site.webmanifest`.**
- **No share card / Open Graph tags** — links to the site will preview bare.
  The previous site generated these with a `npm run brand` script.
- **No `robots.txt`.**

None of these break the page; the document references none of them. They are
polish items worth closing before the site is shown to anyone.
